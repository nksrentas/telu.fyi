---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 03
subsystem: knowledge
tags: [rust, unicode-normalization, evidence, chunking, cancellation]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-01 ledger, span verifier, extraction run, knowledge commands
provides:
  - D-15/D-16 evidence rules (NFKC, quote minimum, two-segment spans, owner/due support)
  - Typed extraction parsing with per-item rejection reasons
  - Whole-segment chunk windows sized to the Summary model context
  - Cancellable runs with a knowledge-only token, stale-run recovery and quiet end on meeting deletion
affects: [02-05, 02-12, 02-15, 02-17, 02-18]

actuals:
  tokens: 21000
  tasks: 2
  commits: 1

tech-stack:
  added: [unicode-normalization 0.1.25 (already in Cargo.lock transitively)]
  patterns:
    - "LabeledSegments is an ordered list, so two-segment spans follow sequence order inside a window"
    - "Runs finalize exactly once; failed, cancelled and deleted-meeting runs persist no items"

key-files:
  created:
    - frontend/src-tauri/src/knowledge/prompt.rs
    - frontend/src-tauri/src/knowledge/parse.rs
  modified:
    - frontend/src-tauri/Cargo.toml
    - Cargo.lock
    - frontend/src-tauri/src/knowledge/span_verifier.rs
    - frontend/src-tauri/src/knowledge/extraction.rs
    - frontend/src-tauri/src/knowledge/repository.rs
    - frontend/src-tauri/src/knowledge/commands.rs
    - frontend/src-tauri/src/knowledge/models.rs
    - frontend/src-tauri/src/knowledge/mod.rs
    - frontend/src-tauri/src/summary/service.rs
    - frontend/src-tauri/src/lib.rs

key-decisions:
  - "Quote minimum is enforced exactly as the declared constants (QUOTE_MIN_WORDS = 3, QUOTE_MIN_CHARS = 12). The plan's sample 'ok let's do it' has 4 words and 14 characters, so it passes these constants; the test uses 'let's do it' instead."
  - "Owner and due quotes are verified on their own labels without the claim quote minimum; support requires the normalized value inside the verified span, so short phrases like 'by Friday' can be stated."
  - "Stated owner/due text is the raw transcript slice matching the value, so due dates stay verbatim."
  - "An item is kept when at least one of its evidence entries verifies; every verified span becomes a claim link (duplicates dropped)."
  - "A provider error in any window fails the whole run (PROVIDER_ERROR) with no items; only malformed windows are tolerated."
  - "Chunk budget is summary_context_tokens minus 2000 reserved output tokens, with a 500-token floor."

patterns-established:
  - "extraction::register_extraction / cancel_active_extraction / release_extraction keyed knowledge:{meeting_id}, holding the run id so a finished run never releases a newer run's token"

requirements-completed: [KNOW-01, KNOW-02, KNOW-06]

coverage:
  - id: D1
    description: "NFKC, quote minimum, two-segment spans and unknown/absent quotes"
    requirement: KNOW-02
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/span_verifier.rs#tests"
        status: pass
  - id: D2
    description: "Owner/due stated only when their own quote verifies and contains the value; persisted as owner/due links, not_stated as NULL"
    requirement: KNOW-06
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/extraction.rs#knowledge_extraction_stores_stated_owner_and_due_as_links_and_absent_ones_as_null"
        status: pass
  - id: D3
    description: "Parsing tolerates think blocks, fences and prose; rejects invalid entries per item"
    requirement: KNOW-01
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/parse.rs#tests"
        status: pass
  - id: D4
    description: "Chunk windows, partial-malformed and all-malformed runs, empty item lists"
    requirement: KNOW-01
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/prompt.rs#tests"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/extraction.rs#knowledge_extraction_keeps_good_windows_when_one_window_is_malformed"
        status: pass
  - id: D5
    description: "Cancel touches only the knowledge token; stale running runs are finalized INTERRUPTED; deleted meetings end runs quietly"
    requirement: KNOW-01
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/extraction.rs#knowledge_cancel_stops_the_run_without_touching_the_summary_token"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/commands.rs#knowledge_start_finalizes_a_stale_running_run_before_starting_again"
        status: pass

duration: 60min
completed: 2026-09-28
---

# Phase 2 Plan 03: Evidence rules and robust extraction runs Summary

**Every D-15/D-16 evidence rule is now enforced by pure, tested Rust, and extraction runs chunk to the model's context, survive malformed windows, cancel without touching summaries, and never stay stuck in `running`.**

## Accomplishments

- `span_verifier`: NFKC + lowercase + quote/dash folding + whitespace collapse with a raw-index map; `QuoteTooShort` below 3 words or 12 characters; edge punctuation stripped from quotes only; a quote may cross into the next consecutive segment (never three), producing one link per segment with that segment's own offsets; `verify_attribute` for owner/due.
- `parse`: think blocks and fences stripped via `clean_llm_markdown_detailed`, outermost object parsed, per-item `invalid_type` / `empty_text` / `malformed_item` (41st item, >400 chars, no evidence); only an unreadable document is a `ParseFailure`.
- `prompt`: `knowledge-extract-v2` system prompt with owner/due, `label_segments`, `chunk_windows` (whole segments, 2-segment overlap, oversized segment alone).
- `extraction`: per-window completion, cross-window dedupe, `PARTIAL_MALFORMED_OUTPUT` / `MALFORMED_OUTPUT`, `CANCELLED_BY_USER`, `PROVIDER_ERROR`, `MEETING_DELETED`; skipped_count always equals abstention rows.
- `summary_context_tokens` extracted from `process_transcript_background` (summary suite 115/115); `knowledge_cancel_extraction` registered; `knowledge-updated` emitted on start and every terminal status.

## Task Commits

1. **Tasks 1 and 2** — `288cdcb` (feat). The two tasks share the span verifier and extraction API changes, so the intermediate state after Task 1 alone did not compile; they were committed together.

## Verification

- `cargo test --manifest-path frontend/src-tauri/Cargo.toml knowledge:: --lib` → 32 passed (span_verifier, parse, prompt, extraction, repository, commands)
- `cargo test --manifest-path frontend/src-tauri/Cargo.toml summary --lib` → 115 passed
- Acceptance greps: `unicode-normalization = "0.1.25"` in Cargo.toml; `nfkc`, `QUOTE_MIN_WORDS`, `MAX_SPAN_SEGMENTS`, `fn verify_attribute` in span_verifier.rs; no `strsim`/`levenshtein`; `pub fn cancel_active_extraction` and `knowledge:` in extraction.rs; `fn summary_context_tokens` in service.rs; `knowledge_cancel_extraction` in `generate_handler!`.

## Deviations from Plan

1. **[Process] One commit for two tasks** — see Task Commits.
2. **[Plan inconsistency] Short-quote sample** — the constants win; see key-decisions.
3. **[Rule 2] Global registry and tests** — the cancellation registry is process-wide, so tests that start runs use their own meeting ids to stay independent.

## Issues Encountered

None beyond the deviations above. Executed inline by the orchestrator because executor subagents were stalling on model API hangs.

## Next Phase Readiness

- 02-05 builds reviews/revisions on items with multiple claim links and owner/due links.
- 02-12 reuses `normalized_key` and cross-window dedupe for regenerate matching.
- 02-15 uses `knowledge_cancel_extraction` and the start/terminal `knowledge-updated` events.

## Self-Check: PASSED

- `prompt.rs` and `parse.rs` exist; commit `288cdcb` is on `codex/phase-01-baseline`.
