# Phase 2 — UI Review

**Audited:** 2026-09-28
**Baseline:** 02-UI-SPEC.md (approved) + sketch-findings-telu-fyi
**Screenshots:** existing Playwright WebKit gallery (`gallery/after/light`, 73 screens; stubbed IPC, time frozen 2026-09-27 10:46). No new captures. Dark set is pending user approval (A1) and is not scored.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Knowledge, delete and empty-state copy match the contract. Legacy strings are still visible: "Add context for AI summary…", "Regenerate Summary", "Summary completed", "Waiting for authoritative recording status", and Title Case in Settings |
| 2. Visuals | 2/4 | The legacy summary editor sits inside the living doc. Its 60px+ duplicate H1 dominates the page and the peek, and pushes Knowledge far below the fold |
| 3. Color | 3/4 | The palette gate passes (0 offending classes) and accent stays on its reserved list. The evidence popover glass is too translucent, so the rows behind it show through |
| 4. Typography | 2/4 | The summary markdown renders at display sizes far above the 13.5px Summary spec. There are 14 `font-bold` usages outside title roles and one 10px label |
| 5. Spacing | 3/4 | The shell, cards and candidate rows follow the scale. The summary block, the context textarea and the peek header break the 44px doc rhythm |
| 6. Experience Design | 2/4 | Recording state contradicts itself: Today says "No meetings recorded today" while the capsule records. The meeting meta disagrees with the card (12:00–12:00 · 1 min vs 10:02–10:46 · 44 min). The Today and Review counts are missing on Today |

**Overall: 15/24**

---

## Top 3 Priority Fixes

1. **BLOCKER: the legacy summary UI is embedded in the living doc** (meeting-page-complete, review-peek-open). The provider card, the "Add context for AI summary" textarea, the button toolbar and the BlockNote H1/H2 at display size replace the spec'd Summary block (13.5px/1.55, max 620px). In the peek, the title "Weekly product sync" wraps across three lines at display size and Knowledge, the phase's core surface, never reaches the viewport. Fix: render the summary as read-only markdown mapped to Body/Heading roles (h1 hidden or demoted to 15px/600). Move Regenerate, template, model and context behind the Summary `⋯` menu. Drop the "Summary completed" status card.
2. **BLOCKER: recording state is inconsistent** (home-recording). The capsule shows "Weekly product sync 12:34 Stop" while the Today empty state says "No meetings recorded today". D-04 requires the recording meeting to appear on Today. In today-populated, the opposite happens: a Recording card exists but the toolbar still shows `Record ⌘R` instead of the capsule, which breaks "one control, never two". The recording card eyebrow also has no timer. Fix: derive the capsule and the Recording card from the same recording state, and add the eyebrow timer.
3. **WARNING: meeting metadata disagrees across surfaces** (review-peek-open, meeting-page-complete). The card says `10:02–10:46 · 44 min`, but the page and peek chips say `Sun 27 Sep · 12:00–12:00 · 1 min`. This undermines trust in an evidence product. Fix: build the meta chips from the same start/end source as EventCard, and add a gallery assertion that both agree.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- PASS: ReviewHead, `Accept all`, `Owner not stated`, EVIDENCE eyebrow, `Found Sep 27, 12:46 · Local`, the delete Alert title and body with counts, `The audio file isn't deleted yet.`, the Today empty state, the `N items need a look` subtitle and `Stored on this Mac` all match the contract.
- WARNING: `app/meeting-details/page-content.tsx:336` still has the placeholder "Add context for AI summary. For example people involved, meeting overview, objective etc..." ("etc..." and "AI" jargon; not in the contract).
- WARNING: `components/MeetingDetails/SummaryGeneratorButtonGroup.tsx:124` and `components/AISummary/index.tsx:783` use Title Case "Regenerate Summary". The contract requires sentence case.
- WARNING: `app/_components/StatusOverlays.tsx:23` shows "Waiting for authoritative recording status" as the Finalizing card meta. The contract wants the Phase 1 detail `{n} segments remaining · oldest waiting {age}`. The fallback wording is engineer-speak.
- WARNING: Settings uses Title Case ("Data Storage Locations", "Open Folder", "Enable Analytics", "Meeting Recordings").
- Minor: the peek-less Review subtitle "4 items · accept, correct or reject what …" truncates once the peek opens.

### Pillar 2: Visuals (2/4)
- BLOCKER: the summary block has a duplicate H1 in BlockNote at about 3x the page H1 (meeting-page-complete). There are two competing focal points, and the page H1 loses.
- BLOCKER: in the peek (review-peek-open), the title header is faded under the sticky bar, and the summary H1 wraps across three lines. Knowledge is not visible without a long scroll.
- WARNING: the summary toolbar in the peek collapses to icon-only buttons. The first button is blank (white-on-white Regenerate), and the icon buttons have no visible labels.
- WARNING: the compact doc title overlaps a ghosted "Action items" heading in the toolbar (knowledge-evidence-popover-open). The toolbar glass does not obscure scrolled content enough.
- WARNING: an extra toolbar element, `Local · This device`, sits inside the Record glass group. It is not in the toolbar contract and adds noise beside Record.
- PASS: EventCard states, chips, the amber pending bar, the knowledge-type glyphs and the delete Alert composition are faithful to the sketch.

