---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 21
subsystem: ui
tags: [side-peek, search, context-menu, gallery, phase-gate]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-19 recording host, 02-23 evidence context, 02-24 review block, 02-26 Review tab, 02-17 delete alert
provides:
  - SidePeek (PeekLayer, usePeek) with the peek implementation of EvidenceNavigationContext
  - SearchPopover (Cmd+F) in the agenda toolbar
  - EventCard context menu and ui/context-menu
  - After gallery (73 screens, light and dark)
affects: []

actuals:
  tokens: 110000
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Keyboard-driven peek swaps and closes skip exit animations (they render immediately); pointer paths slide 300/200ms and crossfade 110/190ms"
    - "useMeetingDocument loads metadata, transcript pages, summary and evidence for any surface that shows a meeting"
    - "Gallery steps support rightClick and type"

key-files:
  created:
    - frontend/src/components/side-peek/side-peek.tsx
    - frontend/src/components/side-peek/inline-transcript.tsx
    - frontend/src/components/app-shell/search-popover.tsx
    - frontend/src/components/ui/context-menu.tsx
    - frontend/src/hooks/meeting-details/use-meeting-document.ts
    - frontend/tests/visual/screens/peek-search.json
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/gallery/after/
  modified:
    - frontend/src/components/agenda/today-view.tsx
    - frontend/src/components/agenda/review-view.tsx
    - frontend/src/components/agenda/agenda-timeline.tsx
    - frontend/src/components/agenda/event-card.tsx
    - frontend/src/components/app-shell/agenda-toolbar.tsx
    - frontend/src/components/app-shell/recording-capsule.tsx
    - frontend/src/components/living-doc/delete-meeting-alert.tsx
    - frontend/src/components/living-doc/meeting-header.tsx
    - frontend/src/components/living-doc/transcript-drawer.tsx
    - frontend/src/components/ui/dropdown-menu.tsx
    - frontend/tests/components/today-view.test.tsx
    - frontend/tests/components/agenda-review.test.tsx
    - frontend/tests/visual/gallery.visual.ts
    - frontend/tests/visual/screens/knowledge.json
    - .github/verify-phase1-finalization-ui.test.cjs

key-decisions:
  - "Card click and Enter open the peek (D-05); Review rows and the Review card action open it scrolled to Knowledge; Find knowledge on a not-yet-run card still opens the page at #knowledge so the run notice shows before extraction"
  - "The peek closes itself when its meeting is deleted (telu:meetings-changed with that id); deletes from the card menu stay on the current view"
  - "Search sits in the Record glass group (after a hairline); while recording it moves to its own group beside the capsule"
  - "The meeting page keeps its own loader; the peek uses the new useMeetingDocument (the route test is coupled to page.tsx internals)"
  - "Selected search results switch secondary text to white so it stays readable on the accent highlight"

patterns-established:
  - "PeekLayer + usePeek(selectedId): open, swap with the list selection, Esc (blur a field first), close on deletion"

requirements-completed: []

coverage:
  - id: D1
    description: "Peek opens from click/Enter, swaps on arrows, closes on Esc, Open as page origin (Today, Review), inline transcript with marked span and no page drawer"
    verification:
      - kind: unit
        ref: "frontend/tests/components/today-view.test.tsx (14 pass), agenda-review.test.tsx (4 pass)"
        status: pass
  - id: D2
    description: "Cmd+F search hint, debounce, no matches, results as text; card menu entries, stop only while recording, guarded delete opening the alert"
    verification:
      - kind: unit
        ref: "frontend/tests/components/today-view.test.tsx"
        status: pass
  - id: D3
    description: "Phase UI gate"
    verification:
      - kind: integration
        ref: "node frontend/scripts/telu-palette.mjs check → 0 offending classes; raw-HTML grep over living-doc, agenda, app-shell, side-peek → none; node --test .github/*.test.cjs → 56 pass; bun test → 130 pass"
        status: pass
      - kind: automated_ui
        ref: "GALLERY_LABEL=after TELU_GALLERY_PORT=3241 pnpm --dir frontend gallery → 146 passed; after/{light,dark} committed"
        status: pass
      - kind: manual
        ref: "Before/after gallery review, No evidence copy (A2), run notice wording (A4), delete dialog audio line (A5), dark set (A1)"
        status: pending

duration: 150min
completed: 2026-09-28
---

# Phase 2 Plan 21: Peek, search and the phase gate Summary

**The shell is complete: any meeting's review opens in a side peek from Today or Review, Cmd+F finds meetings by what was said, every card has a context menu with a counts-first delete, and the whole app passes the Telu design-system and rendering gates with an after gallery committed.**

## Accomplishments

- `side-peek.tsx`: `<aside aria-label="Side peek">` at `max(440px, 44%)`, sticky bar with `Open as page ↗` and `Close · esc`, `PageContent surface="peek"`, agenda padded by the peek width + 24px, skeleton and retry states.
- `inline-transcript.tsx`: collapsible transcript under the peek body; evidence marks the quoted span and scrolls the line to centre after 280ms.
- `search-popover.tsx`: 400px cmdk popover aligned end, `Search meetings and transcripts`, `Type to search meetings and transcripts`, `No matches for "{query}"`.
- `event-card.tsx`: `Open in side peek ↩`, `Open as page`, `Stop recording ⌘R` on live cards, `Delete meeting…` (danger, disabled while recording or finalizing).

## Task Commits

1. **Tasks 1–2** — `4a81f52` (feat)
2. **Task 3 (after gallery)** — `81c547f` (test)

## Verification

- `bun test` → 130 pass; `node --test .github/*.test.cjs` → 56 pass
- `node frontend/scripts/telu-palette.mjs check` → 0 offending classes; no raw-HTML API in living-doc, agenda, app-shell or side-peek
- `next build` → compiled and type-checked; after gallery → 146 passed (73 screens × 2 themes)

## Deviations from Plan

1. **[Scope] Supporting files:** `ui/context-menu.tsx` (Telu menu styles shared with the dropdown), `use-meeting-document.ts`, `useTranscriptLines` in the drawer, `navigateHome` on the delete alert, h2 peek titles in `meeting-header.tsx`.
2. **[Contract] Finalization assertion updated:** `RecordSlot` now returns only the search group while stopping; the assertion checks that form (record controls still disappear while stopping).
3. **[Fixture] Knowledge fixtures** now point claim links at the transcript line they quote.
4. **[Process] Two commits** (code, then the after gallery).

## Human Check Pending

- Compare `gallery/before` and `gallery/after` (light) for every existing screen, skim the dark set, and read the No evidence copy (A2), run notice wording (A4) and the delete dialog's audio line (A5). Dark stays off until approved (A1).

## Self-Check: PASSED

- Commits `4a81f52` and `81c547f` are on `codex/phase-01-baseline`.
