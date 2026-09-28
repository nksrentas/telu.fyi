# Phase 2: Evidence-Linked Post-Meeting Knowledge - Context

**Gathered:** 2026-09-27
**Status:** Ready for planning

<domain>
## Phase Boundary

A completed meeting becomes trustworthy, typed candidate knowledge: decisions, commitments or action items, open questions, and relevant facts. Each candidate carries a stable identity, its derivation run, its review state and the exact transcript evidence behind it. The user can inspect that evidence in context, and accept, correct or reject each item. Corrections become auditable revisions. Rejected items never come back unless the user restores them. Telu abstains when evidence is thin. Deleting a meeting removes everything derived from it. An evaluation harness measures extraction quality against thresholds declared before evaluation.

By the user's explicit choice, this phase also ships the approved redesign as the app's shell: Telu design tokens, the SF system font, native window chrome, a sidebar with the tabs that have real data (Today and Review), recording started from the shell, and the meeting page in the living-doc style.

Out of scope: calendar detection and calendar-backed tabs (Upcoming, Found in Calendar), series and series Memory, the Island, the first-run onboarding, document ingestion, live assistance, and deletion undo or file/cache cleanup.

</domain>

<decisions>
## Implementation Decisions

### Review UI and Design-System Migration (user chose "full shell now")
- **D-01:** Phase 2 ships the approved design system app-wide in one change. Telu tokens (light and dark) replace the shadcn HSL variables in `globals.css` and the Tailwind theme, the SF system font stack replaces Source Sans 3, and every existing screen is re-skinned (settings, model managers, permission/onboarding screens, meeting pages). This migration is its own first plan wave, with visual regression checks on every existing screen. — **Reversibility:** costly — about 35 files use shadcn token classes, plus every screen and the 900-line sidebar.
- **D-02:** The new shell follows the design skill: Tauri overlay title bar with hidden title and inset traffic lights, a translucent (vibrancy) sidebar, and agenda/doc toolbars with glass groups. The sidebar shows only tabs backed by real data: **Today** and **Review**. Upcoming, Found in Calendar and Series appear only once their data exists (calendar integration phase, Phase 5). No fake or placeholder data. — **Reversibility:** costly — window config, shell layout and navigation model change together.
- **D-03:** **Today** is the agenda timeline of meetings *recorded* on that day, from the meetings table. Each card shows its Telu state: recording, finalizing, "N to review", filed, or incomplete/recovered with gaps. It uses the EventCard/agenda components; the day stepper (←/→) navigates past days, and search finds older meetings. There are no calendar events yet.
- **D-04:** Recording lives in the shell. The toolbar Record button (⌘R) starts a meeting, using the Rust-allocated canonical id from Phase 1. While recording, the toolbar shows the recording capsule, the meeting appears on Today, and its meeting page or side peek shows the live transcript. This replaces the old recording home page and must keep every Phase 1 behavior: stop and finalization progress with real queue depth and oldest age, recovery reconciliation, completeness gaps, and provider boundary labels before data-bearing work. — **Reversibility:** costly — the recording UX and its Phase 1 hooks move into new components.
- **D-05:** The meeting page is a single-meeting page in the living-doc style (720px column): header, Summary, a Knowledge section (ReviewHead + CandidateRow), and a transcript drawer that highlights the evidence segment. The existing markdown summary stays and is labeled "unreviewed". Clicking a meeting on Today opens the side peek with the same blocks; "Open as page" opens the full page. There is no Docs section (document ingestion is Phase 3).
- **D-06:** Accepted items are meeting-scoped and labeled **"Accepted · eligible"**, not the prototype's "In Memory". Series Memory is Phase 5, and automatic promotion into it is a non-goal.
- **D-07:** The **Review** tab lists meetings with pending candidates ("N to review") and opens each meeting's review.

### Extraction Runs
- **D-08:** Extraction is its own append-only derivation run, separate from the markdown summary; the summary flow stays unchanged. Runs, candidates, reviews and revisions live in new Rust-owned SQLite tables. Earlier runs are never mutated. — **Reversibility:** one-way — new migration and an append-only eligibility contract that Phases 3–5 will read.
- **D-09:** Extraction runs automatically only when all three hold: the auto-generate setting is on, the meeting's completeness is `Complete`, and the provider route is `validated` (reuse the existing gate in `page-content.tsx`). Incomplete or recovered meetings need an explicit user start, with their gaps shown. The Local/LAN/Remote label and destination appear before the data-bearing call, with no silent fallback (Phase 1 D-18/D-19).
- **D-10:** Extraction input comes from finalized `transcript_evidence` segments (stable evidence ids), not the legacy `transcripts` table. The read path that lists evidence by meeting, which doesn't exist yet, is part of this phase.
- **D-11:** Regenerate always creates a new run. New candidates are matched against existing items by type, normalized text and overlapping evidence ids:
  - a match to a rejected or superseded item is suppressed, recorded and never shown unless the user restores it (KNOW-05);
  - a match to an accepted item is linked as "reconfirmed" and not shown again;
  - an unmatched candidate appears as a new proposed candidate.
  - Amended 2026-09-28 (gap closure 02-27, user-accepted): rejected and corrected-away wording is matched regardless of type (KNOW-05); type stays a match key only for the reconfirmed/duplicate outcomes against the current wording of accepted and proposed items. Consequence for D-12: a correctly-typed re-emission of a wrongly-typed rejected item is also suppressed; Restore returns it with its original type.

