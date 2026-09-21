//! Bounded, content-free stage observations for one meeting run.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tokio::sync::mpsc;
use uuid::Uuid;

pub const STAGE_SCHEMA_VERSION: u16 = 1;
pub const DEFAULT_STAGE_CHANNEL_CAPACITY: usize = 1_024;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StageName {
    AudioCaptured,
    SegmentBoundary,
    TranscriptionEnqueued,
    TranscriptionStarted,
    FinalTranscriptProduced,
    FinalTranscriptPersisted,
    UiAcknowledged,
    ContextSelection,
    GenerationStarted,
    GenerationCancelled,
    Superseded,
    SuggestionVisible,
}

impl StageName {
    pub fn is_phase1(self) -> bool {
        matches!(
            self,
            Self::AudioCaptured
                | Self::SegmentBoundary
                | Self::TranscriptionEnqueued
                | Self::TranscriptionStarted
                | Self::FinalTranscriptProduced
                | Self::FinalTranscriptPersisted
                | Self::UiAcknowledged
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StageIdentity {
    pub work_id: String,
    pub evidence_id: String,
}

impl StageIdentity {
    pub fn new(work_id: impl Into<String>, evidence_id: impl Into<String>) -> Self {
        Self {
            work_id: work_id.into(),
            evidence_id: evidence_id.into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StageRecord {
    pub schema_version: u16,
    pub sequence: u64,
    pub run_id: String,
    pub meeting_id: String,
    pub work_id: String,
    pub evidence_id: String,
    pub stage: StageName,
    pub offset_micros: u64,
    pub observed_at_utc: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StageAdmission {
    Accepted,
    Overflow,
    Closed,
    ReservedFutureStage,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StageChannelSnapshot {
    pub capacity: usize,
    pub pending: usize,
    pub overflowed: u64,
}

#[derive(Debug)]
pub struct StageClock {
    run_id: String,
    meeting_id: String,
    origin: Instant,
    started_at_utc: DateTime<Utc>,
    capacity: usize,
    next_sequence: AtomicU64,
    overflowed: AtomicU64,
    sender: mpsc::Sender<StageRecord>,
    receiver: Mutex<mpsc::Receiver<StageRecord>>,
}

impl StageClock {
    pub fn new(meeting_id: impl Into<String>, capacity: usize) -> Arc<Self> {
        Self::new_at(
            Uuid::new_v4().to_string(),
            meeting_id,
            capacity,
            Instant::now(),
            Utc::now(),
        )
    }

    pub fn new_at(
        run_id: impl Into<String>,
        meeting_id: impl Into<String>,
        capacity: usize,
        origin: Instant,
        started_at_utc: DateTime<Utc>,
    ) -> Arc<Self> {
        let (sender, receiver) = mpsc::channel(capacity.max(1));
        Arc::new(Self {
            run_id: run_id.into(),
            meeting_id: meeting_id.into(),
            origin,
            started_at_utc,
            capacity: capacity.max(1),
            next_sequence: AtomicU64::new(0),
            overflowed: AtomicU64::new(0),
            sender,
            receiver: Mutex::new(receiver),
        })
    }

    pub fn run_id(&self) -> &str {
        &self.run_id
    }

    pub fn meeting_id(&self) -> &str {
        &self.meeting_id
    }

    pub fn started_at_utc(&self) -> DateTime<Utc> {
        self.started_at_utc
    }

    pub fn try_record(&self, stage: StageName, identity: &StageIdentity) -> StageAdmission {
        self.try_record_at(stage, identity, Instant::now(), Utc::now())
    }

    pub fn try_record_at(
        &self,
        stage: StageName,
        identity: &StageIdentity,
        observed_at: Instant,
        observed_at_utc: DateTime<Utc>,
    ) -> StageAdmission {
        if !stage.is_phase1() {
            return StageAdmission::ReservedFutureStage;
        }

        let sequence = self.next_sequence.fetch_add(1, Ordering::Relaxed);
        let record = StageRecord {
            schema_version: STAGE_SCHEMA_VERSION,
            sequence,
            run_id: self.run_id.clone(),
            meeting_id: self.meeting_id.clone(),
            work_id: identity.work_id.clone(),
            evidence_id: identity.evidence_id.clone(),
            stage,
            offset_micros: self.offset_micros_at(observed_at),
            observed_at_utc,
        };

        match self.sender.try_send(record) {
            Ok(()) => StageAdmission::Accepted,
            Err(mpsc::error::TrySendError::Full(_)) => {
                self.overflowed.fetch_add(1, Ordering::Relaxed);
                StageAdmission::Overflow
            }
            Err(mpsc::error::TrySendError::Closed(_)) => StageAdmission::Closed,
        }
    }

    pub fn offset_micros_at(&self, observed_at: Instant) -> u64 {
        observed_at
            .saturating_duration_since(self.origin)
            .as_micros()
            .min(u64::MAX as u128) as u64
    }

    pub fn drain(&self) -> Vec<StageRecord> {
        let mut receiver = self
            .receiver
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let mut records = Vec::new();
        while let Ok(record) = receiver.try_recv() {
            records.push(record);
        }
        records
    }

    pub fn snapshot(&self) -> StageChannelSnapshot {
        StageChannelSnapshot {
            capacity: self.capacity,
            pending: self.capacity.saturating_sub(self.sender.capacity()),
            overflowed: self.overflowed.load(Ordering::Relaxed),
        }
    }
}

#[cfg(test)]
mod observability_stage_tests {
    use super::*;
    use chrono::Duration as ChronoDuration;
    use std::time::Duration;

    fn identity() -> StageIdentity {
        StageIdentity::new("work-7", "11111111-1111-4111-8111-111111111111")
    }

    #[test]
    fn observability_stage_uses_one_monotonic_origin_despite_utc_jump() {
        let origin = Instant::now();
        let utc = Utc::now();
        let clock = StageClock::new_at("run-1", "meeting-1", 8, origin, utc);
        let identity = identity();

        assert_eq!(
            clock.try_record_at(
                StageName::AudioCaptured,
                &identity,
                origin + Duration::from_millis(10),
                utc + ChronoDuration::hours(12),
            ),
            StageAdmission::Accepted
        );
        assert_eq!(
            clock.try_record_at(
                StageName::UiAcknowledged,
                &identity,
                origin + Duration::from_millis(35),
                utc - ChronoDuration::hours(12),
            ),
            StageAdmission::Accepted
        );

        let records = clock.drain();
        assert_eq!(records[0].offset_micros, 10_000);
        assert_eq!(records[1].offset_micros, 35_000);
        assert_eq!(records[1].offset_micros - records[0].offset_micros, 25_000);
    }

    #[test]
    fn observability_stage_preserves_complete_phase1_order_and_correlation() {
        let origin = Instant::now();
        let clock = StageClock::new_at("run-1", "meeting-1", 16, origin, Utc::now());
        let identity = identity();
        let stages = [
            StageName::AudioCaptured,
            StageName::SegmentBoundary,
            StageName::TranscriptionEnqueued,
            StageName::TranscriptionStarted,
            StageName::FinalTranscriptProduced,
            StageName::FinalTranscriptPersisted,
            StageName::UiAcknowledged,
        ];

        for (index, stage) in stages.into_iter().enumerate() {
            assert_eq!(
                clock.try_record_at(
                    stage,
                    &identity,
                    origin + Duration::from_micros(index as u64 + 1),
                    Utc::now(),
                ),
                StageAdmission::Accepted
            );
        }

        let records = clock.drain();
        assert_eq!(records.len(), stages.len());
        for (index, record) in records.iter().enumerate() {
            assert_eq!(record.sequence, index as u64);
            assert_eq!(record.run_id, "run-1");
            assert_eq!(record.meeting_id, "meeting-1");
            assert_eq!(record.work_id, identity.work_id);
            assert_eq!(record.evidence_id, identity.evidence_id);
            assert_eq!(record.stage, stages[index]);
        }
    }

    #[test]
    fn observability_stage_rejects_reserved_future_stages_in_phase1() {
        let clock = StageClock::new("meeting-1", 4);
        for stage in [
            StageName::ContextSelection,
            StageName::GenerationStarted,
            StageName::GenerationCancelled,
            StageName::Superseded,
            StageName::SuggestionVisible,
        ] {
            assert_eq!(
                clock.try_record(stage, &identity()),
                StageAdmission::ReservedFutureStage
            );
        }
        assert!(clock.drain().is_empty());
    }

    #[test]
    fn observability_stage_hot_admission_is_bounded_and_overflow_explicit() {
        let clock = StageClock::new("meeting-1", 1);
        let identity = identity();
        assert_eq!(
            clock.try_record(StageName::AudioCaptured, &identity),
            StageAdmission::Accepted
        );
        assert_eq!(
            clock.try_record(StageName::SegmentBoundary, &identity),
            StageAdmission::Overflow
        );
        assert_eq!(clock.snapshot().capacity, 1);
        assert_eq!(clock.snapshot().pending, 1);
        assert_eq!(clock.snapshot().overflowed, 1);
    }

    #[test]
    fn observability_stage_actual_phase1_seams_are_wired_and_content_redacted() {
        let pipeline = include_str!("../audio/pipeline.rs");
        let worker = include_str!("../audio/transcription/worker.rs");
        let commands = include_str!("../audio/recording_commands.rs");

        assert!(pipeline.contains("StageName::AudioCaptured"));
        assert!(pipeline.contains("StageName::SegmentBoundary"));
        assert!(pipeline.contains("StageName::TranscriptionEnqueued"));
        assert!(worker.contains("StageName::TranscriptionStarted"));
        assert!(worker.contains("StageName::FinalTranscriptProduced"));
        assert!(worker.contains("StageName::FinalTranscriptPersisted"));
        assert!(commands.contains("StageName::UiAcknowledged"));

        let clock = StageClock::new("meeting-1", 2);
        assert_eq!(
            clock.try_record(StageName::AudioCaptured, &identity()),
            StageAdmission::Accepted
        );
        let json = serde_json::to_string(&clock.drain()[0]).expect("serialize stage record");
        for forbidden in ["transcript", "audio_data", "api_key", "secret", "token"] {
            assert!(
                !json.contains(forbidden),
                "stage record must not contain content-bearing field {forbidden}"
            );
        }
    }
}
