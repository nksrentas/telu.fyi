use crate::knowledge::extraction::WindowStop;
use crate::knowledge::matcher::normalized_key;
use crate::knowledge::models::AbstentionReason;
use crate::knowledge::parse::{parse_extraction, ParsedAttribute, ParsedExtraction, ParsedItem};
use crate::knowledge::prompt::{ChunkWindow, EXTRACTION_SYSTEM_PROMPT};
use crate::knowledge::repository::{NewAbstention, NewItem};
use crate::knowledge::span_verifier::{verify_attribute, verify_claim_quote, AttributeSupport, LabeledSegments, VerifiedSpan};
use serde::Serialize;
use std::future::Future;
use std::ops::Add;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StageCounts {
    pub completions: usize,
}

impl Add for StageCounts {
    type Output = Self;

    fn add(self, other: Self) -> Self {
        Self {
            completions: self.completions + other.completions,
        }
    }
}

pub(crate) struct WindowCandidates {
    pub items: Vec<NewItem>,
    pub abstentions: Vec<NewAbstention>,
    pub malformed: bool,
    pub stages: StageCounts,
}

pub(crate) async fn window_candidates<F, Fut>(
    window: &ChunkWindow,
    cancel: &CancellationToken,
    complete: &mut F,
) -> Result<WindowCandidates, WindowStop>
where
    F: FnMut(String, String) -> Fut,
    Fut: Future<Output = Result<String, String>>,
{
    if cancel.is_cancelled() {
        return Err(WindowStop::Cancelled);
    }
    let reply = complete(EXTRACTION_SYSTEM_PROMPT.to_string(), window.user_prompt.clone())
        .await
        .map_err(|_| stop_reason(cancel))?;
    let parsed = parse_extraction(&reply).ok();
    let malformed = parsed.is_none();
    let (items, abstentions) = parsed.map(|parsed| verified(parsed, &window.segments)).unwrap_or_default();
    Ok(WindowCandidates {
        items,
        abstentions,
        malformed,
        stages: StageCounts { completions: 1 },
    })
}

fn stop_reason(cancel: &CancellationToken) -> WindowStop {
    if cancel.is_cancelled() {
        WindowStop::Cancelled
    } else {
        WindowStop::ProviderError
    }
}

fn verified(parsed: ParsedExtraction, segments: &LabeledSegments) -> (Vec<NewItem>, Vec<NewAbstention>) {
    let (items, abstentions): (Vec<_>, Vec<_>) = parsed
        .items
        .into_iter()
        .map(|item| verify_item(item, segments))
        .partition(Result::is_ok);
    (
        items.into_iter().filter_map(Result::ok).collect(),
        parsed.rejected.into_iter().chain(abstentions.into_iter().filter_map(Result::err)).collect(),
    )
}

fn verify_item(item: ParsedItem, segments: &LabeledSegments) -> Result<NewItem, NewAbstention> {
    let (claims, first_failure) = verify_claims(&item, segments);
    if claims.is_empty() {
        return Err(NewAbstention {
            reason: first_failure.unwrap_or(AbstentionReason::QuoteNotFound),
            candidate_type: Some(item.item_type),
        });
    }
    let claim_evidence_ids: Vec<String> = claims.iter().map(|span| span.evidence_id.clone()).collect();
    Ok(NewItem {
        item_id: Uuid::new_v4().to_string(),
        item_type: item.item_type,
        normalized_key: normalized_key(&item.text),
        owner: attribute_support(item.owner.as_ref(), segments, &claim_evidence_ids),
        due: attribute_support(item.due.as_ref(), segments, &claim_evidence_ids),
        text: item.text,
        claims,
    })
}