### Trust Rules
- **D-12:** Corrections create append-only revisions and never update in place. The correctable fields are text, owner and due date. Type isn't correctable; a wrong type is rejected instead. — **Reversibility:** one-way — revision lineage is a persisted audit contract (KNOW-04).
- **D-13:** A corrected item shows "✓ Corrected". Clicking it opens the history popover: the original proposal, each revision with its timestamp, and the unchanged evidence.
- **D-14:** Rejected items sit in a collapsed "Rejected (n)" group under the review header, each with Restore. Restoring is the only way a rejected item returns.
- **D-15:** Evidence rule: every claim's text must be backed by at least one exact quote span, which Rust verifies as a verbatim substring (after normalization) of a finalized `transcript_evidence` segment. If verification fails, Telu abstains: the item isn't shown, the run records the skipped count, and the review header says "n possible items skipped — not enough evidence".
- **D-16:** An owner or due date without its own supporting span shows as "not stated" (weaker, dashed). The user fills it in through Correct. An accepted item keeps these fields empty and shows as unresolved (KNOW-06).

### Deletion
- **D-17:** Deleting a meeting removes everything derived from it in one transaction: candidates, accepted items, revisions, reviews, evidence links and runs. The deletes are explicit, backed by a test asserting zero rows remain in every derived table; don't rely on the implicit foreign-key cascade default. — **Reversibility:** one-way — the data is destroyed.
- **D-18:** The confirm dialog shows counts first ("3 accepted items and 5 suggestions from this meeting will be removed from this Mac"), with default focus on Cancel. There's no undo in Phase 2. Cleanup of audio folders, run bundles and caches stays with HARD-02 (Phase 6).

### Claude's Discretion
- **Evaluation harness (KNOW-07):** the gold set comes from representative meetings, including insufficient-evidence and degraded-capture cases. Metrics are reported by item type: claim correctness, exact-span support, attribution, duplication and review outcome, with thresholds declared before evaluation (ROADMAP exit gate). Reuse Phase 1's run bundles and evaluation tables where they fit.
- Rust module and table names, prompt design, extraction provider and model choice within the existing route system, text-normalization and matching details, component file structure (kebab-case), and exact copy.
- How non-meeting screens (settings, model managers) sit inside the new shell, provided they use the tokens and pass visual regression.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product Intent and Phase Contract
- `.planning/PROJECT.md`: product value, local-first constraints, evidence requirements.
- `.planning/REQUIREMENTS.md`: KNOW-01 through KNOW-08 are normative for this phase. HARD-02 and SERIES-07 give context for deletion.
- `.planning/ROADMAP.md` § Phase 2: goal, success criteria, non-goals, verification approach, exit gate, stop conditions.
- `.planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-CONTEXT.md`: D-08–D-12 (canonical meeting id, final-only evidence, stable evidence ids, lifecycle) and D-18/D-19 (provider boundaries, no silent fallback).
- `docs/telu/README.md` and `docs/telu/idea-verification.md`: the before/during/after model and the evidence-aware behavior.

### Design (approved redesign — MUST follow)
- `.claude/skills/sketch-findings-telu-fyi/SKILL.md`: direction, hard rules, and the "Resolve before building" list (the KNOW-04/06/08 conflicts are resolved by D-12–D-18 above).
- `.claude/skills/sketch-findings-telu-fyi/references/foundations-and-motion.md`: tokens, the paste-ready token block, the Tailwind mapping, the shadcn collision fix, and the motion presets (`SPRING` / `SPRING_BOUNCE`).
- `.claude/skills/sketch-findings-telu-fyi/references/primitives-and-overlays.md`: Button, controls, Popover, Menu, Alert (destructive: focus Cancel), Toast (sonner), Tooltip, EvidencePopover.
- `.claude/skills/sketch-findings-telu-fyi/references/app-shell-and-navigation.md`: window chrome, sidebar, toolbars, recording capsule, keyboard map, Tauri mapping.
- `.claude/skills/sketch-findings-telu-fyi/references/calendar-and-agenda.md`: agenda timeline, EventCard states, ReviewPage.
- `.claude/skills/sketch-findings-telu-fyi/references/living-doc-and-side-peek.md`: meeting body, ReviewHead, CandidateRow, KnowledgeRow, TranscriptDrawer, side peek, and the trust requirements.
- `.claude/skills/sketch-findings-telu-fyi/references/component-inventory.md`: full props, states and motion for every component.
- `.planning/sketches/002-final-app/`: the approved prototype (source of truth for look and behavior).
- `.planning/sketches/003-component-catalog/`: every component state and 54 animations, with Replay.
- `docs/telu/color-palette.md`: brand palette and color semantics.

