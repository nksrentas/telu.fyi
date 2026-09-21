// audio/recording_commands.rs
//
// Slim Tauri command layer for recording functionality.
// Delegates to transcription and recording modules for actual implementation.

use anyhow::Result;
use chrono::{DateTime, Utc};
use log::{debug, error, info, warn};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use sqlx::{Error as SqlxError, SqlitePool};
use std::collections::HashMap;
use std::future::Future;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tokio::task::JoinHandle;
use uuid::Uuid;

use crate::database::repositories::meeting::{
    FinalizationGapInput, FinalizeMeetingInput, MeetingCompleteness, MeetingsRepository,
};
pub use crate::database::repositories::meeting::StartMeetingResult;
pub use crate::database::repositories::meeting::FinalizationSnapshot;
use crate::state::AppState;

use super::{
    recording_manager::RecordingStartError,
    parse_audio_device,
    default_input_device,   // Get default microphone
    default_output_device,  // Get default system audio
    RecordingManager,
};
use super::device_monitor::{DeviceEvent, DeviceMonitorType};

// Import transcription modules
use super::transcription::{
    self,
    queue_ledger::{
        QueueLedger, RejectionReason, SupersessionReason, WorkCancellationReason,
        WorkFailureReason, WorkOutcome,
    },
    reset_speech_detected_flag,
};

// Re-export TranscriptUpdate for backward compatibility
pub use super::transcription::TranscriptUpdate;

// ============================================================================
// GLOBAL STATE
// ============================================================================

// Simple recording state tracking
static IS_RECORDING: AtomicBool = AtomicBool::new(false);

/// True for the whole `stop_recording` tail (manager taken -> `recording-stopped`
/// emitted). `IS_RECORDING` must stay true through the tail — the frontend polls
/// it to keep the stop UI up — so the mic-disconnect fallback checks this flag
/// too, otherwise a fallback queued before Stop retries against a taken manager
/// and surfaces a spurious "Microphone fallback failed" toast.
static IS_RECORDING_STOPPING: AtomicBool = AtomicBool::new(false);

/// Recording is live and not being torn down — the only state in which the
/// mic-disconnect fallback should run or report.
fn recording_live() -> bool {
    IS_RECORDING.load(Ordering::SeqCst) && !IS_RECORDING_STOPPING.load(Ordering::SeqCst)
}

/// Recording is live AND the global manager is still the session `s` belongs to.
/// Used by the mic-disconnect fallback to refuse acting on a *later* recording
/// after a Stop/Start swapped the manager out from under an in-flight task.
///
/// NOTE: this locks `RECORDING_MANAGER`. Never call it while already holding
/// that lock (e.g. inside a `RECORDING_MANAGER.lock()` scope) — the std Mutex
/// is non-reentrant and it would self-deadlock. All current callers invoke it
/// outside any held lock; keep it that way.
fn session_live(s: &Arc<super::RecordingState>) -> bool {
    recording_live()
        && RECORDING_MANAGER
            .lock()
            .unwrap()
            .as_ref()
            .map_or(false, |m| Arc::ptr_eq(m.get_state(), s))
}

/// RAII guard for the stop-tail flag. Sets `IS_RECORDING_STOPPING` true on
/// construction and clears it on Drop — including during unwind — so a panic
/// anywhere in the ~320-line stop tail can't leave the flag stuck true and
/// silently kill the mic-disconnect fallback for every later recording.
///
/// This unwind-clears behaviour depends on `panic = "unwind"` (the default).
/// If a release profile ever sets `panic = "abort"`, Drop won't run on panic
/// and the stuck-flag failure mode returns — add a start-time reset then.
struct StoppingGuard;
impl StoppingGuard {
    fn new() -> Self {
        IS_RECORDING_STOPPING.store(true, Ordering::SeqCst);
        StoppingGuard
    }
}
impl Drop for StoppingGuard {
    fn drop(&mut self) {
        IS_RECORDING_STOPPING.store(false, Ordering::SeqCst);
    }
}

/// Shared start-path finalize. Both start commands MUST call this so a new
/// start path can't silently ship with a per-session flag left unreset (e.g.
/// the mic-recovery budget already exhausted).
fn finalize_recording_start() {
    info!("🔍 Setting IS_RECORDING to true and resetting SPEECH_DETECTED_EMITTED");
    IS_RECORDING.store(true, Ordering::SeqCst);
    MIC_FALLBACK_FAILED_ATTEMPTS.store(0, Ordering::SeqCst); // fresh mic-recovery budget per session
    LAST_FINALIZATION.lock().unwrap().take();
    reset_speech_detected_flag(); // reset speech-detected emit latch for the new session
}

// Global recording manager and transcription task to keep them alive during recording
static RECORDING_MANAGER: Mutex<Option<RecordingManager>> = Mutex::new(None);
static TRANSCRIPTION_TASK: Mutex<Option<JoinHandle<()>>> = Mutex::new(None);
static STOP_SERIALIZER: Lazy<tokio::sync::Mutex<()>> =
    Lazy::new(|| tokio::sync::Mutex::new(()));
static LAST_FINALIZATION: Mutex<Option<FinalizationSnapshot>> = Mutex::new(None);

// Listener ID for proper cleanup - prevents microphone from staying active after recording stops
static TRANSCRIPT_LISTENER_ID: Mutex<Option<tauri::EventId>> = Mutex::new(None);

// Canonical identity for the live native session. This is a projection of the
// committed SQLite row and exists only to support event redelivery/page reload;
// it never mints or remaps an ID.
static CURRENT_MEETING: Mutex<Option<StartMeetingResult>> = Mutex::new(None);

const UI_ACKNOWLEDGED_STAGE: &str = "ui_acknowledged";
const DELIVERY_TOKEN_TTL: Duration = Duration::from_secs(5 * 60);
const RESERVED_FUTURE_STAGES: [&str; 6] = [
    "context_selected",
    "generation_started",
    "generation_completed",
    "generation_cancelled",
    "generation_superseded",
    "visible_suggestion",
];
static DELIVERY_TRACKER: Lazy<DeliveryTracker> = Lazy::new(DeliveryTracker::new);

const TRANSCRIPTION_RUNTIME_START_ERROR_CODE: &str =
    "TRANSCRIPTION_RUNTIME_INITIALIZATION_FAILED";
const TRANSCRIPTION_RUNTIME_USER_MESSAGE: &str = "Speech recognition could not initialize. Restart Meetily. If the problem continues, repair or reinstall the app.";
const MEETING_IDENTITY_PERSISTENCE_ERROR_CODE: &str = "MEETING_IDENTITY_PERSISTENCE_FAILED";

// ============================================================================
// PUBLIC TYPES
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct RecordingArgs {
    pub save_path: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct TranscriptionStatus {
    pub chunks_in_queue: usize,
    pub is_processing: bool,
    pub last_activity_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct FinalizationDrainReport {
    deadline_expired: bool,
    worker_failed: bool,
    remaining_work_ids: Vec<String>,
}

async fn drain_transcription_to_deadline(
    mut task_handle: JoinHandle<()>,
    queue_ledger: Arc<QueueLedger>,
    deadline: Duration,
) -> FinalizationDrainReport {
    match tokio::time::timeout(deadline, &mut task_handle).await {
        Ok(Ok(())) => {
            let stranded = nonterminal_work_ids(&queue_ledger);
            let worker_failed = !stranded.is_empty();
            if worker_failed {
                queue_ledger.finish_all_nonterminal(
                    WorkOutcome::Failed(WorkFailureReason::DispatchClosed),
                    Instant::now(),
                );
            }
            FinalizationDrainReport {
                deadline_expired: false,
                worker_failed,
                remaining_work_ids: Vec::new(),
            }
        }
        Ok(Err(_join_error)) => {
            queue_ledger.finish_all_nonterminal(
                WorkOutcome::Failed(WorkFailureReason::WorkerPanicked),
                Instant::now(),
            );
            FinalizationDrainReport {
                deadline_expired: false,
                worker_failed: true,
                remaining_work_ids: Vec::new(),
            }
        }
        Err(_) => {
            let remaining_work_ids = nonterminal_work_ids(&queue_ledger);
            task_handle.abort();
            let _ = task_handle.await;
            queue_ledger.finish_all_nonterminal(
                WorkOutcome::Cancelled(WorkCancellationReason::Deadline),
                Instant::now(),
            );
            FinalizationDrainReport {
                deadline_expired: true,
                worker_failed: false,
                remaining_work_ids,
            }
        }
    }
}

fn nonterminal_work_ids(queue_ledger: &QueueLedger) -> Vec<String> {
    let mut ids = queue_ledger
        .work_records()
        .into_iter()
        .filter(|record| record.outcome.is_none())
        .map(|record| record.work_id)
        .collect::<Vec<_>>();
    ids.sort();
    ids
}

fn build_finalize_meeting_input(
    meeting_id: &str,
    queue_ledger: &QueueLedger,
    deadline_at_utc: String,
    deadline_ms: u64,
    capture_closed: bool,
    durable_writes_succeeded: bool,
    drain: &FinalizationDrainReport,
) -> FinalizeMeetingInput {
    let work_records = queue_ledger.work_records();
    let mut reason_codes = Vec::new();
    let mut gaps = Vec::new();

    if drain.deadline_expired {
        reason_codes.push("deadline_exceeded".to_string());
    }
    if drain.worker_failed {
        reason_codes.push("transcription_worker_failed".to_string());
    }
    for record in work_records {
        let reason_code = match record.outcome {
            Some(WorkOutcome::Completed) => continue,
            Some(WorkOutcome::Failed(reason)) => {
                reason_codes.push("work_failed".to_string());
                work_failure_reason_code(reason)
            }
            Some(WorkOutcome::Cancelled(reason)) => {
                reason_codes.push("work_cancelled".to_string());
                work_cancellation_reason_code(reason)
            }
            Some(WorkOutcome::Superseded(reason)) => {
                reason_codes.push("work_superseded".to_string());
                supersession_reason_code(reason)
            }
            None => {
                reason_codes.push("work_remaining".to_string());
                "work_remaining"
            }
        };
        gaps.push(FinalizationGapInput {
            work_id: record.work_id,
            gap_kind: "accepted_work".to_string(),
            reason_code: reason_code.to_string(),
            audio_start_ms: None,
            audio_end_ms: None,
        });
    }
    for gap in queue_ledger.gaps() {
        reason_codes.push("work_rejected".to_string());
        gaps.push(FinalizationGapInput {
            work_id: gap.work_id,
            gap_kind: "rejected_work".to_string(),
            reason_code: rejection_reason_code(gap.reason).to_string(),
            audio_start_ms: gap.audio_start_ms,
            audio_end_ms: gap.audio_end_ms,
        });
    }
    reason_codes.sort();
    reason_codes.dedup();
    let evidence_write_failed = gaps
        .iter()
        .any(|gap| gap.reason_code == "evidence_persistence_failed");

    FinalizeMeetingInput {
        meeting_id: meeting_id.to_string(),
        capture_closed,
        durable_writes_succeeded: durable_writes_succeeded && !evidence_write_failed,
        queue: queue_ledger.snapshot(Instant::now()),
        deadline_at_utc,
        deadline_ms,
        remaining_work_ids: drain.remaining_work_ids.clone(),
        reason_codes,
        gaps,
    }
}

fn work_failure_reason_code(reason: WorkFailureReason) -> &'static str {
    match reason {
        WorkFailureReason::ModelUnavailable => "model_unavailable",
        WorkFailureReason::TranscriptionFailed => "transcription_failed",
        WorkFailureReason::EvidencePersistenceFailed => "evidence_persistence_failed",
        WorkFailureReason::DispatchClosed => "dispatch_closed",
        WorkFailureReason::WorkerPanicked => "worker_panicked",
    }
}

fn work_cancellation_reason_code(reason: WorkCancellationReason) -> &'static str {
    match reason {
        WorkCancellationReason::Shutdown => "shutdown",
        WorkCancellationReason::Deadline => "deadline_exceeded",
    }
}

fn supersession_reason_code(reason: SupersessionReason) -> &'static str {
    match reason {
        SupersessionReason::NewerWork => "newer_work",
    }
}

fn rejection_reason_code(reason: RejectionReason) -> &'static str {
    match reason {
        RejectionReason::Capacity => "capacity",
        RejectionReason::Closed => "closed",
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct DeliveryToken(String);

impl DeliveryToken {
    fn new() -> Self {
        Self(Uuid::new_v4().to_string())
    }

    fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone)]
