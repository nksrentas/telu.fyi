use crate::api::{MeetingDetails, MeetingTranscript};
use crate::audio::transcription::QueueSnapshot;
pub use crate::database::models::{MeetingCompleteness, MeetingLifecycle};
use crate::database::models::{
    GapFact, MeetingModel, RecoveryRequest, RecoveryResult, Transcript, TranscriptEvidenceInput,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqliteRow, Connection, Error as SqlxError, Row, SqliteConnection, SqlitePool};
use std::collections::BTreeMap;
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

#[derive(Debug, thiserror::Error)]
pub enum RecoveryRepositoryError {
    #[error("invalid recovery request")]
    InvalidRequest,
    #[error("canonical meeting not found")]
    MeetingNotFound,
    #[error("meeting lifecycle is not recoverable")]
    StaleMeeting,
    #[error("recovery item belongs to another meeting")]
    CrossMeetingScope,
    #[error("stable recovery identity conflicts with durable state")]
    IdentityConflict,
    #[error("recovery storage failed")]
    Storage(#[from] SqlxError),
}

impl MeetingsRepository {
    /// Reconcile crash-staged final evidence and gap facts into one canonical
    /// meeting. `BEGIN IMMEDIATE` serializes same-database recovery attempts
    /// before either caller can observe and mutate durable state.
    pub async fn reconcile_meeting(
        pool: &SqlitePool,
        request: &RecoveryRequest,
    ) -> Result<RecoveryResult, RecoveryRepositoryError> {
        let (evidence, gaps) = validate_and_normalize_recovery_request(request)?;
        let mut transaction = pool.begin_with("BEGIN IMMEDIATE").await?;
        let result = reconcile_meeting_transaction(
            &mut transaction,
            request,
            evidence.into_values().collect(),
            gaps.into_values().collect(),
        )
        .await;

        match result {
            Ok(result) => {
                transaction.commit().await?;
                Ok(result)
            }
            Err(error) => {
                let _ = transaction.rollback().await;
                Err(error)
            }
        }
    }

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
    /// The transaction derives the terminal lifecycle from the authoritative
    /// queue and durability facts. It never trusts a caller-provided lifecycle,
    /// and a later retry cannot overwrite the first committed terminal result.
    pub async fn finalize_session(
        pool: &SqlitePool,
        input: &FinalizeMeetingInput,
    ) -> Result<FinalizationSnapshot, SqlxError> {
        validate_identifier("meeting_id", &input.meeting_id)?;

        let mut transaction = pool.begin().await?;
        if let Some(existing) = load_finalization(&mut transaction, &input.meeting_id).await? {
            transaction.rollback().await?;
            return Ok(existing);
        }

        validate_finalization_input(input)?;
        let reason_codes = finalization_reason_codes(input);
        let lifecycle = if strict_complete_predicate(input, &reason_codes) {
            MeetingLifecycle::Complete
        } else {
            MeetingLifecycle::Incomplete
        };
        let finalized_at_utc = Utc::now().to_rfc3339();

        for gap in &input.gaps {
            validate_identifier("gap work_id", &gap.work_id)?;
            validate_identifier("gap_kind", &gap.gap_kind)?;
            validate_identifier("gap reason_code", &gap.reason_code)?;
            let audio_start_ms = optional_u64_to_i64("audio_start_ms", gap.audio_start_ms)?;
            let audio_end_ms = optional_u64_to_i64("audio_end_ms", gap.audio_end_ms)?;
            sqlx::query(
                "INSERT OR IGNORE INTO meeting_finalization_gaps (
                    meeting_id, work_id, gap_kind, reason_code,
                    audio_start_ms, audio_end_ms, created_at_utc
                 ) VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&input.meeting_id)
            .bind(&gap.work_id)
            .bind(&gap.gap_kind)
            .bind(&gap.reason_code)
            .bind(audio_start_ms)
            .bind(audio_end_ms)
            .bind(&finalized_at_utc)
            .execute(&mut *transaction)
            .await?;
        }

        let gap_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM meeting_finalization_gaps WHERE meeting_id = ?",
        )
        .bind(&input.meeting_id)
        .fetch_one(&mut *transaction)
        .await?;
        let remaining_work_ids_json = encode_string_list(
            "remaining_work_ids",
            &normalized_string_list(&input.remaining_work_ids),
        )?;
        let reason_codes_json = encode_string_list("reason_codes", &reason_codes)?;

        sqlx::query(
            "INSERT INTO meeting_finalizations (
                meeting_id, lifecycle,
                queue_capacity, queue_depth, queue_active, queue_oldest_age_ms,
                queue_accepted, queue_started, queue_completed, queue_failed,
                queue_cancelled, queue_superseded, queue_rejected,
                deadline_at_utc, deadline_ms,
                capture_closed, durable_writes_succeeded,
                remaining_work_ids_json, reason_codes_json, gap_count,
                finalized_at_utc
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&input.meeting_id)
        .bind(lifecycle.as_str())
        .bind(u64_to_i64("queue capacity", input.queue.capacity as u64)?)
        .bind(u64_to_i64("queue depth", input.queue.depth)?)
        .bind(u64_to_i64("queue active", input.queue.active)?)
        .bind(optional_u64_to_i64(
            "queue oldest age",
            input.queue.oldest_age_ms,
        )?)
        .bind(u64_to_i64("queue accepted", input.queue.accepted)?)
        .bind(u64_to_i64("queue started", input.queue.started)?)
        .bind(u64_to_i64("queue completed", input.queue.completed)?)
        .bind(u64_to_i64("queue failed", input.queue.failed)?)
        .bind(u64_to_i64("queue cancelled", input.queue.cancelled)?)
        .bind(u64_to_i64("queue superseded", input.queue.superseded)?)
        .bind(u64_to_i64("queue rejected", input.queue.rejected)?)
        .bind(&input.deadline_at_utc)
        .bind(u64_to_i64("finalization deadline", input.deadline_ms)?)
        .bind(input.capture_closed)
        .bind(input.durable_writes_succeeded)
        .bind(&remaining_work_ids_json)
        .bind(&reason_codes_json)
        .bind(gap_count)
        .bind(&finalized_at_utc)
        .execute(&mut *transaction)
        .await?;

