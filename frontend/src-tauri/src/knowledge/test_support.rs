use chrono::Utc;
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};

pub const MEETING_ID: &str = "018f5e27-2f68-7e27-9c90-7c72123141ae";

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
