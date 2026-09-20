-- Phase 1 durable recording finalization and gap facts.
--
-- One immutable terminal row is retained per canonical meeting. Repeated stop
-- calls return this row instead of replacing an earlier complete/incomplete
-- decision. Gap rows use a natural idempotency key so retries preserve facts
-- without multiplying them.
CREATE TABLE meeting_finalizations (
    meeting_id TEXT PRIMARY KEY NOT NULL,
    lifecycle TEXT NOT NULL CHECK (lifecycle IN ('complete', 'incomplete')),
    queue_capacity INTEGER NOT NULL CHECK (queue_capacity > 0),
    queue_depth INTEGER NOT NULL CHECK (queue_depth >= 0),
    queue_active INTEGER NOT NULL CHECK (queue_active >= 0),
    queue_oldest_age_ms INTEGER CHECK (queue_oldest_age_ms >= 0),
    queue_accepted INTEGER NOT NULL CHECK (queue_accepted >= 0),
    queue_started INTEGER NOT NULL CHECK (queue_started >= 0),
    queue_completed INTEGER NOT NULL CHECK (queue_completed >= 0),
    queue_failed INTEGER NOT NULL CHECK (queue_failed >= 0),
    queue_cancelled INTEGER NOT NULL CHECK (queue_cancelled >= 0),
    queue_superseded INTEGER NOT NULL CHECK (queue_superseded >= 0),
    queue_rejected INTEGER NOT NULL CHECK (queue_rejected >= 0),
    deadline_at_utc TEXT NOT NULL,
    deadline_ms INTEGER NOT NULL CHECK (deadline_ms > 0),
    capture_closed INTEGER NOT NULL CHECK (capture_closed IN (0, 1)),
    durable_writes_succeeded INTEGER NOT NULL CHECK (durable_writes_succeeded IN (0, 1)),
    remaining_work_ids_json TEXT NOT NULL,
    reason_codes_json TEXT NOT NULL,
    gap_count INTEGER NOT NULL CHECK (gap_count >= 0),
    finalized_at_utc TEXT NOT NULL,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE TABLE meeting_finalization_gaps (
    meeting_id TEXT NOT NULL,
    work_id TEXT NOT NULL,
    gap_kind TEXT NOT NULL,
    reason_code TEXT NOT NULL,
    audio_start_ms INTEGER CHECK (audio_start_ms IS NULL OR audio_start_ms >= 0),
    audio_end_ms INTEGER CHECK (
        audio_end_ms IS NULL OR (
            audio_end_ms >= 0 AND
            (audio_start_ms IS NULL OR audio_end_ms >= audio_start_ms)
        )
    ),
    created_at_utc TEXT NOT NULL,
    PRIMARY KEY (meeting_id, work_id, gap_kind, reason_code),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE INDEX idx_meeting_finalization_gaps_meeting
    ON meeting_finalization_gaps (meeting_id, created_at_utc);
