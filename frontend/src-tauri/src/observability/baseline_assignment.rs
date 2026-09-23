//! One-time, local-only authorization for a predeclared baseline matrix run.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub const BASELINE_ASSIGNMENT_SCHEMA_VERSION: u16 = 1;
pub const BASELINE_ASSIGNMENT_ENV: &str = "TELU_BASELINE_ASSIGNMENT_ID";
const ASSIGNMENT_DIRECTORY: &str = "baseline-assignments";
const MAX_ASSIGNMENT_BYTES: u64 = 64 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssignmentFactStatus {
    Observed,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AssignmentFact {
    pub status: AssignmentFactStatus,
    pub value: Option<String>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AssignmentEnvironment {
    pub os: AssignmentFact,
    pub hardware: AssignmentFact,
    pub power: AssignmentFact,
    pub devices: AssignmentFact,
    pub sample_configuration: AssignmentFact,
    pub model: AssignmentFact,
    pub route: AssignmentFact,
    pub language: AssignmentFact,
    pub network_canary_method: AssignmentFact,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BaselineRunAssignment {
    pub schema_version: u16,
    pub assignment_id: String,
    pub authorization: String,
    pub source: String,
    pub matrix_id: String,
    pub matrix_plan_sha256: String,
    pub run_sequence: u64,
    pub run_id: String,
    pub scenario_id: String,
    pub scenario_version: String,
    pub run_kind: String,
    pub repeat_index: u16,
    pub bundle_directory: String,
    pub app_revision: String,
    pub issued_at_utc: DateTime<Utc>,
    pub expires_at_utc: DateTime<Utc>,
    pub environment: AssignmentEnvironment,
    pub integrity_sha256: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BaselineAssignmentProvenance {
    pub assignment_id: String,
    pub source: String,
    pub matrix_id: String,
    pub matrix_plan_sha256: String,
    pub run_sequence: u64,
    pub run_id: String,
    pub scenario_id: String,
    pub scenario_version: String,
    pub run_kind: String,
    pub repeat_index: u16,
    pub assigned_at_utc: DateTime<Utc>,
    pub app_revision: String,
    pub network_canary_method: String,
}

impl From<&BaselineRunAssignment> for BaselineAssignmentProvenance {
    fn from(value: &BaselineRunAssignment) -> Self {
        Self {
            assignment_id: value.assignment_id.clone(),
            source: value.source.clone(),
            matrix_id: value.matrix_id.clone(),
            matrix_plan_sha256: value.matrix_plan_sha256.clone(),
            run_sequence: value.run_sequence,
            run_id: value.run_id.clone(),
            scenario_id: value.scenario_id.clone(),
            scenario_version: value.scenario_version.clone(),
            run_kind: value.run_kind.clone(),
            repeat_index: value.repeat_index,
            assigned_at_utc: value.issued_at_utc,
            app_revision: value.app_revision.clone(),
            network_canary_method: value
                .environment
                .network_canary_method
                .value
                .clone()
                .unwrap_or_default(),
        }
    }
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum BaselineAssignmentError {
    #[error("BASELINE_ASSIGNMENT_INVALID")]
    Invalid,
    #[error("BASELINE_ASSIGNMENT_UNAUTHORIZED")]
    Unauthorized,
    #[error("BASELINE_ASSIGNMENT_STALE")]
    Stale,
    #[error("BASELINE_ASSIGNMENT_REVISION_MISMATCH")]
    RevisionMismatch,
    #[error("BASELINE_ASSIGNMENT_REUSED")]
    Reused,
    #[error("BASELINE_ASSIGNMENT_STORAGE_FAILED")]
    Storage,
}

impl BaselineRunAssignment {
    pub fn seal(mut self) -> Result<Self, BaselineAssignmentError> {
        self.integrity_sha256.clear();
        self.integrity_sha256 = assignment_digest(&self)?;
        Ok(self)
    }

    pub fn validate(
        &self,
        expected_revision: &str,
        now: DateTime<Utc>,
    ) -> Result<(), BaselineAssignmentError> {
        if self.schema_version != BASELINE_ASSIGNMENT_SCHEMA_VERSION
            || Uuid::parse_str(&self.assignment_id).is_err()
            || Uuid::parse_str(&self.run_id).is_err()
            || self.bundle_directory != format!("run-{}", self.run_id)
            || self.authorization != "approved"
            || self.source != "telu-baseline-authorize-run-v1"
            || !is_safe_identifier(&self.matrix_id)
            || !is_sha256(&self.matrix_plan_sha256)
            || !is_safe_identifier(&self.scenario_id)
            || !is_safe_identifier(&self.scenario_version)
            || !matches!(self.run_kind.as_str(), "warmup" | "measured")
            || !is_full_git_revision(&self.app_revision)
            || !is_sha256(&self.integrity_sha256)
            || self.issued_at_utc >= self.expires_at_utc
            || self.issued_at_utc > now
            || self.expires_at_utc - self.issued_at_utc > chrono::Duration::hours(24)
            || self
                .environment
                .facts()
                .into_iter()
                .any(|fact| !fact.is_observed_safe())
        {
            return Err(BaselineAssignmentError::Invalid);
        }
        if self.app_revision != expected_revision {
            return Err(BaselineAssignmentError::RevisionMismatch);
        }
        if now > self.expires_at_utc {
            return Err(BaselineAssignmentError::Stale);
        }
        let mut unsigned = self.clone();
        unsigned.integrity_sha256.clear();
        if assignment_digest(&unsigned)? != self.integrity_sha256 {
            return Err(BaselineAssignmentError::Invalid);
        }
        Ok(())
    }
}

impl AssignmentEnvironment {
    pub fn facts(&self) -> [&AssignmentFact; 9] {
        [
            &self.os,
            &self.hardware,
            &self.power,
            &self.devices,
            &self.sample_configuration,
            &self.model,
            &self.route,
            &self.language,
            &self.network_canary_method,
        ]
    }
}

impl AssignmentFact {
    fn is_observed_safe(&self) -> bool {
        self.status == AssignmentFactStatus::Observed
            && self.value.as_deref().is_some_and(is_safe_display)
            && self.reason.is_none()
    }
}

pub fn embedded_app_revision() -> &'static str {
    option_env!("TELU_APP_REVISION").unwrap_or("unverified")
}

pub fn write_pending_assignment(
    app_data_dir: impl AsRef<Path>,
    assignment: &BaselineRunAssignment,
) -> Result<PathBuf, BaselineAssignmentError> {
    assignment.validate(&assignment.app_revision, Utc::now())?;
    let root = assignment_root(app_data_dir.as_ref());
    let pending = root.join("pending");
    let locks = root.join("run-locks");
    fs::create_dir_all(&pending).map_err(|_| BaselineAssignmentError::Storage)?;
    fs::create_dir_all(&locks).map_err(|_| BaselineAssignmentError::Storage)?;
    let lock_path = locks.join(&assignment.run_id);
    OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&lock_path)
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                BaselineAssignmentError::Reused
            } else {
                BaselineAssignmentError::Storage
            }
        })?;
    let path = pending.join(format!("{}.json", assignment.assignment_id));
    if let Err(error) = write_new_json(&path, assignment) {
        let _ = fs::remove_file(lock_path);
        return Err(error);
    }
    Ok(path)
}

