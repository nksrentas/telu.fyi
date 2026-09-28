---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 01
subsystem: knowledge
tags: [rust, sqlx, sqlite, tauri, react, bun, evidence, tracer]

requires:
  - phase: 01-baseline-observability-identity-and-trust-boundaries
    provides: transcript_evidence with stable evidence ids, meeting lifecycle/completeness, provider route validation
provides:
  - Append-only knowledge ledger (runs, items, evidence links, abstentions) with immutability triggers and NO ACTION foreign keys
  - Verbatim span verifier mapping S-labels to stable evidence ids and raw char offsets
  - KnowledgeRepository with deterministic item and link ordering
  - resolve_summary_dispatch shared by summaries and extraction
  - knowledge_start_extraction / knowledge_get_meeting / knowledge_list_evidence Tauri commands and the knowledge-updated event
  - Typed knowledge-service.ts and a Knowledge section on the meeting page
affects: [02-03, 02-05, 02-12, 02-14, 02-15, 02-17, 02-18, 02-22, 02-23, 02-24]

actuals:
  tokens: 26000
  tasks: 1
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Knowledge rows are insert-only; a run row may change only while running (SQLite BEFORE UPDATE triggers)"
    - "Extraction takes an injected completion closure so tests run without a provider"
    - "Route revalidation happens before the run insert, so a changed route creates no run and sends nothing"

key-files:
  created:
    - frontend/src-tauri/migrations/20260927000100_phase2_knowledge_ledger.sql
    - frontend/src-tauri/src/knowledge/mod.rs
    - frontend/src-tauri/src/knowledge/models.rs
    - frontend/src-tauri/src/knowledge/span_verifier.rs
    - frontend/src-tauri/src/knowledge/repository.rs
    - frontend/src-tauri/src/knowledge/extraction.rs
    - frontend/src-tauri/src/knowledge/commands.rs
    - frontend/src-tauri/src/knowledge/test_support.rs
    - frontend/src/lib/knowledge-service.ts
    - frontend/src/components/living-doc/knowledge-section.tsx
    - frontend/tests/components/knowledge-section.test.tsx
  modified:
    - frontend/src-tauri/src/summary/service.rs
    - frontend/src-tauri/src/database/repositories/transcript.rs
    - frontend/src-tauri/src/lib.rs
    - frontend/src/app/meeting-details/page-content.tsx

key-decisions:
  - "Gate order: lifecycle preparing/recording/finalizing or completeness pending/completion_not_verified → KNOWLEDGE_MEETING_NOT_READY first; then zero evidence → KNOWLEDGE_NO_EVIDENCE; then degraded completeness with trigger auto → KNOWLEDGE_MEETING_NOT_READY"
  - "Item text over 400 chars is abstained as malformed_item rather than truncated, so a stored item never differs from what the model claimed"
  - "Duplicate items (same type and normalized text) inside one run are dropped without counting as skipped"
  - "A run whose persistence fails is finalized as failed with KNOWLEDGE_STORAGE_FAILED so the one-running-run index never stays blocked"
  - "resolve_summary_dispatch errors that are not PROVIDER_ROUTE_* codes surface to the renderer as PROVIDER_ROUTE_UNAVAILABLE"

patterns-established:
  - "knowledge::test_support: migrated in-memory pool plus meeting and evidence fixtures shared by knowledge tests"
  - "Start split: load_start_context (validate, load, gate) then begin_run (route contract, fingerprint, running insert) so each step is testable without Tauri"

requirements-completed: [KNOW-01, KNOW-02]

coverage:
  - id: D1
    description: "Append-only ledger: items, links and abstentions reject UPDATE; a finalized run rejects UPDATE; a running run can be updated"
    requirement: KNOW-01
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/repository.rs#knowledge_ledger_rows_are_append_only_and_runs_freeze_after_finalization"
        status: pass
  - id: D2
    description: "A verified decision persists with an evidence link whose raw offsets slice back to the exact quote in the S2 segment"
    requirement: KNOW-02
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/extraction.rs#knowledge_extraction_persists_a_verified_decision_with_its_exact_evidence_link"
        status: pass
  - id: D3
    description: "Unverifiable candidates become abstentions (quote_not_found, unknown_segment) with skipped_count and no items"
    requirement: KNOW-01
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/extraction.rs#knowledge_extraction_abstains_on_missing_quotes_and_unknown_segments"
        status: pass
  - id: D4
    description: "Start gate, one running run per meeting, and route revalidation before any run or dispatch"
    requirement: KNOW-01
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/commands.rs#tests"
        status: pass
  - id: D5
    description: "Meeting page Knowledge section renders candidate text and quote as plain text; Find knowledge disabled unless the Summary route is validated"
    requirement: KNOW-02
    verification:
      - kind: unit
        ref: "frontend/tests/components/knowledge-section.test.tsx"
        status: pass