struct PendingDelivery {
    meeting_id: String,
    evidence_id: String,
    emitted_at: Instant,
    emitted_at_utc: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum DeliveryAckError {
    UnknownToken,
    IdentityMismatch,
    StaleToken,
    ReservedFutureStage,
    InvalidStage,
    TrackerPoisoned,
}

impl DeliveryAckError {
    fn code(&self) -> &'static str {
        match self {
            Self::UnknownToken => "UI_ACK_UNKNOWN_TOKEN",
            Self::IdentityMismatch => "UI_ACK_IDENTITY_MISMATCH",
            Self::StaleToken => "UI_ACK_STALE_TOKEN",
            Self::ReservedFutureStage => "UI_ACK_RESERVED_FUTURE_STAGE",
            Self::InvalidStage => "UI_ACK_INVALID_STAGE",
            Self::TrackerPoisoned => "UI_ACK_TRACKER_UNAVAILABLE",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct UiAcknowledgement {
    pub stage: String,
    pub delivery_token: String,
    pub meeting_id: String,
    pub evidence_id: String,
    pub emitted_at_utc: DateTime<Utc>,
    pub acknowledged_at_utc: DateTime<Utc>,
    pub duration_micros: u64,
}

pub struct DeliveryTracker {
    pending: Mutex<HashMap<String, PendingDelivery>>,
}

impl DeliveryTracker {
    fn new() -> Self {
        Self {
            pending: Mutex::new(HashMap::new()),
        }
    }

    fn register_at(
        &self,
        meeting_id: &str,
        evidence_id: &str,
        emitted_at: Instant,
        emitted_at_utc: DateTime<Utc>,
    ) -> std::result::Result<DeliveryToken, DeliveryAckError> {
        let mut pending = self.pending.lock().map_err(|_| DeliveryAckError::TrackerPoisoned)?;
        pending.retain(|_, delivery| {
            emitted_at
                .checked_duration_since(delivery.emitted_at)
                .unwrap_or_default()
                <= DELIVERY_TOKEN_TTL
        });
        let token = DeliveryToken::new();
        pending.insert(token.0.clone(), PendingDelivery {
            meeting_id: meeting_id.to_string(),
            evidence_id: evidence_id.to_string(),
            emitted_at,
            emitted_at_utc,
        });
        Ok(token)
    }

    fn acknowledge_at(
        &self,
        token: &DeliveryToken,
        meeting_id: &str,
        evidence_id: &str,
        acknowledged_at: Instant,
        acknowledged_at_utc: DateTime<Utc>,
    ) -> std::result::Result<UiAcknowledgement, DeliveryAckError> {
        validate_phase1_stage_name(UI_ACKNOWLEDGED_STAGE)?;
        let mut pending = self.pending.lock().map_err(|_| DeliveryAckError::TrackerPoisoned)?;
        let delivery = pending
            .get(token.as_str())
            .cloned()
            .ok_or(DeliveryAckError::UnknownToken)?;

        if delivery.meeting_id != meeting_id || delivery.evidence_id != evidence_id {
            return Err(DeliveryAckError::IdentityMismatch);
        }
        let elapsed = acknowledged_at
            .checked_duration_since(delivery.emitted_at)
            .unwrap_or_default();
        if elapsed > DELIVERY_TOKEN_TTL {
            pending.remove(token.as_str());
            return Err(DeliveryAckError::StaleToken);
        }

        pending.remove(token.as_str());
        Ok(UiAcknowledgement {
            stage: UI_ACKNOWLEDGED_STAGE.to_string(),
            delivery_token: token.0.clone(),
            meeting_id: delivery.meeting_id,
            evidence_id: delivery.evidence_id,
            emitted_at_utc: delivery.emitted_at_utc,
            acknowledged_at_utc,
            duration_micros: elapsed.as_micros().try_into().unwrap_or(u64::MAX),
        })
    }

    fn discard(&self, token: &DeliveryToken) {
        if let Ok(mut pending) = self.pending.lock() {
            pending.remove(token.as_str());
        }
    }
}

fn validate_phase1_stage_name(stage: &str) -> std::result::Result<(), DeliveryAckError> {
    if stage == UI_ACKNOWLEDGED_STAGE {
        return Ok(());
    }
    if RESERVED_FUTURE_STAGES.contains(&stage) {
        return Err(DeliveryAckError::ReservedFutureStage);
    }
    Err(DeliveryAckError::InvalidStage)
}

fn current_queue_ledger(meeting_id: &str) -> Option<Arc<QueueLedger>> {
    RECORDING_MANAGER
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .as_ref()
        .and_then(|manager| manager.get_state().queue_ledger())
        .filter(|ledger| ledger.meeting_id() == meeting_id)
}

/// Publish only a canonical, already-persisted final. Registering here keeps
/// the delivery token downstream of the persistence-before-publish boundary.
pub(crate) fn emit_canonical_transcript<R: Runtime>(
    app: &AppHandle<R>,
    canonical: &TranscriptUpdate,
) -> std::result::Result<(), String> {
    let meeting_id = canonical.meeting_id.as_deref()
        .ok_or_else(|| "canonical_transcript_missing_meeting_id".to_string())?;
    let evidence_id = canonical.evidence_id.as_deref()
        .ok_or_else(|| "canonical_transcript_missing_evidence_id".to_string())?;
    if !canonical.is_final || !canonical.is_canonical {
        return Err("canonical_transcript_invalid_finality".to_string());
    }

    let token = DELIVERY_TRACKER
        .register_at(meeting_id, evidence_id, Instant::now(), Utc::now())
        .map_err(|error| error.code().to_string())?;
    let mut delivered = canonical.clone();
    delivered.delivery_token = Some(token.0.clone());
    if app.emit("transcript-update", &delivered).is_err() {
        DELIVERY_TRACKER.discard(&token);
        return Err("canonical_transcript_emit_failed".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn acknowledge_transcript_visible(
    delivery_token: String,
    meeting_id: String,
    evidence_id: String,
) -> std::result::Result<UiAcknowledgement, String> {
    let acknowledgement = DELIVERY_TRACKER
        .acknowledge_at(
            &DeliveryToken(delivery_token),
            &meeting_id,
            &evidence_id,
            Instant::now(),
            Utc::now(),
        )
        .map_err(|error| error.code().to_string())?;
    if let Some(ledger) = current_queue_ledger(&meeting_id) {
        if let Some(identity) = ledger.stage_identity_for_evidence(&evidence_id) {
            let admission = ledger
                .stage_clock()
                .try_record(crate::observability::StageName::UiAcknowledged, &identity);
            if admission != crate::observability::StageAdmission::Accepted {
                warn!(
                    "UI acknowledgement stage observation was not admitted: {:?}",
                    admission
                );
            }
        }
    }
    info!(
        "stage={} meeting_id={} evidence_id={} duration_micros={} emitted_at_utc={} acknowledged_at_utc={}",
        acknowledgement.stage,
        acknowledgement.meeting_id,
        acknowledgement.evidence_id,
        acknowledgement.duration_micros,
        acknowledgement.emitted_at_utc,
        acknowledgement.acknowledged_at_utc,
    );
    Ok(acknowledgement)
}

#[derive(Debug)]
enum StartMeetingFailure {
    IdentityPersistence(SqlxError),
    Capture(RecordingStartError),
}

/// Commit the Rust-owned meeting identity before invoking the native capture
/// closure. Keeping this ordering in one helper makes the failure invariant
/// directly testable without touching physical audio devices.
async fn persist_session_before_capture<T, F, Fut>(
    pool: &SqlitePool,
    title: String,
    start_capture: F,
) -> Result<(StartMeetingResult, T), StartMeetingFailure>
where
    F: FnOnce(StartMeetingResult) -> Fut,
    Fut: Future<Output = Result<T, RecordingStartError>>,
{
    let start_result = MeetingsRepository::create_session(pool, title)
        .await
        .map_err(StartMeetingFailure::IdentityPersistence)?;
    let capture = start_capture(start_result.clone())
        .await
        .map_err(StartMeetingFailure::Capture)?;
    Ok((start_result, capture))
}

fn recording_database_pool<R: Runtime>(app: &AppHandle<R>) -> Result<SqlitePool, String> {
    app.try_state::<AppState>()
        .map(|state| state.db_manager.pool().clone())
        .ok_or_else(|| MEETING_IDENTITY_PERSISTENCE_ERROR_CODE.to_string())
}

fn map_start_meeting_failure<R: Runtime>(
    app: &AppHandle<R>,
    failure: StartMeetingFailure,
) -> String {
    match failure {
        StartMeetingFailure::IdentityPersistence(_source) => {
            error!(
                "Recording start blocked before capture; code={}",
                MEETING_IDENTITY_PERSISTENCE_ERROR_CODE
            );
            MEETING_IDENTITY_PERSISTENCE_ERROR_CODE.to_string()
        }
        StartMeetingFailure::Capture(error) => map_recording_start_error(app, error),
    }
}

fn map_recording_start_error<R: Runtime>(
    app: &AppHandle<R>,
    error: RecordingStartError,
) -> String {
    crate::tray::update_tray_menu(app);

    match error {
        RecordingStartError::TranscriptionRuntime(source) => {
            error!("Failed to initialize speech recognition: {source:#}");
            let error = RecordingStartError::TranscriptionRuntime(source);
            if let Err(emit_error) = app.emit("transcription-error", serde_json::json!({
                "error": error.to_string(),
                "userMessage": TRANSCRIPTION_RUNTIME_USER_MESSAGE,
                "actionable": false,
                "phase": "startup"
            })) {
                error!("Failed to emit transcription runtime startup error: {emit_error}");
            }
            TRANSCRIPTION_RUNTIME_START_ERROR_CODE.to_string()
        }
        RecordingStartError::Other(error) => format!("Failed to start recording: {error}"),
    }
}

// ============================================================================
// DEVICE RESOLUTION
// ============================================================================

/// Resolve the microphone to record with: requested device (if it actually
/// enumerates) → system default → none (system-audio-only recording).
///
/// The device picker has no "no microphone" option: choosing "Default
/// Microphone" sends `None`, so `None` here means "use the system default",
/// NOT "record without a mic". A specifically-requested mic that isn't in
/// cpal's current enumeration (a stale saved device, or a Continuity
/// "iPhone Microphone" that isn't available right now) is downgraded to the
/// system default — the same `default_input_device()` helper the
/// mid-recording disconnect path uses — so start never hard-fails with
/// "Device not found".
///
/// Emits at most one event per call:
/// - `mic-device-switched` — a specific mic was requested but unavailable,
///   and we fell back to the default (reuses the existing frontend listener).
/// - `mic-unavailable` — no usable mic at all; recording proceeds with
///   system audio only. If system audio is also unavailable, start_streams'
///   own guard reports it.
/// Resolving `None` to the default is the user's actual choice, so it's silent.
///
/// ponytail: sync pre-flight substitution (matches Pro), not catch-and-retry —
/// stream.rs keeps its hard-fail as the last line of defense. cpal calls
/// block briefly either way.
fn resolve_mic_or_default<R: Runtime>(
    app: &AppHandle<R>,
    requested_name: Option<&str>,
) -> Option<Arc<super::AudioDevice>> {
    use cpal::traits::{DeviceTrait, HostTrait};

    let requested_specific = requested_name.is_some();

    if let Some(name) = requested_name {
        match parse_audio_device(name) {
            Ok(device) => {
                let exists = cpal::default_host()
                    .input_devices()
                    .map(|mut it| it.any(|d| d.name().map(|n| n == device.name).unwrap_or(false)))
                    .unwrap_or(false);
                if exists {
                    info!("✅ Using requested microphone: '{}'", device.name);
                    return Some(Arc::new(device));
                }
                warn!(
                    "⚠️ Requested mic '{}' not enumerated — falling back to system default",
                    device.name
                );
            }
            Err(e) => {
                warn!(
                    "⚠️ Requested mic '{}' not available: {} — falling back to system default",
                    name, e
                );
            }
        }
    }

    match default_input_device() {
        Ok(device) => {
            info!("✅ Using default microphone: '{}'", device.name);
            if requested_specific {
                // Tell the user their selected mic wasn't available and which
                // mic is actually recording. Reuses the mic-device-switched
                // listener the disconnect path wires up.
                let _ = app.emit(
                    "mic-device-switched",
                    serde_json::json!({ "device_name": device.name }),
                );
            }
            Some(Arc::new(device))
        }
        Err(e) => {
            warn!("❌ No microphone available: {} — recording system audio only", e);
            let _ = app.emit("mic-unavailable", serde_json::json!({}));
            None
        }
    }
}

/// System-audio analog of `resolve_mic_or_default`: `Some(name)` -> parse it,
/// falling back to the default output if unparseable; `None` ("Default System
/// Audio" in the UI) -> default output. Returns `None` only when no output
/// device exists — system audio is optional, mic-only recording proceeds.
///
/// ponytail: no cpal enumeration check (unlike the mic helper) — Linux system
/// devices are Pulse/ALSA monitor *inputs* tagged Output, so output_devices()
/// would false-negative them. stream.rs still hard-fails on a missing device.
fn resolve_system_or_default(requested_name: Option<&str>) -> Option<Arc<super::AudioDevice>> {
    if let Some(name) = requested_name {
        match parse_audio_device(name) {
            Ok(device) => {
                info!("✅ Using requested system audio: '{}'", device.name);
                return Some(Arc::new(device));
            }
            Err(e) => warn!(
                "⚠️ Requested system audio '{}' not available: {} — falling back to system default",
                name, e
            ),
        }
    }

    match default_output_device() {
        Ok(device) => {
            info!("✅ Using default system audio: '{}'", device.name);
            Some(Arc::new(device))
        }
        Err(e) => {
            warn!("⚠️ No system audio available: {} — recording will continue with microphone only", e);
            None
        }
    }
}

/// Wake idle audio hardware before checking microphone callbacks, and finish
/// validation before creating any recording resources.
#[cfg(target_os = "macos")]
async fn prepare_audio_for_recording(
    system_device: Option<&super::AudioDevice>,
) -> Result<(), String> {
    use cpal::traits::{DeviceTrait, HostTrait};

    let wake_name = system_device
        .map(|s| s.name.clone())
        .or_else(|| {
            cpal::default_host()
                .default_output_device()
                .and_then(|d| d.name().ok())
        });
    if let Some(name) = wake_name {
        if let Err(e) = super::recording_manager::wake_audio_connection(&name).await {
            warn!("[AUDIO_WAKE] Wake failed: {} — proceeding anyway", e);
        }
    }

    if let Err(e) = super::devices::verify_microphone_access().await {
        error!("Microphone access verification failed: {}", e);
        return Err(format!("Microphone access required: {}", e));
    }
    Ok(())
}

// ============================================================================
// RECORDING COMMANDS
// ============================================================================

/// Start recording with default devices
pub async fn start_recording<R: Runtime>(
    app: AppHandle<R>,
) -> Result<StartMeetingResult, String> {
    start_recording_with_meeting_name(app, None).await
}

/// Start recording with default devices and optional meeting name
pub async fn start_recording_with_meeting_name<R: Runtime>(
    app: AppHandle<R>,
    meeting_name: Option<String>,
) -> Result<StartMeetingResult, String> {
    info!(
        "Starting recording with default devices, meeting: {:?}",
        meeting_name
    );

    let engine_lifecycle_guard = super::common::acquire_engine_lifecycle_lock().await;

    // Check if already recording
    let current_recording_state = IS_RECORDING.load(Ordering::SeqCst);
    info!("🔍 IS_RECORDING state check: {}", current_recording_state);
    if current_recording_state {
        return Err("Recording already in progress".to_string());
    }

    if let Err(error) = crate::ensure_onnx_runtime_available() {
        return Err(map_recording_start_error(
            &app,
            RecordingStartError::TranscriptionRuntime(error),
        ));
    }

    // Validate that transcription models are available before starting recording
    info!("🔍 Validating transcription model availability before starting recording...");
    if let Err(validation_error) = transcription::validate_transcription_model_ready(&app).await {
        error!("Model validation failed: {}", validation_error);

        // Emit error event for frontend - actionable: false to show toast instead of modal
        // (download progress is already shown in top-right toast)
        let _ = app.emit("transcription-error", serde_json::json!({
            "error": validation_error,
            "userMessage": format!("Recording cannot start: {}", validation_error),
            "actionable": false,
            "phase": "startup"
        }));

        return Err(validation_error);
    }
    info!("✅ Transcription model validation passed");

    // Notify frontend that startup has begun (surfaces STARTING state)
    app.emit("recording-starting", serde_json::json!({
        "message": "Recording initialization started"
    })).map_err(|e| e.to_string())?;

    // Load recording preferences to get auto_save AND device preferences
    let (auto_save, preferred_mic_name, preferred_system_name) =
        match super::recording_preferences::load_recording_preferences(&app).await {
            Ok(prefs) => {
                info!("📋 Loaded recording preferences: auto_save={}, preferred_mic={:?}, preferred_system={:?}",
                      prefs.auto_save, prefs.preferred_mic_device, prefs.preferred_system_device);
                (prefs.auto_save, prefs.preferred_mic_device, prefs.preferred_system_device)
            }
            Err(e) => {
                warn!("Failed to load recording preferences, using defaults: {}", e);
                (true, None, None)
            }
        };

    #[cfg(not(target_os = "macos"))]
    let microphone_device = resolve_mic_or_default(&app, preferred_mic_name.as_deref());

    let system_device = resolve_system_or_default(preferred_system_name.as_deref());

    #[cfg(target_os = "macos")]
    prepare_audio_for_recording(system_device.as_deref()).await?;

    #[cfg(target_os = "macos")]
    let microphone_device = resolve_mic_or_default(&app, preferred_mic_name.as_deref());

    // Async-first approach - no more blocking operations!
    info!("🚀 Starting async recording initialization");

    // Always ensure a meeting name is set so incremental saver initializes
    let effective_meeting_name = meeting_name.clone().unwrap_or_else(|| {
        // Example: Meeting 2025-10-03_08-25-23
        let now = chrono::Local::now();
        format!(
            "Meeting {}",
            now.format("%Y-%m-%d_%H-%M-%S")
        )
    });

    let database_pool = recording_database_pool(&app)?;

    // Constructing/configuring the manager is side-effect free. The helper
    // below commits identity before its closure may start capture.
    let mut manager = RecordingManager::new();
    manager.set_meeting_name(Some(effective_meeting_name.clone()));

    // Set up error callback
    let app_for_error = app.clone();
    manager.set_error_callback(move |error| {
        let _ = app_for_error.emit("recording-error", error.user_message());
    });

    // Persist the canonical meeting before native capture can accept audio.
    let (start_result, (mut manager, transcription_receiver)) =
        persist_session_before_capture(&database_pool, effective_meeting_name, move |start_result| async move {
            manager.set_meeting_identity(
                start_result.meeting_id,
                start_result.lifecycle.as_str().to_string(),
                MeetingCompleteness::Pending.as_str().to_string(),
                None,
            )?;
            let transcription_receiver = manager
                .start_recording(microphone_device, system_device, auto_save)
                .await?;
            Ok((manager, transcription_receiver))
        })
        .await
        .map_err(|failure| map_start_meeting_failure(&app, failure))?;

    // Take the device event receiver BEFORE storing manager globally.
    // A background task will process device events (hot-swap) without frontend polling.
    let device_event_receiver = manager.take_device_event_receiver();
    let session = manager.get_state().clone();

    // Store the manager globally to keep it alive
    {
        let mut global_manager = RECORDING_MANAGER.lock().unwrap();
        *global_manager = Some(manager);
    }

    // Spawn background device event processor (mic-disconnect fallback).
    if let Some(receiver) = device_event_receiver {
        spawn_device_event_processor(app.clone(), receiver, session.clone());
    }

    // Flip recording live + reset per-session flags (speech-detected latch,
    // mic-recovery budget). Shared with the other start path — see helper.
    finalize_recording_start();
    {
        let mut current_meeting = CURRENT_MEETING.lock().unwrap();
        *current_meeting = Some(start_result.clone());
    }
    drop(engine_lifecycle_guard);

    // Start optimized parallel transcription task and store handle
    let queue_ledger = session
        .queue_ledger()
        .expect("successful recording start initializes the transcription queue ledger");
    let task_handle = transcription::start_transcription_task(
        app.clone(),
        transcription_receiver,
        database_pool.clone(),
        start_result.meeting_id.clone(),
        queue_ledger,
    );
    {
        let mut global_task = TRANSCRIPTION_TASK.lock().unwrap();
        *global_task = Some(task_handle);
    }

    // CRITICAL: Listen for transcript-update events and save to recording manager
    // This enables transcript history persistence for page reload sync
    // Store listener ID for cleanup during stop_recording to ensure microphone is released
    {
        use tauri::Listener;
        let listener_id = app.listen("transcript-update", move |event: tauri::Event| {
            // Parse the transcript update from the event payload
            if let Ok(update) = serde_json::from_str::<TranscriptUpdate>(event.payload()) {
                // Create structured transcript segment
                let segment = crate::audio::recording_saver::TranscriptSegment {
                    id: format!("seg_{}", update.sequence_id),
                    text: update.text.clone(),
                    audio_start_time: update.audio_start_time,
                    audio_end_time: update.audio_end_time,
                    duration: update.duration,
                    display_time: update.timestamp.clone(), // Use wall-clock timestamp for display
                    confidence: update.confidence,
                    sequence_id: update.sequence_id,
                };

                // Save to recording manager
                if let Ok(manager_guard) = RECORDING_MANAGER.lock() {
                    if let Some(manager) = manager_guard.as_ref() {
                        manager.add_transcript_segment(segment);
                    }
                }
            }
        });
        let mut global_listener = TRANSCRIPT_LISTENER_ID.lock().unwrap();
        *global_listener = Some(listener_id);
        info!("✅ Transcript-update event listener registered for history persistence");
    }

    // Emit success event
    app.emit("recording-started", &start_result)
        .map_err(|e| e.to_string())?;

    // Update tray menu to reflect recording state
    crate::tray::update_tray_menu(&app);

    info!("✅ Recording started successfully with async-first approach");

    Ok(start_result)
}

/// Start recording with specific devices
pub async fn start_recording_with_devices<R: Runtime>(
    app: AppHandle<R>,
    mic_device_name: Option<String>,
    system_device_name: Option<String>,
) -> Result<StartMeetingResult, String> {
    start_recording_with_devices_and_meeting(app, mic_device_name, system_device_name, None).await
}

/// Start recording with specific devices and optional meeting name
pub async fn start_recording_with_devices_and_meeting<R: Runtime>(
    app: AppHandle<R>,
    mic_device_name: Option<String>,
    system_device_name: Option<String>,
    meeting_name: Option<String>,
) -> Result<StartMeetingResult, String> {
    info!(
        "Starting recording with specific devices: mic={:?}, system={:?}, meeting={:?}",
        mic_device_name, system_device_name, meeting_name
    );

    let engine_lifecycle_guard = super::common::acquire_engine_lifecycle_lock().await;

    // Check if already recording
    let current_recording_state = IS_RECORDING.load(Ordering::SeqCst);
    info!("🔍 IS_RECORDING state check: {}", current_recording_state);
    if current_recording_state {
        return Err("Recording already in progress".to_string());
    }

    if let Err(error) = crate::ensure_onnx_runtime_available() {
        return Err(map_recording_start_error(
            &app,
            RecordingStartError::TranscriptionRuntime(error),
        ));
    }

    // Validate that transcription models are available before starting recording
    info!("🔍 Validating transcription model availability before starting recording...");
    if let Err(validation_error) = transcription::validate_transcription_model_ready(&app).await {
        error!("Model validation failed: {}", validation_error);

        // Emit error event for frontend - actionable: false to show toast instead of modal
        // (download progress is already shown in top-right toast)
        let _ = app.emit("transcription-error", serde_json::json!({
            "error": validation_error,
            "userMessage": format!("Recording cannot start: {}", validation_error),
            "actionable": false,
            "phase": "startup"
        }));

        return Err(validation_error);
    }
    info!("✅ Transcription model validation passed");

    // Notify frontend that startup has begun (surfaces STARTING state)
    app.emit("recording-starting", serde_json::json!({
        "message": "Recording initialization started"
    })).map_err(|e| e.to_string())?;

    #[cfg(not(target_os = "macos"))]
    let mic_device = resolve_mic_or_default(&app, mic_device_name.as_deref());

    let system_device = resolve_system_or_default(system_device_name.as_deref());

    #[cfg(target_os = "macos")]
    prepare_audio_for_recording(system_device.as_deref()).await?;

    #[cfg(target_os = "macos")]
    let mic_device = resolve_mic_or_default(&app, mic_device_name.as_deref());

    // Async-first approach for custom devices - no more blocking operations!
    info!("🚀 Starting async recording initialization with custom devices");

    // Load recording preferences to check auto_save setting
    let auto_save = match super::recording_preferences::load_recording_preferences(&app).await {
        Ok(prefs) => {
            info!("📋 Loaded recording preferences: auto_save={}", prefs.auto_save);
            prefs.auto_save
        }
        Err(e) => {
            warn!("Failed to load recording preferences, defaulting to auto_save=true: {}", e);
            true // Default to saving if preferences can't be loaded
        }
    };

    // Always ensure a meeting name is set so incremental saver initializes
    let effective_meeting_name = meeting_name.clone().unwrap_or_else(|| {
        let now = chrono::Local::now();
        format!(
            "Meeting {}",
            now.format("%Y-%m-%d_%H-%M-%S")
        )
    });

    let database_pool = recording_database_pool(&app)?;

    let mut manager = RecordingManager::new();
    manager.set_meeting_name(Some(effective_meeting_name.clone()));

    // Set up error callback
    let app_for_error = app.clone();
    manager.set_error_callback(move |error| {
        let _ = app_for_error.emit("recording-error", error.user_message());
    });

    // Persist the canonical meeting before native capture can accept audio.
    let (start_result, (mut manager, transcription_receiver)) =
        persist_session_before_capture(&database_pool, effective_meeting_name, move |start_result| async move {
            manager.set_meeting_identity(
                start_result.meeting_id,
                start_result.lifecycle.as_str().to_string(),
                MeetingCompleteness::Pending.as_str().to_string(),
                None,
            )?;
            let transcription_receiver = manager
                .start_recording(mic_device, system_device, auto_save)
                .await?;
            Ok((manager, transcription_receiver))
        })
        .await
        .map_err(|failure| map_start_meeting_failure(&app, failure))?;

    // Take the device event receiver BEFORE storing manager globally.
    // A background task will process device events (hot-swap) without frontend polling.
    let device_event_receiver = manager.take_device_event_receiver();
    let session = manager.get_state().clone();

    // Store the manager globally to keep it alive
    {
        let mut global_manager = RECORDING_MANAGER.lock().unwrap();
        *global_manager = Some(manager);
    }

    // Spawn background device event processor (mic-disconnect fallback).
    if let Some(receiver) = device_event_receiver {
        spawn_device_event_processor(app.clone(), receiver, session.clone());
    }

    // Flip recording live + reset per-session flags (speech-detected latch,
    // mic-recovery budget). Shared with the other start path — see helper.
    finalize_recording_start();
    {
        let mut current_meeting = CURRENT_MEETING.lock().unwrap();
        *current_meeting = Some(start_result.clone());
    }
    drop(engine_lifecycle_guard);

    // Start optimized parallel transcription task and store handle
    let queue_ledger = session
        .queue_ledger()
        .expect("successful recording start initializes the transcription queue ledger");
    let task_handle = transcription::start_transcription_task(
        app.clone(),
        transcription_receiver,
        database_pool.clone(),
        start_result.meeting_id.clone(),
        queue_ledger,
    );
    {
        let mut global_task = TRANSCRIPTION_TASK.lock().unwrap();
        *global_task = Some(task_handle);
    }

    // CRITICAL: Listen for transcript-update events and save to recording manager
    // This enables transcript history persistence for page reload sync
    // Store listener ID for cleanup during stop_recording to ensure microphone is released
    {
        use tauri::Listener;
        let listener_id = app.listen("transcript-update", move |event: tauri::Event| {
            // Parse the transcript update from the event payload
            if let Ok(update) = serde_json::from_str::<TranscriptUpdate>(event.payload()) {
                // Create structured transcript segment
                let segment = crate::audio::recording_saver::TranscriptSegment {
                    id: format!("seg_{}", update.sequence_id),
                    text: update.text.clone(),
                    audio_start_time: update.audio_start_time,
                    audio_end_time: update.audio_end_time,
                    duration: update.duration,
                    display_time: update.timestamp.clone(), // Use wall-clock timestamp for display
                    confidence: update.confidence,
                    sequence_id: update.sequence_id,
                };

                // Save to recording manager
                if let Ok(manager_guard) = RECORDING_MANAGER.lock() {
                    if let Some(manager) = manager_guard.as_ref() {
                        manager.add_transcript_segment(segment);
                    }
                }
            }
        });
        let mut global_listener = TRANSCRIPT_LISTENER_ID.lock().unwrap();
        *global_listener = Some(listener_id);
        info!("✅ Transcript-update event listener registered for history persistence");
    }

    // Emit success event
    app.emit("recording-started", &start_result)
        .map_err(|e| e.to_string())?;

    // Update tray menu to reflect recording state
    crate::tray::update_tray_menu(&app);

    info!("✅ Recording started with custom devices using async-first approach");

    Ok(start_result)
}

const DEFAULT_FINALIZATION_EXPERIMENT_DEADLINE_MS: u64 = 120_000;
const MAX_FINALIZATION_EXPERIMENT_DEADLINE_MS: u64 = 30 * 60 * 1_000;

fn configured_finalization_deadline_ms() -> u64 {
    match std::env::var("TELU_FINALIZATION_DEADLINE_MS") {
        Ok(value) => match value.parse::<u64>() {
            Ok(value) if (1..=MAX_FINALIZATION_EXPERIMENT_DEADLINE_MS).contains(&value) => value,
            _ => {
                warn!(
                    "Ignoring invalid TELU_FINALIZATION_DEADLINE_MS; using experiment default {}ms",
                    DEFAULT_FINALIZATION_EXPERIMENT_DEADLINE_MS
                );
                DEFAULT_FINALIZATION_EXPERIMENT_DEADLINE_MS
            }
        },
        Err(_) => DEFAULT_FINALIZATION_EXPERIMENT_DEADLINE_MS,
    }
}

fn remaining_until(deadline: Instant) -> Duration {
    deadline.saturating_duration_since(Instant::now())
}

fn emit_finalization_progress<R: Runtime>(
    app: &AppHandle<R>,
    meeting_id: &str,
    queue_ledger: &QueueLedger,
    deadline_at_utc: &str,
    deadline_ms: u64,
) {
    let _ = app.emit(
        "recording-finalization-progress",
        serde_json::json!({
            "meeting_id": meeting_id,
            "lifecycle": "finalizing",
            "queue": queue_ledger.snapshot(Instant::now()),
            "deadline_at_utc": deadline_at_utc,
            "deadline_ms": deadline_ms,
        }),
    );
}

async fn unload_transcription_model<R: Runtime>(app: AppHandle<R>) {
    let provider = crate::api::api::api_get_transcript_config(
        app.clone(),
        app.clone().state(),
        None,
    )
    .await
    .ok()
    .flatten()
    .map(|config| config.provider);

    if provider.as_deref() == Some("parakeet") {
        let engine = crate::parakeet_engine::commands::PARAKEET_ENGINE
            .lock()
            .unwrap()
            .as_ref()
            .cloned();
        if let Some(engine) = engine {
            if !engine.unload_model().await {
                warn!("Parakeet model did not unload during finalization");
            }
        }
    } else {
        let engine = crate::whisper_engine::commands::WHISPER_ENGINE
            .lock()
            .unwrap()
            .as_ref()
            .cloned();
        if let Some(engine) = engine {
            if !engine.unload_model().await {
                warn!("Whisper model did not unload during finalization");
            }
        }
    }
}

/// Stop one Rust-owned meeting through a finite close/drain/persist protocol.
pub async fn stop_recording<R: Runtime>(
    app: AppHandle<R>,
    _args: RecordingArgs,
) -> Result<FinalizationSnapshot, String> {
    let _stop_guard = STOP_SERIALIZER.lock().await;
    if !IS_RECORDING.load(Ordering::SeqCst) {
        return LAST_FINALIZATION
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| "No recording is currently active".to_string());
    }

    let _stopping_guard = StoppingGuard::new();
    let meeting = CURRENT_MEETING
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "Active recording has no canonical meeting identity".to_string())?;
    let database_pool = recording_database_pool(&app)?;
    let deadline_ms = configured_finalization_deadline_ms();
    let deadline_duration = Duration::from_millis(deadline_ms);
    let deadline = Instant::now() + deadline_duration;
    let deadline_at_utc = (Utc::now()
        + chrono::Duration::milliseconds(deadline_ms.min(i64::MAX as u64) as i64))
    .to_rfc3339();

    let mut manager = RECORDING_MANAGER
        .lock()
        .unwrap()
        .take()
        .ok_or_else(|| "Active recording has no recording manager".to_string())?;
    let queue_ledger = manager
        .get_state()
        .queue_ledger()
        .ok_or_else(|| "Active recording has no authoritative queue ledger".to_string())?;
    if queue_ledger.meeting_id() != meeting.meeting_id {
        return Err("Queue ledger meeting identity does not match active meeting".to_string());
    }

    let capture_closed = match tokio::time::timeout(
        remaining_until(deadline),
        manager.stop_streams_and_force_flush(),
    )
    .await
    {
        Ok(Ok(())) => true,
        Ok(Err(error)) => {
            error!("Failed to close recording producers: {error}");
            false
        }
        Err(_) => {
            warn!("Finalization deadline elapsed while closing recording producers");
            false
        }
    };

    {
        use tauri::Listener;
        if let Some(listener_id) = TRANSCRIPT_LISTENER_ID.lock().unwrap().take() {
            app.unlisten(listener_id);
        }
    }

    let finalizing_persisted = match MeetingsRepository::mark_finalizing(
        &database_pool,
        &meeting.meeting_id,
    )
    .await
    {
        Ok(()) => true,
        Err(error) => {
            error!("Failed to persist finalizing lifecycle: {error}");
            false
        }
    };
    emit_finalization_progress(
        &app,
        &meeting.meeting_id,
        &queue_ledger,
        &deadline_at_utc,
        deadline_ms,
    );

    let transcription_task = TRANSCRIPTION_TASK.lock().unwrap().take();
    let drain = if let Some(task_handle) = transcription_task {
        drain_transcription_to_deadline(
            task_handle,
            Arc::clone(&queue_ledger),
            remaining_until(deadline),
        )
        .await
    } else {
        let stranded = nonterminal_work_ids(&queue_ledger);
        if !stranded.is_empty() {
            queue_ledger.finish_all_nonterminal(
                WorkOutcome::Failed(WorkFailureReason::DispatchClosed),
                Instant::now(),
            );
        }
        FinalizationDrainReport {
            deadline_expired: false,
            worker_failed: !stranded.is_empty(),
            remaining_work_ids: Vec::new(),
        }
    };
    emit_finalization_progress(
        &app,
        &meeting.meeting_id,
        &queue_ledger,
        &deadline_at_utc,
        deadline_ms,
    );

    if tokio::time::timeout(
        remaining_until(deadline),
        unload_transcription_model(app.clone()),
    )
    .await
    .is_err()
    {
        warn!("Finalization deadline elapsed while unloading transcription model");
    }

    let meeting_folder = manager.get_meeting_folder();
    let meeting_name = manager.get_meeting_name();
    let durable_file_write = match tokio::time::timeout(
        remaining_until(deadline),
        manager.save_recording_only(&app),
    )
    .await
    {
        Ok(Ok(())) => true,
        Ok(Err(error)) => {
            error!("Recording mirror save failed: {error}");
            false
        }
        Err(_) => {
            warn!("Finalization deadline elapsed during recording mirror save");
            false
        }
    };

    let mut input = build_finalize_meeting_input(
        &meeting.meeting_id,
        &queue_ledger,
        deadline_at_utc,
        deadline_ms,
        capture_closed,
        durable_file_write,
        &drain,
    );
    if !finalizing_persisted {
        input
            .reason_codes
            .push("finalizing_persistence_failed".to_string());
        input.durable_writes_succeeded = false;
    }

    let finalization_result = MeetingsRepository::finalize_session(&database_pool, &input)
        .await
        .map_err(|error| format!("Failed to persist terminal finalization: {error}"));

    IS_RECORDING.store(false, Ordering::SeqCst);
    CURRENT_MEETING.lock().unwrap().take();
    let finalization = finalization_result?;
    if let Err(error) = manager.mirror_committed_finalization(&finalization) {
        warn!(
            "Terminal finalization committed but recording metadata mirror failed: {error}"
        );
    }
    *LAST_FINALIZATION.lock().unwrap() = Some(finalization.clone());

    let folder_path = meeting_folder.map(|path| path.to_string_lossy().to_string());
    if let Err(error) = app.emit(
        "recording-stopped",
        serde_json::json!({
            "message": "Recording finalization persisted by Rust",
            "folder_path": folder_path,
            "meeting_name": meeting_name,
            "finalization": finalization,
        }),
    ) {
        warn!("Terminal finalization persisted but renderer event delivery failed: {error}");
    }
    crate::tray::update_tray_menu(&app);

    Ok(finalization)
}

#[allow(dead_code)]
async fn legacy_stop_recording<R: Runtime>(
    app: AppHandle<R>,
    _args: RecordingArgs,
) -> Result<(), String> {
    info!(
        "🛑 Starting optimized recording shutdown - ensuring ALL transcript chunks are preserved"
    );

    // Check if recording is active
    if !IS_RECORDING.load(Ordering::SeqCst) {
        info!("Recording was not active");
        return Ok(());
    }

    // Emit shutdown progress to frontend
    let _ = app.emit(
        "recording-shutdown-progress",
        serde_json::json!({
            "stage": "stopping_audio",
            "message": "Stopping audio capture...",
            "progress": 20
        }),
    );

    // Step 1: Stop audio capture immediately (no more new chunks) with proper error handling
    let manager_for_cleanup = {
        let mut global_manager = RECORDING_MANAGER.lock().unwrap();
        global_manager.take()
    };

    // Mark the stop tail as in progress so a mic-disconnect fallback that was
    // queued before Stop short-circuits instead of retrying against the taken
    // manager. IS_RECORDING itself stays true until the tail completes — the
    // frontend polls it to keep the stop UI up. RAII so a panic in the tail
    // below can't leave the flag stuck true.
    let _stopping_guard = StoppingGuard::new();

    let stop_result = if let Some(mut manager) = manager_for_cleanup {
        // Use FORCE FLUSH to immediately process all accumulated audio - eliminates 30s delay!
        info!("🚀 Using FORCE FLUSH to eliminate pipeline accumulation delays");
        let result = manager.stop_streams_and_force_flush().await;
        // Store manager back for later cleanup
        let manager_for_cleanup = Some(manager);
        (result, manager_for_cleanup)
    } else {
        warn!("No recording manager found to stop");
        (Ok(()), None)
    };

    let (stop_result, manager_for_cleanup) = stop_result;

    match stop_result {
        Ok(_) => {
            info!("✅ Audio streams stopped successfully - no more chunks will be created");
        }
        Err(e) => {
            error!("❌ Failed to stop audio streams: {}", e);
            return Err(format!("Failed to stop audio streams: {}", e)); // _stopping_guard clears on return
        }
    }

    // Step 1.5: Clean up transcript listener to release microphone
    // Unlisten transcript-update event to prevent lingering references
    {
        use tauri::Listener;
        if let Some(listener_id) = TRANSCRIPT_LISTENER_ID.lock().unwrap().take() {
            app.unlisten(listener_id);
            info!("✅ Transcript-update listener removed");
        }
    }

    // Step 2: Signal transcription workers to finish processing ALL queued chunks
    let _ = app.emit(
        "recording-shutdown-progress",
        serde_json::json!({
            "stage": "processing_transcripts",
            "message": "Processing remaining transcript chunks...",
            "progress": 40
        }),
    );

    // Wait for transcription task with enhanced progress monitoring (NO TIMEOUT - we must process all chunks)
    let transcription_task = {
        let mut global_task = TRANSCRIPTION_TASK.lock().unwrap();
        global_task.take()
    };

    if let Some(task_handle) = transcription_task {
        info!("⏳ Waiting for ALL transcription chunks to be processed (no timeout - preserving every chunk)");

        // Enhanced progress monitoring during shutdown
        let progress_app = app.clone();
        let progress_task = tokio::spawn(async move {
            let last_update = std::time::Instant::now();

            loop {
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

                // Emit periodic progress updates during shutdown
                let elapsed = last_update.elapsed().as_secs();
                let _ = progress_app.emit(
                    "recording-shutdown-progress",
                    serde_json::json!({
                        "stage": "processing_transcripts",
                        "message": format!("Processing transcripts... ({}s elapsed)", elapsed),
                        "progress": 40,
                        "detailed": true,
                        "elapsed_seconds": elapsed
                    }),
                );
            }
        });

        // Wait up to 10 minutes for transcription completion to prevent indefinite hangs
        match tokio::time::timeout(
            tokio::time::Duration::from_secs(600), // 10 minutes max
            task_handle
        ).await {
            Ok(Ok(())) => {
                info!("✅ ALL transcription chunks processed successfully - no data lost");
            }
            Ok(Err(e)) => {
                warn!("⚠️ Transcription task completed with error: {:?}", e);
                // Continue anyway - the worker may have processed most chunks
            }
            Err(_) => {
                warn!("⏱️ Transcription timeout (10 minutes) reached, continuing shutdown to prevent indefinite hang");
                // Continue shutdown even on timeout - better to lose some chunks than hang forever
            }
        }

        // Stop progress monitoring
        progress_task.abort();
    } else {
        info!("ℹ️ No transcription task found to wait for");
    }

    // Step 3: Now safely unload Whisper model after ALL chunks are processed
    let _ = app.emit(
        "recording-shutdown-progress",
        serde_json::json!({
            "stage": "unloading_model",
            "message": "Unloading speech recognition model...",
            "progress": 70
        }),
    );

    info!("🧠 All transcript chunks processed. Now safely unloading transcription model...");

    // Determine which provider was used and unload the appropriate model (with timeout)
    let config = match tokio::time::timeout(
        tokio::time::Duration::from_secs(30), // 30 seconds max for DB operation
        crate::api::api::api_get_transcript_config(
            app.clone(),
            app.clone().state(),
            None,
        )
    )
    .await
    {
        Ok(Ok(Some(config))) => Some(config.provider),
        Ok(Ok(None)) => None,
        Ok(Err(e)) => {
            warn!("⚠️ Failed to get transcript config: {:?}", e);
            None
        }
        Err(_) => {
            warn!("⏱️ Transcript config timeout (30s), continuing shutdown");
            None
        }
    };

    match config.as_deref() {
        Some("parakeet") => {
            info!("🦜 Unloading Parakeet model...");
            let engine_clone = {
                let engine_guard = crate::parakeet_engine::commands::PARAKEET_ENGINE
                    .lock()
                    .unwrap();
                engine_guard.as_ref().cloned()
            };

            if let Some(engine) = engine_clone {
                let current_model = engine
                    .get_current_model()
                    .await
                    .unwrap_or_else(|| "unknown".to_string());
                info!("Current Parakeet model before unload: '{}'", current_model);

                if engine.unload_model().await {
                    info!("✅ Parakeet model '{}' unloaded successfully", current_model);
                } else {
                    warn!("⚠️ Failed to unload Parakeet model '{}'", current_model);
                }
            } else {
                warn!("⚠️ No Parakeet engine found to unload model");
            }
        }
        _ => {
            // Default to Whisper
            info!("🎤 Unloading Whisper model...");
            let engine_clone = {
                let engine_guard = crate::whisper_engine::commands::WHISPER_ENGINE
                    .lock()
                    .unwrap();
                engine_guard.as_ref().cloned()
            };

            if let Some(engine) = engine_clone {
                let current_model = engine
                    .get_current_model()
                    .await
                    .unwrap_or_else(|| "unknown".to_string());
                info!("Current Whisper model before unload: '{}'", current_model);

                if engine.unload_model().await {
                    info!("✅ Whisper model '{}' unloaded successfully", current_model);
                } else {
                    warn!("⚠️ Failed to unload Whisper model '{}'", current_model);
                }
            } else {
                warn!("⚠️ No Whisper engine found to unload model");
            }
        }
    }

    // Step 3.5: Track meeting ended analytics with privacy-safe metadata
    // Extract all data from manager BEFORE any async operations to avoid Send issues
    let analytics_data = if let Some(ref manager) = manager_for_cleanup {
        let state = manager.get_state();
        let stats = state.get_stats();

        Some((
            manager.get_recording_duration(),
            manager.get_active_recording_duration().unwrap_or(0.0),
            manager.get_total_pause_duration(),
            manager.get_transcript_segments().len() as u64,
            state.has_fatal_error(),
            state.get_microphone_device().map(|d| d.name.clone()),
            state.get_system_device().map(|d| d.name.clone()),
            stats.chunks_processed,
        ))
    } else {
        None
    };

    // Now perform async analytics tracking without holding manager reference
    if let Some((total_duration, active_duration, pause_duration, transcript_segments_count, had_fatal_error, mic_device_name, sys_device_name, chunks_processed)) = analytics_data {
        info!("📊 Collecting analytics for meeting end");

        // Helper function to classify device type from device name (privacy-safe)
        fn classify_device_type(device_name: &str) -> &'static str {
            let name_lower = device_name.to_lowercase();
            // Check for Bluetooth keywords
            if name_lower.contains("bluetooth")
                || name_lower.contains("airpods")
                || name_lower.contains("beats")
                || name_lower.contains("headphones")
                || name_lower.contains("bt ")
                || name_lower.contains("wireless") {
                "Bluetooth"
            } else {
                "Wired"
            }
        }

        // Get transcription model info (already loaded above for model unload)
        let transcription_config = match crate::api::api::api_get_transcript_config(
            app.clone(),
            app.clone().state(),
            None,
        )
        .await
        {
            Ok(Some(config)) => Some((config.provider, config.model)),
            _ => None,
        };

        let (transcription_provider, transcription_model) = transcription_config
            .unwrap_or_else(|| ("unknown".to_string(), "unknown".to_string()));

        // Get summary model info from API
        let summary_config = match crate::api::api::api_get_model_config(
            app.clone(),
            app.clone().state(),
            None,
        )
        .await
        {
            Ok(Some(config)) => Some((config.provider, config.model)),
            _ => None,
        };

        let (summary_provider, summary_model) = summary_config
            .unwrap_or_else(|| ("unknown".to_string(), "unknown".to_string()));

        // Classify device types (privacy-safe)
        let microphone_device_type = mic_device_name
            .as_ref()
            .map(|name| classify_device_type(name))
            .unwrap_or("Unknown");

        let system_audio_device_type = sys_device_name
            .as_ref()
            .map(|name| classify_device_type(name))
            .unwrap_or("Unknown");

        // Track meeting ended event with privacy-safe data
        match crate::analytics::commands::track_meeting_ended(
            transcription_provider.clone(),
            transcription_model.clone(),
            summary_provider.clone(),
            summary_model.clone(),
            total_duration,
            active_duration,
            pause_duration,
            microphone_device_type.to_string(),
            system_audio_device_type.to_string(),
            chunks_processed,
            transcript_segments_count,
            had_fatal_error,
        )
        .await
        {
            Ok(_) => info!("✅ Analytics tracked successfully for meeting end"),
            Err(e) => warn!("⚠️ Failed to track analytics: {}", e),
        }
    }

    // Step 4: Finalize recording state and cleanup resources safely
    let _ = app.emit(
        "recording-shutdown-progress",
        serde_json::json!({
            "stage": "finalizing",
            "message": "Finalizing recording and cleaning up resources...",
            "progress": 90
        }),
    );

    // Perform final cleanup with the manager if available
    let (meeting_folder, meeting_name) = if let Some(mut manager) = manager_for_cleanup {
        info!("🧹 Performing final cleanup and saving recording data");

        // Extract meeting info BEFORE async operations
        let meeting_folder = manager.get_meeting_folder();
        let meeting_name = manager.get_meeting_name();

        match tokio::time::timeout(
            tokio::time::Duration::from_secs(300), // 5 minutes max for file I/O
            manager.save_recording_only(&app)
        ).await {
            Ok(Ok(_)) => {
                info!("✅ Recording data saved successfully during cleanup");
            }
            Ok(Err(e)) => {
                warn!(
                    "⚠️ Error during recording cleanup (transcripts preserved): {}",
                    e
                );
                // Don't fail shutdown - transcripts are already preserved
            }
            Err(_) => {
                warn!("⏱️ File I/O timeout (5 minutes) reached during save, continuing shutdown");
                // Don't fail shutdown - transcripts are already preserved
            }
        }

        (meeting_folder, meeting_name)
    } else {
        info!("ℹ️ No recording manager available for cleanup");
        (None, None)
    };

    // Set recording flag to false
    info!("🔍 Setting IS_RECORDING to false");
    IS_RECORDING.store(false, Ordering::SeqCst);
    CURRENT_MEETING.lock().unwrap().take();
    // IS_RECORDING_STOPPING is cleared by _stopping_guard on scope exit.

    // Step 4.5: Prepare metadata for frontend (NO database save)
    // NOTE: We do NOT save to database here. The frontend will save after all transcripts are displayed.
    // This ensures the user sees all transcripts streaming in before the database save happens.
    let (folder_path_str, meeting_name_str) = match (&meeting_folder, &meeting_name) {
        (Some(path), Some(name)) => (
            Some(path.to_string_lossy().to_string()),
            Some(name.clone()),
        ),
        _ => (None, None),
    };

    info!("📤 Preparing recording metadata for frontend save");
    info!("   folder_path: {:?}", folder_path_str);
    info!("   meeting_name: {:?}", meeting_name_str);

    // Database save removed - frontend will handle this after receiving all transcripts
    info!("ℹ️ Skipping database save in Rust - frontend will save after all transcripts received");

    // Step 5: Complete shutdown
    let _ = app.emit(
        "recording-shutdown-progress",
        serde_json::json!({
            "stage": "complete",
            "message": "Recording stopped successfully",
            "progress": 100
        }),
    );

    // Emit final stop event with folder_path and meeting_name for frontend to save
    app.emit(
        "recording-stopped",
        serde_json::json!({
            "message": "Recording stopped - frontend will save after all transcripts received",
            "folder_path": folder_path_str,
            "meeting_name": meeting_name_str
        }),
    )
    .map_err(|e| e.to_string())?;

    // Update tray menu to reflect stopped state
    crate::tray::update_tray_menu(&app);

    info!("🎉 Recording stopped successfully with ZERO transcript chunks lost");
    Ok(())
}

/// Check if recording is active
pub async fn is_recording() -> bool {
    IS_RECORDING.load(Ordering::SeqCst)
}

/// Return the last authoritative terminal lifecycle instead of inferring
/// completion from renderer-visible queue quietness.
pub async fn get_transcription_status() -> Option<FinalizationSnapshot> {
    LAST_FINALIZATION.lock().unwrap().clone()
}

/// Pause the current recording
#[tauri::command]
pub async fn pause_recording<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    info!("Pausing recording");

    // Check if currently recording
    if !IS_RECORDING.load(Ordering::SeqCst) {
        return Err("No recording is currently active".to_string());
    }

    // Access the recording manager and pause it
    let manager_guard = RECORDING_MANAGER.lock().unwrap();
    if let Some(manager) = manager_guard.as_ref() {
        manager.pause_recording().map_err(|e| e.to_string())?;

        // Emit pause event to frontend
        app.emit(
            "recording-paused",
            serde_json::json!({
                "message": "Recording paused"
            }),
        )
        .map_err(|e| e.to_string())?;

        // Update tray menu to reflect paused state
        crate::tray::update_tray_menu(&app);

        info!("Recording paused successfully");
        Ok(())
    } else {
        Err("No recording manager found".to_string())
    }
}

/// Resume the current recording
#[tauri::command]
pub async fn resume_recording<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    info!("Resuming recording");

