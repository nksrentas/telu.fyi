//! Bounded, content-free attribution for network-capable application attempts.

use super::provider_route::{
    Capability, EffectiveRoute, LocationClass, ProviderRouteError, RouteValidationState,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::sync::{Arc, LazyLock, Mutex, RwLock};
use std::time::Instant;
use url::Url;

const DEFAULT_OUTBOUND_LEDGER_CAPACITY: usize = 4_096;
const DEFAULT_ANALYTICS_ORIGIN: &str = "https://us.i.posthog.com";
const DEFAULT_UPDATER_ENDPOINT: &str =
    "https://github.com/Zackriya-Solutions/meeting-minutes/releases/latest/download/latest.json";
const CANARY_PACKET_AUTHORITY: &str =
    "The OS or proxy method selected in Plan 19 is authoritative for packets.";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CanaryBackgroundPolicy {
    SuppressAutomatic,
    PermitAttributed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CanaryBackgroundService {
    Analytics,
    Updater,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CanaryAttemptTrigger {
    Automatic,
    Manual,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanaryModeState {
    pub run_id: String,
    pub enabled: bool,
    pub background_policy: CanaryBackgroundPolicy,
    pub started_at_utc: DateTime<Utc>,
    pub stopped_at_utc: Option<DateTime<Utc>>,
    pub packet_blocker_authority: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanaryModeSnapshot {
    pub state: CanaryModeState,
    pub outbound: OutboundSnapshot,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanaryBackgroundDecision {
    pub run_id: Option<String>,
    pub canary_enabled: bool,
    pub service: CanaryBackgroundService,
    pub trigger: CanaryAttemptTrigger,
    pub allow_dispatch: bool,
    pub sequence: Option<u64>,
    pub disposition: Option<OutboundDisposition>,
    pub redacted_code: Option<String>,
    pub packet_blocker_authority: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CanaryModeError {
    InvalidRunId,
    AlreadyActive,
    RunMismatch,
    EvidenceMissing,
    AttributionIncomplete,
}

impl CanaryModeError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidRunId => "CANARY_RUN_ID_INVALID",
            Self::AlreadyActive => "CANARY_ALREADY_ACTIVE",
            Self::RunMismatch => "CANARY_RUN_MISMATCH",
            Self::EvidenceMissing => "CANARY_EVIDENCE_MISSING",
            Self::AttributionIncomplete => "CANARY_ATTRIBUTION_INCOMPLETE",
        }
    }
}

#[derive(Debug)]
struct ActiveCanaryMode {
    state: CanaryModeState,
    ledger: Arc<OutboundLedger>,
    previous_ledger: Arc<OutboundLedger>,
}

#[derive(Debug, Default)]
struct CanaryRuntimeState {
    active: Option<ActiveCanaryMode>,
    completed: Option<CanaryModeSnapshot>,
}

#[derive(Debug)]
struct CanaryRuntime {
    outbound_slot: Arc<RwLock<Arc<OutboundLedger>>>,
    state: Mutex<CanaryRuntimeState>,
}

impl CanaryRuntime {
    fn new(outbound_slot: Arc<RwLock<Arc<OutboundLedger>>>) -> Self {
        Self {
            outbound_slot,
            state: Mutex::new(CanaryRuntimeState::default()),
        }
    }

    fn start(
        &self,
        run_id: &str,
        background_policy: CanaryBackgroundPolicy,
    ) -> Result<CanaryModeSnapshot, CanaryModeError> {
        if !is_safe_identifier(run_id) {
            return Err(CanaryModeError::InvalidRunId);
        }

        let mut runtime = self.state.lock().unwrap_or_else(|error| error.into_inner());
        if let Some(active) = runtime.active.as_ref() {
            if active.state.run_id == run_id && active.state.background_policy == background_policy
            {
                return Ok(snapshot_active_canary(active));
            }
            return Err(CanaryModeError::AlreadyActive);
        }

        let ledger = Arc::new(
            OutboundLedger::new(run_id, DEFAULT_OUTBOUND_LEDGER_CAPACITY, Instant::now())
                .map_err(|_| CanaryModeError::InvalidRunId)?,
        );
        let previous_ledger = {
            let mut outbound = self
                .outbound_slot
                .write()
                .unwrap_or_else(|error| error.into_inner());
            std::mem::replace(&mut *outbound, Arc::clone(&ledger))
        };
        let active = ActiveCanaryMode {
            state: CanaryModeState {
                run_id: run_id.to_string(),
                enabled: true,
                background_policy,
                started_at_utc: Utc::now(),
                stopped_at_utc: None,
                packet_blocker_authority: CANARY_PACKET_AUTHORITY.to_string(),
            },
            ledger,
            previous_ledger,
        };
        let snapshot = snapshot_active_canary(&active);
        runtime.active = Some(active);
        Ok(snapshot)
    }

    fn stop(&self, run_id: &str) -> Result<CanaryModeSnapshot, CanaryModeError> {
        let mut runtime = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let Some(active) = runtime.active.as_ref() else {
            return Err(CanaryModeError::EvidenceMissing);
        };
        if active.state.run_id != run_id {
            return Err(CanaryModeError::RunMismatch);
        }
        let active = runtime
            .active
            .take()
            .expect("the active canary was checked before take");
        {
            let mut outbound = self
                .outbound_slot
                .write()
                .unwrap_or_else(|error| error.into_inner());
            *outbound = active.previous_ledger;
        }

        let snapshot = CanaryModeSnapshot {
            state: CanaryModeState {
                enabled: false,
                stopped_at_utc: Some(Utc::now()),
                ..active.state
            },
            outbound: active.ledger.snapshot(),
        };
        let attribution_complete = snapshot.outbound.attribution_complete;
        runtime.completed = Some(snapshot.clone());
        if attribution_complete {
            Ok(snapshot)
        } else {
            Err(CanaryModeError::AttributionIncomplete)
        }
    }

    fn query(&self, run_id: Option<&str>) -> Result<Option<CanaryModeSnapshot>, CanaryModeError> {
        let runtime = self.state.lock().unwrap_or_else(|error| error.into_inner());
        match run_id {
            None => Ok(runtime.active.as_ref().map(snapshot_active_canary)),
            Some(run_id) => {
                if let Some(active) = runtime.active.as_ref() {
                    if active.state.run_id == run_id {
                        return Ok(Some(snapshot_active_canary(active)));
                    }
                }
                if let Some(completed) = runtime.completed.as_ref() {
                    if completed.state.run_id == run_id {
                        return Ok(Some(completed.clone()));
                    }
                }
                Err(CanaryModeError::EvidenceMissing)
            }
        }
    }

    fn record_background_decision(
        &self,
        service: CanaryBackgroundService,
        trigger: CanaryAttemptTrigger,
    ) -> Result<CanaryBackgroundDecision, CanaryModeError> {
        let active = {
            let runtime = self.state.lock().unwrap_or_else(|error| error.into_inner());
            runtime
                .active
                .as_ref()
                .map(|active| (active.state.clone(), Arc::clone(&active.ledger)))
        };
        let Some((state, ledger)) = active else {
            return Ok(CanaryBackgroundDecision {
                run_id: None,
                canary_enabled: false,
                service,
                trigger,
                allow_dispatch: true,
                sequence: None,
                disposition: None,
                redacted_code: None,
                packet_blocker_authority: CANARY_PACKET_AUTHORITY.to_string(),
            });
        };

        let allow_dispatch = trigger == CanaryAttemptTrigger::Manual
            || state.background_policy == CanaryBackgroundPolicy::PermitAttributed;
        let disposition = if allow_dispatch {
            OutboundDisposition::Permitted
        } else {
            OutboundDisposition::Suppressed
        };
        let redacted_code = if allow_dispatch {
            "CANARY_PERMITTED"
        } else {
            "CANARY_SUPPRESSED"
        };
        let route = canary_background_route(service);

        let current_run_matches = {
            let runtime = self.state.lock().unwrap_or_else(|error| error.into_inner());
            runtime
                .active
                .as_ref()
                .is_some_and(|active| active.state.run_id == state.run_id)
        };
        if !current_run_matches {
            return Err(CanaryModeError::EvidenceMissing);
        }

        let sequence = ledger
            .record_canary_background_decision(&route, disposition, redacted_code)
            .map_err(|_| CanaryModeError::AttributionIncomplete)?;
        Ok(CanaryBackgroundDecision {
            run_id: Some(state.run_id),
            canary_enabled: true,
            service,
            trigger,
            allow_dispatch,
            sequence: Some(sequence),
            disposition: Some(disposition),
            redacted_code: Some(redacted_code.to_string()),
            packet_blocker_authority: CANARY_PACKET_AUTHORITY.to_string(),
        })
    }
}

fn snapshot_active_canary(active: &ActiveCanaryMode) -> CanaryModeSnapshot {
    CanaryModeSnapshot {
        state: active.state.clone(),
        outbound: active.ledger.snapshot(),
    }
}

fn background_route_identity(
    service: CanaryBackgroundService,
) -> (Capability, &'static str, &'static str, &'static str) {
    match service {
        CanaryBackgroundService::Analytics => (
            Capability::Analytics,
            "posthog",
            "events",
            DEFAULT_ANALYTICS_ORIGIN,
        ),
        CanaryBackgroundService::Updater => (
            Capability::Updater,
            "tauri-updater",
            "release-manifest",
            DEFAULT_UPDATER_ENDPOINT,
        ),
    }
}

fn canary_background_route(service: CanaryBackgroundService) -> EffectiveRoute {
    let (capability, provider_id, model_id, destination) = background_route_identity(service);
    let origin = Url::parse(destination)
        .expect("fixed canary background destinations must be valid URLs")
        .origin()
        .ascii_serialization();
    EffectiveRoute {
        capability,
        provider_id: provider_id.to_string(),
        model_id: model_id.to_string(),
        location_class: Some(LocationClass::Remote),
        sanitized_origin: Some(origin),
        encrypted: true,
        validation_state: RouteValidationState::Validated,
        resolved_addresses: Vec::new(),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OutboundDisposition {
    Permitted,
    Blocked,
    Failed,
    Suppressed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutboundRoute {
    pub capability: Capability,
    pub provider_id: String,
    pub model_id: String,
    pub location_class: LocationClass,
    pub sanitized_origin: String,
    pub encrypted: bool,
    pub validation_state: RouteValidationState,
    pub resolved_addresses: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutboundAttempt {
    pub run_id: String,
    pub meeting_id: Option<String>,
    pub sequence: u64,
    pub monotonic_offset_ns: u64,
    pub observed_at_utc: DateTime<Utc>,
    pub route: OutboundRoute,
    pub disposition: OutboundDisposition,
    pub redacted_code: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutboundSnapshot {
    pub run_id: String,
    pub capacity: usize,
    pub attempts: Vec<OutboundAttempt>,
    pub overflow_count: u64,
    pub attribution_complete: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OutboundLedgerError {
    InvalidCapacity,
    InvalidRunId,
    InvalidMeetingId,
    InvalidRoute,
    InProcessRoute,
    InvalidRedactedCode,
    UnknownSequence(u64),
    InvalidDispositionTransition(u64),
    CapacityExceeded { sequence: u64 },
    SequenceExhausted,
}

#[derive(Debug)]
pub enum OutboundDispatchError {
    Route(ProviderRouteError),
    Ledger(OutboundLedgerError),
}

#[derive(Debug)]
pub struct AuthorizedOutbound<T> {
    pub sequence: u64,
    pub value: T,
}

impl OutboundDispatchError {
    pub fn code(&self) -> String {
        match self {
            Self::Route(error) => error.code.clone(),
            Self::Ledger(_) => "OUTBOUND_ATTRIBUTION_INCOMPLETE".to_string(),
        }
    }
}

#[derive(Debug)]
pub struct OutboundLedger {
    run_id: String,
    capacity: usize,
    origin: Instant,
    state: Mutex<OutboundLedgerState>,
}

#[derive(Debug, Default)]
struct OutboundLedgerState {
    next_sequence: u64,
    attempts: Vec<OutboundAttempt>,
    overflow_count: u64,
}

impl OutboundLedger {
    pub fn new(
        run_id: impl Into<String>,
        capacity: usize,
        origin: Instant,
    ) -> Result<Self, OutboundLedgerError> {
        let run_id = run_id.into();
        if !is_safe_identifier(&run_id) {
            return Err(OutboundLedgerError::InvalidRunId);
        }
        if capacity == 0 {
            return Err(OutboundLedgerError::InvalidCapacity);
        }
        Ok(Self {
            run_id,
            capacity,
            origin,
            state: Mutex::new(OutboundLedgerState::default()),
        })
    }

    pub fn record_network_attempt(
        &self,
        meeting_id: Option<&str>,
        route: &EffectiveRoute,
        disposition: OutboundDisposition,
        redacted_code: Option<&str>,
        observed_at: Instant,
        observed_at_utc: DateTime<Utc>,
    ) -> Result<u64, OutboundLedgerError> {
        self.record_attempt(
            meeting_id,
            route,
            disposition,
            redacted_code,
            observed_at,
            observed_at_utc,
            false,
        )
    }

    fn record_canary_background_decision(
        &self,
        route: &EffectiveRoute,
        disposition: OutboundDisposition,
        redacted_code: &str,
    ) -> Result<u64, OutboundLedgerError> {
        self.record_attempt(
            None,
            route,
            disposition,
            Some(redacted_code),
            Instant::now(),
            Utc::now(),
            true,
        )
    }

    #[allow(clippy::too_many_arguments)]
    fn record_attempt(
        &self,
        meeting_id: Option<&str>,
        route: &EffectiveRoute,
        disposition: OutboundDisposition,
        redacted_code: Option<&str>,
        observed_at: Instant,
        observed_at_utc: DateTime<Utc>,
        allow_unresolved_route: bool,
    ) -> Result<u64, OutboundLedgerError> {
        let meeting_id = meeting_id
            .map(|meeting_id| {
                if is_safe_identifier(meeting_id) {
                    Ok(meeting_id.to_string())
                } else {
                    Err(OutboundLedgerError::InvalidMeetingId)
                }
            })
            .transpose()?;
        let redacted_code = redacted_code
            .map(|code| {
                if is_safe_code(code) {
                    Ok(code.to_string())
                } else {
                    Err(OutboundLedgerError::InvalidRedactedCode)
                }
            })
            .transpose()?;
        let route = sanitize_network_route(route, allow_unresolved_route)?;
        let monotonic_offset_ns = observed_at
            .saturating_duration_since(self.origin)
            .as_nanos()
            .min(u64::MAX as u128) as u64;

        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let sequence = state.next_sequence;
        state.next_sequence = state
            .next_sequence
            .checked_add(1)
            .ok_or(OutboundLedgerError::SequenceExhausted)?;
        if state.attempts.len() >= self.capacity {
            state.overflow_count = state.overflow_count.saturating_add(1);
            return Err(OutboundLedgerError::CapacityExceeded { sequence });
        }
        state.attempts.push(OutboundAttempt {
            run_id: self.run_id.clone(),
            meeting_id,
            sequence,
            monotonic_offset_ns,
            observed_at_utc,
            route,
            disposition,
            redacted_code,
        });
        Ok(sequence)
    }

    pub fn snapshot(&self) -> OutboundSnapshot {
        let state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let mut attempts = state.attempts.clone();
        attempts.sort_by_key(|attempt| (attempt.monotonic_offset_ns, attempt.sequence));
        OutboundSnapshot {
            run_id: self.run_id.clone(),
            capacity: self.capacity,
            attempts,
            overflow_count: state.overflow_count,
            attribution_complete: state.overflow_count == 0,
        }
    }

    pub fn mark_failed(
        &self,
        sequence: u64,
        redacted_code: &str,
    ) -> Result<(), OutboundLedgerError> {
        if !is_safe_code(redacted_code) {
            return Err(OutboundLedgerError::InvalidRedactedCode);
        }
        let mut state = self.state.lock().unwrap_or_else(|error| error.into_inner());
        let attempt = state
            .attempts
            .iter_mut()
            .find(|attempt| attempt.sequence == sequence)
            .ok_or(OutboundLedgerError::UnknownSequence(sequence))?;
        match attempt.disposition {
            OutboundDisposition::Permitted => {
                attempt.disposition = OutboundDisposition::Failed;
                attempt.redacted_code = Some(redacted_code.to_string());
                Ok(())
            }
            OutboundDisposition::Failed
                if attempt.redacted_code.as_deref() == Some(redacted_code) =>
            {
                Ok(())
            }
            _ => Err(OutboundLedgerError::InvalidDispositionTransition(sequence)),
        }
    }
}

pub fn authorize_and_record_dispatch<T>(
    ledger: &OutboundLedger,
    meeting_id: Option<&str>,
    expected_route: &EffectiveRoute,
    current_route: &EffectiveRoute,
    dispatch: impl FnOnce() -> T,
) -> Result<AuthorizedOutbound<T>, OutboundDispatchError> {
    if let Err(error) =
        super::provider_route::validate_route_contract(expected_route, current_route)
    {
        ledger
            .record_network_attempt(
                meeting_id,
                expected_route,
                OutboundDisposition::Blocked,
                Some(&error.code),
                Instant::now(),
                Utc::now(),
            )
            .map_err(OutboundDispatchError::Ledger)?;
        return Err(OutboundDispatchError::Route(error));
    }

    let sequence = ledger
        .record_network_attempt(
            meeting_id,
            current_route,
            OutboundDisposition::Permitted,
            Some("DISPATCH_AUTHORIZED"),
            Instant::now(),
            Utc::now(),
        )
        .map_err(OutboundDispatchError::Ledger)?;
    Ok(AuthorizedOutbound {
        sequence,
        value: dispatch(),
    })
}

static ACTIVE_OUTBOUND_LEDGER: LazyLock<Arc<RwLock<Arc<OutboundLedger>>>> = LazyLock::new(|| {
    let run_id = format!("process-{}", uuid::Uuid::new_v4());
    let ledger = OutboundLedger::new(run_id, DEFAULT_OUTBOUND_LEDGER_CAPACITY, Instant::now())
        .expect("the process outbound ledger configuration must be valid");
    Arc::new(RwLock::new(Arc::new(ledger)))
});

static ACTIVE_CANARY_RUNTIME: LazyLock<CanaryRuntime> =
    LazyLock::new(|| CanaryRuntime::new(Arc::clone(&ACTIVE_OUTBOUND_LEDGER)));

pub fn active_outbound_ledger() -> Arc<OutboundLedger> {
    ACTIVE_OUTBOUND_LEDGER
        .read()
        .unwrap_or_else(|error| error.into_inner())
        .clone()
}

pub fn replace_active_outbound_ledger(ledger: Arc<OutboundLedger>) -> Arc<OutboundLedger> {
    let mut active = ACTIVE_OUTBOUND_LEDGER
        .write()
        .unwrap_or_else(|error| error.into_inner());
    std::mem::replace(&mut *active, ledger)
}

#[tauri::command]
pub fn start_canary_mode(
    run_id: String,
    background_policy: CanaryBackgroundPolicy,
) -> Result<CanaryModeSnapshot, String> {
    ACTIVE_CANARY_RUNTIME
        .start(&run_id, background_policy)
        .map_err(|error| error.code().to_string())
}

#[tauri::command]
pub fn stop_canary_mode(run_id: String) -> Result<CanaryModeSnapshot, String> {
    ACTIVE_CANARY_RUNTIME
        .stop(&run_id)
        .map_err(|error| error.code().to_string())
}

#[tauri::command]
pub fn get_canary_mode(run_id: Option<String>) -> Result<Option<CanaryModeSnapshot>, String> {
    ACTIVE_CANARY_RUNTIME
        .query(run_id.as_deref())
        .map_err(|error| error.code().to_string())
}

#[tauri::command]
pub fn evaluate_canary_background_attempt(
    service: CanaryBackgroundService,
    trigger: CanaryAttemptTrigger,
) -> Result<CanaryBackgroundDecision, String> {
    ACTIVE_CANARY_RUNTIME
        .record_background_decision(service, trigger)
        .map_err(|error| error.code().to_string())
}

fn sanitize_network_route(
    route: &EffectiveRoute,
    allow_unresolved_route: bool,
) -> Result<OutboundRoute, OutboundLedgerError> {
    let location_class = route
        .location_class
        .ok_or(OutboundLedgerError::InvalidRoute)?;
    let raw_origin = route
        .sanitized_origin
        .as_deref()
        .ok_or(OutboundLedgerError::InvalidRoute)?;
    if location_class == LocationClass::Local
        && raw_origin == "This device"
        && route.resolved_addresses.is_empty()
    {
        return Err(OutboundLedgerError::InProcessRoute);
    }

    let origin = Url::parse(raw_origin).map_err(|_| OutboundLedgerError::InvalidRoute)?;
    if !matches!(origin.scheme(), "http" | "https") || origin.host().is_none() {
        return Err(OutboundLedgerError::InvalidRoute);
    }
    let sanitized_origin = origin.origin().ascii_serialization();
    let resolved_addresses = route
        .resolved_addresses
        .iter()
        .map(|address| {
            address
                .parse::<IpAddr>()
                .map(|address| address.to_string())
                .map_err(|_| OutboundLedgerError::InvalidRoute)
        })
        .collect::<Result<Vec<_>, _>>()?;
    if resolved_addresses.is_empty() && !allow_unresolved_route {
        return Err(OutboundLedgerError::InvalidRoute);
    }

    Ok(OutboundRoute {
        capability: route.capability,
        provider_id: route.provider_id.clone(),
        model_id: route.model_id.clone(),
        location_class,
        sanitized_origin,
        encrypted: route.encrypted,
        validation_state: route.validation_state,
        resolved_addresses,
    })
}

fn is_safe_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':'))
}

fn is_safe_code(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_uppercase() || byte.is_ascii_digit() || byte == b'_')
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::trust::provider_route::{resolve_route_from_addresses, RouteDestination};
    use std::collections::BTreeSet;
    use std::net::{IpAddr, Ipv4Addr};
    use std::sync::{Arc, Barrier};
    use std::thread;
    use std::time::Duration;

    fn isolated_canary_runtime(run_id: &str) -> (CanaryRuntime, Arc<OutboundLedger>) {
        let previous = Arc::new(
            OutboundLedger::new(
                format!("process-{run_id}"),
                DEFAULT_OUTBOUND_LEDGER_CAPACITY,
                Instant::now(),
            )
            .unwrap(),
        );
        let slot = Arc::new(RwLock::new(Arc::clone(&previous)));
        (CanaryRuntime::new(slot), previous)
    }

    fn remote_route(raw: &str) -> EffectiveRoute {
        resolve_route_from_addresses(
            Capability::Summary,
            "custom-openai",
            "configured-model",
            RouteDestination::Url(Some(raw)),
            &[IpAddr::V4(Ipv4Addr::new(203, 0, 113, 9))],
        )
    }

    fn loopback_route() -> EffectiveRoute {
        resolve_route_from_addresses(
            Capability::Transcription,
            "loopback-provider",
            "configured-model",
            RouteDestination::Url(Some("http://127.0.0.1:8178/transcribe")),
            &[IpAddr::V4(Ipv4Addr::LOCALHOST)],
        )
    }

    #[test]
    fn outbound_ledger_records_attributed_sanitized_attempt_fields() {
        let origin = Instant::now();
        let observed_at = origin + Duration::from_millis(12);
        let observed_at_utc = Utc::now();
        let ledger = OutboundLedger::new("run-01", 4, origin).unwrap();
        let route = remote_route(
            "https://alice:super-secret@example.com/private/transcript?token=secret#section",
        );

        ledger
            .record_network_attempt(
                Some("meeting-01"),
                &route,
                OutboundDisposition::Permitted,
                Some("DISPATCH_AUTHORIZED"),
                observed_at,
                observed_at_utc,
            )
            .unwrap();

        let snapshot = ledger.snapshot();
        assert_eq!(snapshot.attempts.len(), 1, "attempt must be retained");
        let attempt = &snapshot.attempts[0];
        assert_eq!(attempt.run_id, "run-01");
        assert_eq!(attempt.meeting_id.as_deref(), Some("meeting-01"));
        assert_eq!(attempt.sequence, 0);
        assert_eq!(attempt.monotonic_offset_ns, 12_000_000);
        assert_eq!(attempt.observed_at_utc, observed_at_utc);
        assert_eq!(attempt.route.capability, Capability::Summary);
        assert_eq!(attempt.route.location_class, LocationClass::Remote);
        assert_eq!(attempt.disposition, OutboundDisposition::Permitted);
        assert_eq!(
            attempt.redacted_code.as_deref(),
            Some("DISPATCH_AUTHORIZED")
        );
    }

    #[test]
    fn outbound_ledger_keeps_identical_concurrent_attempts_distinct_and_ordered() {
        let origin = Instant::now();
        let observed_at = origin + Duration::from_millis(1);
        let observed_at_utc = Utc::now();
        let ledger = Arc::new(OutboundLedger::new("run-concurrent", 32, origin).unwrap());
        let route = remote_route("https://example.com/v1");
        let barrier = Arc::new(Barrier::new(16));
        let mut handles = Vec::new();

        for _ in 0..16 {
            let ledger = Arc::clone(&ledger);
            let route = route.clone();
            let barrier = Arc::clone(&barrier);
            handles.push(thread::spawn(move || {
                barrier.wait();
                ledger
                    .record_network_attempt(
                        Some("meeting-concurrent"),
                        &route,
                        OutboundDisposition::Permitted,
                        None,
                        observed_at,
                        observed_at_utc,
                    )
                    .unwrap()
            }));
        }

        let returned_sequences = handles
            .into_iter()
            .map(|handle| handle.join().unwrap())
            .collect::<BTreeSet<_>>();
        let snapshot = ledger.snapshot();
        assert_eq!(snapshot.attempts.len(), 16, "no attempt may coalesce");
        assert_eq!(returned_sequences.len(), 16, "sequences must be unique");
        let ordered_sequences = snapshot
            .attempts
            .iter()
            .map(|attempt| attempt.sequence)
            .collect::<Vec<_>>();
        assert_eq!(ordered_sequences, (0..16).collect::<Vec<_>>());
    }

    #[test]
    fn outbound_ledger_marks_overflow_incomplete_without_erasing_retained_attempts() {
        let origin = Instant::now();
        let ledger = OutboundLedger::new("run-overflow", 2, origin).unwrap();
        let route = remote_route("https://example.com/v1");

        for index in 0..2 {
            ledger
                .record_network_attempt(
                    Some("meeting-overflow"),
                    &route,
                    OutboundDisposition::Permitted,
                    None,
                    origin + Duration::from_millis(index),
                    Utc::now(),
                )
                .unwrap();
        }
        let overflow = ledger.record_network_attempt(
            Some("meeting-overflow"),
            &route,
            OutboundDisposition::Failed,
            Some("NETWORK_FAILED"),
            origin + Duration::from_millis(2),
            Utc::now(),
        );

        assert_eq!(
            overflow,
            Err(OutboundLedgerError::CapacityExceeded { sequence: 2 })
        );
        let snapshot = ledger.snapshot();
        assert_eq!(snapshot.attempts.len(), 2);
        assert_eq!(snapshot.overflow_count, 1);
        assert!(!snapshot.attribution_complete);
    }

    #[test]
    fn outbound_ledger_serialization_excludes_content_credentials_query_and_path() {
        let origin = Instant::now();
        let ledger = OutboundLedger::new("run-redacted", 2, origin).unwrap();
        let route = remote_route(
            "https://alice:super-secret@example.com/private/transcript?api_key=secret#payload",
        );
        ledger
            .record_network_attempt(
                Some("meeting-redacted"),
                &route,
                OutboundDisposition::Blocked,
                Some("ROUTE_BLOCKED"),
                origin,
                Utc::now(),
            )
            .unwrap();

        let serialized = serde_json::to_string(&ledger.snapshot()).unwrap();
        for forbidden in [
            "alice",
            "super-secret",
            "private/transcript",
            "api_key",
            "secret",
            "payload",
        ] {
            assert!(
                !serialized.contains(forbidden),
                "serialized ledger leaked {forbidden}"
            );
        }
    }

    #[test]
    fn outbound_ledger_rejects_in_process_work_but_keeps_loopback_network_attempts() {
        let origin = Instant::now();
        let ledger = OutboundLedger::new("run-boundary", 2, origin).unwrap();
        let device = resolve_route_from_addresses(
            Capability::Transcription,
            "parakeet",
            "parakeet-local",
            RouteDestination::Device,
            &[],
        );

        assert_eq!(
            ledger.record_network_attempt(
                Some("meeting-boundary"),
                &device,
                OutboundDisposition::Permitted,
                None,
                origin,
                Utc::now(),
            ),
            Err(OutboundLedgerError::InProcessRoute)
        );
        ledger
            .record_network_attempt(
                Some("meeting-boundary"),
                &loopback_route(),
                OutboundDisposition::Permitted,
                None,
                origin,
                Utc::now(),
            )
            .unwrap();
        let snapshot = ledger.snapshot();
        assert_eq!(snapshot.attempts.len(), 1);
        assert_eq!(
            snapshot.attempts[0].route.location_class,
            LocationClass::Local
        );
        assert_eq!(
            snapshot.attempts[0].route.sanitized_origin,
            "http://127.0.0.1:8178"
        );
    }

    #[test]
    fn outbound_attribution_records_permitted_attempt_before_dispatch() {
        let origin = Instant::now();
        let ledger = OutboundLedger::new("run-dispatch", 4, origin).unwrap();
        let route = remote_route("https://example.com/v1");

        let authorized = authorize_and_record_dispatch(
            &ledger,
            Some("meeting-dispatch"),
            &route,
            &route,
            || {
                assert_eq!(
                    ledger.snapshot().attempts.len(),
                    1,
                    "attribution must exist before dispatch begins"
                );
                "dispatched"
            },
        )
        .unwrap();

        assert_eq!(authorized.value, "dispatched");
        let attempt = &ledger.snapshot().attempts[0];
        assert_eq!(attempt.sequence, authorized.sequence);
        assert_eq!(attempt.disposition, OutboundDisposition::Permitted);
    }

    #[test]
    fn outbound_attribution_retains_blocked_and_failed_attempts() {
        let origin = Instant::now();
        let ledger = OutboundLedger::new("run-outcomes", 4, origin).unwrap();
        let expected = remote_route("https://example.com/v1");
        let changed = loopback_route();
        let dispatched = std::cell::Cell::new(false);

        let blocked = authorize_and_record_dispatch(
            &ledger,
            Some("meeting-outcomes"),
            &expected,
            &changed,
            || dispatched.set(true),
        );
        assert!(
            matches!(blocked, Err(OutboundDispatchError::Route(_))),
            "materially changed route must be blocked"
        );
        assert!(!dispatched.get(), "blocked dispatch must not run");
        assert_eq!(
            ledger.snapshot().attempts[0].disposition,
            OutboundDisposition::Blocked
        );

        let authorized = authorize_and_record_dispatch(
            &ledger,
            Some("meeting-outcomes"),
            &expected,
            &expected,
            || (),
        )
        .unwrap();
        ledger
            .mark_failed(authorized.sequence, "NETWORK_SEND_FAILED")
            .unwrap();
        let snapshot = ledger.snapshot();
        assert_eq!(snapshot.attempts.len(), 2);
        assert_eq!(
            snapshot.attempts[1].disposition,
            OutboundDisposition::Failed
        );
        assert_eq!(
            snapshot.attempts[1].redacted_code.as_deref(),
            Some("NETWORK_SEND_FAILED")
        );
    }

    #[test]
    fn outbound_attribution_preserves_capability_routes_across_location_classes() {
        let origin = Instant::now();
        let ledger = OutboundLedger::new("run-routes", 4, origin).unwrap();
        let cases = [
            (
                Capability::Transcription,
                "http://127.0.0.1:8178/transcribe",
                IpAddr::V4(Ipv4Addr::LOCALHOST),
                LocationClass::Local,
            ),
            (
                Capability::Summary,
                "http://192.168.1.10:11434/v1",
                IpAddr::V4(Ipv4Addr::new(192, 168, 1, 10)),
                LocationClass::Lan,
            ),
            (
                Capability::Generation,
                "https://203.0.113.10/v1",
                IpAddr::V4(Ipv4Addr::new(203, 0, 113, 10)),
                LocationClass::Remote,
            ),
        ];

        for (capability, destination, address, _) in cases {
            let route = resolve_route_from_addresses(
                capability,
                "configured-provider",
                "configured-model",
                RouteDestination::Url(Some(destination)),
                &[address],
            );
            authorize_and_record_dispatch(&ledger, None, &route, &route, || ()).unwrap();
        }

        let snapshot = ledger.snapshot();
        assert_eq!(snapshot.attempts.len(), 3);
        assert_eq!(
            snapshot
                .attempts
                .iter()
                .map(|attempt| (attempt.route.capability, attempt.route.location_class))
                .collect::<Vec<_>>(),
            cases
                .into_iter()
                .map(|(capability, _, _, class)| (capability, class))
                .collect::<Vec<_>>()
        );
    }

    #[test]
    fn outbound_attribution_is_present_at_each_network_dispatch_seam() {
        let summary = include_str!("../summary/llm_client.rs");
        let analytics = include_str!("../analytics/analytics.rs");
        let ollama_metadata = include_str!("../ollama/metadata.rs");
        let transcription = include_str!("../audio/transcription/engine.rs");

        let summary_attribution = summary
            .find("authorize_and_record_dispatch")
            .expect("summary requests must use the shared attribution gate");
        let summary_request = summary
            .find(".post(api_url.clone())")
            .expect("summary request seam must remain visible");
        assert!(summary_attribution < summary_request);
        assert!(
            analytics.contains("authorize_and_record_dispatch"),
            "analytics capture must use the shared attribution gate"
        );
        assert!(
            ollama_metadata.contains("authorize_and_record_dispatch"),
            "summary metadata requests must use the shared attribution gate"
        );
        assert!(
            transcription.contains("RouteDestination::Device"),
            "current transcription remains explicitly device-internal"
        );
        assert!(
            !transcription.contains("record_network_attempt"),
            "device-internal transcription must not be mislabeled as network traffic"
        );
    }

    #[test]
    fn canary_mode_is_run_scoped_queryable_and_restores_prior_behavior() {
        let (runtime, previous) = isolated_canary_runtime("scope");

        let started = runtime
            .start("canary-scope", CanaryBackgroundPolicy::SuppressAutomatic)
            .unwrap();
        assert!(started.state.enabled, "the requested canary must be active");
        assert_eq!(started.state.run_id, "canary-scope");
        assert!(started.state.stopped_at_utc.is_none());
        assert!(
            !Arc::ptr_eq(
                &runtime
                    .outbound_slot
                    .read()
                    .unwrap_or_else(|error| error.into_inner()),
                &previous,
            ),
            "the canary must own a run-scoped outbound ledger"
        );

        let decision = runtime
            .record_background_decision(
                CanaryBackgroundService::Analytics,
                CanaryAttemptTrigger::Automatic,
            )
            .unwrap();
        assert!(!decision.allow_dispatch);
        assert_eq!(decision.run_id.as_deref(), Some("canary-scope"));

        let active = runtime.query(Some("canary-scope")).unwrap().unwrap();
        assert_eq!(active.outbound.attempts.len(), 1);
        assert_eq!(
            active.outbound.attempts[0].disposition,
            OutboundDisposition::Suppressed
        );

        let stopped = runtime.stop("canary-scope").unwrap();
        assert!(!stopped.state.enabled);
        assert!(stopped.state.stopped_at_utc.is_some());
        assert!(Arc::ptr_eq(
            &runtime
                .outbound_slot
                .read()
                .unwrap_or_else(|error| error.into_inner()),
            &previous,
        ));
        let retained = runtime.query(Some("canary-scope")).unwrap().unwrap();
        assert_eq!(retained.outbound, stopped.outbound);
    }

    #[test]
    fn canary_mode_start_stop_leaves_persistent_settings_byte_for_byte_unchanged() {
        let (runtime, _) = isolated_canary_runtime("settings");
        let persistent_settings = br#"{"analyticsOptedIn":true,"updates":true}"#.to_vec();
        let before = persistent_settings.clone();

        runtime
            .start("canary-settings", CanaryBackgroundPolicy::SuppressAutomatic)
            .unwrap();
        runtime.stop("canary-settings").unwrap();

        assert_eq!(persistent_settings, before);
    }

    #[test]
    fn canary_mode_records_suppressed_and_permitted_background_policy_evidence() {
        let (runtime, _) = isolated_canary_runtime("policy");
        runtime
            .start(
                "canary-suppressed",
                CanaryBackgroundPolicy::SuppressAutomatic,
            )
            .unwrap();
        let suppressed = runtime
            .record_background_decision(
                CanaryBackgroundService::Updater,
                CanaryAttemptTrigger::Automatic,
            )
            .unwrap();
        assert!(!suppressed.allow_dispatch);
        assert_eq!(
            suppressed.disposition,
            Some(OutboundDisposition::Suppressed)
        );
        assert_eq!(
            suppressed.redacted_code.as_deref(),
            Some("CANARY_SUPPRESSED")
        );
        runtime.stop("canary-suppressed").unwrap();

        runtime
            .start("canary-permitted", CanaryBackgroundPolicy::PermitAttributed)
            .unwrap();
        let permitted = runtime
            .record_background_decision(
                CanaryBackgroundService::Updater,
                CanaryAttemptTrigger::Automatic,
            )
            .unwrap();
        assert!(permitted.allow_dispatch);
        assert_eq!(permitted.disposition, Some(OutboundDisposition::Permitted));
        assert_eq!(permitted.redacted_code.as_deref(), Some("CANARY_PERMITTED"));

        let evidence = runtime.query(Some("canary-permitted")).unwrap().unwrap();
        assert_eq!(evidence.outbound.attempts.len(), 1);
        assert_eq!(evidence.outbound.run_id, "canary-permitted");
        assert!(evidence.outbound.attribution_complete);
    }
}