### Code Touchpoints (from scout)
- `frontend/src-tauri/migrations/20260920000200_phase1_transcript_evidence.sql`: evidence table (stable ids; there's no list-by-meeting API yet).
- `frontend/src-tauri/src/database/repositories/transcript.rs`, `database/repositories/meeting.rs` (`delete_meeting_with_transaction` at lines 1190–1231; `reconcile_meeting`; lifecycle/completeness), and `database/models.rs` (`MeetingCompleteness`).
- `frontend/src-tauri/src/summary/commands.rs` (`api_process_transcript`), `summary/service.rs`, `database/repositories/summary.rs` (overwrite and backup behavior), and `trust/provider_route.rs` (Local/LAN/Remote).
- `frontend/src-tauri/src/database/repositories/evaluation.rs` and `observability/run_bundle.rs`: Phase 1 evaluation and run-bundle infrastructure.
- `frontend/src/app/meeting-details/page-content.tsx` (auto-generate gate at lines 259–280), `components/MeetingDetails/*`, `components/Sidebar/index.tsx`, `app/page.tsx` (current recording home), `hooks/useRecordingStop.ts`, `contexts/TranscriptContext.tsx`.
- `frontend/src/app/globals.css`, `frontend/tailwind.config.js` and `frontend/src/app/layout.tsx`: the token, theme and font migration.
- `frontend/src-tauri/tauri.conf.json`: window chrome (decorations and title bar style; `macOSPrivateApi` is already on).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `transcript_evidence` (Phase 1): finalized segments with stable UUID evidence ids, time bounds and a capture-completeness flag. This is the extraction input and the evidence target for CandidateRow and TranscriptDrawer.
- The summary pipeline's provider routing (`trust/provider_route.rs`, `llm_client.rs`, `authorize_and_record_dispatch`) can host the extraction call, which inherits Local/LAN/Remote labeling.
- The auto-generate gate in `page-content.tsx` (`shouldAutoGenerate` plus a validated route), extended with a `Complete` completeness check.
- `EvaluationRepository` and `RunBundleWriter` (Phase 1). `StageName` already reserves generation stages.
- shadcn/Radix primitives already installed. Per the skill: add toggle-group, checkbox, collapsible, context-menu and alert-dialog. framer-motion 11.18.2 (supports `visualDuration`), sonner, cmdk, lucide.

### Established Patterns
- Rust owns persistence and orchestration; React calls Tauri commands (direct `invoke` in hooks, thin services, contexts such as `SidebarProvider`).
- Rust tests are inline `#[cfg(test)]` / `#[tokio::test]` on in-memory SQLite with `sqlx::migrate!`, plus integration tests in `src-tauri/tests/`. Frontend tests use `bun:test` in `frontend/tests/`.
- The app is a Next.js static export (`output: 'export'`), so use query-param routes, not dynamic segments.

### Integration Points
- A new Rust `knowledge` module (runs, candidates, reviews, revisions, evidence validation, matching and suppression) with Tauri commands for list, accept, correct, reject, restore, regenerate and deletion counts.
- Meeting deletion (`delete_meeting_with_transaction`) gains explicit derived-table deletes and a count query for the confirm dialog.
- The meeting page and sidebar are replaced by the new shell. Recording hooks (`useRecordingStop`, `TranscriptContext`, recovery) move under the shell's toolbar and meeting page without losing Phase 1 behavior.
- Gap found by the scout: the meeting page and summary input still read the legacy `transcripts` table, while canonical meetings write only `transcript_evidence`. Phase 2's views and extraction must read evidence.

</code_context>

<specifics>
## Specific Ideas

- The user explicitly chose "Phase 2 with the new UI" and then "full shell now". The redesign should arrive for real in this phase, not as a panel added to the old screens.
- No fake data anywhere: tabs and states appear only when real data backs them.
- The prototype conflicted with the requirements; the requirements win. The delete dialog must not say "items in Memory stay". Accepted items are "Accepted · eligible", not "In Memory". Correction history and abstention have visible UI.
- Keyboard actions never animate (fix 002's ⌘[ fade and Esc peek slide-out, per the skill).

</specifics>

<deferred>
## Deferred Ideas

- **Calendar detection and series from the calendar** (INTG-01, currently v2): the user wants this as core. It needs its own phase (roadmap update), which brings the Upcoming and Found in Calendar tabs.
- **The Island**: user-designated MUST feature from the redesign. Needs its own phase (it depends on brief and live data from Phases 3–4).
- **C's first-run onboarding** (calendar permission → choose what to remember → ⌥Space): arrives with calendar detection.
- **The Series tab and series living doc / Memory**: Phase 5.
- **Undo for deletion, and cleanup of audio folders, run bundles and caches**: HARD-02, Phase 6.
- **Transcript-level (partial) deletion**: not a feature today; later phase if needed.

</deferred>

---

*Phase: 02-evidence-linked-post-meeting-knowledge*
*Context gathered: 2026-09-27*
