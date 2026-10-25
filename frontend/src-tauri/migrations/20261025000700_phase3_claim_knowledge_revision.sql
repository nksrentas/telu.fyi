-- Phase 3 knowledge propagation: the revision of the cited knowledge item when the claim was generated.
ALTER TABLE briefing_claims ADD COLUMN knowledge_revision_id TEXT;