        let completeness = match lifecycle {
            MeetingLifecycle::Complete => MeetingCompleteness::Complete,
            MeetingLifecycle::Incomplete => MeetingCompleteness::Incomplete,
            _ => unreachable!("the terminal predicate returns only complete or incomplete"),
        };
        let completeness_reason = if reason_codes.is_empty() {
            None
        } else {
            Some(reason_codes.join(","))
        };
        let updated = sqlx::query(
            "UPDATE meetings
             SET lifecycle = ?, completeness = ?, completeness_reason = ?, updated_at = ?
             WHERE id = ?
               AND lifecycle NOT IN ('complete', 'incomplete', 'recovered', 'legacy')",
        )
        .bind(lifecycle.as_str())
        .bind(completeness.as_str())
        .bind(completeness_reason)
        .bind(Utc::now())
        .bind(&input.meeting_id)
        .execute(&mut *transaction)
        .await?;
        if updated.rows_affected() != 1 {
            transaction.rollback().await?;
            return Err(SqlxError::Protocol(
                "meeting is missing or already has an unsupported terminal lifecycle".to_string(),
            ));
        }

        transaction.commit().await?;
        Ok(FinalizationSnapshot {
            meeting_id: input.meeting_id.clone(),
            lifecycle,
            queue: input.queue.clone(),
            deadline_at_utc: input.deadline_at_utc.clone(),
            deadline_ms: input.deadline_ms,
            remaining_work_ids: normalized_string_list(&input.remaining_work_ids),
            gap_count: i64_to_u64("gap_count", gap_count)?,
            reason_codes,
        })
    }

    pub async fn get_finalization(
        pool: &SqlitePool,
        meeting_id: &str,
    ) -> Result<Option<FinalizationSnapshot>, SqlxError> {
        validate_identifier("meeting_id", meeting_id)?;
        let mut transaction = pool.begin().await?;
        let result = load_finalization(&mut transaction, meeting_id).await?;
        transaction.commit().await?;
        Ok(result)
    }

    /// Move an active meeting into the durable finalizing state before its
    /// accepted queue work is drained. Repeating the transition is harmless.
    pub async fn mark_finalizing(pool: &SqlitePool, meeting_id: &str) -> Result<(), SqlxError> {
        validate_identifier("meeting_id", meeting_id)?;
        let result = sqlx::query(
            "UPDATE meetings
             SET lifecycle = 'finalizing', updated_at = ?
             WHERE id = ? AND lifecycle IN ('preparing', 'recording', 'finalizing')",
        )
        .bind(Utc::now())
        .bind(meeting_id)
        .execute(pool)
        .await?;
        if result.rows_affected() == 1 {
            return Ok(());
        }
        if Self::get_finalization(pool, meeting_id).await?.is_some() {
            return Ok(());
        }
        Err(SqlxError::Protocol(
            "meeting is missing or cannot enter finalizing".to_string(),
        ))
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

    /// Load the durable gap facts that explain a meeting's authoritative
    /// completeness. Unknown audio bounds remain `None` and are sorted after
    /// recording-relative gaps so every renderer sees the same order.
    pub async fn get_meeting_gaps(
        pool: &SqlitePool,
        meeting_id: &str,
    ) -> Result<Vec<GapFact>, SqlxError> {
        validate_identifier("meeting_id", meeting_id)?;

        let rows = sqlx::query(
            "SELECT work_id, gap_kind, reason_code, audio_start_ms, audio_end_ms
             FROM meeting_finalization_gaps
             WHERE meeting_id = ?
             ORDER BY
                CASE WHEN audio_start_ms IS NULL THEN 1 ELSE 0 END,
                audio_start_ms ASC,
                work_id ASC,
                gap_kind ASC,
                reason_code ASC",
        )
        .bind(meeting_id)
        .fetch_all(pool)
        .await?;

        rows.into_iter()
            .map(|row| {
                Ok(GapFact {
                    gap_id: row.try_get("work_id")?,
                    meeting_id: meeting_id.to_string(),
                    gap_kind: row.try_get("gap_kind")?,
                    reason_code: row.try_get("reason_code")?,
                    audio_start_ms: optional_i64_to_u64(
                        "audio_start_ms",
                        row.try_get("audio_start_ms")?,
                    )?,
                    audio_end_ms: optional_i64_to_u64(
                        "audio_end_ms",
                        row.try_get("audio_end_ms")?,
                    )?,
                })
            })
            .collect()
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

fn validate_and_normalize_recovery_request(
    request: &RecoveryRequest,
) -> Result<
    (
        BTreeMap<String, TranscriptEvidenceInput>,
        BTreeMap<String, GapFact>,
    ),
    RecoveryRepositoryError,
> {
    if Uuid::parse_str(&request.meeting_id).is_err() {
        return Err(RecoveryRepositoryError::InvalidRequest);
    }

    let mut evidence_by_id = BTreeMap::new();
    let mut source_identity_to_id = BTreeMap::new();
    for evidence in &request.evidence {
        validate_recovery_evidence(evidence)?;
        if evidence.meeting_id != request.meeting_id {
            return Err(RecoveryRepositoryError::CrossMeetingScope);
        }
        let source_identity = (
            evidence.source_track.clone(),
            evidence.source_segment_key.clone(),
        );
        if let Some(existing_id) = source_identity_to_id.insert(
            source_identity,
            evidence.evidence_id.clone(),
        ) {
            if existing_id != evidence.evidence_id {
                return Err(RecoveryRepositoryError::IdentityConflict);
            }
        }
        if let Some(existing) = evidence_by_id.insert(
            evidence.evidence_id.clone(),
            evidence.clone(),
        ) {
            if existing != *evidence {
                return Err(RecoveryRepositoryError::IdentityConflict);
            }
        }
    }

    let mut gaps_by_id = BTreeMap::new();
    for gap in &request.gaps {
        validate_recovery_gap(gap)?;
        if gap.meeting_id != request.meeting_id {
            return Err(RecoveryRepositoryError::CrossMeetingScope);
        }
        if let Some(existing) = gaps_by_id.insert(gap.gap_id.clone(), gap.clone()) {
            if existing != *gap {
                return Err(RecoveryRepositoryError::IdentityConflict);
            }
        }
    }

    Ok((evidence_by_id, gaps_by_id))
}

fn validate_recovery_evidence(
    evidence: &TranscriptEvidenceInput,
) -> Result<(), RecoveryRepositoryError> {
    if Uuid::parse_str(&evidence.evidence_id).is_err()
        || Uuid::parse_str(&evidence.meeting_id).is_err()
        || evidence.source_track.trim().is_empty()
        || evidence.source_segment_key.trim().is_empty()
        || evidence.sequence < 0
        || evidence.transcript.trim().is_empty()
        || !evidence.audio_start_time.is_finite()
        || !evidence.audio_end_time.is_finite()
        || evidence.audio_start_time < 0.0
        || evidence.audio_end_time < evidence.audio_start_time
    {
        return Err(RecoveryRepositoryError::InvalidRequest);
    }
    Ok(())
}

fn validate_recovery_gap(gap: &GapFact) -> Result<(), RecoveryRepositoryError> {
    if Uuid::parse_str(&gap.meeting_id).is_err()
        || gap.gap_id.trim().is_empty()
        || gap.gap_kind.trim().is_empty()
        || gap.reason_code.trim().is_empty()
        || matches!(
            (gap.audio_start_ms, gap.audio_end_ms),
            (Some(start), Some(end)) if end < start
        )
    {
        return Err(RecoveryRepositoryError::InvalidRequest);
    }
    Ok(())
}

async fn reconcile_meeting_transaction(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    request: &RecoveryRequest,
    evidence: Vec<TranscriptEvidenceInput>,
    mut gaps: Vec<GapFact>,
) -> Result<RecoveryResult, RecoveryRepositoryError> {
    let meeting = sqlx::query_as::<_, MeetingModel>("SELECT * FROM meetings WHERE id = ?")
        .bind(&request.meeting_id)
        .fetch_optional(&mut **transaction)
        .await?
        .ok_or(RecoveryRepositoryError::MeetingNotFound)?;

    match meeting.lifecycle {
        MeetingLifecycle::Complete | MeetingLifecycle::Legacy => {
            return Err(RecoveryRepositoryError::StaleMeeting)
        }
        MeetingLifecycle::Preparing
        | MeetingLifecycle::Recording
        | MeetingLifecycle::Finalizing
        | MeetingLifecycle::Incomplete
        | MeetingLifecycle::Recovered => {}
    }

    let has_terminal_finalization: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM meeting_finalizations WHERE meeting_id = ?)",
    )
    .bind(&request.meeting_id)
    .fetch_one(&mut **transaction)
    .await?;
    if matches!(
        meeting.lifecycle,
        MeetingLifecycle::Preparing | MeetingLifecycle::Recording | MeetingLifecycle::Finalizing
    ) && !has_terminal_finalization
    {
        gaps.push(GapFact {
            gap_id: "recovery:uncertain-tail".to_string(),
            meeting_id: request.meeting_id.clone(),
            gap_kind: "uncertain_tail".to_string(),
            reason_code: "interrupted_without_terminal_finalization".to_string(),
            audio_start_ms: None,
            audio_end_ms: None,
        });
    }

    let mut changed = false;
    for evidence in evidence {
        let existing_identity = sqlx::query(
            "SELECT meeting_id, source_track, source_segment_key
             FROM transcript_evidence WHERE evidence_id = ?",
        )
        .bind(&evidence.evidence_id)
        .fetch_optional(&mut **transaction)
        .await?;
        if let Some(row) = existing_identity {
            if row.try_get::<String, _>("meeting_id")? != evidence.meeting_id {
                return Err(RecoveryRepositoryError::CrossMeetingScope);
            }
            if row.try_get::<String, _>("source_track")? != evidence.source_track
                || row.try_get::<String, _>("source_segment_key")?
                    != evidence.source_segment_key
            {
                return Err(RecoveryRepositoryError::IdentityConflict);
            }
        }

        let existing_source_id: Option<String> = sqlx::query_scalar(
            "SELECT evidence_id FROM transcript_evidence
             WHERE meeting_id = ? AND source_track = ? AND source_segment_key = ?",
        )
        .bind(&evidence.meeting_id)
        .bind(&evidence.source_track)
        .bind(&evidence.source_segment_key)
        .fetch_optional(&mut **transaction)
        .await?;
        if existing_source_id
            .as_deref()
            .is_some_and(|evidence_id| evidence_id != evidence.evidence_id)
        {
            return Err(RecoveryRepositoryError::IdentityConflict);
        }

        let now = Utc::now();
        let persisted = sqlx::query(
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
               AND transcript_evidence.source_segment_key = excluded.source_segment_key
               AND (
                    transcript_evidence.sequence != excluded.sequence
                 OR transcript_evidence.transcript != excluded.transcript
                 OR transcript_evidence.audio_start_time != excluded.audio_start_time
                 OR transcript_evidence.audio_end_time != excluded.audio_end_time
                 OR transcript_evidence.capture_completeness != excluded.capture_completeness
               )",
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
        .execute(&mut **transaction)
        .await?;
        changed |= persisted.rows_affected() > 0;
    }

    let mut gaps_by_id = BTreeMap::new();
    for gap in gaps {
        if let Some(existing) = gaps_by_id.insert(gap.gap_id.clone(), gap.clone()) {
            if existing != gap {
                return Err(RecoveryRepositoryError::IdentityConflict);
            }
        }
    }
    for gap in gaps_by_id.into_values() {
        let existing = sqlx::query(
            "SELECT gap_kind, reason_code, audio_start_ms, audio_end_ms
             FROM meeting_finalization_gaps
             WHERE meeting_id = ? AND work_id = ?",
        )
        .bind(&request.meeting_id)
        .bind(&gap.gap_id)
        .fetch_all(&mut **transaction)
        .await?;
        for row in &existing {
            if row.try_get::<String, _>("gap_kind")? != gap.gap_kind
                || row.try_get::<String, _>("reason_code")? != gap.reason_code
                || optional_i64_to_u64("audio_start_ms", row.try_get("audio_start_ms")?)?
                    != gap.audio_start_ms
                || optional_i64_to_u64("audio_end_ms", row.try_get("audio_end_ms")?)?
                    != gap.audio_end_ms
            {
                return Err(RecoveryRepositoryError::IdentityConflict);
            }
        }
        if existing.is_empty() {
            let inserted = sqlx::query(
                "INSERT INTO meeting_finalization_gaps (
                    meeting_id, work_id, gap_kind, reason_code,
                    audio_start_ms, audio_end_ms, created_at_utc
                 ) VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&request.meeting_id)
            .bind(&gap.gap_id)
            .bind(&gap.gap_kind)
            .bind(&gap.reason_code)
            .bind(optional_u64_to_i64("audio_start_ms", gap.audio_start_ms)?)
            .bind(optional_u64_to_i64("audio_end_ms", gap.audio_end_ms)?)
            .bind(Utc::now().to_rfc3339())
            .execute(&mut **transaction)
            .await?;
            changed |= inserted.rows_affected() > 0;
        }
    }

    let evidence_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM transcript_evidence WHERE meeting_id = ?",
    )
    .bind(&request.meeting_id)
    .fetch_one(&mut **transaction)
    .await?;
    let has_incomplete_evidence: bool = sqlx::query_scalar(
        "SELECT EXISTS(
            SELECT 1 FROM transcript_evidence
            WHERE meeting_id = ? AND capture_completeness = 'incomplete'
         )",
    )
    .bind(&request.meeting_id)
    .fetch_one(&mut **transaction)
    .await?;
    let projected_gaps = load_recovery_gaps(transaction, &request.meeting_id).await?;

    let mut reasons = meeting
        .completeness_reason
        .as_deref()
        .unwrap_or_default()
        .split(',')
        .filter(|reason| !reason.trim().is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
    reasons.extend(projected_gaps.iter().map(|gap| gap.reason_code.clone()));
    if has_incomplete_evidence {
        reasons.push("incomplete_evidence".to_string());
    }
    reasons.sort();
    reasons.dedup();

    let completeness = if projected_gaps.is_empty() && reasons.is_empty() {
        MeetingCompleteness::Complete
    } else {
        MeetingCompleteness::RecoveredWithGaps
    };
    let completeness_reason = (!reasons.is_empty()).then(|| reasons.join(","));
    let state_changed = meeting.lifecycle != MeetingLifecycle::Recovered
        || meeting.completeness != completeness
        || meeting.completeness_reason != completeness_reason;
    let reconciled_at = if changed || state_changed {
        let now = Utc::now();
        let updated = sqlx::query(
            "UPDATE meetings
             SET lifecycle = 'recovered', completeness = ?,
                 completeness_reason = ?, updated_at = ?
             WHERE id = ?",
        )
        .bind(completeness.as_str())
        .bind(&completeness_reason)
        .bind(now)
        .bind(&request.meeting_id)
        .execute(&mut **transaction)
        .await?;
        if updated.rows_affected() != 1 {
            return Err(RecoveryRepositoryError::MeetingNotFound);
        }
        now.to_rfc3339()
    } else {
        meeting.updated_at.0.to_rfc3339()
    };

    Ok(RecoveryResult {
        meeting_id: request.meeting_id.clone(),
        lifecycle: MeetingLifecycle::Recovered,
        completeness,
        evidence_count: i64_to_u64("evidence_count", evidence_count)?,
        gap_count: projected_gaps.len() as u64,
        gaps: projected_gaps,
        reconciled_at_utc: reconciled_at,
    })
}

