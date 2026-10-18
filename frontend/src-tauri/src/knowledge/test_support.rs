use crate::knowledge::prompt::EXTRACTION_SYSTEM_PROMPT;
use chrono::Utc;
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::future::{ready, Ready};

const EMPTY_REPLY: &str = "{\"items\": []}";

pub const MEETING_ID: &str = "018f5e27-2f68-7e27-9c90-7c72123141ae";

pub fn extraction_replies<S: Into<String>>(
    replies: Vec<S>,
) -> impl FnMut(String, String) -> Ready<Result<String, String>> {
    let mut queue = replies.into_iter().map(Into::into);
    move |system_prompt: String, _: String| {
        let reply = (system_prompt == EXTRACTION_SYSTEM_PROMPT)
            .then(|| queue.next())
            .flatten()
            .unwrap_or_else(|| EMPTY_REPLY.to_string());
        ready(Ok(reply))
    }
}

pub async fn migrated_pool() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("in-memory SQLite pool");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("fresh migration set");
    pool
}

pub async fn insert_meeting(pool: &SqlitePool, meeting_id: &str, lifecycle: &str, completeness: &str) {
    let now = Utc::now();
    sqlx::query(
        "INSERT INTO meetings (
            id, title, created_at, updated_at, lifecycle, completeness,
            completeness_reason, started_at_utc
         ) VALUES (?, 'Knowledge test', ?, ?, ?, ?, NULL, ?)",
    )
    .bind(meeting_id)
    .bind(now)
    .bind(now)
    .bind(lifecycle)
    .bind(completeness)
    .bind(now.to_rfc3339())
    .execute(pool)
    .await
    .expect("meeting fixture");
}

pub async fn insert_evidence(
    pool: &SqlitePool,
    meeting_id: &str,
    evidence_id: &str,
    sequence: i64,
    text: &str,
) {
    let now = Utc::now();
    let start = sequence as f64 * 5.0;
    sqlx::query(
        "INSERT INTO transcript_evidence (
            evidence_id, meeting_id, source_track, source_segment_key,
            sequence, transcript, audio_start_time, audio_end_time,
            is_final, capture_completeness, created_at, updated_at
         ) VALUES (?, ?, 'mixed', ?, ?, ?, ?, ?, 1, 'complete', ?, ?)",
    )
    .bind(evidence_id)
    .bind(meeting_id)
    .bind(format!("segment-{sequence}"))
    .bind(sequence)
    .bind(text)
    .bind(start)
    .bind(start + 4.0)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .expect("evidence fixture");
}

pub const SEEDED_EVIDENCE_TEXT: &str = "We ship the beta on Friday.";

pub async fn seed_items(pool: &SqlitePool, meeting_id: &str, texts: &[&str]) -> Vec<String> {
    use crate::knowledge::models::{KnowledgeType, RunStatus, TriggerKind};
    use crate::knowledge::repository::{KnowledgeRepository, NewItem, NewRun, RunCounts};
    use crate::knowledge::span_verifier::{sha256_hex, AttributeSupport, VerifiedSpan};
    use uuid::Uuid;

    insert_meeting(pool, meeting_id, "complete", "complete").await;
    let evidence_id = Uuid::new_v4().to_string();
    insert_evidence(pool, meeting_id, &evidence_id, 0, SEEDED_EVIDENCE_TEXT).await;
    let run_id = Uuid::new_v4().to_string();
    KnowledgeRepository::insert_running_run(
        pool,
        &NewRun {
            run_id: run_id.clone(),
            meeting_id: meeting_id.to_string(),
            trigger_kind: TriggerKind::User,
            provider_id: "ollama".to_string(),
            model_id: "llama3".to_string(),
            location_class: "local".to_string(),
            sanitized_origin: "This device".to_string(),
            prompt_version: "knowledge-extract-v2".to_string(),
            meeting_completeness_at_start: "complete".to_string(),
            input_evidence_count: 1,
            input_fingerprint: "fingerprint".to_string(),
        },
    )
    .await
    .expect("seeded run");
    let items: Vec<NewItem> = texts
        .iter()
        .map(|text| NewItem {
            item_id: Uuid::new_v4().to_string(),
            item_type: KnowledgeType::Decision,
            text: text.to_string(),
            normalized_key: text.to_lowercase(),
            claims: vec![VerifiedSpan {
                evidence_id: evidence_id.clone(),
                raw_start: 3,
                raw_end: 16,
                quote_text: "ship the beta".to_string(),
                normalized_quote: "ship the beta".to_string(),
                evidence_text_sha256: sha256_hex(SEEDED_EVIDENCE_TEXT),
                segment_capture_incomplete: false,
            }],
            owner: AttributeSupport::NotStated,
            due: AttributeSupport::NotStated,
        })
        .collect();
    let mut transaction = pool.begin().await.expect("seed transaction");
    KnowledgeRepository::insert_items_with_links(&mut transaction, meeting_id, &run_id, &items)
        .await
        .expect("seeded items");
    KnowledgeRepository::finalize_run(
        &mut transaction,
        &run_id,
        RunStatus::Succeeded,
        RunCounts {
            proposed: items.len() as i64,
            skipped: 0,
            ..RunCounts::default()
        },
        None,
    )
    .await
    .expect("seeded run finalized");
    transaction.commit().await.expect("seed commit");
    items.into_iter().map(|item| item.item_id).collect()
}
