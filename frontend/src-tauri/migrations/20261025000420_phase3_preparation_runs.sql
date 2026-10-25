-- Phase 3 preparation runs: one briefing generation attempt for a planned meeting.
-- At most one run is 'running' per planned meeting; a stale run stores no briefing.
CREATE TABLE preparation_runs (
    id TEXT PRIMARY KEY,
    planned_meeting_id TEXT NOT NULL REFERENCES planned_meetings(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled', 'stale')),
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    location_class TEXT NOT NULL CHECK (location_class IN ('local', 'lan', 'remote')),
    sanitized_origin TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    briefing_id TEXT REFERENCES briefings(id) ON DELETE SET NULL,
    failure_code TEXT,
    started_utc TEXT NOT NULL,
    finished_utc TEXT,
    CHECK ((status = 'running') = (finished_utc IS NULL)),
    CHECK (briefing_id IS NULL OR status = 'completed')
);

CREATE INDEX idx_preparation_runs_planned_meeting ON preparation_runs(planned_meeting_id, started_utc);

CREATE UNIQUE INDEX idx_preparation_runs_one_running
    ON preparation_runs(planned_meeting_id) WHERE status = 'running';
