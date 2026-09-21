use app_lib::observability::run_bundle::{
    validate_run_bundle_dir, REQUIRED_BUNDLE_FILES, RUN_BUNDLE_SCHEMA_VERSION,
};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};

const RUN_ID: &str = "22222222-2222-4222-8222-222222222222";
const MEETING_ID: &str = "11111111-1111-4111-8111-111111111111";
const EVIDENCE_ID: &str = "33333333-3333-4333-8333-333333333333";
const OBSERVED_AT: &str = "2026-09-21T10:00:00Z";

fn write_json(path: &Path, value: &Value) {
    fs::write(
        path,
        serde_json::to_vec_pretty(value).expect("serialize JSON"),
    )
    .expect("write JSON fixture");
}

fn write_jsonl(path: &Path, values: &[Value]) {
    let mut bytes = Vec::new();
    for value in values {
        bytes.extend(serde_json::to_vec(value).expect("serialize JSON line"));
        bytes.push(b'\n');
    }
    fs::write(path, bytes).expect("write JSONL fixture");
}

fn write_fixture(root: &Path) -> PathBuf {
    let bundle = root.join(format!("run-{RUN_ID}"));
    fs::create_dir_all(&bundle).expect("create bundle fixture");
    write_json(
        &bundle.join("manifest.json"),
        &json!({
            "schemaVersion": RUN_BUNDLE_SCHEMA_VERSION,
            "evaluationSchemaVersion": 1,
            "runId": RUN_ID,
            "meetingId": MEETING_ID,
            "scenarioVersion": "short-utterance-v1",
            "startedAtUtc": OBSERVED_AT,
            "finalizedAtUtc": "2026-09-21T10:00:05Z",
            "requiredFiles": REQUIRED_BUNDLE_FILES,
            "contentPolicy": {
                "localOnly": true,
                "transcriptIncluded": false,
                "audioIncluded": false,
                "credentialsIncluded": false,
                "fullPathsIncluded": false
            }
        }),
    );
    write_json(
        &bundle.join("environment.json"),
        &json!({
            "schemaVersion": RUN_BUNDLE_SCHEMA_VERSION,
            "runId": RUN_ID,
            "meetingId": MEETING_ID,
            "scenarioVersion": "short-utterance-v1",
            "appRevision": {"status":"pass","value":"revision-1"},
            "os": {"status":"pass","value":"macos"},
            "hardware": {"status":"pass","value":"reference-machine"},
            "power": {"status":"unknown","value":null,"reason":"energy_impact_not_measured"},
            "devices": {"status":"pass","value":"built-in microphone; system audio"},
            "sampleConfiguration": {"status":"pass","value":"48000hz; mono"},
            "model": {"status":"pass","value":"local-model"},
            "route": {"status":"pass","value":"local:this-device"},
            "language": {"status":"pass","value":"en"},
            "configuration": {
                "queueCapacity": 8,
                "finalizationDeadlineMs": 30000,
                "stageSchemaVersion": 1,
                "resourceSchemaVersion": 1
            },
            "limitations": ["energy_impact_not_measured"]
        }),
    );
    write_jsonl(
        &bundle.join("stages.jsonl"),
        &[json!({
            "schemaVersion": 1,
            "sequence": 0,
            "runId": RUN_ID,
            "meetingId": MEETING_ID,
            "workId": "work-1",
            "evidenceId": EVIDENCE_ID,
            "stage": "audio_captured",
            "offsetMicros": 1,
            "observedAtUtc": OBSERVED_AT
        })],
    );
    write_jsonl(
        &bundle.join("queues.jsonl"),
        &[json!({
            "runId": RUN_ID,
            "sequence": 0,
            "observedOffsetMicros": 2,
            "observedAtUtc": OBSERVED_AT,
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
    );
    write_jsonl(
        &bundle.join("resources.jsonl"),
        &[json!({
            "schemaVersion": 1,
            "runId": RUN_ID,
            "sequence": 0,
            "intervalMs": 1000,
            "observedOffsetMicros": 3,
            "observedAtUtc": OBSERVED_AT,
            "process": {"scope":"process","cpuPercent":1.0,"memoryBytes":1024,"totalMemoryBytes":null},
            "system": {"scope":"system","cpuPercent":2.0,"memoryBytes":2048,"totalMemoryBytes":4096},
            "power": {
                "collector":"pmset",
                "method":"local",
                "source":{"status":"observed","value":"ac"},
                "batteryPercent":{"status":"observed","value":80.0},
                "energyImpact":{"status":"unknown","reason":"energy_impact_not_measured"},
                "uncertainty":null
            }
        })],
    );
    write_jsonl(
        &bundle.join("routes.jsonl"),
        &[json!({
            "recordType": "route",
            "runId": RUN_ID,
            "meetingId": MEETING_ID,
            "sequence": 0,
            "observedOffsetMicros": 4,
            "observedAtUtc": OBSERVED_AT,
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
    );
    write_jsonl(&bundle.join("errors.jsonl"), &[]);
    write_json(
        &bundle.join("result.json"),
        &json!({
            "schemaVersion": RUN_BUNDLE_SCHEMA_VERSION,
            "runId": RUN_ID,
            "meetingId": MEETING_ID,
            "outcome": "unknown",
            "outcomeReason": "thresholds_not_declared",
            "thresholdsDeclared": false,
            "checks": [{"id":"thresholds","status":"unknown","reason":"thresholds_not_declared"}],
            "counts": {"stages":1,"queues":1,"resources":1,"routes":1,"errors":0,"evidence":1,"gaps":0,"terminal":1},
            "evidenceCommits": [{"sequence":0,"evidenceId":EVIDENCE_ID,"committedAtUtc":OBSERVED_AT}],
            "gaps": [],
            "terminal": {
                "sequence":0,
                "meetingId":MEETING_ID,
                "observedOffsetMicros":5,
                "observedAtUtc":OBSERVED_AT,
                "lifecycle":"complete",
                "deadlineAtUtc":"2026-09-21T10:00:30Z",
                "deadlineMs":30000,
                "remainingWorkCount":0,
                "gapCount":0,
                "errorCount":0
            },
            "outliers": ["resource_cpu_spike"],
            "limitations": ["thresholds_not_declared","energy_impact_not_measured"]
        }),
    );
    fs::write(
        bundle.join("summary.md"),
        "# Evaluation run\n\nOutcome: Unknown\n\nNo thresholds declared.\n",
    )
    .expect("write summary fixture");
    bundle
}

fn read_json(path: &Path) -> Value {
    serde_json::from_slice(&fs::read(path).expect("read JSON fixture")).expect("parse JSON fixture")
}

#[test]
fn valid_fixture_preserves_unknowns_outliers_and_limitations() {
    let root = tempfile::tempdir().expect("temporary bundle root");
    let bundle = write_fixture(root.path());

    let report = validate_run_bundle_dir(&bundle).expect("validate fixture");
    assert!(
        report.valid,
        "valid fixture rejected: {:?}",
        report.error_codes
    );
    let result = read_json(&bundle.join("result.json"));
    assert_eq!(result["outcome"], "unknown");
    assert_eq!(result["outliers"], json!(["resource_cpu_spike"]));
    assert_eq!(
        result["limitations"],
        json!(["thresholds_not_declared", "energy_impact_not_measured"])
    );
}

#[test]
fn rejects_missing_files_reserved_stages_order_and_queue_conservation() {
    let missing_root = tempfile::tempdir().expect("missing-file root");
    let missing = write_fixture(missing_root.path());
    fs::remove_file(missing.join("resources.jsonl")).expect("remove required file");
    let report = validate_run_bundle_dir(&missing).expect("validate missing file");
    assert!(report
        .error_codes
        .contains(&"RUN_BUNDLE_MISSING_FILE".to_string()));

    let stage_root = tempfile::tempdir().expect("stage root");
    let stage_bundle = write_fixture(stage_root.path());
    write_jsonl(
        &stage_bundle.join("stages.jsonl"),
        &[
            json!({"schemaVersion":1,"sequence":1,"runId":RUN_ID,"meetingId":MEETING_ID,"workId":"work-1","evidenceId":EVIDENCE_ID,"stage":"audio_captured","offsetMicros":2,"observedAtUtc":OBSERVED_AT}),
            json!({"schemaVersion":1,"sequence":2,"runId":RUN_ID,"meetingId":MEETING_ID,"workId":"work-2","evidenceId":"44444444-4444-4444-8444-444444444444","stage":"future_suggestion_generated","offsetMicros":3,"observedAtUtc":OBSERVED_AT}),
            json!({"schemaVersion":1,"sequence":0,"runId":RUN_ID,"meetingId":MEETING_ID,"workId":"work-1","evidenceId":EVIDENCE_ID,"stage":"segment_boundary","offsetMicros":1,"observedAtUtc":OBSERVED_AT}),
        ],
    );
    let report = validate_run_bundle_dir(&stage_bundle).expect("validate stage violations");
    assert!(report
        .error_codes
        .contains(&"RUN_BUNDLE_RESERVED_STAGE".to_string()));
    assert!(report
        .error_codes
        .contains(&"RUN_BUNDLE_ORDER_VIOLATION".to_string()));

    let queue_root = tempfile::tempdir().expect("queue root");
    let queue_bundle = write_fixture(queue_root.path());
    let mut queue = serde_json::from_str::<Value>(
        &fs::read_to_string(queue_bundle.join("queues.jsonl")).expect("queue fixture"),
    )
    .expect("queue JSON");
    queue["accepted"] = json!(2);
    write_jsonl(&queue_bundle.join("queues.jsonl"), &[queue]);
    let report = validate_run_bundle_dir(&queue_bundle).expect("validate queue conservation");
    assert!(report
        .error_codes
        .contains(&"RUN_BUNDLE_QUEUE_CONSERVATION".to_string()));

    let evidence_root = tempfile::tempdir().expect("evidence root");
    let evidence_bundle = write_fixture(evidence_root.path());
    write_jsonl(&evidence_bundle.join("stages.jsonl"), &[]);
    let report = validate_run_bundle_dir(&evidence_bundle).expect("validate missing evidence");
    assert!(report
        .error_codes
        .contains(&"RUN_BUNDLE_MISSING_REQUIRED_EVIDENCE".to_string()));
}

#[test]
fn rejects_malformed_timestamps_and_unsorted_evidence_commits() {
    let timestamp_root = tempfile::tempdir().expect("timestamp root");
    let timestamp_bundle = write_fixture(timestamp_root.path());
    let mut manifest = read_json(&timestamp_bundle.join("manifest.json"));
    manifest["startedAtUtc"] = json!("not-a-timestamp");
    write_json(&timestamp_bundle.join("manifest.json"), &manifest);
    let report = validate_run_bundle_dir(&timestamp_bundle).expect("validate malformed timestamp");
    assert!(report
        .error_codes
        .contains(&"RUN_BUNDLE_MALFORMED".to_string()));

    let order_root = tempfile::tempdir().expect("evidence-order root");
    let order_bundle = write_fixture(order_root.path());
    let mut result = read_json(&order_bundle.join("result.json"));
    result["evidenceCommits"] = json!([
        {"sequence":1,"evidenceId":"44444444-4444-4444-8444-444444444444","committedAtUtc":"2026-09-21T10:00:01Z"},
        {"sequence":0,"evidenceId":EVIDENCE_ID,"committedAtUtc":OBSERVED_AT}
    ]);
    result["counts"]["evidence"] = json!(2);
    write_json(&order_bundle.join("result.json"), &result);
    let report = validate_run_bundle_dir(&order_bundle).expect("validate evidence ordering");
    assert!(report
        .error_codes
        .contains(&"RUN_BUNDLE_ORDER_VIOLATION".to_string()));
}

#[test]
fn interrupted_and_sensitive_bundles_are_invalid() {
    let interrupted_root = tempfile::tempdir().expect("interrupted root");
    let interrupted = interrupted_root
        .path()
        .join(format!(".run-{RUN_ID}.writer.tmp"));
    fs::create_dir_all(&interrupted).expect("create interrupted directory");
    let report = validate_run_bundle_dir(&interrupted).expect("validate interrupted bundle");
    assert_eq!(report.error_codes, vec!["RUN_BUNDLE_INTERRUPTED_WRITE"]);

    for sensitive in [
        "Bearer hidden-token",
        "sk-private-secret",
        "/Users/alice/private/meeting.wav",
    ] {
        let root = tempfile::tempdir().expect("sensitive root");
        let bundle = write_fixture(root.path());
        let mut environment = read_json(&bundle.join("environment.json"));
        environment["model"] = json!({"status":"pass","value":sensitive});
        write_json(&bundle.join("environment.json"), &environment);
        let report = validate_run_bundle_dir(&bundle).expect("validate sensitive bundle");
        assert!(report
            .error_codes
            .contains(&"RUN_BUNDLE_SENSITIVE_CONTENT".to_string()));
    }

    let root = tempfile::tempdir().expect("content root");
    let bundle = write_fixture(root.path());
    let mut result = read_json(&bundle.join("result.json"));
    result["transcript"] = json!("meeting words must never enter an evaluation bundle");
    write_json(&bundle.join("result.json"), &result);
    let report = validate_run_bundle_dir(&bundle).expect("validate content-bearing key");
    assert!(report
        .error_codes
        .contains(&"RUN_BUNDLE_SENSITIVE_CONTENT".to_string()));
}
