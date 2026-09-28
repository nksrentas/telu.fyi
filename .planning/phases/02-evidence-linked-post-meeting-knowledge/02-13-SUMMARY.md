---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 13
subsystem: agenda
tags: [rust, tauri, projection, search, bun]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-05 knowledge_item_current and run status
provides:
  - Rust agenda projection with card states and review counts (agenda_list_day, agenda_list_review, agenda_counts)
  - Evidence-aware, injection-safe search (titles, transcript_evidence, legacy transcripts)
  - agenda-service.ts with localDayBounds and typed wrappers
affects: [02-16, 02-21, 02-25, 02-26]

actuals:
  tokens: 15000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Start time is started_at_utc, else created_at, parsed in Rust (RFC 3339, offset and naive formats); unreadable rows are skipped and logged by id"
    - "Bun tests that replace @tauri-apps/api/core restore it in afterAll; the agenda test stubs window.__TAURI_INTERNALS__ instead of the module"

key-files:
  created:
    - frontend/src-tauri/src/agenda/mod.rs
    - frontend/src-tauri/src/agenda/commands.rs
    - frontend/src/lib/agenda-service.ts
    - frontend/tests/lib/agenda-service.test.ts
  modified:
    - frontend/src-tauri/src/lib.rs
    - frontend/src-tauri/src/database/repositories/transcript.rs
    - frontend/tests/hooks/summary-generation.test.tsx
    - frontend/tests/components/knowledge-section.test.tsx

key-decisions:
  - "endedAtUtc is meeting_finalizations.finalized_at_utc when present, else start plus the largest evidence audio_end_time, else null"
  - "Evidence search results carry an mm:ss position from audio_start_time; title matches carry an empty position"
  - "agenda_counts.pendingTotal sums pending items across all meetings; dayCount counts meetings starting in the range"

patterns-established:
  - "AgendaError codes: AGENDA_INVALID_RANGE, AGENDA_STORAGE_FAILED"

requirements-completed: [KNOW-03]

coverage:
  - id: D1
    description: "Card-state precedence, day listing with counts and end time, legacy timestamps, range validation, review list and counts"
    requirement: KNOW-03
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/agenda/mod.rs#tests"
        status: pass
  - id: D2
    description: "Search finds meetings by evidence text and title, treats % and _ literally, ignores blank queries and caps at 50"
    requirement: KNOW-03
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/database/repositories/transcript.rs#transcript_search_tests"
        status: pass
  - id: D3
    description: "localDayBounds and listAgendaDay invoke arguments"
    requirement: KNOW-03
    verification:
      - kind: unit
        ref: "frontend/tests/lib/agenda-service.test.ts"
        status: pass

duration: 45min
completed: 2026-09-28
---

# Phase 2 Plan 13: Agenda projection and search Summary

**Today and Review can now be rendered entirely from Rust-projected facts, and canonical meetings are findable by what was said.**

## Accomplishments

- `agenda` module: `AgendaMeeting`, `AgendaCardState` (recording > finalizing > extracting > to_review > incomplete > reviewed > no_knowledge > transcript_only), `AgendaCounts`, `derive_card_state`, `parse_range` (RFC 3339, from < to, ≤ 48 hours).
- Commands `agenda_list_day`, `agenda_list_review`, `agenda_counts` registered; logs carry counts only.
- `search_transcripts` unions titles, `transcript_evidence` and legacy `transcripts` with `LOWER(..) LIKE ?1 ESCAPE '\'`, escaping backslash, percent and underscore; ordered by meeting start, `LIMIT 50`; `TranscriptSearchResult` unchanged.
- `agenda-service.ts`: `listAgendaDay`, `listReviewMeetings`, `getAgendaCounts`, `localDayBounds`.

## Task Commits

1. **Tasks 1 and 2** — `ba08549` (feat)

## Verification

- `cargo test --manifest-path frontend/src-tauri/Cargo.toml agenda:: --lib` → 5 passed
- `cargo test --manifest-path frontend/src-tauri/Cargo.toml transcript_search --lib` → 4 passed
- `bun test --cwd frontend tests/lib/agenda-service.test.ts` → 2 pass; full bun suite → 49 pass
- `pnpm --dir frontend build` → exit 0
- `lib.rs` contains `pub mod agenda;` and the three commands; `agenda/mod.rs` contains `fn derive_card_state` and `knowledge_item_current`; `search_transcripts` contains `ESCAPE` and `transcript_evidence`

## Deviations from Plan

1. **[Rule 3 - Blocking] Test isolation for the Tauri core mock** — `summary-generation.test.tsx` (Phase 1) and `knowledge-section.test.tsx` (02-01) replaced `@tauri-apps/api/core` without restoring it, which leaked into the new test in a full run. Both now restore it in `afterAll`, and `agenda-service.test.ts` stubs `window.__TAURI_INTERNALS__` so it works regardless of Bun's module-mock order.
2. **[Process] One commit for both tasks.**

## Issues Encountered

Bun module-mock ordering (above). Executed inline by the orchestrator.

## Next Phase Readiness

- 02-25 (Today) and 02-26 (Review) render `AgendaMeeting.cardState` and counts without inferring state in React.
- 02-21's search popover calls the unchanged `api_search_transcripts`.

## Self-Check: PASSED

- The four created files exist; commit `ba08549` is on `codex/phase-01-baseline`.
