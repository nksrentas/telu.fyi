# Phase 2: Evidence-Linked Post-Meeting Knowledge - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-27
**Phase:** 02-evidence-linked-post-meeting-knowledge
**Areas discussed:** Where review lives, When extraction runs, Corrections & thin evidence, Deleting a meeting
**Mode:** advisor (research-backed comparison tables, calibration: minimal_decisive)

Before the discussion, during `/gsd-plan-phase` routing, the user chose "Phase 2 with the new UI" over "Insert a UI foundation phase first", "Update the roadmap first" and "Phase 2 as scoped".

---

## Where review lives

| Option | Description | Selected |
|--------|-------------|----------|
| Living-doc meeting page + Review row (recommended) | The new UI on the meeting page plus a Review list, with tokens and fonts scoped to the new screens. The full shell and four tabs wait for Phase 5. | |
| Full shell now | App-wide token and font swap, A's four-tab sidebar and the peek, with a larger Phase 2 scope. | ✓ |

**User's choice:** Full shell now.

**Follow-up — tabs without data:**

| Option | Description | Selected |
|--------|-------------|----------|
| Real data only (recommended) | Today = recorded meetings with their review state, and Review = pending items. The other tabs appear once their data exists. Calendar detection is noted for the roadmap. | ✓ |
| All four tabs, empty states | Show every tab now, with designed empty states. | |

**Follow-up — where recording lives:**

| Option | Description | Selected |
|--------|-------------|----------|
| In the shell (recommended) | Toolbar Record (⌘R), the recording capsule, the meeting on Today, and the live transcript in its page or peek. Replaces the old recording page, keeping Phase 1 behavior. | ✓ |
| Keep the recording page | Re-skin the existing recording page as its own view. | |

**Notes:** Researchers flagged that the full shell needs its own first wave, with visual regression checks on every existing screen. Accepted items read "Accepted · eligible" instead of "In Memory" until series Memory exists in Phase 5.

---

## When extraction runs

| Option | Description | Selected |
|--------|-------------|----------|
| Own run beside the summary (recommended) | Runs automatically only when the meeting is Complete and the route is validated; otherwise the user starts it. The summary is unchanged. Each regenerate is a new run; rejected items stay suppressed, and accepted ones are matched, not shown twice. | ✓ |
| One combined pipeline | The summary is rendered from the typed items: one model call, but it inherits overwrite-on-save and needs the templates and prompts rewritten. | |

**User's choice:** Own run beside the summary.

---

## Corrections & thin evidence

| Option | Description | Selected |
|--------|-------------|----------|
| Corrected marker + "not stated" (recommended) | A visible "Corrected" marker with a history popover, and a "Rejected (n)" group with Restore. Each claim must match an exact transcript span or Telu abstains, with the skipped count shown. An owner or due date without evidence shows as "not stated". | ✓ |
| Drawer history + strict skip | History only in a drawer, and an item is dropped unless every field has a span. | |

**User's choice:** Corrected marker + "not stated".

---

## Deleting a meeting

| Option | Description | Selected |
|--------|-------------|----------|
| Remove all, show counts first (recommended) | One transaction removes everything derived from the meeting, the confirm dialog shows counts, and there's no undo in Phase 2. | ✓ |
| Keep accepted, mark "source deleted" | Accepted items survive, flagged and excluded until re-confirmed. | |

**User's choice:** Remove all, show counts first.
**Notes:** This resolves the prototype's conflicting "Items already in Memory stay" alert copy in favor of KNOW-08.

---

## Claude's Discretion

- Evaluation harness design (KNOW-07), within the ROADMAP exit-gate rules.
- Rust module and table names, prompt design, provider and model choice within existing routes, matching and normalization details, file structure and copy.
- How non-meeting screens sit inside the new shell, provided they use the tokens and pass visual regression.

## Deferred Ideas

- Calendar detection and series from the calendar (INTG-01), bringing the Upcoming and Found in Calendar tabs and C's onboarding. Needs its own phase.
- The Island (user-designated MUST). Needs its own phase.
- The Series tab, series living doc and Memory: Phase 5.
- Deletion undo and cleanup of files, run bundles and caches: HARD-02, Phase 6.
- Transcript-level deletion.
