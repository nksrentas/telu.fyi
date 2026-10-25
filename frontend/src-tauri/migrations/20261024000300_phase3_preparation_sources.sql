-- Phase 3 preparation: the user's explicit, ordered selection of sources for a planned meeting.
-- A document entry pins one immutable version; a knowledge entry names an item of a past meeting.
CREATE TABLE preparation_sources (
    planned_meeting_id TEXT NOT NULL REFERENCES planned_meetings(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position >= 0),
    kind TEXT NOT NULL CHECK (kind IN ('document', 'knowledge')),
    document_version_id TEXT REFERENCES document_versions(id),
    meeting_id TEXT,
    knowledge_item_id TEXT,
    PRIMARY KEY (planned_meeting_id, position),
    UNIQUE (planned_meeting_id, document_version_id),
    UNIQUE (planned_meeting_id, knowledge_item_id),
    CHECK (
        (kind = 'document' AND document_version_id IS NOT NULL
            AND meeting_id IS NULL AND knowledge_item_id IS NULL)
        OR (kind = 'knowledge' AND document_version_id IS NULL
            AND meeting_id IS NOT NULL AND knowledge_item_id IS NOT NULL)
    )
);
