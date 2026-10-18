use crate::knowledge::extraction::WindowStop;
use crate::knowledge::followup::{apply_followup, followup_prompt, parse_followup, FOLLOWUP_SYSTEM_PROMPT};
use crate::knowledge::matcher::normalized_key;
use crate::knowledge::models::AbstentionReason;
use crate::knowledge::parse::{parse_extraction, ParsedAttribute, ParsedExtraction, ParsedItem};
use crate::knowledge::prompt::{ChunkWindow, EXTRACTION_SYSTEM_PROMPT};
use crate::knowledge::repository::{NewAbstention, NewItem};
use crate::knowledge::span_verifier::{verify_attribute, verify_claim_quote, AttributeSupport, LabeledSegments, VerifiedSpan};
use crate::knowledge::support::{apply_support, parse_support, support_prompt, SUPPORT_SYSTEM_PROMPT};
use serde::Serialize;
use std::future::Future;
use std::ops::Add;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StageCounts {
    pub completions: usize,
    pub support_checks: usize,
    pub support_trimmed: usize,
    pub support_dropped: usize,
    pub support_unparsed: usize,
    pub followup_checks: usize,
    pub followup_dropped: usize,
    pub followup_unparsed: usize,
}

impl Add for StageCounts {
    type Output = Self;

