/// Application configuration constants
///
/// Centralized definitions for default models and settings.
/// Used across database initialization, import, and retranscription.

use crate::trust::{LocationClass, OutboundSnapshot};
use std::collections::BTreeSet;

/// Default Whisper model for transcription when no preference is configured.
/// This is the recommended balance of accuracy and speed.
pub const DEFAULT_WHISPER_MODEL: &str = "large-v3-turbo";

/// Default Parakeet model for transcription when no preference is configured.
/// This is the quantized version optimized for speed.
pub const DEFAULT_PARAKEET_MODEL: &str = "parakeet-tdt-0.6b-v3-int8";

/// Required application-side stages for the network-blocked local canary.
/// Physical packet observation remains the Plan 19 reference-machine gate.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum LocalCanaryWorkflowStage {
    Capture,
    Persistence,
    Recovery,
    Evaluation,
}

impl LocalCanaryWorkflowStage {
    pub const ALL: [Self; 4] = [
        Self::Capture,
        Self::Persistence,
        Self::Recovery,
        Self::Evaluation,
    ];
}

/// Application-side allowlist for one deterministic local canary run.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalNetworkBlockCanaryConfig {
    expected_run_id: String,
    declared_network_origins: BTreeSet<String>,
}

impl LocalNetworkBlockCanaryConfig {
    pub fn new(
        expected_run_id: impl Into<String>,
        declared_network_origins: impl IntoIterator<Item = String>,
    ) -> Self {
        Self {
            expected_run_id: expected_run_id.into(),
            declared_network_origins: declared_network_origins.into_iter().collect(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum LocalNetworkBlockCanaryFailure {
    #[error("the application attribution ledger is missing or disabled")]
    AttributionLedgerMissing,
    #[error("the attribution ledger belongs to run '{actual}', expected '{expected}'")]
    RunMismatch { expected: String, actual: String },
    #[error("the attribution ledger is incomplete (overflow count: {overflow_count})")]
    AttributionIncomplete { overflow_count: u64 },
    #[error("the local workflow did not complete the {stage:?} stage")]
    WorkflowIncomplete { stage: LocalCanaryWorkflowStage },
    #[error(
        "attempt {sequence} used undeclared {location_class:?} destination '{sanitized_origin}'"
    )]
    UnpermittedAttempt {
        sequence: u64,
        location_class: LocationClass,
        sanitized_origin: String,
    },
}

/// Evaluate application intent for a network-blocked local workflow.
///
/// A present and complete ledger with zero attempts is valid evidence. A
/// missing ledger is not converted into zero egress. Loopback traffic remains
/// attributed Local network work; LAN and Remote origins must be explicitly
/// declared even when the route gate blocks the connector before dispatch.
pub fn evaluate_local_network_block_canary(
    config: &LocalNetworkBlockCanaryConfig,
    outbound: Option<&OutboundSnapshot>,
    completed_stages: &BTreeSet<LocalCanaryWorkflowStage>,
) -> Result<(), LocalNetworkBlockCanaryFailure> {
    for stage in LocalCanaryWorkflowStage::ALL {
        if !completed_stages.contains(&stage) {
            return Err(LocalNetworkBlockCanaryFailure::WorkflowIncomplete { stage });
        }
    }

    let outbound = outbound.ok_or(LocalNetworkBlockCanaryFailure::AttributionLedgerMissing)?;
    if outbound.run_id != config.expected_run_id {
        return Err(LocalNetworkBlockCanaryFailure::RunMismatch {
            expected: config.expected_run_id.clone(),
            actual: outbound.run_id.clone(),
        });
    }
    if outbound.capacity == 0 || !outbound.attribution_complete || outbound.overflow_count != 0 {
        return Err(LocalNetworkBlockCanaryFailure::AttributionIncomplete {
            overflow_count: outbound.overflow_count,
        });
    }

    for attempt in &outbound.attempts {
        let is_local = attempt.route.location_class == LocationClass::Local;
        let is_declared = config
            .declared_network_origins
            .contains(&attempt.route.sanitized_origin);
        if !is_local && !is_declared {
            return Err(LocalNetworkBlockCanaryFailure::UnpermittedAttempt {
                sequence: attempt.sequence,
                location_class: attempt.route.location_class,
                sanitized_origin: attempt.route.sanitized_origin.clone(),
            });
        }
    }

    Ok(())
}

/// Whisper model catalog with metadata for all supported models.
/// Used by both WhisperEngine::discover_models() and discover_models_standalone().
///
/// Format: (name, filename, size_mb, accuracy, speed, description)
pub const WHISPER_MODEL_CATALOG: &[(&str, &str, u32, &str, &str, &str)] = &[
    // Standard f16 models (full precision)
    ("tiny", "ggml-tiny.bin", 74, "Decent", "Very Fast", "Fastest processing, good for real-time use"),
    ("base", "ggml-base.bin", 142, "Good", "Fast", "Good balance of speed and accuracy"),
    ("small", "ggml-small.bin", 466, "Good", "Medium", "Better accuracy, moderate speed"),
    ("medium", "ggml-medium.bin", 1463, "High", "Slow", "High accuracy for professional use"),
    ("large-v3-turbo", "ggml-large-v3-turbo.bin", 1549, "High", "Medium", "Best accuracy with improved speed"),
    ("large-v3", "ggml-large-v3.bin", 2951, "High", "Slow", "Most Accurate, latest large model"),

    // Q5_1 quantized models (balanced speed/accuracy, slightly better quality than Q5_0)
    ("tiny-q5_1", "ggml-tiny-q5_1.bin", 31, "Decent", "Very Fast", "Quantized tiny model, ~50% faster processing"),
    ("base-q5_1", "ggml-base-q5_1.bin", 57, "Good", "Fast", "Quantized base model, good speed/accuracy balance"),
    ("small-q5_1", "ggml-small-q5_1.bin", 181, "Good", "Fast", "Quantized small model, faster than f16 version"),

    // Q5_0 quantized models (balanced speed/accuracy)
    ("medium-q5_0", "ggml-medium-q5_0.bin", 514, "High", "Medium", "Quantized medium model, professional quality"),
    ("large-v3-turbo-q5_0", "ggml-large-v3-turbo-q5_0.bin", 547, "High", "Medium", "Quantized large model, best balance"),
    ("large-v3-q5_0", "ggml-large-v3-q5_0.bin", 1031, "High", "Slow", "Quantized large model, high accuracy"),
];