    // Check if currently recording
    if !IS_RECORDING.load(Ordering::SeqCst) {
        return Err("No recording is currently active".to_string());
    }

    // Access the recording manager and resume it
    let manager_guard = RECORDING_MANAGER.lock().unwrap();
    if let Some(manager) = manager_guard.as_ref() {
        manager.resume_recording().map_err(|e| e.to_string())?;

        // Emit resume event to frontend
        app.emit(
            "recording-resumed",
            serde_json::json!({
                "message": "Recording resumed"
            }),
        )
        .map_err(|e| e.to_string())?;

        // Update tray menu to reflect resumed state
        crate::tray::update_tray_menu(&app);

        info!("Recording resumed successfully");
        Ok(())
    } else {
        Err("No recording manager found".to_string())
    }
}

/// Check if recording is currently paused
#[tauri::command]
pub async fn is_recording_paused() -> bool {
    let manager_guard = RECORDING_MANAGER.lock().unwrap();
    if let Some(manager) = manager_guard.as_ref() {
        manager.is_paused()
    } else {
        false
    }
}

/// Get detailed recording state
#[tauri::command]
pub async fn get_recording_state() -> serde_json::Value {
    let is_recording = IS_RECORDING.load(Ordering::SeqCst);
    let manager_guard = RECORDING_MANAGER.lock().unwrap();
    let current_meeting = CURRENT_MEETING.lock().unwrap().clone();

    if let Some(manager) = manager_guard.as_ref() {
        serde_json::json!({
            "is_recording": is_recording,
            "is_paused": manager.is_paused(),
            "is_active": manager.is_active(),
            "recording_duration": manager.get_recording_duration(),
            "active_duration": manager.get_active_recording_duration(),
            "meeting_id": current_meeting.as_ref().map(|meeting| meeting.meeting_id.clone()),
            "meeting_lifecycle": current_meeting.as_ref().map(|meeting| meeting.lifecycle),
            "meeting_title": current_meeting.as_ref().map(|meeting| meeting.title.clone()),
            "meeting_started_at_utc": current_meeting.as_ref().map(|meeting| meeting.started_at_utc.clone()),
            "total_pause_duration": manager.get_total_pause_duration(),
            "current_pause_duration": manager.get_current_pause_duration()
        })
    } else {
        serde_json::json!({
            "is_recording": is_recording,
            "is_paused": false,
            "is_active": false,
            "recording_duration": null,
            "active_duration": null,
            "meeting_id": current_meeting.as_ref().map(|meeting| meeting.meeting_id.clone()),
            "meeting_lifecycle": current_meeting.as_ref().map(|meeting| meeting.lifecycle),
            "meeting_title": current_meeting.as_ref().map(|meeting| meeting.title.clone()),
            "meeting_started_at_utc": current_meeting.as_ref().map(|meeting| meeting.started_at_utc.clone()),
            "total_pause_duration": 0.0,
            "current_pause_duration": null
        })
    }
}

/// Get the meeting folder path for the current recording
/// Returns the path if a meeting name was set and folder structure initialized
#[tauri::command]
pub async fn get_meeting_folder_path() -> Result<Option<String>, String> {
    let manager_guard = RECORDING_MANAGER.lock().unwrap();
    if let Some(manager) = manager_guard.as_ref() {
        Ok(manager.get_meeting_folder().map(|p| p.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

/// Get accumulated transcript segments from current recording session
/// Used for syncing frontend state after page reload during active recording
#[tauri::command]
pub async fn get_transcript_history() -> Result<Vec<crate::audio::recording_saver::TranscriptSegment>, String> {
    let manager_guard = RECORDING_MANAGER.lock().unwrap();

    if let Some(manager) = manager_guard.as_ref() {
        Ok(manager.get_transcript_segments())
    } else {
        Ok(Vec::new()) // No recording active, return empty
    }
}

/// Get meeting name from current recording session
/// Used for syncing frontend state after page reload during active recording
#[tauri::command]
pub async fn get_recording_meeting_name() -> Result<Option<String>, String> {
    let manager_guard = RECORDING_MANAGER.lock().unwrap();

    if let Some(manager) = manager_guard.as_ref() {
        Ok(manager.get_meeting_name())
    } else {
        Ok(None)
    }
}

// ============================================================================
// DEVICE MONITORING COMMANDS (AirPods/Bluetooth disconnect/reconnect support)
// ============================================================================

/// Get information about the active audio output device
/// Used to warn users about Bluetooth playback issues
#[tauri::command]
pub async fn get_active_audio_output() -> Result<super::playback_monitor::AudioOutputInfo, String> {
    super::playback_monitor::get_active_audio_output()
        .await
        .map_err(|e| format!("Failed to get audio output info: {}", e))
}


// ============================================================================
// MIC HOT-SWAP (disconnect recovery)
// ============================================================================

// Guard against concurrent mic hot-swap tasks. Only used by the disconnect
// fallback path (trigger_mic_fallback_to_default) — the "chase the new
// default" auto-swap has been removed.
static MIC_SWAP_IN_PROGRESS: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

// Bounded retry budget for the disconnect fallback (P1 #2). Counts COMPLETED
// failed attempts; MIC_SWAP_IN_PROGRESS still prevents overlapping swaps.
static MIC_FALLBACK_FAILED_ATTEMPTS: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
const MAX_MIC_FALLBACK_ATTEMPTS: u32 = 3;

/// Perform mic hot-swap using phased locking — never holds RECORDING_MANAGER during I/O
/// except the brief mic-stream stop in Phase 1.
/// If CPAL hangs during stream creation, only this task blocks; stop flow stays unblocked.
async fn perform_mic_hot_swap_task<R: Runtime>(
    new_device_name: String,
    session: &Arc<super::RecordingState>,
    app: AppHandle<R>,
) -> Result<(), String> {
    info!("[HOT_SWAP] Starting mic hot-swap to '{}'", new_device_name);

    match do_mic_swap(&new_device_name, session).await {
        Ok(()) => {
            info!("[HOT_SWAP] Mic switched to '{}'", new_device_name);
            let _ = app.emit("mic-device-switched", serde_json::json!({
                "device_name": new_device_name
            }));
            Ok(())
        }
        Err(e) => {
            if !session_live(session) {
                return Err(e);
            }
            warn!("[HOT_SWAP] First attempt failed: {} — retrying in 500ms", e);
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

            match do_mic_swap(&new_device_name, session).await {
                Ok(()) => {
                    info!("[HOT_SWAP] Mic switched to '{}' on retry", new_device_name);
                    let _ = app.emit("mic-device-switched", serde_json::json!({
                        "device_name": new_device_name
                    }));
                    Ok(())
                }
                Err(e) => {
                    error!("[HOT_SWAP] Mic swap failed after retry: {}", e);
                    if session_live(session) {
                        let _ = app.emit("mic-swap-failed", serde_json::json!({
                            "error": e,
                            "device_name": new_device_name
                        }));
                    }
                    Err(e)
                }
            }
        }
    }
}

/// Phased mic swap — lock is never held during async I/O.
async fn do_mic_swap(device_name: &str, session: &Arc<super::RecordingState>) -> Result<(), String> {
    // Phase 1: Lock briefly — verify identity, take old stream OUT (no teardown under lock)
    let old_mic = {
        let mut guard = RECORDING_MANAGER.lock().unwrap();
        let manager = guard.as_mut().ok_or_else(|| "Recording manager not available".to_string())?;
        if !manager.is_recording() {
            return Err("Recording stopped — aborting mic hot-swap".to_string());
        }
        if !Arc::ptr_eq(manager.get_state(), session) {
            return Err("Session changed before hot-swap — aborting".to_string());
        }
        manager.take_mic_stream_for_swap()
    }; // lock released

    // Tear down the dead mic OUTSIDE the lock — cpal stop()/drop on a
    // disconnected BT device can stall on the CoreAudio HAL lock; doing it
    // under RECORDING_MANAGER would freeze stop_recording (deep-review #2).
    // Non-fatal: the replacement stream is created next regardless, so a
    // teardown error/stall on the already-dead device must not abort the swap.
    if let Some(s) = old_mic {
        if let Err(e) = s.stop() {
            warn!("[HOT_SWAP] Failed to stop old mic stream (proceeding): {}", e);
        }
    }

    // Phase 2: Async I/O WITHOUT lock — may be slow, that's OK
    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;

    // Build the AudioDevice directly from the name — the caller
    // (trigger_mic_fallback_to_default) already resolved it via
    // default_input_device(). Skipping list_audio_devices() here avoids a
    // full cpal enumeration on the exact BT-transition hot path where it's
    // known to hang 100+ s (see H2 in PR-175 review). The real device
    // validation happens inside AudioStream::create → get_device_and_config
    // which does a targeted host.input_devices() lookup by name.
    let device_arc = std::sync::Arc::new(super::AudioDevice::new(
        device_name.to_string(),
        super::DeviceType::Input,
    ));

    info!("[HOT_SWAP] Creating new mic stream for '{}' (lock released)", device_name);
    let new_stream = super::stream::AudioStream::create(
        device_arc.clone(),
        session.clone(),
        super::recording_state::DeviceType::Microphone,
        None,
    ).await.map_err(|e| format!("Failed to create mic stream: {}", e))?;

    // Resolve the current default output OUTSIDE the lock — a CoreAudio stall here
    // must not block stop_recording (which needs RECORDING_MANAGER). (P1 #1)
    let system_name = default_output_device().ok().map(|d| d.name);

    // Phase 3: Lock briefly — install ONLY if still the same session
    {
        let mut guard = RECORDING_MANAGER.lock().unwrap();
        match guard.as_mut() {
            Some(manager) if Arc::ptr_eq(manager.get_state(), session) => {
                manager.set_mic_stream_after_swap(new_stream, device_arc, system_name);
                info!("[HOT_SWAP] Mic hot-swap to '{}' completed", device_name);
            }
            Some(_) => {
                return Err("Session changed during hot-swap — discarding stale mic stream".to_string());
            }
            None => {
                return Err("Recording manager gone during hot-swap".to_string());
            }
        }
    } // lock released

    Ok(())
}

/// Background processor for device monitor events during a recording session.
///
/// The ONLY mid-recording mic switch that is allowed is the fallback from a
/// dead device to the system default, triggered by the device monitor's
/// DeviceDisconnected event. Any other device event is explicitly ignored —
/// recording stays on whatever device was picked at start time until the
/// meeting ends.
///
/// Rationale: auto-swapping to a freshly-connected BT device during recording
/// triggers a reliable hang inside cpal's stream creation on macOS. Locking
/// the device at start eliminates that hang and also makes the recording
/// session predictable.
///
/// The task stops automatically when the receiver is dropped (recording
/// ends / monitor stops).
fn spawn_device_event_processor<R: Runtime>(
    app: AppHandle<R>,
    mut receiver: tokio::sync::mpsc::UnboundedReceiver<DeviceEvent>,
    session: Arc<super::RecordingState>,
) {
    tokio::spawn(async move {
        info!("[DEVICE_EVENTS] Background event processor started");

        while let Some(event) = receiver.recv().await {
            // Skip if recording has stopped
            if !recording_live() {
                info!("[DEVICE_EVENTS] Recording stopped — ignoring event: {:?}", event);
                continue;
            }

            match event {
                DeviceEvent::DeviceDisconnected { ref device_name, ref device_type } => {
                    info!("[DEVICE_EVENTS] Device disconnected: '{}' ({:?})", device_name, device_type);
                    // The only automatic mid-recording mic change allowed:
                    // when the active microphone dies, fall back to the
                    // system default input. Triggered after the device
                    // monitor's polling threshold fires.
                    if matches!(device_type, DeviceMonitorType::Microphone) {
                        let name = device_name.clone();
                        let app_clone = app.clone();
                        let session = session.clone();
                        tokio::spawn(async move {
                            trigger_mic_fallback_to_default(app_clone, name, session).await;
                        });
                    }
                }
                DeviceEvent::DeviceReconnected { ref device_name, ref device_type } => {
                    // Per product decision: once we have fallen back to the
                    // built-in mic we stay there for the rest of the meeting.
                    // This is intentional — just log and do nothing.
                    info!("[DEVICE_EVENTS] Device reconnected: '{}' ({:?}) — staying on current mic (fallback is sticky)", device_name, device_type);
                }
                DeviceEvent::DeviceListChanged => {
                    debug!("[DEVICE_EVENTS] Device list changed");
                }
            }
        }
        info!("[DEVICE_EVENTS] Background event processor stopped (channel closed)");
    });
}

/// Disconnect fallback: swap the active mic to the system default input
/// device. Triggered from the background device event processor after the
/// device monitor's polling threshold (3 × 2s) fires `DeviceDisconnected`
/// for the active microphone.
///
/// `disconnected_name` is the device that just died. We keep it to detect
/// the edge case where macOS hasn't yet updated the system default input
/// away from the dead device — we wait and retry in that case rather than
/// swapping back to the same broken device.
///
/// This function takes the MIC_SWAP_IN_PROGRESS guard itself; the caller
/// must NOT already hold it. If a swap is somehow already running this
/// returns immediately.
async fn trigger_mic_fallback_to_default<R: Runtime>(
    app: AppHandle<R>,
    disconnected_name: String,
    session: Arc<super::RecordingState>,
) {
    if !session_live(&session) {
        info!(
            "[MIC_FALLBACK] Not recording — skipping fallback for '{}'",
            disconnected_name
        );
        return;
    }

    if MIC_FALLBACK_FAILED_ATTEMPTS.load(Ordering::SeqCst) >= MAX_MIC_FALLBACK_ATTEMPTS {
        warn!(
            "[MIC_FALLBACK] {} failed attempts reached — giving up on '{}' (terminal event already announced)",
            MAX_MIC_FALLBACK_ATTEMPTS, disconnected_name
        );
        return;
    }

    if MIC_SWAP_IN_PROGRESS
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        info!(
            "[MIC_FALLBACK] Swap already in progress — skipping fallback for '{}'",
            disconnected_name
        );
        return;
    }

    // Guard that clears MIC_SWAP_IN_PROGRESS on any return path below so a
    // panic or early return can't leave the flag stuck.
    struct SwapGuard;
    impl Drop for SwapGuard {
        fn drop(&mut self) {
            MIC_SWAP_IN_PROGRESS.store(false, Ordering::SeqCst);
        }
    }
    let _guard = SwapGuard;

    info!(
        "[MIC_FALLBACK] Starting fallback from disconnected device '{}'",
        disconnected_name
    );

    // Let macOS finish swapping the system default input away from the dead
    // device. 150ms is enough in practice for the built-in mic to become the
    // default when an explicitly-selected BT device disconnects.
    tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;

    // A Stop-A/Start-B during the sleep swapped our session out. Bail silently —
    // emitting or spending the recovery budget here would fire against B with
    // A's device. Covers the default_input_device() error branch below.
    if !session_live(&session) {
        info!("[MIC_FALLBACK] Session no longer live after wait — aborting fallback for '{}'", disconnected_name);
        return;
    }

    // Query the current system default input. If it still reports the
    // disconnected device, back off once more and re-query — this handles
    // the edge case where the OS hasn't propagated the change yet.
    let fallback_name = match default_input_device() {
        Ok(dev) => dev.name,
        Err(e) => {
            error!("[MIC_FALLBACK] Failed to query default input device: {}", e);
            let _ = app.emit(
                "mic-swap-failed",
                serde_json::json!({
                    "error": format!("Failed to query default input: {}", e),
                    "device_name": disconnected_name,
                }),
            );
            let n = MIC_FALLBACK_FAILED_ATTEMPTS.fetch_add(1, Ordering::SeqCst) + 1;
            if n == MAX_MIC_FALLBACK_ATTEMPTS {
                let _ = app.emit(
                    "mic-recovery-exhausted",
                    serde_json::json!({ "device_name": disconnected_name }),
                );
            }
            return;
        }
    };

    let fallback_name = if fallback_name == disconnected_name {
        warn!(
            "[MIC_FALLBACK] Default input still reports disconnected device '{}' — retrying after 300ms",
            disconnected_name
        );
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
        if !session_live(&session) {
            info!("[MIC_FALLBACK] Session no longer live after retry wait — aborting fallback for '{}'", disconnected_name);
            return;
        }
        match default_input_device() {
            Ok(dev) if dev.name != disconnected_name => dev.name,
            Ok(dev) => {
                error!(
                    "[MIC_FALLBACK] Default input still '{}' after retry — aborting fallback",
                    dev.name
                );
                let _ = app.emit(
                    "mic-swap-failed",
                    serde_json::json!({
                        "error": "System default input still reports disconnected device after retry",
                        "device_name": disconnected_name,
                    }),
                );
                let n = MIC_FALLBACK_FAILED_ATTEMPTS.fetch_add(1, Ordering::SeqCst) + 1;
                if n == MAX_MIC_FALLBACK_ATTEMPTS {
                    let _ = app.emit(
                        "mic-recovery-exhausted",
                        serde_json::json!({ "device_name": disconnected_name }),
                    );
                }
                return;
            }
            Err(e) => {
                error!("[MIC_FALLBACK] Failed to re-query default input device: {}", e);
                let _ = app.emit(
                    "mic-swap-failed",
                    serde_json::json!({
                        "error": format!("Failed to re-query default input: {}", e),
                        "device_name": disconnected_name,
                    }),
                );
                let n = MIC_FALLBACK_FAILED_ATTEMPTS.fetch_add(1, Ordering::SeqCst) + 1;
                if n == MAX_MIC_FALLBACK_ATTEMPTS {
                    let _ = app.emit(
                        "mic-recovery-exhausted",
                        serde_json::json!({ "device_name": disconnected_name }),
                    );
                }
                return;
            }
        }
    } else {
        fallback_name
    };

    info!(
        "[MIC_FALLBACK] Falling back '{}' → '{}'",
        disconnected_name, fallback_name
    );

    // macOS Core Audio pre-wake for the hot-swap path — before we call the
    // rebuild path (which internally calls `AudioDeviceStart` on the new
    // mic), play 150ms of digital silence through the current system
    // output device to force the Core Audio hardware unit out of its idle
    // power state. Without this, `AudioDeviceStart` can return `noErr` but
    // the IO proc will not fire for 10-30 seconds until some other audio
    // nudges the hardware awake — the "backend idle until you play YouTube"
    // symptom from earlier testing.
    //
    // `wake_audio_connection_for_swap` has a built-in fallback: if the
    // current system device name doesn't enumerate (e.g. the BT output just
    // disappeared), it plays through `default_output_device()` instead,
    // which on macOS will now be the built-in speakers — exactly the
    // hardware unit we want to wake for the fallback mic.
    //
    // Non-fatal: on error we log and proceed to the swap anyway. A failed
    // wake is strictly better than no wake.
    #[cfg(target_os = "macos")]
    {
        // Read from the captured session directly (no manager lock) — this
        // stays correct even if the global manager has since been swapped by
        // a Stop/Start of a different session.
        let sys_device_name = session.get_system_device().map(|d| d.name.clone());
        if let Some(name) = sys_device_name {
            match super::recording_manager::wake_audio_connection_for_swap(&name).await {
                Ok(()) => info!("[MIC_FALLBACK] Pre-swap audio wake completed"),
                Err(e) => warn!(
                    "[MIC_FALLBACK] Pre-swap audio wake failed: {} — proceeding anyway",
                    e
                ),
            }
        } else {
            log::debug!("[MIC_FALLBACK] No system device recorded — skipping pre-swap wake");
        }
    }

    // Stop may have started during the sleeps above — bail before touching
    // the (possibly already taken) manager.
    if !session_live(&session) {
        info!("[MIC_FALLBACK] Recording stopping — aborting fallback for '{}'", disconnected_name);
        return;
    }

    // perform_mic_hot_swap_task performs its own retry-once logic on failure
    // and emits the mic-device-switched / mic-swap-failed events, so we can
    // just delegate here. It does NOT touch MIC_SWAP_IN_PROGRESS internally.
    match perform_mic_hot_swap_task(fallback_name.clone(), &session, app.clone()).await {
        Ok(()) => {
            info!(
                "[MIC_FALLBACK] Fallback complete: now recording via '{}'",
                fallback_name
            );
            MIC_FALLBACK_FAILED_ATTEMPTS.store(0, Ordering::SeqCst);
        }
        Err(e) => {
            error!("[MIC_FALLBACK] Fallback swap failed: {}", e);
            if !session_live(&session) {
                return;
            }
            let n = MIC_FALLBACK_FAILED_ATTEMPTS.fetch_add(1, Ordering::SeqCst) + 1;
            if n == MAX_MIC_FALLBACK_ATTEMPTS {
                let _ = app.emit(
                    "mic-recovery-exhausted",
                    serde_json::json!({ "device_name": disconnected_name }),
                );
            }
        }
    }
}

#[cfg(test)]
mod meeting_identity_contract_tests {
    use super::{persist_session_before_capture, StartMeetingFailure};
    use sqlx::SqlitePool;
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    };

    #[test]
    fn meeting_identity_is_persisted_before_capture_start() {
        let source = include_str!("recording_commands.rs");
        let persistence = source
            .find(concat!("persist_session_", "before_capture"))
            .expect("start path must persist a meeting session");
        let capture = source
            .find(concat!(".start_", "recording("))
            .expect("start path must invoke native capture");

        assert!(
            persistence < capture,
            "meeting identity persistence must precede native capture startup"
        );
    }

    #[test]
    fn meeting_identity_frontend_consumes_rust_payload_without_fallback() {
        let service = include_str!("../../../src/services/recordingService.ts");
        let context = include_str!("../../../src/contexts/TranscriptContext.tsx");

        assert!(
            service.contains(concat!("interface Start", "MeetingResult")),
            "recording service must expose the typed Rust start payload"
        );
        assert!(
            context.contains(concat!("payload.meeting_", "id")),
            "TranscriptContext must set its identity from the Rust payload"
        );
        assert!(
            !context.contains(concat!("meeting-${Date.", "now()}")),
            "TranscriptContext must not mint a timestamp meeting identity"
        );
    }

    #[tokio::test]
    async fn meeting_identity_start_failure_persistence_failure_blocks_capture() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        let capture_started = Arc::new(AtomicBool::new(false));
        let capture_probe = Arc::clone(&capture_started);

        let result = persist_session_before_capture(
            &pool,
            "Failure injection".to_string(),
            move |_| async move {
                capture_probe.store(true, Ordering::SeqCst);
                Ok(())
            },
        )
        .await;

        assert!(matches!(
            result,
            Err(StartMeetingFailure::IdentityPersistence(_))
        ));
        assert!(!capture_started.load(Ordering::SeqCst));
    }

    #[test]
    fn meeting_identity_event_and_command_return_share_the_same_result() {
        let source = include_str!("recording_commands.rs");
        assert!(source.contains(concat!(
            "app.emit(\"recording-started\", &start_",
            "result)"
        )));
        assert!(source.contains(concat!("Ok(start_", "result)")));
    }

    #[test]
    fn meeting_identity_start_failure_exposes_a_typed_persistence_code() {
        let service = include_str!("../../../src/services/recordingService.ts");

        assert!(
            service.contains(concat!("export class Recording", "StartError")),
            "the renderer must receive a typed recording-start error"
        );
        assert!(
            service.contains("MEETING_IDENTITY_PERSISTENCE_FAILED"),
            "identity persistence failures need a stable machine-readable code"
        );
    }

    #[test]
    fn meeting_identity_start_failure_rejects_conflicting_projection_visibly() {
        let context = include_str!("../../../src/contexts/TranscriptContext.tsx");

        assert!(
            context.contains("MEETING_IDENTITY_CONFLICT"),
            "a stale or conflicting renderer identity must be explicitly classified"
        );
        assert!(
            context.contains("toast.error"),
            "identity conflicts must be visible to the user"
        );
        assert!(
            context.contains("currentMeetingIdRef"),
            "event redelivery must compare against a stable identity projection"
        );
    }

    #[test]
    fn meeting_identity_start_failure_redelivery_preserves_existing_metadata() {
        let context = include_str!("../../../src/contexts/TranscriptContext.tsx");

        assert!(
            context.contains("existingMetadata"),
            "redelivery must load existing metadata instead of replacing it"
        );
        assert!(
            context.contains("transcriptCount: existingMetadata.transcriptCount"),
            "redelivery must preserve transcript progress for the canonical meeting"
        );
    }
}

#[cfg(test)]
mod ui_acknowledgement_contract_tests {
    use super::{
        validate_phase1_stage_name, DeliveryAckError, DeliveryToken, DeliveryTracker,
        DELIVERY_TOKEN_TTL, RESERVED_FUTURE_STAGES, UI_ACKNOWLEDGED_STAGE,
    };
    use chrono::{Duration as ChronoDuration, Utc};
    use std::time::{Duration, Instant};

    #[test]
    fn ui_acknowledgement_registers_one_correlated_delivery() {
        let tracker = DeliveryTracker::new();
        let emitted_at = Instant::now();
        let emitted_at_utc = Utc::now();
        let token = tracker
            .register_at("meeting-1", "evidence-1", emitted_at, emitted_at_utc)
            .unwrap();
        let acknowledgement = tracker
            .acknowledge_at(
                &token,
                "meeting-1",
                "evidence-1",
                emitted_at + Duration::from_millis(7),
                emitted_at_utc + ChronoDuration::milliseconds(7),
            )
            .unwrap();
        let worker = include_str!("transcription/worker.rs");

        assert_eq!(acknowledgement.stage, UI_ACKNOWLEDGED_STAGE);
        assert_eq!(acknowledgement.delivery_token, token.0);
        assert_eq!(acknowledgement.meeting_id, "meeting-1");
        assert_eq!(acknowledgement.evidence_id, "evidence-1");
        assert_eq!(acknowledgement.duration_micros, 7_000);
        assert!(worker.contains("emit_canonical_transcript"));
        assert!(worker.contains(concat!("delivery_", "token")));
    }

    #[test]
    fn ui_acknowledgement_rejects_unknown_duplicate_and_future_stage_names() {
        let tracker = DeliveryTracker::new();
        let now = Instant::now();
        let now_utc = Utc::now();
        let unknown = DeliveryToken("unknown".to_string());
        assert_eq!(
            tracker.acknowledge_at(&unknown, "meeting-1", "evidence-1", now, now_utc),
            Err(DeliveryAckError::UnknownToken),
        );

        let token = tracker.register_at("meeting-1", "evidence-1", now, now_utc).unwrap();
        assert_eq!(
            tracker.acknowledge_at(&token, "other-meeting", "evidence-1", now, now_utc),
            Err(DeliveryAckError::IdentityMismatch),
        );
        assert!(tracker.acknowledge_at(&token, "meeting-1", "evidence-1", now, now_utc).is_ok());
        assert_eq!(
            tracker.acknowledge_at(&token, "meeting-1", "evidence-1", now, now_utc),
            Err(DeliveryAckError::UnknownToken),
        );

        let stale = tracker
            .register_at(
                "meeting-1",
                "evidence-2",
                now - DELIVERY_TOKEN_TTL - Duration::from_millis(1),
                now_utc,
            )
            .unwrap();
        assert_eq!(
            tracker.acknowledge_at(&stale, "meeting-1", "evidence-2", now, now_utc),
            Err(DeliveryAckError::StaleToken),
        );

        for stage in RESERVED_FUTURE_STAGES {
            assert_eq!(
                validate_phase1_stage_name(stage),
                Err(DeliveryAckError::ReservedFutureStage),
            );
        }
    }

    #[test]
    fn ui_acknowledgement_occurs_after_react_commits_final_state() {
        let context = include_str!("../../../src/contexts/TranscriptContext.tsx");
        let service = include_str!("../../../src/services/transcriptService.ts");

        assert!(
            context.contains("pendingAcknowledgementsRef")
                && context.contains("useLayoutEffect")
                && context.contains("requestAnimationFrame")
                && service.contains("acknowledgeTranscriptVisible"),
            "React must acknowledge the final delivery only from a post-commit animation-frame callback"
        );
    }
}

#[cfg(test)]
mod finalization_stop_contract_tests {
    use super::{
        build_finalize_meeting_input, drain_transcription_to_deadline,
        FinalizationDrainReport,
    };
    use crate::audio::transcription::queue_ledger::{
        QueueLedger, WorkFailureReason, WorkOutcome,
    };
    use std::sync::Arc;
    use std::time::{Duration, Instant};

    async fn drain_with(
        ledger: Arc<QueueLedger>,
        worker: tokio::task::JoinHandle<()>,
        deadline: Duration,
    ) -> FinalizationDrainReport {
        drain_transcription_to_deadline(worker, ledger, deadline).await
    }

    #[tokio::test]
    async fn finalization_empty_queue_returns_bounded_authoritative_snapshot() {
        let ledger = Arc::new(QueueLedger::new("meeting-empty", 2).unwrap());
        let report = drain_with(
            Arc::clone(&ledger),
            tokio::spawn(async {}),
            Duration::from_millis(50),
        )
        .await;
        let input = build_finalize_meeting_input(
            ledger.meeting_id(),
            &ledger,
            "2026-09-20T00:00:00Z".to_string(),
            50,
            true,
            true,
            &report,
        );

        assert!(!report.deadline_expired);
        assert!(!report.worker_failed);
        assert!(input.remaining_work_ids.is_empty());
        assert_eq!(input.queue.depth, 0);
    }

    #[tokio::test]
    async fn finalization_shallow_and_full_queues_drain_to_terminal() {
        for work_count in [1_u64, 2_u64] {
            let ledger = Arc::new(QueueLedger::new(format!("meeting-{work_count}"), 2).unwrap());
            let now = Instant::now();
            for id in 0..work_count {
                ledger.accept(format!("work-{id}"), now).unwrap();
                ledger.start(&format!("work-{id}"), now).unwrap();
            }
            let worker_ledger = Arc::clone(&ledger);
            let worker = tokio::spawn(async move {
                for id in 0..work_count {
                    worker_ledger
                        .finish(&format!("work-{id}"), WorkOutcome::Completed, Instant::now())
                        .unwrap();
                }
            });

            let report = drain_with(Arc::clone(&ledger), worker, Duration::from_millis(50)).await;
            let snapshot = ledger.snapshot(Instant::now());
            assert!(!report.deadline_expired);
            assert!(!report.worker_failed);
            assert!(report.remaining_work_ids.is_empty());
            assert_eq!(snapshot.completed, work_count);
            assert_eq!(snapshot.depth, 0);
        }
    }

    #[tokio::test]
    async fn finalization_failed_queue_stays_explicitly_incomplete() {
        let ledger = Arc::new(QueueLedger::new("meeting-failed", 2).unwrap());
        let now = Instant::now();
        ledger.accept("work-failed", now).unwrap();
        ledger.start("work-failed", now).unwrap();
        let worker_ledger = Arc::clone(&ledger);
        let worker = tokio::spawn(async move {
            worker_ledger
                .finish(
                    "work-failed",
                    WorkOutcome::Failed(WorkFailureReason::TranscriptionFailed),
                    Instant::now(),
                )
                .unwrap();
        });

        let report = drain_with(Arc::clone(&ledger), worker, Duration::from_millis(50)).await;
        let input = build_finalize_meeting_input(
            ledger.meeting_id(),
            &ledger,
            "2026-09-20T00:00:00Z".to_string(),
            50,
            true,
            true,
            &report,
        );

        assert_eq!(input.queue.failed, 1);
        assert!(input.reason_codes.iter().any(|reason| reason == "work_failed"));
    }

    #[tokio::test]
    async fn finalization_timeout_aborts_worker_and_records_remaining_ids() {
        let ledger = Arc::new(QueueLedger::new("meeting-timeout", 2).unwrap());
        let now = Instant::now();
        ledger.accept("work-pending", now).unwrap();
        ledger.start("work-pending", now).unwrap();
        let worker = tokio::spawn(async {
            std::future::pending::<()>().await;
        });

        let report = drain_with(Arc::clone(&ledger), worker, Duration::from_millis(5)).await;
        let input = build_finalize_meeting_input(
            ledger.meeting_id(),
            &ledger,
            "2026-09-20T00:00:00Z".to_string(),
            5,
            true,
            true,
            &report,
        );

        assert!(report.deadline_expired);
        assert_eq!(report.remaining_work_ids, vec!["work-pending"]);
        assert_eq!(input.queue.cancelled, 1);
        assert!(input.reason_codes.iter().any(|reason| reason == "deadline_exceeded"));
    }

    #[test]
    fn finalization_stop_orders_close_then_finalizing_then_drain() {
        let source = include_str!("recording_commands.rs");
        let stop_start = source
            .find("pub async fn stop_recording")
            .expect("stop command must exist");
        let stop = &source[stop_start..];
        let close = stop
            .find("stop_streams_and_force_flush")
            .expect("stop must close capture and producers");
        let finalizing = stop
            .find("mark_finalizing")
            .expect("stop must persist finalizing before drain");
        let drain = stop
            .find("drain_transcription_to_deadline")
            .expect("stop must use a bounded ledger drain");

        assert!(close < finalizing && finalizing < drain);
    }
}