async fn load_recovery_gaps(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    meeting_id: &str,
) -> Result<Vec<GapFact>, RecoveryRepositoryError> {
    let rows = sqlx::query(
        "SELECT work_id, gap_kind, reason_code, audio_start_ms, audio_end_ms
         FROM meeting_finalization_gaps
         WHERE meeting_id = ?
         ORDER BY
            CASE WHEN audio_start_ms IS NULL THEN 1 ELSE 0 END,
            audio_start_ms ASC,
            work_id ASC,
            gap_kind ASC,
            reason_code ASC",
    )
    .bind(meeting_id)
    .fetch_all(&mut **transaction)
    .await?;

    rows.into_iter()
        .map(|row| {
            Ok(GapFact {
                gap_id: row.try_get("work_id")?,
                meeting_id: meeting_id.to_string(),
                gap_kind: row.try_get("gap_kind")?,
                reason_code: row.try_get("reason_code")?,
                audio_start_ms: optional_i64_to_u64(
                    "audio_start_ms",
                    row.try_get("audio_start_ms")?,
                )?,
                audio_end_ms: optional_i64_to_u64(
                    "audio_end_ms",
                    row.try_get("audio_end_ms")?,
                )?,
            })
        })
        .collect()
}

fn strict_complete_predicate(input: &FinalizeMeetingInput, reason_codes: &[String]) -> bool {
    input.capture_closed
        && input.durable_writes_succeeded
        && input.queue.depth == 0
        && input.queue.active == 0
        && input.queue.failed == 0
        && input.queue.cancelled == 0
        && input.queue.superseded == 0
        && input.queue.rejected == 0
        && input.queue.accepted == input.queue.completed
        && input.remaining_work_ids.is_empty()
        && input.gaps.is_empty()
        && reason_codes.is_empty()
}

