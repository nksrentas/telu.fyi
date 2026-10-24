-- Phase 3 candidate questions: stored beside briefing statements with a rationale, cited and verified the same way.
ALTER TABLE briefing_claims ADD COLUMN kind TEXT NOT NULL DEFAULT 'statement'
    CHECK (kind IN ('statement', 'question'));
ALTER TABLE briefing_claims ADD COLUMN rationale TEXT;
ALTER TABLE briefings ADD COLUMN dropped_question_count INTEGER NOT NULL DEFAULT 0
    CHECK (dropped_question_count >= 0);
