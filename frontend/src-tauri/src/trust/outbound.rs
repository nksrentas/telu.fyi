//! Bounded, content-free attribution for network-capable application attempts.

use super::provider_route::{
    Capability, EffectiveRoute, LocationClass, RouteValidationState,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::sync::Mutex;
use std::time::Instant;
use url::Url;

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
    CapacityExceeded { sequence: u64 },
    SequenceExhausted,
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
        let route = sanitize_network_route(route)?;
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
}

fn sanitize_network_route(route: &EffectiveRoute) -> Result<OutboundRoute, OutboundLedgerError> {
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
    if resolved_addresses.is_empty() {
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
        && value.bytes().all(|byte| {
            byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':')
        })
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
}
