---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 22
subsystem: ui
tags: [evidence, summary-input, transcript-drawer, react-virtual]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-01 knowledge_list_evidence and knowledge-service; 02-04 Skeleton and Button
provides:
  - Evidence-first summary input with a legacy fallback only for evidence-less meetings
  - TranscriptDrawer with exact-span highlight, scrollToEvidence and a read-only legacy fallback
affects: [02-14, 02-16, 02-23, 02-24]

actuals:
  tokens: 30000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Evidence offsets are Unicode scalar indices (Rust `.chars()`); the drawer slices with `Array.from(text)` so astral characters stay aligned"
    - "Component tests stub `window.__TAURI_INTERNALS__` only after importing modules that load framer-motion, so framer's browser check stays false for later SSR tests"

key-files:
  created:
    - frontend/src/components/living-doc/transcript-drawer.tsx
    - frontend/tests/components/transcript-drawer.test.tsx
  modified:
    - frontend/src/hooks/meeting-details/useSummaryGeneration.ts
    - frontend/tests/hooks/summary-generation.test.tsx
    - frontend/tests/hooks/meeting-details-refresh.test.tsx

key-decisions:
  - "Evidence segments map to Transcript { id: evidenceId, text, timestamp mm:ss, sequence_id, audio_start_time, audio_end_time }, so buildSummaryTranscriptPayload is untouched"
  - "An evidence read failure goes through the existing error path (toast + preflight error), never to legacy lines"
  - "The drawer takes Copy transcript / Open recording folder as optional callbacks; the meeting page (02-14) wires them from useCopyOperations and useMeetingOperations"
  - "Header meta is `{dateLabel} · {n} min`, with the duration taken from the last segment's end time"
  - "Esc closes the drawer without the slide (data-instant); the ✕ button uses the 200ms drawer exit"

patterns-established:
  - "TranscriptDrawerHandle.scrollToEvidence(evidenceId) centres a line through virtualizer.scrollToIndex(align center)"

requirements-completed: []

coverage:
  - id: D1
    description: "Summary input reads evidence in sequence order; legacy only when evidence is empty; evidence failure errors"
    requirement: KNOW-02
    verification:
      - kind: unit
        ref: "frontend/tests/hooks/summary-generation.test.tsx (summary input source, 3 tests) + meeting-details-refresh.test.tsx (22 pass together)"
        status: pass
  - id: D2
    description: "Drawer renders evidence lines, partial capture, legacy fallback, empty, loading, error with retry, exact-span mark and virtualized scrollToEvidence over 1,500 lines"
    requirement: KNOW-02
    verification:
      - kind: unit
        ref: "frontend/tests/components/transcript-drawer.test.tsx (5 pass)"
        status: pass

duration: 60min
completed: 2026-09-28
---

# Phase 2 Plan 22: Evidence-first summary input and transcript drawer Summary

**Summaries of canonical meetings now come from their finalized evidence, and a virtualized evidence transcript drawer can centre and mark the exact quoted characters, while legacy meetings keep their transcripts readable.**

## Accomplishments

- `useSummaryGeneration.fetchAllTranscripts`: `listMeetingEvidence` first, sorted by sequence and mapped to `Transcript`; `fetchLegacyTranscripts` (module-level, no emoji logs) only for empty evidence.
- Both hook test mocks answer `knowledge_list_evidence`; three new cases cover ordering without legacy reads, the legacy fallback, and the no-fallback error path.
- `transcript-drawer.tsx` (278 lines): 340px glass complementary panel with title, `{date} · {duration}`, caption, optional Copy/Open-folder buttons and Close; skeleton rows with `aria-busy`; `Couldn't load the transcript.` + Try again; `No transcript lines yet.`; `Transcript only · no evidence` legacy mode through `usePaginatedTranscripts`; `grid-cols-[42px_1fr]` lines with tabular times, `selectable` text, `Partial capture` tags; accent-soft cited lines, `mark` for the quote; `scrollToEvidence` via `forwardRef`/`useImperativeHandle`; Esc closes instantly; no `dangerouslySetInnerHTML`.

## Task Commits

1. **Task 1** — `0f701c1` (feat)
2. **Task 2** — `b9a7a99` (feat)

## Verification

- `bun test tests/hooks/summary-generation.test.tsx tests/hooks/meeting-details-refresh.test.tsx` → 22 pass
- `bun test tests/components/transcript-drawer.test.tsx` → 5 pass; full `bun test` → 66 pass, 0 fail
- Acceptance greps on the drawer (complementary, Transcript label, both copy strings, `useVirtualizer`, no `dangerouslySetInnerHTML`) → pass
- Palette check on the drawer → 0 offending classes; `next build` → compiled and type-checked

## Deviations from Plan

1. **[Rule 3 - Blocking] The drawer test stubs `window` in `beforeAll`, after importing the drawer.** Stubbing before the import made framer-motion cache a browser environment and broke the SSR `empty-state-summary` test that runs later in the same process.
2. **[Scope] Header actions are optional callbacks** instead of calling the copy/folder hooks inside the drawer (those hooks need the page's summary refs).

## Issues Encountered

- The drawer is not mounted yet; 02-14 composes it into the meeting page, and 02-16's evidence popover calls `scrollToEvidence`.
- Executed inline by the orchestrator.

## Next Phase Readiness

- Wave 3 is complete (02-05..02-11, 02-22). Wave 4: 02-12 (done), 02-13 (done), 02-14.

## Self-Check: PASSED

- Commits `0f701c1` and `b9a7a99` are on `codex/phase-01-baseline`.