fn finalization_reason_codes(input: &FinalizeMeetingInput) -> Vec<String> {
    let mut reasons = input.reason_codes.clone();
    if !input.capture_closed {
        reasons.push("capture_not_closed".to_string());
    }
    if !input.durable_writes_succeeded {
        reasons.push("durable_write_failed".to_string());
    }
    if input.queue.depth > 0 || !input.remaining_work_ids.is_empty() {
        reasons.push("work_remaining".to_string());
    }
    if input.queue.failed > 0 {
        reasons.push("work_failed".to_string());
    }
    if input.queue.cancelled > 0 {
        reasons.push("work_cancelled".to_string());
    }
    if input.queue.superseded > 0 {
        reasons.push("work_superseded".to_string());
    }
    if input.queue.rejected > 0 {
        reasons.push("work_rejected".to_string());
    }
    if !input.gaps.is_empty() {
        reasons.push("unresolved_gap".to_string());
    }
    normalized_string_list(&reasons)
}

fn validate_finalization_input(input: &FinalizeMeetingInput) -> Result<(), SqlxError> {
    validate_identifier("deadline_at_utc", &input.deadline_at_utc)?;
    if input.deadline_ms == 0 || input.queue.capacity == 0 {
        return Err(SqlxError::Protocol(
            "finalization deadline and queue capacity must be positive".to_string(),
        ));
    }
    if input.queue.active > input.queue.depth
        || input.queue.started > input.queue.accepted
        || input.queue.accepted
            != input.queue.depth
                + input.queue.completed
                + input.queue.failed
                + input.queue.cancelled
                + input.queue.superseded
    {
        return Err(SqlxError::Protocol(
            "finalization queue snapshot violates conservation".to_string(),
        ));
    }
    if input.remaining_work_ids.len() as u64 > input.queue.depth + input.queue.cancelled {
        return Err(SqlxError::Protocol(
            "remaining work IDs exceed pending and deadline-cancelled work".to_string(),
        ));
    }
    if input
        .remaining_work_ids
        .iter()
        .any(|work_id| work_id.trim().is_empty())
        || input
            .reason_codes
            .iter()
            .any(|reason| reason.trim().is_empty())
    {
        return Err(SqlxError::Protocol(
            "finalization identifiers and reasons cannot be empty".to_string(),
        ));
    }
    Ok(())
}

