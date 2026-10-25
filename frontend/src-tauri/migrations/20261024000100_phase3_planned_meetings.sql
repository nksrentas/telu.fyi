-- Phase 3 planned meetings: an upcoming conversation the user prepares for.
-- Not linked to a recorded meeting; start_utc is optional (undated plans).
CREATE TABLE planned_meetings (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    start_utc TEXT,
    purpose TEXT NOT NULL DEFAULT '',
    created_utc TEXT NOT NULL,
    updated_utc TEXT NOT NULL
);
