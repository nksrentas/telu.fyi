use crate::api::{TranscriptSearchResult, TranscriptSegment};
use crate::database::models::{TranscriptEvidence, TranscriptEvidenceInput};
use crate::database::repositories::evaluation::EvaluationRepository;
use chrono::Utc;
use sqlx::{Connection, Error as SqlxError, SqlitePool};
use tracing::{error, info, warn};
use uuid::Uuid;

pub struct TranscriptsRepository;

impl TranscriptsRepository {
    /// Incrementally persists a finalized transcript segment under caller-owned,
    /// stable meeting and evidence identities.
    ///
    /// Immutable source identity is never rewritten on redelivery. Allowed
    /// transcript, timing, ordering, and completeness corrections update the
    /// existing row in one SQLite transaction.
    pub async fn upsert_final_evidence(
        pool: &SqlitePool,
        evidence: &TranscriptEvidenceInput,
    ) -> Result<TranscriptEvidence, SqlxError> {
        Self::validate_final_evidence(evidence)?;

        let now = Utc::now();
        let mut transaction = pool.begin().await?;
        let result = sqlx::query(
            "INSERT INTO transcript_evidence (
                evidence_id, meeting_id, source_track, source_segment_key,
                sequence, transcript, audio_start_time, audio_end_time,
                is_final, capture_completeness, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
             ON CONFLICT(evidence_id) DO UPDATE SET
                sequence = excluded.sequence,
                transcript = excluded.transcript,
                audio_start_time = excluded.audio_start_time,
                audio_end_time = excluded.audio_end_time,
                capture_completeness = excluded.capture_completeness,
                updated_at = excluded.updated_at
             WHERE transcript_evidence.meeting_id = excluded.meeting_id
               AND transcript_evidence.source_track = excluded.source_track
               AND transcript_evidence.source_segment_key = excluded.source_segment_key",
        )
        .bind(&evidence.evidence_id)
        .bind(&evidence.meeting_id)
        .bind(&evidence.source_track)
        .bind(&evidence.source_segment_key)
        .bind(evidence.sequence)
        .bind(&evidence.transcript)
        .bind(evidence.audio_start_time)
        .bind(evidence.audio_end_time)
        .bind(evidence.capture_completeness.as_str())
        .bind(now)
        .bind(now)
        .execute(&mut *transaction)
        .await;

        if let Err(error) = result {
            let _ = transaction.rollback().await;
            return Err(error);
        }

        let persisted = sqlx::query_as::<_, TranscriptEvidence>(
            "SELECT * FROM transcript_evidence WHERE evidence_id = ?",
        )
        .bind(&evidence.evidence_id)
        .fetch_one(&mut *transaction)
        .await;

        let persisted = match persisted {
            Ok(persisted) => persisted,
            Err(error) => {
                let _ = transaction.rollback().await;
                return Err(error);
            }
        };

        if persisted.meeting_id != evidence.meeting_id
            || persisted.source_track != evidence.source_track
            || persisted.source_segment_key != evidence.source_segment_key
        {
            let _ = transaction.rollback().await;
            return Err(SqlxError::Protocol(
                "evidence identity cannot be reassigned to another source segment".to_string(),
            ));
        }

        transaction.commit().await?;
        if let Err(index_error) = EvaluationRepository::append_committed_evidence(
            pool,
            &evidence.meeting_id,
            &evidence.evidence_id,
            evidence.sequence as u64,
            now,
        )
        .await
        {
            warn!(
                code = index_error.code(),
                "final evidence committed but evaluation indexing failed"
            );
            if let Err(error_index_error) = EvaluationRepository::append_error_for_meeting(
                pool,
                &evidence.meeting_id,
                "transcript_evidence",
                "EVIDENCE_INDEX_FAILED",
                None,
                Some(evidence.evidence_id.clone()),
            )
            .await
            {
                warn!(
                    code = error_index_error.code(),
                    "evaluation indexing failure could not be recorded"
                );
            }
        }
        Ok(persisted)
    }

    pub async fn list_evidence_by_meeting(
        pool: &SqlitePool,
        meeting_id: &str,
    ) -> Result<Vec<TranscriptEvidence>, SqlxError> {
        if Uuid::parse_str(meeting_id).is_err() {
            return Err(SqlxError::Protocol(
                "meeting_id must be a valid UUID".to_string(),
            ));
        }
        sqlx::query_as::<_, TranscriptEvidence>(
            "SELECT * FROM transcript_evidence
             WHERE meeting_id = ?
             ORDER BY sequence, audio_start_time",
        )
        .bind(meeting_id)
        .fetch_all(pool)
        .await
    }