### Pillar 3: Color (3/4)
- `node frontend/scripts/telu-palette.mjs check` reports 0 offending classes, and no hardcoded 6-digit hex values appear in .tsx.
- Accent usage is on the reserved list: sidebar icons, `‹ Today`, `Accept` tinted, Decision type, the selected card ring and the `Review` tinted button.
- WARNING: the evidence popover glass lets the underlying row's "design", `Accept`, `Correct` and `0:12` bleed through (knowledge-evidence-popover-open). This hurts legibility of the quote surface. Raise the glass opacity or blur for popovers.
- WARNING: the Regenerate Summary button renders near-invisible (white on white) in the summary toolbar.
- Pending (A1): the dark set is not audited as a defect.

### Pillar 4: Typography (2/4)
- BLOCKER: summary markdown headings render at about 50–60px ("Weekly product sync", "Decisions", "Action items", "Open questions"). The contract caps content at Display 26px and specifies 13.5px for the summary paragraph.
- WARNING: there are 14 `font-bold` usages outside title roles, including `components/ModelSettingsModal.tsx:1330,1332`, `app/_components/SettingsModal.tsx:154` and `components/About.tsx:101`. The 700 weight is contract-limited to titles.
- WARNING: `components/agenda/agenda-timeline.tsx:127` uses `text-[10px]`. This violates "nothing below 10.5px", although the spec's own Review day-label line also says 10px, so the spec should be reconciled.
- The size distribution in .tsx is sane: 13px (47), 11px (43), 12px (36), 15, 17, 14, 13.5 and 10.5, which is within the declared set plus exceptions.

### Pillar 5: Spacing (3/4)
- PASS: sidebar insets, 8px card gaps, candidate row grid and padding, and toolbar glass groups match the scale in the screenshots.
- WARNING: the Summary section stacks a provider card, a textarea, a toolbar card and an editor card with about 24px gaps. This breaks the single-block 44px doc rhythm and the 620px summary measure.
- WARNING: the Settings toolbar band paints `--window-bg` with a hairline, while the other shell views are transparent over `--content-bg`. The visual seam is inconsistent.

### Pillar 6: Experience Design (2/4)
- BLOCKER: recording contradictions (see fix 2).
- WARNING: the meta mismatch between the card and the page/peek (see fix 3).
- WARNING: in today-populated, the sidebar counts for Today and Review are absent with 8 meetings and 3 to review, while review-peek-open shows `Today 2 · Review 4`. Either the fixtures diverge or the counts do not load on first render. Verify.
- WARNING: `app/notes/[id]/page.tsx:174` uses `dangerouslySetInnerHTML`. It is not a Phase 2 surface, but it conflicts with the security-visible rule if notes render transcript or LLM text.
- PASS: the delete Alert has default focus on Cancel with a visible ring, counts first, coral Delete last, and loading, error and zero variants in the gallery. Knowledge states (running, failed, route-unavailable, abstained, no-evidence, gap, overflow-45) all have gallery coverage.

---

## Registry Safety

shadcn is initialized. The UI-SPEC lists only shadcn official plus radix-ui, with no third-party registries. Registry audit: 0 third-party blocks checked, no flags.

---

## Files Audited
- .planning/phases/02-evidence-linked-post-meeting-knowledge/02-UI-SPEC.md, 02-CONTEXT.md
- gallery/after/light: today-populated, home-recording, meeting-page-complete, knowledge-evidence-popover-open, review-peek-open, delete-alert-counts, settings-general
- frontend/src/app/meeting-details/page-content.tsx, components/MeetingDetails/SummaryGeneratorButtonGroup.tsx, components/AISummary/index.tsx, app/_components/StatusOverlays.tsx, components/agenda/agenda-timeline.tsx, components/ModelSettingsModal.tsx, app/_components/SettingsModal.tsx, app/notes/[id]/page.tsx
- Palette gate: frontend/scripts/telu-palette.mjs check (0 offending)

---

## Orchestrator Triage (2026-09-28)

Findings re-checked against code before gap planning:

- **Fix 1 confirmed, real gap.** `meeting-page-complete.png` shows the legacy summary panel (provider card, context textarea, button toolbar with an unreadable Regenerate button, BlockNote display-size H1/H2) inside the living doc. 02-10-SUMMARY deferred the BlockNote heading restyle to 02-14 and no later plan picked it up, so the UI-SPEC Summary block (13.5px/1.55, max 620px) is unmet.
- **Fix 2 is mostly a gallery fixture mismatch.** `useAgendaRefresh` (`components/agenda/agenda-timeline.tsx`) reloads the day whenever the recording status changes, so the empty Today beside a live capsule comes from the `home-recording` stub returning an empty day, and the Recording card beside `Record ⌘R` comes from the `today-populated` stub pairing a recording card with an idle status. Align those fixtures; confirm live behaviour in the pending real-recording check (02-19). The missing eyebrow timer on the Recording card stands as reported.
- **Fix 3 values are fixture data, but the two-source design is real.** The page and peek header build time from `meeting.createdAt + durationSeconds` (`living-doc/meeting-header.tsx`), while cards use the Rust agenda start and end. `12:00–12:00 · 1 min` comes from the `get_meeting` stub. Deriving both surfaces from one source remains a sound hardening item.
