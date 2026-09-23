use app_lib::observability::baseline_assignment::{
    claim_assignment, write_pending_assignment, AssignmentEnvironment, AssignmentFact,
    AssignmentFactStatus, BaselineAssignmentError, BaselineRunAssignment,
    BASELINE_ASSIGNMENT_SCHEMA_VERSION,
};
use chrono::{Duration, Utc};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

const REQUIRED_SCENARIOS: [&str; 10] = [
    "short_utterance",
    "continuous_speech",
    "overlapping_speech",
    "sustained_system_audio",
    "overload",
    "stop",
    "restart",
    "crash",
    "repeated_recovery",
    "network_blocked",
];
const REQUIRED_METRICS: [&str; 5] = [
    "endToEndMicros",
    "queueOldestAgeMs",
    "queueDepth",
    "processCpuPercent",
    "processMemoryBytes",
];

fn runner() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_telu-baseline"))
}

fn fixture() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/baseline/manifest-v1.json")
}

fn run(args: &[&str]) -> Output {
    Command::new(runner())
        .args(args)
        .output()
        .expect("run telu-baseline")
}

fn parse_stdout(output: &Output) -> Value {
    serde_json::from_slice(&output.stdout).unwrap_or_else(|error| {
        panic!(
            "runner stdout was not JSON ({error}); stderr={}",
            String::from_utf8_lossy(&output.stderr)
        )
    })
}

fn copy_fixture(root: &Path) -> PathBuf {
    let path = root.join("manifest.json");
    fs::copy(fixture(), &path).expect("copy manifest fixture");
    path
}

fn approved_manifest(root: &Path) -> PathBuf {
    let path = copy_fixture(root);
    let proposal = parse_stdout(&run(&["propose-reference"]));
    let revision = proposal["referenceProfile"]["appRevision"]["value"]
        .as_str()
        .expect("embedded app revision");
    let mut value: Value =
        serde_json::from_slice(&fs::read(&path).expect("read manifest")).expect("manifest JSON");
    value["referenceProfile"]["status"] = json!("approved");
    value["referenceProfile"]["appRevision"] = json!({"status":"observed","value":revision});
    for (field, fact) in [
        ("power", "power-method-p1"),
        ("devices", "built-in-microphone-and-system-audio"),
        ("model", "parakeet-tdt-0.6b-v3-int8"),
        ("language", "english"),
        ("networkCanaryMethod", "network-method-n1"),
    ] {
        value["referenceProfile"][field] = json!({"status":"observed","value":fact});
    }
    fs::write(
        &path,
        serde_json::to_vec_pretty(&value).expect("approved manifest JSON"),
    )
    .expect("write approved manifest");
    path
}

fn observed_assignment_fact(value: &str) -> AssignmentFact {
    AssignmentFact {
        status: AssignmentFactStatus::Observed,
        value: Some(value.to_string()),
        reason: None,
    }
}

fn sealed_assignment(now: chrono::DateTime<Utc>) -> BaselineRunAssignment {
    BaselineRunAssignment {
        schema_version: BASELINE_ASSIGNMENT_SCHEMA_VERSION,
        assignment_id: "11111111-1111-4111-8111-111111111111".to_string(),
        authorization: "approved".to_string(),
        source: "telu-baseline-authorize-run-v1".to_string(),
        matrix_id: "phase1-matrix".to_string(),
        matrix_plan_sha256: "a".repeat(64),
        run_sequence: 0,
        run_id: "22222222-2222-4222-8222-222222222222".to_string(),
        scenario_id: "short_utterance".to_string(),
        scenario_version: "phase1-baseline-v1".to_string(),
        run_kind: "measured".to_string(),
        repeat_index: 0,
        bundle_directory: "run-22222222-2222-4222-8222-222222222222".to_string(),
        app_revision: "b".repeat(40),
        issued_at_utc: now,
        expires_at_utc: now + Duration::minutes(30),
        environment: AssignmentEnvironment {
            os: observed_assignment_fact("macos"),
            hardware: observed_assignment_fact("apple-m4"),
            power: observed_assignment_fact("power-method-p1"),
            devices: observed_assignment_fact("built-in"),
            sample_configuration: observed_assignment_fact("48000hz"),
            model: observed_assignment_fact("parakeet"),
            route: observed_assignment_fact("local-this-device"),
            language: observed_assignment_fact("english"),
            network_canary_method: observed_assignment_fact("network-method-n1"),
        },
        integrity_sha256: String::new(),
    }
    .seal()
    .expect("seal assignment")
}

