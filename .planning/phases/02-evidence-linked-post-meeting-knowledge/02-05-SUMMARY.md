---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 05
subsystem: knowledge
tags: [rust, sqlite, append-only, review, eligibility]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-01/02-03 ledger, evidence links and extraction runs
provides:
  - Append-only knowledge_reviews and knowledge_revisions with a knowledge_item_current projection view
  - Review transitions (accept, correct, reject, restore, reopen) inside BEGIN IMMEDIATE
  - Rust-computed review state, evidence validity, eligibility, field support and unresolved flags
  - KnowledgeRepository::list_eligible_items as the single eligibility read for Phases 3-5
  - Item history, run list and deletion impact reads
  - Commands knowledge_review_item, knowledge_correct_item, knowledge_accept_all, knowledge_item_history, knowledge_list_runs, knowledge_deletion_impact
affects: [02-12, 02-13, 02-15, 02-17, 02-23, 02-24]

actuals:
  tokens: 34000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Latest review event is the highest per-item sequence; the newest revision is the one no other revision is based on (no timestamp comparisons)"
    - "Inherent impl blocks for KnowledgeRepository are split across repository.rs (writes) and projection.rs (reads) to keep files under 800 lines"

key-files:
  created:
    - frontend/src-tauri/migrations/20260927000200_phase2_knowledge_reviews.sql
    - frontend/src-tauri/src/knowledge/review.rs
    - frontend/src-tauri/src/knowledge/projection.rs
  modified:
    - frontend/src-tauri/src/knowledge/models.rs
    - frontend/src-tauri/src/knowledge/repository.rs
    - frontend/src-tauri/src/knowledge/commands.rs
    - frontend/src-tauri/src/knowledge/extraction.rs
    - frontend/src-tauri/src/knowledge/mod.rs
    - frontend/src-tauri/src/knowledge/test_support.rs
    - frontend/src-tauri/src/lib.rs

key-decisions:
  - "Restore on a proposed item and reject on a rejected item are no-ops (state unchanged, nothing appended); restore on accepted and reopen on proposed or rejected are KNOWLEDGE_INVALID_TRANSITION"
  - "Correcting a rejected item is KNOWLEDGE_INVALID_TRANSITION; the user restores first"
  - "A correction carries the full new text/owner/due; empty owner or due clears to NULL. Owner/due that differ from the original report support user (or not_stated when cleared)"
  - "Malformed ids on review writes are KNOWLEDGE_INVALID_INPUT; unknown or foreign items are KNOWLEDGE_ITEM_NOT_FOUND"
  - "A link whose evidence row is gone sorts last (sequence i64::MAX) and reports missing"
  - "knowledge-updated after a review write carries the meeting's latest run id and status"

patterns-established:
  - "knowledge::test_support::seed_items creates a meeting, one evidence row, a finalized run and items with valid claim links"

requirements-completed: [KNOW-02, KNOW-03, KNOW-04, KNOW-06, KNOW-08]

coverage:
  - id: D1
    description: "Review events and revisions are append-only, atomic, validated and meeting-scoped"
    requirement: KNOW-03
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/review.rs#tests"
        status: pass
  - id: D2
    description: "Corrections chain revisions, reject stale bases and never update earlier rows"
    requirement: KNOW-04
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/review.rs#knowledge_review_correction_rejects_stale_base_and_chains_revisions"
        status: pass
  - id: D3
    description: "Evidence validity (valid/changed/missing) and eligibility; list_eligible_items returns only accepted+valid"
    requirement: KNOW-08
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/projection.rs#tests"
        status: pass
  - id: D4
    description: "Meeting view splits rejected, counts states and reports unresolved owner/due"
    requirement: KNOW-06
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/projection.rs#knowledge_meeting_view_splits_rejected_and_counts_states"
        status: pass

duration: 55min
completed: 2026-09-28
---

# Phase 2 Plan 05: Reviews, revisions and eligibility Summary

**Every candidate now has an append-only review history and correction lineage, and Rust computes each item's state, evidence validity and eligibility so later phases read one trustworthy list.**

## Accomplishments

- Migration `20260927000200_phase2_knowledge_reviews.sql`: `knowledge_revisions` (text 1–400, owner/due ≤ 80, based-on chain) and `knowledge_reviews` (per-item sequence, `UNIQUE (item_id, sequence)`, correct ⇔ revision), both with BEFORE UPDATE abort triggers and NO ACTION foreign keys; `knowledge_item_current` view projecting review state, current text/owner/due and the latest revision.
- `review.rs`: transition table, validation (trim, strip ASCII control characters, lengths, UUIDs), `append_review`, `correct_item` (unchanged → accept, stale base → `KNOWLEDGE_REVISION_CONFLICT`), `accept_all` (all-or-nothing meeting check), all inside `BEGIN IMMEDIATE`.
- `projection.rs`: `meeting_view`, `item_view`, `list_eligible_items`, `item_history` (original, revisions in chain order, reviews by sequence, evidence), `list_runs`, `deletion_impact`.
- Six review commands registered; `knowledge_get_meeting` now returns the full meeting view.

## Task Commits

1. **Tasks 1 and 2** — `4745a21` (feat). Task 1's model changes (new `KnowledgeItemView` fields) do not compile without Task 2's projection, so both were committed together.

## Verification

- `cargo test --manifest-path frontend/src-tauri/Cargo.toml knowledge::review --lib` → 7 passed
- `cargo test --manifest-path frontend/src-tauri/Cargo.toml knowledge:: --lib` → 45 passed
- Migration contains both tables, the unique constraint, the triggers and the view; `grep -ci "on delete cascade"` → 0
- `grep -n "UPDATE knowledge_items\|UPDATE knowledge_reviews\|UPDATE knowledge_revisions" review.rs` → nothing
- `lib.rs` registers all six commands; `projection.rs` contains `pub async fn list_eligible_items`

## Deviations from Plan

1. **[Size rule] Read-model code lives in `projection.rs`** — `repository.rs` would have exceeded 800 lines; `KnowledgeRepository::{meeting_view, list_eligible_items, item_history, list_runs, deletion_impact}` keep the planned names through a second `impl` block.
2. **[Process] One commit for two tasks** — see Task Commits.
3. **[Test wording] Immutability test builds its UPDATE statements from the table name** so `review.rs` contains no literal UPDATE of review tables, matching the acceptance grep while still exercising the triggers.

## Issues Encountered

None. Executed inline by the orchestrator (executor subagents were stalling on model API hangs).

## Next Phase Readiness

- 02-12 matches regenerate candidates against reviewed items via `knowledge_item_current` and revisions.
- 02-17 uses `deletion_impact` counts and must delete reviews and revisions child-first (NO ACTION foreign keys).
- 02-23/02-24 consume `item_history`, `corrected`, `latestRevisionId`, `rejected` and the review commands.

## Self-Check: PASSED

- `review.rs`, `projection.rs` and the migration exist; commit `4745a21` is on `codex/phase-01-baseline`.
