CREATE TABLE knowledge_revisions (
    revision_id TEXT PRIMARY KEY NOT NULL,
    meeting_id TEXT NOT NULL REFERENCES meetings(id),
    item_id TEXT NOT NULL REFERENCES knowledge_items(item_id),
    based_on_revision_id TEXT REFERENCES knowledge_revisions(revision_id),
    text TEXT NOT NULL CHECK (length(trim(text)) BETWEEN 1 AND 400),
    owner_text TEXT CHECK (owner_text IS NULL OR length(owner_text) BETWEEN 1 AND 80),
    due_text TEXT CHECK (due_text IS NULL OR length(due_text) BETWEEN 1 AND 80),
    created_at_utc TEXT NOT NULL
);

CREATE TRIGGER knowledge_revisions_immutable
BEFORE UPDATE ON knowledge_revisions
BEGIN
    SELECT RAISE(ABORT, 'knowledge_revisions is append-only');
END;

CREATE INDEX idx_knowledge_revisions_item
    ON knowledge_revisions (item_id, created_at_utc);

CREATE TABLE knowledge_reviews (
    review_id TEXT PRIMARY KEY NOT NULL,
    meeting_id TEXT NOT NULL REFERENCES meetings(id),
    item_id TEXT NOT NULL REFERENCES knowledge_items(item_id),
    sequence INTEGER NOT NULL CHECK (sequence >= 1),
    action TEXT NOT NULL CHECK (action IN ('accept', 'correct', 'reject', 'restore', 'reopen')),
    revision_id TEXT REFERENCES knowledge_revisions(revision_id),
    created_at_utc TEXT NOT NULL,
    UNIQUE (item_id, sequence),
    CHECK ((action = 'correct') = (revision_id IS NOT NULL))
);

CREATE TRIGGER knowledge_reviews_immutable
BEFORE UPDATE ON knowledge_reviews
BEGIN
    SELECT RAISE(ABORT, 'knowledge_reviews is append-only');
END;

CREATE INDEX idx_knowledge_reviews_meeting
    ON knowledge_reviews (meeting_id);

CREATE VIEW knowledge_item_current AS
SELECT
    i.item_id AS item_id,
    i.meeting_id AS meeting_id,
    i.origin_run_id AS origin_run_id,
    i.item_type AS item_type,
    COALESCE(rv.text, i.text) AS text,
    CASE WHEN rv.revision_id IS NULL THEN i.owner_text ELSE rv.owner_text END AS owner_text,
    CASE WHEN rv.revision_id IS NULL THEN i.due_text ELSE rv.due_text END AS due_text,
    i.owner_text AS original_owner_text,
    i.owner_support AS original_owner_support,
    i.due_text AS original_due_text,
    i.due_support AS original_due_support,
    CASE
        WHEN r.action IN ('accept', 'correct') THEN 'accepted'
        WHEN r.action = 'reject' THEN 'rejected'
        ELSE 'proposed'
    END AS review_state,
    rv.revision_id AS latest_revision_id,
    rv.revision_id IS NOT NULL AS corrected,
    i.created_at_utc AS created_at_utc
FROM knowledge_items i
LEFT JOIN knowledge_reviews r
    ON r.item_id = i.item_id
   AND r.sequence = (SELECT MAX(latest.sequence) FROM knowledge_reviews latest WHERE latest.item_id = i.item_id)
LEFT JOIN knowledge_revisions rv
    ON rv.item_id = i.item_id
   AND NOT EXISTS (
        SELECT 1 FROM knowledge_revisions newer
        WHERE newer.based_on_revision_id = rv.revision_id
   );
