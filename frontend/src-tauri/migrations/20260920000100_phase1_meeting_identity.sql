-- Phase 1 canonical meeting identity and lifecycle contract.
--
-- Existing rows predate durable lifecycle/completeness evidence. Preserve their
-- IDs and label them conservatively instead of inventing a completed state.
ALTER TABLE meetings
    ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'legacy'
    CHECK (lifecycle IN (
        'preparing',
        'recording',
        'finalizing',
        'complete',
        'incomplete',
        'recovered',
        'legacy'
    ));

ALTER TABLE meetings
    ADD COLUMN completeness TEXT NOT NULL DEFAULT 'completion_not_verified'
    CHECK (completeness IN (
        'pending',
        'complete',
        'incomplete',
        'recovered_with_gaps',
        'completion_not_verified'
    ));

ALTER TABLE meetings
    ADD COLUMN completeness_reason TEXT DEFAULT 'legacy_pre_phase1';

ALTER TABLE meetings
    ADD COLUMN started_at_utc TEXT;
