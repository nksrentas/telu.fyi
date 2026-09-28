---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 15
subsystem: ui
tags: [knowledge, run-notice, provider-route, auto-run, regenerate]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-05 review commands, 02-12 suppression counts, 02-14 meeting page
provides:
  - knowledge-service wrappers and types consumed by 02-23 and 02-24
  - RunNotice (provider label before every data-bearing start) and the single validated start path
  - KnowledgeSection run states, D-09 auto-run gate, D-11 regenerate with toast, run details popover
affects: [02-16, 02-19, 02-21, 02-23, 02-24]

actuals:
  tokens: 40000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Every start (auto, explicit, retry, regenerate) goes through useRunStarter: validateProviderRoute immediately before knowledge_start_extraction; route rejections block the action with the unavailable copy"
    - "KnowledgeSection reads route state from a hidden ProviderBoundary (the Summary section shows the full card)"
    - "Component tests stub window.__TAURI_INTERNALS__ (invoke, transformCallback) to drive invoke and Tauri events without module mocks"

key-files:
  created:
    - frontend/src/components/living-doc/run-notice.tsx
    - frontend/src/components/living-doc/run-details-popover.tsx
    - frontend/src/components/living-doc/knowledge-run-states.tsx
    - frontend/tests/components/knowledge-run.test.tsx
    - frontend/tests/visual/screens/knowledge-run.json
  modified:
    - frontend/src/lib/knowledge-service.ts
    - frontend/src/components/living-doc/knowledge-section.tsx
    - frontend/src/app/meeting-details/page-content.tsx
    - frontend/src/app/meeting-details/page.tsx
    - frontend/tests/components/knowledge-section.test.tsx

key-decisions:
  - "The auto request latches: once autoGenerate is true it stays requested, because the page resets shouldAutoGenerate after the summary starts"
  - "A module-level Set records auto-started meetings, so a remount never re-dispatches even before the new run is visible"
  - "An evidence read failure on the page counts as 'has evidence'; a real NO_EVIDENCE comes back from the start command and switches the section to the no-evidence card"
  - "Open Settings is a next/link so the notice works without an app-router context in tests"
  - "Cancelled runs fall back to the explicit start card when no items exist"

patterns-established:
  - "Knowledge copy lives in KNOWLEDGE_COPY (knowledge-run-states.tsx), verbatim from the UI-SPEC Copywriting Contract"

requirements-completed: []

coverage:
  - id: D1
    description: "Run notice by location class, unavailable copy, validated start order, service wrappers"
    requirement: KNOW-01
    verification:
      - kind: unit
        ref: "frontend/tests/components/knowledge-run.test.tsx (RunNotice, wrappers, start order)"
        status: pass
  - id: D2
    description: "D-09 auto gate once per meeting, gap/no-evidence/failed/running/nothing/abstained states, regenerate toast, run details"
    requirement: KNOW-06
    verification:
      - kind: unit
        ref: "frontend/tests/components/knowledge-run.test.tsx + knowledge-section.test.tsx (12 pass)"
        status: pass
      - kind: automated_ui
        ref: "TELU_GALLERY_PORT=3235 pnpm --dir frontend gallery (70 passed, nine knowledge-* screens)"
        status: pass

duration: 60min
completed: 2026-09-28
---

# Phase 2 Plan 15: Knowledge runs on the meeting page Summary

**Knowledge runs are now visible and truthful: the Summary route is named before any extraction can start, every start revalidates it, auto-extraction follows D-09 exactly once per meeting, regenerate keeps items visible and reports what was already decided, and run details show the append-only history.**

## Accomplishments

- `knowledge-service.ts`: `ReviewState`/`ReviewAction`/`EvidenceStatus`/`FieldSupport`, full `KnowledgeItemView` and `MeetingKnowledgeView`, `CorrectionInput`, history types; `cancelKnowledgeExtraction`, `reviewKnowledgeItem`, `correctKnowledgeItem`, `acceptAllKnowledgeItems`, `getKnowledgeItemHistory`, `listKnowledgeRuns`.
- `run-notice.tsx`: laptop/network/cloud line `Uses your Summary model · {Local|LAN|Remote} · {origin}`, coral `Not encrypted` for plain LAN, unavailable copy + `Open Settings`, the (disabled) action stays visible.
- `knowledge-run-states.tsx`: explicit start card (gap line), no-evidence card, running row with Stop, failed card by code, compact empty results with the abstention line and tooltip, restyled item list.
- `knowledge-section.tsx`: head with `· n to review` and the `Knowledge actions` menu (Regenerate…, Run details), inline regenerate notice, auto gate, regenerate toast.
- `run-details-popover.tsx`: current run plus earlier runs newest first.
- `page-content.tsx` passes `completeness`, `autoGenerate`, `hasEvidence` and `surface`.

## Task Commits

1. **Tasks 1–2** — `17f9919` (feat)

## Verification

- `bun test tests/components/knowledge-run.test.tsx tests/components/knowledge-section.test.tsx` → 12 pass; full `bun test` → 76 pass
- Phase 1 provider-boundary + completeness contracts → 17 pass
- Palette check on `living-doc/` → 0 offending classes; no `dangerouslySetInnerHTML`
- `next build` → compiled and type-checked; gallery → 70 passed

## Deviations from Plan

1. **[Scope] `knowledge-run-states.tsx` split out** to keep `knowledge-section.tsx` under 400 lines (plan allowed splitting).
2. **[Rule 1 - Bug] `page.tsx` passes `hasEvidence={evidenceInfo.count !== 0}`** so an evidence read error does not show the no-evidence card.
3. **[Process] One commit for both tasks.**

## Issues Encountered

- Radix portals do not render in react-test-renderer, so the run tests mock `ui/dropdown-menu` and `ui/popover` with inline components (restored in afterAll).
- Executed inline by the orchestrator.

## Next Phase Readiness

- 02-24 replaces the item list with the review block; 02-23 uses the history wrapper.

## Self-Check: PASSED

- Commit `17f9919` is on `codex/phase-01-baseline`.
