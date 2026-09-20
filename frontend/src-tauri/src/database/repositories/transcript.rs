use crate::api::{TranscriptSearchResult, TranscriptSegment};
use chrono::Utc;
use sqlx::{Connection, Error as SqlxError, SqlitePool};
use tracing::{error, info};
use uuid::Uuid;

pub struct TranscriptsRepository;

impl TranscriptsRepository {
    /// Saves a new meeting and its associated transcript segments.
    /// This function uses a transaction to ensure that either both the meeting
    /// and all its transcripts are saved, or none of them are.
    pub async fn save_transcript(
        pool: &SqlitePool,
        meeting_title: &str,
        transcripts: &[TranscriptSegment],
        folder_path: Option<String>,
    ) -> Result<String, SqlxError> {
        let meeting_id = format!("meeting-{}", Uuid::new_v4());

        let mut conn = pool.acquire().await?;
        let mut transaction = conn.begin().await?;

        let now = Utc::now();

        // 1. Create the new meeting
        let result = sqlx::query(
            "INSERT INTO meetings (id, title, created_at, updated_at, folder_path) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(&meeting_id)
        .bind(meeting_title)
        .bind(now)
        .bind(now)
        .bind(&folder_path)
        .execute(&mut *transaction)
        .await;

        if let Err(e) = result {
            error!("Failed to create meeting '{}': {}", meeting_title, e);
            transaction.rollback().await?;
            return Err(e);
        }

        info!("Successfully created meeting with id: {}", meeting_id);

        // 2. Save each transcript segment with audio timing fields
        for segment in transcripts {
            let transcript_id = format!("transcript-{}", Uuid::new_v4());
            let result = sqlx::query(
                "INSERT INTO transcripts (id, meeting_id, transcript, timestamp, audio_start_time, audio_end_time, duration)
                 VALUES (?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(&transcript_id)
            .bind(&meeting_id)
            .bind(&segment.text)
            .bind(&segment.timestamp)
            .bind(segment.audio_start_time)
            .bind(segment.audio_end_time)
            .bind(segment.duration)
            .execute(&mut *transaction)
            .await;

            if let Err(e) = result {
                error!(
                    "Failed to save transcript segment for meeting {}: {}",
                    meeting_id, e
                );
                transaction.rollback().await?;
                return Err(e);
            }
        }

        info!(
            "Successfully saved {} transcript segments for meeting {}",
            transcripts.len(),
            meeting_id
        );

        // Commit the transaction
        transaction.commit().await?;

        Ok(meeting_id)
    }

    /// Searches for a query string within the transcripts.
    /// It returns a list of matching transcripts with context.
    pub async fn search_transcripts(
        pool: &SqlitePool,
        query: &str,
    ) -> Result<Vec<TranscriptSearchResult>, SqlxError> {
        if query.trim().is_empty() {
            return Ok(Vec::new());
        }

        let search_query = format!("%{}%", query.to_lowercase());

        let rows = sqlx::query_as::<_, (String, String, String, String)>(
            "SELECT m.id, m.title, t.transcript, t.timestamp
             FROM meetings m
             JOIN transcripts t ON m.id = t.meeting_id
             WHERE LOWER(t.transcript) LIKE ?",
        )
        .bind(&search_query)
        .fetch_all(pool)
        .await?;

        let results = rows
            .into_iter()
            .map(|(id, title, transcript, timestamp)| {
                let match_context = Self::get_match_context(&transcript, query);
                TranscriptSearchResult {
                    id,
                    title,
                    match_context,
                    timestamp,
                }
            })
            .collect();

        Ok(results)
    }

    /// Helper function to extract a snippet of text around the first match of a query.
    fn get_match_context(transcript: &str, query: &str) -> String {
        let transcript_lower = transcript.to_lowercase();
        let query_lower = query.to_lowercase();

        match transcript_lower.find(&query_lower) {
            Some(match_index) => {
                let start_index = match_index.saturating_sub(100);
                let end_index = (match_index + query.len() + 100).min(transcript.len());

                let mut context = String::new();
                if start_index > 0 {
                    context.push_str("...");
                }
                context.push_str(&transcript[start_index..end_index]);
                if end_index < transcript.len() {
                    context.push_str("...");
                }
                context
            }
            None => transcript.chars().take(200).collect(), // Fallback to the start of the transcript
        }
    }
}

#[cfg(test)]
mod transcript_evidence_repository_tests {
    use super::*;
    use sqlx::{sqlite::SqlitePoolOptions, Row};

    const MEETING_ID: &str = "018f5e27-2f68-7e27-9c90-7c72123141ae";
    const EVIDENCE_ID: &str = "018f5e27-2f68-7e27-9c90-7c72123141af";

    async fn migrated_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("in-memory SQLite pool");
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("fresh migration set");

        let now = Utc::now();
        sqlx::query(
            "INSERT INTO meetings (
                id, title, created_at, updated_at, lifecycle, completeness,
                completeness_reason, started_at_utc
             ) VALUES (?, 'Evidence test', ?, ?, 'recording', 'pending', NULL, ?)",
        )
        .bind(MEETING_ID)
        .bind(now)
        .bind(now)
        .bind(now.to_rfc3339())
        .execute(&pool)
        .await
        .expect("canonical meeting fixture");

        pool
    }

    async fn evidence_table_exists(pool: &SqlitePool) -> bool {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM sqlite_master
             WHERE type = 'table' AND name = 'transcript_evidence'",
        )
        .fetch_one(pool)
        .await
        .expect("schema inspection")
            == 1
    }

