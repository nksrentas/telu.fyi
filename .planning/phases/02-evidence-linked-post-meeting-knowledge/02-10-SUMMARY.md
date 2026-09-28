---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 10
subsystem: ui
tags: [re-skin, summary, transcript, empty-state]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-04 primitives (EmptyState, Spinner, RecDot) and motion presets; 02-06 Dialog and menus
provides:
  - Summary panel, blocks and action groups on Telu tokens (one primary per surface)
  - Transcript views on the drawer line grammar, selectable again
  - Title, recording status, chunk progress, retranscribe dialog and notes tags on tokens
affects: [02-14, 02-21, 02-22]

actuals:
  tokens: 26000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Transcript row: `selectable mb-1 rounded-[10px] px-2 py-1.5 hover:bg-fill`, time `w-[42px] text-[11px] tabular-nums text-label-3`, text `text-[13px] leading-[1.5]`"
    - "Recording signals use RecDot (coral) and paused uses the static amber dot; everything else stays neutral"

key-files:
  created: []
  modified:
    - frontend/src/components/AISummary/index.tsx
    - frontend/src/components/AISummary/Block.tsx
    - frontend/src/components/AISummary/Section.tsx
    - frontend/src/components/MeetingDetails/SummaryPanel.tsx
    - frontend/src/components/MeetingDetails/SummaryGeneratorButtonGroup.tsx
    - frontend/src/components/MeetingDetails/SummaryUpdaterButtonGroup.tsx
    - frontend/src/components/MeetingDetails/RetranscribeDialog.tsx
    - frontend/src/components/TranscriptView.tsx
    - frontend/src/components/VirtualizedTranscriptView.tsx
    - frontend/src/components/EditableTitle.tsx
    - frontend/src/components/EmptyStateSummary.tsx
    - frontend/src/components/RecordingStatusBar.tsx
    - frontend/src/components/ChunkProgressDisplay.tsx
    - frontend/src/app/notes/[id]/page.tsx

key-decisions:
  - "Transcript rows get the `selectable` class: 02-04's body `user-select: none` would otherwise block copying transcript text"
  - "The transcript 'Listening…' dot is a coral RecDot (it is the recording signal), replacing an accent pulse"
  - "Chunk status rows are neutral fills with coral only for failed chunks; the summary status banner is neutral except errors"
  - "The block slash-command list highlights the keyboard row with fill-2 rather than accent, because its rows carry a secondary description line"

patterns-established: []

requirements-completed: []

coverage:
  - id: D1
    description: "Summary surfaces keep every action; palette gate passes; summary tests green"
    requirement: KNOW-03
    verification:
      - kind: unit
        ref: "bun test tests/lib/empty-state-summary.test.tsx tests/hooks/summary-generation.test.tsx tests/hooks/paginated-transcripts.test.tsx tests/hooks/meeting-details-refresh.test.tsx (28 pass)"
        status: pass
  - id: D2
    description: "Meeting-details and notes screens render"
    requirement: KNOW-03
    verification:
      - kind: automated_ui
        ref: "TELU_GALLERY_PORT=3230 pnpm --dir frontend gallery (40 passed)"
        status: pass

duration: 35min
completed: 2026-09-28
---

# Phase 2 Plan 10: Summary, transcript, title and progress re-skin Summary

**The meeting page's summary and transcript pieces are on Telu tokens: Generate is the single primary action, transcript lines follow the drawer grammar and are selectable again, and loading and recording states use the telu-ui indicators.**

## Accomplishments

- Summary groups: Generate/Regenerate `primary`, Stop `plain`, AI Model/Template/Save/Copy `default` (legacy outline alias); no pointer cursor.
- SummaryPanel loading row uses `Spinner` with `role="status"`; status banner neutral except errors.
- EmptyStateSummary: compact `EmptyState` with a blur fade (`DURATION.viewFade`, `EASE.out`), the same title/body copy, error alert and a primary Generate/Retry button; the model hint moved to the footnote.
- AISummary: card-radius error/loading/empty states, glass context and slash-command menus, 13.5px/1.55 block text, `title2`/`title3` headings, `bg-fill` hover and accent-softer selection; Section enters with `PRESET.listIn`.
- EditableTitle: `text-large` display title, accent 32% editing ring, revealed actions also on `:focus-visible`.
- Transcript views: drawer line grammar, `selectable`, RecDot for listening/paused, Spinner for "Loading more…" (the old spinner was invisible: same color on both borders).
- RecordingStatusBar: RecDot (coral) live, static amber when paused, label text.
- ChunkProgressDisplay, RetranscribeDialog and notes tags: tokens, Telu Buttons, 6px progress, neutral notes.

## Task Commits

1. **Tasks 1–2** — `a00b591` (feat)

## Verification

- Palette check on the AISummary directory and the 14 files → 0 offending classes
- `bun test` → 58 pass; the four plan-named suites → 28 pass
- `NEXT_DIST_DIR=.next-gallery pnpm exec next build` → compiled and type-checked
- `TELU_GALLERY_PORT=3230 pnpm --dir frontend gallery` → 40 passed

## Deviations from Plan

1. **[Rule 2 - Missing critical] Transcript rows are `selectable`** (restores copy after the 02-04 base rule).
2. **[Process] One commit for both tasks.**

## Issues Encountered

- BlockNote's own heading styles still render the large summary headings; restyling the editor's CSS belongs with the living doc (02-14).
- Executed inline by the orchestrator.

## Next Phase Readiness

- 02-14 can compose SummaryPanel and the transcript views unchanged.

## Self-Check: PASSED

- Commit `a00b591` is on `codex/phase-01-baseline`.
