-- Phase 3 sources: a document owns immutable versions; a version owns its passages.
CREATE TABLE documents (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    format TEXT NOT NULL CHECK (format IN ('text', 'markdown')),
    availability TEXT NOT NULL DEFAULT 'available' CHECK (availability IN ('available', 'deleted')),
    created_utc TEXT NOT NULL
);

CREATE TABLE document_versions (
    id TEXT PRIMARY KEY NOT NULL,
    document_id TEXT NOT NULL REFERENCES documents(id),
    version INTEGER NOT NULL CHECK (version > 0),
    sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
    byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
    char_count INTEGER NOT NULL CHECK (char_count >= 0),
    parser_version TEXT NOT NULL,
    extraction_status TEXT NOT NULL CHECK (extraction_status IN ('pending', 'extracted', 'failed')),
    failure_code TEXT,
    managed_path TEXT,
    created_utc TEXT NOT NULL,
    UNIQUE (document_id, sha256),
    UNIQUE (document_id, version)
);

CREATE TRIGGER document_versions_content_frozen
BEFORE UPDATE OF sha256, byte_size ON document_versions
WHEN NEW.sha256 IS NOT OLD.sha256 OR NEW.byte_size IS NOT OLD.byte_size
BEGIN
    SELECT RAISE(ABORT, 'document_versions content is frozen');
END;

CREATE TABLE document_passages (
    id TEXT PRIMARY KEY NOT NULL,
    version_id TEXT NOT NULL REFERENCES document_versions(id),
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    locator_json TEXT NOT NULL CHECK (json_valid(locator_json)),
    text TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    UNIQUE (version_id, ordinal)
);

CREATE TRIGGER document_passages_text_frozen
BEFORE UPDATE OF text, content_hash ON document_passages
WHEN NEW.text IS NOT OLD.text OR NEW.content_hash IS NOT OLD.content_hash
BEGIN
    SELECT RAISE(ABORT, 'document_passages text is frozen');
END;