    fn add(self, other: Self) -> Self {
        Self {
            completions: self.completions + other.completions,
            support_checks: self.support_checks + other.support_checks,
            support_trimmed: self.support_trimmed + other.support_trimmed,
            support_dropped: self.support_dropped + other.support_dropped,
            support_unparsed: self.support_unparsed + other.support_unparsed,
            followup_checks: self.followup_checks + other.followup_checks,
            followup_dropped: self.followup_dropped + other.followup_dropped,
            followup_unparsed: self.followup_unparsed + other.followup_unparsed,
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
    meeting: &LabeledSegments,
    cancel: &CancellationToken,
    complete: &mut F,
) -> Result<WindowCandidates, WindowStop>
where
    F: FnMut(String, String) -> Fut,
    Fut: Future<Output = Result<String, String>>,
{
    let reply = ask(EXTRACTION_SYSTEM_PROMPT, window.user_prompt.clone(), cancel, complete).await?;
    let parsed = parse_extraction(&reply).ok();
    let malformed = parsed.is_none();
    let (items, abstentions) = parsed.map(|parsed| verified(parsed, &window.segments)).unwrap_or_default();
    let (items, support) = support_checked(items, cancel, complete).await?;
    let (items, followup) = followup_checked(items, meeting, window_start(window, meeting), cancel, complete).await?;
    Ok(WindowCandidates {
        items,
        abstentions,
        malformed,
        stages: StageCounts { completions: 1, ..StageCounts::default() } + support + followup,
    })
}

async fn support_checked<F, Fut>(
    items: Vec<NewItem>,
    cancel: &CancellationToken,
    complete: &mut F,
) -> Result<(Vec<NewItem>, StageCounts), WindowStop>
where
    F: FnMut(String, String) -> Fut,
    Fut: Future<Output = Result<String, String>>,
{
    if items.is_empty() {
        return Ok((items, StageCounts::default()));
    }
    let reply = ask(SUPPORT_SYSTEM_PROMPT, support_prompt(&items), cancel, complete).await?;
    let (items, counts) = apply_support(items, parse_support(&reply));
    Ok((
        items,
        StageCounts {
            completions: 1,
            support_checks: 1,
            support_trimmed: counts.trimmed,
            support_dropped: counts.dropped,
            support_unparsed: counts.unparsed,
            ..StageCounts::default()
        },
    ))
}

async fn followup_checked<F, Fut>(
    items: Vec<NewItem>,
    meeting: &LabeledSegments,
    from: usize,
    cancel: &CancellationToken,
    complete: &mut F,
) -> Result<(Vec<NewItem>, StageCounts), WindowStop>
where
    F: FnMut(String, String) -> Fut,
    Fut: Future<Output = Result<String, String>>,
{
    if items.is_empty() {
        return Ok((items, StageCounts::default()));
    }
    let reply = ask(FOLLOWUP_SYSTEM_PROMPT, followup_prompt(meeting, from, &items), cancel, complete).await?;
    let (items, counts) = apply_followup(items, parse_followup(&reply));
    Ok((
        items,
        StageCounts {
            completions: 1,
            followup_checks: 1,
            followup_dropped: counts.dropped,
            followup_unparsed: counts.unparsed,
            ..StageCounts::default()
        },
    ))
}

fn window_start(window: &ChunkWindow, meeting: &LabeledSegments) -> usize {
    window
        .segments
        .as_slice()
        .first()
        .and_then(|first| meeting.as_slice().iter().position(|segment| segment.label == first.label))
        .unwrap_or_default()
}

async fn ask<F, Fut>(
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
    use crate::knowledge::extraction::extract_from_segments;
    use crate::knowledge::prompt::{chunk_windows, label_segments};
    use crate::knowledge::test_support::{insert_evidence, insert_meeting, migrated_pool, MEETING_ID};
    use crate::database::repositories::transcript::TranscriptsRepository;
    use crate::knowledge::test_support::staged_replies;
    use std::future::{ready, Ready};
    use std::sync::{Arc, Mutex};

    const TEXTS: [&str; 2] = [
        "We agreed to ship the beta on Friday.",
        "Maria will own the release notes by Monday.",
    ];
    const ONE_SEGMENT_BUDGET: usize = 10;
    const ONE_WINDOW_BUDGET: usize = 1000;
    const ITEM_A: &str = r#"{"items":[{"type":"decision","text":"Ship the beta on Friday","evidence":[{"segment":"S1","quote":"ship the beta on Friday"}]}]}"#;
    const TWO_ITEMS: &str = r#"{"items":[{"type":"decision","text":"Ship the beta on Friday","evidence":[{"segment":"S1","quote":"ship the beta on Friday"}]},{"type":"commitment","text":"Maria owns the release notes","evidence":[{"segment":"S2","quote":"Maria will own the release notes"}]}]}"#;
    const NO_ITEMS: &str = r#"{"items": []}"#;

    type Calls = Arc<Mutex<Vec<(String, String)>>>;

    fn recording<F>(mut inner: F, calls: Calls) -> impl FnMut(String, String) -> Ready<Result<String, String>>
    where
        F: FnMut(String, String) -> Ready<Result<String, String>>,
    {
        move |system_prompt: String, user_prompt: String| {
            calls.lock().expect("calls").push((system_prompt.clone(), user_prompt.clone()));
            inner(system_prompt, user_prompt)
        }
    }

    fn prompts_for(calls: &Calls, system_prompt: &str) -> Vec<String> {
        calls
            .lock()
            .expect("calls")
            .iter()
            .filter(|(system, _)| system == system_prompt)
            .map(|(_, user)| user.clone())
            .collect()
    }

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
        let direct = window_candidates(window, &segments, &cancel, &mut complete).await;

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
        assert_eq!(outcome.stages.completions, 4);
        assert_eq!(outcome.stages.support_checks, 1);
        assert_eq!(outcome.stages.followup_checks, 1);
    }

    #[tokio::test]
    async fn support_check_runs_once_per_window_with_candidates_and_never_for_an_empty_window() {
        let segments = label_segments(&evidence().await);
        let calls: Calls = Arc::default();
        let mut complete = recording(
            staged_replies(vec![(EXTRACTION_SYSTEM_PROMPT, vec![ITEM_A, NO_ITEMS])]),
            Arc::clone(&calls),
        );

        let outcome = extract_from_segments(&segments, ONE_SEGMENT_BUDGET, Vec::new(), &CancellationToken::new(), &mut complete)
            .await
            .expect("extraction");

        let support_prompts = prompts_for(&calls, SUPPORT_SYSTEM_PROMPT);
        assert_eq!(outcome.window_count, 2);
        assert_eq!(support_prompts.len(), 1);
        assert!(support_prompts[0].contains("C1 decision: Ship the beta on Friday"));
        assert!(support_prompts[0].contains("quote: \"ship the beta on Friday\""));
        assert_eq!(outcome.stages.support_checks, 1);
        assert_eq!(outcome.stages.support_unparsed, 1);
        assert_eq!(outcome.items.len(), 1);
    }

    #[tokio::test]
    async fn support_verdicts_narrow_or_drop_candidates_and_keep_their_evidence() {
        let segments = label_segments(&evidence().await);
        let unchecked = extract_from_segments(
            &segments,
            ONE_WINDOW_BUDGET,
            Vec::new(),
            &CancellationToken::new(),
            &mut staged_replies(vec![(EXTRACTION_SYSTEM_PROMPT, vec![TWO_ITEMS])]),
        )
        .await
        .expect("unchecked extraction");
        let verdicts = r#"{"verdicts":[{"id":"C1","verdict":"drop"},{"id":"C2","verdict":"trim","text":"Maria owns the notes"}]}"#;

        let checked = extract_from_segments(
            &segments,
            ONE_WINDOW_BUDGET,
            Vec::new(),
            &CancellationToken::new(),
            &mut staged_replies(vec![(EXTRACTION_SYSTEM_PROMPT, vec![TWO_ITEMS]), (SUPPORT_SYSTEM_PROMPT, vec![verdicts])]),
        )
        .await
        .expect("checked extraction");

        assert_eq!(unchecked.items.len(), 2);
        assert_eq!(checked.items.len(), 1);
        assert_eq!(checked.items[0].text, "Maria owns the notes");
        assert_eq!(checked.items[0].claims, unchecked.items[1].claims);
        assert_eq!(checked.items[0].owner, unchecked.items[1].owner);
        assert_eq!(checked.items[0].due, unchecked.items[1].due);
        assert_eq!(checked.abstentions, unchecked.abstentions);
        assert_eq!(
            (checked.stages.support_checks, checked.stages.support_trimmed, checked.stages.support_dropped, checked.stages.support_unparsed),
            (1, 1, 1, 0)
        );
    }

    #[tokio::test]
    async fn support_check_provider_error_stops_the_run() {
        let segments = label_segments(&evidence().await);
        let mut complete = |system_prompt: String, _: String| {
            ready(if system_prompt == EXTRACTION_SYSTEM_PROMPT {
                Ok(ITEM_A.to_string())
            } else {
                Err("provider down".to_string())
            })
        };

        let result = extract_from_segments(&segments, ONE_WINDOW_BUDGET, Vec::new(), &CancellationToken::new(), &mut complete).await;

        assert_eq!(result.err(), Some(WindowStop::ProviderError));
    }

    #[tokio::test]
    async fn support_check_is_skipped_when_cancelled_during_extraction() {
        let segments = label_segments(&evidence().await);
        let cancel = CancellationToken::new();
        let calls: Calls = Arc::default();
        let cancelling = cancel.clone();
        let mut complete = recording(
            move |_: String, _: String| {
                cancelling.cancel();
                ready(Ok(ITEM_A.to_string()))
            },
            Arc::clone(&calls),
        );

        let result = extract_from_segments(&segments, ONE_WINDOW_BUDGET, Vec::new(), &cancel, &mut complete).await;

        assert_eq!(result.err(), Some(WindowStop::Cancelled));
        assert_eq!(prompts_for(&calls, EXTRACTION_SYSTEM_PROMPT).len(), 1);
        assert_eq!(calls.lock().expect("calls").len(), 1);
    }

    #[tokio::test]
    async fn followup_check_runs_after_the_support_check_on_survivors_only() {
        let segments = label_segments(&evidence().await);
        let calls: Calls = Arc::default();
        let drop_first = r#"{"verdicts":[{"id":"C1","verdict":"drop"},{"id":"C2","verdict":"keep"}]}"#;
        let drop_all = r#"{"verdicts":[{"id":"C1","verdict":"drop"},{"id":"C2","verdict":"drop"}]}"#;
        let superseded = r#"{"verdicts":[{"id":"C1","verdict":"superseded"}]}"#;
        let mut complete = recording(
            staged_replies(vec![
                (EXTRACTION_SYSTEM_PROMPT, vec![TWO_ITEMS, TWO_ITEMS]),
                (SUPPORT_SYSTEM_PROMPT, vec![drop_first, drop_all]),
                (FOLLOWUP_SYSTEM_PROMPT, vec![superseded]),
            ]),
            Arc::clone(&calls),
        );

        let first = extract_from_segments(&segments, ONE_WINDOW_BUDGET, Vec::new(), &CancellationToken::new(), &mut complete)
            .await
            .expect("first extraction");
        let second = extract_from_segments(&segments, ONE_WINDOW_BUDGET, Vec::new(), &CancellationToken::new(), &mut complete)
            .await
            .expect("second extraction");

        let followup_prompts = prompts_for(&calls, FOLLOWUP_SYSTEM_PROMPT);
        assert_eq!(followup_prompts.len(), 1);
        assert!(followup_prompts[0].contains("C1 commitment at S2: Maria owns the release notes"));
        assert!(!followup_prompts[0].contains("C2 "));
        assert!(followup_prompts[0].contains("[S1 00:00] We agreed to ship the beta on Friday."));
        assert!(first.items.is_empty());
        assert_eq!((first.stages.followup_checks, first.stages.followup_dropped, first.stages.followup_unparsed), (1, 1, 0));
        assert_eq!(first.stages.completions, 3);
        assert!(second.items.is_empty());
        assert_eq!(second.stages.followup_checks, 0);
        assert_eq!(second.stages.completions, 2);
    }

    #[tokio::test]
    async fn followup_context_starts_at_the_window_first_segment() {
        let segments = label_segments(&evidence().await);
        let calls: Calls = Arc::default();
        let second_window_item = r#"{"items":[{"type":"commitment","text":"Maria owns the release notes","evidence":[{"segment":"S2","quote":"Maria will own the release notes"}]}]}"#;
        let mut complete = recording(
            staged_replies(vec![(EXTRACTION_SYSTEM_PROMPT, vec![NO_ITEMS, second_window_item])]),
            Arc::clone(&calls),
        );

        let outcome = extract_from_segments(&segments, ONE_SEGMENT_BUDGET, Vec::new(), &CancellationToken::new(), &mut complete)
            .await
            .expect("extraction");

        let followup_prompts = prompts_for(&calls, FOLLOWUP_SYSTEM_PROMPT);
        assert_eq!(outcome.items.len(), 1);
        assert_eq!(followup_prompts.len(), 1);
        assert!(!followup_prompts[0].contains("[S1 "));
        assert!(followup_prompts[0].contains("[S2 00:05] Maria will own the release notes by Monday."));
        assert_eq!(outcome.stages.followup_unparsed, 1);
    }
}
