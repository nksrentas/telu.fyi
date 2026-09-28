use crate::knowledge::matcher::{normalized_key, ExistingItem};
use crate::knowledge::models::{
    AbstentionReason, EvidenceRole, KnowledgeError, KnowledgeRunView, KnowledgeType, ReviewState,
    RunStatus, Support, SuppressionReason, TriggerKind,
};
use crate::knowledge::span_verifier::{AttributeSupport, VerifiedSpan};
use chrono::Utc;
use sqlx::{Error as SqlxError, SqliteConnection, SqlitePool};
use std::collections::HashMap;
use tracing::error;
use uuid::Uuid;

pub(crate) const RUN_COLUMNS: &str = "run_id, meeting_id, trigger_kind, status, provider_id, model_id,
    location_class, sanitized_origin, prompt_version, input_evidence_count, proposed_count,
    skipped_count, suppressed_count, reconfirmed_count, duplicate_count, failure_code, started_at_utc,
    finished_at_utc";

#[derive(Debug, Clone, PartialEq)]
pub struct NewRun {
    pub run_id: String,
    pub meeting_id: String,
    pub trigger_kind: TriggerKind,
    pub provider_id: String,
    pub model_id: String,
    pub location_class: String,
    pub sanitized_origin: String,
    pub prompt_version: String,
    pub meeting_completeness_at_start: String,
    pub input_evidence_count: i64,
    pub input_fingerprint: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct RunCounts {
    pub proposed: i64,
    pub skipped: i64,
    pub suppressed: i64,
    pub reconfirmed: i64,
    pub duplicate: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct NewItem {
    pub item_id: String,
    pub item_type: KnowledgeType,
    pub text: String,
    pub normalized_key: String,
    pub claims: Vec<VerifiedSpan>,
    pub owner: AttributeSupport,
    pub due: AttributeSupport,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewSuppression {
    pub matched_item_id: String,
    pub reason: SuppressionReason,
    pub candidate_normalized_key: String,
    pub candidate_text: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NewAbstention {
    pub reason: AbstentionReason,
    pub candidate_type: Option<KnowledgeType>,
}

pub struct KnowledgeRepository;

impl KnowledgeRepository {
    pub async fn insert_running_run(
        pool: &SqlitePool,
        run: &NewRun,
    ) -> Result<KnowledgeRunView, KnowledgeError> {
        validate_meeting_id(&run.meeting_id)?;
        let result = sqlx::query(
            "INSERT INTO knowledge_runs (
                run_id, meeting_id, trigger_kind, status, provider_id, model_id,
                location_class, sanitized_origin, prompt_version,
                meeting_completeness_at_start, input_evidence_count, input_fingerprint,
                started_at_utc
             ) VALUES (?, ?, ?, 'running', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&run.run_id)
        .bind(&run.meeting_id)
        .bind(run.trigger_kind.as_str())
        .bind(&run.provider_id)
        .bind(&run.model_id)
        .bind(&run.location_class)
        .bind(&run.sanitized_origin)
        .bind(&run.prompt_version)
        .bind(&run.meeting_completeness_at_start)
        .bind(run.input_evidence_count)
        .bind(&run.input_fingerprint)
        .bind(Utc::now().to_rfc3339())
        .execute(pool)
        .await;

        match result {
            Ok(_) => Self::run_by_id(pool, &run.run_id).await,
            Err(SqlxError::Database(database_error)) if database_error.is_unique_violation() => {
                Err(KnowledgeError::RunInProgress)
            }
            Err(error) => Err(storage_error("insert_running_run", &run.meeting_id, error)),
        }
    }

    pub async fn finalize_run(
        connection: &mut SqliteConnection,
        run_id: &str,
        status: RunStatus,
        counts: RunCounts,
        failure_code: Option<&str>,
    ) -> Result<(), KnowledgeError> {
        let result = sqlx::query(
            "UPDATE knowledge_runs
             SET status = ?, proposed_count = ?, skipped_count = ?, suppressed_count = ?,
                 reconfirmed_count = ?, duplicate_count = ?, failure_code = ?, finished_at_utc = ?
             WHERE run_id = ? AND status = 'running'",
        )
        .bind(status.as_str())
        .bind(counts.proposed)
        .bind(counts.skipped)
        .bind(counts.suppressed)
        .bind(counts.reconfirmed)
        .bind(counts.duplicate)
        .bind(failure_code)
        .bind(Utc::now().to_rfc3339())
        .bind(run_id)
        .execute(connection)
        .await
        .map_err(|error| storage_error("finalize_run", run_id, error))?;

        if result.rows_affected() == 1 {
            Ok(())
        } else {
            error!(run_id, "knowledge run was not running at finalization");
            Err(KnowledgeError::Storage)
        }
    }

    pub async fn insert_items_with_links(
        connection: &mut SqliteConnection,
        meeting_id: &str,
        run_id: &str,
        items: &[NewItem],
    ) -> Result<(), KnowledgeError> {
        for item in items {
            insert_item(connection, meeting_id, run_id, item).await?;
            for (role, span) in item_links(item) {
                insert_link(connection, meeting_id, &item.item_id, role, span).await?;
            }
        }
        Ok(())
    }

    pub async fn insert_abstentions(
        connection: &mut SqliteConnection,
        meeting_id: &str,
        run_id: &str,
        abstentions: &[NewAbstention],
    ) -> Result<(), KnowledgeError> {
        for abstention in abstentions {
            sqlx::query(
                "INSERT INTO knowledge_abstentions (
                    abstention_id, meeting_id, run_id, reason_code, candidate_type, created_at_utc
                 ) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(Uuid::new_v4().to_string())
            .bind(meeting_id)
            .bind(run_id)
            .bind(abstention.reason.as_str())
            .bind(abstention.candidate_type.map(KnowledgeType::as_str))
            .bind(Utc::now().to_rfc3339())
            .execute(&mut *connection)
            .await
            .map_err(|error| storage_error("insert_abstentions", meeting_id, error))?;
        }
        Ok(())
    }

    pub async fn insert_suppressions(
        connection: &mut SqliteConnection,
        meeting_id: &str,
        run_id: &str,
        suppressions: &[NewSuppression],
    ) -> Result<(), KnowledgeError> {
        for suppression in suppressions {
            sqlx::query(
                "INSERT INTO knowledge_suppressions (
                    suppression_id, run_id, meeting_id, matched_item_id, reason,
                    candidate_normalized_key, candidate_text, created_at_utc
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(Uuid::new_v4().to_string())
            .bind(run_id)
            .bind(meeting_id)
            .bind(&suppression.matched_item_id)
            .bind(suppression.reason.as_str())
            .bind(&suppression.candidate_normalized_key)
            .bind(&suppression.candidate_text)
            .bind(Utc::now().to_rfc3339())
            .execute(&mut *connection)
            .await
            .map_err(|error| storage_error("insert_suppressions", meeting_id, error))?;
        }
        Ok(())
    }

    pub async fn load_match_index(
        pool: &SqlitePool,
        meeting_id: &str,
    ) -> Result<Vec<ExistingItem>, KnowledgeError> {
        validate_meeting_id(meeting_id)?;
        let items: Vec<(String, KnowledgeType, ReviewState, String)> = sqlx::query_as(
            "SELECT c.item_id, c.item_type, c.review_state, i.text
             FROM knowledge_item_current c
             JOIN knowledge_items i ON i.item_id = c.item_id
             WHERE c.meeting_id = ?
             ORDER BY c.item_id",
        )
        .bind(meeting_id)
        .fetch_all(pool)
        .await
        .map_err(|error| storage_error("load_match_index", meeting_id, error))?;
        let revisions = item_pairs(pool, meeting_id, "SELECT item_id, text FROM knowledge_revisions WHERE meeting_id = ?").await?;
        let claims = item_pairs(
            pool,
            meeting_id,
            "SELECT item_id, evidence_id FROM knowledge_evidence_links WHERE meeting_id = ? AND role = 'claim'",
        )
        .await?;
        Ok(items
            .into_iter()
            .map(|(item_id, item_type, state, text)| ExistingItem {
                keys: std::iter::once(normalized_key(&text))
                    .chain(revisions.get(&item_id).into_iter().flatten().map(|revision| normalized_key(revision)))
                    .collect(),
                superseded_keys: Vec::new(),
                claim_evidence_ids: claims.get(&item_id).cloned().unwrap_or_default(),
                item_id,
                item_type,
                state,
            })
            .collect())
    }

    pub async fn finalize_stale_running_run(
        pool: &SqlitePool,
        meeting_id: &str,
    ) -> Result<bool, KnowledgeError> {
        validate_meeting_id(meeting_id)?;
        let result = sqlx::query(
            "UPDATE knowledge_runs
             SET status = 'cancelled', failure_code = 'INTERRUPTED', finished_at_utc = ?
             WHERE meeting_id = ? AND status = 'running'",
        )
        .bind(Utc::now().to_rfc3339())
        .bind(meeting_id)
        .execute(pool)
        .await
        .map_err(|error| storage_error("finalize_stale_running_run", meeting_id, error))?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn latest_run(
        pool: &SqlitePool,
        meeting_id: &str,
    ) -> Result<Option<KnowledgeRunView>, KnowledgeError> {
        validate_meeting_id(meeting_id)?;
        sqlx::query_as::<_, KnowledgeRunView>(&format!(
            "SELECT {RUN_COLUMNS} FROM knowledge_runs
             WHERE meeting_id = ?
             ORDER BY started_at_utc DESC, rowid DESC
             LIMIT 1"
        ))
        .bind(meeting_id)
        .fetch_optional(pool)
        .await
        .map_err(|error| storage_error("latest_run", meeting_id, error))
    }

    async fn run_by_id(pool: &SqlitePool, run_id: &str) -> Result<KnowledgeRunView, KnowledgeError> {
        sqlx::query_as::<_, KnowledgeRunView>(&format!(
            "SELECT {RUN_COLUMNS} FROM knowledge_runs WHERE run_id = ?"
        ))
        .bind(run_id)
        .fetch_one(pool)
        .await
        .map_err(|error| storage_error("run_by_id", run_id, error))
    }
}

async fn insert_item(
    connection: &mut SqliteConnection,
    meeting_id: &str,
    run_id: &str,
    item: &NewItem,
) -> Result<(), KnowledgeError> {
    sqlx::query(
        "INSERT INTO knowledge_items (
            item_id, meeting_id, origin_run_id, item_type, text, owner_text, owner_support,
            due_text, due_support, normalized_key, created_at_utc
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&item.item_id)
    .bind(meeting_id)
    .bind(run_id)
    .bind(item.item_type.as_str())
    .bind(&item.text)
    .bind(stated_text(&item.owner))
    .bind(support(&item.owner).as_str())
    .bind(stated_text(&item.due))
    .bind(support(&item.due).as_str())
    .bind(&item.normalized_key)
    .bind(Utc::now().to_rfc3339())
    .execute(connection)
    .await
    .map(|_| ())
    .map_err(|error| storage_error("insert_item", meeting_id, error))
}

fn item_links(item: &NewItem) -> Vec<(EvidenceRole, &VerifiedSpan)> {
    item.claims
        .iter()
        .map(|span| (EvidenceRole::Claim, span))
        .chain(attribute_links(EvidenceRole::Owner, &item.owner))
        .chain(attribute_links(EvidenceRole::Due, &item.due))
        .collect()
}

fn attribute_links(role: EvidenceRole, attribute: &AttributeSupport) -> Vec<(EvidenceRole, &VerifiedSpan)> {
    match attribute {
        AttributeSupport::Stated { spans, .. } => spans.iter().map(|span| (role, span)).collect(),
        AttributeSupport::NotStated => Vec::new(),
    }
}

fn stated_text(attribute: &AttributeSupport) -> Option<&str> {
    match attribute {
        AttributeSupport::Stated { text, .. } => Some(text.as_str()),
        AttributeSupport::NotStated => None,
    }
}

fn support(attribute: &AttributeSupport) -> Support {
    match attribute {
        AttributeSupport::Stated { .. } => Support::Stated,
        AttributeSupport::NotStated => Support::NotStated,
    }
}

async fn insert_link(
    connection: &mut SqliteConnection,
    meeting_id: &str,
    item_id: &str,
    role: EvidenceRole,
    span: &VerifiedSpan,
) -> Result<(), KnowledgeError> {
    sqlx::query(
        "INSERT INTO knowledge_evidence_links (
            link_id, meeting_id, item_id, evidence_id, role, quote_text, normalized_quote,
            raw_start, raw_end, evidence_text_sha256, segment_capture_incomplete, created_at_utc
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(meeting_id)
    .bind(item_id)
    .bind(&span.evidence_id)
    .bind(role.as_str())
    .bind(&span.quote_text)
    .bind(&span.normalized_quote)
    .bind(span.raw_start as i64)
    .bind(span.raw_end as i64)
    .bind(&span.evidence_text_sha256)
    .bind(span.segment_capture_incomplete)
    .bind(Utc::now().to_rfc3339())
    .execute(connection)
    .await
    .map(|_| ())
    .map_err(|error| storage_error("insert_link", meeting_id, error))
}

async fn item_pairs(
    pool: &SqlitePool,
    meeting_id: &str,
    query: &str,
) -> Result<HashMap<String, Vec<String>>, KnowledgeError> {
    let rows: Vec<(String, String)> = sqlx::query_as(query)
        .bind(meeting_id)
        .fetch_all(pool)
        .await
        .map_err(|error| storage_error("item_pairs", meeting_id, error))?;
    Ok(rows.into_iter().fold(HashMap::new(), |mut grouped, (item_id, value)| {
        grouped.entry(item_id).or_insert_with(Vec::new).push(value);
        grouped
    }))
}

pub(crate) fn validate_meeting_id(meeting_id: &str) -> Result<(), KnowledgeError> {
    Uuid::parse_str(meeting_id)
        .map(|_| ())
        .map_err(|_| KnowledgeError::InvalidRequest)
}

pub(crate) fn storage_error(operation: &'static str, subject_id: &str, error: SqlxError) -> KnowledgeError {
    error!(operation, subject_id, error = %error, "knowledge storage operation failed");
    KnowledgeError::Storage
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::knowledge::test_support::{insert_evidence, insert_meeting, migrated_pool, MEETING_ID};

    const EARLY_EVIDENCE: &str = "018f5e27-2f68-7e27-9c90-7c72123141b1";
    const LATE_EVIDENCE: &str = "018f5e27-2f68-7e27-9c90-7c72123141b2";

    fn new_run(run_id: &str) -> NewRun {
        NewRun {
            run_id: run_id.to_string(),
            meeting_id: MEETING_ID.to_string(),
            trigger_kind: TriggerKind::User,
            provider_id: "ollama".to_string(),
            model_id: "llama3".to_string(),
            location_class: "local".to_string(),
            sanitized_origin: "This device".to_string(),
            prompt_version: "knowledge-extract-v1".to_string(),
            meeting_completeness_at_start: "complete".to_string(),
            input_evidence_count: 2,
            input_fingerprint: "fingerprint".to_string(),
        }
    }

    fn new_item(item_id: &str, evidence_id: &str, raw_start: usize, text: &str) -> NewItem {
        NewItem {
            item_id: item_id.to_string(),
            item_type: KnowledgeType::Decision,
            text: text.to_string(),
            normalized_key: text.to_lowercase(),
            owner: AttributeSupport::NotStated,
            due: AttributeSupport::NotStated,
            claims: vec![VerifiedSpan {
                evidence_id: evidence_id.to_string(),
                raw_start,
                raw_end: raw_start + 4,
                quote_text: "ship".to_string(),
                normalized_quote: "ship".to_string(),
                evidence_text_sha256: "hash".to_string(),
                segment_capture_incomplete: false,
            }],
        }
    }

    async fn seeded_pool() -> SqlitePool {
        let pool = migrated_pool().await;
        insert_meeting(&pool, MEETING_ID, "complete", "complete").await;
        insert_evidence(&pool, MEETING_ID, EARLY_EVIDENCE, 1, "We ship the beta.").await;
        insert_evidence(&pool, MEETING_ID, LATE_EVIDENCE, 2, "Then we ship docs.").await;
        pool
    }

    async fn finalized_run_with_rows(pool: &SqlitePool, run_id: &str, items: &[NewItem]) {
        KnowledgeRepository::insert_running_run(pool, &new_run(run_id))
            .await
            .expect("running run");
        let mut transaction = pool.begin().await.expect("transaction");
        KnowledgeRepository::insert_items_with_links(&mut transaction, MEETING_ID, run_id, items)
            .await
            .expect("items with links");
        KnowledgeRepository::insert_abstentions(
            &mut transaction,
            MEETING_ID,
            run_id,
            &[NewAbstention {
                reason: AbstentionReason::QuoteNotFound,
                candidate_type: Some(KnowledgeType::Fact),
            }],
        )
        .await
        .expect("abstention");
        KnowledgeRepository::finalize_run(
            &mut transaction,
            run_id,
            RunStatus::Succeeded,
            RunCounts {
                proposed: items.len() as i64,
                skipped: 1,
                ..RunCounts::default()
            },
            None,
        )
        .await
        .expect("finalized run");
        transaction.commit().await.expect("commit");
    }

    async fn update_fails(pool: &SqlitePool, statement: &str) -> bool {
        sqlx::query(statement).execute(pool).await.is_err()
    }

    #[tokio::test]
    async fn knowledge_ledger_rows_are_append_only_and_runs_freeze_after_finalization() {
        let pool = seeded_pool().await;
        let run_id = "018f5e27-2f68-7e27-9c90-7c72123141c1";
        KnowledgeRepository::insert_running_run(&pool, &new_run(run_id))
            .await
            .expect("running run");
        let running_update = sqlx::query("UPDATE knowledge_runs SET proposed_count = 0 WHERE run_id = ?")
            .bind(run_id)
            .execute(&pool)
            .await;
        assert!(running_update.is_ok(), "a running run can still be updated");

        let mut transaction = pool.begin().await.expect("transaction");
        KnowledgeRepository::insert_items_with_links(
            &mut transaction,
            MEETING_ID,
            run_id,
            &[new_item("018f5e27-2f68-7e27-9c90-7c72123141d1", EARLY_EVIDENCE, 3, "Ship the beta")],
        )
        .await
        .expect("items with links");
        KnowledgeRepository::insert_abstentions(
            &mut transaction,
            MEETING_ID,
            run_id,
            &[NewAbstention {
                reason: AbstentionReason::UnknownSegment,
                candidate_type: None,
            }],
        )
        .await
        .expect("abstention");
        KnowledgeRepository::finalize_run(&mut transaction, run_id, RunStatus::Succeeded, RunCounts { proposed: 1, skipped: 1, ..RunCounts::default() }, None)
            .await
            .expect("finalized run");
        transaction.commit().await.expect("commit");

        assert!(update_fails(&pool, "UPDATE knowledge_items SET text = 'changed'").await);
        assert!(update_fails(&pool, "UPDATE knowledge_evidence_links SET quote_text = 'changed'").await);
        assert!(update_fails(&pool, "UPDATE knowledge_abstentions SET reason_code = 'empty_text'").await);
        assert!(update_fails(&pool, "UPDATE knowledge_runs SET proposed_count = 5").await);
    }

    #[tokio::test]
    async fn knowledge_second_running_run_for_a_meeting_is_rejected_until_the_first_finishes() {
        let pool = seeded_pool().await;
        KnowledgeRepository::insert_running_run(&pool, &new_run("018f5e27-2f68-7e27-9c90-7c72123141c1"))
            .await
            .expect("first running run");

        let second = KnowledgeRepository::insert_running_run(&pool, &new_run("018f5e27-2f68-7e27-9c90-7c72123141c2")).await;
        assert_eq!(second, Err(KnowledgeError::RunInProgress));

        let mut connection = pool.acquire().await.expect("connection");
        KnowledgeRepository::finalize_run(&mut connection, "018f5e27-2f68-7e27-9c90-7c72123141c1", RunStatus::Failed, RunCounts::default(), Some("PROVIDER_ERROR"))
            .await
            .expect("finalized first run");
        drop(connection);
        let third = KnowledgeRepository::insert_running_run(&pool, &new_run("018f5e27-2f68-7e27-9c90-7c72123141c3"))
            .await
            .expect("new run after the first finished");
        assert_eq!(third.status, RunStatus::Running);
    }

    #[tokio::test]
    async fn knowledge_items_list_by_first_claim_position_with_evidence_details() {
        let pool = seeded_pool().await;
        finalized_run_with_rows(
            &pool,
            "018f5e27-2f68-7e27-9c90-7c72123141c1",
            &[
                new_item("018f5e27-2f68-7e27-9c90-7c72123141d3", LATE_EVIDENCE, 0, "Ship docs"),
                new_item("018f5e27-2f68-7e27-9c90-7c72123141d2", EARLY_EVIDENCE, 7, "Beta later"),
                new_item("018f5e27-2f68-7e27-9c90-7c72123141d1", EARLY_EVIDENCE, 3, "Ship the beta"),
            ],
        )
        .await;

        let items = KnowledgeRepository::meeting_view(&pool, MEETING_ID)
            .await
            .expect("meeting view")
            .items;
        let texts: Vec<&str> = items.iter().map(|item| item.text.as_str()).collect();
        assert_eq!(texts, vec!["Ship the beta", "Beta later", "Ship docs"]);

        let first = &items[0];
        assert_eq!(first.review_state, crate::knowledge::models::ReviewState::Proposed);
        assert_eq!(first.owner_support, crate::knowledge::models::FieldSupport::NotStated);
        assert_eq!(first.evidence.len(), 1);
        assert_eq!(first.evidence[0].evidence_id, EARLY_EVIDENCE);
        assert_eq!(first.evidence[0].role, EvidenceRole::Claim);
        assert_eq!((first.evidence[0].raw_start, first.evidence[0].raw_end), (3, 7));
        assert_eq!(first.evidence[0].audio_start_time, 5.0);

        let latest = KnowledgeRepository::latest_run(&pool, MEETING_ID)
            .await
            .expect("latest run")
            .expect("a run exists");
        assert_eq!(latest.status, RunStatus::Succeeded);
        assert_eq!((latest.proposed_count, latest.skipped_count), (3, 1));
    }

    #[tokio::test]
    async fn knowledge_repository_rejects_malformed_meeting_ids() {
        let pool = seeded_pool().await;

        let result = KnowledgeRepository::meeting_view(&pool, "not-a-uuid").await;

        assert_eq!(result.err(), Some(KnowledgeError::InvalidRequest));
    }
}
