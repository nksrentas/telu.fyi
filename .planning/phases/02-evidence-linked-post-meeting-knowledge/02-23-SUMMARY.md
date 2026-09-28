---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 23
subsystem: ui
tags: [evidence, source-chip, popover, history, KNOW-02, KNOW-04, KNOW-08]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-14 meeting page, 02-15 getKnowledgeItemHistory and run views, 02-22 TranscriptDrawer highlight and scrollToEvidence
provides:
  - SourceChip, EvidencePopover and HistoryPopover for 02-24's candidate rows
  - EvidenceNavigationContext / useEvidenceNavigation (meetingStartedAt, openEvidence) and useEvidenceDrawer in meeting-page.tsx
affects: [02-21, 02-24]

actuals:
  tokens: 30000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Evidence surfaces read the meeting's start date and openEvidence from EvidenceNavigationContext; the page drawer and 02-21's peek each supply their own provider"
    - "Claim links (role claim) drive the chip time, +N, the popover quotes and openEvidence; owner and due links are not highlighted"

key-files:
  created:
    - frontend/src/components/living-doc/source-chip.tsx
    - frontend/src/components/living-doc/evidence-popover.tsx
    - frontend/src/components/living-doc/history-popover.tsx
    - frontend/tests/components/evidence-popover.test.tsx
  modified:
    - frontend/src/components/living-doc/meeting-page.tsx
    - frontend/src/components/living-doc/run-details-popover.tsx

key-decisions:
  - "{date} in the chip name and popover eyebrow is the meeting's day (Today or Sep 22) from the context, falling back to the item's creation time; {time} is the recording offset of the first claim link"
  - "Missing evidence (status missing or no claim links) shows This line is no longer in the transcript. and hides Open transcript; changed or missing quotes render in label-2 under an amber note, never as current evidence"
  - "The history footer reads Evidence unchanged only for valid evidence, otherwise Evidence changed / Evidence missing; its SourceChip opens the transcript"
  - "Field diffs compare each revision with the one before it (the original for the first) and read Owner: Maria (was not stated) / Due: … (was …)"
  - "useEvidenceDrawer holds drawer open state, highlight and openEvidence so the navigation wiring is testable without rendering the whole page"

patterns-established:
  - "Tests that need open Radix popovers mock ui/popover inline with a Popover that reports open on mount"

requirements-completed: []

coverage:
  - id: D1
    description: "Chip formatting, +N, evidence alert; popover quote, run origin, gaps, changed and missing states, 60vh scroll; Open transcript into the drawer"
    requirement: KNOW-02
    verification:
      - kind: unit
        ref: "frontend/tests/components/evidence-popover.test.tsx (SourceChip, EvidencePopover)"
        status: pass
  - id: D2
    description: "Correction lineage oldest first with diffs, evidence state, item id and run; loading, error and retry; markup renders as text"
    requirement: KNOW-04
    verification:
      - kind: unit
        ref: "frontend/tests/components/evidence-popover.test.tsx (HistoryPopover); 8 pass in the file"
        status: pass

duration: 45min
completed: 2026-09-28
---

# Phase 2 Plan 23: Evidence and history surfaces Summary

**Each candidate's exact evidence and correction history are now one click away: the SourceChip opens the verified quote, Open transcript lands on the cited words, and the History popover shows every correction against the original proposal.**

## Accomplishments

- `source-chip.tsx`: 18px chip, `message-circle` + recording offset (`1:05`, `1:02:03`), `+N`, amber `alert-triangle` for changed or missing evidence, accessible name `Source: {day}, {time}`; forwards its ref so it can be a Radix trigger.
- `evidence-popover.tsx`: 320px glass popover with a zero-size arrow and `arrowPadding={12}`, `EVIDENCE · {day} · {time}` eyebrow, one blockquote per claim link, `Captured with gaps around this line`, `This line has changed since Telu quoted it.`, `Found {date, time} · {Local|LAN|Remote}`, `Open transcript`.
- `history-popover.tsx`: 330px, align end, `Proposed by Telu` then `Corrected by you` entries, footer with evidence state, SourceChip and `ID {8 chars} · run of {date, time}`.
- `meeting-page.tsx`: `EvidenceNavigationContext`, `useEvidenceNavigation`, `highlightFor`, `useEvidenceDrawer`; the page wraps its tree in the provider.

## Task Commits

1. **Tasks 1–2** — `079fef5` (feat)

## Verification

- `bun test tests/components/evidence-popover.test.tsx` → 8 pass; full `bun test` → 95 pass
- Palette check on the four living-doc files → 0 offending classes; no `dangerouslySetInnerHTML`
- `next build` → compiled and type-checked; meeting, delete and knowledge gallery screens → 46 passed

## Deviations from Plan

1. **[Scope] `run-details-popover.tsx` exports `LOCATION_LABEL`** so the Found line reuses it.
2. **[Discretion] Copy for missing evidence** (`This line is no longer in the transcript.`) and the non-valid history labels are new; the UI-SPEC only covered the changed line.
3. **[Test approach] Test 4's page half drives `useEvidenceDrawer`** (the hook MeetingPage uses) with a fake drawer handle instead of rendering the full page.
4. **[Process] One commit for both tasks.**

## Next Phase Readiness

- 02-24 puts `SourceChip` inside `EvidencePopover` and the `Corrected` button inside `HistoryPopover` in each candidate row, passing the item's origin run to the popover.
- 02-21's peek provides its own `EvidenceNavigationContext` value that expands the inline transcript.

## Self-Check: PASSED

- Commit `079fef5` is on `codex/phase-01-baseline`.
