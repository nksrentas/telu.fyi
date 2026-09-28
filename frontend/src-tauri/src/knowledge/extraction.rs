use crate::database::models::{MeetingCompleteness, MeetingLifecycle, TranscriptEvidence};
use crate::knowledge::matcher::{match_candidate, normalized_key, Candidate, ExistingItem, MatchOutcome};
use crate::knowledge::models::{
    AbstentionReason, KnowledgeError, ReviewState, RunStatus, SuppressionReason, TriggerKind,
};
use crate::knowledge::parse::{parse_extraction, ParsedAttribute, ParsedExtraction, ParsedItem};
use crate::knowledge::prompt::{chunk_windows, label_segments, EXTRACTION_SYSTEM_PROMPT};
use crate::knowledge::repository::{
    KnowledgeRepository, NewAbstention, NewItem, NewSuppression, RunCounts,
};
use crate::knowledge::span_verifier::{
    sha256_hex, verify_attribute, verify_claim_quote, AttributeSupport, LabeledSegments,
    VerifiedSpan,
};
use sqlx::SqlitePool;
use std::collections::{HashMap, HashSet};
use std::future::Future;
use std::sync::{LazyLock, Mutex, MutexGuard};
use tokio_util::sync::CancellationToken;
use tracing::{info, warn};
use uuid::Uuid;

struct RegisteredExtraction {
    run_id: String,
    token: CancellationToken,
}

static EXTRACTION_REGISTRY: LazyLock<Mutex<HashMap<String, RegisteredExtraction>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RunOutcome {
    pub status: RunStatus,
    pub counts: RunCounts,
    pub failure_code: Option<&'static str>,
}

