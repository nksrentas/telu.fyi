use crate::database::models::{
    CaptureCompleteness, MeetingCompleteness, MeetingLifecycle, TranscriptEvidence,
};
use crate::knowledge::models::{
    AbstentionReason, KnowledgeError, KnowledgeType, RunStatus, TriggerKind,
};
use crate::knowledge::repository::{KnowledgeRepository, NewAbstention, NewItem, RunCounts};
use crate::knowledge::span_verifier::{
    normalize_with_map, sha256_hex, verify_claim_quote, LabeledSegment, LabeledSegments,
};
use serde::Deserialize;
use serde_json::Value;
use sqlx::SqlitePool;
use std::collections::HashSet;
use std::future::Future;
use tracing::{info, warn};
use uuid::Uuid;

pub const PROMPT_VERSION: &str = "knowledge-extract-v1";
const MAX_ITEMS: usize = 40;
const MAX_TEXT_CHARS: usize = 400;

pub const EXTRACTION_SYSTEM_PROMPT: &str = r#"You extract meeting knowledge from a transcript. Output JSON only, no prose.
Types: "decision" (something agreed), "commitment" (someone will do something), "question" (asked and not answered in the transcript), "fact" (a stated fact relevant later).
Rules:
- Every item needs at least one evidence entry: {"segment": "<label>", "quote": "<exact words copied from that segment>"}.
- Copy quotes character for character from the labeled segment. Never paraphrase inside "quote".
- Never guess who "I" or "we" is.
- If nothing qualifies, return {"items": []}.
Schema: {"items":[{"type":"...","text":"...","evidence":[{"segment":"S3","quote":"..."}]}]}"#;