    async fn raw_upsert_final(pool: &SqlitePool, transcript: &str, end: f64) {
        sqlx::query(
            "INSERT INTO transcript_evidence (
                evidence_id, meeting_id, source_track, source_segment_key,
                sequence, transcript, audio_start_time, audio_end_time,
                is_final, capture_completeness, created_at, updated_at
             ) VALUES (?, ?, 'mixed', 'segment-42', 42, ?, 1.25, ?, 1, 'complete', ?, ?)
             ON CONFLICT(evidence_id) DO UPDATE SET
                sequence = excluded.sequence,
                transcript = excluded.transcript,
                audio_start_time = excluded.audio_start_time,
                audio_end_time = excluded.audio_end_time,
                capture_completeness = excluded.capture_completeness,
                updated_at = excluded.updated_at",
        )
        .bind(EVIDENCE_ID)
        .bind(MEETING_ID)
        .bind(transcript)
        .bind(end)
        .bind(Utc::now())
        .bind(Utc::now())
        .execute(pool)
        .await
        .expect("final evidence upsert");
    }

    #[tokio::test]
    async fn transcript_evidence_repository_inserts_one_final_for_existing_meeting() {
        let pool = migrated_pool().await;
        assert!(
            evidence_table_exists(&pool).await,
            "final transcript evidence must have forward-migrated durable storage"
        );

        raw_upsert_final(&pool, "first final", 2.5).await;
        let row = sqlx::query(
            "SELECT evidence_id, meeting_id, is_final, capture_completeness
             FROM transcript_evidence",
        )
        .fetch_one(&pool)
        .await
        .expect("inserted final evidence");

        assert_eq!(row.get::<String, _>("evidence_id"), EVIDENCE_ID);
        assert_eq!(row.get::<String, _>("meeting_id"), MEETING_ID);
        assert_eq!(row.get::<i64, _>("is_final"), 1);
        assert_eq!(
            row.get::<String, _>("capture_completeness"),
            "complete"
        );
    }

    #[tokio::test]
    async fn transcript_evidence_repository_redelivery_preserves_identity_and_row_count() {
        let pool = migrated_pool().await;
        assert!(
            evidence_table_exists(&pool).await,
            "redelivery requires a stable evidence table and uniqueness contract"
        );

        raw_upsert_final(&pool, "first final", 2.5).await;
        raw_upsert_final(&pool, "corrected final", 2.75).await;

        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM transcript_evidence WHERE meeting_id = ?",
        )
        .bind(MEETING_ID)
        .fetch_one(&pool)
        .await
        .expect("evidence count");
        let row = sqlx::query(
            "SELECT evidence_id, transcript, audio_end_time FROM transcript_evidence",
        )
        .fetch_one(&pool)
        .await
        .expect("redelivered final evidence");

        assert_eq!(count, 1);
        assert_eq!(row.get::<String, _>("evidence_id"), EVIDENCE_ID);
        assert_eq!(row.get::<String, _>("transcript"), "corrected final");
        assert_eq!(row.get::<f64, _>("audio_end_time"), 2.75);
    }

    #[tokio::test]
    async fn transcript_evidence_repository_rejects_partial_segments() {
        let pool = migrated_pool().await;
        assert!(
            evidence_table_exists(&pool).await,
            "partial rejection requires the final-evidence storage contract"
        );

        let result = sqlx::query(
            "INSERT INTO transcript_evidence (
                evidence_id, meeting_id, source_track, source_segment_key,
                sequence, transcript, audio_start_time, audio_end_time,
                is_final, capture_completeness, created_at, updated_at
             ) VALUES (?, ?, 'mixed', 'partial-42', 42, 'provisional',
                       1.25, 2.5, 0, 'complete', ?, ?)",
        )
        .bind(EVIDENCE_ID)
        .bind(MEETING_ID)
        .bind(Utc::now())
        .bind(Utc::now())
        .execute(&pool)
        .await;

        assert!(result.is_err(), "partial text must never enter evidence storage");
        let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM transcript_evidence")
            .fetch_one(&pool)
            .await
            .expect("evidence count after rejected partial");
        assert_eq!(count, 0);
    }
}