async fn load_finalization(
    transaction: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    meeting_id: &str,
) -> Result<Option<FinalizationSnapshot>, SqlxError> {
    let row = sqlx::query(
        "SELECT
            meeting_id, lifecycle,
            queue_capacity, queue_depth, queue_active, queue_oldest_age_ms,
            queue_accepted, queue_started, queue_completed, queue_failed,
            queue_cancelled, queue_superseded, queue_rejected,
            deadline_at_utc, deadline_ms,
            remaining_work_ids_json, reason_codes_json, gap_count
         FROM meeting_finalizations
         WHERE meeting_id = ?",
    )
    .bind(meeting_id)
    .fetch_optional(&mut **transaction)
    .await?;
    row.map(finalization_snapshot_from_row).transpose()
}

fn finalization_snapshot_from_row(row: SqliteRow) -> Result<FinalizationSnapshot, SqlxError> {
    let lifecycle = match row.try_get::<String, _>("lifecycle")?.as_str() {
        "complete" => MeetingLifecycle::Complete,
        "incomplete" => MeetingLifecycle::Incomplete,
        value => {
            return Err(SqlxError::Protocol(format!(
                "unsupported persisted finalization lifecycle: {value}"
            )))
        }
    };
    let capacity = i64_to_u64("queue_capacity", row.try_get("queue_capacity")?)?;
    let capacity = usize::try_from(capacity)
        .map_err(|_| SqlxError::Protocol("queue_capacity exceeds usize".to_string()))?;
    let oldest_age_ms = row
        .try_get::<Option<i64>, _>("queue_oldest_age_ms")?
        .map(|value| i64_to_u64("queue_oldest_age_ms", value))
        .transpose()?;

    Ok(FinalizationSnapshot {
        meeting_id: row.try_get("meeting_id")?,
        lifecycle,
        queue: QueueSnapshot {
            capacity,
            depth: i64_to_u64("queue_depth", row.try_get("queue_depth")?)?,
            active: i64_to_u64("queue_active", row.try_get("queue_active")?)?,
            oldest_age_ms,
            accepted: i64_to_u64("queue_accepted", row.try_get("queue_accepted")?)?,
            started: i64_to_u64("queue_started", row.try_get("queue_started")?)?,
            completed: i64_to_u64("queue_completed", row.try_get("queue_completed")?)?,
            failed: i64_to_u64("queue_failed", row.try_get("queue_failed")?)?,
            cancelled: i64_to_u64("queue_cancelled", row.try_get("queue_cancelled")?)?,
            superseded: i64_to_u64("queue_superseded", row.try_get("queue_superseded")?)?,
            rejected: i64_to_u64("queue_rejected", row.try_get("queue_rejected")?)?,
        },
        deadline_at_utc: row.try_get("deadline_at_utc")?,
        deadline_ms: i64_to_u64("deadline_ms", row.try_get("deadline_ms")?)?,
        remaining_work_ids: decode_string_list(
            "remaining_work_ids",
            row.try_get("remaining_work_ids_json")?,
        )?,
        gap_count: i64_to_u64("gap_count", row.try_get("gap_count")?)?,
        reason_codes: decode_string_list(
            "reason_codes",
            row.try_get("reason_codes_json")?,
        )?,
    })
}

