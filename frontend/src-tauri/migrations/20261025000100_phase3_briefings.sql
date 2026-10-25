-- Phase 3 briefings: a generated briefing for a planned meeting and its verified claims.
-- Every claim cites one passage of a document version or one knowledge item, with a verbatim quote.
CREATE TABLE briefings (
    id TEXT PRIMARY KEY,
    planned_meeting_id TEXT NOT NULL REFERENCES planned_meetings(id) ON DELETE CASCADE,
    prompt_version TEXT NOT NULL,
    manifest_json TEXT NOT NULL,
    dropped_count INTEGER NOT NULL CHECK (dropped_count >= 0),
    created_utc TEXT NOT NULL
);

CREATE INDEX idx_briefings_planned_meeting ON briefings(planned_meeting_id, created_utc);

CREATE TABLE briefing_claims (
    id TEXT PRIMARY KEY,
    briefing_id TEXT NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    text TEXT NOT NULL,
    source_ref TEXT NOT NULL,
    source_kind TEXT NOT NULL CHECK (source_kind IN ('document', 'knowledge')),
    document_version_id TEXT REFERENCES document_versions(id),
    passage_id TEXT,
    knowledge_meeting_id TEXT,
    knowledge_item_id TEXT,
    locator_json TEXT CHECK (locator_json IS NULL OR json_valid(locator_json)),
    quote TEXT NOT NULL,
    UNIQUE (briefing_id, ordinal),
    CHECK (
        (source_kind = 'document' AND document_version_id IS NOT NULL AND passage_id IS NOT NULL
            AND locator_json IS NOT NULL AND knowledge_meeting_id IS NULL AND knowledge_item_id IS NULL)
        OR (source_kind = 'knowledge' AND document_version_id IS NULL AND passage_id IS NULL
            AND locator_json IS NULL AND knowledge_meeting_id IS NOT NULL AND knowledge_item_id IS NOT NULL)
    )
);
