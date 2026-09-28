CREATE TABLE knowledge_suppressions (
    suppression_id TEXT PRIMARY KEY NOT NULL,
    run_id TEXT NOT NULL REFERENCES knowledge_runs(run_id),
    meeting_id TEXT NOT NULL REFERENCES meetings(id),
    matched_item_id TEXT NOT NULL REFERENCES knowledge_items(item_id),
    reason TEXT NOT NULL CHECK (reason IN (
        'matched_rejected',
        'reconfirmed_accepted',
        'duplicate_pending',
        'duplicate_in_run'
    )),
    candidate_normalized_key TEXT NOT NULL,
    candidate_text TEXT NOT NULL CHECK (length(candidate_text) <= 400),
    created_at_utc TEXT NOT NULL
);

CREATE TRIGGER knowledge_suppressions_immutable
BEFORE UPDATE ON knowledge_suppressions
BEGIN
    SELECT RAISE(ABORT, 'knowledge_suppressions is append-only');
END;

CREATE INDEX idx_knowledge_suppressions_meeting
    ON knowledge_suppressions (meeting_id);

ALTER TABLE knowledge_runs ADD COLUMN duplicate_count INTEGER NOT NULL DEFAULT 0;