fn verify_claims(
    item: &ParsedItem,
    segments: &LabeledSegments,
) -> (Vec<VerifiedSpan>, Option<AbstentionReason>) {
    let mut spans: Vec<VerifiedSpan> = Vec::new();
    let mut first_failure = None;
    for quote in &item.evidence {
        match verify_claim_quote(&quote.segment, &quote.quote, segments) {
            Ok(verified) => {
                for span in verified {
                    let duplicate = spans.iter().any(|known| {
                        (known.evidence_id.as_str(), known.raw_start, known.raw_end)
                            == (span.evidence_id.as_str(), span.raw_start, span.raw_end)
                    });
                    if !duplicate {
                        spans.push(span);
                    }
                }
            }
            Err(reason) => first_failure = first_failure.or(Some(reason)),
        }
    }
    (spans, first_failure)
}

fn attribute_support(
    attribute: Option<&ParsedAttribute>,
    segments: &LabeledSegments,
    claim_evidence_ids: &[String],
) -> AttributeSupport {
    attribute
        .map(|attribute| {
            verify_attribute(&attribute.value, &attribute.segment, &attribute.quote, segments, claim_evidence_ids)
        })
        .unwrap_or(AttributeSupport::NotStated)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::models::TranscriptEvidence;
    use crate::knowledge::extraction::extract_from_segments;
    use crate::knowledge::prompt::{chunk_windows, label_segments};
    use crate::knowledge::test_support::{insert_evidence, insert_meeting, migrated_pool, MEETING_ID};
    use crate::database::repositories::transcript::TranscriptsRepository;
    use std::sync::{Arc, Mutex};

    const TEXTS: [&str; 2] = [
        "We agreed to ship the beta on Friday.",
        "Maria will own the release notes by Monday.",
    ];
    const ONE_SEGMENT_BUDGET: usize = 10;
    const ITEM_A: &str = r#"{"items":[{"type":"decision","text":"Ship the beta on Friday","evidence":[{"segment":"S1","quote":"ship the beta on Friday"}]}]}"#;

    async fn evidence() -> Vec<TranscriptEvidence> {
        let pool = migrated_pool().await;
        insert_meeting(&pool, MEETING_ID, "complete", "complete").await;
        for (sequence, text) in TEXTS.iter().enumerate() {
            let evidence_id = format!("018f5e27-2f68-7e27-9c90-7c72123149{sequence:02x}");
            insert_evidence(&pool, MEETING_ID, &evidence_id, sequence as i64, text).await;
        }
        TranscriptsRepository::list_evidence_by_meeting(&pool, MEETING_ID)
            .await
            .expect("evidence rows")
    }

    #[tokio::test]
    async fn extraction_checks_cancellation_before_every_completion() {
        let segments = label_segments(&evidence().await);
        let cancel = CancellationToken::new();
        let calls = Arc::new(Mutex::new(0));
        let (counted, cancelling) = (Arc::clone(&calls), cancel.clone());
        let mut complete = move |_: String, _: String| {
            *counted.lock().expect("calls") += 1;
            cancelling.cancel();
            async move { Ok(ITEM_A.to_string()) }
        };

        let result = extract_from_segments(&segments, ONE_SEGMENT_BUDGET, Vec::new(), &cancel, &mut complete).await;
        let window = &chunk_windows(&segments, ONE_SEGMENT_BUDGET)[0];
        let direct = window_candidates(window, &cancel, &mut complete).await;

        assert_eq!(result.err(), Some(WindowStop::Cancelled));
        assert_eq!(direct.err(), Some(WindowStop::Cancelled));
        assert_eq!(*calls.lock().expect("calls"), 1);
    }

    #[tokio::test]
    async fn stage_counts_record_every_completion_call() {
        let segments = label_segments(&evidence().await);
        let calls = Arc::new(Mutex::new(0));
        let counted = Arc::clone(&calls);
        let mut complete = move |_: String, _: String| {
            *counted.lock().expect("calls") += 1;
            async move { Ok(ITEM_A.to_string()) }
        };

        let outcome = extract_from_segments(&segments, ONE_SEGMENT_BUDGET, Vec::new(), &CancellationToken::new(), &mut complete)
            .await
            .expect("extraction");

        assert_eq!(outcome.window_count, 2);
        assert_eq!(outcome.stages.completions, *calls.lock().expect("calls"));
        assert_eq!(outcome.stages.completions, 2);
    }
}
