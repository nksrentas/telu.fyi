use crate::api::{MeetingDetails, MeetingTranscript};
use crate::audio::transcription::QueueSnapshot;
use crate::database::models::{MeetingModel, Transcript};
pub use crate::database::models::{MeetingCompleteness, MeetingLifecycle};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{Connection, Error as SqlxError, SqliteConnection, SqlitePool};
use tracing::{error, info};
use uuid::Uuid;

pub struct MeetingsRepository;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StartMeetingResult {
    pub meeting_id: String,
    pub lifecycle: MeetingLifecycle,
    pub title: String,
    pub started_at_utc: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FinalizationGapInput {
    pub work_id: String,
    pub gap_kind: String,
    pub reason_code: String,
    pub audio_start_ms: Option<u64>,
    pub audio_end_ms: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FinalizeMeetingInput {
    pub meeting_id: String,
    pub capture_closed: bool,
    pub durable_writes_succeeded: bool,
    pub queue: QueueSnapshot,
    pub deadline_at_utc: String,
    pub deadline_ms: u64,
    pub remaining_work_ids: Vec<String>,
    pub reason_codes: Vec<String>,
    pub gaps: Vec<FinalizationGapInput>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FinalizationSnapshot {
    pub meeting_id: String,
    pub lifecycle: MeetingLifecycle,
    pub queue: QueueSnapshot,
    pub deadline_at_utc: String,
    pub deadline_ms: u64,
    pub remaining_work_ids: Vec<String>,
    pub gap_count: u64,
    pub reason_codes: Vec<String>,
}

impl MeetingsRepository {
    /// Create the canonical meeting row before native capture is allowed to start.
    ///
    /// The identifier is always minted here in Rust. Callers receive it only
    /// after the insert transaction commits, so a renderer can transport the
    /// identity but cannot create or replace it.
    pub async fn create_session(
        pool: &SqlitePool,
        title: impl Into<String>,
    ) -> Result<StartMeetingResult, SqlxError> {
        let title = title.into();
        if title.trim().is_empty() {
            return Err(SqlxError::Protocol(
                "meeting title cannot be empty".to_string(),
            ));
        }

        let meeting_id = Uuid::new_v4().to_string();
        let started_at = Utc::now();
        let started_at_utc = started_at.to_rfc3339();
        let lifecycle = MeetingLifecycle::Preparing;
        let completeness = MeetingCompleteness::Pending;

        let mut transaction = pool.begin().await?;
        let insert_result = sqlx::query(
            "INSERT INTO meetings (
                id,
                title,
                created_at,
                updated_at,
                lifecycle,
                completeness,
                completeness_reason,
                started_at_utc
            ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)",
        )
        .bind(&meeting_id)
        .bind(&title)
        .bind(started_at)
        .bind(started_at)
        .bind(lifecycle.as_str())
        .bind(completeness.as_str())
        .bind(&started_at_utc)
        .execute(&mut *transaction)
        .await;

        match insert_result {
            Ok(result) if result.rows_affected() == 1 => {
                transaction.commit().await?;
                Ok(StartMeetingResult {
                    meeting_id,
                    lifecycle,
                    title,
                    started_at_utc,
                })
            }
            Ok(_) => {
                let _ = transaction.rollback().await;
                Err(SqlxError::Protocol(
                    "canonical meeting insert did not create exactly one row".to_string(),
                ))
            }
            Err(error) => {
                let _ = transaction.rollback().await;
                Err(error)
            }
        }
    }

    /// Persist the immutable terminal result for one Rust-owned meeting.
    ///
    /// The RED scaffold deliberately returns an incomplete projection without
    /// writing it. The behavior tests below define the transactional predicate
    /// and idempotency contract implemented in the GREEN phase.
    pub async fn finalize_session(
        _pool: &SqlitePool,
        input: &FinalizeMeetingInput,
    ) -> Result<FinalizationSnapshot, SqlxError> {
        Ok(FinalizationSnapshot {
            meeting_id: input.meeting_id.clone(),
            lifecycle: MeetingLifecycle::Incomplete,
            queue: input.queue.clone(),
            deadline_at_utc: input.deadline_at_utc.clone(),
            deadline_ms: input.deadline_ms,
            remaining_work_ids: input.remaining_work_ids.clone(),
            gap_count: input.gaps.len() as u64,
            reason_codes: input.reason_codes.clone(),
        })
    }

    pub async fn get_meetings(pool: &SqlitePool) -> Result<Vec<MeetingModel>, sqlx::Error> {
        let meetings =
            sqlx::query_as::<_, MeetingModel>("SELECT * FROM meetings ORDER BY created_at DESC")
                .fetch_all(pool)
                .await?;
        Ok(meetings)
    }

    pub async fn delete_meeting(pool: &SqlitePool, meeting_id: &str) -> Result<bool, SqlxError> {
        if meeting_id.trim().is_empty() {
            return Err(SqlxError::Protocol(
                "meeting_id cannot be empty".to_string(),
            ));
        }

        let mut conn = pool.acquire().await?;
        let mut transaction = conn.begin().await?;

        match delete_meeting_with_transaction(&mut transaction, meeting_id).await {
            Ok(success) => {
                if success {
                    transaction.commit().await?;
                    info!(
                        "Successfully deleted meeting {} and all associated data",
                        meeting_id
                    );
                    Ok(true)
                } else {
                    transaction.rollback().await?;
                    Ok(false)
                }
            }
            Err(e) => {
                let _ = transaction.rollback().await;
                error!("Failed to delete meeting {}: {}", meeting_id, e);
                Err(e)
            }
        }
    }

    pub async fn get_meeting(
        pool: &SqlitePool,
        meeting_id: &str,
    ) -> Result<Option<MeetingDetails>, SqlxError> {
        if meeting_id.trim().is_empty() {
            return Err(SqlxError::Protocol(
                "meeting_id cannot be empty".to_string(),
            ));
        }

        let mut conn = pool.acquire().await?;
        let mut transaction = conn.begin().await?;

        // Get meeting details
        let meeting: Option<MeetingModel> =
            sqlx::query_as("SELECT * FROM meetings WHERE id = ?")
                .bind(meeting_id)
                .fetch_optional(&mut *transaction)
                .await?;

        if meeting.is_none() {
            transaction.rollback().await?;
            return Err(SqlxError::RowNotFound);
        }

        if let Some(meeting) = meeting {
            // Get all transcripts for this meeting
            let transcripts =
                sqlx::query_as::<_, Transcript>("SELECT * FROM transcripts WHERE meeting_id = ?")
                    .bind(meeting_id)
                    .fetch_all(&mut *transaction)
                    .await?;

            transaction.commit().await?;

            // Convert Transcript to MeetingTranscript
            let meeting_transcripts = transcripts
                .into_iter()
                .map(|t| MeetingTranscript {
                    id: t.id,
                    text: t.transcript,
                    timestamp: t.timestamp,
                    audio_start_time: t.audio_start_time,
                    audio_end_time: t.audio_end_time,
                    duration: t.duration,
                })
                .collect::<Vec<_>>();

            Ok(Some(MeetingDetails {
                id: meeting.id,
                title: meeting.title,
                created_at: meeting.created_at.0.to_rfc3339(),
                updated_at: meeting.updated_at.0.to_rfc3339(),
                transcripts: meeting_transcripts,
            }))
        } else {
            transaction.rollback().await?;
            Ok(None)
        }
    }

    /// Get meeting metadata without transcripts (for pagination)
    pub async fn get_meeting_metadata(
        pool: &SqlitePool,
        meeting_id: &str,
    ) -> Result<Option<MeetingModel>, SqlxError> {
        if meeting_id.trim().is_empty() {
            return Err(SqlxError::Protocol(
                "meeting_id cannot be empty".to_string(),
            ));
        }

        let meeting: Option<MeetingModel> =
            sqlx::query_as("SELECT * FROM meetings WHERE id = ?")
                .bind(meeting_id)
                .fetch_optional(pool)
                .await?;

        Ok(meeting)
    }

    /// Get meeting transcripts with pagination support
    pub async fn get_meeting_transcripts_paginated(
        pool: &SqlitePool,
        meeting_id: &str,
        limit: i64,
        offset: i64,
    ) -> Result<(Vec<Transcript>, i64), SqlxError> {
        if meeting_id.trim().is_empty() {
            return Err(SqlxError::Protocol(
                "meeting_id cannot be empty".to_string(),
            ));
        }

        // Get total count of transcripts for this meeting
        let total: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM transcripts WHERE meeting_id = ?"
        )
        .bind(meeting_id)
        .fetch_one(pool)
        .await?;

        // Get paginated transcripts ordered by audio_start_time
        let transcripts = sqlx::query_as::<_, Transcript>(
            "SELECT * FROM transcripts
             WHERE meeting_id = ?
             ORDER BY audio_start_time ASC
             LIMIT ? OFFSET ?"
        )
        .bind(meeting_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

        Ok((transcripts, total.0))
    }

    pub async fn update_meeting_title(
        pool: &SqlitePool,
        meeting_id: &str,
        new_title: &str,
    ) -> Result<bool, SqlxError> {
        if meeting_id.trim().is_empty() {
            return Err(SqlxError::Protocol(
                "meeting_id cannot be empty".to_string(),
            ));
        }

        let mut conn = pool.acquire().await?;
        let mut transaction = conn.begin().await?;

        let now = Utc::now().naive_utc();

        let rows_affected =
            sqlx::query("UPDATE meetings SET title = ?, updated_at = ? WHERE id = ?")
                .bind(new_title)
                .bind(now)
                .bind(meeting_id)
                .execute(&mut *transaction)
                .await?;
        if rows_affected.rows_affected() == 0 {
            transaction.rollback().await?;
            return Ok(false);
        }
        transaction.commit().await?;
        Ok(true)
    }

    pub async fn update_meeting_name(
        pool: &SqlitePool,
        meeting_id: &str,
        new_title: &str,
    ) -> Result<bool, SqlxError> {
        let mut transaction = pool.begin().await?;
        let now = Utc::now();

        // Update meetings table
        let meeting_update =
            sqlx::query("UPDATE meetings SET title = ?, updated_at = ? WHERE id = ?")
                .bind(new_title)
                .bind(now)
                .bind(meeting_id)
                .execute(&mut *transaction)
                .await?;

        if meeting_update.rows_affected() == 0 {
            transaction.rollback().await?;
            return Ok(false); // Meeting not found
        }

        // Update transcript_chunks table
        sqlx::query("UPDATE transcript_chunks SET meeting_name = ? WHERE meeting_id = ?")
            .bind(new_title)
            .bind(meeting_id)
            .execute(&mut *transaction)
            .await?;

        transaction.commit().await?;
        Ok(true)
    }
}

async fn delete_meeting_with_transaction(
    transaction: &mut SqliteConnection,
    meeting_id: &str,
) -> Result<bool, SqlxError> {
    // Check if meeting exists
    let meeting_exists: Option<(i64,)> = sqlx::query_as("SELECT 1 FROM meetings WHERE id = ?")
        .bind(meeting_id)
        .fetch_optional(&mut *transaction)
        .await?;

    if meeting_exists.is_none() {
        error!("Meeting {} not found for deletion", meeting_id);
        return Ok(false);
    }

    // Delete from related tables in proper order
    // 1. Delete from transcript_chunks
    sqlx::query("DELETE FROM transcript_chunks WHERE meeting_id = ?")
        .bind(meeting_id)
        .execute(&mut *transaction)
        .await?;

    // 2. Delete from summary_processes
    sqlx::query("DELETE FROM summary_processes WHERE meeting_id = ?")
        .bind(meeting_id)
        .execute(&mut *transaction)
        .await?;

    // 3. Delete from transcripts
    sqlx::query("DELETE FROM transcripts WHERE meeting_id = ?")
        .bind(meeting_id)
        .execute(&mut *transaction)
        .await?;

    // 4. Finally, delete the meeting
    let result = sqlx::query("DELETE FROM meetings WHERE id = ?")
        .bind(meeting_id)
        .execute(&mut *transaction)
        .await?;

    Ok(result.rows_affected() > 0)
}

#[cfg(test)]
mod meeting_identity_tests {
    use super::{MeetingLifecycle, MeetingsRepository};
    use sqlx::{Row, SqlitePool};
    use uuid::Uuid;

    async fn phase_one_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::raw_sql(include_str!("../../../migrations/20250916100000_initial_schema.sql"))
            .execute(&pool)
            .await
            .unwrap();
        sqlx::raw_sql(include_str!("../../../migrations/20251006000000_add_audio_sync_fields.sql"))
            .execute(&pool)
            .await
            .unwrap();
        sqlx::raw_sql(include_str!("../../../migrations/20260920000100_phase1_meeting_identity.sql"))
            .execute(&pool)
            .await
            .unwrap();
        pool
    }

    #[tokio::test]
    async fn meeting_identity_schema_marks_legacy_rows_unverified() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::query(
            "CREATE TABLE meetings (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                folder_path TEXT
            )",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO meetings (id, title, created_at, updated_at)
             VALUES ('legacy-id', 'Legacy meeting', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
        )
        .execute(&pool)
        .await
        .unwrap();

        let migration_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("migrations/20260920000100_phase1_meeting_identity.sql");
        if let Ok(migration) = std::fs::read_to_string(migration_path) {
            sqlx::raw_sql(&migration).execute(&pool).await.unwrap();
        }

        let row = sqlx::query(
            "SELECT lifecycle, completeness, completeness_reason
             FROM meetings WHERE id = 'legacy-id'",
        )
        .fetch_one(&pool)
        .await;

        assert!(
            row.is_ok(),
            "phase-one migration must add conservative lifecycle and completeness fields"
        );
        let row = row.unwrap();
        assert_eq!(row.get::<String, _>("lifecycle"), "legacy");
        assert_eq!(
            row.get::<String, _>("completeness"),
            "completion_not_verified"
        );
        assert_eq!(
            row.get::<String, _>("completeness_reason"),
            "legacy_pre_phase1"
        );
    }