pub fn claim_assignment(
    app_data_dir: impl AsRef<Path>,
    assignment_id: &str,
    expected_revision: &str,
    now: DateTime<Utc>,
) -> Result<BaselineRunAssignment, BaselineAssignmentError> {
    if Uuid::parse_str(assignment_id).is_err() {
        return Err(BaselineAssignmentError::Invalid);
    }
    let root = assignment_root(app_data_dir.as_ref());
    let pending = root.join("pending").join(format!("{assignment_id}.json"));
    let claimed_dir = root.join("claimed");
    let finalized = root.join("finalized").join(format!("{assignment_id}.json"));
    let claimed = claimed_dir.join(format!("{assignment_id}.json"));
    if claimed.exists() || finalized.exists() {
        return Err(BaselineAssignmentError::Reused);
    }
    if !pending.exists() {
        return Err(BaselineAssignmentError::Unauthorized);
    }
    let assignment = read_assignment(&pending)?;
    if assignment.assignment_id != assignment_id {
        return Err(BaselineAssignmentError::Invalid);
    }
    assignment.validate(expected_revision, now)?;
    fs::create_dir_all(&claimed_dir).map_err(|_| BaselineAssignmentError::Storage)?;
    fs::rename(&pending, &claimed).map_err(|_| {
        if claimed.exists() {
            BaselineAssignmentError::Reused
        } else {
            BaselineAssignmentError::Storage
        }
    })?;
    Ok(assignment)
}

