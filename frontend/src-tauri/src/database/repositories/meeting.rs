use crate::api::{MeetingDetails, MeetingTranscript};
use crate::database::models::{MeetingModel, Transcript};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{Connection, Error as SqlxError, SqliteConnection, SqlitePool};
use tracing::{error, info};
use uuid::Uuid;

pub struct MeetingsRepository;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MeetingLifecycle {
    Preparing,
    Recording,
    Finalizing,
    Complete,
    Incomplete,
    Recovered,
    Legacy,
}

impl MeetingLifecycle {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Preparing => "preparing",
            Self::Recording => "recording",
            Self::Finalizing => "finalizing",
            Self::Complete => "complete",
            Self::Incomplete => "incomplete",
            Self::Recovered => "recovered",
            Self::Legacy => "legacy",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MeetingCompleteness {
    Pending,
    Complete,
    Incomplete,
    RecoveredWithGaps,
    CompletionNotVerified,
}

impl MeetingCompleteness {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Complete => "complete",
            Self::Incomplete => "incomplete",
            Self::RecoveredWithGaps => "recovered_with_gaps",
            Self::CompletionNotVerified => "completion_not_verified",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StartMeetingResult {
    pub meeting_id: String,
    pub lifecycle: MeetingLifecycle,
    pub title: String,
    pub started_at_utc: String,
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
            sqlx::query_as("SELECT id, title, created_at, updated_at, folder_path FROM meetings WHERE id = ?")
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
            sqlx::query_as("SELECT id, title, created_at, updated_at, folder_path FROM meetings WHERE id = ?")
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
