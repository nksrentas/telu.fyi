//! Atomic, local-only evaluation run bundles.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};

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
    #[error("run bundle writer is unavailable")]
    Unavailable,
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
}

impl RunBundleError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Unavailable => "RUN_BUNDLE_UNAVAILABLE",
            Self::InvalidRunId => "RUN_BUNDLE_INVALID_ID",
            Self::UnsafeContent => "RUN_BUNDLE_UNSAFE_CONTENT",
            Self::InterruptedWrite => "RUN_BUNDLE_INTERRUPTED_WRITE",
            Self::InvalidBundle => "RUN_BUNDLE_INVALID",
            Self::Storage => "RUN_BUNDLE_STORAGE_FAILED",
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
        _run_id: &str,
        _meeting_id: &str,
        _documents: &BundleDocuments,
    ) -> Result<FinalizedRunBundle, RunBundleError> {
        let _ = &self.root;
        Err(RunBundleError::Unavailable)
    }

    pub fn list(&self) -> Result<Vec<RunBundleListItem>, RunBundleError> {
        let _ = &self.root;
        Err(RunBundleError::Unavailable)
    }
}

pub fn validate_run_bundle_dir(
    _path: impl AsRef<Path>,
) -> Result<RunBundleValidationReport, RunBundleError> {
    Err(RunBundleError::Unavailable)
}

#[cfg(test)]
mod run_bundle_writer_tests {
    use super::*;
    use serde_json::json;
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
                "thresholdsDeclared":false,
                "checks":[{"id":"thresholds","status":"unknown","reason":"thresholds_not_declared"}],
                "counts":{"stages":1,"queues":1,"resources":1,"routes":1,"errors":0,"evidence":1,"gaps":0,"terminal":1},
                "evidenceCommits":[{"sequence":0,"evidenceId":"33333333-3333-4333-8333-333333333333","committedAtUtc":started}],
                "gaps":[],
                "terminal":{"sequence":0,"meetingId":MEETING_ID,"observedOffsetMicros":5,"observedAtUtc":started,"lifecycle":"complete","deadlineAtUtc":"2026-09-21T10:00:30Z","deadlineMs":30000,"remainingWorkCount":0,"gapCount":0,"errorCount":0},
                "outliers":[],
                "limitations":["thresholds_not_declared","energy_impact_not_measured"]
            }),
            summary: "# Evaluation run\n\nOutcome: Unknown\n\nNo thresholds declared.\n".to_string(),
        }
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
            fs::read_dir(&root)
                .expect("bundle root")
                .all(|entry| !entry.expect("entry").file_name().to_string_lossy().ends_with(".tmp")),
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
        sensitive.environment["model"] = serde_json::to_value(EnvironmentFact::observed(
            "sk-private-credential",
        ))
        .expect("sensitive fact");
        assert_eq!(
            writer
                .write_documents(RUN_ID, MEETING_ID, &sensitive)
                .expect_err("sensitive default")
                .code(),
            "RUN_BUNDLE_UNSAFE_CONTENT"
        );
    }
}
