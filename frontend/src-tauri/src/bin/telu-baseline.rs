use app_lib::observability::baseline_assignment::{
    embedded_app_revision, write_pending_assignment, AssignmentEnvironment, AssignmentFact,
    AssignmentFactStatus, BaselineRunAssignment, BASELINE_ASSIGNMENT_ENV,
    BASELINE_ASSIGNMENT_SCHEMA_VERSION,
};
use app_lib::observability::run_bundle::validate_run_bundle_dir;
use chrono::{Duration, Utc};
use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
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
const REQUIRED_METRICS: [&str; 5] = [
    "endToEndMicros",
    "queueOldestAgeMs",
    "queueDepth",
    "processCpuPercent",
    "processMemoryBytes",
];

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
    AuthorizeRun {
        manifest: PathBuf,
        plan: PathBuf,
        sequence: usize,
        #[arg(long)]
        app_data_dir: Option<PathBuf>,
        #[arg(long, default_value_t = 60)]
        ttl_minutes: i64,
    },
    VerifyGate {
        gate: PathBuf,
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
    #[error("BASELINE_ASSIGNMENT_UNAUTHORIZED")]
    AssignmentUnauthorized,
    #[error("BASELINE_GATE_INVALID")]
    GateInvalid,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct GateArtifact {
    path: String,
    sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ThresholdMetric {
    id: String,
    limit: f64,
    operator: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ThresholdDeclaration {
    declared_at_utc: String,
    validation_started_at_utc: String,
    metrics: Vec<ThresholdMetric>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct GateStatusRecord {
    id: String,
    status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct GateDisposition {
    disposition: String,
    evidence_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BaselineGate {
    schema_version: u16,
    review_aggregate: GateArtifact,
    validation_aggregate: GateArtifact,
    threshold_declaration: ThresholdDeclaration,
    scenario_results: Vec<GateStatusRecord>,
    metric_results: Vec<GateStatusRecord>,
    retained_outliers: BTreeMap<String, Vec<Value>>,
    phase_2: GateDisposition,
    phase_4: GateDisposition,
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
        Command::AuthorizeRun {
            manifest,
            plan,
            sequence,
            app_data_dir,
            ttl_minutes,
        } => authorize_run(
            &manifest,
            &plan,
            sequence,
            app_data_dir.as_deref(),
            ttl_minutes,
        ),
        Command::VerifyGate { gate } => {
            let report = verify_gate(&gate)?;
            print_json(&report)
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

fn authorize_run(
    manifest_path: &Path,
    plan_path: &Path,
    sequence: usize,
    app_data_dir: Option<&Path>,
    ttl_minutes: i64,
) -> Result<(), BaselineError> {
    let manifest = load_manifest(manifest_path)?;
    let plan: MatrixPlan = read_json(plan_path)?;
    validate_plan(&manifest, &plan)?;
    let revision = embedded_app_revision();
    let approved_revision = manifest
        .reference_profile
        .app_revision
        .value
        .as_deref()
        .ok_or(BaselineError::AssignmentUnauthorized)?;
    if manifest.reference_profile.status != ReferenceStatus::Approved
        || !manifest
            .reference_profile
            .missing_required_fields()
            .is_empty()
        || manifest
            .reference_profile
            .facts()
            .iter()
            .any(|(_, fact)| fact.status != FactStatus::Observed)
        || revision == "unverified"
        || approved_revision != revision
        || !(1..=1_440).contains(&ttl_minutes)
    {
        return Err(BaselineError::AssignmentUnauthorized);
    }
    let run = plan
        .runs
        .get(sequence)
        .filter(|run| run.sequence == sequence as u64)
        .ok_or(BaselineError::PlanInvalid)?;
    let issued_at_utc = Utc::now();
    let assignment = BaselineRunAssignment {
        schema_version: BASELINE_ASSIGNMENT_SCHEMA_VERSION,
        assignment_id: Uuid::new_v4().to_string(),
        authorization: "approved".to_string(),
        source: "telu-baseline-authorize-run-v1".to_string(),
        matrix_id: manifest.matrix_id.clone(),
        matrix_plan_sha256: sha256_file(plan_path)?,
        run_sequence: run.sequence,
        run_id: run.run_id.clone(),
        scenario_id: run.scenario_id.clone(),
        scenario_version: manifest.scenario_version.clone(),
        run_kind: run.run_kind.clone(),
        repeat_index: run.repeat_index,
        bundle_directory: run.bundle_directory.clone(),
        app_revision: revision.to_string(),
        issued_at_utc,
        expires_at_utc: issued_at_utc + Duration::minutes(ttl_minutes),
        environment: AssignmentEnvironment {
            os: assignment_fact(&manifest.reference_profile.os)?,
            hardware: assignment_fact(&manifest.reference_profile.hardware)?,
            power: assignment_fact(&manifest.reference_profile.power)?,
            devices: assignment_fact(&manifest.reference_profile.devices)?,
            sample_configuration: assignment_fact(
                &manifest.reference_profile.sample_configuration,
            )?,
            model: assignment_fact(&manifest.reference_profile.model)?,
            route: assignment_fact(&manifest.reference_profile.route)?,
            language: assignment_fact(&manifest.reference_profile.language)?,
            network_canary_method: assignment_fact(
                &manifest.reference_profile.network_canary_method,
            )?,
        },
        integrity_sha256: String::new(),
    }
    .seal()
    .map_err(|_| BaselineError::AssignmentUnauthorized)?;
    let app_data_dir = app_data_dir
        .map(Path::to_path_buf)
        .or_else(default_app_data_dir)
        .ok_or(BaselineError::OutputUnsafe)?;
    write_pending_assignment(&app_data_dir, &assignment)
        .map_err(|_| BaselineError::AssignmentUnauthorized)?;
    print_json(&json!({
        "authorized": true,
        "assignmentId": assignment.assignment_id,
        "runId": assignment.run_id,
        "scenarioId": assignment.scenario_id,
        "scenarioVersion": assignment.scenario_version,
        "runSequence": assignment.run_sequence,
        "expiresAtUtc": assignment.expires_at_utc,
        "launchEnvironment": {
            "name": BASELINE_ASSIGNMENT_ENV,
            "value": assignment.assignment_id,
        },
    }))
}

fn assignment_fact(fact: &ReferenceFact) -> Result<AssignmentFact, BaselineError> {
    if fact.status != FactStatus::Observed || !fact.validate() {
        return Err(BaselineError::AssignmentUnauthorized);
    }
    Ok(AssignmentFact {
        status: AssignmentFactStatus::Observed,
        value: fact.value.clone(),
        reason: None,
    })
}

fn default_app_data_dir() -> Option<PathBuf> {
    dirs::data_dir().map(|root| root.join("com.meetily.ai"))
}

fn sha256_file(path: &Path) -> Result<String, BaselineError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| BaselineError::InputNotFound)?;
    if !metadata.file_type().is_file()
        || metadata.file_type().is_symlink()
        || metadata.len() == 0
        || metadata.len() > MAX_INPUT_BYTES
    {
        return Err(BaselineError::InputUnsafe);
    }
    let bytes = fs::read(path).map_err(|_| BaselineError::StorageFailed)?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}

fn verify_gate(path: &Path) -> Result<Value, BaselineError> {
    let gate = read_gate(path)?;
    if gate.schema_version != MATRIX_SCHEMA_VERSION {
        return Err(BaselineError::GateInvalid);
    }
    let parent = path.parent().ok_or(BaselineError::GateInvalid)?;
    let review_path = resolve_gate_artifact(parent, &gate.review_aggregate)?;
    let validation_path = resolve_gate_artifact(parent, &gate.validation_aggregate)?;
    let review: Value = read_json(&review_path)?;
    let validation: Value = read_json(&validation_path)?;
    validate_gate_aggregate(&review)?;
    validate_gate_aggregate(&validation)?;
    if review.get("matrixId") != validation.get("matrixId")
        || review.get("scenarioVersion") != validation.get("scenarioVersion")
    {
        return Err(BaselineError::GateInvalid);
    }

    let review_created = aggregate_timestamp(&review, "createdAtUtc")?;
    let declared =
        chrono::DateTime::parse_from_rfc3339(&gate.threshold_declaration.declared_at_utc)
            .map_err(|_| BaselineError::GateInvalid)?;
    let validation_started =
        chrono::DateTime::parse_from_rfc3339(&gate.threshold_declaration.validation_started_at_utc)
            .map_err(|_| BaselineError::GateInvalid)?;
    let validation_created = aggregate_timestamp(&validation, "createdAtUtc")?;
    if !(review_created < declared
        && declared < validation_started
        && validation_started <= validation_created)
    {
        return Err(BaselineError::GateInvalid);
    }
    validate_threshold_metrics(&gate.threshold_declaration.metrics)?;
    validate_gate_statuses(&gate.scenario_results, &REQUIRED_SCENARIOS)?;
    validate_gate_statuses(&gate.metric_results, &REQUIRED_METRICS)?;
    let (computed_scenarios, computed_metrics) =
        compute_validation_statuses(&validation, &gate.threshold_declaration.metrics)?;
    for result in &gate.scenario_results {
        if computed_scenarios.get(&result.id) != Some(&result.status) {
            return Err(BaselineError::GateInvalid);
        }
    }
    for result in &gate.metric_results {
        if computed_metrics.get(&result.id) != Some(&result.status) {
            return Err(BaselineError::GateInvalid);
        }
    }
    let expected_outliers = BTreeMap::from([
        ("review".to_string(), aggregate_outliers(&review)?),
        ("validation".to_string(), aggregate_outliers(&validation)?),
    ]);
    if canonical_outliers(&gate.retained_outliers)? != canonical_outliers(&expected_outliers)? {
        return Err(BaselineError::GateInvalid);
    }
    let all_pass = gate
        .scenario_results
        .iter()
        .chain(gate.metric_results.iter())
        .all(|result| result.status == "pass");
    validate_disposition(&gate.phase_2, all_pass)?;
    validate_disposition(&gate.phase_4, all_pass)?;

    Ok(json!({
        "valid": true,
        "reviewRunCount": review["runs"].as_array().map_or(0, Vec::len),
        "validationRunCount": validation["runs"].as_array().map_or(0, Vec::len),
        "scenarioCount": gate.scenario_results.len(),
        "metricCount": gate.metric_results.len(),
        "phase2": gate.phase_2.disposition,
        "phase4": gate.phase_4.disposition,
    }))
}

fn read_gate(path: &Path) -> Result<BaselineGate, BaselineError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| BaselineError::InputNotFound)?;
    if !metadata.file_type().is_file()
        || metadata.file_type().is_symlink()
        || metadata.len() == 0
        || metadata.len() > MAX_INPUT_BYTES
    {
        return Err(BaselineError::InputUnsafe);
    }
    let text = fs::read_to_string(path).map_err(|_| BaselineError::StorageFailed)?;
    let start = text.find("```json").ok_or(BaselineError::GateInvalid)? + "```json".len();
    let end = text[start..]
        .find("```")
        .map(|offset| start + offset)
        .ok_or(BaselineError::GateInvalid)?;
    serde_json::from_str(&text[start..end]).map_err(|_| BaselineError::GateInvalid)
}

fn resolve_gate_artifact(parent: &Path, artifact: &GateArtifact) -> Result<PathBuf, BaselineError> {
    let relative = Path::new(&artifact.path);
    if relative.is_absolute()
        || artifact.path.is_empty()
        || relative.components().count() != 1
        || !is_sha256(&artifact.sha256)
    {
        return Err(BaselineError::GateInvalid);
    }
    let path = parent.join(relative);
    if sha256_file(&path)? != artifact.sha256 {
        return Err(BaselineError::GateInvalid);
    }
    Ok(path)
}

fn validate_gate_aggregate(aggregate: &Value) -> Result<(), BaselineError> {
    if aggregate["schemaVersion"].as_u64() != Some(u64::from(MATRIX_SCHEMA_VERSION))
        || !aggregate["matrixId"].as_str().is_some_and(is_safe_reason)
        || !aggregate["scenarioVersion"]
            .as_str()
            .is_some_and(is_safe_reason)
        || aggregate_timestamp(aggregate, "createdAtUtc").is_err()
    {
        return Err(BaselineError::GateInvalid);
    }
    let runs = aggregate["runs"]
        .as_array()
        .filter(|runs| !runs.is_empty())
        .ok_or(BaselineError::GateInvalid)?;
    let scenarios = aggregate["scenarioAggregates"]
        .as_array()
        .ok_or(BaselineError::GateInvalid)?;
    if scenarios.len() != REQUIRED_SCENARIOS.len() {
        return Err(BaselineError::GateInvalid);
    }

    let mut run_ids = BTreeSet::new();
    let mut run_slots = BTreeSet::new();
    let mut previous_scenario_index = 0_usize;
    for (index, run) in runs.iter().enumerate() {
        let scenario_id = run["scenarioId"]
            .as_str()
            .ok_or(BaselineError::GateInvalid)?;
        let scenario_index = REQUIRED_SCENARIOS
            .iter()
            .position(|required| *required == scenario_id)
            .ok_or(BaselineError::GateInvalid)?;
        let run_kind = run["runKind"]
            .as_str()
            .filter(|kind| matches!(*kind, "warmup" | "measured"))
            .ok_or(BaselineError::GateInvalid)?;
        let repeat_index = run["repeatIndex"]
            .as_u64()
            .ok_or(BaselineError::GateInvalid)?;
        let run_id = run["runId"]
            .as_str()
            .filter(|value| Uuid::parse_str(value).is_ok())
            .ok_or(BaselineError::GateInvalid)?;
        let status = run["status"]
            .as_str()
            .filter(|status| matches!(*status, "pass" | "fail" | "unknown"))
            .ok_or(BaselineError::GateInvalid)?;
        if run["sequence"].as_u64() != Some(index as u64)
            || scenario_index < previous_scenario_index
            || !run_ids.insert(run_id)
            || !run_slots.insert((scenario_id, run_kind, repeat_index))
            || run["outliers"].as_array().is_none()
            || run["reason"].as_str() == Some("bundle_missing")
            || status == "unknown" && run["reason"].as_str().is_none()
        {
            return Err(BaselineError::GateInvalid);
        }
        previous_scenario_index = scenario_index;
    }

    for (expected, scenario) in REQUIRED_SCENARIOS.iter().zip(scenarios) {
        if scenario["scenarioId"].as_str() != Some(*expected) {
            return Err(BaselineError::GateInvalid);
        }
        let measured = runs
            .iter()
            .filter(|run| {
                run["scenarioId"].as_str() == Some(*expected)
                    && run["runKind"].as_str() == Some("measured")
            })
            .collect::<Vec<_>>();
        if measured.len() < 2
            || measured
                .iter()
                .enumerate()
                .any(|(index, run)| run["repeatIndex"].as_u64() != Some(index as u64))
            || scenario["runIds"].as_array()
                != Some(
                    &measured
                        .iter()
                        .map(|run| run["runId"].clone())
                        .collect::<Vec<_>>(),
                )
            || scenario["status"].as_str()
                != Some(combined_outcome(
                    measured.iter().filter_map(|run| run["status"].as_str()),
                ))
        {
            return Err(BaselineError::GateInvalid);
        }
        let distributions = scenario["distributions"]
            .as_object()
            .ok_or(BaselineError::GateInvalid)?;
        for metric in REQUIRED_METRICS {
            let distribution = distributions
                .get(metric)
                .ok_or(BaselineError::GateInvalid)?;
            let count = distribution["count"].as_u64().unwrap_or(0);
            let values = distribution["values"]
                .as_array()
                .ok_or(BaselineError::GateInvalid)?;
            let numeric_values = values
                .iter()
                .map(|value| {
                    value
                        .as_f64()
                        .filter(|value| value.is_finite())
                        .ok_or(BaselineError::GateInvalid)
                })
                .collect::<Result<Vec<_>, _>>()?;
            let min = numeric_values.iter().copied().reduce(f64::min);
            let max = numeric_values.iter().copied().reduce(f64::max);
            if count == 0
                || count as usize != values.len()
                || distribution["min"].as_f64() != min
                || distribution["max"].as_f64() != max
            {
                return Err(BaselineError::GateInvalid);
            }
        }
    }
    Ok(())
}

fn aggregate_timestamp(
    aggregate: &Value,
    field: &str,
) -> Result<chrono::DateTime<chrono::FixedOffset>, BaselineError> {
    aggregate[field]
        .as_str()
        .ok_or(BaselineError::GateInvalid)
        .and_then(|value| {
            chrono::DateTime::parse_from_rfc3339(value).map_err(|_| BaselineError::GateInvalid)
        })
}

fn validate_threshold_metrics(metrics: &[ThresholdMetric]) -> Result<(), BaselineError> {
    if metrics.len() != REQUIRED_METRICS.len() {
        return Err(BaselineError::GateInvalid);
    }
    for (expected, metric) in REQUIRED_METRICS.iter().zip(metrics) {
        if metric.id != *expected
            || !metric.limit.is_finite()
            || metric.limit < 0.0
            || !matches!(metric.operator.as_str(), "max" | "min")
        {
            return Err(BaselineError::GateInvalid);
        }
    }
    Ok(())
}

fn compute_validation_statuses(
    aggregate: &Value,
    thresholds: &[ThresholdMetric],
) -> Result<(BTreeMap<String, String>, BTreeMap<String, String>), BaselineError> {
    let runs = aggregate["runs"]
        .as_array()
        .ok_or(BaselineError::GateInvalid)?;
    let scenarios = aggregate["scenarioAggregates"]
        .as_array()
        .ok_or(BaselineError::GateInvalid)?;
    let mut scenario_statuses = BTreeMap::new();
    let mut metric_statuses = REQUIRED_METRICS
        .iter()
        .map(|metric| ((*metric).to_string(), "pass".to_string()))
        .collect::<BTreeMap<_, _>>();
    for scenario in scenarios {
        let scenario_id = scenario["scenarioId"]
            .as_str()
            .ok_or(BaselineError::GateInvalid)?;
        let scenario_runs = runs
            .iter()
            .filter(|run| {
                run["scenarioId"].as_str() == Some(scenario_id)
                    && run["runKind"].as_str() == Some("measured")
            })
            .collect::<Vec<_>>();
        let mut scenario_status = if scenario_runs
            .iter()
            .any(|run| run["status"].as_str() == Some("fail"))
        {
            "fail"
        } else if scenario_runs.iter().any(|run| {
            run["status"].as_str() == Some("unknown")
                && run["reason"].as_str() != Some("thresholds_not_declared")
        }) {
            "unknown"
        } else {
            "pass"
        };
        for threshold in thresholds {
            let values = scenario["distributions"][&threshold.id]["values"]
                .as_array()
                .ok_or(BaselineError::GateInvalid)?;
            let passes = values.iter().all(|value| {
                value
                    .as_f64()
                    .is_some_and(|value| match threshold.operator.as_str() {
                        "max" => value <= threshold.limit,
                        "min" => value >= threshold.limit,
                        _ => false,
                    })
            });
            if !passes {
                scenario_status = "fail";
                metric_statuses.insert(threshold.id.clone(), "fail".to_string());
            }
        }
        if scenario_status == "unknown" {
            for status in metric_statuses.values_mut() {
                if status == "pass" {
                    *status = "unknown".to_string();
                }
            }
        }
        scenario_statuses.insert(scenario_id.to_string(), scenario_status.to_string());
    }
    Ok((scenario_statuses, metric_statuses))
}

fn validate_gate_statuses(
    results: &[GateStatusRecord],
    required: &[&str],
) -> Result<(), BaselineError> {
    if results.len() != required.len() {
        return Err(BaselineError::GateInvalid);
    }
    for (expected, result) in required.iter().zip(results) {
        if result.id != *expected || !matches!(result.status.as_str(), "pass" | "fail" | "unknown")
        {
            return Err(BaselineError::GateInvalid);
        }
    }
    Ok(())
}

fn aggregate_outliers(aggregate: &Value) -> Result<Vec<Value>, BaselineError> {
    Ok(aggregate["runs"]
        .as_array()
        .ok_or(BaselineError::GateInvalid)?
        .iter()
        .flat_map(|run| run["outliers"].as_array().into_iter().flatten().cloned())
        .collect())
}

fn canonical_outliers(
    outliers: &BTreeMap<String, Vec<Value>>,
) -> Result<BTreeMap<String, Vec<String>>, BaselineError> {
    outliers
        .iter()
        .map(|(key, values)| {
            let mut serialized = values
                .iter()
                .map(|value| serde_json::to_string(value).map_err(|_| BaselineError::GateInvalid))
                .collect::<Result<Vec<_>, _>>()?;
            serialized.sort();
            Ok((key.clone(), serialized))
        })
        .collect()
}

fn validate_disposition(
    disposition: &GateDisposition,
    all_pass: bool,
) -> Result<(), BaselineError> {
    if !matches!(disposition.disposition.as_str(), "go" | "no_go" | "unknown")
        || !matches!(
            disposition.evidence_status.as_str(),
            "pass" | "fail" | "unknown"
        )
        || (disposition.disposition == "go" && (!all_pass || disposition.evidence_status != "pass"))
    {
        return Err(BaselineError::GateInvalid);
    }
    Ok(())
}

fn is_sha256(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
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
        .filter(|value| *value != "unverified" && is_safe_reason(value))
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