fn sha256(path: &Path) -> String {
    format!("{:x}", Sha256::digest(fs::read(path).expect("hash input")))
}

fn aggregate(created_at: &str, outlier: Option<Value>) -> Value {
    let runs = REQUIRED_SCENARIOS
        .iter()
        .enumerate()
        .flat_map(|(scenario_index, scenario)| {
            let scenario_outlier = outlier.clone();
            (0..2).map(move |repeat| {
                json!({
                    "sequence": scenario_index * 2 + repeat,
                    "scenarioId": scenario,
                    "runKind": "measured",
                    "repeatIndex": repeat,
                    "runId": uuid::Uuid::new_v4().to_string(),
                    "status": "pass",
                    "outliers": if scenario_index == 0 && repeat == 0 {
                        scenario_outlier.clone().into_iter().collect::<Vec<_>>()
                    } else {
                        Vec::new()
                    },
                })
            })
        })
        .collect::<Vec<_>>();
    let scenario_aggregates = REQUIRED_SCENARIOS
        .iter()
        .map(|scenario| {
            let distributions = REQUIRED_METRICS
                .iter()
                .map(|metric| {
                    (
                        (*metric).to_string(),
                        json!({"count":2,"values":[1.0,2.0],"min":1.0,"max":2.0}),
                    )
                })
                .collect::<serde_json::Map<_, _>>();
            json!({
                "scenarioId": scenario,
                "status": "pass",
                "distributions": distributions,
                "outliers": [],
            })
        })
        .collect::<Vec<_>>();
    json!({
        "schemaVersion": 1,
        "matrixId": "phase1-matrix",
        "scenarioVersion": "phase1-baseline-v1",
        "createdAtUtc": created_at,
        "runs": runs,
        "scenarioAggregates": scenario_aggregates,
    })
}

fn write_gate(
    root: &Path,
    review: &Value,
    validation: &Value,
    mutate: impl FnOnce(&mut Value),
) -> PathBuf {
    let review_path = root.join("review.json");
    let validation_path = root.join("validation.json");
    fs::write(
        &review_path,
        serde_json::to_vec_pretty(review).expect("review JSON"),
    )
    .expect("write review");
    fs::write(
        &validation_path,
        serde_json::to_vec_pretty(validation).expect("validation JSON"),
    )
    .expect("write validation");
    let review_outliers = review["runs"]
        .as_array()
        .expect("review runs")
        .iter()
        .flat_map(|run| run["outliers"].as_array().into_iter().flatten().cloned())
        .collect::<Vec<_>>();
    let validation_outliers = validation["runs"]
        .as_array()
        .expect("validation runs")
        .iter()
        .flat_map(|run| run["outliers"].as_array().into_iter().flatten().cloned())
        .collect::<Vec<_>>();
    let mut gate = json!({
        "schemaVersion": 1,
        "reviewAggregate": {"path":"review.json","sha256":sha256(&review_path)},
        "validationAggregate": {"path":"validation.json","sha256":sha256(&validation_path)},
        "thresholdDeclaration": {
            "declaredAtUtc":"2026-09-23T10:30:00Z",
            "validationStartedAtUtc":"2026-09-23T11:00:00Z",
            "metrics": REQUIRED_METRICS.iter().map(|id| json!({"id":id,"limit":10.0,"operator":"max"})).collect::<Vec<_>>(),
        },
        "scenarioResults": REQUIRED_SCENARIOS.iter().map(|id| json!({"id":id,"status":"pass"})).collect::<Vec<_>>(),
        "metricResults": REQUIRED_METRICS.iter().map(|id| json!({"id":id,"status":"pass"})).collect::<Vec<_>>(),
        "retainedOutliers": {"review":review_outliers,"validation":validation_outliers},
        "phase2": {"disposition":"go","evidenceStatus":"pass"},
        "phase4": {"disposition":"go","evidenceStatus":"pass"},
    });
    mutate(&mut gate);
    let gate_path = root.join("baseline-gate.md");
    fs::write(
        &gate_path,
        format!(
            "# Baseline gate\n\n```json\n{}\n```\n",
            serde_json::to_string_pretty(&gate).expect("gate JSON")
        ),
    )
    .expect("write gate");
    gate_path
}