fn validate_identifier(label: &str, value: &str) -> Result<(), SqlxError> {
    if value.trim().is_empty() {
        Err(SqlxError::Protocol(format!("{label} cannot be empty")))
    } else {
        Ok(())
    }
}

fn normalized_string_list(values: &[String]) -> Vec<String> {
    let mut normalized = values.to_vec();
    normalized.sort();
    normalized.dedup();
    normalized
}

fn encode_string_list(label: &str, values: &[String]) -> Result<String, SqlxError> {
    serde_json::to_string(values)
        .map_err(|error| SqlxError::Protocol(format!("failed to encode {label}: {error}")))
}

fn decode_string_list(label: &str, value: String) -> Result<Vec<String>, SqlxError> {
    serde_json::from_str(&value)
        .map_err(|error| SqlxError::Protocol(format!("failed to decode {label}: {error}")))
}

fn u64_to_i64(label: &str, value: u64) -> Result<i64, SqlxError> {
    i64::try_from(value)
        .map_err(|_| SqlxError::Protocol(format!("{label} exceeds SQLite integer range")))
}

fn optional_u64_to_i64(label: &str, value: Option<u64>) -> Result<Option<i64>, SqlxError> {
    value.map(|value| u64_to_i64(label, value)).transpose()
}

fn optional_i64_to_u64(label: &str, value: Option<i64>) -> Result<Option<u64>, SqlxError> {
    value.map(|value| i64_to_u64(label, value)).transpose()
}

fn i64_to_u64(label: &str, value: i64) -> Result<u64, SqlxError> {
    u64::try_from(value)
        .map_err(|_| SqlxError::Protocol(format!("{label} cannot be negative")))
}

#[derive(Debug, Clone, Copy)]
enum DeleteScope {
    Meeting,
    EvaluationRun,
    EvaluationRunOrMeeting,
}

const MEETING_SCOPED_DELETE_ORDER: &[(&str, DeleteScope)] = &[
    ("preparation_sources", DeleteScope::Meeting),
    ("knowledge_suppressions", DeleteScope::Meeting),
    ("knowledge_reviews", DeleteScope::Meeting),
    ("knowledge_revisions", DeleteScope::Meeting),
    ("knowledge_evidence_links", DeleteScope::Meeting),
    ("knowledge_abstentions", DeleteScope::Meeting),
    ("knowledge_items", DeleteScope::Meeting),
    ("knowledge_runs", DeleteScope::Meeting),
    ("meeting_notes", DeleteScope::Meeting),
    ("meeting_finalization_gaps", DeleteScope::Meeting),
    ("meeting_finalizations", DeleteScope::Meeting),
    ("evaluation_error_records", DeleteScope::EvaluationRun),
    ("evaluation_evidence_commits", DeleteScope::EvaluationRun),
    ("evaluation_gap_records", DeleteScope::EvaluationRun),
    ("evaluation_outbound_records", DeleteScope::EvaluationRunOrMeeting),
    ("evaluation_queue_records", DeleteScope::EvaluationRun),
    ("evaluation_resource_records", DeleteScope::EvaluationRun),
    ("evaluation_route_records", DeleteScope::EvaluationRunOrMeeting),
    ("evaluation_run_summaries", DeleteScope::EvaluationRun),
    ("evaluation_stage_records", DeleteScope::EvaluationRunOrMeeting),
    ("evaluation_terminal_records", DeleteScope::EvaluationRunOrMeeting),
    ("evaluation_runs", DeleteScope::Meeting),
    ("transcript_evidence", DeleteScope::Meeting),
    ("transcript_chunks", DeleteScope::Meeting),
    ("summary_processes", DeleteScope::Meeting),
    ("transcripts", DeleteScope::Meeting),
];

fn scoped_delete_statement(table: &str, scope: DeleteScope) -> String {
    let evaluation_runs = "SELECT run_id FROM evaluation_runs WHERE meeting_id = ?1";
    match scope {
        DeleteScope::Meeting => format!("DELETE FROM {table} WHERE meeting_id = ?1"),
        DeleteScope::EvaluationRun => format!("DELETE FROM {table} WHERE run_id IN ({evaluation_runs})"),
        DeleteScope::EvaluationRunOrMeeting => {
            format!("DELETE FROM {table} WHERE meeting_id = ?1 OR run_id IN ({evaluation_runs})")
        }
    }
}

