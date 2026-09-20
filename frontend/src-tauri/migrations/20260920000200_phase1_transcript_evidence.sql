-- Stable, final-only transcript evidence for citation and crash recovery.
-- Partials remain transient UI state and are rejected by the finality check.
CREATE TABLE transcript_evidence (
    evidence_id TEXT PRIMARY KEY NOT NULL,
    meeting_id TEXT NOT NULL,
    source_track TEXT NOT NULL,
    source_segment_key TEXT NOT NULL,
    sequence INTEGER NOT NULL CHECK (sequence >= 0),
    transcript TEXT NOT NULL CHECK (length(trim(transcript)) > 0),
    audio_start_time REAL NOT NULL CHECK (audio_start_time >= 0),
    audio_end_time REAL NOT NULL CHECK (audio_end_time >= audio_start_time),
    is_final INTEGER NOT NULL DEFAULT 1 CHECK (is_final = 1),
    capture_completeness TEXT NOT NULL CHECK (
        capture_completeness IN ('complete', 'incomplete')
    ),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    UNIQUE (meeting_id, source_track, source_segment_key)
);

CREATE INDEX idx_transcript_evidence_meeting_sequence
    ON transcript_evidence (meeting_id, sequence);