    #[test]
    fn meeting_identity_repository_declares_transactional_session_creation() {
        let source = include_str!("meeting.rs");

        assert!(
            source.contains(concat!("pub async fn create_", "session")),
            "MeetingsRepository must expose create_session"
        );
        assert!(
            source.contains(concat!("Uuid::new_", "v4")),
            "the repository must mint the canonical ID in Rust"
        );
        assert!(
            source.contains(concat!("transaction.", "commit().await")),
            "session creation must commit through a SQLx transaction"
        );
    }

    #[tokio::test]
    async fn meeting_identity_create_session_commits_one_rust_owned_id() {
        let pool = phase_one_pool().await;

        let result = MeetingsRepository::create_session(&pool, "Planning review")
            .await
            .unwrap();

        assert_eq!(result.lifecycle, MeetingLifecycle::Preparing);
        assert!(Uuid::parse_str(&result.meeting_id).is_ok());

        let row = sqlx::query(
            "SELECT id, title, lifecycle, completeness, completeness_reason, started_at_utc
             FROM meetings",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM meetings")
            .fetch_one(&pool)
            .await
            .unwrap();

        assert_eq!(count.0, 1);
        assert_eq!(row.get::<String, _>("id"), result.meeting_id);
        assert_eq!(row.get::<String, _>("title"), result.title);
        assert_eq!(row.get::<String, _>("lifecycle"), "preparing");
        assert_eq!(row.get::<String, _>("completeness"), "pending");
        assert_eq!(row.get::<Option<String>, _>("completeness_reason"), None);
        assert_eq!(
            row.get::<String, _>("started_at_utc"),
            result.started_at_utc
        );
    }
}