pub fn mark_assignment_finalized(
    app_data_dir: impl AsRef<Path>,
    assignment_id: &str,
) -> Result<(), BaselineAssignmentError> {
    if Uuid::parse_str(assignment_id).is_err() {
        return Err(BaselineAssignmentError::Invalid);
    }
    let root = assignment_root(app_data_dir.as_ref());
    let claimed = root.join("claimed").join(format!("{assignment_id}.json"));
    let finalized_dir = root.join("finalized");
    let finalized = finalized_dir.join(format!("{assignment_id}.json"));
    if finalized.exists() {
        return Ok(());
    }
    if !claimed.exists() {
        return Err(BaselineAssignmentError::Unauthorized);
    }
    fs::create_dir_all(&finalized_dir).map_err(|_| BaselineAssignmentError::Storage)?;
    fs::rename(claimed, finalized).map_err(|_| BaselineAssignmentError::Storage)
}

pub fn claimed_assignment(
    app_data_dir: impl AsRef<Path>,
    assignment_id: &str,
) -> Result<BaselineRunAssignment, BaselineAssignmentError> {
    if Uuid::parse_str(assignment_id).is_err() {
        return Err(BaselineAssignmentError::Invalid);
    }
    read_assignment(
        &assignment_root(app_data_dir.as_ref())
            .join("claimed")
            .join(format!("{assignment_id}.json")),
    )
}

fn assignment_root(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(ASSIGNMENT_DIRECTORY)
}

fn read_assignment(path: &Path) -> Result<BaselineRunAssignment, BaselineAssignmentError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| BaselineAssignmentError::Unauthorized)?;
    if !metadata.file_type().is_file()
        || metadata.file_type().is_symlink()
        || metadata.len() == 0
        || metadata.len() > MAX_ASSIGNMENT_BYTES
    {
        return Err(BaselineAssignmentError::Invalid);
    }
    serde_json::from_slice(&fs::read(path).map_err(|_| BaselineAssignmentError::Storage)?)
        .map_err(|_| BaselineAssignmentError::Invalid)
}

fn assignment_digest(
    assignment: &BaselineRunAssignment,
) -> Result<String, BaselineAssignmentError> {
    let bytes = serde_json::to_vec(assignment).map_err(|_| BaselineAssignmentError::Invalid)?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}

fn write_new_json(
    path: &Path,
    assignment: &BaselineRunAssignment,
) -> Result<(), BaselineAssignmentError> {
    let bytes =
        serde_json::to_vec_pretty(assignment).map_err(|_| BaselineAssignmentError::Invalid)?;
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::AlreadyExists {
            BaselineAssignmentError::Reused
        } else {
            BaselineAssignmentError::Storage
        }
    })?;
    if file.write_all(&bytes).is_err() || file.write_all(b"\n").is_err() || file.sync_all().is_err()
    {
        let _ = fs::remove_file(path);
        return Err(BaselineAssignmentError::Storage);
    }
    Ok(())
}

