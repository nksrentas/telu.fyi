-- Versioned, content-redacted local evaluation evidence.
--
-- Product identity remains owned by `meetings` and `transcript_evidence`.
-- Evaluation rows only retain allowlisted identifiers, timings, counts,
-- effective routes, and typed codes. They deliberately have no transcript,
-- audio, secret, request/response body, or sensitive path columns.
CREATE TABLE evaluation_runs (
    run_id TEXT PRIMARY KEY NOT NULL,
    schema_version INTEGER NOT NULL CHECK (schema_version > 0),
    meeting_id TEXT NOT NULL UNIQUE,
    scenario_version TEXT NOT NULL,
    started_at_utc TEXT NOT NULL,
    created_at_utc TEXT NOT NULL,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE TABLE evaluation_stage_records (
    run_id TEXT NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence >= 0),
    schema_version INTEGER NOT NULL CHECK (schema_version > 0),
    meeting_id TEXT NOT NULL,
    work_id TEXT NOT NULL,
    evidence_id TEXT NOT NULL,
    stage_name TEXT NOT NULL,
    observed_offset_micros INTEGER NOT NULL CHECK (observed_offset_micros >= 0),
    observed_at_utc TEXT NOT NULL,
    record_fingerprint TEXT NOT NULL,
    PRIMARY KEY (run_id, sequence),
    FOREIGN KEY (run_id) REFERENCES evaluation_runs(run_id) ON DELETE CASCADE,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE TABLE evaluation_queue_records (
    run_id TEXT NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence >= 0),
    observed_offset_micros INTEGER NOT NULL CHECK (observed_offset_micros >= 0),
    observed_at_utc TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    depth INTEGER NOT NULL CHECK (depth >= 0),
    active INTEGER NOT NULL CHECK (active >= 0),
    oldest_age_ms INTEGER CHECK (oldest_age_ms >= 0),
    accepted INTEGER NOT NULL CHECK (accepted >= 0),
    started INTEGER NOT NULL CHECK (started >= 0),
    completed INTEGER NOT NULL CHECK (completed >= 0),
    failed INTEGER NOT NULL CHECK (failed >= 0),
    cancelled INTEGER NOT NULL CHECK (cancelled >= 0),
    superseded INTEGER NOT NULL CHECK (superseded >= 0),
    rejected INTEGER NOT NULL CHECK (rejected >= 0),
    record_fingerprint TEXT NOT NULL,
    PRIMARY KEY (run_id, sequence),
    FOREIGN KEY (run_id) REFERENCES evaluation_runs(run_id) ON DELETE CASCADE
);

CREATE TABLE evaluation_resource_records (
    run_id TEXT NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence >= 0),
    schema_version INTEGER NOT NULL CHECK (schema_version > 0),
    interval_ms INTEGER NOT NULL CHECK (interval_ms >= 0),
    observed_offset_micros INTEGER NOT NULL CHECK (observed_offset_micros >= 0),
    observed_at_utc TEXT NOT NULL,
    process_cpu_percent REAL NOT NULL CHECK (process_cpu_percent >= 0),
    process_memory_bytes INTEGER NOT NULL CHECK (process_memory_bytes >= 0),
    system_cpu_percent REAL NOT NULL CHECK (system_cpu_percent >= 0),
    system_memory_bytes INTEGER NOT NULL CHECK (system_memory_bytes >= 0),
    system_total_memory_bytes INTEGER CHECK (system_total_memory_bytes >= 0),
    power_collector TEXT NOT NULL,
    power_method TEXT NOT NULL,
    power_source_status TEXT NOT NULL,
    power_source_value TEXT,
    power_source_unknown_reason TEXT,
    battery_status TEXT NOT NULL,
    battery_percent REAL,
    battery_unknown_reason TEXT,
    energy_status TEXT NOT NULL,
    energy_impact REAL,
    energy_unknown_reason TEXT,
    uncertainty TEXT,
    record_fingerprint TEXT NOT NULL,
    PRIMARY KEY (run_id, sequence),
    FOREIGN KEY (run_id) REFERENCES evaluation_runs(run_id) ON DELETE CASCADE
);

CREATE TABLE evaluation_route_records (
    run_id TEXT NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence >= 0),
    meeting_id TEXT NOT NULL,
    observed_offset_micros INTEGER NOT NULL CHECK (observed_offset_micros >= 0),
    observed_at_utc TEXT NOT NULL,
    capability TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    location_class TEXT,
    sanitized_origin TEXT,
    encrypted INTEGER NOT NULL CHECK (encrypted IN (0, 1)),
    validation_state TEXT NOT NULL,
    resolved_addresses TEXT NOT NULL,
    record_fingerprint TEXT NOT NULL,
    PRIMARY KEY (run_id, sequence),
    FOREIGN KEY (run_id) REFERENCES evaluation_runs(run_id) ON DELETE CASCADE,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE TABLE evaluation_outbound_records (
    run_id TEXT NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence >= 0),
    source_run_id TEXT NOT NULL,
    meeting_id TEXT,
    observed_offset_micros INTEGER NOT NULL CHECK (observed_offset_micros >= 0),
    observed_at_utc TEXT NOT NULL,
    capability TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    location_class TEXT NOT NULL,
    sanitized_origin TEXT NOT NULL,
    encrypted INTEGER NOT NULL CHECK (encrypted IN (0, 1)),
    validation_state TEXT NOT NULL,
    resolved_addresses TEXT NOT NULL,
    disposition TEXT NOT NULL,
    redacted_code TEXT,
    record_fingerprint TEXT NOT NULL,
    PRIMARY KEY (run_id, sequence),
    FOREIGN KEY (run_id) REFERENCES evaluation_runs(run_id) ON DELETE CASCADE,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);

CREATE TABLE evaluation_error_records (
    run_id TEXT NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence >= 0),
    observed_offset_micros INTEGER NOT NULL CHECK (observed_offset_micros >= 0),
    observed_at_utc TEXT NOT NULL,
    component TEXT NOT NULL,
    redacted_code TEXT NOT NULL,
    work_id TEXT,
    evidence_id TEXT,
    record_fingerprint TEXT NOT NULL,
    PRIMARY KEY (run_id, sequence),
    FOREIGN KEY (run_id) REFERENCES evaluation_runs(run_id) ON DELETE CASCADE
);

CREATE INDEX idx_evaluation_runs_meeting ON evaluation_runs(meeting_id);
