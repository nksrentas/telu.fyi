CREATE TABLE knowledge_runs (
    run_id TEXT PRIMARY KEY NOT NULL,
    meeting_id TEXT NOT NULL REFERENCES meetings(id),
    trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('auto', 'user', 'regenerate')),
    status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'cancelled')),
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    location_class TEXT NOT NULL CHECK (location_class IN ('local', 'lan', 'remote')),
    sanitized_origin TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    meeting_completeness_at_start TEXT NOT NULL,
    input_evidence_count INTEGER NOT NULL CHECK (input_evidence_count >= 0),
    input_fingerprint TEXT NOT NULL,
    proposed_count INTEGER NOT NULL DEFAULT 0 CHECK (proposed_count >= 0),
    skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
    suppressed_count INTEGER NOT NULL DEFAULT 0 CHECK (suppressed_count >= 0),
    reconfirmed_count INTEGER NOT NULL DEFAULT 0 CHECK (reconfirmed_count >= 0),
    failure_code TEXT,
    started_at_utc TEXT NOT NULL,
    finished_at_utc TEXT
);

CREATE TRIGGER knowledge_runs_frozen
BEFORE UPDATE ON knowledge_runs
WHEN OLD.status <> 'running'
BEGIN
    SELECT RAISE(ABORT, 'knowledge_runs row is final');
END;

CREATE UNIQUE INDEX idx_knowledge_runs_one_running
    ON knowledge_runs (meeting_id)
    WHERE status = 'running';

CREATE INDEX idx_knowledge_runs_meeting_started
    ON knowledge_runs (meeting_id, started_at_utc);

CREATE TABLE knowledge_items (
    item_id TEXT PRIMARY KEY NOT NULL,
    meeting_id TEXT NOT NULL REFERENCES meetings(id),
    origin_run_id TEXT NOT NULL REFERENCES knowledge_runs(run_id),
    item_type TEXT NOT NULL CHECK (item_type IN ('decision', 'commitment', 'question', 'fact')),
    text TEXT NOT NULL CHECK (length(trim(text)) > 0),
    owner_text TEXT,
    owner_support TEXT NOT NULL CHECK (owner_support IN ('stated', 'not_stated')),
    due_text TEXT,
    due_support TEXT NOT NULL CHECK (due_support IN ('stated', 'not_stated')),
    normalized_key TEXT NOT NULL,
    created_at_utc TEXT NOT NULL
);

CREATE TRIGGER knowledge_items_immutable
BEFORE UPDATE ON knowledge_items
BEGIN
    SELECT RAISE(ABORT, 'knowledge_items is append-only');
END;

CREATE INDEX idx_knowledge_items_meeting
    ON knowledge_items (meeting_id);

CREATE TABLE knowledge_evidence_links (
    link_id TEXT PRIMARY KEY NOT NULL,
    meeting_id TEXT NOT NULL REFERENCES meetings(id),
    item_id TEXT NOT NULL REFERENCES knowledge_items(item_id),
    evidence_id TEXT NOT NULL REFERENCES transcript_evidence(evidence_id),
    role TEXT NOT NULL CHECK (role IN ('claim', 'owner', 'due')),
    quote_text TEXT NOT NULL,
    normalized_quote TEXT NOT NULL,
    raw_start INTEGER NOT NULL CHECK (raw_start >= 0),
    raw_end INTEGER NOT NULL CHECK (raw_end > raw_start),
    evidence_text_sha256 TEXT NOT NULL,
    segment_capture_incomplete INTEGER NOT NULL CHECK (segment_capture_incomplete IN (0, 1)),
    created_at_utc TEXT NOT NULL
);

CREATE TRIGGER knowledge_evidence_links_immutable
BEFORE UPDATE ON knowledge_evidence_links
BEGIN
    SELECT RAISE(ABORT, 'knowledge_evidence_links is append-only');
END;

CREATE INDEX idx_knowledge_evidence_links_item
    ON knowledge_evidence_links (item_id);

CREATE INDEX idx_knowledge_evidence_links_evidence
    ON knowledge_evidence_links (evidence_id);

CREATE TABLE knowledge_abstentions (
    abstention_id TEXT PRIMARY KEY NOT NULL,
    meeting_id TEXT NOT NULL REFERENCES meetings(id),
    run_id TEXT NOT NULL REFERENCES knowledge_runs(run_id),
    reason_code TEXT NOT NULL CHECK (reason_code IN (
        'unknown_segment',
        'quote_not_found',
        'quote_too_short',
        'empty_text',
        'invalid_type',
        'malformed_item'
    )),
    candidate_type TEXT,
    created_at_utc TEXT NOT NULL
);

CREATE TRIGGER knowledge_abstentions_immutable
BEFORE UPDATE ON knowledge_abstentions
BEGIN
    SELECT RAISE(ABORT, 'knowledge_abstentions is append-only');
END;

CREATE INDEX idx_knowledge_abstentions_run
    ON knowledge_abstentions (run_id);
