-- Phase 3 delete propagation: a claim whose document was deleted keeps its text but loses its quote.
ALTER TABLE briefing_claims ADD COLUMN status TEXT NOT NULL DEFAULT 'cited'
    CHECK (status IN ('cited', 'source_unavailable'));
