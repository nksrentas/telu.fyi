---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 24
subsystem: ui
tags: [knowledge, review, correction, undo, KNOW-03, KNOW-04, KNOW-05, KNOW-06, KNOW-08]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-05 review commands, 02-15 run lifecycle and service wrappers, 02-23 SourceChip, EvidencePopover, HistoryPopover
provides:
  - ReviewHead, CandidateRow, RejectedGroup and ReviewBlock in the knowledge section
  - Undo toasts and Cmd+Z for review actions
affects: [02-21, 02-26]

actuals:
  tokens: 70000
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Rows call the review commands and report the Rust view upward; the block applies it (withItem), recounts pending/accepted, and owns toasts, undo and focus"
    - "Eligibility, corrected and unresolved state render only from the returned Rust view; a failed command leaves the row unchanged"
    - "Rows lay out as 112px · 1fr · auto above a 600px container and stack below (section is an @container)"

key-files:
  created:
    - frontend/src/components/living-doc/review-head.tsx
    - frontend/src/components/living-doc/candidate-row.tsx
    - frontend/src/components/living-doc/rejected-group.tsx
    - frontend/src/components/living-doc/review-block.tsx
    - frontend/tests/components/knowledge-review.test.tsx
    - frontend/tests/visual/screens/knowledge.json
  modified:
    - frontend/src/components/living-doc/knowledge-section.tsx
    - frontend/src/components/living-doc/knowledge-run-states.tsx
    - frontend/tests/components/knowledge-section.test.tsx
    - frontend/tests/components/knowledge-run.test.tsx

key-decisions:
  - "The abstention line moved into review-head.tsx (EmptyResult imports it), and the 02-01 KnowledgeItemList was removed"
  - "The review block renders whenever active or rejected items exist, so items stay visible during a regenerate and an all-rejected meeting still shows its Rejected group"
  - "Saving an unchanged correction accepts a pending item and simply closes the editor on an accepted one"
  - "An accepted item with changed or missing evidence swaps its status for a Reject button plus the menu (Correct…, Move back to review); the evidence problem also shows in the row meta for pending items"
  - "Amber Owner/Due not stated chips follow Rust's unresolved flag on accepted items"
  - "A correction, restore or reopen clears the undo entry, so Cmd+Z never reaches past a correction; the reject toast uses toast.info, the others toast.success"
  - "Evidence popovers get the item's origin run when it is the latest run, otherwise the Found line falls back to the item's creation time"

patterns-established:
  - "Rejected group: Radix Collapsible with forceMount, grid-rows/opacity transition, and inert set on the closed content"

requirements-completed: [KNOW-03, KNOW-04, KNOW-05, KNOW-06]

coverage:
  - id: D1
    description: "Row states and actions, correction validation and revision base, history from Corrected, invalid evidence, unresolved chips, ReviewHead and abstention copy, failure handling, wrapping"
    requirement: KNOW-03
    verification:
      - kind: unit
        ref: "frontend/tests/components/knowledge-review.test.tsx (CandidateRow, ReviewHead)"
        status: pass
  - id: D2
    description: "Rejected group and Restore, Accept all with Undo and failure, single Undo, Cmd+Z rules, no raw HTML or memory label in living-doc"
    requirement: KNOW-05
    verification:
      - kind: unit
        ref: "frontend/tests/components/knowledge-review.test.tsx (ReviewBlock); 10 pass"
        status: pass
      - kind: automated_ui
        ref: "TELU_GALLERY_PORT=3244 pnpm --dir frontend gallery (122 passed, ten knowledge review screens)"
        status: pass

duration: 110min
completed: 2026-09-28
---

# Phase 2 Plan 24: Candidate review Summary

**Every candidate can now be accepted, corrected, rejected or restored from its row, with eligibility, unresolved fields and invalidated evidence shown exactly as Rust reports them.**

## Accomplishments

- `review-head.tsx`: `role="status"` note (amber eye / reviewed check), `Accept all` from two pending rows, abstention line with its tooltip.
- `candidate-row.tsx`: pending rows with the amber bar and Accept · Correct · Reject; inline correction (textbox selected, Owner/Due fields, 400/80 caps, Enter saves, Esc discards, `Text can't be empty.`); accepted rows with `✓ Accepted · eligible` or `✓ Corrected · Accepted · eligible` (Corrected opens History) and the `⋯` menu; SourceChip inside EvidencePopover on every row.
- `rejected-group.tsx`: collapsed `Rejected (n)`, struck-through rows, `Restore`.
- `review-block.tsx`: applies Rust views, focus to the next pending row after Accept, Accept all with a 70ms stagger, Undo toasts and Cmd+Z.

## Task Commits

1. **Tasks 1–3** — `dbd636f` (feat)

## Verification

- `bun test` → 114 pass (knowledge-review 10, knowledge-section 2, knowledge-run 10)
- Palette check on `living-doc/` → 0 offending classes; no raw HTML and no memory label in `components/living-doc`
- `next build` → compiled and type-checked; gallery → 122 passed

## Deviations from Plan

1. **[Scope] `review-block.tsx` added** to keep `knowledge-section.tsx` under 400 lines; it holds the undo stack, Accept all and focus handling.
2. **[Scope] `knowledge-run-states.tsx`** lost the old item list and now imports the abstention line from `review-head.tsx`.
3. **[Rule 3 - Blocking] Test stubs:** `knowledge-run.test.tsx` gained `PopoverTrigger`/`PopoverArrow` in its popover mock and window event listeners; the tracer test stubs `window`; the review test stubs `requestAnimationFrame` (Radix Collapsible) and `document` (Tooltip cleanup).
4. **[Process] One commit for all three tasks.**

## Next Phase Readiness

- 02-26 lists meetings with pending candidates in the Review tab; 02-21 reuses the block in the side peek through `surface="peek"`.

## Self-Check: PASSED

- Commit `dbd636f` is on `codex/phase-01-baseline`.
