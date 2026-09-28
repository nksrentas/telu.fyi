---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 26
subsystem: ui
tags: [review, agenda, sidebar, KNOW-03]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-13 agenda_list_review and agenda_counts, 02-25 TodayView, EventCard and AgendaToolbar
provides:
  - /review route with ReviewView
  - Sidebar Review row with the pending total
  - agenda-timeline.tsx shared by Today and Review
affects: [02-21]

actuals:
  tokens: 35000
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Rows that drop out of a Rust list stay in place marked data-leaving for a 500ms beat plus a 220ms grid-rows collapse, then leave"
    - "Sidebar counts bump (kit-bump, 420ms) only when a loaded value changes"

key-files:
  created:
    - frontend/src/app/review/page.tsx
    - frontend/src/components/agenda/review-view.tsx
    - frontend/src/components/agenda/agenda-timeline.tsx
    - frontend/tests/components/agenda-review.test.tsx
    - frontend/tests/visual/screens/review.json
  modified:
    - frontend/src/components/agenda/today-view.tsx
    - frontend/src/components/app-shell/sidebar.tsx
    - frontend/src/components/Sidebar/SidebarProvider.tsx

key-decisions:
  - "The toolbar and section count sum Rust pendingCount across listed meetings; the sidebar uses agenda_counts pendingTotal"
  - "Day labels read Today, Yesterday, a short weekday within six days, else Mon D"
  - "Load failure copy is Couldn't load meetings to review. with Try again, shown as a toast and, on first load, inline"
  - "Review rows open /meeting-details?id=…&from=Review (the peek comes with 02-21)"

patterns-established:
  - "agenda-timeline.tsx: Timeline (optional day labels and leaving rows), TimelineSkeleton, useSelection, useTimelineKeys (day stepping optional), useScrolled, useAgendaRefresh, meetingHref"

requirements-completed: []

coverage:
  - id: D1
    description: "To review list with day labels and counts, empty/loading/error, leave after the beat, Enter opens from Review, sidebar row order, count and current state"
    requirement: KNOW-03
    verification:
      - kind: unit
        ref: "frontend/tests/components/agenda-review.test.tsx (4 pass); app-shell 6 pass; completeness contract 8 pass"
        status: pass
      - kind: automated_ui
        ref: "TELU_GALLERY_PORT=3246 pnpm --dir frontend gallery (132 passed, five review screens)"
        status: pass

duration: 50min
completed: 2026-09-28
---

# Phase 2 Plan 26: Review tab Summary

**Meetings still waiting for decisions are now one sidebar click away: the Review tab lists them under To review with their pending counts, and each leaves the list once its last item is decided.**

## Accomplishments

- `review-view.tsx`: `Review` / `{n} items need a look` toolbar, `To review` section with `{n} items · accept, correct or reject what Telu found`, EventCard rows with day labels, All caught up empty state, skeleton and error states, leave animation, listbox keyboard model.
- `sidebar.tsx`: Review row (`inbox`) between Today and Settings with `Review, {n} items` as its accessible name, hidden count at 0, bump on change.
- `SidebarProvider.tsx`: `isCollapsed` / `toggleCollapse` removed; meetings, lifecycle/completeness projection and polling unchanged.
- `agenda-timeline.tsx`: shared timeline pieces extracted from TodayView.

## Task Commits

1. **Tasks 1–2** — `ff7b4b0` (feat)

## Verification

- `bun test` → 125 pass; `node --test .github/*.test.cjs` → 56 pass
- Palette check on `agenda/`, `app-shell/`, `app/review` → 0 offending classes; no `Needs filing`; no `toggleCollapse`
- `next build` → `/review` exported; gallery → 132 passed

## Deviations from Plan

1. **[Scope] `agenda-timeline.tsx` extracted** so Today and Review share one timeline and keyboard model; `today-view.tsx` now imports it.
2. **[Process] One commit for both tasks.**

## Self-Check: PASSED

- Commit `ff7b4b0` is on `codex/phase-01-baseline`.
