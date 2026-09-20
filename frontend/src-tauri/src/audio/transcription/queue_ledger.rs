//! Per-meeting accounting for transcription work.
//!
//! The public contract is introduced with behavior-first tests below. The
//! initial implementation deliberately exposes only an empty snapshot so the
//! RED commit records the missing conservation behavior without relying on a
//! compiler or fixture failure.

use serde::{Deserialize, Serialize};
use std::time::Instant;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkFailureReason {
    ModelUnavailable,
    TranscriptionFailed,
    EvidencePersistenceFailed,
    DispatchClosed,
    WorkerPanicked,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkCancellationReason {
    Shutdown,
    Deadline,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SupersessionReason {
    NewerWork,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "outcome", content = "reason")]
pub enum WorkOutcome {
    Completed,
    Failed(WorkFailureReason),
    Cancelled(WorkCancellationReason),
    Superseded(SupersessionReason),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RejectionReason {
    Capacity,
    Closed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum QueueTransitionError {
    InvalidCapacity,
    InvalidMeetingId,
    InvalidWorkId,
    DuplicateWorkId(String),
    UnknownWorkId(String),
    AlreadyStarted(String),
    AlreadyTerminal(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct QueueSnapshot {
    pub capacity: usize,
    pub depth: u64,
    pub active: u64,
    pub oldest_age_ms: Option<u64>,
    pub accepted: u64,
    pub started: u64,
    pub completed: u64,
    pub failed: u64,
    pub cancelled: u64,
    pub superseded: u64,
    pub rejected: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QueueWorkRecord {
    pub work_id: String,
    pub event_sequence: u64,
    pub accepted_at: Instant,
    pub started_at: Option<Instant>,
    pub terminal_at: Option<Instant>,
    pub outcome: Option<WorkOutcome>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QueueGap {
    pub work_id: String,
    pub event_sequence: u64,
    pub rejected_at: Instant,
    pub reason: RejectionReason,
}

#[derive(Debug)]
pub struct QueueLedger {
    meeting_id: String,
    capacity: usize,
}

impl QueueLedger {
    pub fn new(
        meeting_id: impl Into<String>,
        capacity: usize,
    ) -> Result<Self, QueueTransitionError> {
        let meeting_id = meeting_id.into();
        if meeting_id.trim().is_empty() {
            return Err(QueueTransitionError::InvalidMeetingId);
        }
        if capacity == 0 {
            return Err(QueueTransitionError::InvalidCapacity);
        }
        Ok(Self {
            meeting_id,
            capacity,
        })
    }

    pub fn meeting_id(&self) -> &str {
        &self.meeting_id
    }

    pub fn accept(
        &self,
        _work_id: impl Into<String>,
        _accepted_at: Instant,
    ) -> Result<u64, QueueTransitionError> {
        Ok(0)
    }

    pub fn start(
        &self,
        _work_id: &str,
        _started_at: Instant,
    ) -> Result<(), QueueTransitionError> {
        Ok(())
    }

    pub fn finish(
        &self,
        _work_id: &str,
        _outcome: WorkOutcome,
        _terminal_at: Instant,
    ) -> Result<(), QueueTransitionError> {
        Ok(())
    }

    pub fn reject(
        &self,
        _work_id: impl Into<String>,
        _reason: RejectionReason,
        _rejected_at: Instant,
    ) -> Result<u64, QueueTransitionError> {
        Ok(0)
    }

    pub fn snapshot(&self, _now: Instant) -> QueueSnapshot {
        QueueSnapshot {
            capacity: self.capacity,
            depth: 0,
            active: 0,
            oldest_age_ms: None,
            accepted: 0,
            started: 0,
            completed: 0,
            failed: 0,
            cancelled: 0,
            superseded: 0,
            rejected: 0,
        }
    }

    pub fn work_records(&self) -> Vec<QueueWorkRecord> {
        Vec::new()
    }

    pub fn gaps(&self) -> Vec<QueueGap> {
        Vec::new()
    }
}

#[cfg(test)]
mod queue_ledger_tests {
    use super::*;
    use std::time::Duration;

    fn ledger() -> QueueLedger {
        QueueLedger::new("018f5e27-2f68-7e27-9c90-7c72123141ae", 4)
            .expect("valid per-meeting ledger")
    }

    #[test]
    fn queue_ledger_conserves_accepted_work_and_rejects_conflicting_terminal_outcomes() {
        let ledger = ledger();
        let admitted = Instant::now();
        let outcomes = [
            ("completed", WorkOutcome::Completed),
            (
                "failed",
                WorkOutcome::Failed(WorkFailureReason::TranscriptionFailed),
            ),
            (
                "cancelled",
                WorkOutcome::Cancelled(WorkCancellationReason::Shutdown),
            ),
            (
                "superseded",
                WorkOutcome::Superseded(SupersessionReason::NewerWork),
            ),
        ];

        for (index, (work_id, outcome)) in outcomes.into_iter().enumerate() {
            ledger.accept(work_id, admitted).expect("accepted work");
            ledger
                .start(work_id, admitted + Duration::from_millis(index as u64 + 1))
                .expect("started work");
            ledger
                .finish(
                    work_id,
                    outcome,
                    admitted + Duration::from_millis(index as u64 + 10),
                )
                .expect("terminal work");
        }

        let snapshot = ledger.snapshot(admitted + Duration::from_secs(1));
        assert_eq!(snapshot.accepted, 4);
        assert_eq!(snapshot.started, 4);
        assert_eq!(snapshot.depth, 0);
        assert_eq!(snapshot.active, 0);
        assert_eq!(snapshot.completed, 1);
        assert_eq!(snapshot.failed, 1);
        assert_eq!(snapshot.cancelled, 1);
        assert_eq!(snapshot.superseded, 1);
        assert_eq!(
            snapshot.accepted,
            snapshot.depth
                + snapshot.completed
                + snapshot.failed
                + snapshot.cancelled
                + snapshot.superseded
        );
        assert_eq!(snapshot.rejected, 0);

        assert_eq!(
            ledger.finish(
                "completed",
                WorkOutcome::Failed(WorkFailureReason::TranscriptionFailed),
                admitted + Duration::from_secs(2),
            ),
            Err(QueueTransitionError::AlreadyTerminal(
                "completed".to_string()
            ))
        );
    }

    #[test]
    fn queue_ledger_depth_and_oldest_age_cover_only_nonterminal_work() {
        let ledger = ledger();
        let empty_at = Instant::now();
        let empty = ledger.snapshot(empty_at);
        assert_eq!(empty.depth, 0);
        assert_eq!(empty.active, 0);
        assert_eq!(empty.oldest_age_ms, None);
        assert_eq!(empty.accepted, 0);

        ledger.accept("queued", empty_at).expect("queued work");
        ledger.accept("active", empty_at).expect("active work");
        ledger
            .start("active", empty_at + Duration::from_millis(20))
            .expect("start active work");

        let pending = ledger.snapshot(empty_at + Duration::from_millis(125));
        assert_eq!(pending.depth, 2);
        assert_eq!(pending.active, 1);
        assert_eq!(pending.oldest_age_ms, Some(125));

        ledger
            .finish(
                "queued",
                WorkOutcome::Failed(WorkFailureReason::DispatchClosed),
                empty_at + Duration::from_millis(150),
            )
            .expect("queued work can fail before start");
        ledger
            .finish(
                "active",
                WorkOutcome::Completed,
                empty_at + Duration::from_millis(175),
            )
            .expect("active work completed");

        let terminal = ledger.snapshot(empty_at + Duration::from_millis(200));
        assert_eq!(terminal.depth, 0);
        assert_eq!(terminal.active, 0);
        assert_eq!(terminal.oldest_age_ms, None);
        assert_eq!(terminal.completed, 1);
        assert_eq!(terminal.failed, 1);
    }

    #[test]
    fn queue_ledger_equal_time_admissions_keep_distinct_ids_and_stable_order() {
        let ledger = ledger();
        let same_instant = Instant::now();

        let first_sequence = ledger
            .accept("work-b", same_instant)
            .expect("first equal-time work");
        let second_sequence = ledger
            .accept("work-a", same_instant)
            .expect("second equal-time work");

        let records = ledger.work_records();
        assert_eq!(first_sequence, 0);
        assert_eq!(second_sequence, 1);
        assert_eq!(records.len(), 2);
        assert_eq!(records[0].work_id, "work-b");
        assert_eq!(records[0].event_sequence, first_sequence);
        assert_eq!(records[1].work_id, "work-a");
        assert_eq!(records[1].event_sequence, second_sequence);
        assert_ne!(records[0].work_id, records[1].work_id);
    }
}
