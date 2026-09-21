use app_lib::observability::run_bundle::validate_run_bundle_dir;
use chrono::Utc;
use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use sysinfo::System;
use uuid::Uuid;

const MATRIX_SCHEMA_VERSION: u16 = 1;
const MAX_INPUT_BYTES: u64 = 32 * 1024 * 1024;
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
const REQUIRED_REFERENCE_FIELDS: [&str; 5] = [
    "power",
    "devices",
    "model",
    "language",
    "networkCanaryMethod",
];
const REQUIRED_PLATFORMS: [&str; 3] = ["macos", "windows", "linux"];

#[derive(Debug, Parser)]
#[command(name = "telu-baseline")]
#[command(about = "Local-only Telu baseline matrix planner and evidence validator")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    Validate {
        manifest: PathBuf,
    },
    Plan {
        manifest: PathBuf,
        output: PathBuf,
    },
    Aggregate {
        manifest: PathBuf,
        plan: PathBuf,
        bundle_root: PathBuf,
        output: PathBuf,
    },
    ProposeReference,
}

#[derive(Debug, thiserror::Error)]
enum BaselineError {
    #[error("BASELINE_INPUT_NOT_FOUND")]
    InputNotFound,
    #[error("BASELINE_INPUT_UNSAFE")]
    InputUnsafe,
    #[error("BASELINE_INPUT_TOO_LARGE")]
    InputTooLarge,
    #[error("BASELINE_JSON_MALFORMED")]
    JsonMalformed,
    #[error("BASELINE_MANIFEST_INVALID")]
    ManifestInvalid,
    #[error("BASELINE_PLAN_INVALID")]
    PlanInvalid,
    #[error("BASELINE_BUNDLE_INVALID")]
    BundleInvalid,
    #[error("BASELINE_OUTPUT_EXISTS")]
    OutputExists,
    #[error("BASELINE_OUTPUT_UNSAFE")]
    OutputUnsafe,
    #[error("BASELINE_STORAGE_FAILED")]
    StorageFailed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum ReferenceStatus {
    Proposed,
    Approved,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
enum FactStatus {
    Observed,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ReferenceFact {
    status: FactStatus,
    #[serde(default)]
    value: Option<String>,
    #[serde(default)]
    reason: Option<String>,
}

impl ReferenceFact {
    fn observed(value: impl Into<String>) -> Self {
        Self {
            status: FactStatus::Observed,
            value: Some(value.into()),
            reason: None,
        }
    }

    fn unknown(reason: impl Into<String>) -> Self {
        Self {
            status: FactStatus::Unknown,
            value: None,
            reason: Some(reason.into()),
        }
    }

    fn validate(&self) -> bool {
        match self.status {
            FactStatus::Observed => {
                self.value.as_deref().is_some_and(is_safe_display) && self.reason.is_none()
            }
            FactStatus::Unknown => {
                self.value.is_none() && self.reason.as_deref().is_some_and(is_safe_reason)
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ReferenceProfile {
    status: ReferenceStatus,
    app_revision: ReferenceFact,
    os: ReferenceFact,
    hardware: ReferenceFact,
    power: ReferenceFact,
    devices: ReferenceFact,
    sample_configuration: ReferenceFact,
    model: ReferenceFact,
    route: ReferenceFact,
    language: ReferenceFact,
    network_canary_method: ReferenceFact,
}

impl ReferenceProfile {
    fn facts(&self) -> [(&'static str, &ReferenceFact); 10] {
        [
            ("appRevision", &self.app_revision),
            ("os", &self.os),
            ("hardware", &self.hardware),
            ("power", &self.power),
            ("devices", &self.devices),
            ("sampleConfiguration", &self.sample_configuration),
            ("model", &self.model),
            ("route", &self.route),
            ("language", &self.language),
            ("networkCanaryMethod", &self.network_canary_method),
        ]
    }

    fn missing_required_fields(&self) -> Vec<&'static str> {
        self.facts()
            .into_iter()
            .filter_map(|(name, fact)| {
                (REQUIRED_REFERENCE_FIELDS.contains(&name) && fact.status == FactStatus::Unknown)
                    .then_some(name)
            })
            .collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RepeatPolicy {
    warmup_runs: u16,
    measured_runs: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Scenario {
    id: String,
    input: String,
    packaged_app_required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PlatformSmoke {
    platform: String,
    status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MatrixManifest {
    schema_version: u16,
    matrix_id: String,
    scenario_version: String,
    reference_profile: ReferenceProfile,
    repeat_policy: RepeatPolicy,
    scenarios: Vec<Scenario>,
    platform_smoke: Vec<PlatformSmoke>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ValidationReport<'a> {
    valid: bool,
    schema_version: u16,
    matrix_id: &'a str,
    scenario_count: usize,
    scenarios: Vec<&'a str>,
    reference_status: ReferenceStatus,
    missing_required_fields: Vec<&'static str>,
    unverified_platforms: Vec<&'a str>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MatrixRun {
    sequence: u64,
    scenario_id: String,
    run_kind: String,
    repeat_index: u16,
    run_id: String,
    bundle_directory: String,
    status: String,
    reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MatrixPlan {
    schema_version: u16,
    matrix_id: String,
    scenario_version: String,
    created_at_utc: String,
    reference_status: ReferenceStatus,
    missing_required_fields: Vec<String>,
    runs: Vec<MatrixRun>,
}

fn main() {
    if let Err(error) = execute(Cli::parse().command) {
        eprintln!("{}", json!({"error": error.to_string()}));
        std::process::exit(1);
    }
}

fn execute(command: Command) -> Result<(), BaselineError> {
    match command {
        Command::Validate { manifest } => {
            let manifest = load_manifest(&manifest)?;
            print_json(&validation_report(&manifest))
        }
        Command::Plan { manifest, output } => {
            let manifest = load_manifest(&manifest)?;
            let plan = build_plan(&manifest);
            write_new_json(&output, &plan)?;
            print_json(&json!({
                "created": true,
                "runCount": plan.runs.len(),
                "referenceStatus": plan.reference_status,
                "missingRequiredFields": plan.missing_required_fields,
            }))
        }
        Command::Aggregate {
            manifest,
            plan,
            bundle_root,
            output,
        } => {
            let manifest = load_manifest(&manifest)?;
            let plan: MatrixPlan = read_json(&plan)?;
            validate_plan(&manifest, &plan)?;
            let aggregate = aggregate(&manifest, &plan, &bundle_root, &output)?;
            write_new_json(&output, &aggregate)?;
            print_json(&json!({
                "created": true,
                "outcome": aggregate["outcome"],
                "runCount": plan.runs.len(),
            }))
        }
        Command::ProposeReference => print_json(&proposed_reference()),
    }
}

fn load_manifest(path: &Path) -> Result<MatrixManifest, BaselineError> {
    let manifest: MatrixManifest = read_json(path)?;
    validate_manifest(&manifest)?;
    Ok(manifest)
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<T, BaselineError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| BaselineError::InputNotFound)?;
    if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
        return Err(BaselineError::InputUnsafe);
    }
    if metadata.len() == 0 {
        return Err(BaselineError::JsonMalformed);
    }
    if metadata.len() > MAX_INPUT_BYTES {
        return Err(BaselineError::InputTooLarge);
    }
    serde_json::from_slice(&fs::read(path).map_err(|_| BaselineError::StorageFailed)?)
        .map_err(|_| BaselineError::JsonMalformed)
}

fn validate_manifest(manifest: &MatrixManifest) -> Result<(), BaselineError> {
    if manifest.schema_version != MATRIX_SCHEMA_VERSION
        || !is_safe_reason(&manifest.matrix_id)
        || !is_safe_reason(&manifest.scenario_version)
        || manifest.repeat_policy.warmup_runs == 0
        || manifest.repeat_policy.measured_runs < 2
        || manifest.scenarios.len() != REQUIRED_SCENARIOS.len()
        || manifest.platform_smoke.len() != REQUIRED_PLATFORMS.len()
        || manifest
            .reference_profile
            .facts()
            .iter()
            .any(|(_, fact)| !fact.validate())
    {
        return Err(BaselineError::ManifestInvalid);
    }

    for (scenario, required) in manifest.scenarios.iter().zip(REQUIRED_SCENARIOS) {
        if scenario.id != required
            || !matches!(
                scenario.input.as_str(),
                "fixture_or_live" | "fixture_replay" | "live"
            )
            || !scenario.packaged_app_required
        {
            return Err(BaselineError::ManifestInvalid);
        }
    }
    for (smoke, required) in manifest.platform_smoke.iter().zip(REQUIRED_PLATFORMS) {
        if smoke.platform != required || !matches!(smoke.status.as_str(), "unverified" | "verified")
        {
            return Err(BaselineError::ManifestInvalid);
        }
    }
    Ok(())
}

fn validation_report(manifest: &MatrixManifest) -> ValidationReport<'_> {
    ValidationReport {
        valid: true,
        schema_version: manifest.schema_version,
        matrix_id: &manifest.matrix_id,
        scenario_count: manifest.scenarios.len(),
        scenarios: manifest
            .scenarios
            .iter()
            .map(|item| item.id.as_str())
            .collect(),
        reference_status: manifest.reference_profile.status,
        missing_required_fields: manifest.reference_profile.missing_required_fields(),
        unverified_platforms: manifest
            .platform_smoke
            .iter()
            .filter(|item| item.status == "unverified")
            .map(|item| item.platform.as_str())
            .collect(),
    }
}

fn build_plan(manifest: &MatrixManifest) -> MatrixPlan {
    let mut runs = Vec::new();
    let mut sequence = 0_u64;
    for scenario in &manifest.scenarios {
        for repeat_index in 0..manifest.repeat_policy.warmup_runs {
            runs.push(new_run(sequence, &scenario.id, "warmup", repeat_index));
            sequence += 1;
        }
        for repeat_index in 0..manifest.repeat_policy.measured_runs {
            runs.push(new_run(sequence, &scenario.id, "measured", repeat_index));
            sequence += 1;
        }
    }
    MatrixPlan {
        schema_version: MATRIX_SCHEMA_VERSION,
        matrix_id: manifest.matrix_id.clone(),
        scenario_version: manifest.scenario_version.clone(),
        created_at_utc: Utc::now().to_rfc3339(),
        reference_status: manifest.reference_profile.status,
        missing_required_fields: manifest
            .reference_profile
            .missing_required_fields()
            .into_iter()
            .map(str::to_string)
            .collect(),
        runs,
    }
}

fn new_run(sequence: u64, scenario: &str, kind: &str, repeat_index: u16) -> MatrixRun {
    let run_id = Uuid::new_v4().to_string();
    MatrixRun {
        sequence,
        scenario_id: scenario.to_string(),
        run_kind: kind.to_string(),
        repeat_index,
        bundle_directory: format!("run-{run_id}"),
        run_id,
        status: "unverified".to_string(),
        reason: "run_not_executed".to_string(),
    }
}

fn validate_plan(manifest: &MatrixManifest, plan: &MatrixPlan) -> Result<(), BaselineError> {
    let repeats =
        usize::from(manifest.repeat_policy.warmup_runs + manifest.repeat_policy.measured_runs);
    if plan.schema_version != MATRIX_SCHEMA_VERSION
        || plan.matrix_id != manifest.matrix_id
        || plan.scenario_version != manifest.scenario_version
        || plan.reference_status != manifest.reference_profile.status
        || plan.runs.len() != manifest.scenarios.len() * repeats
        || chrono::DateTime::parse_from_rfc3339(&plan.created_at_utc).is_err()
    {
        return Err(BaselineError::PlanInvalid);
    }
    let mut ids = BTreeSet::new();
    for (index, run) in plan.runs.iter().enumerate() {
        let scenario = &manifest.scenarios[index / repeats].id;
        let within = index % repeats;
        let expected_kind = if within < usize::from(manifest.repeat_policy.warmup_runs) {
            "warmup"
        } else {
            "measured"
        };
        let expected_index = if expected_kind == "warmup" {
            within
        } else {
            within - usize::from(manifest.repeat_policy.warmup_runs)
        };
        if run.sequence != index as u64
            || run.scenario_id != *scenario
            || run.run_kind != expected_kind
            || usize::from(run.repeat_index) != expected_index
            || Uuid::parse_str(&run.run_id).is_err()
            || !ids.insert(&run.run_id)
            || run.bundle_directory != format!("run-{}", run.run_id)
            || run.status != "unverified"
            || run.reason != "run_not_executed"
        {
            return Err(BaselineError::PlanInvalid);
        }
    }
    Ok(())
}

fn aggregate(
    manifest: &MatrixManifest,
    plan: &MatrixPlan,
    bundle_root: &Path,
    output: &Path,
) -> Result<Value, BaselineError> {
    let metadata = fs::symlink_metadata(bundle_root).map_err(|_| BaselineError::InputNotFound)?;
    if !metadata.file_type().is_dir() || metadata.file_type().is_symlink() {
        return Err(BaselineError::InputUnsafe);
    }
    let canonical_root = bundle_root
        .canonicalize()
        .map_err(|_| BaselineError::InputUnsafe)?;
    reject_output_inside_root(output, &canonical_root)?;
    if output.exists() {
        return Err(BaselineError::OutputExists);
    }

    let mut runs = Vec::with_capacity(plan.runs.len());
    for planned in &plan.runs {
        let path = canonical_root.join(&planned.bundle_directory);
        if !path.exists() {
            runs.push(json!({
                "sequence": planned.sequence,
                "scenarioId": planned.scenario_id,
                "runKind": planned.run_kind,
                "repeatIndex": planned.repeat_index,
                "runId": planned.run_id,
                "bundleDirectory": planned.bundle_directory,
                "status": "unknown",
                "reason": "bundle_missing",
                "limitations": ["bundle_missing"],
                "outliers": [],
                "metrics": empty_metrics(),
            }));
            continue;
        }
        let bundle_metadata =
            fs::symlink_metadata(&path).map_err(|_| BaselineError::BundleInvalid)?;
        if !bundle_metadata.file_type().is_dir() || bundle_metadata.file_type().is_symlink() {
            return Err(BaselineError::BundleInvalid);
        }
        let validation =
            validate_run_bundle_dir(&path).map_err(|_| BaselineError::BundleInvalid)?;
        if !validation.valid {
            return Err(BaselineError::BundleInvalid);
        }
        let result: Value = read_json(&path.join("result.json"))?;
        let outcome = result.get("outcome").and_then(Value::as_str);
        if result.get("runId").and_then(Value::as_str) != Some(planned.run_id.as_str())
            || !matches!(outcome, Some("pass" | "fail" | "unknown"))
            || result
                .get("limitations")
                .and_then(Value::as_array)
                .is_none()
            || result.get("outliers").and_then(Value::as_array).is_none()
        {
            return Err(BaselineError::BundleInvalid);
        }
        runs.push(json!({
            "sequence": planned.sequence,
            "scenarioId": planned.scenario_id,
            "runKind": planned.run_kind,
            "repeatIndex": planned.repeat_index,
            "runId": planned.run_id,
            "bundleDirectory": planned.bundle_directory,
            "status": outcome.unwrap_or("unknown"),
            "reason": result.get("outcomeReason").cloned().unwrap_or(Value::Null),
            "limitations": result["limitations"].clone(),
            "outliers": result["outliers"].clone(),
            "metrics": read_metrics(&path)?,
        }));
    }

    let scenario_aggregates = manifest
        .scenarios
        .iter()
        .map(|scenario| scenario_aggregate(&scenario.id, &runs))
        .collect::<Vec<_>>();
    let evidence_outcome = combined_outcome(
        scenario_aggregates
            .iter()
            .filter_map(|value| value.get("status").and_then(Value::as_str)),
    );
    let reference_is_complete = manifest.reference_profile.status == ReferenceStatus::Approved
        && plan.missing_required_fields.is_empty()
        && manifest
            .platform_smoke
            .iter()
            .all(|platform| platform.status == "verified");
    let outcome = if reference_is_complete {
        evidence_outcome
    } else {
        "unknown"
    };
    let mut limitations = vec![
        "thresholds_not_declared",
        "unrun_or_unknown_evidence_does_not_pass",
    ];
    if !reference_is_complete {
        limitations.push("reference_or_platform_unverified");
    }
    Ok(json!({
        "schemaVersion": MATRIX_SCHEMA_VERSION,
        "matrixId": manifest.matrix_id,
        "scenarioVersion": manifest.scenario_version,
        "referenceStatus": manifest.reference_profile.status,
        "missingRequiredFields": plan.missing_required_fields,
        "createdAtUtc": Utc::now().to_rfc3339(),
        "outcome": outcome,
        "runs": runs,
        "scenarioAggregates": scenario_aggregates,
        "limitations": limitations,
    }))
}

fn reject_output_inside_root(output: &Path, root: &Path) -> Result<(), BaselineError> {
    let parent = output.parent().ok_or(BaselineError::OutputUnsafe)?;
    let canonical_parent = parent
        .canonicalize()
        .map_err(|_| BaselineError::OutputUnsafe)?;
    if canonical_parent == root || canonical_parent.starts_with(root) {
        return Err(BaselineError::OutputUnsafe);
    }
    Ok(())
}

fn empty_metrics() -> Value {
    json!({
        "endToEndMicros": [],
        "queueOldestAgeMs": [],
        "queueDepth": [],
        "processCpuPercent": [],
        "processMemoryBytes": [],
    })
}

fn read_metrics(bundle: &Path) -> Result<Value, BaselineError> {
    let stages = read_json_lines(&bundle.join("stages.jsonl"))?;
    let queues = read_json_lines(&bundle.join("queues.jsonl"))?;
    let resources = read_json_lines(&bundle.join("resources.jsonl"))?;
    let mut first_audio = BTreeMap::<(String, String), u64>::new();
    let mut end_to_end = Vec::new();
    for record in stages {
        let work = record
            .get("workId")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let evidence = record
            .get("evidenceId")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let offset = record
            .get("offsetMicros")
            .and_then(Value::as_u64)
            .ok_or(BaselineError::BundleInvalid)?;
        let key = (work.to_string(), evidence.to_string());
        match record.get("stage").and_then(Value::as_str) {
            Some("audio_captured") => {
                first_audio.entry(key).or_insert(offset);
            }
            Some("ui_acknowledged") => {
                if let Some(start) = first_audio.get(&key) {
                    end_to_end.push(offset.saturating_sub(*start));
                }
            }
            _ => {}
        }
    }
    Ok(json!({
        "endToEndMicros": end_to_end,
        "queueOldestAgeMs": queues.iter().filter_map(|record| record.get("oldestAgeMs").and_then(Value::as_u64)).collect::<Vec<_>>(),
        "queueDepth": queues.iter().filter_map(|record| record.get("depth").and_then(Value::as_u64)).collect::<Vec<_>>(),
        "processCpuPercent": resources.iter().filter_map(|record| record["process"]["cpuPercent"].as_f64()).collect::<Vec<_>>(),
        "processMemoryBytes": resources.iter().filter_map(|record| record["process"]["memoryBytes"].as_u64()).collect::<Vec<_>>(),
    }))
}

fn read_json_lines(path: &Path) -> Result<Vec<Value>, BaselineError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| BaselineError::InputNotFound)?;
    if !metadata.file_type().is_file()
        || metadata.file_type().is_symlink()
        || metadata.len() > MAX_INPUT_BYTES
    {
        return Err(BaselineError::InputUnsafe);
    }
    let text = fs::read_to_string(path).map_err(|_| BaselineError::StorageFailed)?;
    text.lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| serde_json::from_str(line).map_err(|_| BaselineError::JsonMalformed))
        .collect()
}

fn scenario_aggregate(scenario: &str, runs: &[Value]) -> Value {
    let matching = runs
        .iter()
        .filter(|run| {
            run.get("scenarioId").and_then(Value::as_str) == Some(scenario)
                && run.get("runKind").and_then(Value::as_str) == Some("measured")
        })
        .collect::<Vec<_>>();
    let status = combined_outcome(
        matching
            .iter()
            .filter_map(|run| run.get("status").and_then(Value::as_str)),
    );
    let distributions = [
        "endToEndMicros",
        "queueOldestAgeMs",
        "queueDepth",
        "processCpuPercent",
        "processMemoryBytes",
    ]
    .into_iter()
    .map(|name| {
        let values = matching
            .iter()
            .flat_map(|run| {
                run.get("metrics")
                    .and_then(|metrics| metrics.get(name))
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                    .filter_map(Value::as_f64)
            })
            .collect::<Vec<_>>();
        (name.to_string(), distribution(values))
    })
    .collect::<serde_json::Map<_, _>>();
    let outliers = matching
        .iter()
        .flat_map(|run| {
            run.get("outliers")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .cloned()
        })
        .collect::<Vec<_>>();
    json!({
        "scenarioId": scenario,
        "status": status,
        "runIds": matching.iter().filter_map(|run| run.get("runId")).collect::<Vec<_>>(),
        "distributions": Value::Object(distributions),
        "outliers": outliers,
    })
}

fn distribution(mut values: Vec<f64>) -> Value {
    values.sort_by(|left, right| left.total_cmp(right));
    let min = values.first().copied();
    let max = values.last().copied();
    json!({"count": values.len(), "values": values, "min": min, "max": max})
}

fn combined_outcome<'a>(statuses: impl Iterator<Item = &'a str>) -> &'static str {
    let statuses = statuses.collect::<Vec<_>>();
    if statuses.iter().any(|status| *status == "fail") {
        "fail"
    } else if !statuses.is_empty() && statuses.iter().all(|status| *status == "pass") {
        "pass"
    } else {
        "unknown"
    }
}

fn write_new_json(path: &Path, value: &impl Serialize) -> Result<(), BaselineError> {
    if path.exists() {
        return Err(BaselineError::OutputExists);
    }
    let parent = path.parent().ok_or(BaselineError::OutputUnsafe)?;
    let metadata = fs::symlink_metadata(parent).map_err(|_| BaselineError::OutputUnsafe)?;
    if !metadata.file_type().is_dir() || metadata.file_type().is_symlink() {
        return Err(BaselineError::OutputUnsafe);
    }
    let bytes = serde_json::to_vec_pretty(value).map_err(|_| BaselineError::StorageFailed)?;
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                BaselineError::OutputExists
            } else {
                BaselineError::StorageFailed
            }
        })?;
    if file.write_all(&bytes).is_err() || file.write_all(b"\n").is_err() || file.sync_all().is_err()
    {
        let _ = fs::remove_file(path);
        return Err(BaselineError::StorageFailed);
    }
    Ok(())
}

fn print_json(value: &impl Serialize) -> Result<(), BaselineError> {
    println!(
        "{}",
        serde_json::to_string_pretty(value).map_err(|_| BaselineError::StorageFailed)?
    );
    Ok(())
}

fn proposed_reference() -> Value {
    let mut system = System::new_all();
    system.refresh_all();
    let os = System::long_os_version().unwrap_or_else(|| std::env::consts::OS.to_string());
    let cpu = system
        .cpus()
        .first()
        .map(|item| item.brand().trim())
        .filter(|item| !item.is_empty())
        .unwrap_or("unknown cpu");
    let memory_gib = system.total_memory() / (1024 * 1024 * 1024);
    let app_revision = option_env!("TELU_APP_REVISION")
        .filter(|value| is_safe_reason(value))
        .map(ReferenceFact::observed)
        .unwrap_or_else(|| ReferenceFact::unknown("app_revision_not_embedded"));
    let profile = ReferenceProfile {
        status: ReferenceStatus::Proposed,
        app_revision,
        os: ReferenceFact::observed(format!("{os}; {}", std::env::consts::ARCH)),
        hardware: ReferenceFact::observed(format!("{cpu}; {memory_gib} GiB")),
        power: ReferenceFact::unknown("battery_evidence_method_not_approved"),
        devices: ReferenceFact::unknown("audio_devices_not_selected"),
        sample_configuration: ReferenceFact::observed(
            "48000hz; capture_configuration_recorded_per_run",
        ),
        model: ReferenceFact::unknown("transcription_model_not_selected"),
        route: ReferenceFact::observed("local:this-device"),
        language: ReferenceFact::unknown("evaluation_language_not_selected"),
        network_canary_method: ReferenceFact::unknown("os_network_canary_method_not_approved"),
    };
    json!({
        "schemaVersion": MATRIX_SCHEMA_VERSION,
        "capturedAtUtc": Utc::now().to_rfc3339(),
        "referenceProfile": profile,
        "missingRequiredFields": profile.missing_required_fields(),
        "note": "proposed_only_not_approved",
    })
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
