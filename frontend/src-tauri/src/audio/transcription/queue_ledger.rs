//! Per-meeting accounting for transcription work.
//!
//! The ledger is deliberately content-free: it retains work IDs, monotonic
//! timestamps, and typed outcomes, but never audio or transcript text. Counts
//! in [`QueueSnapshot`] are derived from the authoritative work records so
//! conservation cannot drift from separately maintained counters.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
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
    MeetingIdConflict(String),
    DuplicateWorkId(String),
    UnknownWorkId(String),
    AlreadyStarted(String),
    AlreadyTerminal(String),
    TimestampBeforeAdmission(String),
    SequenceExhausted,
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
    state: Mutex<QueueLedgerState>,
}

#[derive(Debug, Default)]
struct QueueLedgerState {
    next_event_sequence: u64,
    work: Vec<QueueWorkRecord>,
    gaps: Vec<QueueGap>,
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
            state: Mutex::new(QueueLedgerState::default()),
        })
    }

    pub fn meeting_id(&self) -> &str {
        &self.meeting_id
    }

    pub fn accept(
        &self,
        work_id: impl Into<String>,
        accepted_at: Instant,
    ) -> Result<u64, QueueTransitionError> {
        let work_id = validate_work_id(work_id.into())?;
        let mut state = self.lock_state();
        ensure_new_work_id(&state, &work_id)?;
        let event_sequence = next_event_sequence(&mut state)?;
        state.work.push(QueueWorkRecord {
            work_id,
            event_sequence,
            accepted_at,
            started_at: None,
            terminal_at: None,
            outcome: None,
        });
        Ok(event_sequence)
    }

    pub fn start(&self, work_id: &str, started_at: Instant) -> Result<(), QueueTransitionError> {
        let mut state = self.lock_state();
        let record = find_work_mut(&mut state, work_id)?;
        if record.outcome.is_some() {
            return Err(QueueTransitionError::AlreadyTerminal(work_id.to_string()));
        }
        if record.started_at.is_some() {
            return Err(QueueTransitionError::AlreadyStarted(work_id.to_string()));
        }
        if started_at < record.accepted_at {
            return Err(QueueTransitionError::TimestampBeforeAdmission(
                work_id.to_string(),
            ));
        }
        record.started_at = Some(started_at);
        Ok(())
    }

    pub fn finish(
        &self,
        work_id: &str,
        outcome: WorkOutcome,
        terminal_at: Instant,
    ) -> Result<(), QueueTransitionError> {
        let mut state = self.lock_state();
        let record = find_work_mut(&mut state, work_id)?;
        if record.outcome.is_some() {
            return Err(QueueTransitionError::AlreadyTerminal(work_id.to_string()));
        }
        let earliest = record.started_at.unwrap_or(record.accepted_at);
        if terminal_at < earliest {
            return Err(QueueTransitionError::TimestampBeforeAdmission(
                work_id.to_string(),
            ));
        }
        record.terminal_at = Some(terminal_at);
        record.outcome = Some(outcome);
        Ok(())
    }

    pub fn reject(
        &self,
        work_id: impl Into<String>,
        reason: RejectionReason,
        rejected_at: Instant,
    ) -> Result<u64, QueueTransitionError> {
        let work_id = validate_work_id(work_id.into())?;
        let mut state = self.lock_state();
        ensure_new_work_id(&state, &work_id)?;
        let event_sequence = next_event_sequence(&mut state)?;
        state.gaps.push(QueueGap {
            work_id,
            event_sequence,
            rejected_at,
            reason,
        });
        Ok(event_sequence)
    }

    pub fn snapshot(&self, now: Instant) -> QueueSnapshot {
        let state = self.lock_state();
        let mut snapshot = QueueSnapshot {
            capacity: self.capacity,
            depth: 0,
            active: 0,
            oldest_age_ms: None,
            accepted: state.work.len() as u64,
            started: 0,
            completed: 0,
            failed: 0,
            cancelled: 0,
            superseded: 0,
            rejected: state.gaps.len() as u64,
        };
        let mut oldest_accepted_at = None;

        for record in &state.work {
            if record.started_at.is_some() {
                snapshot.started += 1;
            }
            match record.outcome {
                Some(WorkOutcome::Completed) => snapshot.completed += 1,
                Some(WorkOutcome::Failed(_)) => snapshot.failed += 1,
                Some(WorkOutcome::Cancelled(_)) => snapshot.cancelled += 1,
                Some(WorkOutcome::Superseded(_)) => snapshot.superseded += 1,
                None => {
                    snapshot.depth += 1;
                    if record.started_at.is_some() {
                        snapshot.active += 1;
                    }
                    oldest_accepted_at = match oldest_accepted_at {
                        Some(oldest) if oldest <= record.accepted_at => Some(oldest),
                        _ => Some(record.accepted_at),
                    };
                }
            }
        }

        snapshot.oldest_age_ms = oldest_accepted_at.map(|accepted_at| {
            now.saturating_duration_since(accepted_at)
                .as_millis()
                .min(u64::MAX as u128) as u64
        });
        debug_assert_eq!(
            snapshot.accepted,
            snapshot.depth
                + snapshot.completed
                + snapshot.failed
                + snapshot.cancelled
                + snapshot.superseded
        );
        snapshot
    }

    pub fn work_records(&self) -> Vec<QueueWorkRecord> {
        self.lock_state().work.clone()
    }

    pub fn gaps(&self) -> Vec<QueueGap> {
        self.lock_state().gaps.clone()
    }

    fn lock_state(&self) -> std::sync::MutexGuard<'_, QueueLedgerState> {
        self.state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

fn validate_work_id(work_id: String) -> Result<String, QueueTransitionError> {
    if work_id.trim().is_empty() {
        Err(QueueTransitionError::InvalidWorkId)
    } else {
        Ok(work_id)
    }
}

fn ensure_new_work_id(state: &QueueLedgerState, work_id: &str) -> Result<(), QueueTransitionError> {
    if state.work.iter().any(|record| record.work_id == work_id)
        || state.gaps.iter().any(|gap| gap.work_id == work_id)
    {
        Err(QueueTransitionError::DuplicateWorkId(work_id.to_string()))
    } else {
        Ok(())
    }
}

fn next_event_sequence(state: &mut QueueLedgerState) -> Result<u64, QueueTransitionError> {
    let sequence = state.next_event_sequence;
    state.next_event_sequence = state
        .next_event_sequence
        .checked_add(1)
        .ok_or(QueueTransitionError::SequenceExhausted)?;
    Ok(sequence)
}

fn find_work_mut<'a>(
    state: &'a mut QueueLedgerState,
    work_id: &str,
) -> Result<&'a mut QueueWorkRecord, QueueTransitionError> {
    state
        .work
        .iter_mut()
        .find(|record| record.work_id == work_id)
        .ok_or_else(|| QueueTransitionError::UnknownWorkId(work_id.to_string()))
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
