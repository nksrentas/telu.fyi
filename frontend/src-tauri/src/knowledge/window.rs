use crate::knowledge::extraction::WindowStop;
use crate::knowledge::matcher::normalized_key;
use crate::knowledge::models::AbstentionReason;
use crate::knowledge::parse::{parse_extraction, ParsedAttribute, ParsedExtraction, ParsedItem};
use crate::knowledge::prompt::{missed_items_prompt, ChunkWindow, EXTRACTION_SYSTEM_PROMPT, MISSED_ITEMS_SYSTEM_PROMPT};
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
    pub missed_added: usize,
    pub missed_malformed: usize,
}

impl Add for StageCounts {
    type Output = Self;

    fn add(self, other: Self) -> Self {
        Self {
            completions: self.completions + other.completions,
            missed_added: self.missed_added + other.missed_added,
            missed_malformed: self.missed_malformed + other.missed_malformed,
        }
    }
}

pub(crate) struct WindowCandidates {
    pub items: Vec<NewItem>,
    pub abstentions: Vec<NewAbstention>,
    pub first_pass_malformed: bool,
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
    let first_reply = completion(EXTRACTION_SYSTEM_PROMPT, window.user_prompt.clone(), cancel, complete).await?;
    let first = parse_extraction(&first_reply).ok();
    let first_pass_malformed = first.is_none();
    let (found, first_abstentions) = first.map(|parsed| verified(parsed, &window.segments)).unwrap_or_default();
    let missed_reply = completion(MISSED_ITEMS_SYSTEM_PROMPT, missed_items_prompt(window, &found), cancel, complete).await?;
    let missed = parse_extraction(&missed_reply).ok();
    let missed_malformed = usize::from(missed.is_none());
    let (added, missed_abstentions) = missed.map(|parsed| verified(parsed, &window.segments)).unwrap_or_default();
    Ok(WindowCandidates {
        stages: StageCounts {
            completions: 2,
            missed_added: added.len(),
            missed_malformed,
        },
        items: found.into_iter().chain(added).collect(),
        abstentions: first_abstentions.into_iter().chain(missed_abstentions).collect(),
        first_pass_malformed,
    })
}