fn is_sha256(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn is_full_git_revision(value: &str) -> bool {
    value.len() == 40 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn is_safe_identifier(value: &str) -> bool {
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
        && !value.to_ascii_lowercase().contains("/users/")
        && !value.to_ascii_lowercase().contains("c:\\users\\")
        && !value.to_ascii_lowercase().contains("bearer ")
        && !value.to_ascii_lowercase().contains("password=")
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    fn observed(value: &str) -> AssignmentFact {
        AssignmentFact {
            status: AssignmentFactStatus::Observed,
            value: Some(value.to_string()),
            reason: None,
        }
    }

    fn assignment(now: DateTime<Utc>) -> BaselineRunAssignment {
        BaselineRunAssignment {
            schema_version: BASELINE_ASSIGNMENT_SCHEMA_VERSION,
            assignment_id: "11111111-1111-4111-8111-111111111111".to_string(),
            authorization: "approved".to_string(),
            source: "telu-baseline-authorize-run-v1".to_string(),
            matrix_id: "phase1-matrix".to_string(),
            matrix_plan_sha256: "a".repeat(64),
            run_sequence: 7,
            run_id: "22222222-2222-4222-8222-222222222222".to_string(),
            scenario_id: "overload".to_string(),
            scenario_version: "phase1-baseline-v1".to_string(),
            run_kind: "measured".to_string(),
            repeat_index: 1,
            bundle_directory: "run-22222222-2222-4222-8222-222222222222".to_string(),
            app_revision: "b".repeat(40),
            issued_at_utc: now,
            expires_at_utc: now + Duration::minutes(30),
            environment: AssignmentEnvironment {
                os: observed("macos"),
                hardware: observed("apple-m4"),
                power: observed("p1"),
                devices: observed("built-in"),
                sample_configuration: observed("48000hz"),
                model: observed("parakeet"),
                route: observed("local:this-device"),
                language: observed("english"),
                network_canary_method: observed("n1"),
            },
            integrity_sha256: String::new(),
        }
        .seal()
        .expect("seal assignment")
    }

    #[test]
    fn assignment_claim_is_single_use_and_identity_bound() {
        let root = tempfile::tempdir().expect("assignment root");
        let now = Utc::now();
        let assignment = assignment(now);
        write_pending_assignment(root.path(), &assignment).expect("write assignment");
        let claimed = claim_assignment(
            root.path(),
            &assignment.assignment_id,
            &assignment.app_revision,
            now,
        )
        .expect("claim assignment");
        assert_eq!(claimed.run_id, assignment.run_id);
        assert_eq!(
            claim_assignment(
                root.path(),
                &assignment.assignment_id,
                &assignment.app_revision,
                now
            ),
            Err(BaselineAssignmentError::Reused)
        );
    }

    #[test]
    fn assignment_rejects_stale_revision_mismatch_and_tamper() {
        let now = Utc::now();
        let assignment = assignment(now);
        assert_eq!(
            assignment.validate("wrong-revision", now),
            Err(BaselineAssignmentError::RevisionMismatch)
        );
        assert_eq!(
            assignment.validate(&assignment.app_revision, now + Duration::hours(1)),
            Err(BaselineAssignmentError::Stale)
        );
        let mut future = assignment.clone();
        future.issued_at_utc = now + Duration::minutes(1);
        future.expires_at_utc = future.issued_at_utc + Duration::minutes(30);
        future = future.seal().expect("seal future assignment");
        assert_eq!(
            future.validate(&future.app_revision, now),
            Err(BaselineAssignmentError::Invalid)
        );
        let mut excessive_ttl = assignment.clone();
        excessive_ttl.expires_at_utc = now + Duration::hours(25);
        excessive_ttl = excessive_ttl.seal().expect("seal excessive TTL assignment");
        assert_eq!(
            excessive_ttl.validate(&excessive_ttl.app_revision, now),
            Err(BaselineAssignmentError::Invalid)
        );
        let mut tampered = assignment;
        tampered.run_id = "33333333-3333-4333-8333-333333333333".to_string();
        tampered.bundle_directory = format!("run-{}", tampered.run_id);
        assert_eq!(
            tampered.validate(&tampered.app_revision, now),
            Err(BaselineAssignmentError::Invalid)
        );
    }
}
