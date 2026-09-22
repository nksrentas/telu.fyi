use serde_json::{json, Value};
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