pub struct ExtractionInput {
    pub user_prompt: String,
    pub segments: LabeledSegments,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RunOutcome {
    pub status: RunStatus,
    pub counts: RunCounts,
    pub failure_code: Option<&'static str>,
}

#[derive(Default)]
struct VerifiedCandidates {
    items: Vec<NewItem>,
    abstentions: Vec<NewAbstention>,
}

#[derive(Deserialize)]
struct RawItem {
    #[serde(rename = "type")]
    item_type: String,
    text: String,
    #[serde(default)]
    evidence: Vec<RawEvidence>,
}

#[derive(Deserialize)]
struct RawEvidence {
    segment: String,
    quote: String,
}

pub fn check_extraction_gate(
    lifecycle: MeetingLifecycle,
    completeness: MeetingCompleteness,
    evidence_count: usize,
    trigger: TriggerKind,
) -> Result<(), KnowledgeError> {
    let still_capturing = matches!(
        lifecycle,
        MeetingLifecycle::Preparing | MeetingLifecycle::Recording | MeetingLifecycle::Finalizing
    );
    let unverified = matches!(
        completeness,
        MeetingCompleteness::Pending | MeetingCompleteness::CompletionNotVerified
    );
    if still_capturing || unverified {
        return Err(KnowledgeError::MeetingNotReady);
    }
    if evidence_count == 0 {
        return Err(KnowledgeError::NoEvidence);
    }
    let degraded = matches!(
        completeness,
        MeetingCompleteness::Incomplete | MeetingCompleteness::RecoveredWithGaps
    );
    if degraded && trigger == TriggerKind::Auto {
        return Err(KnowledgeError::MeetingNotReady);
    }
    Ok(())
}

pub fn build_extraction_input(evidence: &[TranscriptEvidence]) -> ExtractionInput {
    let user_prompt = evidence
        .iter()
        .enumerate()
        .map(|(index, row)| {
            format!(
                "[S{} {}] {}",
                index + 1,
                format_timestamp(row.audio_start_time),
                row.transcript
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    let segments = evidence
        .iter()
        .enumerate()
        .map(|(index, row)| {
            (
                format!("S{}", index + 1),
                LabeledSegment {
                    evidence_id: row.evidence_id.clone(),
                    text: row.transcript.clone(),
                    capture_incomplete: row.capture_completeness == CaptureCompleteness::Incomplete,
                },
            )
        })
        .collect();
    ExtractionInput {
        user_prompt,
        segments,
    }
}

pub fn input_fingerprint(evidence: &[TranscriptEvidence]) -> String {
    let ordered: String = evidence
        .iter()
        .map(|row| format!("{}:{}\n", row.evidence_id, sha256_hex(&row.transcript)))
        .collect();
    sha256_hex(&ordered)
}

pub async fn run_extraction<F, Fut>(
    pool: &SqlitePool,
    meeting_id: &str,
    run_id: &str,
    evidence: &[TranscriptEvidence],
    complete: F,
) -> Result<RunOutcome, KnowledgeError>
where
    F: FnOnce(String, String) -> Fut,
    Fut: Future<Output = Result<String, String>>,
{
    let input = build_extraction_input(evidence);
    let completion = complete(EXTRACTION_SYSTEM_PROMPT.to_string(), input.user_prompt).await;
    let (candidates, failure_code) = match completion.map(|text| parse_completion(&text)) {
        Err(_) => (VerifiedCandidates::default(), Some("PROVIDER_ERROR")),
        Ok(None) => (VerifiedCandidates::default(), Some("MALFORMED_OUTPUT")),
        Ok(Some(values)) => (verify_candidates(values, &input.segments), None),
    };
    let outcome = RunOutcome {
        status: if failure_code.is_some() {
            RunStatus::Failed
        } else {
            RunStatus::Succeeded
        },
        counts: RunCounts {
            proposed: candidates.items.len() as i64,
            skipped: candidates.abstentions.len() as i64,
        },
        failure_code,
    };

    match persist_outcome(pool, meeting_id, run_id, &candidates, outcome).await {
        Ok(()) => {
            info!(
                meeting_id,
                run_id,
                status = outcome.status.as_str(),
                proposed = outcome.counts.proposed,
                skipped = outcome.counts.skipped,
                "knowledge run finalized"
            );
            Ok(outcome)
        }
        Err(error) => {
            mark_run_failed(pool, run_id).await;
            Err(error)
        }
    }
}

fn format_timestamp(seconds: f64) -> String {
    let total = seconds.max(0.0).floor() as u64;
    format!("{:02}:{:02}", total / 60, total % 60)
}

fn parse_completion(completion: &str) -> Option<Vec<Value>> {
    let start = completion.find('{')?;
    let end = completion.rfind('}')?;
    if end <= start {
        return None;
    }
    let root: Value = serde_json::from_str(&completion[start..=end]).ok()?;
    root.get("items")?.as_array().cloned()
}

fn verify_candidates(values: Vec<Value>, segments: &LabeledSegments) -> VerifiedCandidates {
    let mut verified = VerifiedCandidates::default();
    let mut seen_keys = HashSet::new();
    for (index, value) in values.into_iter().enumerate() {
        match verify_candidate(index, value, segments) {
            Ok(item) => {
                if seen_keys.insert((item.item_type, item.normalized_key.clone())) {
                    verified.items.push(item);
                }
            }
            Err(abstention) => verified.abstentions.push(abstention),
        }
    }
    verified
}

fn verify_candidate(
    index: usize,
    value: Value,
    segments: &LabeledSegments,
) -> Result<NewItem, NewAbstention> {
    let malformed = NewAbstention {
        reason: AbstentionReason::MalformedItem,
        candidate_type: None,
    };
    if index >= MAX_ITEMS {
        return Err(malformed);
    }
    let raw: RawItem = serde_json::from_value(value).map_err(|_| malformed)?;
    let item_type = KnowledgeType::parse(&raw.item_type).ok_or(NewAbstention {
        reason: AbstentionReason::InvalidType,
        candidate_type: None,
    })?;
    let abstain = |reason| NewAbstention {
        reason,
        candidate_type: Some(item_type),
    };
    let text = raw.text.trim();
    if text.is_empty() {
        return Err(abstain(AbstentionReason::EmptyText));
    }
    if text.chars().count() > MAX_TEXT_CHARS {
        return Err(abstain(AbstentionReason::MalformedItem));
    }
    let claim = raw
        .evidence
        .first()
        .ok_or(abstain(AbstentionReason::MalformedItem))?;
    let span = verify_claim_quote(&claim.segment, &claim.quote, segments).map_err(abstain)?;

    Ok(NewItem {
        item_id: Uuid::new_v4().to_string(),
        item_type,
        text: text.to_string(),
        normalized_key: normalize_with_map(text).0,
        claim: span,
    })
}

async fn persist_outcome(
    pool: &SqlitePool,
    meeting_id: &str,
    run_id: &str,
    candidates: &VerifiedCandidates,
    outcome: RunOutcome,
) -> Result<(), KnowledgeError> {
    let mut transaction = pool.begin().await.map_err(|error| {
        warn!(meeting_id, run_id, error = %error, "knowledge run transaction failed to start");
        KnowledgeError::Storage
    })?;
    KnowledgeRepository::insert_items_with_links(&mut transaction, meeting_id, run_id, &candidates.items)
        .await?;
    KnowledgeRepository::insert_abstentions(&mut transaction, meeting_id, run_id, &candidates.abstentions)
        .await?;
    KnowledgeRepository::finalize_run(
        &mut transaction,
        run_id,
        outcome.status,
        outcome.counts,
        outcome.failure_code,
    )
    .await?;
    transaction.commit().await.map_err(|error| {
        warn!(meeting_id, run_id, error = %error, "knowledge run transaction failed to commit");
        KnowledgeError::Storage
    })
}

async fn mark_run_failed(pool: &SqlitePool, run_id: &str) {
    let Ok(mut connection) = pool.acquire().await else {
        warn!(run_id, "knowledge run could not be marked failed");
        return;
    };
    if KnowledgeRepository::finalize_run(
        &mut connection,
        run_id,
        RunStatus::Failed,
        RunCounts::default(),
        Some("KNOWLEDGE_STORAGE_FAILED"),
    )
    .await
    .is_err()
    {
        warn!(run_id, "knowledge run could not be marked failed");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::knowledge::models::EvidenceRole;
    use crate::knowledge::repository::NewRun;
    use crate::knowledge::test_support::{insert_evidence, insert_meeting, migrated_pool, MEETING_ID};
    use crate::database::repositories::transcript::TranscriptsRepository;

    const RUN_ID: &str = "018f5e27-2f68-7e27-9c90-7c72123141c1";
    const S2_EVIDENCE: &str = "018f5e27-2f68-7e27-9c90-7c72123141b2";

    async fn meeting_with_evidence() -> (SqlitePool, Vec<TranscriptEvidence>) {
        let pool = migrated_pool().await;
        insert_meeting(&pool, MEETING_ID, "complete", "complete").await;
        insert_evidence(&pool, MEETING_ID, "018f5e27-2f68-7e27-9c90-7c72123141b1", 0, "Good morning everyone.").await;
        insert_evidence(&pool, MEETING_ID, S2_EVIDENCE, 1, "We agreed to ship the beta on Friday.").await;
        insert_evidence(&pool, MEETING_ID, "018f5e27-2f68-7e27-9c90-7c72123141b3", 2, "Any other questions?").await;
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
                prompt_version: PROMPT_VERSION.to_string(),
                meeting_completeness_at_start: "complete".to_string(),
                input_evidence_count: evidence.len() as i64,
                input_fingerprint: input_fingerprint(&evidence),
            },
        )
        .await
        .expect("running run");
        (pool, evidence)
    }

    async fn count(pool: &SqlitePool, table: &str) -> i64 {
        sqlx::query_scalar::<_, i64>(&format!("SELECT COUNT(*) FROM {table}"))
            .fetch_one(pool)
            .await
            .expect("row count")
    }

    #[tokio::test]
    async fn knowledge_extraction_persists_a_verified_decision_with_its_exact_evidence_link() {
        let (pool, evidence) = meeting_with_evidence().await;
        let completion = r#"```json
{"items":[{"type":"decision","text":"Ship the beta on Friday","evidence":[{"segment":"S2","quote":"ship the beta on Friday"}]}]}
```"#;

        let outcome = run_extraction(&pool, MEETING_ID, RUN_ID, &evidence, |_, prompt| async move {
            assert!(prompt.contains("[S2 00:05] We agreed to ship the beta on Friday."));
            Ok(completion.to_string())
        })
        .await
        .expect("extraction outcome");

        assert_eq!(outcome.status, RunStatus::Succeeded);
        assert_eq!(outcome.counts, RunCounts { proposed: 1, skipped: 0 });
        let items = KnowledgeRepository::list_meeting_items(&pool, MEETING_ID)
            .await
            .expect("items");
        assert_eq!(items.len(), 1);
        let link = &items[0].evidence[0];
        assert_eq!(link.evidence_id, S2_EVIDENCE);
        assert_eq!(link.role, EvidenceRole::Claim);
        let raw: String = evidence[1]
            .transcript
            .chars()
            .skip(link.raw_start as usize)
            .take((link.raw_end - link.raw_start) as usize)
            .collect();
        assert_eq!(raw, "ship the beta on Friday");
        assert_eq!(link.quote_text, raw);
        let run = KnowledgeRepository::latest_run(&pool, MEETING_ID)
            .await
            .expect("latest run")
            .expect("run exists");
        assert_eq!((run.status, run.proposed_count), (RunStatus::Succeeded, 1));
    }

    #[tokio::test]
    async fn knowledge_extraction_abstains_on_missing_quotes_and_unknown_segments() {
        let (pool, evidence) = meeting_with_evidence().await;
        let completion = r#"{"items":[
            {"type":"fact","text":"Budget doubled","evidence":[{"segment":"S2","quote":"the budget doubled"}]},
            {"type":"question","text":"Who owns QA","evidence":[{"segment":"S9","quote":"who owns QA"}]}
        ]}"#;

        let outcome = run_extraction(&pool, MEETING_ID, RUN_ID, &evidence, |_, _| async move {
            Ok(completion.to_string())
        })
        .await
        .expect("extraction outcome");

        assert_eq!(outcome.counts, RunCounts { proposed: 0, skipped: 2 });
        assert_eq!(count(&pool, "knowledge_items").await, 0);
        let reasons: Vec<String> = sqlx::query_scalar(
            "SELECT reason_code FROM knowledge_abstentions ORDER BY reason_code",
        )
        .fetch_all(&pool)
        .await
        .expect("abstention reasons");
        assert_eq!(reasons, vec!["quote_not_found", "unknown_segment"]);
        let run = KnowledgeRepository::latest_run(&pool, MEETING_ID)
            .await
            .expect("latest run")
            .expect("run exists");
        assert_eq!(run.skipped_count, 2);
    }

    #[tokio::test]
    async fn knowledge_extraction_records_provider_and_malformed_output_failures() {
        let (pool, evidence) = meeting_with_evidence().await;

        let outcome = run_extraction(&pool, MEETING_ID, RUN_ID, &evidence, |_, _| async move {
            Ok("I could not find anything useful.".to_string())
        })
        .await
        .expect("extraction outcome");

        assert_eq!(outcome.status, RunStatus::Failed);
        assert_eq!(outcome.failure_code, Some("MALFORMED_OUTPUT"));
        assert_eq!(count(&pool, "knowledge_items").await, 0);
    }

    #[test]
    fn knowledge_gate_follows_meeting_readiness_and_trigger_rules() {
        use MeetingCompleteness as C;
        use MeetingLifecycle as L;

        assert_eq!(check_extraction_gate(L::Complete, C::Complete, 3, TriggerKind::Auto), Ok(()));
        assert_eq!(check_extraction_gate(L::Complete, C::Complete, 0, TriggerKind::User), Err(KnowledgeError::NoEvidence));
        assert_eq!(check_extraction_gate(L::Recording, C::Pending, 3, TriggerKind::User), Err(KnowledgeError::MeetingNotReady));
        assert_eq!(check_extraction_gate(L::Legacy, C::CompletionNotVerified, 3, TriggerKind::User), Err(KnowledgeError::MeetingNotReady));
        assert_eq!(check_extraction_gate(L::Incomplete, C::Incomplete, 3, TriggerKind::Auto), Err(KnowledgeError::MeetingNotReady));
        assert_eq!(check_extraction_gate(L::Incomplete, C::Incomplete, 3, TriggerKind::User), Ok(()));
        assert_eq!(check_extraction_gate(L::Recovered, C::RecoveredWithGaps, 3, TriggerKind::Regenerate), Ok(()));
    }
}