async fn completion<F, Fut>(
    system_prompt: &str,
    user_prompt: String,
    cancel: &CancellationToken,
    complete: &mut F,
) -> Result<String, WindowStop>
where
    F: FnMut(String, String) -> Fut,
    Fut: Future<Output = Result<String, String>>,
{
    if cancel.is_cancelled() {
        return Err(WindowStop::Cancelled);
    }
    complete(system_prompt.to_string(), user_prompt)
        .await
        .map_err(|_| stop_reason(cancel))
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
    use crate::database::repositories::transcript::TranscriptsRepository;
    use crate::knowledge::extraction::{extract_from_segments, input_fingerprint, run_extraction, WindowStop};
    use crate::knowledge::models::{RunStatus, TriggerKind};
    use crate::knowledge::prompt::{chunk_windows, label_segments, EXTRACTION_SYSTEM_PROMPT, MISSED_ITEMS_SYSTEM_PROMPT};
    use crate::knowledge::repository::{KnowledgeRepository, NewRun};
    use crate::knowledge::test_support::{insert_evidence, insert_meeting, migrated_pool, MEETING_ID};
    use sqlx::SqlitePool;
    use std::sync::{Arc, Mutex};
    use tokio_util::sync::CancellationToken;

    const RUN_ID: &str = "018f5e27-2f68-7e27-9c90-7c7212314901";
    const LARGE_BUDGET: usize = 100_000;
    const TEXTS: [&str; 2] = [
        "We agreed to ship the beta on Friday.",
        "Maria will own the release notes by Monday.",
    ];
    const ITEM_A: &str = r#"{"type":"decision","text":"Ship the beta on Friday","evidence":[{"segment":"S1","quote":"ship the beta on Friday"}]}"#;
    const ITEM_B: &str = r#"{"type":"commitment","text":"Maria owns the release notes","evidence":[{"segment":"S2","quote":"Maria will own the release notes"}]}"#;

    async fn meeting() -> (SqlitePool, Vec<TranscriptEvidence>) {
        let pool = migrated_pool().await;
        insert_meeting(&pool, MEETING_ID, "complete", "complete").await;
        for (sequence, text) in TEXTS.iter().enumerate() {
            let evidence_id = format!("018f5e27-2f68-7e27-9c90-7c72123149{sequence:02x}");
            insert_evidence(&pool, MEETING_ID, &evidence_id, sequence as i64, text).await;
        }
        let evidence = TranscriptsRepository::list_evidence_by_meeting(&pool, MEETING_ID)
            .await
            .expect("evidence rows");
        KnowledgeRepository::insert_running_run(
            &pool,
            &NewRun {
                run_id: RUN_ID.to_string(),
                meeting_id: MEETING_ID.to_string(),
                trigger_kind: TriggerKind::User,
                provider_id: "ollama".to_string(),
                model_id: "llama3".to_string(),
                location_class: "local".to_string(),
                sanitized_origin: "This device".to_string(),
                prompt_version: crate::knowledge::prompt::PROMPT_VERSION.to_string(),
                meeting_completeness_at_start: "complete".to_string(),
                input_evidence_count: evidence.len() as i64,
                input_fingerprint: input_fingerprint(&evidence),
            },
        )
        .await
        .expect("running run");
        (pool, evidence)
    }

    fn items(entries: &[&str]) -> String {
        format!("{{\"items\":[{}]}}", entries.join(","))
    }

    #[tokio::test]
    async fn missed_pass_lists_first_pass_items_and_adds_only_new_ones() {
        let (pool, evidence) = meeting().await;
        let calls: Arc<Mutex<Vec<(String, String)>>> = Arc::default();
        let recorded = Arc::clone(&calls);

        let outcome = run_extraction(&pool, MEETING_ID, RUN_ID, &evidence, LARGE_BUDGET, &CancellationToken::new(), move |system: String, user: String| {
            let reply = if system == EXTRACTION_SYSTEM_PROMPT { items(&[ITEM_A]) } else { items(&[ITEM_A, ITEM_B]) };
            recorded.lock().expect("calls").push((system, user));
            async move { Ok(reply) }
        })
        .await
        .expect("run outcome");

        let calls = calls.lock().expect("calls").clone();
        assert_eq!(calls.len(), 2);
        assert_eq!(calls[1].0, MISSED_ITEMS_SYSTEM_PROMPT);
        assert!(calls[1].1.contains("Ship the beta on Friday"));
        assert_eq!((outcome.status, outcome.counts.proposed, outcome.counts.duplicate), (RunStatus::Succeeded, 2, 1));
        let texts: Vec<String> = sqlx::query_scalar("SELECT text FROM knowledge_items ORDER BY text")
            .fetch_all(&pool)
            .await
            .expect("items");
        assert_eq!(texts, vec!["Maria owns the release notes", "Ship the beta on Friday"]);
        let reasons: Vec<String> = sqlx::query_scalar("SELECT reason FROM knowledge_suppressions")
            .fetch_all(&pool)
            .await
            .expect("suppressions");
        assert_eq!(reasons, vec!["duplicate_in_run"]);
    }

    #[tokio::test]
    async fn missed_pass_malformed_reply_keeps_first_pass_items_and_status() {
        let (pool, evidence) = meeting().await;
        let reply = |system: String, _: String| {
            let reply = if system == EXTRACTION_SYSTEM_PROMPT { items(&[ITEM_A]) } else { "not json at all".to_string() };
            async move { Ok(reply) }
        };

        let outcome = run_extraction(&pool, MEETING_ID, RUN_ID, &evidence, LARGE_BUDGET, &CancellationToken::new(), reply)
            .await
            .expect("run outcome");
        let mut pure = reply;
        let extracted = extract_from_segments(&label_segments(&evidence), LARGE_BUDGET, Vec::new(), &CancellationToken::new(), &mut pure)
            .await
            .expect("pure extraction");

        assert_eq!((outcome.status, outcome.failure_code, outcome.counts.proposed), (RunStatus::Succeeded, None, 1));
        assert_eq!((extracted.malformed_windows, extracted.stages.missed_malformed), (0, 1));
        assert_eq!(extracted.items.len(), 1);
    }

    #[tokio::test]
    async fn window_candidates_checks_cancellation_before_every_completion() {
        let (_, evidence) = meeting().await;
        let windows = chunk_windows(&label_segments(&evidence), LARGE_BUDGET);
        let cancel = CancellationToken::new();
        let calls = Arc::new(Mutex::new(0));
        let (counted, cancelling) = (Arc::clone(&calls), cancel.clone());

        let result = window_candidates(&windows[0], &cancel, &mut move |_: String, _: String| {
            *counted.lock().expect("calls") += 1;
            cancelling.cancel();
            async move { Ok(items(&[ITEM_A])) }
        })
        .await;

        assert_eq!(result.err(), Some(WindowStop::Cancelled));
        assert_eq!(*calls.lock().expect("calls"), 1);
    }

    #[tokio::test]
    async fn stage_counts_record_every_completion_call() {
        let (_, evidence) = meeting().await;
        let calls = Arc::new(Mutex::new(0));
        let counted = Arc::clone(&calls);
        let mut complete = move |system: String, _: String| {
            *counted.lock().expect("calls") += 1;
            let reply = if system == EXTRACTION_SYSTEM_PROMPT { items(&[ITEM_A]) } else { items(&[ITEM_B]) };
            async move { Ok(reply) }
        };

        let outcome = extract_from_segments(&label_segments(&evidence), 10, Vec::new(), &CancellationToken::new(), &mut complete)
            .await
            .expect("extraction");

        assert_eq!(outcome.window_count, 2);
        assert_eq!(outcome.stages.completions, *calls.lock().expect("calls"));
        assert_eq!(outcome.stages.completions, 4);
        assert_eq!(outcome.stages.missed_added, 1);
    }
}