    fn validate_final_evidence(evidence: &TranscriptEvidenceInput) -> Result<(), SqlxError> {
        if Uuid::parse_str(&evidence.evidence_id).is_err() {
            return Err(SqlxError::Protocol(
                "evidence_id must be a valid UUID".to_string(),
            ));
        }
        if Uuid::parse_str(&evidence.meeting_id).is_err() {
            return Err(SqlxError::Protocol(
                "meeting_id must be a valid UUID".to_string(),
            ));
        }
        if evidence.source_track.trim().is_empty() {
            return Err(SqlxError::Protocol(
                "source_track cannot be empty".to_string(),
            ));
        }
        if evidence.source_segment_key.trim().is_empty() {
            return Err(SqlxError::Protocol(
                "source_segment_key cannot be empty".to_string(),
            ));
        }
        if evidence.sequence < 0 {
            return Err(SqlxError::Protocol(
                "sequence cannot be negative".to_string(),
            ));
        }
        if evidence.transcript.trim().is_empty() {
            return Err(SqlxError::Protocol(
                "final transcript cannot be empty".to_string(),
            ));
        }
        if !evidence.audio_start_time.is_finite()
            || !evidence.audio_end_time.is_finite()
            || evidence.audio_start_time < 0.0
            || evidence.audio_end_time < evidence.audio_start_time
        {
            return Err(SqlxError::Protocol(
                "audio bounds must be finite, non-negative, and ordered".to_string(),
            ));
        }

        Ok(())
    }

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
    use crate::database::models::{CaptureCompleteness, TranscriptEvidenceInput};
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

    async fn upsert_final(pool: &SqlitePool, transcript: &str, end: f64) {
        TranscriptsRepository::upsert_final_evidence(
            pool,
            &TranscriptEvidenceInput {
                evidence_id: EVIDENCE_ID.to_string(),
                meeting_id: MEETING_ID.to_string(),
                source_track: "mixed".to_string(),
                source_segment_key: "segment-42".to_string(),
                sequence: 42,
                transcript: transcript.to_string(),
                audio_start_time: 1.25,
                audio_end_time: end,
                capture_completeness: CaptureCompleteness::Complete,
            },
        )
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

        upsert_final(&pool, "first final", 2.5).await;
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
        assert_eq!(row.get::<String, _>("capture_completeness"), "complete");
    }

    #[tokio::test]
    async fn transcript_evidence_repository_redelivery_preserves_identity_and_row_count() {
        let pool = migrated_pool().await;
        assert!(
            evidence_table_exists(&pool).await,
            "redelivery requires a stable evidence table and uniqueness contract"
        );

        upsert_final(&pool, "first final", 2.5).await;
        upsert_final(&pool, "corrected final", 2.75).await;

        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM transcript_evidence WHERE meeting_id = ?",
        )
        .bind(MEETING_ID)
        .fetch_one(&pool)
        .await
        .expect("evidence count");
        let row =
            sqlx::query("SELECT evidence_id, transcript, audio_end_time FROM transcript_evidence")
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

        assert!(
            result.is_err(),
            "partial text must never enter evidence storage"
        );
        let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM transcript_evidence")
            .fetch_one(&pool)
            .await
            .expect("evidence count after rejected partial");
        assert_eq!(count, 0);
    }

    #[tokio::test]
    async fn transcript_evidence_repository_lists_one_meeting_in_sequence_then_start_order() {
        let pool = migrated_pool().await;
        let other_meeting = "018f5e27-2f68-7e27-9c90-7c72123141b0";
        let now = Utc::now();
        sqlx::query(
            "INSERT INTO meetings (
                id, title, created_at, updated_at, lifecycle, completeness,
                completeness_reason, started_at_utc
             ) VALUES (?, 'Other meeting', ?, ?, 'recording', 'pending', NULL, ?)",
        )
        .bind(other_meeting)
        .bind(now)
        .bind(now)
        .bind(now.to_rfc3339())
        .execute(&pool)
        .await
        .expect("second meeting fixture");

        let fixtures = [
            ("018f5e27-2f68-7e27-9c90-7c72123141c1", MEETING_ID, "segment-b", 2, 9.0),
            ("018f5e27-2f68-7e27-9c90-7c72123141c2", MEETING_ID, "segment-a", 1, 4.0),
            ("018f5e27-2f68-7e27-9c90-7c72123141c3", MEETING_ID, "segment-c", 2, 7.5),
            ("018f5e27-2f68-7e27-9c90-7c72123141c4", other_meeting, "segment-a", 0, 0.0),
        ];
        for (evidence_id, meeting_id, segment_key, sequence, start) in fixtures {
            TranscriptsRepository::upsert_final_evidence(
                &pool,
                &TranscriptEvidenceInput {
                    evidence_id: evidence_id.to_string(),
                    meeting_id: meeting_id.to_string(),
                    source_track: "mixed".to_string(),
                    source_segment_key: segment_key.to_string(),
                    sequence,
                    transcript: format!("text {segment_key}"),
                    audio_start_time: start,
                    audio_end_time: start + 1.0,
                    capture_completeness: CaptureCompleteness::Complete,
                },
            )
            .await
            .expect("evidence fixture");
        }

        let listed = TranscriptsRepository::list_evidence_by_meeting(&pool, MEETING_ID)
            .await
            .expect("listed evidence");
        let ids: Vec<&str> = listed.iter().map(|row| row.evidence_id.as_str()).collect();

        assert_eq!(
            ids,
            vec![
                "018f5e27-2f68-7e27-9c90-7c72123141c2",
                "018f5e27-2f68-7e27-9c90-7c72123141c3",
                "018f5e27-2f68-7e27-9c90-7c72123141c1",
            ]
        );
    }
}