#[cfg(test)]
mod finalization_repository_tests {
    use super::{
        FinalizationGapInput, FinalizeMeetingInput, MeetingLifecycle, MeetingsRepository,
    };
    use crate::audio::transcription::QueueSnapshot;
    use sqlx::{Row, SqlitePool};

    async fn finalization_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::raw_sql(include_str!("../../../migrations/20250916100000_initial_schema.sql"))
            .execute(&pool)
            .await
            .unwrap();
        sqlx::raw_sql(include_str!("../../../migrations/20251006000000_add_audio_sync_fields.sql"))
            .execute(&pool)
            .await
            .unwrap();
        sqlx::raw_sql(include_str!("../../../migrations/20260920000100_phase1_meeting_identity.sql"))
            .execute(&pool)
            .await
            .unwrap();
        sqlx::raw_sql(include_str!("../../../migrations/20260920000300_phase1_finalization_gaps.sql"))
            .execute(&pool)
            .await
            .unwrap();
        pool
    }

    fn queue(
        depth: u64,
        accepted: u64,
        completed: u64,
        failed: u64,
        rejected: u64,
    ) -> QueueSnapshot {
        QueueSnapshot {
            capacity: 8,
            depth,
            active: depth,
            oldest_age_ms: (depth > 0).then_some(125),
            accepted,
            started: accepted,
            completed,
            failed,
            cancelled: 0,
            superseded: 0,
            rejected,
        }
    }

    fn clean_input(meeting_id: String) -> FinalizeMeetingInput {
        FinalizeMeetingInput {
            meeting_id,
            capture_closed: true,
            durable_writes_succeeded: true,
            queue: queue(0, 2, 2, 0, 0),
            deadline_at_utc: "2026-09-20T21:00:00Z".to_string(),
            deadline_ms: 30_000,
            remaining_work_ids: Vec::new(),
            reason_codes: Vec::new(),
            gaps: Vec::new(),
        }
    }

    fn incomplete_input(meeting_id: String) -> FinalizeMeetingInput {
        FinalizeMeetingInput {
            meeting_id,
            capture_closed: true,
            durable_writes_succeeded: false,
            queue: queue(1, 3, 1, 1, 1),
            deadline_at_utc: "2026-09-20T21:00:00Z".to_string(),
            deadline_ms: 30_000,
            remaining_work_ids: vec!["mixed:chunk-3".to_string()],
            reason_codes: vec!["deadline_exceeded".to_string()],
            gaps: vec![FinalizationGapInput {
                work_id: "mixed:chunk-rejected".to_string(),
                gap_kind: "transcript_work".to_string(),
                reason_code: "capacity".to_string(),
                audio_start_ms: Some(2_000),
                audio_end_ms: Some(2_500),
            }],
        }
    }

    #[tokio::test]
    async fn finalization_repository_all_terminal_closed_capture_and_durable_writes_is_complete() {
        let pool = finalization_pool().await;
        let meeting = MeetingsRepository::create_session(&pool, "Complete meeting")
            .await
            .unwrap();

        let result = MeetingsRepository::finalize_session(
            &pool,
            &clean_input(meeting.meeting_id.clone()),
        )
        .await
        .unwrap();

        assert_eq!(result.lifecycle, MeetingLifecycle::Complete);
        let row = sqlx::query(
            "SELECT lifecycle, completeness FROM meetings WHERE id = ?",
        )
        .bind(&meeting.meeting_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(row.get::<String, _>("lifecycle"), "complete");
        assert_eq!(row.get::<String, _>("completeness"), "complete");
    }

    #[tokio::test]
    async fn finalization_repository_failure_deadline_and_gap_are_durable_incomplete_facts() {
        let pool = finalization_pool().await;
        let meeting = MeetingsRepository::create_session(&pool, "Incomplete meeting")
            .await
            .unwrap();

        let result = MeetingsRepository::finalize_session(
            &pool,
            &incomplete_input(meeting.meeting_id.clone()),
        )
        .await
        .unwrap();

        assert_eq!(result.lifecycle, MeetingLifecycle::Incomplete);
        assert_eq!(result.remaining_work_ids, vec!["mixed:chunk-3"]);
        assert!(result.reason_codes.contains(&"deadline_exceeded".to_string()));
        let finalization_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM meeting_finalizations WHERE meeting_id = ?",
        )
        .bind(&meeting.meeting_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        let gap_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM meeting_finalization_gaps WHERE meeting_id = ?",
        )
        .bind(&meeting.meeting_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(finalization_count.0, 1);
        assert_eq!(gap_count.0, 1);
    }

    #[tokio::test]
    async fn finalization_repository_repeated_terminal_transition_returns_same_durable_result() {
        let pool = finalization_pool().await;
        let meeting = MeetingsRepository::create_session(&pool, "Repeated stop")
            .await
            .unwrap();
        let incomplete = incomplete_input(meeting.meeting_id.clone());

        let first = MeetingsRepository::finalize_session(&pool, &incomplete)
            .await
            .unwrap();
        let repeated = MeetingsRepository::finalize_session(
            &pool,
            &clean_input(meeting.meeting_id.clone()),
        )
        .await
        .unwrap();

        assert_eq!(repeated, first);
        let finalization_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM meeting_finalizations WHERE meeting_id = ?",
        )
        .bind(&meeting.meeting_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        let gap_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM meeting_finalization_gaps WHERE meeting_id = ?",
        )
        .bind(&meeting.meeting_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(finalization_count.0, 1);
        assert_eq!(gap_count.0, 1);
    }
}
