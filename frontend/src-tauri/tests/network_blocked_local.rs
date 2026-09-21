use app_lib::database::models::{CaptureCompleteness, RecoveryRequest, TranscriptEvidenceInput};
use app_lib::database::repositories::meeting::MeetingsRepository;
use app_lib::database::repositories::transcript::TranscriptsRepository;
use app_lib::trust::outbound::{
    authorize_and_record_dispatch, OutboundDisposition, OutboundLedger, OutboundSnapshot,
};
use app_lib::trust::provider_route::{
    resolve_route_from_addresses, Capability, RouteDestination,
};
use sqlx::sqlite::SqlitePoolOptions;
use std::cell::Cell;
use std::collections::BTreeSet;
use std::net::{IpAddr, Ipv4Addr};
use std::time::Instant;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum LocalWorkflowStage {
    Capture,
    Persistence,
    Recovery,
    Evaluation,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum LocalCanaryFailure {
    ContractUnavailable,
    AttributionLedgerMissing,
    UnpermittedAttempt { sequence: u64 },
}

// Intentional RED seam: GREEN replaces this placeholder with the application
// contract from config.rs, keeping these tests focused on observable outcomes.
fn evaluate_network_block_contract(
    _expected_run_id: &str,
    _declared_origins: &BTreeSet<String>,
    _outbound: Option<&OutboundSnapshot>,
    _completed_stages: &BTreeSet<LocalWorkflowStage>,
) -> Result<(), LocalCanaryFailure> {
    Err(LocalCanaryFailure::ContractUnavailable)
}

trait ExternalConnector {
    fn dispatch(&self) -> Result<(), &'static str>;
    fn attempts(&self) -> u64;
}

#[derive(Default)]
struct DenyAllConnector {
    attempts: Cell<u64>,
}

impl ExternalConnector for DenyAllConnector {
    fn dispatch(&self) -> Result<(), &'static str> {
        self.attempts.set(self.attempts.get() + 1);
        Err("DENY_ALL_CONNECTOR")
    }

    fn attempts(&self) -> u64 {
        self.attempts.get()
    }
}

fn loopback_route() -> app_lib::trust::EffectiveRoute {
    resolve_route_from_addresses(
        Capability::Transcription,
        "local-fixture",
        "deterministic",
        RouteDestination::Url(Some("http://127.0.0.1:8178/transcribe")),
        &[IpAddr::V4(Ipv4Addr::LOCALHOST)],
    )
}

fn remote_route() -> app_lib::trust::EffectiveRoute {
    resolve_route_from_addresses(
        Capability::Summary,
        "simulated-remote",
        "deterministic",
        RouteDestination::Url(Some("https://203.0.113.9/v1")),
        &[IpAddr::V4(Ipv4Addr::new(203, 0, 113, 9))],
    )
}

fn all_local_stages() -> BTreeSet<LocalWorkflowStage> {
    [
        LocalWorkflowStage::Capture,
        LocalWorkflowStage::Persistence,
        LocalWorkflowStage::Recovery,
        LocalWorkflowStage::Evaluation,
    ]
    .into_iter()
    .collect()
}

#[tokio::test]
async fn local_capture_persistence_recovery_and_evaluation_complete_with_deny_all_connector() {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("in-memory local canary database");
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("local canary migrations");

    let connector = DenyAllConnector::default();
    let captured_audio = [0_i16, 4, -4, 8];
    assert!(!captured_audio.is_empty(), "capture fixture must contain local audio");

    let meeting = MeetingsRepository::create_session(&pool, "Network-blocked local fixture")
        .await
        .expect("persist canonical local meeting");
    let evidence = TranscriptEvidenceInput {
        evidence_id: Uuid::new_v4().to_string(),
        meeting_id: meeting.meeting_id.clone(),
        source_track: "microphone".to_string(),
        source_segment_key: "local-fixture-0".to_string(),
        sequence: 0,
        transcript: "local final evidence".to_string(),
        audio_start_time: 0.0,
        audio_end_time: 0.25,
        capture_completeness: CaptureCompleteness::Complete,
    };
    TranscriptsRepository::upsert_final_evidence(&pool, &evidence)
        .await
        .expect("persist local final evidence");
    let recovered = MeetingsRepository::reconcile_meeting(
        &pool,
        &RecoveryRequest {
            meeting_id: meeting.meeting_id,
            evidence: vec![evidence],
            gaps: Vec::new(),
        },
    )
    .await
    .expect("reconcile local recovery fixture");
    assert_eq!(recovered.evidence_count, 1);

    let ledger = OutboundLedger::new("local-workflow", 8, Instant::now())
        .expect("present local attribution ledger");
    let evaluation = evaluate_network_block_contract(
        "local-workflow",
        &BTreeSet::new(),
        Some(&ledger.snapshot()),
        &all_local_stages(),
    );

    assert_eq!(evaluation, Ok(()));
    assert_eq!(connector.attempts(), 0, "local fixture must not call the connector");
}

#[test]
fn zero_attempts_pass_only_with_present_complete_attribution() {
    let ledger = OutboundLedger::new("zero-attempts", 4, Instant::now())
        .expect("present zero-attempt ledger");
    let stages = all_local_stages();
    let declared_origins = BTreeSet::new();

    assert_eq!(
        evaluate_network_block_contract(
            "zero-attempts",
            &declared_origins,
            Some(&ledger.snapshot()),
            &stages,
        ),
        Ok(())
    );
    assert_eq!(
        evaluate_network_block_contract("zero-attempts", &declared_origins, None, &stages),
        Err(LocalCanaryFailure::AttributionLedgerMissing)
    );
}

#[test]
fn simulated_unpermitted_remote_attempt_is_blocked_attributed_and_fails_canary() {
    let connector = DenyAllConnector::default();
    let ledger = OutboundLedger::new("blocked-remote", 4, Instant::now())
        .expect("blocked-attempt ledger");
    let expected_remote = remote_route();
    let actual_local = loopback_route();

    let dispatch = authorize_and_record_dispatch(
        &ledger,
        Some("meeting-blocked-remote"),
        &expected_remote,
        &actual_local,
        || connector.dispatch(),
    );
    assert!(dispatch.is_err(), "materially changed remote route must be blocked");
    assert_eq!(connector.attempts(), 0, "blocked work must not reach a connector");

    let snapshot = ledger.snapshot();
    assert_eq!(snapshot.attempts.len(), 1, "blocked intent must be attributed");
    assert_eq!(snapshot.attempts[0].disposition, OutboundDisposition::Blocked);
    assert_eq!(snapshot.attempts[0].route.sanitized_origin, "https://203.0.113.9");
    assert_eq!(
        evaluate_network_block_contract(
            "blocked-remote",
            &BTreeSet::new(),
            Some(&snapshot),
            &all_local_stages(),
        ),
        Err(LocalCanaryFailure::UnpermittedAttempt { sequence: 0 })
    );

    let declared_origins = BTreeSet::from(["https://203.0.113.9".to_string()]);
    assert_eq!(
        evaluate_network_block_contract(
            "blocked-remote",
            &declared_origins,
            Some(&snapshot),
            &all_local_stages(),
        ),
        Ok(()),
        "a reviewed destination is attributable rather than undisclosed"
    );
}
