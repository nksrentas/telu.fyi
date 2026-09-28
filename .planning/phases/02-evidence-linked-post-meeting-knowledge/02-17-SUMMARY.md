---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 17
subsystem: data + ui
tags: [deletion, knowledge, transaction, alert, KNOW-08]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-05 knowledge tables and cancellation, 02-12 knowledge_deletion_impact, 02-14 meeting page and doc toolbar
provides:
  - one explicit child-first delete transaction for every meeting-scoped table
  - counts-first DeleteMeetingAlert and the Delete meeting… danger row
  - MEETINGS_CHANGED_EVENT (telu:meetings-changed) for Today and Review to refetch
affects: [02-16, 02-19, 02-21]

actuals:
  tokens: 46000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "MEETING_SCOPED_DELETE_ORDER lists every child table explicitly; knowledge foreign keys stay NO ACTION so a missing table fails and rolls back the whole delete"
    - "The residue test enumerates sqlite_master joined with pragma_table_info, so a new meeting-scoped table without a delete step fails the test"
    - "Gallery stub fixtures: $pending never resolves, $error throws"

key-files:
  created:
    - frontend/src-tauri/tests/knowledge_deletion.rs
    - frontend/src/lib/meeting-deletion-service.ts
    - frontend/src/components/living-doc/delete-meeting-alert.tsx
    - frontend/tests/components/delete-meeting-alert.test.tsx
    - frontend/tests/visual/screens/delete-alert.json
    - frontend/public/telu-icon.png
  modified:
    - frontend/src-tauri/src/database/repositories/meeting.rs
    - frontend/src-tauri/src/api/api.rs
    - frontend/src/components/app-shell/doc-toolbar.tsx
    - frontend/src/components/living-doc/meeting-page.tsx
    - frontend/tests/visual/tauri-ipc-stub.js

key-decisions:
  - "DeleteScope (Meeting, EvaluationRun, EvaluationRunOrMeeting) builds each statement, so evaluation child rows are removed through their run before the runs themselves"
  - "api_delete_meeting cancels the knowledge:{meeting_id} extraction before opening the transaction"
  - "The alert uses the radix-ui AlertDialog directly (no shadcn alert-dialog wrapper exists); Cancel is focused through onOpenAutoFocus"
  - "Delete stays disabled on a counts load error, which shows Couldn't load what will be removed."
  - "The alert shows the Telu mark (public/telu-icon.png, from src-tauri/icons/icon.png) instead of the legacy icon_128x128.png"

patterns-established:
  - "DocToolbarMenuItem supports danger, disabled and separatorBefore"

requirements-completed: [KNOW-08]

coverage:
  - id: D1
    description: "One child-first transaction, zero residue across every meeting-scoped table, other meetings untouched, FK backstop, missing meeting"
    requirement: KNOW-08
    verification:
      - kind: integration
        ref: "cargo test --test knowledge_deletion (3 pass); cargo test --lib meeting_ (37 pass)"
        status: pass
  - id: D2
    description: "Counts-first alert, copy variants, Cancel focus, success navigation/toast/event, failure keeps the alert open, disabled row while recording or finalizing"
    requirement: KNOW-08
    verification:
      - kind: unit
        ref: "frontend/tests/components/delete-meeting-alert.test.tsx (5 pass)"
        status: pass
      - kind: automated_ui
        ref: "TELU_GALLERY_PORT=3237 pnpm --dir frontend gallery -g delete-alert (10 passed: counts, zero, loading, error, long-title × light/dark)"
        status: pass

duration: 75min
completed: 2026-09-28
---

# Phase 2 Plan 17: Meeting deletion Summary

**Deleting a meeting now removes every meeting-scoped row, knowledge included, in one explicit transaction, and the user sees exactly what will go before a Cancel-focused, undo-free confirm.**

## Accomplishments

- `meeting.rs`: `MEETING_SCOPED_DELETE_ORDER` runs knowledge suppressions → reviews → revisions → evidence links → abstentions → items → runs, then Phase 1 rows, transcript chunks, summary processes, legacy transcripts and the meeting, logging per-table counts.
- `api.rs`: `api_delete_meeting` cancels the active extraction first.
- `knowledge_deletion.rs`: generic residue test over every table with a `meeting_id` column plus evaluation child tables, a second meeting left intact, an FK backstop and a missing-meeting case.
- `delete-meeting-alert.tsx`: 280px glass alert, counts first with a 10px spinner, plural/singular/both-zero copy, the audio note, coral Delete last, failure copy in 11px coral-ink.
- `meeting-page.tsx`: `Delete meeting…` danger row after a separator, disabled while recording or finalizing; on success the sidebar refetches.

## Task Commits

1. **Task 1** — `0addfbd` (feat)
2. **Task 2** — `c98ad61` (feat)

## Verification

- `cargo test --test knowledge_deletion` → 3 pass; `cargo test --lib meeting_` → 37 pass
- `bun test` → 81 pass; palette check on `living-doc/` and `app-shell/` → 0 offending classes
- `next build` → compiled and type-checked; delete-alert gallery → 10 passed

## Deviations from Plan

1. **[Rule 1 - Bug] Legacy icon replaced.** The alert first used `public/icon_128x128.png`, which is still the pre-Telu artwork; it now uses `public/telu-icon.png` generated from the Telu desktop icon.
2. **[Scope] `meeting-page.tsx` and `tauri-ipc-stub.js` modified** (not in `files_modified`): the page owns the alert state, and the stub needed `$pending`/`$error` for the loading and failure screens.

## Issues Encountered

- `next/image` lazy-loads by default, so the gallery captured the alert before the icon loaded; `loading="eager"` fixed it.
- Headless WebKit does not render `backdrop-filter`, so the gallery shows the glass alert as translucent without blur (known artifact).

## Next Phase Readiness

- Today and Review (02-16/02-19) listen for `telu:meetings-changed` to refresh counts.
- Audio, run bundles, caches and IndexedDB mirrors remain for HARD-02 (Phase 6), as the alert states.

## Self-Check: PASSED

- Commits `0addfbd` and `c98ad61` are on `codex/phase-01-baseline`.