async fn delete_meeting_with_transaction(
    transaction: &mut SqliteConnection,
    meeting_id: &str,
) -> Result<bool, SqlxError> {
    let meeting_exists: Option<(i64,)> = sqlx::query_as("SELECT 1 FROM meetings WHERE id = ?")
        .bind(meeting_id)
        .fetch_optional(&mut *transaction)
        .await?;

    if meeting_exists.is_none() {
        error!("Meeting {} not found for deletion", meeting_id);
        return Ok(false);
    }

    sqlx::query(
        "UPDATE briefing_claims SET status = 'source_unavailable', quote = ''
         WHERE knowledge_meeting_id = ?",
    )
    .bind(meeting_id)
    .execute(&mut *transaction)
    .await?;

    let mut affected = Vec::with_capacity(MEETING_SCOPED_DELETE_ORDER.len());
    for (table, scope) in MEETING_SCOPED_DELETE_ORDER {
        let result = sqlx::query(&scoped_delete_statement(table, *scope))
            .bind(meeting_id)
            .execute(&mut *transaction)
            .await?;
        if result.rows_affected() > 0 {
            affected.push(format!("{table}={}", result.rows_affected()));
        }
    }

    let result = sqlx::query("DELETE FROM meetings WHERE id = ?")
        .bind(meeting_id)
        .execute(&mut *transaction)
        .await?;
    info!("Deleted meeting {} rows: [{}]", meeting_id, affected.join(", "));

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
        let mut deadline_queue = queue(0, 3, 1, 1, 1);
        deadline_queue.cancelled = 1;
        FinalizeMeetingInput {
            meeting_id,
            capture_closed: true,
            durable_writes_succeeded: false,
            queue: deadline_queue,
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

#[cfg(test)]
mod meeting_recovery_repository_tests {
    use super::{MeetingsRepository, RecoveryRepositoryError};
    use crate::database::models::{
        CaptureCompleteness, GapFact, MeetingCompleteness, MeetingLifecycle, RecoveryRequest,
        TranscriptEvidenceInput,
    };
    use crate::database::repositories::transcript::TranscriptsRepository;
    use sqlx::{sqlite::SqlitePoolOptions, Row, SqlitePool};
    use uuid::Uuid;

    async fn recovery_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("in-memory recovery database");
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("fresh recovery migrations");
        pool
    }

    async fn concurrent_recovery_pool() -> SqlitePool {
        let directory = tempfile::tempdir().expect("recovery database directory");
        let path = directory.keep().join("meeting-recovery.sqlite");
        let url = format!("sqlite://{}?mode=rwc", path.display());
        let pool = SqlitePoolOptions::new()
            .max_connections(4)
            .connect(&url)
            .await
            .expect("concurrent recovery database");
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("fresh recovery migrations");
        pool
    }

    fn evidence(meeting_id: &str, evidence_id: &str, source_key: &str) -> TranscriptEvidenceInput {
        TranscriptEvidenceInput {
            evidence_id: evidence_id.to_string(),
            meeting_id: meeting_id.to_string(),
            source_track: "mixed".to_string(),
            source_segment_key: source_key.to_string(),
            sequence: 1,
            transcript: "durable final".to_string(),
            audio_start_time: 1.25,
            audio_end_time: 2.5,
            capture_completeness: CaptureCompleteness::Complete,
        }
    }

    fn gap(meeting_id: &str, gap_id: &str) -> GapFact {
        GapFact {
            gap_id: gap_id.to_string(),
            meeting_id: meeting_id.to_string(),
            gap_kind: "transcript_interval".to_string(),
            reason_code: "device_lost".to_string(),
            audio_start_ms: Some(2_500),
            audio_end_ms: Some(3_000),
        }
    }

    #[tokio::test]
    async fn meeting_recovery_repository_reuses_canonical_meeting_and_evidence_ids() {
        let pool = recovery_pool().await;
        let meeting = MeetingsRepository::create_session(&pool, "Interrupted review")
            .await
            .expect("canonical meeting");
        let evidence_id = Uuid::new_v4().to_string();
        let staged_evidence = evidence(&meeting.meeting_id, &evidence_id, "segment-1");
        TranscriptsRepository::upsert_final_evidence(&pool, &staged_evidence)
            .await
            .expect("already durable final evidence");

        let result = MeetingsRepository::reconcile_meeting(
            &pool,
            &RecoveryRequest {
                meeting_id: meeting.meeting_id.clone(),
                evidence: vec![staged_evidence],
                gaps: vec![gap(&meeting.meeting_id, "gap-device-1")],
            },
        )
        .await;

        assert!(result.is_ok(), "same-ID recovery must reconcile in place");
        let result = result.unwrap();
        assert_eq!(result.meeting_id, meeting.meeting_id);
        assert_eq!(result.lifecycle, MeetingLifecycle::Recovered);
        assert_eq!(result.completeness, MeetingCompleteness::RecoveredWithGaps);
        let meeting_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM meetings")
            .fetch_one(&pool)
            .await
            .unwrap();
        let evidence_row = sqlx::query(
            "SELECT evidence_id, meeting_id FROM transcript_evidence WHERE evidence_id = ?",
        )
        .bind(&evidence_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(meeting_count, 1);
        assert_eq!(evidence_row.get::<String, _>("evidence_id"), evidence_id);
        assert_eq!(
            evidence_row.get::<String, _>("meeting_id"),
            result.meeting_id
        );
    }

    #[tokio::test]
    async fn meeting_recovery_repository_repeat_preserves_ids_counts_and_result() {
        let pool = recovery_pool().await;
        let meeting = MeetingsRepository::create_session(&pool, "Repeated recovery")
            .await
            .unwrap();
        let evidence_id = Uuid::new_v4().to_string();
        let request = RecoveryRequest {
            meeting_id: meeting.meeting_id.clone(),
            evidence: vec![evidence(
                &meeting.meeting_id,
                &evidence_id,
                "segment-repeat",
            )],
            gaps: vec![gap(&meeting.meeting_id, "gap-repeat")],
        };

        let first = MeetingsRepository::reconcile_meeting(&pool, &request)
            .await
            .expect("first recovery");
        let repeated = MeetingsRepository::reconcile_meeting(&pool, &request)
            .await
            .expect("repeated recovery");

        assert_eq!(repeated, first);
        assert_eq!(repeated.evidence_count, 1);
        assert_eq!(repeated.gap_count, 2);
        assert_eq!(repeated.gaps[0].gap_id, "gap-repeat");
        let meeting_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM meetings")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(meeting_count, 1);
    }

    #[tokio::test]
    async fn meeting_recovery_repository_interruption_rolls_back_then_resumes_same_ids() {
        let pool = recovery_pool().await;
        let target = MeetingsRepository::create_session(&pool, "Recovery target")
            .await
            .unwrap();
        let other = MeetingsRepository::create_session(&pool, "Other meeting")
            .await
            .unwrap();
        let conflicting_id = Uuid::new_v4().to_string();
        TranscriptsRepository::upsert_final_evidence(
            &pool,
            &evidence(&other.meeting_id, &conflicting_id, "other-segment"),
        )
        .await
        .unwrap();
        let new_id = Uuid::new_v4().to_string();
        let interrupted = RecoveryRequest {
            meeting_id: target.meeting_id.clone(),
            evidence: vec![
                evidence(&target.meeting_id, &new_id, "target-new"),
                evidence(&target.meeting_id, &conflicting_id, "target-conflict"),
            ],
            gaps: vec![gap(&target.meeting_id, "gap-after-write")],
        };

        let error = MeetingsRepository::reconcile_meeting(&pool, &interrupted)
            .await
            .expect_err("cross-meeting stable ID must abort the transaction");
        assert!(matches!(
            error,
            RecoveryRepositoryError::CrossMeetingScope | RecoveryRepositoryError::IdentityConflict
        ));
        let rolled_back: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM transcript_evidence WHERE evidence_id = ?")
                .bind(&new_id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(rolled_back, 0, "the earlier insert must roll back");

        let resumed = RecoveryRequest {
            meeting_id: target.meeting_id.clone(),
            evidence: vec![evidence(&target.meeting_id, &new_id, "target-new")],
            gaps: vec![gap(&target.meeting_id, "gap-after-write")],
        };
        let result = MeetingsRepository::reconcile_meeting(&pool, &resumed)
            .await
            .expect("same IDs must succeed after interrupted rollback");
        assert_eq!(result.meeting_id, target.meeting_id);
        assert_eq!(result.evidence_count, 1);
        assert_eq!(
            result.gap_count, 2,
            "active interruption retains uncertain tail"
        );
    }

    #[tokio::test]
    async fn meeting_recovery_repository_concurrent_attempts_serialize_and_cross_scope_is_rejected()
    {
        let pool = concurrent_recovery_pool().await;
        let meeting = MeetingsRepository::create_session(&pool, "Concurrent recovery")
            .await
            .unwrap();
        let evidence_id = Uuid::new_v4().to_string();
        let request = RecoveryRequest {
            meeting_id: meeting.meeting_id.clone(),
            evidence: vec![evidence(&meeting.meeting_id, &evidence_id, "segment-race")],
            gaps: vec![gap(&meeting.meeting_id, "gap-race")],
        };

        let first_pool = pool.clone();
        let first_request = request.clone();
        let first = tokio::spawn(async move {
            MeetingsRepository::reconcile_meeting(&first_pool, &first_request).await
        });
        let second_pool = pool.clone();
        let second_request = request.clone();
        let second = tokio::spawn(async move {
            MeetingsRepository::reconcile_meeting(&second_pool, &second_request).await
        });
        let (first, second) = tokio::join!(first, second);
        let first = first.unwrap().expect("first serialized recovery");
        let second = second.unwrap().expect("second serialized recovery");
        assert_eq!(first, second);

        let evidence_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM transcript_evidence WHERE meeting_id = ?")
                .bind(&meeting.meeting_id)
                .fetch_one(&pool)
                .await
                .unwrap();
        let gap_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM meeting_finalization_gaps WHERE meeting_id = ?",
        )
        .bind(&meeting.meeting_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!((evidence_count, gap_count), (1, 2));

        let other = MeetingsRepository::create_session(&pool, "Cross scoped")
            .await
            .unwrap();
        let invalid = RecoveryRequest {
            meeting_id: meeting.meeting_id.clone(),
            evidence: vec![evidence(
                &other.meeting_id,
                &Uuid::new_v4().to_string(),
                "wrong",
            )],
            gaps: Vec::new(),
        };
        let error = MeetingsRepository::reconcile_meeting(&pool, &invalid)
            .await
            .expect_err("cross-meeting payload must be rejected");
        assert!(matches!(error, RecoveryRepositoryError::CrossMeetingScope));
    }
}
