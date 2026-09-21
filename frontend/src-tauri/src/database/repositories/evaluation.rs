//! Durable, content-redacted evaluation evidence for one canonical meeting run.

use crate::audio::transcription::QueueSnapshot;
use crate::database::repositories::meeting::FinalizationGapInput;
use crate::observability::{Observation, PowerSource, ResourceSample, StageRecord, UnknownReason};
use crate::trust::outbound::{OutboundAttempt, OutboundRoute};
use crate::trust::provider_route::EffectiveRoute;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Error as SqlxError, Row, Sqlite, SqlitePool, Transaction};
use std::hash::{Hash, Hasher};

pub const EVALUATION_SCHEMA_VERSION: u16 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EvaluationRunManifest {
    pub schema_version: u16,
    pub run_id: String,
    pub meeting_id: String,
    pub scenario_version: String,
    pub started_at_utc: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EvaluationQueueRecord {
    pub run_id: String,
    pub sequence: u64,
    pub observed_offset_micros: u64,
    pub observed_at_utc: DateTime<Utc>,
    pub snapshot: QueueSnapshot,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EvaluationRouteRecord {
    pub run_id: String,
    pub meeting_id: String,
    pub sequence: u64,
    pub observed_offset_micros: u64,
    pub observed_at_utc: DateTime<Utc>,
    pub route: EffectiveRoute,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EvaluationOutboundRecord {
    pub run_id: String,
    pub sequence: u64,
    pub source_run_id: String,
    pub meeting_id: Option<String>,
    pub observed_offset_micros: u64,
    pub observed_at_utc: DateTime<Utc>,
    pub route: OutboundRoute,
    pub disposition: crate::trust::outbound::OutboundDisposition,
    pub redacted_code: Option<String>,
}

impl EvaluationOutboundRecord {
    pub fn from_attempt(run_id: impl Into<String>, attempt: OutboundAttempt) -> Self {
        Self {
            run_id: run_id.into(),
            sequence: attempt.sequence,
            source_run_id: attempt.run_id,
            meeting_id: attempt.meeting_id,
            observed_offset_micros: attempt.monotonic_offset_ns / 1_000,
            observed_at_utc: attempt.observed_at_utc,
            route: attempt.route,
            disposition: attempt.disposition,
            redacted_code: attempt.redacted_code,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EvaluationErrorRecord {
    pub run_id: String,
    pub sequence: u64,
    pub observed_offset_micros: u64,
    pub observed_at_utc: DateTime<Utc>,
    pub component: String,
    pub redacted_code: String,
    pub work_id: Option<String>,
    pub evidence_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "recordType", rename_all = "snake_case")]
pub enum EvaluationRecord {
    Stage(StageRecord),
    Queue(EvaluationQueueRecord),
    Resource(ResourceSample),
    Route(EvaluationRouteRecord),
    Outbound(EvaluationOutboundRecord),
    Error(EvaluationErrorRecord),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppendBatchResult {
    pub attempted: usize,
    pub inserted: usize,
    pub already_present: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EvaluationTerminalRunInput {
    pub run_id: String,
    pub meeting_id: String,
    pub observed_offset_micros: u64,
    pub observed_at_utc: DateTime<Utc>,
    pub lifecycle: String,
    pub deadline_at_utc: String,
    pub deadline_ms: u64,
    pub remaining_work_count: u64,
    pub queue: QueueSnapshot,
    pub stages: Vec<StageRecord>,
    pub resources: Vec<ResourceSample>,
    pub routes: Vec<EvaluationRouteRecord>,
    pub outbound: Vec<EvaluationOutboundRecord>,
    pub gaps: Vec<FinalizationGapInput>,
    pub errors: Vec<EvaluationErrorRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EvaluationTerminalPersistResult {
    pub raw_records_inserted: usize,
    pub raw_records_already_present: usize,
    pub summary_written: bool,
    pub aggregation_error_code: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
struct EvaluationEvidenceCommit {
    run_id: String,
    sequence: u64,
    evidence_id: String,
    committed_at_utc: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
struct EvaluationGapRecord {
    run_id: String,
    sequence: u64,
    gap: FinalizationGapInput,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
struct EvaluationTerminalRecord {
    run_id: String,
    sequence: u64,
    meeting_id: String,
    observed_offset_micros: u64,
    observed_at_utc: DateTime<Utc>,
    lifecycle: String,
    deadline_at_utc: String,
    deadline_ms: u64,
    remaining_work_count: u64,
    gap_count: u64,
    error_count: u64,
}

#[derive(Debug, thiserror::Error)]
pub enum EvaluationRepositoryError {
    #[error("invalid evaluation record")]
    InvalidRecord,
    #[error("evaluation record conflicts with durable evidence")]
    IdentityConflict,
    #[error("evaluation storage failed")]
    Storage(#[from] SqlxError),
}

impl EvaluationRepositoryError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidRecord => "EVALUATION_INVALID_RECORD",
            Self::IdentityConflict => "EVALUATION_IDENTITY_CONFLICT",
            Self::Storage(_) => "EVALUATION_STORAGE_FAILED",
        }
    }
}

pub struct EvaluationRepository;

impl EvaluationRepository {
    pub async fn append_error_for_meeting(
        pool: &SqlitePool,
        meeting_id: &str,
        component: &str,
        redacted_code: &str,
        work_id: Option<String>,
        evidence_id: Option<String>,
    ) -> Result<AppendBatchResult, EvaluationRepositoryError> {
        let run_id = run_id_for_meeting(pool, meeting_id).await?;
        let sequence = next_error_sequence(pool, &run_id).await?;
        Self::append_batch(
            pool,
            &run_id,
            &[EvaluationRecord::Error(EvaluationErrorRecord {
                run_id: run_id.clone(),
                sequence,
                observed_offset_micros: 0,
                observed_at_utc: Utc::now(),
                component: component.to_string(),
                redacted_code: redacted_code.to_string(),
                work_id,
                evidence_id,
            })],
        )
        .await
    }

    pub async fn append_committed_evidence(
        pool: &SqlitePool,
        meeting_id: &str,
        evidence_id: &str,
        sequence: u64,
        committed_at_utc: DateTime<Utc>,
    ) -> Result<AppendBatchResult, EvaluationRepositoryError> {
        validate_safe_identifier(meeting_id)?;
        validate_safe_identifier(evidence_id)?;
        let run_id = run_id_for_meeting(pool, meeting_id).await?;
        let record = EvaluationEvidenceCommit {
            run_id,
            sequence,
            evidence_id: evidence_id.to_string(),
            committed_at_utc,
        };
        let mut transaction = pool.begin_with("BEGIN IMMEDIATE").await?;
        let product_commit_exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM transcript_evidence
             WHERE evidence_id = ? AND meeting_id = ? AND sequence = ?",
        )
        .bind(evidence_id)
        .bind(meeting_id)
        .bind(to_i64(sequence)?)
        .fetch_one(&mut *transaction)
        .await?;
        if product_commit_exists != 1 {
            transaction.rollback().await?;
            return Err(EvaluationRepositoryError::InvalidRecord);
        }
        let outcome = append_evidence_commit(&mut transaction, &record).await?;
        transaction.commit().await?;
        Ok(AppendBatchResult {
            attempted: 1,
            inserted: usize::from(outcome == AppendOutcome::Inserted),
            already_present: usize::from(outcome == AppendOutcome::AlreadyPresent),
        })
    }

    pub async fn persist_terminal_run(
        pool: &SqlitePool,
        input: &EvaluationTerminalRunInput,
    ) -> Result<EvaluationTerminalPersistResult, EvaluationRepositoryError> {
        validate_terminal_input(input)?;
        let mut transaction = pool.begin_with("BEGIN IMMEDIATE").await?;
        verify_run_identity(&mut transaction, &input.run_id, &input.meeting_id).await?;

        let mut result = AppendBatchResult {
            attempted: 0,
            inserted: 0,
            already_present: 0,
        };
        let mut records = Vec::with_capacity(
            input.stages.len()
                + input.resources.len()
                + input.routes.len()
                + input.outbound.len()
                + input.errors.len()
                + 1,
        );
        records.extend(input.stages.iter().cloned().map(EvaluationRecord::Stage));
        records.push(EvaluationRecord::Queue(EvaluationQueueRecord {
            run_id: input.run_id.clone(),
            sequence: 0,
            observed_offset_micros: input.observed_offset_micros,
            observed_at_utc: input.observed_at_utc,
            snapshot: input.queue.clone(),
        }));
        records.extend(
            input
                .resources
                .iter()
                .cloned()
                .map(EvaluationRecord::Resource),
        );
        records.extend(input.routes.iter().cloned().map(EvaluationRecord::Route));
        records.extend(
            input
                .outbound
                .iter()
                .cloned()
                .map(EvaluationRecord::Outbound),
        );
        records.extend(input.errors.iter().cloned().map(EvaluationRecord::Error));

        for record in &records {
            validate_record_run_id(record, &input.run_id)?;
            result.attempted += 1;
            accumulate_outcome(&mut result, append_record(&mut transaction, record).await?);
        }
        for (sequence, gap) in input.gaps.iter().enumerate() {
            let record = EvaluationGapRecord {
                run_id: input.run_id.clone(),
                sequence: u64::try_from(sequence)
                    .map_err(|_| EvaluationRepositoryError::InvalidRecord)?,
                gap: gap.clone(),
            };
            result.attempted += 1;
            accumulate_outcome(
                &mut result,
                append_gap_record(&mut transaction, &record).await?,
            );
        }
        let terminal = EvaluationTerminalRecord {
            run_id: input.run_id.clone(),
            sequence: 0,
            meeting_id: input.meeting_id.clone(),
            observed_offset_micros: input.observed_offset_micros,
            observed_at_utc: input.observed_at_utc,
            lifecycle: input.lifecycle.clone(),
            deadline_at_utc: input.deadline_at_utc.clone(),
            deadline_ms: input.deadline_ms,
            remaining_work_count: input.remaining_work_count,
            gap_count: u64::try_from(input.gaps.len())
                .map_err(|_| EvaluationRepositoryError::InvalidRecord)?,
            error_count: u64::try_from(input.errors.len())
                .map_err(|_| EvaluationRepositoryError::InvalidRecord)?,
        };
        result.attempted += 1;
        accumulate_outcome(
            &mut result,
            append_terminal_record(&mut transaction, &terminal).await?,
        );
        transaction.commit().await?;

        match write_summary_aggregate(pool, &input.run_id).await {
            Ok(()) => Ok(EvaluationTerminalPersistResult {
                raw_records_inserted: result.inserted,
                raw_records_already_present: result.already_present,
                summary_written: true,
                aggregation_error_code: None,
            }),
            Err(_error) => {
                let next_sequence = next_error_sequence(pool, &input.run_id).await?;
                let aggregation_error = EvaluationErrorRecord {
                    run_id: input.run_id.clone(),
                    sequence: next_sequence,
                    observed_offset_micros: input.observed_offset_micros,
                    observed_at_utc: input.observed_at_utc,
                    component: "evaluation_summary".to_string(),
                    redacted_code: "SUMMARY_AGGREGATION_FAILED".to_string(),
                    work_id: None,
                    evidence_id: None,
                };
                Self::append_batch(
                    pool,
                    &input.run_id,
                    &[EvaluationRecord::Error(aggregation_error)],
                )
                .await?;
                Ok(EvaluationTerminalPersistResult {
                    raw_records_inserted: result.inserted,
                    raw_records_already_present: result.already_present,
                    summary_written: false,
                    aggregation_error_code: Some("SUMMARY_AGGREGATION_FAILED".to_string()),
                })
            }
        }
    }

    pub async fn create_run(
        pool: &SqlitePool,
        manifest: &EvaluationRunManifest,
    ) -> Result<EvaluationRunManifest, EvaluationRepositoryError> {
        validate_manifest(manifest)?;
        let mut transaction = pool.begin().await?;
        sqlx::query(
            "INSERT INTO evaluation_runs (
                run_id, schema_version, meeting_id, scenario_version,
                started_at_utc, created_at_utc
             ) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(run_id) DO NOTHING",
        )
        .bind(&manifest.run_id)
        .bind(i64::from(manifest.schema_version))
        .bind(&manifest.meeting_id)
        .bind(&manifest.scenario_version)
        .bind(manifest.started_at_utc.to_rfc3339())
        .bind(Utc::now().to_rfc3339())
        .execute(&mut *transaction)
        .await?;

        let row = sqlx::query(
            "SELECT schema_version, run_id, meeting_id, scenario_version, started_at_utc
             FROM evaluation_runs WHERE run_id = ?",
        )
        .bind(&manifest.run_id)
        .fetch_one(&mut *transaction)
        .await?;
        let persisted = EvaluationRunManifest {
            schema_version: u16::try_from(row.get::<i64, _>("schema_version"))
                .map_err(|_| EvaluationRepositoryError::InvalidRecord)?,
            run_id: row.get("run_id"),
            meeting_id: row.get("meeting_id"),
            scenario_version: row.get("scenario_version"),
            started_at_utc: parse_utc(row.get::<String, _>("started_at_utc"))?,
        };
        if &persisted != manifest {
            transaction.rollback().await?;
            return Err(EvaluationRepositoryError::IdentityConflict);
        }
        transaction.commit().await?;
        Ok(persisted)
    }

    pub async fn append_batch(
        pool: &SqlitePool,
        run_id: &str,
        records: &[EvaluationRecord],
    ) -> Result<AppendBatchResult, EvaluationRepositoryError> {
        validate_safe_identifier(run_id)?;
        let mut transaction = pool.begin_with("BEGIN IMMEDIATE").await?;
        let run_exists =
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM evaluation_runs WHERE run_id = ?")
                .bind(run_id)
                .fetch_one(&mut *transaction)
                .await?;
        if run_exists != 1 {
            transaction.rollback().await?;
            return Err(EvaluationRepositoryError::InvalidRecord);
        }

        let mut result = AppendBatchResult {
            attempted: records.len(),
            inserted: 0,
            already_present: 0,
        };
        for record in records {
            validate_record_run_id(record, run_id)?;
            match append_record(&mut transaction, record).await? {
                AppendOutcome::Inserted => result.inserted += 1,
                AppendOutcome::AlreadyPresent => result.already_present += 1,
            }
        }
        transaction.commit().await?;
        Ok(result)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AppendOutcome {
    Inserted,
    AlreadyPresent,
}

fn accumulate_outcome(result: &mut AppendBatchResult, outcome: AppendOutcome) {
    match outcome {
        AppendOutcome::Inserted => result.inserted += 1,
        AppendOutcome::AlreadyPresent => result.already_present += 1,
    }
}

async fn run_id_for_meeting(
    pool: &SqlitePool,
    meeting_id: &str,
) -> Result<String, EvaluationRepositoryError> {
    sqlx::query_scalar("SELECT run_id FROM evaluation_runs WHERE meeting_id = ?")
        .bind(meeting_id)
        .fetch_optional(pool)
        .await?
        .ok_or(EvaluationRepositoryError::InvalidRecord)
}

async fn verify_run_identity(
    transaction: &mut Transaction<'_, Sqlite>,
    run_id: &str,
    meeting_id: &str,
) -> Result<(), EvaluationRepositoryError> {
    let count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM evaluation_runs WHERE run_id = ? AND meeting_id = ?",
    )
    .bind(run_id)
    .bind(meeting_id)
    .fetch_one(&mut **transaction)
    .await?;
    if count != 1 {
        return Err(EvaluationRepositoryError::IdentityConflict);
    }
    Ok(())
}

fn validate_terminal_input(
    input: &EvaluationTerminalRunInput,
) -> Result<(), EvaluationRepositoryError> {
    validate_safe_identifier(&input.run_id)?;
    validate_safe_identifier(&input.meeting_id)?;
    validate_safe_identifier(&input.lifecycle)?;
    parse_utc(input.deadline_at_utc.clone())?;
    if input.deadline_ms == 0 {
        return Err(EvaluationRepositoryError::InvalidRecord);
    }
    validate_queue(&input.queue)?;
    for stage in &input.stages {
        if stage.run_id != input.run_id || stage.meeting_id != input.meeting_id {
            return Err(EvaluationRepositoryError::IdentityConflict);
        }
    }
    for resource in &input.resources {
        if resource.run_id != input.run_id {
            return Err(EvaluationRepositoryError::IdentityConflict);
        }
    }
    for route in &input.routes {
        if route.run_id != input.run_id || route.meeting_id != input.meeting_id {
            return Err(EvaluationRepositoryError::IdentityConflict);
        }
    }
    for outbound in &input.outbound {
        if outbound.run_id != input.run_id
            || outbound.meeting_id.as_deref() != Some(input.meeting_id.as_str())
        {
            return Err(EvaluationRepositoryError::IdentityConflict);
        }
    }
    for error in &input.errors {
        if error.run_id != input.run_id {
            return Err(EvaluationRepositoryError::IdentityConflict);
        }
    }
    Ok(())
}

async fn append_record(
    transaction: &mut Transaction<'_, Sqlite>,
    record: &EvaluationRecord,
) -> Result<AppendOutcome, EvaluationRepositoryError> {
    match record {
        EvaluationRecord::Stage(record) => append_stage(transaction, record).await,
        EvaluationRecord::Queue(record) => append_queue(transaction, record).await,
        EvaluationRecord::Resource(record) => append_resource(transaction, record).await,
        EvaluationRecord::Route(record) => append_route(transaction, record).await,
        EvaluationRecord::Outbound(record) => append_outbound(transaction, record).await,
        EvaluationRecord::Error(record) => append_error(transaction, record).await,
    }
}

async fn existing_fingerprint(
    transaction: &mut Transaction<'_, Sqlite>,
    table: &str,
    run_id: &str,
    sequence: u64,
) -> Result<Option<String>, EvaluationRepositoryError> {
    let sql = format!("SELECT record_fingerprint FROM {table} WHERE run_id = ? AND sequence = ?");
    Ok(sqlx::query_scalar(&sql)
        .bind(run_id)
        .bind(to_i64(sequence)?)
        .fetch_optional(&mut **transaction)
        .await?)
}

fn checked_existing(
    existing: Option<String>,
    fingerprint: &str,
) -> Result<Option<AppendOutcome>, EvaluationRepositoryError> {
    match existing {
        Some(existing) if existing == fingerprint => Ok(Some(AppendOutcome::AlreadyPresent)),
        Some(_) => Err(EvaluationRepositoryError::IdentityConflict),
        None => Ok(None),
    }
}

async fn append_evidence_commit(
    transaction: &mut Transaction<'_, Sqlite>,
    record: &EvaluationEvidenceCommit,
) -> Result<AppendOutcome, EvaluationRepositoryError> {
    let existing_evidence = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM evaluation_evidence_commits
         WHERE run_id = ? AND evidence_id = ?",
    )
    .bind(&record.run_id)
    .bind(&record.evidence_id)
    .fetch_one(&mut **transaction)
    .await?;
    if existing_evidence == 1 {
        return Ok(AppendOutcome::AlreadyPresent);
    }
    let fingerprint = fingerprint(&(&record.run_id, record.sequence, &record.evidence_id))?;
    if let Some(outcome) = checked_existing(
        existing_fingerprint(
            transaction,
            "evaluation_evidence_commits",
            &record.run_id,
            record.sequence,
        )
        .await?,
        &fingerprint,
    )? {
        return Ok(outcome);
    }
    sqlx::query(
        "INSERT INTO evaluation_evidence_commits (
            run_id, sequence, evidence_id, committed_at_utc, record_fingerprint
         ) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&record.run_id)
    .bind(to_i64(record.sequence)?)
    .bind(&record.evidence_id)
    .bind(record.committed_at_utc.to_rfc3339())
    .bind(fingerprint)
    .execute(&mut **transaction)
    .await?;
    Ok(AppendOutcome::Inserted)
}

async fn append_gap_record(
    transaction: &mut Transaction<'_, Sqlite>,
    record: &EvaluationGapRecord,
) -> Result<AppendOutcome, EvaluationRepositoryError> {
    validate_safe_identifier(&record.gap.work_id)?;
    validate_safe_identifier(&record.gap.gap_kind)?;
    validate_redacted_code(Some(&record.gap.reason_code))?;
    if matches!(
        (record.gap.audio_start_ms, record.gap.audio_end_ms),
        (Some(start), Some(end)) if end < start
    ) {
        return Err(EvaluationRepositoryError::InvalidRecord);
    }
    let fingerprint = fingerprint(record)?;
    if let Some(outcome) = checked_existing(
        existing_fingerprint(
            transaction,
            "evaluation_gap_records",
            &record.run_id,
            record.sequence,
        )
        .await?,
        &fingerprint,
    )? {
        return Ok(outcome);
    }
    sqlx::query(
        "INSERT INTO evaluation_gap_records (
            run_id, sequence, work_id, gap_kind, reason_code,
            audio_start_ms, audio_end_ms, record_fingerprint
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&record.run_id)
    .bind(to_i64(record.sequence)?)
    .bind(&record.gap.work_id)
    .bind(&record.gap.gap_kind)
    .bind(&record.gap.reason_code)
    .bind(optional_i64(record.gap.audio_start_ms)?)
    .bind(optional_i64(record.gap.audio_end_ms)?)
    .bind(fingerprint)
    .execute(&mut **transaction)
    .await?;
    Ok(AppendOutcome::Inserted)
}

async fn append_terminal_record(
    transaction: &mut Transaction<'_, Sqlite>,
    record: &EvaluationTerminalRecord,
) -> Result<AppendOutcome, EvaluationRepositoryError> {
    let fingerprint = fingerprint(record)?;
    if let Some(outcome) = checked_existing(
        existing_fingerprint(
            transaction,
            "evaluation_terminal_records",
            &record.run_id,
            record.sequence,
        )
        .await?,
        &fingerprint,
    )? {
        return Ok(outcome);
    }
    sqlx::query(
        "INSERT INTO evaluation_terminal_records (
            run_id, sequence, meeting_id, observed_offset_micros, observed_at_utc,
            lifecycle, deadline_at_utc, deadline_ms, remaining_work_count,
            gap_count, error_count, record_fingerprint
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&record.run_id)
    .bind(to_i64(record.sequence)?)
    .bind(&record.meeting_id)
    .bind(to_i64(record.observed_offset_micros)?)
    .bind(record.observed_at_utc.to_rfc3339())
    .bind(&record.lifecycle)
    .bind(&record.deadline_at_utc)
    .bind(to_i64(record.deadline_ms)?)
    .bind(to_i64(record.remaining_work_count)?)
    .bind(to_i64(record.gap_count)?)
    .bind(to_i64(record.error_count)?)
    .bind(fingerprint)
    .execute(&mut **transaction)
    .await?;
    Ok(AppendOutcome::Inserted)
}

async fn write_summary_aggregate(
    pool: &SqlitePool,
    run_id: &str,
) -> Result<(), EvaluationRepositoryError> {
    let mut transaction = pool.begin().await?;
    let tables = [
        "evaluation_stage_records",
        "evaluation_queue_records",
        "evaluation_resource_records",
        "evaluation_route_records",
        "evaluation_outbound_records",
        "evaluation_error_records",
        "evaluation_evidence_commits",
        "evaluation_gap_records",
        "evaluation_terminal_records",
    ];
    let mut counts = Vec::with_capacity(tables.len());
    for table in tables {
        let sql = format!("SELECT COUNT(*) FROM {table} WHERE run_id = ?");
        counts.push(
            sqlx::query_scalar::<_, i64>(&sql)
                .bind(run_id)
                .fetch_one(&mut *transaction)
                .await?,
        );
    }
    sqlx::query(
        "INSERT INTO evaluation_run_summaries (
            run_id, stage_count, queue_count, resource_count, route_count,
            outbound_count, error_count, evidence_count, gap_count,
            terminal_count, aggregated_at_utc
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(run_id) DO UPDATE SET
            stage_count = excluded.stage_count,
            queue_count = excluded.queue_count,
            resource_count = excluded.resource_count,
            route_count = excluded.route_count,
            outbound_count = excluded.outbound_count,
            error_count = excluded.error_count,
            evidence_count = excluded.evidence_count,
            gap_count = excluded.gap_count,
            terminal_count = excluded.terminal_count,
            aggregated_at_utc = excluded.aggregated_at_utc",
    )
    .bind(run_id)
    .bind(counts[0])
    .bind(counts[1])
    .bind(counts[2])
    .bind(counts[3])
    .bind(counts[4])
    .bind(counts[5])
    .bind(counts[6])
    .bind(counts[7])
    .bind(counts[8])
    .bind(Utc::now().to_rfc3339())
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(())
}

async fn next_error_sequence(
    pool: &SqlitePool,
    run_id: &str,
) -> Result<u64, EvaluationRepositoryError> {
    let current = sqlx::query_scalar::<_, Option<i64>>(
        "SELECT MAX(sequence) FROM evaluation_error_records WHERE run_id = ?",
    )
    .bind(run_id)
    .fetch_one(pool)
    .await?
    .unwrap_or(-1);
    u64::try_from(current.saturating_add(1)).map_err(|_| EvaluationRepositoryError::InvalidRecord)
}

async fn append_stage(
    transaction: &mut Transaction<'_, Sqlite>,
    record: &StageRecord,
) -> Result<AppendOutcome, EvaluationRepositoryError> {
    validate_safe_identifier(&record.run_id)?;
    validate_safe_identifier(&record.meeting_id)?;
    validate_safe_identifier(&record.work_id)?;
    validate_safe_identifier(&record.evidence_id)?;
    let fingerprint = fingerprint(record)?;
    if let Some(outcome) = checked_existing(
        existing_fingerprint(
            transaction,
            "evaluation_stage_records",
            &record.run_id,
            record.sequence,
        )
        .await?,
        &fingerprint,
    )? {
        return Ok(outcome);
    }
    sqlx::query(
        "INSERT INTO evaluation_stage_records (
            run_id, sequence, schema_version, meeting_id, work_id, evidence_id,
            stage_name, observed_offset_micros, observed_at_utc, record_fingerprint
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&record.run_id)
    .bind(to_i64(record.sequence)?)
    .bind(i64::from(record.schema_version))
    .bind(&record.meeting_id)
    .bind(&record.work_id)
    .bind(&record.evidence_id)
    .bind(serialized_name(&record.stage)?)
    .bind(to_i64(record.offset_micros)?)
    .bind(record.observed_at_utc.to_rfc3339())
    .bind(fingerprint)
    .execute(&mut **transaction)
    .await?;
    Ok(AppendOutcome::Inserted)
}

async fn append_queue(
    transaction: &mut Transaction<'_, Sqlite>,
    record: &EvaluationQueueRecord,
) -> Result<AppendOutcome, EvaluationRepositoryError> {
    validate_queue(&record.snapshot)?;
    let fingerprint = fingerprint(record)?;
    if let Some(outcome) = checked_existing(
        existing_fingerprint(
            transaction,
            "evaluation_queue_records",
            &record.run_id,
            record.sequence,
        )
        .await?,
        &fingerprint,
    )? {
        return Ok(outcome);
    }
    let queue = &record.snapshot;
    sqlx::query(
        "INSERT INTO evaluation_queue_records (
            run_id, sequence, observed_offset_micros, observed_at_utc,
            capacity, depth, active, oldest_age_ms, accepted, started,
            completed, failed, cancelled, superseded, rejected, record_fingerprint
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&record.run_id)
    .bind(to_i64(record.sequence)?)
    .bind(to_i64(record.observed_offset_micros)?)
    .bind(record.observed_at_utc.to_rfc3339())
    .bind(to_i64(queue.capacity as u64)?)
    .bind(to_i64(queue.depth)?)
    .bind(to_i64(queue.active)?)
    .bind(optional_i64(queue.oldest_age_ms)?)
    .bind(to_i64(queue.accepted)?)
    .bind(to_i64(queue.started)?)
    .bind(to_i64(queue.completed)?)
    .bind(to_i64(queue.failed)?)
    .bind(to_i64(queue.cancelled)?)
    .bind(to_i64(queue.superseded)?)
    .bind(to_i64(queue.rejected)?)
    .bind(fingerprint)
    .execute(&mut **transaction)
    .await?;
    Ok(AppendOutcome::Inserted)
}

async fn append_resource(
    transaction: &mut Transaction<'_, Sqlite>,
    record: &ResourceSample,
) -> Result<AppendOutcome, EvaluationRepositoryError> {
    validate_resource(record)?;
    let fingerprint = fingerprint(record)?;
    if let Some(outcome) = checked_existing(
        existing_fingerprint(
            transaction,
            "evaluation_resource_records",
            &record.run_id,
            record.sequence,
        )
        .await?,
        &fingerprint,
    )? {
        return Ok(outcome);
    }
    let (source_status, source_value, source_reason) = power_source_columns(&record.power.source)?;
    let (battery_status, battery_percent, battery_reason) =
        number_columns(&record.power.battery_percent)?;
    let (energy_status, energy_impact, energy_reason) =
        number_columns(&record.power.energy_impact)?;
    sqlx::query(
        "INSERT INTO evaluation_resource_records (
            run_id, sequence, schema_version, interval_ms, observed_offset_micros,
            observed_at_utc, process_cpu_percent, process_memory_bytes,
            system_cpu_percent, system_memory_bytes, system_total_memory_bytes,
            power_collector, power_method, power_source_status, power_source_value,
            power_source_unknown_reason, battery_status, battery_percent,
            battery_unknown_reason, energy_status, energy_impact,
            energy_unknown_reason, uncertainty, record_fingerprint
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&record.run_id)
    .bind(to_i64(record.sequence)?)
    .bind(i64::from(record.schema_version))
    .bind(to_i64(record.interval_ms)?)
    .bind(to_i64(record.observed_offset_micros)?)
    .bind(record.observed_at_utc.to_rfc3339())
    .bind(record.process.cpu_percent)
    .bind(to_i64(record.process.memory_bytes)?)
    .bind(record.system.cpu_percent)
    .bind(to_i64(record.system.memory_bytes)?)
    .bind(optional_i64(record.system.total_memory_bytes)?)
    .bind(&record.power.collector)
    .bind(&record.power.method)
    .bind(source_status)
    .bind(source_value)
    .bind(source_reason)
    .bind(battery_status)
    .bind(battery_percent)
    .bind(battery_reason)
    .bind(energy_status)
    .bind(energy_impact)
    .bind(energy_reason)
    .bind(&record.power.uncertainty)
    .bind(fingerprint)
    .execute(&mut **transaction)
    .await?;
    Ok(AppendOutcome::Inserted)
}

async fn append_route(
    transaction: &mut Transaction<'_, Sqlite>,
    record: &EvaluationRouteRecord,
) -> Result<AppendOutcome, EvaluationRepositoryError> {
    validate_route(&record.route)?;
    let fingerprint = fingerprint(record)?;
    if let Some(outcome) = checked_existing(
        existing_fingerprint(
            transaction,
            "evaluation_route_records",
            &record.run_id,
            record.sequence,
        )
        .await?,
        &fingerprint,
    )? {
        return Ok(outcome);
    }
    sqlx::query(
        "INSERT INTO evaluation_route_records (
            run_id, sequence, meeting_id, observed_offset_micros, observed_at_utc,
            capability, provider_id, model_id, location_class, sanitized_origin,
            encrypted, validation_state, resolved_addresses, record_fingerprint
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&record.run_id)
    .bind(to_i64(record.sequence)?)
    .bind(&record.meeting_id)
    .bind(to_i64(record.observed_offset_micros)?)
    .bind(record.observed_at_utc.to_rfc3339())
    .bind(serialized_name(&record.route.capability)?)
    .bind(&record.route.provider_id)
    .bind(&record.route.model_id)
    .bind(optional_serialized_name(
        record.route.location_class.as_ref(),
    )?)
    .bind(&record.route.sanitized_origin)
    .bind(record.route.encrypted)
    .bind(serialized_name(&record.route.validation_state)?)
    .bind(record.route.resolved_addresses.join(","))
    .bind(fingerprint)
    .execute(&mut **transaction)
    .await?;
    Ok(AppendOutcome::Inserted)
}

async fn append_outbound(
    transaction: &mut Transaction<'_, Sqlite>,
    record: &EvaluationOutboundRecord,
) -> Result<AppendOutcome, EvaluationRepositoryError> {
    validate_safe_identifier(&record.source_run_id)?;
    validate_redacted_code(record.redacted_code.as_deref())?;
    let fingerprint = fingerprint(record)?;
    if let Some(outcome) = checked_existing(
        existing_fingerprint(
            transaction,
            "evaluation_outbound_records",
            &record.run_id,
            record.sequence,
        )
        .await?,
        &fingerprint,
    )? {
        return Ok(outcome);
    }
    sqlx::query(
        "INSERT INTO evaluation_outbound_records (
            run_id, sequence, source_run_id, meeting_id, observed_offset_micros,
            observed_at_utc, capability, provider_id, model_id, location_class,
            sanitized_origin, encrypted, validation_state, resolved_addresses,
            disposition, redacted_code, record_fingerprint
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&record.run_id)
    .bind(to_i64(record.sequence)?)
    .bind(&record.source_run_id)
    .bind(&record.meeting_id)
    .bind(to_i64(record.observed_offset_micros)?)
    .bind(record.observed_at_utc.to_rfc3339())
    .bind(serialized_name(&record.route.capability)?)
    .bind(&record.route.provider_id)
    .bind(&record.route.model_id)
    .bind(serialized_name(&record.route.location_class)?)
    .bind(&record.route.sanitized_origin)
    .bind(record.route.encrypted)
    .bind(serialized_name(&record.route.validation_state)?)
    .bind(record.route.resolved_addresses.join(","))
    .bind(serialized_name(&record.disposition)?)
    .bind(&record.redacted_code)
    .bind(fingerprint)
    .execute(&mut **transaction)
    .await?;
    Ok(AppendOutcome::Inserted)
}

async fn append_error(
    transaction: &mut Transaction<'_, Sqlite>,
    record: &EvaluationErrorRecord,
) -> Result<AppendOutcome, EvaluationRepositoryError> {
    validate_safe_identifier(&record.component)?;
    validate_redacted_code(Some(&record.redacted_code))?;
    let fingerprint = fingerprint(record)?;
    if let Some(outcome) = checked_existing(
        existing_fingerprint(
            transaction,
            "evaluation_error_records",
            &record.run_id,
            record.sequence,
        )
        .await?,
        &fingerprint,
    )? {
        return Ok(outcome);
    }
    sqlx::query(
        "INSERT INTO evaluation_error_records (
            run_id, sequence, observed_offset_micros, observed_at_utc,
            component, redacted_code, work_id, evidence_id, record_fingerprint
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&record.run_id)
    .bind(to_i64(record.sequence)?)
    .bind(to_i64(record.observed_offset_micros)?)
    .bind(record.observed_at_utc.to_rfc3339())
    .bind(&record.component)
    .bind(&record.redacted_code)
    .bind(&record.work_id)
    .bind(&record.evidence_id)
    .bind(fingerprint)
    .execute(&mut **transaction)
    .await?;
    Ok(AppendOutcome::Inserted)
}

fn validate_manifest(manifest: &EvaluationRunManifest) -> Result<(), EvaluationRepositoryError> {
    if manifest.schema_version != EVALUATION_SCHEMA_VERSION {
        return Err(EvaluationRepositoryError::InvalidRecord);
    }
    validate_safe_identifier(&manifest.run_id)?;
    validate_safe_identifier(&manifest.meeting_id)?;
    validate_safe_identifier(&manifest.scenario_version)
}

fn validate_record_run_id(
    record: &EvaluationRecord,
    expected_run_id: &str,
) -> Result<(), EvaluationRepositoryError> {
    let run_id = match record {
        EvaluationRecord::Stage(record) => &record.run_id,
        EvaluationRecord::Queue(record) => &record.run_id,
        EvaluationRecord::Resource(record) => &record.run_id,
        EvaluationRecord::Route(record) => &record.run_id,
        EvaluationRecord::Outbound(record) => &record.run_id,
        EvaluationRecord::Error(record) => &record.run_id,
    };
    if run_id != expected_run_id {
        return Err(EvaluationRepositoryError::IdentityConflict);
    }
    validate_safe_identifier(run_id)
}

fn validate_queue(snapshot: &QueueSnapshot) -> Result<(), EvaluationRepositoryError> {
    if snapshot.capacity == 0
        || snapshot.active > snapshot.depth
        || snapshot.accepted
            != snapshot.depth
                + snapshot.completed
                + snapshot.failed
                + snapshot.cancelled
                + snapshot.superseded
    {
        return Err(EvaluationRepositoryError::InvalidRecord);
    }
    Ok(())
}

fn validate_resource(record: &ResourceSample) -> Result<(), EvaluationRepositoryError> {
    if record.process.scope != crate::observability::ResourceScope::Process
        || record.system.scope != crate::observability::ResourceScope::System
        || !record.process.cpu_percent.is_finite()
        || record.process.cpu_percent < 0.0
        || !record.system.cpu_percent.is_finite()
        || record.system.cpu_percent < 0.0
    {
        return Err(EvaluationRepositoryError::InvalidRecord);
    }
    validate_safe_identifier(&record.run_id)?;
    validate_safe_label(&record.power.collector)?;
    validate_safe_label(&record.power.method)?;
    if let Some(uncertainty) = &record.power.uncertainty {
        validate_safe_label(uncertainty)?;
    }
    Ok(())
}

fn validate_route(route: &EffectiveRoute) -> Result<(), EvaluationRepositoryError> {
    validate_safe_label(&route.provider_id)?;
    validate_safe_label(&route.model_id)?;
    if let Some(origin) = &route.sanitized_origin {
        validate_sanitized_origin(origin)?;
    }
    for address in &route.resolved_addresses {
        address
            .parse::<std::net::IpAddr>()
            .map_err(|_| EvaluationRepositoryError::InvalidRecord)?;
    }
    Ok(())
}

fn validate_safe_identifier(value: &str) -> Result<(), EvaluationRepositoryError> {
    if value.is_empty()
        || value.len() > 128
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':'))
    {
        return Err(EvaluationRepositoryError::InvalidRecord);
    }
    Ok(())
}

fn validate_safe_label(value: &str) -> Result<(), EvaluationRepositoryError> {
    if value.trim().is_empty()
        || value.len() > 256
        || value.contains(['\n', '\r', '\0'])
        || value.contains("..")
        || value.contains('@')
        || value.contains('?')
        || value.contains('#')
    {
        return Err(EvaluationRepositoryError::InvalidRecord);
    }
    Ok(())
}

fn validate_sanitized_origin(value: &str) -> Result<(), EvaluationRepositoryError> {
    if value == "This device" {
        return Ok(());
    }
    let parsed = url::Url::parse(value).map_err(|_| EvaluationRepositoryError::InvalidRecord)?;
    if parsed.origin().ascii_serialization() != value {
        return Err(EvaluationRepositoryError::InvalidRecord);
    }
    Ok(())
}

fn validate_redacted_code(value: Option<&str>) -> Result<(), EvaluationRepositoryError> {
    if let Some(value) = value {
        validate_safe_identifier(value)?;
    }
    Ok(())
}

fn to_i64(value: u64) -> Result<i64, EvaluationRepositoryError> {
    i64::try_from(value).map_err(|_| EvaluationRepositoryError::InvalidRecord)
}

fn optional_i64(value: Option<u64>) -> Result<Option<i64>, EvaluationRepositoryError> {
    value.map(to_i64).transpose()
}

fn parse_utc(value: String) -> Result<DateTime<Utc>, EvaluationRepositoryError> {
    DateTime::parse_from_rfc3339(&value)
        .map(|value| value.with_timezone(&Utc))
        .map_err(|_| EvaluationRepositoryError::InvalidRecord)
}

fn serialized_name<T: Serialize>(value: &T) -> Result<String, EvaluationRepositoryError> {
    serde_json::to_value(value)
        .map_err(|_| EvaluationRepositoryError::InvalidRecord)?
        .as_str()
        .map(ToOwned::to_owned)
        .ok_or(EvaluationRepositoryError::InvalidRecord)
}

fn optional_serialized_name<T: Serialize>(
    value: Option<&T>,
) -> Result<Option<String>, EvaluationRepositoryError> {
    value.map(serialized_name).transpose()
}

fn unknown_reason(reason: UnknownReason) -> Result<String, EvaluationRepositoryError> {
    serialized_name(&reason)
}

fn power_source_columns(
    observation: &Observation<PowerSource>,
) -> Result<(&'static str, Option<String>, Option<String>), EvaluationRepositoryError> {
    match observation {
        Observation::Observed { value } => Ok(("observed", Some(serialized_name(value)?), None)),
        Observation::Unknown { reason } => Ok(("unknown", None, Some(unknown_reason(*reason)?))),
    }
}

fn number_columns(
    observation: &Observation<f32>,
) -> Result<(&'static str, Option<f32>, Option<String>), EvaluationRepositoryError> {
    match observation {
        Observation::Observed { value } if value.is_finite() => {
            Ok(("observed", Some(*value), None))
        }
        Observation::Observed { .. } => Err(EvaluationRepositoryError::InvalidRecord),
        Observation::Unknown { reason } => Ok(("unknown", None, Some(unknown_reason(*reason)?))),
    }
}

fn fingerprint<T: Serialize>(value: &T) -> Result<String, EvaluationRepositoryError> {
    let bytes = serde_json::to_vec(value).map_err(|_| EvaluationRepositoryError::InvalidRecord)?;
    let mut hasher = DeterministicFnv::default();
    bytes.hash(&mut hasher);
    Ok(format!("{:016x}", hasher.finish()))
}

#[derive(Default)]
struct DeterministicFnv(u64);

impl Hasher for DeterministicFnv {
    fn finish(&self) -> u64 {
        self.0
    }

    fn write(&mut self, bytes: &[u8]) {
        let mut hash = if self.0 == 0 {
            0xcbf29ce484222325
        } else {
            self.0
        };
        for byte in bytes {
            hash ^= u64::from(*byte);
            hash = hash.wrapping_mul(0x100000001b3);
        }
        self.0 = hash;
    }
}

#[cfg(test)]
mod evaluation_repository_tests {
    use super::*;
    use crate::observability::resource_sampler::RESOURCE_SCHEMA_VERSION;
    use crate::observability::stage_clock::STAGE_SCHEMA_VERSION;
    use crate::observability::{
        CpuMemoryObservation, Observation, PowerObservation, ResourceScope, StageName,
        UnknownReason,
    };
    use crate::trust::outbound::{OutboundDisposition, OutboundRoute};
    use crate::trust::provider_route::{Capability, LocationClass, RouteValidationState};
    use sqlx::sqlite::SqlitePoolOptions;

    const MEETING_ID: &str = "018f5e27-2f68-7e27-9c90-7c72123141ae";
    const EVIDENCE_ID: &str = "018f5e27-2f68-7e27-9c90-7c72123141af";
    const RUN_ID: &str = "018f5e27-2f68-7e27-9c90-7c72123141b0";

    async fn memory_pool() -> SqlitePool {
        SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("in-memory SQLite pool")
    }

    async fn migrated_pool() -> SqlitePool {
        let pool = memory_pool().await;
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("fresh migration set");
        insert_meeting(&pool, MEETING_ID).await;
        pool
    }

    async fn insert_meeting(pool: &SqlitePool, meeting_id: &str) {
        let now = Utc::now();
        sqlx::query(
            "INSERT INTO meetings (
                id, title, created_at, updated_at, lifecycle, completeness,
                completeness_reason, started_at_utc
             ) VALUES (?, 'Evaluation test', ?, ?, 'recording', 'pending', NULL, ?)",
        )
        .bind(meeting_id)
        .bind(now)
        .bind(now)
        .bind(now.to_rfc3339())
        .execute(pool)
        .await
        .expect("canonical meeting fixture");
    }

    fn manifest() -> EvaluationRunManifest {
        EvaluationRunManifest {
            schema_version: EVALUATION_SCHEMA_VERSION,
            run_id: RUN_ID.to_string(),
            meeting_id: MEETING_ID.to_string(),
            scenario_version: "recording_runtime_v1".to_string(),
            started_at_utc: Utc::now(),
        }
    }

    fn route() -> EffectiveRoute {
        EffectiveRoute {
            capability: Capability::Transcription,
            provider_id: "parakeet".to_string(),
            model_id: "parakeet-local".to_string(),
            location_class: Some(LocationClass::Local),
            sanitized_origin: Some("This device".to_string()),
            encrypted: true,
            validation_state: RouteValidationState::Validated,
            resolved_addresses: Vec::new(),
        }
    }

    fn records() -> Vec<EvaluationRecord> {
        let observed_at_utc = DateTime::parse_from_rfc3339("2026-09-21T00:00:00Z")
            .expect("fixed UTC fixture")
            .with_timezone(&Utc);
        let route = route();
        let outbound_route = OutboundRoute {
            capability: route.capability,
            provider_id: "ollama".to_string(),
            model_id: "llama-local".to_string(),
            location_class: LocationClass::Local,
            sanitized_origin: "http://127.0.0.1:11434".to_string(),
            encrypted: false,
            validation_state: RouteValidationState::Validated,
            resolved_addresses: vec!["127.0.0.1".to_string()],
        };
        vec![
            EvaluationRecord::Stage(StageRecord {
                schema_version: STAGE_SCHEMA_VERSION,
                sequence: 0,
                run_id: RUN_ID.to_string(),
                meeting_id: MEETING_ID.to_string(),
                work_id: "mixed:chunk-1".to_string(),
                evidence_id: EVIDENCE_ID.to_string(),
                stage: StageName::FinalTranscriptPersisted,
                offset_micros: 1_000,
                observed_at_utc,
            }),
            EvaluationRecord::Queue(EvaluationQueueRecord {
                run_id: RUN_ID.to_string(),
                sequence: 0,
                observed_offset_micros: 1_100,
                observed_at_utc,
                snapshot: QueueSnapshot {
                    capacity: 8,
                    depth: 0,
                    active: 0,
                    oldest_age_ms: None,
                    accepted: 1,
                    started: 1,
                    completed: 1,
                    failed: 0,
                    cancelled: 0,
                    superseded: 0,
                    rejected: 0,
                },
            }),
            EvaluationRecord::Resource(ResourceSample {
                schema_version: RESOURCE_SCHEMA_VERSION,
                run_id: RUN_ID.to_string(),
                sequence: 0,
                interval_ms: 250,
                observed_offset_micros: 1_200,
                observed_at_utc,
                process: CpuMemoryObservation {
                    scope: ResourceScope::Process,
                    cpu_percent: 4.5,
                    memory_bytes: 4_096,
                    total_memory_bytes: None,
                },
                system: CpuMemoryObservation {
                    scope: ResourceScope::System,
                    cpu_percent: 25.0,
                    memory_bytes: 8_192,
                    total_memory_bytes: Some(16_384),
                },
                power: PowerObservation {
                    collector: "test_collector".to_string(),
                    method: "fixture".to_string(),
                    source: Observation::Unknown {
                        reason: UnknownReason::CollectorUnavailable,
                    },
                    battery_percent: Observation::Unknown {
                        reason: UnknownReason::BatteryNotReported,
                    },
                    energy_impact: Observation::Unknown {
                        reason: UnknownReason::EnergyImpactNotMeasured,
                    },
                    uncertainty: Some("fixture_unknown".to_string()),
                },
            }),
            EvaluationRecord::Route(EvaluationRouteRecord {
                run_id: RUN_ID.to_string(),
                meeting_id: MEETING_ID.to_string(),
                sequence: 0,
                observed_offset_micros: 1_300,
                observed_at_utc,
                route,
            }),
            EvaluationRecord::Outbound(EvaluationOutboundRecord {
                run_id: RUN_ID.to_string(),
                sequence: 0,
                source_run_id: "process-safe".to_string(),
                meeting_id: Some(MEETING_ID.to_string()),
                observed_offset_micros: 1_400,
                observed_at_utc,
                route: outbound_route,
                disposition: OutboundDisposition::Permitted,
                redacted_code: Some("DISPATCH_AUTHORIZED".to_string()),
            }),
            EvaluationRecord::Error(EvaluationErrorRecord {
                run_id: RUN_ID.to_string(),
                sequence: 0,
                observed_offset_micros: 1_500,
                observed_at_utc,
                component: "transcription".to_string(),
                redacted_code: "EVIDENCE_PERSISTENCE_FAILED".to_string(),
                work_id: Some("mixed:chunk-1".to_string()),
                evidence_id: Some(EVIDENCE_ID.to_string()),
            }),
        ]
    }

    #[tokio::test]
    async fn evaluation_repository_fresh_and_legacy_migrations_preserve_product_ids() {
        let fresh = migrated_pool().await;
        let table_count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM sqlite_master
             WHERE type = 'table' AND name LIKE 'evaluation_%'",
        )
        .fetch_one(&fresh)
        .await
        .expect("fresh schema inspection");
        assert!(
            table_count >= 7,
            "evaluation tables must migrate on a fresh database"
        );
        assert_eq!(
            sqlx::query_scalar::<_, String>("SELECT id FROM meetings LIMIT 1")
                .fetch_one(&fresh)
                .await
                .expect("fresh meeting identity"),
            MEETING_ID
        );

        let legacy = memory_pool().await;
        sqlx::query(
            "CREATE TABLE meetings (
                id TEXT PRIMARY KEY, title TEXT NOT NULL,
                created_at TEXT NOT NULL, updated_at TEXT NOT NULL
             )",
        )
        .execute(&legacy)
        .await
        .expect("legacy meetings schema");
        sqlx::query(
            "INSERT INTO meetings VALUES
             ('legacy-stable-id', 'Legacy', '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')",
        )
        .execute(&legacy)
        .await
        .expect("legacy meeting fixture");
        sqlx::raw_sql(include_str!(
            "../../../migrations/20260920000400_phase1_evaluation_runs.sql"
        ))
        .execute(&legacy)
        .await
        .expect("evaluation migration over legacy meeting schema");
        assert_eq!(
            sqlx::query_scalar::<_, String>("SELECT id FROM meetings LIMIT 1")
                .fetch_one(&legacy)
                .await
                .expect("legacy meeting identity after migration"),
            "legacy-stable-id"
        );
    }

    #[tokio::test]
    async fn evaluation_repository_joins_all_record_classes_by_run_and_stable_sequence() {
        let pool = migrated_pool().await;
        EvaluationRepository::create_run(&pool, &manifest())
            .await
            .expect("versioned evaluation run");
        let result = EvaluationRepository::append_batch(&pool, RUN_ID, &records())
            .await
            .expect("joined evaluation batch");
        assert_eq!(result.inserted, 6);

        for table in [
            "evaluation_stage_records",
            "evaluation_queue_records",
            "evaluation_resource_records",
            "evaluation_route_records",
            "evaluation_outbound_records",
            "evaluation_error_records",
        ] {
            let count = sqlx::query_scalar::<_, i64>(&format!(
                "SELECT COUNT(*) FROM {table} WHERE run_id = ? AND sequence = 0"
            ))
            .bind(RUN_ID)
            .fetch_one(&pool)
            .await
            .expect("joined record count");
            assert_eq!(count, 1, "table={table}");
        }
    }

    #[tokio::test]
    async fn evaluation_repository_interrupted_batch_retry_is_idempotent() {
        let pool = migrated_pool().await;
        EvaluationRepository::create_run(&pool, &manifest())
            .await
            .expect("versioned evaluation run");
        let first = EvaluationRepository::append_batch(&pool, RUN_ID, &records())
            .await
            .expect("first batch write");
        let retry = EvaluationRepository::append_batch(&pool, RUN_ID, &records())
            .await
            .expect("idempotent retry");
        assert_eq!(first.inserted, 6);
        assert_eq!(retry.inserted, 0);
        assert_eq!(retry.already_present, 6);

        let duplicate_sequences = sqlx::query(
            "SELECT run_id, sequence, COUNT(*) AS duplicate_count
             FROM evaluation_stage_records
             GROUP BY run_id, sequence HAVING COUNT(*) > 1",
        )
        .fetch_all(&pool)
        .await
        .expect("duplicate sequence query");
        assert!(duplicate_sequences.is_empty());
    }

    #[test]
    fn evaluation_repository_default_rows_are_content_and_secret_redacted() {
        let serialized = serde_json::to_string(&records()).expect("serialize evaluation rows");
        for forbidden in [
            "spoken private words",
            "super-secret",
            "api_key",
            "/Users/private",
            "audio_payload",
            "request_payload",
        ] {
            assert!(!serialized.contains(forbidden), "forbidden={forbidden}");
        }

        let source = include_str!("../../../migrations/20260920000400_phase1_evaluation_runs.sql")
            .to_ascii_lowercase();
        for forbidden_column in [
            "transcript_text",
            "audio_data",
            "api_key",
            "credential",
            "request_payload",
            "response_payload",
            "full_path",
        ] {
            assert!(
                !source.contains(forbidden_column),
                "migration must exclude {forbidden_column}"
            );
        }
    }

    #[tokio::test]
    async fn evaluation_wiring_final_persisted_is_recorded_only_after_evidence_commit() {
        use crate::database::models::{CaptureCompleteness, TranscriptEvidenceInput};
        use crate::database::repositories::transcript::TranscriptsRepository;

        let pool = migrated_pool().await;
        EvaluationRepository::create_run(&pool, &manifest())
            .await
            .expect("versioned evaluation run");
        TranscriptsRepository::upsert_final_evidence(
            &pool,
            &TranscriptEvidenceInput {
                evidence_id: EVIDENCE_ID.to_string(),
                meeting_id: MEETING_ID.to_string(),
                source_track: "mixed".to_string(),
                source_segment_key: "segment-42".to_string(),
                sequence: 42,
                transcript: "private fixture text must stay in product storage".to_string(),
                audio_start_time: 1.25,
                audio_end_time: 2.5,
                capture_completeness: CaptureCompleteness::Complete,
            },
        )
        .await
        .expect("product evidence commit");
        TranscriptsRepository::upsert_final_evidence(
            &pool,
            &TranscriptEvidenceInput {
                evidence_id: EVIDENCE_ID.to_string(),
                meeting_id: MEETING_ID.to_string(),
                source_track: "mixed".to_string(),
                source_segment_key: "segment-42".to_string(),
                sequence: 42,
                transcript: "corrected private fixture stays in product storage".to_string(),
                audio_start_time: 1.25,
                audio_end_time: 2.75,
                capture_completeness: CaptureCompleteness::Complete,
            },
        )
        .await
        .expect("idempotent product evidence redelivery");

        let joined = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*)
             FROM evaluation_evidence_commits evaluation
             JOIN transcript_evidence evidence ON evidence.evidence_id = evaluation.evidence_id
             WHERE evaluation.run_id = ? AND evidence.meeting_id = ?",
        )
        .bind(RUN_ID)
        .bind(MEETING_ID)
        .fetch_one(&pool)
        .await
        .expect("post-commit evidence index");
        assert_eq!(joined, 1);
        let indexing_errors = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM evaluation_error_records
             WHERE run_id = ? AND redacted_code = 'EVIDENCE_INDEX_FAILED'",
        )
        .bind(RUN_ID)
        .fetch_one(&pool)
        .await
        .expect("idempotent evidence error count");
        assert_eq!(indexing_errors, 0);
    }

    fn terminal_input() -> EvaluationTerminalRunInput {
        let observed_at_utc = DateTime::parse_from_rfc3339("2026-09-21T00:00:05Z")
            .expect("fixed UTC fixture")
            .with_timezone(&Utc);
        let mut stages = Vec::new();
        let mut resources = Vec::new();
        let mut routes = Vec::new();
        let mut outbound = Vec::new();
        let mut errors = Vec::new();
        let mut queue = None;
        for record in records() {
            match record {
                EvaluationRecord::Stage(record) => stages.push(record),
                EvaluationRecord::Queue(record) => queue = Some(record.snapshot),
                EvaluationRecord::Resource(record) => resources.push(record),
                EvaluationRecord::Route(record) => routes.push(record),
                EvaluationRecord::Outbound(record) => outbound.push(record),
                EvaluationRecord::Error(record) => errors.push(record),
            }
        }
        EvaluationTerminalRunInput {
            run_id: RUN_ID.to_string(),
            meeting_id: MEETING_ID.to_string(),
            observed_offset_micros: 5_000,
            observed_at_utc,
            lifecycle: "incomplete".to_string(),
            deadline_at_utc: "2026-09-21T00:02:00Z".to_string(),
            deadline_ms: 120_000,
            remaining_work_count: 1,
            queue: queue.expect("queue fixture"),
            stages,
            resources,
            routes,
            outbound,
            gaps: vec![FinalizationGapInput {
                work_id: "mixed:chunk-1".to_string(),
                gap_kind: "accepted_work".to_string(),
                reason_code: "transcription_failed".to_string(),
                audio_start_ms: None,
                audio_end_ms: None,
            }],
            errors,
        }
    }

    #[tokio::test]
    async fn evaluation_wiring_finalization_attaches_terminal_truth_to_same_run() {
        let pool = migrated_pool().await;
        EvaluationRepository::create_run(&pool, &manifest())
            .await
            .expect("versioned evaluation run");
        let persisted = EvaluationRepository::persist_terminal_run(&pool, &terminal_input())
            .await
            .expect("terminal evaluation run");
        assert!(persisted.summary_written);
        let retry = EvaluationRepository::persist_terminal_run(&pool, &terminal_input())
            .await
            .expect("idempotent terminal retry");
        assert_eq!(retry.raw_records_inserted, 0);
        assert!(retry.raw_records_already_present >= 8);

        for table in [
            "evaluation_stage_records",
            "evaluation_queue_records",
            "evaluation_resource_records",
            "evaluation_route_records",
            "evaluation_outbound_records",
            "evaluation_error_records",
            "evaluation_gap_records",
            "evaluation_terminal_records",
        ] {
            let count = sqlx::query_scalar::<_, i64>(&format!(
                "SELECT COUNT(*) FROM {table} WHERE run_id = ?"
            ))
            .bind(RUN_ID)
            .fetch_one(&pool)
            .await
            .expect("terminal run record count");
            assert!(count >= 1, "table={table}");
        }
    }

    #[tokio::test]
    async fn evaluation_wiring_summary_failure_preserves_raw_records_and_explicit_error() {
        let pool = migrated_pool().await;
        EvaluationRepository::create_run(&pool, &manifest())
            .await
            .expect("versioned evaluation run");
        sqlx::query("DROP TABLE evaluation_run_summaries")
            .execute(&pool)
            .await
            .expect("summary failure injection");

        let persisted = EvaluationRepository::persist_terminal_run(&pool, &terminal_input())
            .await
            .expect("raw evidence remains authoritative");
        assert!(!persisted.summary_written);
        assert_eq!(
            persisted.aggregation_error_code.as_deref(),
            Some("SUMMARY_AGGREGATION_FAILED")
        );
        let stages = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM evaluation_stage_records WHERE run_id = ?",
        )
        .bind(RUN_ID)
        .fetch_one(&pool)
        .await
        .expect("raw stage count");
        let explicit_errors = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM evaluation_error_records
             WHERE run_id = ? AND redacted_code = 'SUMMARY_AGGREGATION_FAILED'",
        )
        .bind(RUN_ID)
        .fetch_one(&pool)
        .await
        .expect("explicit aggregation error");
        assert_eq!(stages, 1);
        assert_eq!(explicit_errors, 1);
    }
}