duration: 95min
completed: 2026-09-28
---

# Phase 2 Plan 01: Find knowledge end-to-end Summary

**Find knowledge now runs end-to-end: finalized evidence goes through the revalidated Summary route, every quote is checked verbatim against its labeled segment, and verified candidates are stored append-only and shown on the meeting page with their exact quotes.**

## Performance

- **Duration:** about 95 min of implementation (after four executor attempts that stalled on model API hangs)
- **Completed:** 2026-09-28
- **Tasks:** 1 (tracer), delivered as 3 commits
- **Files:** 11 created, 4 modified

## Accomplishments

- Ledger migration with four append-only tables, immutability triggers, a one-running-run partial unique index and NO ACTION foreign keys (no cascade, no delete triggers).
- `span_verifier`: normalization with a raw-index map (case, curly quotes, dash variants, whitespace) and `verify_claim_quote` returning raw offsets, the raw quote slice, the normalized quote and the segment hash.
- `KnowledgeRepository`: running-run insert (unique violation → `KNOWLEDGE_RUN_IN_PROGRESS`), finalize, items with claim links, abstentions, latest run, and item listing ordered by first claim sequence, raw start, then item id.
- `resolve_summary_dispatch` extracted from `process_transcript_background` without behavior change (summary suite 114/114).
- `run_extraction` with an injectable completion: `[S{n} mm:ss]` prompt lines, fenced-JSON parsing, 40-item cap, per-item verification, in-run dedupe, one-transaction persistence.
- Tauri commands `knowledge_start_extraction`, `knowledge_get_meeting`, `knowledge_list_evidence`, and the `knowledge-updated` event.
- `knowledge-service.ts` and `KnowledgeSection` mounted after the summary panel; the Phase 1 Summary `ProviderBoundary` before `SummaryPanel` is untouched.

## Task Commits

1. **Rust data layer** — `5fca229` (feat): migration, models, span verifier, repository, evidence read path
2. **Extraction and commands** — `83da17b` (feat): resolve_summary_dispatch, run_extraction, Tauri commands
3. **Meeting page** — `1a8a7b8` (feat): knowledge-service.ts, KnowledgeSection, bun test

## Verification

- `cargo test --manifest-path frontend/src-tauri/Cargo.toml knowledge:: --lib` → 15 passed
- `cargo test --manifest-path frontend/src-tauri/Cargo.toml transcript_evidence_repository --lib` → 4 passed
- `cargo test --manifest-path frontend/src-tauri/Cargo.toml summary --lib` → 114 passed
- `bun test --cwd frontend tests/components/knowledge-section.test.tsx` → 2 pass; full bun suite 47 pass
- `pnpm --dir frontend build` → exit 0
- `node --test .github/verify-phase1-provider-boundary.test.cjs` → 9 pass
- `grep -ci "on delete cascade"` on the migration → 0; `grep -n "FROM transcripts" src/knowledge/*.rs` → nothing

## Decisions Made

See `key-decisions` in the frontmatter. None change a locked CONTEXT decision.

## Deviations from Plan

**1. [Process] One tracer task delivered as three commits**
- **Why:** four spawned executors stalled because model API requests hung for 10–15 minutes. The orchestrator executed the plan inline and committed after each layer so a stall could not lose finished work.
- **Impact:** none on scope; every acceptance criterion is met.

**2. [Rule 2 - Missing critical] Failed persistence finalizes the run**
- **Issue:** if the persistence transaction failed, the run would stay `running` and block every later start through the partial unique index.
- **Fix:** `mark_run_failed` finalizes it as failed with `KNOWLEDGE_STORAGE_FAILED`.

**3. [Scope note] NFKC normalization, quote minimums, two-segment spans and owner/due spans are not in this tracer**
- They are planned for 02-03 exactly as the plan's objective states; this slice lowercases, folds quotes and dashes, and collapses whitespace.

## Issues Encountered

Executor subagents stalled repeatedly on model API hangs (no response for 10–15 minutes after a tool result). Plan 02-01 was executed inline by the orchestrator as a result.

## User Setup Required

None.

## Next Phase Readiness

- 02-03 extends `span_verifier` and `extraction` (NFKC, quote minimums, chunking, cancel, crash recovery).
- 02-05 builds reviews and revisions on `knowledge_items` and `knowledge_evidence_links`.
- The existing `ProviderBoundary` contract and summary behavior are unchanged.

## Self-Check: PASSED

- All created files exist on disk; commits `5fca229`, `83da17b`, `1a8a7b8` are on `codex/phase-01-baseline`.