#[test]
fn valid_manifest_lists_the_complete_ordered_matrix() {
    let manifest = fixture();
    let output = run(&["validate", manifest.to_str().expect("fixture path")]);
    assert!(
        output.status.success(),
        "valid manifest rejected: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report = parse_stdout(&output);
    assert_eq!(report["valid"], true);
    assert_eq!(report["scenarioCount"], 10);
    assert_eq!(
        report["scenarios"],
        Value::Array(REQUIRED_SCENARIOS.map(|id| json!(id)).to_vec())
    );
}

#[test]
fn invalid_missing_and_empty_manifests_fail_loud() {
    let root = tempfile::tempdir().expect("manifest tempdir");
    let missing = root.path().join("missing.json");
    assert!(!run(&["validate", missing.to_str().expect("missing path")])
        .status
        .success());

    let empty = root.path().join("empty.json");
    fs::write(&empty, "").expect("empty manifest");
    assert!(!run(&["validate", empty.to_str().expect("empty path")])
        .status
        .success());

    let manifest = copy_fixture(root.path());
    let mut value: Value =
        serde_json::from_slice(&fs::read(&manifest).expect("read fixture")).expect("fixture JSON");
    value["scenarios"] = json!([]);
    fs::write(
        &manifest,
        serde_json::to_vec_pretty(&value).expect("serialize empty matrix"),
    )
    .expect("write empty matrix");
    assert!(
        !run(&["validate", manifest.to_str().expect("manifest path")])
            .status
            .success()
    );
}

#[test]
fn repeated_same_configuration_runs_keep_distinct_ids_and_manifest_order() {
    let root = tempfile::tempdir().expect("matrix tempdir");
    let output_path = root.path().join("matrix-plan.json");
    let output = run(&[
        "plan",
        fixture().to_str().expect("fixture path"),
        output_path.to_str().expect("output path"),
    ]);
    assert!(
        output.status.success(),
        "matrix plan failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let plan: Value = serde_json::from_slice(&fs::read(&output_path).expect("read matrix plan"))
        .expect("matrix plan JSON");
    let runs = plan["runs"].as_array().expect("runs array");
    assert_eq!(runs.len(), REQUIRED_SCENARIOS.len() * 3);

    let mut ids = std::collections::BTreeSet::new();
    for (scenario_index, scenario) in REQUIRED_SCENARIOS.iter().enumerate() {
        let slice = &runs[scenario_index * 3..scenario_index * 3 + 3];
        assert!(slice.iter().all(|run| run["scenarioId"] == *scenario));
        assert_eq!(slice[0]["runKind"], "warmup");
        assert_eq!(slice[1]["runKind"], "measured");
        assert_eq!(slice[2]["runKind"], "measured");
        for run in slice {
            let id = run["runId"].as_str().expect("run ID");
            assert!(uuid::Uuid::parse_str(id).is_ok());
            assert!(ids.insert(id.to_string()), "duplicate run ID {id}");
            assert_eq!(run["status"], "unverified");
            assert_eq!(run["bundleDirectory"], format!("run-{id}"));
        }
    }
}

#[test]
fn proposed_profile_and_unrun_platforms_remain_unknown_or_unverified() {
    let output = run(&["validate", fixture().to_str().expect("fixture path")]);
    assert!(output.status.success());
    let report = parse_stdout(&output);
    assert_eq!(report["referenceStatus"], "proposed");
    assert_eq!(
        report["missingRequiredFields"],
        json!([
            "power",
            "devices",
            "model",
            "language",
            "networkCanaryMethod"
        ])
    );
    assert_eq!(
        report["unverifiedPlatforms"],
        json!(["macos", "windows", "linux"])
    );
}

#[test]
fn current_host_capture_is_proposed_redacted_and_explicitly_incomplete() {
    let output = run(&["propose-reference"]);
    assert!(
        output.status.success(),
        "host proposal failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let proposal = parse_stdout(&output);
    assert_eq!(proposal["referenceProfile"]["status"], "proposed");
    assert_eq!(proposal["note"], "proposed_only_not_approved");
    assert_eq!(
        proposal["missingRequiredFields"],
        json!([
            "power",
            "devices",
            "model",
            "language",
            "networkCanaryMethod"
        ])
    );
    let serialized = serde_json::to_string(&proposal).expect("serialize proposal");
    assert!(!serialized.contains("/Users/"));
    assert!(!serialized.contains("serial_number"));
    assert!(!serialized.contains("platform_UUID"));
}

#[test]
fn aggregate_rejects_invalid_bundles_through_the_plan_17_validator() {
    let root = tempfile::tempdir().expect("aggregate tempdir");
    let plan_path = root.path().join("matrix-plan.json");
    let plan_output = run(&[
        "plan",
        fixture().to_str().expect("fixture path"),
        plan_path.to_str().expect("plan path"),
    ]);
    assert!(plan_output.status.success());
    let plan: Value =
        serde_json::from_slice(&fs::read(&plan_path).expect("read plan")).expect("plan JSON");
    let run_id = plan["runs"][0]["runId"].as_str().expect("first run ID");
    let bundle_root = root.path().join("bundles");
    let invalid_bundle = bundle_root.join(format!("run-{run_id}"));
    fs::create_dir_all(&invalid_bundle).expect("invalid bundle directory");
    fs::write(invalid_bundle.join("manifest.json"), "{}").expect("invalid manifest");
    let report_path = root.path().join("aggregate.json");

    let output = run(&[
        "aggregate",
        fixture().to_str().expect("fixture path"),
        plan_path.to_str().expect("plan path"),
        bundle_root.to_str().expect("bundle root"),
        report_path.to_str().expect("report path"),
    ]);
    assert!(!output.status.success(), "invalid bundle was aggregated");
    assert!(!report_path.exists(), "invalid evidence published a report");
}

#[test]
fn aggregate_preserves_missing_runs_as_unknown_and_never_overwrites_inputs() {
    let root = tempfile::tempdir().expect("aggregate tempdir");
    let plan_path = root.path().join("matrix-plan.json");
    let plan_output = run(&[
        "plan",
        fixture().to_str().expect("fixture path"),
        plan_path.to_str().expect("plan path"),
    ]);
    assert!(plan_output.status.success());
    let bundle_root = root.path().join("bundles");
    fs::create_dir(&bundle_root).expect("empty bundle root");
    let report_path = root.path().join("aggregate.json");

    let before = fs::read_dir(&bundle_root)
        .expect("bundle root before")
        .count();
    let output = run(&[
        "aggregate",
        fixture().to_str().expect("fixture path"),
        plan_path.to_str().expect("plan path"),
        bundle_root.to_str().expect("bundle root"),
        report_path.to_str().expect("report path"),
    ]);
    assert!(
        output.status.success(),
        "missing evidence must remain unknown: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert_eq!(
        fs::read_dir(&bundle_root)
            .expect("bundle root after")
            .count(),
        before,
        "aggregation modified raw bundle storage"
    );
    let report: Value = serde_json::from_slice(&fs::read(&report_path).expect("aggregate report"))
        .expect("aggregate JSON");
    assert_eq!(report["outcome"], "unknown");
    assert!(report["runs"]
        .as_array()
        .expect("aggregate runs")
        .iter()
        .all(|run| run["status"] == "unknown" && run["reason"] == "bundle_missing"));

    let second = run(&[
        "aggregate",
        fixture().to_str().expect("fixture path"),
        plan_path.to_str().expect("plan path"),
        bundle_root.to_str().expect("bundle root"),
        report_path.to_str().expect("report path"),
    ]);
    assert!(!second.status.success(), "aggregate report was overwritten");
}

#[test]
fn authorize_run_binds_one_approved_planned_identity_and_rejects_duplicate_or_mismatch() {
    let root = tempfile::tempdir().expect("authorization tempdir");
    let manifest = approved_manifest(root.path());
    let plan = root.path().join("matrix-plan.json");
    assert!(run(&[
        "plan",
        manifest.to_str().expect("manifest path"),
        plan.to_str().expect("plan path"),
    ])
    .status
    .success());
    let app_data = root.path().join("app-data");
    fs::create_dir(&app_data).expect("app data");
    let authorized = run(&[
        "authorize-run",
        manifest.to_str().expect("manifest path"),
        plan.to_str().expect("plan path"),
        "0",
        "--app-data-dir",
        app_data.to_str().expect("app data path"),
    ]);
    assert!(
        authorized.status.success(),
        "authorization failed: {}",
        String::from_utf8_lossy(&authorized.stderr)
    );
    let report = parse_stdout(&authorized);
    let assignment_id = report["assignmentId"].as_str().expect("assignment ID");
    let assignment_path = app_data
        .join("baseline-assignments/pending")
        .join(format!("{assignment_id}.json"));
    let assignment: Value =
        serde_json::from_slice(&fs::read(assignment_path).expect("pending assignment"))
            .expect("assignment JSON");
    let plan_value: Value =
        serde_json::from_slice(&fs::read(&plan).expect("plan bytes")).expect("plan JSON");
    assert_eq!(assignment["runId"], plan_value["runs"][0]["runId"]);
    assert_eq!(assignment["scenarioId"], "short_utterance");
    assert_eq!(assignment["scenarioVersion"], "phase1-baseline-v1");
    assert_eq!(
        report["launchEnvironment"]["name"],
        "TELU_BASELINE_ASSIGNMENT_ID"
    );

    let duplicate = run(&[
        "authorize-run",
        manifest.to_str().expect("manifest path"),
        plan.to_str().expect("plan path"),
        "0",
        "--app-data-dir",
        app_data.to_str().expect("app data path"),
    ]);
    assert!(
        !duplicate.status.success(),
        "same planned run authorized twice"
    );

    let mut mismatched_plan = plan_value;
    mismatched_plan["runs"][1]["scenarioId"] = json!("overload");
    let mismatch_path = root.path().join("mismatched-plan.json");
    fs::write(
        &mismatch_path,
        serde_json::to_vec_pretty(&mismatched_plan).expect("mismatched plan JSON"),
    )
    .expect("write mismatched plan");
    let mismatch = run(&[
        "authorize-run",
        manifest.to_str().expect("manifest path"),
        mismatch_path.to_str().expect("mismatch path"),
        "1",
        "--app-data-dir",
        app_data.to_str().expect("app data path"),
    ]);
    assert!(
        !mismatch.status.success(),
        "scenario mismatch was authorized"
    );
}

#[test]
fn authorize_run_rejects_unapproved_reference_and_unknown_build_binding() {
    let root = tempfile::tempdir().expect("unapproved tempdir");
    let manifest = copy_fixture(root.path());
    let plan = root.path().join("matrix-plan.json");
    assert!(run(&[
        "plan",
        manifest.to_str().expect("manifest path"),
        plan.to_str().expect("plan path"),
    ])
    .status
    .success());
    let app_data = root.path().join("app-data");
    fs::create_dir(&app_data).expect("app data");
    let output = run(&[
        "authorize-run",
        manifest.to_str().expect("manifest path"),
        plan.to_str().expect("plan path"),
        "0",
        "--app-data-dir",
        app_data.to_str().expect("app data path"),
    ]);
    assert!(
        !output.status.success(),
        "unapproved reference authorized a run"
    );
}

#[test]
fn assignment_claim_rejects_absent_malformed_stale_revision_mismatch_tamper_and_reuse() {
    let root = tempfile::tempdir().expect("assignment tempdir");
    let now = Utc::now();
    let assignment = sealed_assignment(now);

    assert_eq!(
        claim_assignment(
            root.path(),
            &assignment.assignment_id,
            &assignment.app_revision,
            now,
        ),
        Err(BaselineAssignmentError::Unauthorized)
    );

    let pending = root.path().join("baseline-assignments/pending");
    fs::create_dir_all(&pending).expect("pending directory");
    fs::write(
        pending.join(format!("{}.json", assignment.assignment_id)),
        b"not-json",
    )
    .expect("malformed assignment");
    assert_eq!(
        claim_assignment(
            root.path(),
            &assignment.assignment_id,
            &assignment.app_revision,
            now,
        ),
        Err(BaselineAssignmentError::Invalid)
    );
    fs::remove_file(pending.join(format!("{}.json", assignment.assignment_id)))
        .expect("remove malformed assignment");

    write_pending_assignment(root.path(), &assignment).expect("write assignment");
    assert_eq!(
        claim_assignment(root.path(), &assignment.assignment_id, &"c".repeat(40), now),
        Err(BaselineAssignmentError::RevisionMismatch)
    );
    assert_eq!(
        claim_assignment(
            root.path(),
            &assignment.assignment_id,
            &assignment.app_revision,
            now + Duration::hours(1),
        ),
        Err(BaselineAssignmentError::Stale)
    );

    let assignment_path = pending.join(format!("{}.json", assignment.assignment_id));
    let mut tampered: Value = serde_json::from_slice(
        &fs::read(&assignment_path).expect("read pending assignment"),
    )
    .expect("assignment JSON");
    tampered["scenarioId"] = json!("overload");
    fs::write(
        &assignment_path,
        serde_json::to_vec_pretty(&tampered).expect("tampered assignment JSON"),
    )
    .expect("tamper assignment");
    assert_eq!(
        claim_assignment(
            root.path(),
            &assignment.assignment_id,
            &assignment.app_revision,
            now,
        ),
        Err(BaselineAssignmentError::Invalid)
    );

    fs::write(
        &assignment_path,
        serde_json::to_vec_pretty(&assignment).expect("assignment JSON"),
    )
    .expect("restore assignment");
    claim_assignment(
        root.path(),
        &assignment.assignment_id,
        &assignment.app_revision,
        now,
    )
    .expect("claim valid assignment");
    assert_eq!(
        claim_assignment(
            root.path(),
            &assignment.assignment_id,
            &assignment.app_revision,
            now,
        ),
        Err(BaselineAssignmentError::Reused)
    );
}

#[test]
fn verify_gate_accepts_ordered_complete_evidence_and_retained_outliers() {
    let root = tempfile::tempdir().expect("gate tempdir");
    let review = aggregate(
        "2026-09-23T10:00:00Z",
        Some(json!({"id":"review-outlier","reason":"retained"})),
    );
    let validation = aggregate(
        "2026-09-23T12:00:00Z",
        Some(json!({"id":"validation-outlier","reason":"retained"})),
    );
    let gate = write_gate(root.path(), &review, &validation, |_| {});
    let output = run(&["verify-gate", gate.to_str().expect("gate path")]);
    assert!(
        output.status.success(),
        "valid gate rejected: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let report = parse_stdout(&output);
    assert_eq!(report["valid"], true);
    assert_eq!(report["reviewRunCount"], 20);
    assert_eq!(report["validationRunCount"], 20);
}

#[test]
fn verify_gate_fails_closed_for_empty_missing_late_lost_or_unknown_go_evidence() {
    for name in [
        "zero-runs",
        "duplicate-run-id",
        "out-of-order-run",
        "missing-scenario",
        "missing-metric",
        "late-threshold",
        "lost-outlier",
        "unknown-go",
        "fail-go",
    ] {
        let root = tempfile::tempdir().expect("invalid gate tempdir");
        let mut review = aggregate("2026-09-23T10:00:00Z", Some(json!({"id":"review-outlier"})));
        let validation = aggregate("2026-09-23T12:00:00Z", None);
        match name {
            "zero-runs" => review["runs"] = json!([]),
            "duplicate-run-id" => {
                review["runs"][1]["runId"] = review["runs"][0]["runId"].clone();
            }
            "out-of-order-run" => {
                review["runs"].as_array_mut().expect("runs").swap(0, 1);
            }
            "missing-scenario" => {
                review["scenarioAggregates"]
                    .as_array_mut()
                    .expect("scenarios")
                    .pop();
            }
            "missing-metric" => {
                review["scenarioAggregates"][0]["distributions"]
                    .as_object_mut()
                    .expect("distributions")
                    .remove("queueDepth");
            }
            _ => {}
        }
        let gate = write_gate(root.path(), &review, &validation, |gate| match name {
            "late-threshold" => {
                gate["thresholdDeclaration"]["declaredAtUtc"] = json!("2026-09-23T11:30:00Z");
                gate["thresholdDeclaration"]["validationStartedAtUtc"] =
                    json!("2026-09-23T11:00:00Z");
            }
            "lost-outlier" => gate["retainedOutliers"]["review"] = json!([]),
                "unknown-go" => {
                gate["metricResults"][0]["status"] = json!("unknown");
                gate["phase2"] = json!({"disposition":"go","evidenceStatus":"unknown"});
                }
                "fail-go" => {
                    gate["metricResults"][0]["status"] = json!("fail");
                    gate["phase4"] =
                        json!({"disposition":"go","evidenceStatus":"fail"});
                }
            _ => {}
        });
        let output = run(&["verify-gate", gate.to_str().expect("gate path")]);
        assert!(!output.status.success(), "{name} evidence passed the gate");
    }
}