#[derive(Debug, Default)]
pub struct ExtractionOutcome {
    pub items: Vec<NewItem>,
    pub abstentions: Vec<NewAbstention>,
    pub suppressions: Vec<NewSuppression>,
    pub malformed_windows: usize,
    pub window_count: usize,
    index: Vec<ExistingItem>,
    in_run: HashSet<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WindowStop {
    Cancelled,
    ProviderError,
}

fn registry() -> MutexGuard<'static, HashMap<String, RegisteredExtraction>> {
    EXTRACTION_REGISTRY
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn registry_key(meeting_id: &str) -> String {
    format!("knowledge:{meeting_id}")
}

pub fn register_extraction(meeting_id: &str, run_id: &str) -> CancellationToken {
    let token = CancellationToken::new();
    registry().insert(
        registry_key(meeting_id),
        RegisteredExtraction {
            run_id: run_id.to_string(),
            token: token.clone(),
        },
    );
    token
}

pub fn has_active_extraction(meeting_id: &str) -> bool {
    registry().contains_key(&registry_key(meeting_id))
}

pub fn cancel_active_extraction(meeting_id: &str) -> bool {
    match registry().remove(&registry_key(meeting_id)) {
        Some(registered) => {
            registered.token.cancel();
            true
        }
        None => false,
    }
}

pub fn release_extraction(meeting_id: &str, run_id: &str) {
    let mut entries = registry();
    let key = registry_key(meeting_id);
    if entries.get(&key).is_some_and(|registered| registered.run_id == run_id) {
        entries.remove(&key);
    }
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
    budget_tokens: usize,
    cancel: &CancellationToken,
    mut complete: F,
) -> Result<RunOutcome, KnowledgeError>
where
    F: FnMut(String, String) -> Fut,
    Fut: Future<Output = Result<String, String>>,
{
    let index = match KnowledgeRepository::load_match_index(pool, meeting_id).await {
        Ok(index) => index,
        Err(error) => {
            mark_run_failed(pool, run_id).await;
            return Err(error);
        }
    };
    let collected =
        extract_from_segments(&label_segments(evidence), budget_tokens, index, cancel, &mut complete).await;
    let (candidates, outcome) = match collected {
        Ok(candidates) => {
            let outcome = completed_outcome(&candidates);
            (candidates, outcome)
        }
        Err(stop) => (ExtractionOutcome::default(), stopped_outcome(stop)),
    };
    info!(
        meeting_id,
        run_id,
        windows = candidates.window_count,
        malformed_windows = candidates.malformed_windows,
        status = outcome.status.as_str(),
        proposed = outcome.counts.proposed,
        skipped = outcome.counts.skipped,
        "knowledge run finished"
    );
    finish(pool, meeting_id, run_id, &candidates, outcome).await
}

pub async fn extract_from_segments<F, Fut>(
    segments: &LabeledSegments,
    budget_tokens: usize,
    index: Vec<ExistingItem>,
    cancel: &CancellationToken,
    complete: &mut F,
) -> Result<ExtractionOutcome, WindowStop>
where
    F: FnMut(String, String) -> Fut,
    Fut: Future<Output = Result<String, String>>,
{
    let windows = chunk_windows(segments, budget_tokens);
    let mut candidates = ExtractionOutcome {
        index,
        window_count: windows.len(),
        ..ExtractionOutcome::default()
    };
    for window in &windows {
        if cancel.is_cancelled() {
            return Err(WindowStop::Cancelled);
        }
        let reply = complete(EXTRACTION_SYSTEM_PROMPT.to_string(), window.user_prompt.clone())
            .await
            .map_err(|_| stop_reason(cancel))?;
        match parse_extraction(&reply) {
            Ok(parsed) => absorb(&mut candidates, parsed, &window.segments),
            Err(_) => candidates.malformed_windows += 1,
        }
    }
    if cancel.is_cancelled() {
        return Err(WindowStop::Cancelled);
    }
    Ok(candidates)
}

fn stop_reason(cancel: &CancellationToken) -> WindowStop {
    if cancel.is_cancelled() {
        WindowStop::Cancelled
    } else {
        WindowStop::ProviderError
    }
}

fn absorb(candidates: &mut ExtractionOutcome, parsed: ParsedExtraction, segments: &LabeledSegments) {
    candidates.abstentions.extend(parsed.rejected);
    for item in parsed.items {
        match verify_item(item, segments) {
            Ok(verified) => place(candidates, verified),
            Err(abstention) => candidates.abstentions.push(abstention),
        }
    }
}

fn place(candidates: &mut ExtractionOutcome, verified: NewItem) {
    let candidate = Candidate {
        item_type: verified.item_type,
        key: verified.normalized_key.clone(),
        claim_evidence_ids: verified.claims.iter().map(|span| span.evidence_id.clone()).collect(),
    };
    let (matched_item_id, reason) = match match_candidate(&candidate, &candidates.index) {
        MatchOutcome::New => {
            candidates.in_run.insert(verified.item_id.clone());
            candidates.index.push(ExistingItem {
                item_id: verified.item_id.clone(),
                item_type: verified.item_type,
                state: ReviewState::Proposed,
                keys: vec![candidate.key],
                superseded_keys: Vec::new(),
                claim_evidence_ids: candidate.claim_evidence_ids,
            });
            candidates.items.push(verified);
            return;
        }
        MatchOutcome::Suppressed(item_id) => (item_id, SuppressionReason::MatchedRejected),
        MatchOutcome::Reconfirmed(item_id) => (item_id, SuppressionReason::ReconfirmedAccepted),
        MatchOutcome::Duplicate(item_id) if candidates.in_run.contains(&item_id) => {
            (item_id, SuppressionReason::DuplicateInRun)
        }
        MatchOutcome::Duplicate(item_id) => (item_id, SuppressionReason::DuplicatePending),
    };
    candidates.suppressions.push(NewSuppression {
        matched_item_id,
        reason,
        candidate_normalized_key: candidate.key,
        candidate_text: verified.text,
    });
}

fn verify_item(item: ParsedItem, segments: &LabeledSegments) -> Result<NewItem, NewAbstention> {
    let (claims, first_failure) = verify_claims(&item, segments);
    if claims.is_empty() {
        return Err(NewAbstention {
            reason: first_failure.unwrap_or(AbstentionReason::QuoteNotFound),
            candidate_type: Some(item.item_type),
        });
    }
    Ok(NewItem {
        item_id: Uuid::new_v4().to_string(),
        item_type: item.item_type,
        normalized_key: normalized_key(&item.text),
        owner: attribute_support(item.owner.as_ref(), segments),
        due: attribute_support(item.due.as_ref(), segments),
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

fn attribute_support(attribute: Option<&ParsedAttribute>, segments: &LabeledSegments) -> AttributeSupport {
    attribute
        .map(|attribute| verify_attribute(&attribute.value, &attribute.segment, &attribute.quote, segments))
        .unwrap_or(AttributeSupport::NotStated)
}

fn completed_outcome(candidates: &ExtractionOutcome) -> RunOutcome {
    if candidates.window_count > 0 && candidates.malformed_windows == candidates.window_count {
        return RunOutcome {
            status: RunStatus::Failed,
            counts: RunCounts::default(),
            failure_code: Some("MALFORMED_OUTPUT"),
        };
    }
    let count_reason = |reasons: &[SuppressionReason]| {
        candidates
            .suppressions
            .iter()
            .filter(|suppression| reasons.contains(&suppression.reason))
            .count() as i64
    };
    RunOutcome {
        status: RunStatus::Succeeded,
        counts: RunCounts {
            proposed: candidates.items.len() as i64,
            skipped: candidates.abstentions.len() as i64,
            suppressed: count_reason(&[SuppressionReason::MatchedRejected]),
            reconfirmed: count_reason(&[SuppressionReason::ReconfirmedAccepted]),
            duplicate: count_reason(&[SuppressionReason::DuplicatePending, SuppressionReason::DuplicateInRun]),
        },
        failure_code: (candidates.malformed_windows > 0).then_some("PARTIAL_MALFORMED_OUTPUT"),
    }
}

fn stopped_outcome(stop: WindowStop) -> RunOutcome {
    let (status, failure_code) = match stop {
        WindowStop::Cancelled => (RunStatus::Cancelled, "CANCELLED_BY_USER"),
        WindowStop::ProviderError => (RunStatus::Failed, "PROVIDER_ERROR"),
    };
    RunOutcome {
        status,
        counts: RunCounts::default(),
        failure_code: Some(failure_code),
    }
}

async fn finish(
    pool: &SqlitePool,
    meeting_id: &str,
    run_id: &str,
    candidates: &ExtractionOutcome,
    outcome: RunOutcome,
) -> Result<RunOutcome, KnowledgeError> {
    let persisted = if outcome.status == RunStatus::Succeeded {
        persist_outcome(pool, meeting_id, run_id, candidates, outcome).await
    } else {
        persist_outcome(pool, meeting_id, run_id, &ExtractionOutcome::default(), outcome).await
    };
    match persisted {
        Ok(()) => Ok(outcome),
        Err(error) => {
            if meeting_exists(pool, meeting_id).await {
                mark_run_failed(pool, run_id).await;
                return Err(error);
            }
            info!(meeting_id, run_id, code = "MEETING_DELETED", "knowledge run ended with its meeting");
            Ok(RunOutcome {
                status: RunStatus::Cancelled,
                counts: RunCounts::default(),
                failure_code: Some("MEETING_DELETED"),
            })
        }
    }
}

async fn persist_outcome(
    pool: &SqlitePool,
    meeting_id: &str,
    run_id: &str,
    candidates: &ExtractionOutcome,
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
    KnowledgeRepository::insert_suppressions(&mut transaction, meeting_id, run_id, &candidates.suppressions)
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

async fn meeting_exists(pool: &SqlitePool, meeting_id: &str) -> bool {
    sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM meetings WHERE id = ?")
        .bind(meeting_id)
        .fetch_one(pool)
        .await
        .map(|count| count > 0)
        .unwrap_or(true)
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
#[path = "extraction_regenerate_tests.rs"]
mod regenerate_tests;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database::repositories::transcript::TranscriptsRepository;
    use crate::knowledge::models::EvidenceRole;
    use crate::knowledge::prompt::PROMPT_VERSION;
    use crate::knowledge::repository::NewRun;
    use crate::knowledge::test_support::{insert_evidence, insert_meeting, migrated_pool, MEETING_ID};
    use crate::summary::service::SummaryService;
    use chrono::Utc;

    const RUN_ID: &str = "018f5e27-2f68-7e27-9c90-7c72123141c1";
    const S2_EVIDENCE: &str = "018f5e27-2f68-7e27-9c90-7c72123141b2";
    const LARGE_BUDGET: usize = 100_000;

    async fn start_run(pool: &SqlitePool, meeting_id: &str, evidence: &[TranscriptEvidence]) {
        KnowledgeRepository::insert_running_run(
            pool,
            &NewRun {
                run_id: RUN_ID.to_string(),
                meeting_id: meeting_id.to_string(),
                trigger_kind: TriggerKind::User,
                provider_id: "ollama".to_string(),
                model_id: "llama3".to_string(),
                location_class: "local".to_string(),
                sanitized_origin: "This device".to_string(),
                prompt_version: PROMPT_VERSION.to_string(),
                meeting_completeness_at_start: "complete".to_string(),
                input_evidence_count: evidence.len() as i64,
                input_fingerprint: input_fingerprint(evidence),
            },
        )
        .await
        .expect("running run");
    }

    async fn meeting_with_texts(meeting_id: &str, texts: &[&str]) -> (SqlitePool, Vec<TranscriptEvidence>) {
        let pool = migrated_pool().await;
        insert_meeting(&pool, meeting_id, "complete", "complete").await;
        for (sequence, text) in texts.iter().enumerate() {
            let evidence_id = format!("018f5e27-2f68-7e27-9c90-7c72123141{:02x}", 0xb1 + sequence);
            insert_evidence(&pool, meeting_id, &evidence_id, sequence as i64, text).await;
        }
        let evidence = TranscriptsRepository::list_evidence_by_meeting(&pool, meeting_id)
            .await
            .expect("evidence rows");
        start_run(&pool, meeting_id, &evidence).await;
        (pool, evidence)
    }

    async fn meeting_with_evidence() -> (SqlitePool, Vec<TranscriptEvidence>) {
        meeting_with_texts(
            MEETING_ID,
            &[
                "Good morning everyone.",
                "We agreed to ship the beta on Friday.",
                "Maria will own the release notes by Monday.",
            ],
        )
        .await
    }

    async fn count(pool: &SqlitePool, table: &str) -> i64 {
        sqlx::query_scalar::<_, i64>(&format!("SELECT COUNT(*) FROM {table}"))
            .fetch_one(pool)
            .await
            .expect("row count")
    }

    async fn run_with_replies(
        pool: &SqlitePool,
        evidence: &[TranscriptEvidence],
        budget: usize,
        replies: Vec<&'static str>,
    ) -> RunOutcome {
        let mut remaining = replies.into_iter();
        run_extraction(pool, MEETING_ID, RUN_ID, evidence, budget, &CancellationToken::new(), |_, _| {
            let reply = remaining.next().unwrap_or("{\"items\": []}").to_string();
            async move { Ok(reply) }
        })
        .await
        .expect("extraction outcome")
    }

    #[tokio::test]
    async fn knowledge_extraction_persists_a_verified_decision_with_its_exact_evidence_link() {
        let (pool, evidence) = meeting_with_evidence().await;
        let reply = r#"```json
{"items":[{"type":"decision","text":"Ship the beta on Friday","evidence":[{"segment":"S2","quote":"ship the beta on Friday"}],"owner":null,"due":null}]}
```"#;

        let outcome = run_with_replies(&pool, &evidence, LARGE_BUDGET, vec![reply]).await;

        assert_eq!(outcome.status, RunStatus::Succeeded);
        assert_eq!(outcome.counts, RunCounts { proposed: 1, skipped: 0, ..RunCounts::default() });
        let items = KnowledgeRepository::meeting_view(&pool, MEETING_ID)
            .await
            .expect("meeting view")
            .items;
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
    }

    #[tokio::test]
    async fn knowledge_extraction_abstains_on_missing_quotes_and_unknown_segments() {
        let (pool, evidence) = meeting_with_evidence().await;
        let reply = r#"{"items":[
            {"type":"fact","text":"Budget doubled","evidence":[{"segment":"S2","quote":"the budget doubled"}]},
            {"type":"question","text":"Who owns QA","evidence":[{"segment":"S9","quote":"who owns the QA pass"}]}
        ]}"#;

        let outcome = run_with_replies(&pool, &evidence, LARGE_BUDGET, vec![reply]).await;

        assert_eq!(outcome.counts, RunCounts { proposed: 0, skipped: 2, ..RunCounts::default() });
        assert_eq!(count(&pool, "knowledge_items").await, 0);
        assert_eq!(count(&pool, "knowledge_abstentions").await, 2);
        let reasons: Vec<String> = sqlx::query_scalar(
            "SELECT reason_code FROM knowledge_abstentions ORDER BY reason_code",
        )
        .fetch_all(&pool)
        .await
        .expect("abstention reasons");
        assert_eq!(reasons, vec!["quote_not_found", "unknown_segment"]);
    }

    #[tokio::test]
    async fn knowledge_extraction_keeps_good_windows_when_one_window_is_malformed() {
        let texts = [
            "Alpha team will ship the docs", "Bravo team will ship the docs",
            "Delta team will ship the docs", "Gamma team will ship the docs",
            "Hotel team will ship the docs", "Kappa team will ship the docs",
            "Lemur team will ship the docs", "Omega team will ship the docs",
        ];
        let (pool, evidence) = meeting_with_texts(MEETING_ID, &texts).await;
        let first = r#"{"items":[{"type":"commitment","text":"Alpha ships docs","evidence":[{"segment":"S1","quote":"Alpha team will ship the docs"}]}]}"#;
        let last = r#"{"items":[{"type":"commitment","text":"Omega ships docs","evidence":[{"segment":"S8","quote":"Omega team will ship the docs"}]}]}"#;

        let outcome = run_with_replies(&pool, &evidence, 40, vec![first, "not json at all", last]).await;

        assert_eq!(outcome.status, RunStatus::Succeeded);
        assert_eq!(outcome.failure_code, Some("PARTIAL_MALFORMED_OUTPUT"));
        assert_eq!(outcome.counts, RunCounts { proposed: 2, skipped: 0, ..RunCounts::default() });
        assert_eq!(count(&pool, "knowledge_items").await, 2);
    }

    #[tokio::test]
    async fn knowledge_extraction_fails_when_every_window_is_malformed() {
        let (pool, evidence) = meeting_with_evidence().await;

        let outcome = run_with_replies(&pool, &evidence, LARGE_BUDGET, vec!["I could not find anything useful."]).await;

        assert_eq!(outcome.status, RunStatus::Failed);
        assert_eq!(outcome.failure_code, Some("MALFORMED_OUTPUT"));
        assert_eq!(count(&pool, "knowledge_items").await, 0);
    }

    #[tokio::test]
    async fn knowledge_extraction_with_no_items_succeeds_with_zero_counts() {
        let (pool, evidence) = meeting_with_evidence().await;

        let outcome = run_with_replies(&pool, &evidence, LARGE_BUDGET, vec!["{\"items\": []}"]).await;

        assert_eq!(outcome.status, RunStatus::Succeeded);
        assert_eq!(outcome.counts, RunCounts::default());
        let run = KnowledgeRepository::latest_run(&pool, MEETING_ID)
            .await
            .expect("latest run")
            .expect("run exists");
        assert_eq!((run.proposed_count, run.skipped_count), (0, 0));
        assert_eq!(count(&pool, "knowledge_abstentions").await, run.skipped_count);
    }

    #[tokio::test]
    async fn knowledge_extraction_stores_stated_owner_and_due_as_links_and_absent_ones_as_null() {
        let (pool, evidence) = meeting_with_evidence().await;
        let reply = r#"{"items":[{"type":"commitment","text":"Maria owns the release notes","evidence":[{"segment":"S3","quote":"Maria will own the release notes"}],"owner":{"value":"Maria","segment":"S3","quote":"Maria will own the release notes"},"due":null}]}"#;

        run_with_replies(&pool, &evidence, LARGE_BUDGET, vec![reply]).await;

        let (owner_text, owner_support, due_text, due_support): (Option<String>, String, Option<String>, String) =
            sqlx::query_as("SELECT owner_text, owner_support, due_text, due_support FROM knowledge_items")
                .fetch_one(&pool)
                .await
                .expect("item attributes");
        assert_eq!((owner_text.as_deref(), owner_support.as_str()), (Some("Maria"), "stated"));
        assert_eq!((due_text, due_support.as_str()), (None, "not_stated"));
        let roles: Vec<String> = sqlx::query_scalar("SELECT role FROM knowledge_evidence_links ORDER BY role")
            .fetch_all(&pool)
            .await
            .expect("link roles");
        assert_eq!(roles, vec!["claim", "owner"]);
    }

    #[tokio::test]
    async fn knowledge_cancel_stops_the_run_without_touching_the_summary_token() {
        let meeting_id = "018f5e27-2f68-7e27-9c90-7c7212314201";
        let (pool, evidence) = meeting_with_texts(meeting_id, &["We agreed to ship the beta on Friday."]).await;
        let token = register_extraction(meeting_id, RUN_ID);
        let summary_token = SummaryService::register_cancellation_token(meeting_id, Utc::now());
        let reply = r#"{"items":[{"type":"decision","text":"Ship the beta","evidence":[{"segment":"S1","quote":"ship the beta on Friday"}]}]}"#;

        let outcome = run_extraction(&pool, meeting_id, RUN_ID, &evidence, LARGE_BUDGET, &token, |_, _| {
            assert!(cancel_active_extraction(meeting_id));
            async move { Ok(reply.to_string()) }
        })
        .await
        .expect("cancelled outcome");

        assert_eq!(outcome.status, RunStatus::Cancelled);
        assert_eq!(outcome.failure_code, Some("CANCELLED_BY_USER"));
        assert_eq!(count(&pool, "knowledge_items").await, 0);
        assert!(!summary_token.is_cancelled());
        assert!(!has_active_extraction(meeting_id));
    }

    #[tokio::test]
    async fn knowledge_run_ends_quietly_when_its_meeting_is_deleted_mid_run() {
        let (pool, evidence) = meeting_with_evidence().await;
        let deleting_pool = pool.clone();
        let reply = r#"{"items":[{"type":"decision","text":"Ship the beta","evidence":[{"segment":"S2","quote":"ship the beta on Friday"}]}]}"#;

        let outcome = run_extraction(&pool, MEETING_ID, RUN_ID, &evidence, LARGE_BUDGET, &CancellationToken::new(), |_, _| {
            let deleting_pool = deleting_pool.clone();
            async move {
                sqlx::query("DELETE FROM knowledge_runs WHERE meeting_id = ?")
                    .bind(MEETING_ID)
                    .execute(&deleting_pool)
                    .await
                    .expect("run removed");
                sqlx::query("DELETE FROM meetings WHERE id = ?")
                    .bind(MEETING_ID)
                    .execute(&deleting_pool)
                    .await
                    .expect("meeting removed");
                Ok(reply.to_string())
            }
        })
        .await;

        assert_eq!(
            outcome.map(|outcome| outcome.failure_code),
            Ok(Some("MEETING_DELETED"))
        );
        assert_eq!(count(&pool, "knowledge_items").await, 0);
    }

    #[tokio::test]
    async fn knowledge_extract_from_segments_matches_what_run_extraction_persists() {
        let (pool, evidence) = meeting_with_evidence().await;
        let reply = r#"{"items":[
            {"type":"decision","text":"Ship the beta on Friday","evidence":[{"segment":"S2","quote":"ship the beta on Friday"}]},
            {"type":"fact","text":"Budget doubled","evidence":[{"segment":"S2","quote":"the budget doubled"}]}
        ]}"#;
        let mut replay = |_: String, _: String| async move { Ok(reply.to_string()) };

        let pure = extract_from_segments(&label_segments(&evidence), LARGE_BUDGET, Vec::new(), &CancellationToken::new(), &mut replay)
            .await
            .expect("pure extraction");
        run_with_replies(&pool, &evidence, LARGE_BUDGET, vec![reply]).await;
        let persisted_texts: Vec<String> = sqlx::query_scalar("SELECT text FROM knowledge_items ORDER BY text")
            .fetch_all(&pool)
            .await
            .expect("persisted items");
        let persisted_reasons: Vec<String> = sqlx::query_scalar("SELECT reason_code FROM knowledge_abstentions ORDER BY reason_code")
            .fetch_all(&pool)
            .await
            .expect("persisted abstentions");

        assert_eq!(pure.items.iter().map(|item| item.text.clone()).collect::<Vec<_>>(), persisted_texts);
        assert_eq!(
            pure.abstentions.iter().map(|abstention| abstention.reason.as_str().to_string()).collect::<Vec<_>>(),
            persisted_reasons
        );
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
