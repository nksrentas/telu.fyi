//! Atomic, local-only evaluation run bundles.

use crate::audio::recording_saver::write_atomic_file;
use crate::database::repositories::evaluation::EVALUATION_SCHEMA_VERSION;
use crate::observability::resource_sampler::RESOURCE_SCHEMA_VERSION;
use crate::observability::stage_clock::STAGE_SCHEMA_VERSION;
use chrono::{DateTime, FixedOffset};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{Row, SqlitePool};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;
use uuid::Uuid;

pub const RUN_BUNDLE_SCHEMA_VERSION: u16 = 1;
pub const RUN_BUNDLE_DIRECTORY: &str = "evaluation-runs";
pub const REQUIRED_BUNDLE_FILES: [&str; 9] = [
    "manifest.json",
    "environment.json",
    "stages.jsonl",
    "queues.jsonl",
    "resources.jsonl",
    "routes.jsonl",
    "errors.jsonl",
    "result.json",
    "summary.md",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EvidenceStatus {
    Pass,
    Fail,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentFact {
    pub status: EvidenceStatus,
    pub value: Option<String>,
    pub reason: Option<String>,
}

impl EnvironmentFact {
    pub fn observed(value: impl Into<String>) -> Self {
        Self {
            status: EvidenceStatus::Pass,
            value: Some(value.into()),
            reason: None,
        }
    }

    pub fn unknown(reason: impl Into<String>) -> Self {
        Self {
            status: EvidenceStatus::Unknown,
            value: None,
            reason: Some(reason.into()),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunEnvironmentInput {
    pub app_revision: EnvironmentFact,
    pub os: EnvironmentFact,
    pub hardware: EnvironmentFact,
    pub power: EnvironmentFact,
    pub devices: EnvironmentFact,
    pub sample_configuration: EnvironmentFact,
    pub model: EnvironmentFact,
    pub route: EnvironmentFact,
    pub language: EnvironmentFact,
    pub limitations: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FinalizeRunBundleRequest {
    pub run_id: String,
    pub environment: RunEnvironmentInput,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunBundleStatus {
    Complete,
    Interrupted,
    Invalid,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunBundleListItem {
    pub run_id: String,
    pub meeting_id: Option<String>,
    pub status: RunBundleStatus,
    pub validation_errors: Vec<String>,
    pub scenario: Option<String>,
    pub started_at_utc: Option<String>,
    pub outcome: EvidenceStatus,
    pub outcome_reason: Option<String>,
    pub route: Option<DiagnosticRoute>,
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticRoute {
    pub capability: String,
    pub provider_id: String,
    pub model_id: String,
    pub location_class: Option<String>,
    pub sanitized_origin: Option<String>,
    pub encrypted: Option<bool>,
    pub validation_state: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticCheck {
    pub id: String,
    pub status: EvidenceStatus,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticResult {
    pub outcome: EvidenceStatus,
    pub outcome_reason: Option<String>,
    pub checks: Vec<DiagnosticCheck>,
    pub limitations: Vec<String>,
    pub outliers: Vec<Value>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticEnvironmentFact {
    pub label: String,
    pub status: EvidenceStatus,
    pub value: Option<String>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticStageRecord {
    pub sequence: u64,
    pub stage: String,
    pub observed_offset_micros: u64,
    pub observed_at_utc: String,
    pub work_id: Option<String>,
    pub evidence_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticQueueRecord {
    pub sequence: u64,
    pub observed_offset_micros: u64,
    pub observed_at_utc: String,
    pub capacity: u64,
    pub depth: u64,
    pub active: u64,
    pub oldest_age_ms: Option<u64>,
    pub accepted: u64,
    pub started: u64,
    pub completed: u64,
    pub failed: u64,
    pub cancelled: u64,
    pub superseded: u64,
    pub rejected: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticResourceRecord {
    pub sequence: u64,
    pub observed_offset_micros: u64,
    pub observed_at_utc: String,
    pub interval_ms: u64,
    pub process_cpu_percent: Option<f64>,
    pub process_memory_bytes: Option<u64>,
    pub system_cpu_percent: Option<f64>,
    pub system_memory_bytes: Option<u64>,
    pub system_total_memory_bytes: Option<u64>,
    pub power_source: Option<String>,
    pub battery_percent: Option<f64>,
    pub energy_impact: Option<f64>,
    pub uncertainty: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticRouteRecord {
    pub record_type: String,
    pub sequence: u64,
    pub observed_offset_micros: u64,
    pub observed_at_utc: String,
    pub route: DiagnosticRoute,
    pub disposition: Option<String>,
    pub redacted_code: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticErrorRecord {
    pub sequence: u64,
    pub observed_offset_micros: u64,
    pub observed_at_utc: String,
    pub component: String,
    pub redacted_code: String,
    pub work_id: Option<String>,
    pub evidence_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticRunDetail {
    pub run_id: String,
    pub meeting_id: String,
    pub scenario: String,
    pub started_at_utc: String,
    pub finalized_at_utc: String,
    pub duration_ms: Option<u64>,
    pub result: DiagnosticResult,
    pub environment: Vec<DiagnosticEnvironmentFact>,
    pub stages: Vec<DiagnosticStageRecord>,
    pub queues: Vec<DiagnosticQueueRecord>,
    pub resources: Vec<DiagnosticResourceRecord>,
    pub routes: Vec<DiagnosticRouteRecord>,
    pub errors: Vec<DiagnosticErrorRecord>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunBundleValidationReport {
    pub valid: bool,
    pub error_codes: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FinalizedRunBundle {
    pub run_id: String,
    pub meeting_id: String,
    pub status: RunBundleStatus,
    pub validation: RunBundleValidationReport,
}

#[derive(Debug, thiserror::Error)]
pub enum RunBundleError {
    #[error("run bundle identifier is invalid")]
    InvalidRunId,
    #[error("run bundle contains unsafe content")]
    UnsafeContent,
    #[error("run bundle write was interrupted")]
    InterruptedWrite,
    #[error("run bundle is invalid")]
    InvalidBundle,
    #[error("run bundle storage failed")]
    Storage,
    #[error("run bundle was not found")]
    NotFound,
}

impl RunBundleError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidRunId => "RUN_BUNDLE_INVALID_ID",
            Self::UnsafeContent => "RUN_BUNDLE_UNSAFE_CONTENT",
            Self::InterruptedWrite => "RUN_BUNDLE_INTERRUPTED_WRITE",
            Self::InvalidBundle => "RUN_BUNDLE_INVALID",
            Self::Storage => "RUN_BUNDLE_STORAGE_FAILED",
            Self::NotFound => "RUN_BUNDLE_NOT_FOUND",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunBundleCommandError {
    pub code: String,
}

impl From<RunBundleError> for RunBundleCommandError {
    fn from(error: RunBundleError) -> Self {
        Self {
            code: error.code().to_string(),
        }
    }
}

#[derive(Debug, Clone)]
struct BundleDocuments {
    manifest: Value,
    environment: Value,
    stages: Vec<Value>,
    queues: Vec<Value>,
    resources: Vec<Value>,
    routes: Vec<Value>,
    errors: Vec<Value>,
    result: Value,
    summary: String,
}

#[derive(Debug, Clone)]
pub struct RunBundleWriter {
    root: PathBuf,
}

impl RunBundleWriter {
    pub fn new(app_data_dir: impl AsRef<Path>) -> Self {
        Self {
            root: app_data_dir.as_ref().join(RUN_BUNDLE_DIRECTORY),
        }
    }

    fn write_documents(
        &self,
        run_id: &str,
        meeting_id: &str,
        documents: &BundleDocuments,
    ) -> Result<FinalizedRunBundle, RunBundleError> {
        validate_uuid(run_id)?;
        validate_uuid(meeting_id)?;
        validate_documents(documents, run_id, meeting_id)?;
        fs::create_dir_all(&self.root).map_err(|_| RunBundleError::Storage)?;

        let final_path = self.root.join(format!("run-{run_id}"));
        if final_path.exists() {
            let validation = validate_run_bundle_dir(&final_path)?;
            if !validation.valid {
                return Err(RunBundleError::InvalidBundle);
            }
            let manifest = read_json_file(&final_path.join("manifest.json"))?;
            if string_field(&manifest, "meetingId")? != meeting_id {
                return Err(RunBundleError::InvalidBundle);
            }
            return Ok(FinalizedRunBundle {
                run_id: run_id.to_string(),
                meeting_id: meeting_id.to_string(),
                status: RunBundleStatus::Complete,
                validation,
            });
        }

        let temp_path = self
            .root
            .join(format!(".run-{run_id}.{}.tmp", Uuid::new_v4()));
        fs::create_dir(&temp_path).map_err(|_| RunBundleError::Storage)?;

        let write_result = (|| {
            write_json_file(&temp_path.join("manifest.json"), &documents.manifest)?;
            write_json_file(&temp_path.join("environment.json"), &documents.environment)?;
            write_json_lines(&temp_path.join("stages.jsonl"), &documents.stages)?;
            write_json_lines(&temp_path.join("queues.jsonl"), &documents.queues)?;
            write_json_lines(&temp_path.join("resources.jsonl"), &documents.resources)?;
            write_json_lines(&temp_path.join("routes.jsonl"), &documents.routes)?;
            write_json_lines(&temp_path.join("errors.jsonl"), &documents.errors)?;
            write_json_file(&temp_path.join("result.json"), &documents.result)?;
            write_atomic_file(&temp_path.join("summary.md"), documents.summary.as_bytes())
                .map_err(|_| RunBundleError::Storage)?;

            let validation = validate_run_bundle_dir_internal(&temp_path, true)?;
            if !validation.valid {
                return Err(RunBundleError::InvalidBundle);
            }
            fs::rename(&temp_path, &final_path).map_err(|_| RunBundleError::Storage)?;
            Ok(validation)
        })();

        match write_result {
            Ok(validation) => Ok(FinalizedRunBundle {
                run_id: run_id.to_string(),
                meeting_id: meeting_id.to_string(),
                status: RunBundleStatus::Complete,
                validation,
            }),
            Err(error) => Err(error),
        }
    }

    pub fn list(&self) -> Result<Vec<RunBundleListItem>, RunBundleError> {
        if !self.root.exists() {
            return Ok(Vec::new());
        }
        let mut items = Vec::new();
        for entry in fs::read_dir(&self.root).map_err(|_| RunBundleError::Storage)? {
            let entry = entry.map_err(|_| RunBundleError::Storage)?;
            let file_type = entry.file_type().map_err(|_| RunBundleError::Storage)?;
            if !file_type.is_dir() || file_type.is_symlink() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().into_owned();
            if let Some(run_id) = interrupted_run_id(&name) {
                items.push(RunBundleListItem {
                    run_id,
                    meeting_id: None,
                    status: RunBundleStatus::Interrupted,
                    validation_errors: vec!["RUN_BUNDLE_INTERRUPTED_WRITE".to_string()],
                    scenario: None,
                    started_at_utc: None,
                    outcome: EvidenceStatus::Unknown,
                    outcome_reason: Some("RUN_BUNDLE_INTERRUPTED_WRITE".to_string()),
                    route: None,
                    duration_ms: None,
                });
                continue;
            }
            let Some(run_id) = name.strip_prefix("run-").map(str::to_string) else {
                continue;
            };
            if validate_uuid(&run_id).is_err() {
                continue;
            }
            let validation = validate_run_bundle_dir(&entry.path()).unwrap_or_else(|error| {
                RunBundleValidationReport {
                    valid: false,
                    error_codes: vec![error.code().to_string()],
                }
            });
            let item = if validation.valid {
                read_bundle_documents(&entry.path())
                    .and_then(|documents| diagnostic_list_item(&run_id, &documents, validation))
                    .unwrap_or_else(|error| invalid_diagnostic_list_item(run_id, error.code()))
            } else {
                let mut item = invalid_diagnostic_list_item(run_id, "RUN_BUNDLE_INVALID");
                item.validation_errors = validation.error_codes;
                item
            };
            items.push(item);
        }
        items.sort_by(|left, right| {
            right
                .started_at_utc
                .cmp(&left.started_at_utc)
                .then_with(|| left.run_id.cmp(&right.run_id))
        });
        Ok(items)
    }

    pub fn read_summary(&self, run_id: &str) -> Result<String, RunBundleError> {
        validate_uuid(run_id)?;
        let bundle = self.root.join(format!("run-{run_id}"));
        if !bundle.is_dir() {
            return Err(RunBundleError::NotFound);
        }
        let validation = validate_run_bundle_dir(&bundle)?;
        if !validation.valid {
            return Err(RunBundleError::InvalidBundle);
        }
        read_text_file(&bundle.join("summary.md"), MAX_SUMMARY_BYTES)
    }

    pub fn read_diagnostics(&self, run_id: &str) -> Result<DiagnosticRunDetail, RunBundleError> {
        validate_uuid(run_id)?;
        let bundle = self.root.join(format!("run-{run_id}"));
        if !bundle.is_dir() {
            return Err(RunBundleError::NotFound);
        }
        let validation = validate_run_bundle_dir(&bundle)?;
        if !validation.valid {
            return Err(RunBundleError::InvalidBundle);
        }
        diagnostic_detail(run_id, &read_bundle_documents(&bundle)?)
    }
}

fn invalid_diagnostic_list_item(run_id: String, code: &str) -> RunBundleListItem {
    RunBundleListItem {
        run_id,
        meeting_id: None,
        status: RunBundleStatus::Invalid,
        validation_errors: vec![code.to_string()],
        scenario: None,
        started_at_utc: None,
        outcome: EvidenceStatus::Unknown,
        outcome_reason: Some(code.to_string()),
        route: None,
        duration_ms: None,
    }
}

fn read_bundle_documents(path: &Path) -> Result<BundleDocuments, RunBundleError> {
    Ok(BundleDocuments {
        manifest: read_json_file(&path.join("manifest.json"))?,
        environment: read_json_file(&path.join("environment.json"))?,
        stages: read_json_lines(&path.join("stages.jsonl"))?,
        queues: read_json_lines(&path.join("queues.jsonl"))?,
        resources: read_json_lines(&path.join("resources.jsonl"))?,
        routes: read_json_lines(&path.join("routes.jsonl"))?,
        errors: read_json_lines(&path.join("errors.jsonl"))?,
        result: read_json_file(&path.join("result.json"))?,
        summary: read_text_file(&path.join("summary.md"), MAX_SUMMARY_BYTES)?,
    })
}

fn diagnostic_list_item(
    run_id: &str,
    documents: &BundleDocuments,
    validation: RunBundleValidationReport,
) -> Result<RunBundleListItem, RunBundleError> {
    let detail = diagnostic_detail(run_id, documents)?;
    let route = detail.routes.first().map(|record| record.route.clone());
    Ok(RunBundleListItem {
        run_id: detail.run_id,
        meeting_id: Some(detail.meeting_id),
        status: RunBundleStatus::Complete,
        validation_errors: validation.error_codes,
        scenario: Some(detail.scenario),
        started_at_utc: Some(detail.started_at_utc),
        outcome: detail.result.outcome,
        outcome_reason: detail.result.outcome_reason,
        route,
        duration_ms: detail.duration_ms,
    })
}

fn diagnostic_detail(
    run_id: &str,
    documents: &BundleDocuments,
) -> Result<DiagnosticRunDetail, RunBundleError> {
    let meeting_id = string_field(&documents.manifest, "meetingId")?.to_string();
    let manifest_run_id = string_field(&documents.manifest, "runId")?;
    if manifest_run_id != run_id {
        return Err(RunBundleError::InvalidBundle);
    }
    let scenario = string_field(&documents.manifest, "scenarioVersion")?.to_string();
    let started_at_utc = string_field(&documents.manifest, "startedAtUtc")?.to_string();
    let finalized_at_utc = string_field(&documents.manifest, "finalizedAtUtc")?.to_string();
    let duration_ms = duration_ms(&started_at_utc, &finalized_at_utc);

    let result = DiagnosticResult {
        outcome: diagnostic_status(documents.result.get("outcome").and_then(Value::as_str)),
        outcome_reason: optional_safe_string(&documents.result, "outcomeReason"),
        checks: documents
            .result
            .get("checks")
            .and_then(Value::as_array)
            .ok_or(RunBundleError::InvalidBundle)?
            .iter()
            .map(|check| {
                Ok(DiagnosticCheck {
                    id: string_field(check, "id")?.to_string(),
                    status: diagnostic_status(check.get("status").and_then(Value::as_str)),
                    reason: optional_safe_string(check, "reason"),
                })
            })
            .collect::<Result<Vec<_>, RunBundleError>>()?,
        limitations: safe_string_array(&documents.result, "limitations")?,
        outliers: documents
            .result
            .get("outliers")
            .and_then(Value::as_array)
            .cloned()
            .ok_or(RunBundleError::InvalidBundle)?,
    };

    let environment = [
        ("App revision", "appRevision"),
        ("Operating system", "os"),
        ("Hardware", "hardware"),
        ("Power", "power"),
        ("Audio devices", "devices"),
        ("Sample configuration", "sampleConfiguration"),
        ("Model", "model"),
        ("Effective route", "route"),
        ("Language", "language"),
    ]
    .into_iter()
    .map(|(label, key)| diagnostic_environment_fact(label, &documents.environment[key]))
    .collect::<Result<Vec<_>, RunBundleError>>()?;

    let stages = documents
        .stages
        .iter()
        .map(|record| {
            Ok(DiagnosticStageRecord {
                sequence: required_u64(record, "sequence")?,
                stage: string_field(record, "stage")?.to_string(),
                observed_offset_micros: required_u64(record, "offsetMicros")?,
                observed_at_utc: string_field(record, "observedAtUtc")?.to_string(),
                work_id: optional_safe_string(record, "workId"),
                evidence_id: optional_safe_string(record, "evidenceId"),
            })
        })
        .collect::<Result<Vec<_>, RunBundleError>>()?;

    let queues = documents
        .queues
        .iter()
        .map(|record| {
            Ok(DiagnosticQueueRecord {
                sequence: required_u64(record, "sequence")?,
                observed_offset_micros: required_u64(record, "observedOffsetMicros")?,
                observed_at_utc: string_field(record, "observedAtUtc")?.to_string(),
                capacity: required_u64(record, "capacity")?,
                depth: required_u64(record, "depth")?,
                active: required_u64(record, "active")?,
                oldest_age_ms: optional_u64_field(record, "oldestAgeMs")
                    .map_err(|_| RunBundleError::InvalidBundle)?,
                accepted: required_u64(record, "accepted")?,
                started: required_u64(record, "started")?,
                completed: required_u64(record, "completed")?,
                failed: required_u64(record, "failed")?,
                cancelled: required_u64(record, "cancelled")?,
                superseded: required_u64(record, "superseded")?,
                rejected: required_u64(record, "rejected")?,
            })
        })
        .collect::<Result<Vec<_>, RunBundleError>>()?;

    let resources = documents
        .resources
        .iter()
        .map(diagnostic_resource_record)
        .collect::<Result<Vec<_>, RunBundleError>>()?;
    let routes = documents
        .routes
        .iter()
        .map(diagnostic_route_record)
        .collect::<Result<Vec<_>, RunBundleError>>()?;
    let errors = documents
        .errors
        .iter()
        .map(|record| {
            Ok(DiagnosticErrorRecord {
                sequence: required_u64(record, "sequence")?,
                observed_offset_micros: required_u64(record, "observedOffsetMicros")?,
                observed_at_utc: string_field(record, "observedAtUtc")?.to_string(),
                component: string_field(record, "component")?.to_string(),
                redacted_code: string_field(record, "redactedCode")?.to_string(),
                work_id: optional_safe_string(record, "workId"),
                evidence_id: optional_safe_string(record, "evidenceId"),
            })
        })
        .collect::<Result<Vec<_>, RunBundleError>>()?;

    Ok(DiagnosticRunDetail {
        run_id: run_id.to_string(),
        meeting_id,
        scenario,
        started_at_utc,
        finalized_at_utc,
        duration_ms,
        result,
        environment,
        stages,
        queues,
        resources,
        routes,
        errors,
    })
}

fn diagnostic_environment_fact(
    label: &str,
    value: &Value,
) -> Result<DiagnosticEnvironmentFact, RunBundleError> {
    if !value.is_object() {
        return Err(RunBundleError::InvalidBundle);
    }
    Ok(DiagnosticEnvironmentFact {
        label: label.to_string(),
        status: diagnostic_status(value.get("status").and_then(Value::as_str)),
        value: optional_safe_string(value, "value"),
        reason: optional_safe_string(value, "reason"),
    })
}

fn diagnostic_resource_record(value: &Value) -> Result<DiagnosticResourceRecord, RunBundleError> {
    Ok(DiagnosticResourceRecord {
        sequence: required_u64(value, "sequence")?,
        observed_offset_micros: required_u64(value, "observedOffsetMicros")?,
        observed_at_utc: string_field(value, "observedAtUtc")?.to_string(),
        interval_ms: required_u64(value, "intervalMs")?,
        process_cpu_percent: value["process"]["cpuPercent"].as_f64(),
        process_memory_bytes: value["process"]["memoryBytes"].as_u64(),
        system_cpu_percent: value["system"]["cpuPercent"].as_f64(),
        system_memory_bytes: value["system"]["memoryBytes"].as_u64(),
        system_total_memory_bytes: value["system"]["totalMemoryBytes"].as_u64(),
        power_source: observation_display(&value["power"]["source"]),
        battery_percent: value["power"]["batteryPercent"]["value"].as_f64(),
        energy_impact: value["power"]["energyImpact"]["value"].as_f64(),
        uncertainty: optional_safe_string(&value["power"], "uncertainty"),
    })
}

fn diagnostic_route_record(value: &Value) -> Result<DiagnosticRouteRecord, RunBundleError> {
    Ok(DiagnosticRouteRecord {
        record_type: string_field(value, "recordType")?.to_string(),
        sequence: required_u64(value, "sequence")?,
        observed_offset_micros: required_u64(value, "observedOffsetMicros")?,
        observed_at_utc: string_field(value, "observedAtUtc")?.to_string(),
        route: diagnostic_route(&value["route"])?,
        disposition: optional_safe_string(value, "disposition"),
        redacted_code: optional_safe_string(value, "redactedCode"),
    })
}

fn diagnostic_route(value: &Value) -> Result<DiagnosticRoute, RunBundleError> {
    Ok(DiagnosticRoute {
        capability: string_field(value, "capability")?.to_string(),
        provider_id: string_field(value, "providerId")?.to_string(),
        model_id: string_field(value, "modelId")?.to_string(),
        location_class: optional_safe_string(value, "locationClass"),
        sanitized_origin: optional_safe_string(value, "sanitizedOrigin"),
        encrypted: value.get("encrypted").and_then(Value::as_bool),
        validation_state: string_field(value, "validationState")?.to_string(),
    })
}

fn diagnostic_status(value: Option<&str>) -> EvidenceStatus {
    match value {
        Some("pass" | "observed") => EvidenceStatus::Pass,
        Some("fail") => EvidenceStatus::Fail,
        _ => EvidenceStatus::Unknown,
    }
}

fn observation_display(value: &Value) -> Option<String> {
    value
        .get("value")
        .and_then(|item| match item {
            Value::String(text) if is_safe_display(text) => Some(text.clone()),
            Value::Number(number) => Some(number.to_string()),
            _ => None,
        })
        .or_else(|| optional_safe_string(value, "reason"))
}

fn safe_string_array(value: &Value, field: &str) -> Result<Vec<String>, RunBundleError> {
    value
        .get(field)
        .and_then(Value::as_array)
        .ok_or(RunBundleError::InvalidBundle)?
        .iter()
        .map(|item| {
            item.as_str()
                .filter(|text| is_safe_display(text))
                .map(str::to_string)
                .ok_or(RunBundleError::InvalidBundle)
        })
        .collect()
}

fn required_u64(value: &Value, field: &str) -> Result<u64, RunBundleError> {
    value
        .get(field)
        .and_then(Value::as_u64)
        .ok_or(RunBundleError::InvalidBundle)
}

fn optional_safe_string(value: &Value, field: &str) -> Option<String> {
    value
        .get(field)
        .and_then(Value::as_str)
        .filter(|text| is_safe_display(text))
        .map(str::to_string)
}

fn duration_ms(started_at_utc: &str, finalized_at_utc: &str) -> Option<u64> {
    let started = DateTime::parse_from_rfc3339(started_at_utc).ok()?;
    let finalized = DateTime::parse_from_rfc3339(finalized_at_utc).ok()?;
    u64::try_from(finalized.signed_duration_since(started).num_milliseconds()).ok()
}

pub fn validate_run_bundle_dir(
    path: impl AsRef<Path>,
) -> Result<RunBundleValidationReport, RunBundleError> {
    validate_run_bundle_dir_internal(path.as_ref(), false)
}

pub async fn finalize_run_bundle_with_pool(
    pool: &SqlitePool,
    app_data_dir: impl AsRef<Path>,
    request: FinalizeRunBundleRequest,
) -> Result<FinalizedRunBundle, RunBundleError> {
    validate_uuid(&request.run_id)?;
    validate_environment_input(&request.environment)?;
    let documents = load_documents(pool, &request.run_id, request.environment).await?;
    let meeting_id = string_field(&documents.manifest, "meetingId")?.to_string();
    RunBundleWriter::new(app_data_dir).write_documents(&request.run_id, &meeting_id, &documents)
}

#[tauri::command]
pub async fn finalize_run_bundle(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::state::AppState>,
    request: FinalizeRunBundleRequest,
) -> Result<FinalizedRunBundle, RunBundleCommandError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| RunBundleCommandError {
            code: "RUN_BUNDLE_STORAGE_FAILED".to_string(),
        })?;
    finalize_run_bundle_with_pool(state.db_manager.pool(), app_data_dir, request)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub fn list_run_bundles(
    app: tauri::AppHandle,
) -> Result<Vec<RunBundleListItem>, RunBundleCommandError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| RunBundleCommandError {
            code: "RUN_BUNDLE_STORAGE_FAILED".to_string(),
        })?;
    RunBundleWriter::new(app_data_dir)
        .list()
        .map_err(Into::into)
}

#[tauri::command]
pub fn read_run_bundle_summary(
    app: tauri::AppHandle,
    run_id: String,
) -> Result<String, RunBundleCommandError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| RunBundleCommandError {
            code: "RUN_BUNDLE_STORAGE_FAILED".to_string(),
        })?;
    RunBundleWriter::new(app_data_dir)
        .read_summary(&run_id)
        .map_err(Into::into)
}

#[tauri::command]
pub fn list_diagnostic_runs(
    app: tauri::AppHandle,
) -> Result<Vec<RunBundleListItem>, RunBundleCommandError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| RunBundleCommandError {
            code: "RUN_BUNDLE_STORAGE_FAILED".to_string(),
        })?;
    RunBundleWriter::new(app_data_dir)
        .list()
        .map_err(Into::into)
}

#[tauri::command]
pub fn read_diagnostic_run(
    app: tauri::AppHandle,
    run_id: String,
) -> Result<DiagnosticRunDetail, RunBundleCommandError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| RunBundleCommandError {
            code: "RUN_BUNDLE_STORAGE_FAILED".to_string(),
        })?;
    RunBundleWriter::new(app_data_dir)
        .read_diagnostics(&run_id)
        .map_err(Into::into)
}

async fn load_documents(
    pool: &SqlitePool,
    run_id: &str,
    environment: RunEnvironmentInput,
) -> Result<BundleDocuments, RunBundleError> {
    let run = sqlx::query(
        "SELECT schema_version, run_id, meeting_id, scenario_version, started_at_utc
         FROM evaluation_runs WHERE run_id = ?",
    )
    .bind(run_id)
    .fetch_optional(pool)
    .await
    .map_err(|_| RunBundleError::Storage)?
    .ok_or(RunBundleError::NotFound)?;
    let meeting_id: String = run.get("meeting_id");
    validate_uuid(&meeting_id)?;
    let scenario_version: String = run.get("scenario_version");
    let started_at_utc: String = run.get("started_at_utc");
    let evaluation_schema_version = u16::try_from(run.get::<i64, _>("schema_version"))
        .map_err(|_| RunBundleError::InvalidBundle)?;
    if evaluation_schema_version != EVALUATION_SCHEMA_VERSION || !is_safe_display(&scenario_version)
    {
        return Err(RunBundleError::InvalidBundle);
    }

    let stages = load_stages(pool, run_id).await?;
    let queues = load_queues(pool, run_id).await?;
    let resources = load_resources(pool, run_id).await?;
    let mut routes = load_routes(pool, run_id).await?;
    routes.extend(load_outbound(pool, run_id).await?);
    routes.sort_by(|left, right| json_order(left).cmp(&json_order(right)));
    let errors = load_errors(pool, run_id).await?;
    let evidence_commits = load_evidence_commits(pool, run_id).await?;
    let gaps = load_gaps(pool, run_id).await?;
    let terminal = load_terminal(pool, run_id, &meeting_id).await?;
    let finalized_at_utc = terminal
        .get("observedAtUtc")
        .and_then(Value::as_str)
        .ok_or(RunBundleError::InvalidBundle)?
        .to_string();
    let queue_capacity = queues
        .first()
        .and_then(|record| record.get("capacity"))
        .and_then(Value::as_u64)
        .ok_or(RunBundleError::InvalidBundle)?;
    let deadline_ms = terminal
        .get("deadlineMs")
        .and_then(Value::as_u64)
        .ok_or(RunBundleError::InvalidBundle)?;

    let content_policy = json!({
        "localOnly": true,
        "transcriptIncluded": false,
        "audioIncluded": false,
        "credentialsIncluded": false,
        "fullPathsIncluded": false
    });
    let manifest = json!({
        "schemaVersion": RUN_BUNDLE_SCHEMA_VERSION,
        "evaluationSchemaVersion": evaluation_schema_version,
        "runId": run_id,
        "meetingId": meeting_id,
        "scenarioVersion": scenario_version,
        "startedAtUtc": started_at_utc,
        "finalizedAtUtc": finalized_at_utc,
        "requiredFiles": REQUIRED_BUNDLE_FILES,
        "contentPolicy": content_policy
    });
    let environment_value =
        serde_json::to_value(&environment).map_err(|_| RunBundleError::InvalidBundle)?;
    let mut limitations = environment.limitations.clone();
    push_unique(&mut limitations, "thresholds_not_declared");
    if resources.is_empty() {
        push_unique(&mut limitations, "resource_evidence_missing");
    }
    if routes.is_empty() {
        push_unique(&mut limitations, "route_evidence_missing");
    }
    let bundle_environment = json!({
        "schemaVersion": RUN_BUNDLE_SCHEMA_VERSION,
        "runId": run_id,
        "meetingId": meeting_id,
        "scenarioVersion": scenario_version,
        "appRevision": environment_value["appRevision"].clone(),
        "os": environment_value["os"].clone(),
        "hardware": environment_value["hardware"].clone(),
        "power": environment_value["power"].clone(),
        "devices": environment_value["devices"].clone(),
        "sampleConfiguration": environment_value["sampleConfiguration"].clone(),
        "model": environment_value["model"].clone(),
        "route": environment_value["route"].clone(),
        "language": environment_value["language"].clone(),
        "configuration": {
            "queueCapacity": queue_capacity,
            "finalizationDeadlineMs": deadline_ms,
            "stageSchemaVersion": STAGE_SCHEMA_VERSION,
            "resourceSchemaVersion": RESOURCE_SCHEMA_VERSION
        },
        "limitations": limitations
    });

    let mut checks = vec![json!({
        "id": "thresholds",
        "status": "unknown",
        "reason": "thresholds_not_declared"
    })];
    checks.push(evidence_check(
        "stage_evidence",
        !stages.is_empty(),
        "stage_evidence_missing",
    ));
    checks.push(evidence_check(
        "queue_evidence",
        !queues.is_empty(),
        "queue_evidence_missing",
    ));
    checks.push(optional_evidence_check(
        "resource_evidence",
        !resources.is_empty(),
        "resource_evidence_missing",
    ));
    checks.push(optional_evidence_check(
        "route_evidence",
        !routes.is_empty(),
        "route_evidence_missing",
    ));
    let result = json!({
        "schemaVersion": RUN_BUNDLE_SCHEMA_VERSION,
        "runId": run_id,
        "meetingId": meeting_id,
        "outcome": "unknown",
        "outcomeReason": "thresholds_not_declared",
        "thresholdsDeclared": false,
        "checks": checks,
        "counts": {
            "stages": stages.len(),
            "queues": queues.len(),
            "resources": resources.len(),
            "routes": routes.len(),
            "errors": errors.len(),
            "evidence": evidence_commits.len(),
            "gaps": gaps.len(),
            "terminal": 1
        },
        "evidenceCommits": evidence_commits,
        "gaps": gaps,
        "terminal": terminal,
        "outliers": [],
        "limitations": limitations
    });
    let summary = build_summary(
        run_id,
        &meeting_id,
        &scenario_version,
        &result,
        &limitations,
    );
    Ok(BundleDocuments {
        manifest,
        environment: bundle_environment,
        stages,
        queues,
        resources,
        routes,
        errors,
        result,
        summary,
    })
}

fn evidence_check(id: &str, present: bool, missing_reason: &str) -> Value {
    if present {
        json!({"id": id, "status": "pass", "reason": null})
    } else {
        json!({"id": id, "status": "fail", "reason": missing_reason})
    }
}

fn optional_evidence_check(id: &str, present: bool, missing_reason: &str) -> Value {
    if present {
        json!({"id": id, "status": "pass", "reason": null})
    } else {
        json!({"id": id, "status": "unknown", "reason": missing_reason})
    }
}

fn push_unique(items: &mut Vec<String>, item: &str) {
    if !items.iter().any(|existing| existing == item) {
        items.push(item.to_string());
    }
}

fn build_summary(
    run_id: &str,
    meeting_id: &str,
    scenario_version: &str,
    result: &Value,
    limitations: &[String],
) -> String {
    let counts = &result["counts"];
    let limitation_lines = limitations
        .iter()
        .map(|item| format!("- {item}"))
        .collect::<Vec<_>>()
        .join("\n");
    format!(
        "# Evaluation run summary\n\n\
         - Run: `{run_id}`\n\
         - Meeting: `{meeting_id}`\n\
         - Scenario: `{scenario_version}`\n\
         - Outcome: Unknown (`thresholds_not_declared`)\n\n\
         ## Evidence counts\n\n\
         - Stages: {}\n\
         - Queue samples: {}\n\
         - Resource samples: {}\n\
         - Route and outbound records: {}\n\
         - Redacted errors: {}\n\
         - Evidence commits: {}\n\
         - Gaps: {}\n\n\
         ## Content policy\n\n\
         Local-only diagnostic metadata. Meeting content, recordings, credentials, provider payloads, query strings, and sensitive full paths are excluded.\n\n\
         ## Limitations\n\n{limitation_lines}\n",
        counts["stages"],
        counts["queues"],
        counts["resources"],
        counts["routes"],
        counts["errors"],
        counts["evidence"],
        counts["gaps"],
    )
}

fn json_order(value: &Value) -> (u64, String, u64) {
    (
        value
            .get("observedOffsetMicros")
            .and_then(Value::as_u64)
            .unwrap_or_default(),
        value
            .get("recordType")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        value
            .get("sequence")
            .and_then(Value::as_u64)
            .unwrap_or_default(),
    )
}

async fn load_stages(pool: &SqlitePool, run_id: &str) -> Result<Vec<Value>, RunBundleError> {
    let rows = sqlx::query(
        "SELECT schema_version, sequence, meeting_id, work_id, evidence_id, stage_name,
                observed_offset_micros, observed_at_utc
         FROM evaluation_stage_records WHERE run_id = ?
         ORDER BY observed_offset_micros, sequence",
    )
    .bind(run_id)
    .fetch_all(pool)
    .await
    .map_err(|_| RunBundleError::Storage)?;
    rows.into_iter()
        .map(|row| {
            Ok(json!({
                "schemaVersion": to_u64(row.get::<i64, _>("schema_version"))?,
                "sequence": to_u64(row.get::<i64, _>("sequence"))?,
                "runId": run_id,
                "meetingId": row.get::<String, _>("meeting_id"),
                "workId": row.get::<String, _>("work_id"),
                "evidenceId": row.get::<String, _>("evidence_id"),
                "stage": row.get::<String, _>("stage_name"),
                "offsetMicros": to_u64(row.get::<i64, _>("observed_offset_micros"))?,
                "observedAtUtc": row.get::<String, _>("observed_at_utc")
            }))
        })
        .collect()
}

async fn load_queues(pool: &SqlitePool, run_id: &str) -> Result<Vec<Value>, RunBundleError> {
    let rows = sqlx::query(
        "SELECT sequence, observed_offset_micros, observed_at_utc, capacity, depth, active,
                oldest_age_ms, accepted, started, completed, failed, cancelled, superseded,
                rejected
         FROM evaluation_queue_records WHERE run_id = ?
         ORDER BY observed_offset_micros, sequence",
    )
    .bind(run_id)
    .fetch_all(pool)
    .await
    .map_err(|_| RunBundleError::Storage)?;
    rows.into_iter()
        .map(|row| {
            Ok(json!({
                "runId": run_id,
                "sequence": to_u64(row.get::<i64, _>("sequence"))?,
                "observedOffsetMicros": to_u64(row.get::<i64, _>("observed_offset_micros"))?,
                "observedAtUtc": row.get::<String, _>("observed_at_utc"),
                "capacity": to_u64(row.get::<i64, _>("capacity"))?,
                "depth": to_u64(row.get::<i64, _>("depth"))?,
                "active": to_u64(row.get::<i64, _>("active"))?,
                "oldestAgeMs": optional_u64(row.get::<Option<i64>, _>("oldest_age_ms"))?,
                "accepted": to_u64(row.get::<i64, _>("accepted"))?,
                "started": to_u64(row.get::<i64, _>("started"))?,
                "completed": to_u64(row.get::<i64, _>("completed"))?,
                "failed": to_u64(row.get::<i64, _>("failed"))?,
                "cancelled": to_u64(row.get::<i64, _>("cancelled"))?,
                "superseded": to_u64(row.get::<i64, _>("superseded"))?,
                "rejected": to_u64(row.get::<i64, _>("rejected"))?
            }))
        })
        .collect()
}

async fn load_resources(pool: &SqlitePool, run_id: &str) -> Result<Vec<Value>, RunBundleError> {
    let rows = sqlx::query(
        "SELECT sequence, schema_version, interval_ms, observed_offset_micros, observed_at_utc,
                process_cpu_percent, process_memory_bytes, system_cpu_percent,
                system_memory_bytes, system_total_memory_bytes, power_collector, power_method,
                power_source_status, power_source_value, power_source_unknown_reason,
                battery_status, battery_percent, battery_unknown_reason, energy_status,
                energy_impact, energy_unknown_reason, uncertainty
         FROM evaluation_resource_records WHERE run_id = ?
         ORDER BY observed_offset_micros, sequence",
    )
    .bind(run_id)
    .fetch_all(pool)
    .await
    .map_err(|_| RunBundleError::Storage)?;
    rows.into_iter()
        .map(|row| {
            let source = observation_json(
                row.get::<String, _>("power_source_status"),
                row.get::<Option<String>, _>("power_source_value")
                    .map(Value::String),
                row.get::<Option<String>, _>("power_source_unknown_reason"),
            );
            let battery = observation_json(
                row.get::<String, _>("battery_status"),
                row.get::<Option<f64>, _>("battery_percent")
                    .and_then(serde_json::Number::from_f64)
                    .map(Value::Number),
                row.get::<Option<String>, _>("battery_unknown_reason"),
            );
            let energy = observation_json(
                row.get::<String, _>("energy_status"),
                row.get::<Option<f64>, _>("energy_impact")
                    .and_then(serde_json::Number::from_f64)
                    .map(Value::Number),
                row.get::<Option<String>, _>("energy_unknown_reason"),
            );
            Ok(json!({
                "schemaVersion": to_u64(row.get::<i64, _>("schema_version"))?,
                "runId": run_id,
                "sequence": to_u64(row.get::<i64, _>("sequence"))?,
                "intervalMs": to_u64(row.get::<i64, _>("interval_ms"))?,
                "observedOffsetMicros": to_u64(row.get::<i64, _>("observed_offset_micros"))?,
                "observedAtUtc": row.get::<String, _>("observed_at_utc"),
                "process": {
                    "scope": "process",
                    "cpuPercent": row.get::<f64, _>("process_cpu_percent"),
                    "memoryBytes": to_u64(row.get::<i64, _>("process_memory_bytes"))?,
                    "totalMemoryBytes": null
                },
                "system": {
                    "scope": "system",
                    "cpuPercent": row.get::<f64, _>("system_cpu_percent"),
                    "memoryBytes": to_u64(row.get::<i64, _>("system_memory_bytes"))?,
                    "totalMemoryBytes": optional_u64(row.get::<Option<i64>, _>("system_total_memory_bytes"))?
                },
                "power": {
                    "collector": row.get::<String, _>("power_collector"),
                    "method": row.get::<String, _>("power_method"),
                    "source": source,
                    "batteryPercent": battery,
                    "energyImpact": energy,
                    "uncertainty": row.get::<Option<String>, _>("uncertainty")
                }
            }))
        })
        .collect()
}

async fn load_routes(pool: &SqlitePool, run_id: &str) -> Result<Vec<Value>, RunBundleError> {
    let rows = sqlx::query(
        "SELECT sequence, meeting_id, observed_offset_micros, observed_at_utc, capability,
                provider_id, model_id, location_class, sanitized_origin, encrypted,
                validation_state, resolved_addresses
         FROM evaluation_route_records WHERE run_id = ?
         ORDER BY observed_offset_micros, sequence",
    )
    .bind(run_id)
    .fetch_all(pool)
    .await
    .map_err(|_| RunBundleError::Storage)?;
    rows.into_iter()
        .map(|row| {
            Ok(json!({
                "recordType": "route",
                "runId": run_id,
                "meetingId": row.get::<String, _>("meeting_id"),
                "sequence": to_u64(row.get::<i64, _>("sequence"))?,
                "observedOffsetMicros": to_u64(row.get::<i64, _>("observed_offset_micros"))?,
                "observedAtUtc": row.get::<String, _>("observed_at_utc"),
                "route": route_json(&row)
            }))
        })
        .collect()
}

async fn load_outbound(pool: &SqlitePool, run_id: &str) -> Result<Vec<Value>, RunBundleError> {
    let rows = sqlx::query(
        "SELECT sequence, source_run_id, meeting_id, observed_offset_micros, observed_at_utc,
                capability, provider_id, model_id, location_class, sanitized_origin, encrypted,
                validation_state, resolved_addresses, disposition, redacted_code
         FROM evaluation_outbound_records WHERE run_id = ?
         ORDER BY observed_offset_micros, sequence",
    )
    .bind(run_id)
    .fetch_all(pool)
    .await
    .map_err(|_| RunBundleError::Storage)?;
    rows.into_iter()
        .map(|row| {
            Ok(json!({
                "recordType": "outbound",
                "runId": run_id,
                "sourceRunId": row.get::<String, _>("source_run_id"),
                "meetingId": row.get::<Option<String>, _>("meeting_id"),
                "sequence": to_u64(row.get::<i64, _>("sequence"))?,
                "observedOffsetMicros": to_u64(row.get::<i64, _>("observed_offset_micros"))?,
                "observedAtUtc": row.get::<String, _>("observed_at_utc"),
                "route": route_json(&row),
                "disposition": row.get::<String, _>("disposition"),
                "redactedCode": row.get::<Option<String>, _>("redacted_code")
            }))
        })
        .collect()
}

async fn load_errors(pool: &SqlitePool, run_id: &str) -> Result<Vec<Value>, RunBundleError> {
    let rows = sqlx::query(
        "SELECT sequence, observed_offset_micros, observed_at_utc, component, redacted_code,
                work_id, evidence_id
         FROM evaluation_error_records WHERE run_id = ?
         ORDER BY observed_offset_micros, sequence",
    )
    .bind(run_id)
    .fetch_all(pool)
    .await
    .map_err(|_| RunBundleError::Storage)?;
    rows.into_iter()
        .map(|row| {
            Ok(json!({
                "runId": run_id,
                "sequence": to_u64(row.get::<i64, _>("sequence"))?,
                "observedOffsetMicros": to_u64(row.get::<i64, _>("observed_offset_micros"))?,
                "observedAtUtc": row.get::<String, _>("observed_at_utc"),
                "component": row.get::<String, _>("component"),
                "redactedCode": row.get::<String, _>("redacted_code"),
                "workId": row.get::<Option<String>, _>("work_id"),
                "evidenceId": row.get::<Option<String>, _>("evidence_id")
            }))
        })
        .collect()
}

async fn load_evidence_commits(
    pool: &SqlitePool,
    run_id: &str,
) -> Result<Vec<Value>, RunBundleError> {
    let rows = sqlx::query(
        "SELECT sequence, evidence_id, committed_at_utc
         FROM evaluation_evidence_commits WHERE run_id = ? ORDER BY sequence",
    )
    .bind(run_id)
    .fetch_all(pool)
    .await
    .map_err(|_| RunBundleError::Storage)?;
    rows.into_iter()
        .map(|row| {
            Ok(json!({
                "sequence": to_u64(row.get::<i64, _>("sequence"))?,
                "evidenceId": row.get::<String, _>("evidence_id"),
                "committedAtUtc": row.get::<String, _>("committed_at_utc")
            }))
        })
        .collect()
}

async fn load_gaps(pool: &SqlitePool, run_id: &str) -> Result<Vec<Value>, RunBundleError> {
    let rows = sqlx::query(
        "SELECT sequence, work_id, gap_kind, reason_code, audio_start_ms, audio_end_ms
         FROM evaluation_gap_records WHERE run_id = ? ORDER BY sequence",
    )
    .bind(run_id)
    .fetch_all(pool)
    .await
    .map_err(|_| RunBundleError::Storage)?;
    rows.into_iter()
        .map(|row| {
            Ok(json!({
                "sequence": to_u64(row.get::<i64, _>("sequence"))?,
                "workId": row.get::<String, _>("work_id"),
                "gapKind": row.get::<String, _>("gap_kind"),
                "reasonCode": row.get::<String, _>("reason_code"),
                "audioStartMs": optional_u64(row.get::<Option<i64>, _>("audio_start_ms"))?,
                "audioEndMs": optional_u64(row.get::<Option<i64>, _>("audio_end_ms"))?
            }))
        })
        .collect()
}

async fn load_terminal(
    pool: &SqlitePool,
    run_id: &str,
    meeting_id: &str,
) -> Result<Value, RunBundleError> {
    let rows = sqlx::query(
        "SELECT sequence, meeting_id, observed_offset_micros, observed_at_utc, lifecycle,
                deadline_at_utc, deadline_ms, remaining_work_count, gap_count, error_count
         FROM evaluation_terminal_records WHERE run_id = ? ORDER BY sequence",
    )
    .bind(run_id)
    .fetch_all(pool)
    .await
    .map_err(|_| RunBundleError::Storage)?;
    if rows.len() != 1 || rows[0].get::<String, _>("meeting_id") != meeting_id {
        return Err(RunBundleError::InvalidBundle);
    }
    let row = &rows[0];
    Ok(json!({
        "sequence": to_u64(row.get::<i64, _>("sequence"))?,
        "meetingId": meeting_id,
        "observedOffsetMicros": to_u64(row.get::<i64, _>("observed_offset_micros"))?,
        "observedAtUtc": row.get::<String, _>("observed_at_utc"),
        "lifecycle": row.get::<String, _>("lifecycle"),
        "deadlineAtUtc": row.get::<String, _>("deadline_at_utc"),
        "deadlineMs": to_u64(row.get::<i64, _>("deadline_ms"))?,
        "remainingWorkCount": to_u64(row.get::<i64, _>("remaining_work_count"))?,
        "gapCount": to_u64(row.get::<i64, _>("gap_count"))?,
        "errorCount": to_u64(row.get::<i64, _>("error_count"))?
    }))
}

fn route_json(row: &sqlx::sqlite::SqliteRow) -> Value {
    let resolved_addresses = row
        .get::<String, _>("resolved_addresses")
        .split(',')
        .filter(|address| !address.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
    json!({
        "capability": row.get::<String, _>("capability"),
        "providerId": row.get::<String, _>("provider_id"),
        "modelId": row.get::<String, _>("model_id"),
        "locationClass": row.get::<Option<String>, _>("location_class"),
        "sanitizedOrigin": row.get::<Option<String>, _>("sanitized_origin"),
        "encrypted": row.get::<bool, _>("encrypted"),
        "validationState": row.get::<String, _>("validation_state"),
        "resolvedAddresses": resolved_addresses
    })
}

fn observation_json(status: String, value: Option<Value>, reason: Option<String>) -> Value {
    match status.as_str() {
        "observed" => json!({"status": "observed", "value": value}),
        "unknown" => json!({"status": "unknown", "reason": reason}),
        _ => json!({"status": "unknown", "reason": "invalid_observation_status"}),
    }
}

fn to_u64(value: i64) -> Result<u64, RunBundleError> {
    u64::try_from(value).map_err(|_| RunBundleError::InvalidBundle)
}

fn optional_u64(value: Option<i64>) -> Result<Option<u64>, RunBundleError> {
    value.map(to_u64).transpose()
}

const MAX_JSON_FILE_BYTES: usize = 32 * 1024 * 1024;
const MAX_SUMMARY_BYTES: usize = 1024 * 1024;

fn validate_uuid(value: &str) -> Result<(), RunBundleError> {
    Uuid::parse_str(value)
        .map(|_| ())
        .map_err(|_| RunBundleError::InvalidRunId)
}

fn interrupted_run_id(name: &str) -> Option<String> {
    let body = name.strip_prefix(".run-")?.strip_suffix(".tmp")?;
    let (run_id, _writer_id) = body.rsplit_once('.')?;
    validate_uuid(run_id).ok()?;
    Some(run_id.to_string())
}

fn write_json_file(path: &Path, value: &Value) -> Result<(), RunBundleError> {
    let bytes = serde_json::to_vec_pretty(value).map_err(|_| RunBundleError::InvalidBundle)?;
    write_atomic_file(path, &bytes).map_err(|_| RunBundleError::Storage)
}

fn write_json_lines(path: &Path, values: &[Value]) -> Result<(), RunBundleError> {
    let mut output = String::new();
    for value in values {
        let line = serde_json::to_string(value).map_err(|_| RunBundleError::InvalidBundle)?;
        output.push_str(&line);
        output.push('\n');
    }
    write_atomic_file(path, output.as_bytes()).map_err(|_| RunBundleError::Storage)
}

fn read_limited(path: &Path, limit: usize) -> Result<Vec<u8>, RunBundleError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| RunBundleError::NotFound)?;
    if !metadata.file_type().is_file()
        || metadata.file_type().is_symlink()
        || metadata.len() > limit as u64
    {
        return Err(RunBundleError::InvalidBundle);
    }
    fs::read(path).map_err(|_| RunBundleError::Storage)
}

fn read_text_file(path: &Path, limit: usize) -> Result<String, RunBundleError> {
    String::from_utf8(read_limited(path, limit)?).map_err(|_| RunBundleError::InvalidBundle)
}

fn read_json_file(path: &Path) -> Result<Value, RunBundleError> {
    serde_json::from_slice(&read_limited(path, MAX_JSON_FILE_BYTES)?)
        .map_err(|_| RunBundleError::InvalidBundle)
}

fn read_json_lines(path: &Path) -> Result<Vec<Value>, RunBundleError> {
    let text = read_text_file(path, MAX_JSON_FILE_BYTES)?;
    text.lines()
        .enumerate()
        .filter(|(_, line)| !line.trim().is_empty())
        .map(|(_, line)| serde_json::from_str(line).map_err(|_| RunBundleError::InvalidBundle))
        .collect()
}

fn validate_run_bundle_dir_internal(
    path: &Path,
    allow_temporary_directory: bool,
) -> Result<RunBundleValidationReport, RunBundleError> {
    if !path.is_dir() {
        return Err(RunBundleError::NotFound);
    }
    let directory_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or(RunBundleError::InvalidBundle)?;
    if !allow_temporary_directory && interrupted_run_id(directory_name).is_some() {
        return Ok(invalid_report("RUN_BUNDLE_INTERRUPTED_WRITE"));
    }

    let expected: BTreeSet<&str> = REQUIRED_BUNDLE_FILES.into_iter().collect();
    let mut found = BTreeSet::new();
    let mut errors = BTreeSet::new();
    for entry in fs::read_dir(path).map_err(|_| RunBundleError::Storage)? {
        let entry = entry.map_err(|_| RunBundleError::Storage)?;
        let name = entry.file_name().to_string_lossy().into_owned();
        let file_type = entry.file_type().map_err(|_| RunBundleError::Storage)?;
        if file_type.is_symlink() || !file_type.is_file() || !expected.contains(name.as_str()) {
            errors.insert("RUN_BUNDLE_UNEXPECTED_FILE".to_string());
        }
        found.insert(name);
    }
    if expected.iter().any(|required| !found.contains(*required)) {
        errors.insert("RUN_BUNDLE_MISSING_FILE".to_string());
    }
    if !errors.is_empty() {
        return Ok(report_from_errors(errors));
    }

    let parsed: Result<BundleDocuments, RunBundleError> = (|| {
        Ok(BundleDocuments {
            manifest: read_json_file(&path.join("manifest.json"))?,
            environment: read_json_file(&path.join("environment.json"))?,
            stages: read_json_lines(&path.join("stages.jsonl"))?,
            queues: read_json_lines(&path.join("queues.jsonl"))?,
            resources: read_json_lines(&path.join("resources.jsonl"))?,
            routes: read_json_lines(&path.join("routes.jsonl"))?,
            errors: read_json_lines(&path.join("errors.jsonl"))?,
            result: read_json_file(&path.join("result.json"))?,
            summary: read_text_file(&path.join("summary.md"), MAX_SUMMARY_BYTES)?,
        })
    })();
    let documents = match parsed {
        Ok(documents) => documents,
        Err(_) => return Ok(invalid_report("RUN_BUNDLE_MALFORMED")),
    };
    let run_id = match documents.manifest.get("runId").and_then(Value::as_str) {
        Some(value) => value,
        None => return Ok(invalid_report("RUN_BUNDLE_SCHEMA_IDENTITY")),
    };
    let meeting_id = match documents.manifest.get("meetingId").and_then(Value::as_str) {
        Some(value) => value,
        None => return Ok(invalid_report("RUN_BUNDLE_SCHEMA_IDENTITY")),
    };
    errors.extend(validate_documents_codes(&documents, run_id, meeting_id));
    Ok(report_from_errors(errors))
}

fn validate_documents(
    documents: &BundleDocuments,
    run_id: &str,
    meeting_id: &str,
) -> Result<(), RunBundleError> {
    let errors = validate_documents_codes(documents, run_id, meeting_id);
    if errors.is_empty() {
        Ok(())
    } else if errors.contains("RUN_BUNDLE_SENSITIVE_CONTENT") {
        Err(RunBundleError::UnsafeContent)
    } else {
        Err(RunBundleError::InvalidBundle)
    }
}

fn validate_documents_codes(
    documents: &BundleDocuments,
    run_id: &str,
    meeting_id: &str,
) -> BTreeSet<String> {
    let mut errors = BTreeSet::new();
    if validate_uuid(run_id).is_err() || validate_uuid(meeting_id).is_err() {
        errors.insert("RUN_BUNDLE_SCHEMA_IDENTITY".to_string());
    }
    validate_manifest(&documents.manifest, run_id, meeting_id, &mut errors);
    validate_environment(&documents.environment, run_id, meeting_id, &mut errors);
    validate_stage_lines(&documents.stages, run_id, meeting_id, &mut errors);
    validate_queue_lines(&documents.queues, run_id, &mut errors);
    validate_ordered_lines(
        &documents.resources,
        run_id,
        Some(RESOURCE_SCHEMA_VERSION),
        &mut errors,
    );
    validate_route_lines(&documents.routes, run_id, meeting_id, &mut errors);
    validate_ordered_lines(&documents.errors, run_id, None, &mut errors);
    validate_result(documents, run_id, meeting_id, &mut errors);
    for value in std::iter::once(&documents.manifest)
        .chain(std::iter::once(&documents.environment))
        .chain(documents.stages.iter())
        .chain(documents.queues.iter())
        .chain(documents.resources.iter())
        .chain(documents.routes.iter())
        .chain(documents.errors.iter())
        .chain(std::iter::once(&documents.result))
    {
        if contains_sensitive_json(value, None) {
            errors.insert("RUN_BUNDLE_SENSITIVE_CONTENT".to_string());
        }
    }
    if contains_sensitive_string(&documents.summary) {
        errors.insert("RUN_BUNDLE_SENSITIVE_CONTENT".to_string());
    }
    errors
}

fn validate_manifest(
    manifest: &Value,
    run_id: &str,
    meeting_id: &str,
    errors: &mut BTreeSet<String>,
) {
    let required = manifest
        .get("requiredFiles")
        .and_then(Value::as_array)
        .map(|values| {
            values
                .iter()
                .filter_map(Value::as_str)
                .collect::<BTreeSet<_>>()
        });
    let expected: BTreeSet<&str> = REQUIRED_BUNDLE_FILES.into_iter().collect();
    let policy = manifest.get("contentPolicy");
    if manifest.get("schemaVersion").and_then(Value::as_u64)
        != Some(u64::from(RUN_BUNDLE_SCHEMA_VERSION))
        || manifest
            .get("evaluationSchemaVersion")
            .and_then(Value::as_u64)
            != Some(u64::from(EVALUATION_SCHEMA_VERSION))
        || manifest.get("runId").and_then(Value::as_str) != Some(run_id)
        || manifest.get("meetingId").and_then(Value::as_str) != Some(meeting_id)
        || manifest
            .get("scenarioVersion")
            .and_then(Value::as_str)
            .map_or(true, str::is_empty)
        || manifest
            .get("startedAtUtc")
            .and_then(Value::as_str)
            .is_none()
        || manifest
            .get("finalizedAtUtc")
            .and_then(Value::as_str)
            .is_none()
        || required.as_ref() != Some(&expected)
        || policy
            .and_then(|value| value.get("localOnly"))
            .and_then(Value::as_bool)
            != Some(true)
        || [
            "transcriptIncluded",
            "audioIncluded",
            "credentialsIncluded",
            "fullPathsIncluded",
        ]
        .iter()
        .any(|key| {
            policy
                .and_then(|value| value.get(*key))
                .and_then(Value::as_bool)
                != Some(false)
        })
    {
        errors.insert("RUN_BUNDLE_SCHEMA_IDENTITY".to_string());
    }
    let started = parsed_rfc3339_field(manifest, "startedAtUtc");
    let finalized = parsed_rfc3339_field(manifest, "finalizedAtUtc");
    if started.is_none() || finalized.is_none() {
        errors.insert("RUN_BUNDLE_MALFORMED".to_string());
    } else if finalized < started {
        errors.insert("RUN_BUNDLE_ORDER_VIOLATION".to_string());
    }
}

fn validate_environment(
    environment: &Value,
    run_id: &str,
    meeting_id: &str,
    errors: &mut BTreeSet<String>,
) {
    if environment.get("schemaVersion").and_then(Value::as_u64)
        != Some(u64::from(RUN_BUNDLE_SCHEMA_VERSION))
        || environment.get("runId").and_then(Value::as_str) != Some(run_id)
        || environment.get("meetingId").and_then(Value::as_str) != Some(meeting_id)
        || environment
            .get("scenarioVersion")
            .and_then(Value::as_str)
            .map_or(true, str::is_empty)
    {
        errors.insert("RUN_BUNDLE_SCHEMA_IDENTITY".to_string());
    }
    for field in [
        "appRevision",
        "os",
        "hardware",
        "power",
        "devices",
        "sampleConfiguration",
        "model",
        "route",
        "language",
    ] {
        if environment
            .get(field)
            .map_or(true, |fact| !valid_fact(fact))
        {
            errors.insert("RUN_BUNDLE_UNKNOWN_SEMANTICS".to_string());
        }
    }
    let config = environment.get("configuration");
    if config
        .and_then(|value| value.get("queueCapacity"))
        .and_then(Value::as_u64)
        .map_or(true, |value| value == 0)
        || config
            .and_then(|value| value.get("finalizationDeadlineMs"))
            .and_then(Value::as_u64)
            .map_or(true, |value| value == 0)
        || config
            .and_then(|value| value.get("stageSchemaVersion"))
            .and_then(Value::as_u64)
            != Some(u64::from(STAGE_SCHEMA_VERSION))
        || config
            .and_then(|value| value.get("resourceSchemaVersion"))
            .and_then(Value::as_u64)
            != Some(u64::from(RESOURCE_SCHEMA_VERSION))
        || environment
            .get("limitations")
            .and_then(Value::as_array)
            .is_none()
    {
        errors.insert("RUN_BUNDLE_UNKNOWN_SEMANTICS".to_string());
    }
}

fn valid_fact(value: &Value) -> bool {
    match value.get("status").and_then(Value::as_str) {
        Some("pass") => {
            value
                .get("value")
                .and_then(Value::as_str)
                .is_some_and(is_safe_display)
                && value.get("reason").map_or(true, Value::is_null)
        }
        Some("fail" | "unknown") => {
            value.get("value").map_or(true, Value::is_null)
                && value
                    .get("reason")
                    .and_then(Value::as_str)
                    .is_some_and(is_safe_reason)
        }
        _ => false,
    }
}

fn validate_environment_input(input: &RunEnvironmentInput) -> Result<(), RunBundleError> {
    let value = serde_json::to_value(input).map_err(|_| RunBundleError::InvalidBundle)?;
    for field in [
        "appRevision",
        "os",
        "hardware",
        "power",
        "devices",
        "sampleConfiguration",
        "model",
        "route",
        "language",
    ] {
        if !value.get(field).is_some_and(valid_fact) {
            return Err(RunBundleError::InvalidBundle);
        }
    }
    if contains_sensitive_json(&value, None) {
        return Err(RunBundleError::UnsafeContent);
    }
    if input.limitations.iter().any(|item| !is_safe_display(item)) {
        return Err(RunBundleError::UnsafeContent);
    }
    Ok(())
}

fn validate_stage_lines(
    records: &[Value],
    run_id: &str,
    meeting_id: &str,
    errors: &mut BTreeSet<String>,
) {
    if records.is_empty() {
        errors.insert("RUN_BUNDLE_MISSING_REQUIRED_EVIDENCE".to_string());
        return;
    }
    let allowed = [
        "audio_captured",
        "segment_boundary",
        "transcription_enqueued",
        "transcription_started",
        "final_transcript_produced",
        "final_transcript_persisted",
        "ui_acknowledged",
    ];
    let ranks: BTreeMap<&str, usize> = allowed
        .iter()
        .enumerate()
        .map(|(index, stage)| (*stage, index))
        .collect();
    let mut last_order = None;
    let mut last_stage_by_work = BTreeMap::<(String, String), usize>::new();
    for record in records {
        let sequence = record.get("sequence").and_then(Value::as_u64);
        let offset = record.get("offsetMicros").and_then(Value::as_u64);
        let stage = record.get("stage").and_then(Value::as_str);
        if record.get("schemaVersion").and_then(Value::as_u64)
            != Some(u64::from(STAGE_SCHEMA_VERSION))
            || record.get("runId").and_then(Value::as_str) != Some(run_id)
            || record.get("meetingId").and_then(Value::as_str) != Some(meeting_id)
            || record
                .get("workId")
                .and_then(Value::as_str)
                .map_or(true, str::is_empty)
            || record
                .get("evidenceId")
                .and_then(Value::as_str)
                .map_or(true, str::is_empty)
            || sequence.is_none()
            || offset.is_none()
        {
            errors.insert("RUN_BUNDLE_SCHEMA_IDENTITY".to_string());
            continue;
        }
        validate_rfc3339_field(record, "observedAtUtc", errors);
        let Some(rank) = stage.and_then(|name| ranks.get(name).copied()) else {
            errors.insert("RUN_BUNDLE_RESERVED_STAGE".to_string());
            continue;
        };
        let order = (offset.unwrap_or_default(), sequence.unwrap_or_default());
        if last_order.is_some_and(|previous| previous > order) {
            errors.insert("RUN_BUNDLE_ORDER_VIOLATION".to_string());
        }
        last_order = Some(order);
        let key = (
            record
                .get("workId")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string(),
            record
                .get("evidenceId")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string(),
        );
        if last_stage_by_work
            .get(&key)
            .is_some_and(|previous| *previous > rank)
        {
            errors.insert("RUN_BUNDLE_ORDER_VIOLATION".to_string());
        }
        last_stage_by_work.insert(key, rank);
    }
}

fn validate_queue_lines(records: &[Value], run_id: &str, errors: &mut BTreeSet<String>) {
    if records.is_empty() {
        errors.insert("RUN_BUNDLE_MISSING_REQUIRED_EVIDENCE".to_string());
        return;
    }
    let mut last_order = None;
    for record in records {
        let sequence = record.get("sequence").and_then(Value::as_u64);
        let offset = record.get("observedOffsetMicros").and_then(Value::as_u64);
        let value = |field: &str| record.get(field).and_then(Value::as_u64);
        let (capacity, depth, active, accepted, started, completed, failed, cancelled, superseded) = (
            value("capacity"),
            value("depth"),
            value("active"),
            value("accepted"),
            value("started"),
            value("completed"),
            value("failed"),
            value("cancelled"),
            value("superseded"),
        );
        if record.get("runId").and_then(Value::as_str) != Some(run_id)
            || sequence.is_none()
            || offset.is_none()
            || [
                capacity,
                depth,
                active,
                accepted,
                started,
                completed,
                failed,
                cancelled,
                superseded,
                value("rejected"),
            ]
            .iter()
            .any(Option::is_none)
        {
            errors.insert("RUN_BUNDLE_SCHEMA_IDENTITY".to_string());
            continue;
        }
        validate_rfc3339_field(record, "observedAtUtc", errors);
        let depth = depth.unwrap_or_default();
        let terminal = completed
            .unwrap_or_default()
            .saturating_add(failed.unwrap_or_default())
            .saturating_add(cancelled.unwrap_or_default())
            .saturating_add(superseded.unwrap_or_default());
        let oldest = record.get("oldestAgeMs");
        if capacity == Some(0)
            || active.unwrap_or_default() > depth
            || depth > capacity.unwrap_or_default()
            || started.unwrap_or_default() > accepted.unwrap_or_default()
            || accepted.unwrap_or_default() != depth.saturating_add(terminal)
            || (depth == 0 && oldest.is_some_and(|value| !value.is_null()))
            || (depth > 0 && oldest.map_or(true, Value::is_null))
        {
            errors.insert("RUN_BUNDLE_QUEUE_CONSERVATION".to_string());
        }
        let order = (offset.unwrap_or_default(), sequence.unwrap_or_default());
        if last_order.is_some_and(|previous| previous > order) {
            errors.insert("RUN_BUNDLE_ORDER_VIOLATION".to_string());
        }
        last_order = Some(order);
    }
}

fn validate_ordered_lines(
    records: &[Value],
    run_id: &str,
    schema_version: Option<u16>,
    errors: &mut BTreeSet<String>,
) {
    let mut last_order = None;
    for record in records {
        let sequence = record.get("sequence").and_then(Value::as_u64);
        let offset = record.get("observedOffsetMicros").and_then(Value::as_u64);
        if record.get("runId").and_then(Value::as_str) != Some(run_id)
            || sequence.is_none()
            || offset.is_none()
            || schema_version.is_some_and(|expected| {
                record.get("schemaVersion").and_then(Value::as_u64) != Some(u64::from(expected))
            })
        {
            errors.insert("RUN_BUNDLE_SCHEMA_IDENTITY".to_string());
            continue;
        }
        validate_rfc3339_field(record, "observedAtUtc", errors);
        let order = (offset.unwrap_or_default(), sequence.unwrap_or_default());
        if last_order.is_some_and(|previous| previous > order) {
            errors.insert("RUN_BUNDLE_ORDER_VIOLATION".to_string());
        }
        last_order = Some(order);
    }
}

fn validate_route_lines(
    records: &[Value],
    run_id: &str,
    meeting_id: &str,
    errors: &mut BTreeSet<String>,
) {
    let mut last_order = None;
    for record in records {
        let sequence = record.get("sequence").and_then(Value::as_u64);
        let offset = record.get("observedOffsetMicros").and_then(Value::as_u64);
        if record.get("runId").and_then(Value::as_str) != Some(run_id)
            || record.get("meetingId").and_then(Value::as_str) != Some(meeting_id)
            || !matches!(
                record.get("recordType").and_then(Value::as_str),
                Some("route" | "outbound")
            )
            || sequence.is_none()
            || offset.is_none()
        {
            errors.insert("RUN_BUNDLE_SCHEMA_IDENTITY".to_string());
            continue;
        }
        validate_rfc3339_field(record, "observedAtUtc", errors);
        let order = (
            offset.unwrap_or_default(),
            record
                .get("recordType")
                .and_then(Value::as_str)
                .unwrap_or_default(),
            sequence.unwrap_or_default(),
        );
        if last_order.is_some_and(|previous| previous > order) {
            errors.insert("RUN_BUNDLE_ORDER_VIOLATION".to_string());
        }
        last_order = Some(order);
    }
}

fn validate_result(
    documents: &BundleDocuments,
    run_id: &str,
    meeting_id: &str,
    errors: &mut BTreeSet<String>,
) {
    let result = &documents.result;
    if result.get("schemaVersion").and_then(Value::as_u64)
        != Some(u64::from(RUN_BUNDLE_SCHEMA_VERSION))
        || result.get("runId").and_then(Value::as_str) != Some(run_id)
        || result.get("meetingId").and_then(Value::as_str) != Some(meeting_id)
        || result.get("thresholdsDeclared").and_then(Value::as_bool) != Some(false)
        || result.get("outcome").and_then(Value::as_str) != Some("unknown")
        || result
            .get("outcomeReason")
            .and_then(Value::as_str)
            .map_or(true, |reason| !is_safe_reason(reason))
        || result.get("outliers").and_then(Value::as_array).is_none()
        || result
            .get("limitations")
            .and_then(Value::as_array)
            .is_none()
    {
        errors.insert("RUN_BUNDLE_UNKNOWN_SEMANTICS".to_string());
    }
    let checks = result.get("checks").and_then(Value::as_array);
    if checks.map_or(true, |items| items.is_empty())
        || checks.into_iter().flatten().any(|check| {
            let status = check.get("status").and_then(Value::as_str);
            check
                .get("id")
                .and_then(Value::as_str)
                .map_or(true, str::is_empty)
                || !matches!(status, Some("pass" | "fail" | "unknown"))
                || matches!(status, Some("fail" | "unknown"))
                    && check
                        .get("reason")
                        .and_then(Value::as_str)
                        .map_or(true, |reason| !is_safe_reason(reason))
        })
    {
        errors.insert("RUN_BUNDLE_UNKNOWN_SEMANTICS".to_string());
    }
    let evidence = result
        .get("evidenceCommits")
        .and_then(Value::as_array)
        .map_or(0, Vec::len);
    let gaps = result
        .get("gaps")
        .and_then(Value::as_array)
        .map_or(0, Vec::len);
    let terminal = result.get("terminal").filter(|value| !value.is_null());
    validate_result_evidence(result, errors);
    validate_result_gaps(result, errors);
    if let Some(terminal) = terminal {
        validate_terminal(terminal, meeting_id, errors);
    }
    let count_matches = |field: &str, expected: usize| {
        result
            .get("counts")
            .and_then(|counts| counts.get(field))
            .and_then(Value::as_u64)
            == u64::try_from(expected).ok()
    };
    if !count_matches("stages", documents.stages.len())
        || !count_matches("queues", documents.queues.len())
        || !count_matches("resources", documents.resources.len())
        || !count_matches("routes", documents.routes.len())
        || !count_matches("errors", documents.errors.len())
        || !count_matches("evidence", evidence)
        || !count_matches("gaps", gaps)
        || !count_matches("terminal", usize::from(terminal.is_some()))
        || terminal.is_none()
        || terminal
            .and_then(|value| value.get("meetingId"))
            .and_then(Value::as_str)
            != Some(meeting_id)
        || terminal
            .and_then(|value| value.get("gapCount"))
            .and_then(Value::as_u64)
            != u64::try_from(gaps).ok()
    {
        errors.insert("RUN_BUNDLE_MISSING_REQUIRED_EVIDENCE".to_string());
    }
}

fn validate_result_evidence(result: &Value, errors: &mut BTreeSet<String>) {
    let Some(records) = result.get("evidenceCommits").and_then(Value::as_array) else {
        errors.insert("RUN_BUNDLE_MISSING_REQUIRED_EVIDENCE".to_string());
        return;
    };
    let mut last_sequence = None;
    for record in records {
        let sequence = record.get("sequence").and_then(Value::as_u64);
        let evidence_id = record.get("evidenceId").and_then(Value::as_str);
        if sequence.is_none() || evidence_id.map_or(true, |value| validate_uuid(value).is_err()) {
            errors.insert("RUN_BUNDLE_SCHEMA_IDENTITY".to_string());
        }
        validate_rfc3339_field(record, "committedAtUtc", errors);
        if sequence.is_some_and(|current| last_sequence.is_some_and(|previous| previous >= current))
        {
            errors.insert("RUN_BUNDLE_ORDER_VIOLATION".to_string());
        }
        if sequence.is_some() {
            last_sequence = sequence;
        }
    }
}

fn validate_result_gaps(result: &Value, errors: &mut BTreeSet<String>) {
    let Some(records) = result.get("gaps").and_then(Value::as_array) else {
        errors.insert("RUN_BUNDLE_MISSING_REQUIRED_EVIDENCE".to_string());
        return;
    };
    let mut last_sequence = None;
    for record in records {
        let sequence = record.get("sequence").and_then(Value::as_u64);
        let work_id = record.get("workId").and_then(Value::as_str);
        let gap_kind = record.get("gapKind").and_then(Value::as_str);
        let reason_code = record.get("reasonCode").and_then(Value::as_str);
        let start = optional_u64_field(record, "audioStartMs");
        let end = optional_u64_field(record, "audioEndMs");
        if sequence.is_none()
            || work_id.map_or(true, str::is_empty)
            || gap_kind.map_or(true, |value| !is_safe_reason(value))
            || reason_code.map_or(true, |value| !is_safe_reason(value))
            || start.is_err()
            || end.is_err()
        {
            errors.insert("RUN_BUNDLE_SCHEMA_IDENTITY".to_string());
        }
        if sequence.is_some_and(|current| last_sequence.is_some_and(|previous| previous >= current))
        {
            errors.insert("RUN_BUNDLE_ORDER_VIOLATION".to_string());
        }
        if sequence.is_some() {
            last_sequence = sequence;
        }
        if let (Ok(start), Ok(end)) = (start, end) {
            if start.is_some() != end.is_some()
                || start.zip(end).is_some_and(|(start, end)| start > end)
            {
                errors.insert("RUN_BUNDLE_ORDER_VIOLATION".to_string());
            }
        }
    }
}

fn validate_terminal(terminal: &Value, meeting_id: &str, errors: &mut BTreeSet<String>) {
    let lifecycle = terminal.get("lifecycle").and_then(Value::as_str);
    if terminal.get("sequence").and_then(Value::as_u64).is_none()
        || terminal.get("meetingId").and_then(Value::as_str) != Some(meeting_id)
        || terminal
            .get("observedOffsetMicros")
            .and_then(Value::as_u64)
            .is_none()
        || !matches!(lifecycle, Some("complete" | "incomplete"))
        || terminal
            .get("deadlineMs")
            .and_then(Value::as_u64)
            .map_or(true, |value| value == 0)
        || ["remainingWorkCount", "gapCount", "errorCount"]
            .iter()
            .any(|field| terminal.get(*field).and_then(Value::as_u64).is_none())
    {
        errors.insert("RUN_BUNDLE_SCHEMA_IDENTITY".to_string());
    }
    validate_rfc3339_field(terminal, "observedAtUtc", errors);
    validate_rfc3339_field(terminal, "deadlineAtUtc", errors);
}

fn parsed_rfc3339_field(value: &Value, field: &str) -> Option<DateTime<FixedOffset>> {
    DateTime::parse_from_rfc3339(value.get(field)?.as_str()?).ok()
}

fn validate_rfc3339_field(value: &Value, field: &str, errors: &mut BTreeSet<String>) {
    if parsed_rfc3339_field(value, field).is_none() {
        errors.insert("RUN_BUNDLE_MALFORMED".to_string());
    }
}

fn optional_u64_field(value: &Value, field: &str) -> Result<Option<u64>, ()> {
    match value.get(field) {
        None | Some(Value::Null) => Ok(None),
        Some(value) => value.as_u64().map(Some).ok_or(()),
    }
}

fn string_field<'a>(value: &'a Value, field: &str) -> Result<&'a str, RunBundleError> {
    value
        .get(field)
        .and_then(Value::as_str)
        .filter(|item| !item.trim().is_empty())
        .ok_or(RunBundleError::InvalidBundle)
}

fn is_safe_reason(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 256
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-' | b'.'))
}

fn is_safe_display(value: &str) -> bool {
    !value.trim().is_empty()
        && value.len() <= 512
        && !value.chars().any(char::is_control)
        && !contains_sensitive_string(value)
}

fn contains_sensitive_json(value: &Value, key: Option<&str>) -> bool {
    if key.is_some_and(is_forbidden_key) {
        return true;
    }
    match value {
        Value::Object(map) => map
            .iter()
            .any(|(child_key, child)| contains_sensitive_json(child, Some(child_key))),
        Value::Array(items) => items.iter().any(|item| contains_sensitive_json(item, key)),
        Value::String(text) => contains_sensitive_string(text),
        _ => false,
    }
}

fn is_forbidden_key(key: &str) -> bool {
    matches!(
        key.to_ascii_lowercase().as_str(),
        "transcript"
            | "transcripttext"
            | "audiocontent"
            | "audiobytes"
            | "apikey"
            | "secret"
            | "password"
            | "credential"
            | "prompt"
            | "requestbody"
            | "responsebody"
            | "fullpath"
            | "filepath"
            | "folderpath"
    )
}

fn contains_sensitive_string(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.contains("bearer ")
        || lower.contains("api_key=")
        || lower.contains("apikey=")
        || lower.contains("password=")
        || lower.contains("sk-private-")
        || lower.contains("/users/")
        || lower.contains("/home/")
        || lower.contains("/private/var/")
        || lower.contains("c:\\users\\")
        || (lower.starts_with("http") && lower.contains('?'))
        || (lower.starts_with("http")
            && lower.split_once("://").is_some_and(|(_, authority)| {
                authority
                    .split('/')
                    .next()
                    .is_some_and(|part| part.contains('@'))
            }))
}

fn invalid_report(code: &str) -> RunBundleValidationReport {
    RunBundleValidationReport {
        valid: false,
        error_codes: vec![code.to_string()],
    }
}

fn report_from_errors(errors: BTreeSet<String>) -> RunBundleValidationReport {
    RunBundleValidationReport {
        valid: errors.is_empty(),
        error_codes: errors.into_iter().collect(),
    }
}

#[cfg(test)]
mod run_bundle_writer_tests {
    use super::*;
    use crate::database::repositories::meeting::MeetingsRepository;
    use chrono::{DateTime, Utc};
    use serde_json::json;
    use sqlx::sqlite::SqlitePoolOptions;
    use std::fs;
    use uuid::Uuid;

    const MEETING_ID: &str = "11111111-1111-4111-8111-111111111111";
    const RUN_ID: &str = "22222222-2222-4222-8222-222222222222";

    fn fixture_documents() -> BundleDocuments {
        let started = DateTime::parse_from_rfc3339("2026-09-21T10:00:00Z")
            .expect("fixture UTC")
            .with_timezone(&Utc);
        BundleDocuments {
            manifest: json!({
                "schemaVersion": RUN_BUNDLE_SCHEMA_VERSION,
                "evaluationSchemaVersion": 1,
                "runId": RUN_ID,
                "meetingId": MEETING_ID,
                "scenarioVersion": "short-utterance-v1",
                "startedAtUtc": started,
                "finalizedAtUtc": started,
                "requiredFiles": REQUIRED_BUNDLE_FILES,
                "contentPolicy": {
                    "localOnly": true,
                    "transcriptIncluded": false,
                    "audioIncluded": false,
                    "credentialsIncluded": false,
                    "fullPathsIncluded": false
                }
            }),
            environment: json!({
                "schemaVersion": RUN_BUNDLE_SCHEMA_VERSION,
                "runId": RUN_ID,
                "meetingId": MEETING_ID,
                "scenarioVersion": "short-utterance-v1",
                "appRevision": EnvironmentFact::observed("revision-1"),
                "os": EnvironmentFact::observed("macos"),
                "hardware": EnvironmentFact::observed("reference-machine"),
                "power": EnvironmentFact::unknown("energy_impact_not_measured"),
                "devices": EnvironmentFact::observed("built-in microphone; system audio"),
                "sampleConfiguration": EnvironmentFact::observed("48000hz; mono"),
                "model": EnvironmentFact::observed("local-model"),
                "route": EnvironmentFact::observed("local:this-device"),
                "language": EnvironmentFact::observed("en"),
                "configuration": {
                    "queueCapacity": 8,
                    "finalizationDeadlineMs": 30000,
                    "stageSchemaVersion": 1,
                    "resourceSchemaVersion": 1
                },
                "limitations": ["energy_impact_not_measured"]
            }),
            stages: vec![json!({
                "schemaVersion": 1,
                "sequence": 0,
                "runId": RUN_ID,
                "meetingId": MEETING_ID,
                "workId": "work-1",
                "evidenceId": "33333333-3333-4333-8333-333333333333",
                "stage": "audio_captured",
                "offsetMicros": 1,
                "observedAtUtc": started
            })],
            queues: vec![json!({
                "runId": RUN_ID,
                "sequence": 0,
                "observedOffsetMicros": 2,
                "observedAtUtc": started,
                "capacity": 8,
                "depth": 0,
                "active": 0,
                "oldestAgeMs": null,
                "accepted": 1,
                "started": 1,
                "completed": 1,
                "failed": 0,
                "cancelled": 0,
                "superseded": 0,
                "rejected": 0
            })],
            resources: vec![json!({
                "schemaVersion": 1,
                "runId": RUN_ID,
                "sequence": 0,
                "intervalMs": 1000,
                "observedOffsetMicros": 3,
                "observedAtUtc": started,
                "process": {"scope":"process","cpuPercent":1.0,"memoryBytes":1024,"totalMemoryBytes":null},
                "system": {"scope":"system","cpuPercent":2.0,"memoryBytes":2048,"totalMemoryBytes":4096},
                "power": {"collector":"pmset","method":"local","source":{"status":"observed","value":"ac"},"batteryPercent":{"status":"observed","value":80.0},"energyImpact":{"status":"unknown","reason":"energy_impact_not_measured"},"uncertainty":null}
            })],
            routes: vec![json!({
                "recordType": "route",
                "runId": RUN_ID,
                "meetingId": MEETING_ID,
                "sequence": 0,
                "observedOffsetMicros": 4,
                "observedAtUtc": started,
                "route": {
                    "capability":"transcription",
                    "providerId":"local",
                    "modelId":"local-model",
                    "locationClass":"local",
                    "sanitizedOrigin":"This device",
                    "encrypted":true,
                    "validationState":"validated",
                    "resolvedAddresses":[]
                }
            })],
            errors: Vec::new(),
            result: json!({
                "schemaVersion": RUN_BUNDLE_SCHEMA_VERSION,
                "runId": RUN_ID,
                "meetingId": MEETING_ID,
                "outcome":"unknown",
                "outcomeReason":"thresholds_not_declared",
                "thresholdsDeclared":false,
                "checks":[{"id":"thresholds","status":"unknown","reason":"thresholds_not_declared"}],
                "counts":{"stages":1,"queues":1,"resources":1,"routes":1,"errors":0,"evidence":1,"gaps":0,"terminal":1},
                "evidenceCommits":[{"sequence":0,"evidenceId":"33333333-3333-4333-8333-333333333333","committedAtUtc":started}],
                "gaps":[],
                "terminal":{"sequence":0,"meetingId":MEETING_ID,"observedOffsetMicros":5,"observedAtUtc":started,"lifecycle":"complete","deadlineAtUtc":"2026-09-21T10:00:30Z","deadlineMs":30000,"remainingWorkCount":0,"gapCount":0,"errorCount":0},
                "outliers":[],
                "limitations":["thresholds_not_declared","energy_impact_not_measured"]
            }),
            summary: "# Evaluation run\n\nOutcome: Unknown\n\nNo thresholds declared.\n"
                .to_string(),
        }
    }

    fn environment_input() -> RunEnvironmentInput {
        RunEnvironmentInput {
            app_revision: EnvironmentFact::observed("revision-1"),
            os: EnvironmentFact::observed("macos"),
            hardware: EnvironmentFact::observed("reference-machine"),
            power: EnvironmentFact::unknown("energy_impact_not_measured"),
            devices: EnvironmentFact::observed("built-in microphone; system audio"),
            sample_configuration: EnvironmentFact::observed("48000hz; mono"),
            model: EnvironmentFact::observed("local-model"),
            route: EnvironmentFact::observed("local:this-device"),
            language: EnvironmentFact::observed("en"),
            limitations: vec!["energy_impact_not_measured".to_string()],
        }
    }

    #[tokio::test]
    async fn run_bundle_writer_serializes_one_durable_evaluation_run() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("in-memory bundle database");
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("bundle migrations");
        let meeting = MeetingsRepository::create_session(&pool, "Bundle fixture")
            .await
            .expect("canonical meeting");
        let run_id = Uuid::new_v4().to_string();
        let evidence_id = Uuid::new_v4().to_string();
        let observed_at = "2026-09-21T10:00:00+00:00";
        sqlx::query(
            "INSERT INTO evaluation_runs
             (run_id, schema_version, meeting_id, scenario_version, started_at_utc, created_at_utc)
             VALUES (?, 1, ?, 'short-utterance-v1', ?, ?)",
        )
        .bind(&run_id)
        .bind(&meeting.meeting_id)
        .bind(observed_at)
        .bind(observed_at)
        .execute(&pool)
        .await
        .expect("run manifest");
        sqlx::query(
            "INSERT INTO evaluation_stage_records
             (run_id, sequence, schema_version, meeting_id, work_id, evidence_id, stage_name,
              observed_offset_micros, observed_at_utc, record_fingerprint)
             VALUES (?, 0, 1, ?, 'work-1', ?, 'audio_captured', 1, ?, 'stage-fingerprint')",
        )
        .bind(&run_id)
        .bind(&meeting.meeting_id)
        .bind(&evidence_id)
        .bind(observed_at)
        .execute(&pool)
        .await
        .expect("stage record");
        sqlx::query(
            "INSERT INTO evaluation_queue_records
             (run_id, sequence, observed_offset_micros, observed_at_utc, capacity, depth, active,
              oldest_age_ms, accepted, started, completed, failed, cancelled, superseded,
              rejected, record_fingerprint)
             VALUES (?, 0, 2, ?, 8, 0, 0, NULL, 1, 1, 1, 0, 0, 0, 0, 'queue-fingerprint')",
        )
        .bind(&run_id)
        .bind(observed_at)
        .execute(&pool)
        .await
        .expect("queue record");
        sqlx::query(
            "INSERT INTO evaluation_terminal_records
             (run_id, sequence, meeting_id, observed_offset_micros, observed_at_utc, lifecycle,
              deadline_at_utc, deadline_ms, remaining_work_count, gap_count, error_count,
              record_fingerprint)
             VALUES (?, 0, ?, 3, ?, 'complete', '2026-09-21T10:00:30+00:00', 30000,
                     0, 0, 0, 'terminal-fingerprint')",
        )
        .bind(&run_id)
        .bind(&meeting.meeting_id)
        .bind(observed_at)
        .execute(&pool)
        .await
        .expect("terminal record");

        let app_data = tempfile::tempdir().expect("temporary app data");
        let finalized = finalize_run_bundle_with_pool(
            &pool,
            app_data.path(),
            FinalizeRunBundleRequest {
                run_id: run_id.clone(),
                environment: environment_input(),
            },
        )
        .await
        .expect("finalize durable evaluation run");
        assert_eq!(finalized.run_id, run_id);
        assert_eq!(finalized.meeting_id, meeting.meeting_id);
        assert!(finalized.validation.valid);

        let writer = RunBundleWriter::new(app_data.path());
        let summary = writer.read_summary(&run_id).expect("redacted summary");
        assert!(summary.contains("Outcome: Unknown"));
        assert!(!summary.contains("Bundle fixture"));
    }

    #[test]
    fn run_bundle_writer_contains_required_files_under_one_identity() {
        let app_data = tempfile::tempdir().expect("temporary app data");
        let writer = RunBundleWriter::new(app_data.path());
        let finalized = writer
            .write_documents(RUN_ID, MEETING_ID, &fixture_documents())
            .expect("write complete run bundle");
        assert_eq!(finalized.run_id, RUN_ID);
        assert_eq!(finalized.meeting_id, MEETING_ID);
        let bundle = app_data
            .path()
            .join(RUN_BUNDLE_DIRECTORY)
            .join(format!("run-{RUN_ID}"));
        for filename in REQUIRED_BUNDLE_FILES {
            assert!(bundle.join(filename).is_file(), "missing {filename}");
        }
    }

    #[test]
    fn run_bundle_writer_uses_atomic_directory_and_flags_interrupted_writes() {
        let app_data = tempfile::tempdir().expect("temporary app data");
        let writer = RunBundleWriter::new(app_data.path());
        writer
            .write_documents(RUN_ID, MEETING_ID, &fixture_documents())
            .expect("write complete run bundle");
        let root = app_data.path().join(RUN_BUNDLE_DIRECTORY);
        assert!(
            fs::read_dir(&root).expect("bundle root").all(|entry| !entry
                .expect("entry")
                .file_name()
                .to_string_lossy()
                .ends_with(".tmp")),
            "published bundle must not leave a temp directory"
        );

        let interrupted_run_id = Uuid::new_v4().to_string();
        fs::create_dir_all(root.join(format!(".run-{interrupted_run_id}.writer.tmp")))
            .expect("seed interrupted write");
        let listed = writer.list().expect("list local bundles");
        assert!(listed.iter().any(|item| {
            item.run_id == interrupted_run_id && item.status == RunBundleStatus::Interrupted
        }));
    }

    #[test]
    fn run_bundle_writer_rejects_sensitive_defaults_and_unsafe_identity() {
        let app_data = tempfile::tempdir().expect("temporary app data");
        let writer = RunBundleWriter::new(app_data.path());
        assert_eq!(
            writer
                .write_documents("../outside", MEETING_ID, &fixture_documents())
                .expect_err("unsafe run identity")
                .code(),
            "RUN_BUNDLE_INVALID_ID"
        );

        let mut sensitive = fixture_documents();
        sensitive.environment["model"] =
            serde_json::to_value(EnvironmentFact::observed("sk-private-credential"))
                .expect("sensitive fact");
        assert_eq!(
            writer
                .write_documents(RUN_ID, MEETING_ID, &sensitive)
                .expect_err("sensitive default")
                .code(),
            "RUN_BUNDLE_UNSAFE_CONTENT"
        );
    }

    #[test]
    fn diagnostic_queries_list_exposes_redacted_run_summary_facts() {
        let app_data = tempfile::tempdir().expect("temporary app data");
        let writer = RunBundleWriter::new(app_data.path());
        writer
            .write_documents(RUN_ID, MEETING_ID, &fixture_documents())
            .expect("write complete run bundle");

        let listed = writer.list().expect("list local bundles");
        let item = serde_json::to_value(&listed[0]).expect("serialize list projection");

        assert_eq!(item["scenario"], "short-utterance-v1");
        assert_eq!(item["startedAtUtc"], "2026-09-21T10:00:00Z");
        assert_eq!(item["outcome"], "unknown");
        assert_eq!(item["route"]["locationClass"], "local");
        assert_eq!(item["route"]["sanitizedOrigin"], "This device");
        assert_eq!(item["durationMs"], 0);
        assert!(item.get("path").is_none());
        assert!(item.get("transcript").is_none());
        assert!(item.get("audio").is_none());

        let detail = writer
            .read_diagnostics(RUN_ID)
            .expect("read typed diagnostic detail");
        assert_eq!(detail.result.outcome, EvidenceStatus::Unknown);
        assert_eq!(detail.result.limitations.len(), 2);
        assert_eq!(detail.environment.len(), 9);
        assert_eq!(detail.stages[0].stage, "audio_captured");
        assert_eq!(detail.queues[0].completed, 1);
        assert_eq!(detail.resources[0].process_memory_bytes, Some(1024));
        assert_eq!(
            detail.routes[0].route.sanitized_origin.as_deref(),
            Some("This device")
        );
        assert!(detail.errors.is_empty());
        let serialized = serde_json::to_string(&detail).expect("serialize detail projection");
        assert!(!serialized.contains("/Users/"));
        assert!(!serialized.contains("transcriptText"));
        assert!(!serialized.contains("audioIncluded"));
    }

    #[test]
    fn diagnostic_export_creates_a_sanitized_local_copy_without_mutating_source() {
        let source = include_str!("run_bundle.rs");
        let boundary = ["export_diagnostic", "copy_to"].join("_");
        assert!(
            source.contains(&boundary),
            "a reviewed local-copy export boundary must exist before export behavior can pass"
        );
    }
}
