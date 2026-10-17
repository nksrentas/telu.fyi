---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 35
subsystem: testing
tags: [knowledge-eval, know-07, real-meeting-pilot, orientation, ami-corpus, held-out]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-34 evaluationKind labels (score --kind real_meeting_pilot) and the held-out pilot check in the status module
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-31 strict KNOW-07 eval CLI and the undeclared thresholds-v2.json (sha256 aa1261fa...ae79)
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-29 span verifier fix (42866bb), the freshness reference for every pilot run
provides:
  - Content-free real-meeting pilot report at eval/real-meeting-pilot-report.json (evaluationKind real_meeting_pilot, 3 fixtures, gate fail on input minimums)
  - The three pilot meeting ids, which the status module now excludes from the 02-37 held-out evaluation
  - Orientation numbers for the 02-36 threshold declaration (not the representative result)
affects: [02-36, 02-37, KNOW-07, phase-03]

actuals:
  tokens: 7300
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Export before review: predictions and labels are taken from the original model output, so in-app corrections cannot raise claimCorrectness"

key-files:
  created:
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/eval/real-meeting-pilot-report.json
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/02-35-SUMMARY.md
  modified: []

key-decisions:
  - "PILOT_MIN confirmed as 3 at the Task 1 checkpoint (user reply: pilot copied, minimum 3)"
  - "Pilot meetings are public AMI Meeting Corpus recordings (CC BY 4.0, participants consented to recording and public release), not the user's own meetings: ES2002b and ES2002c representative, ES2002a first 300 s as the insufficient-evidence meeting"
  - "Gold items come from AMI's human-written abstractive summaries (decisions and actions sentences); Claude mapped each gold sentence to Telu transcript segments"
  - "In-app review and labels.json were done by Claude, not the user, at the user's explicit request on 2026-10-17, under fixed accept/correct/reject rules"
  - "The export was taken before the review (deviation from the 02-33 step order) so labels score the original model output, not corrected text"

patterns-established:
  - "A pilot report is committed alone and checked, not attested: content-free, kind, threshold binding, size, freshness and eval/ isolation all pass before the commit"

requirements-completed: []

coverage:
  - id: D1
    description: "Pilot report is content-free, schemaVersion 1, evaluationKind real_meeting_pilot, bound to the sha256 of the undeclared thresholds-v2.json, and its gate is not pass"
    requirement: "KNOW-07"
    verification:
      - kind: other
        ref: "Task 2 verify 1 (contentFree, schema, kind, thresholdsSha256, thresholdsDeclared false, gate != pass): exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "At least PILOT_MIN=3 unique fixtures, each with its earliest knowledge run strictly later than the 02-29 fix commit"
    requirement: "KNOW-07"
    verification:
      - kind: other
        ref: "Task 2 verify 2 (fixture count and uniqueness) and verify 3 (read-only knowledge_runs freshness via PRAGMA query_only): exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Only real-meeting-pilot-report.json is new in eval/, representative-report.json is absent, and the committed status still equals the derived status"
    requirement: "KNOW-07"
    verification:
      - kind: other
        ref: "Task 2 verify 4 (git status of eval/): exit 0"
        status: pass
      - kind: unit
        ref: "node --test .github/verify-phase2-know07-status.test.cjs (14 pass, 0 fail)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Pilot report committed alone with the exact subject from the plan; KNOW-07 status still open"
    requirement: "KNOW-07"
    verification:
      - kind: other
        ref: "Task 2 verify 6 on f242705: exit 0; node .github/verify-phase2-know07-status.cjs -> open: quality_thresholds_undeclared, representative_evaluation_pending"
        status: pass
    human_judgment: false
  - id: D5
    description: "Pilot meetings, gold and review judgments are fit for orientation"
    requirement: "KNOW-07"
    verification:
      - kind: other
        ref: "Task 1 human checkpoint, user reply: pilot copied, minimum 3"
        status: pass
    human_judgment: true
    rationale: "Meeting choice, gold mapping and accept/correct/reject judgments are judgment calls. Here they were made by Claude on public AMI recordings at the user's request, so the numbers reflect Claude's judgment, not the user's."

duration: 90min
completed: 2026-10-17
status: complete
---

# Phase 02 Plan 35: Real-Meeting KNOW-07 Pilot Summary

**A content-free real-meeting pilot report was committed alone at `eval/real-meeting-pilot-report.json` (`evaluationKind: real_meeting_pilot`). It covers three public AMI Meeting Corpus recordings imported into Telu and is scored against the still-undeclared `thresholds-v2.json`. Its gate is `fail` on input minimums, as expected. The numbers are orientation for 02-36 only. The thresholds stay undeclared and KNOW-07 stays open.**

## Performance

- **Duration:** about 90 min. The Task 1 pilot (including the import fix) ran from the 16:09Z checkpoint to report generation at 17:34:02Z. Task 2 checks and commits took about 5 min.
- **Started:** 2026-10-17T16:09:01Z
- **Completed:** 2026-10-17T17:40:00Z
- **Tasks:** 2 of 2 (Task 1 human checkpoint resolved, Task 2 automated)
- **Files modified:** 1 eval file (the pilot report), plus this SUMMARY and STATE.md/ROADMAP.md tracking

## Accomplishments

- **Confirmed PILOT_MIN = 3.** The user replied "pilot copied, minimum 3" at the Task 1 checkpoint.
- **Fixture count: 3.** The ids are unique, and each meeting's earliest knowledge run (2026-10-17, 17:11Z to 17:13Z) is strictly later than the 02-29 fix commit `42866bb` (2026-09-28T17:10:24+03:00).
- **Gate and failures, verbatim:** `"gate": "fail"`, `"failures": ["inputs.representativeFixtures", "inputs.degradedCaptureFixtures"]`. These are input minimums. A three-meeting orientation pilot cannot meet them, and that is expected.
- **Report identity:** `schemaVersion` 1, `evaluationKind` `real_meeting_pilot`, `promptVersion` `knowledge-extract-v2`, `thresholdsSha256` `aa1261fae592fb70282e68cdd02192191c1f8ef0c9d3d9541c47764c0693ae79` (the committed, undeclared `thresholds-v2.json`), `gitCommit` `388ddd5`.
- **All six Task 2 verify commands passed.** The first five exited 0 before the commit and the sixth exited 0 after it.
- **Derived status unchanged:** `{"status":"open","reasons":["quality_thresholds_undeclared","representative_evaluation_pending"]}`.

## How to Read These Numbers

These facts change what the pilot measures. Read them before using any number below.

1. **Meetings source: public recordings, not the user's meetings.** The user chose public recordings over their own meetings. All three meetings come from the AMI Meeting Corpus (University of Edinburgh, CC BY 4.0). Its participants consented to recording and to public release. The audio is each meeting's `{meeting}.Mix-Headset.wav`.
   - ES2002b and ES2002c are the representative meetings.
   - ES2002a was cut to its first 300 s to serve as the insufficient-evidence meeting.
   - All three were imported through Telu's Import audio on a bundled debug build of this branch.
   - Audio, transcripts, gold and labels stay outside the repository, in `$HOME/telu-know07-audio` and `$HOME/telu-know07-pilot`.
2. **Gold comes from AMI's human-written abstractive summaries** (`ami_public_manual_1.6.2`).
   - Every AMI "decisions" sentence became a decision gold item. Every "actions" sentence became a commitment gold item, with owner set to the role AMI names (else null) and due set to null.
   - That gives 21 gold items: ES2002b has 8 decisions and 3 actions, ES2002c has 9 decisions and 1 action, and the ES2002a clip has 0 items with `expectAbstain: true`.
   - AMI "problems" were not used, and AMI has no fact annotations. Question and fact `evidenceCoverage` therefore cannot be measured (0/0).
   - Claude, not the user, mapped each gold sentence to the Telu transcript segments where it is said.
3. **Judgment was done by Claude, at the user's explicit request on 2026-10-17.** Claude did the in-app review (accept, correct or reject) and wrote `labels.json`; the user did not. The rules were:
   - `claimCorrect`: the item accurately reflects the meeting (a decision was actually made, a question was raised and left open, or a fact was asserted).
   - `quoteSupportsClaim`: the cited quote alone supports everything the item asserts.
   - Review: accept when both the claim and the quote hold. Correct when the claim is right but the wording claims more than the quote supports. Reject otherwise.
   - Outcome: 32 items, of which 17 were accepted, 3 corrected, 12 rejected and 0 left pending.
4. **The export was taken before the review.** This differs from the 02-33 step order (see Deviations). Predictions and labels therefore reflect the original model output, and corrections cannot raise claimCorrectness.
5. **The blocking import bug was fixed before any pilot run** (see Deviations, commit `388ddd5`).

## Orientation only, not the representative result

These metrics come from 3 public AMI meetings, with gold, review and labels done by Claude. They feed the 02-36 threshold declaration only as orientation. They are not the representative evaluation, they do not count toward the KNOW-07 gate, and no threshold values are proposed from them.

Per-scope metrics (numerator/denominator, value; "n/m" means not measurable):

| Scope | claimCorrectness | semanticSupport | exactSpanSupport | rawGrounding | evidenceCoverage | attribution | duplication |
|---|---|---|---|---|---|---|---|
| decision | 9/11 (0.818) | 3/11 (0.273) | 11/11 (1.000) | 11/13 (0.846) | 4/17 (0.235) | 22/22 (1.000) | 0/11 (0.000) |
| commitment | 3/4 (0.750) | 3/4 (0.750) | 4/4 (1.000) | 4/5 (0.800) | 3/4 (0.750) | 8/8 (1.000) | 2/4 (0.500) |
| question | 1/4 (0.250) | 4/4 (1.000) | 4/4 (1.000) | 4/5 (0.800) | 0/0 (n/m) | 8/8 (1.000) | 0/4 (0.000) |
| fact | 13/13 (1.000) | 12/13 (0.923) | 13/13 (1.000) | 13/15 (0.867) | 0/0 (n/m) | 26/26 (1.000) | 0/13 (0.000) |
| overall | 26/32 (0.813) | 22/32 (0.688) | 32/32 (1.000) | 32/38 (0.842) | 7/21 (0.333) | 64/64 (1.000) | 2/32 (0.063) |

Degraded capture: every metric is 0/0 (not measurable), because the pilot has no degraded-capture meeting.

Abstention: 1/1 (1.000).

Review outcomes (numerator/denominator per scope):

| Scope | accepted | corrected | rejected | pending |
|---|---|---|---|---|
| decision | 2/11 | 2/11 | 7/11 | 0/11 |
| commitment | 2/4 | 1/4 | 1/4 | 0/4 |
| question | 1/4 | 0/4 | 3/4 | 0/4 |
| fact | 12/13 | 0/13 | 1/13 | 0/13 |
| total | 17/32 | 3/32 | 12/32 | 0/32 |

Invariants: exactSpanSupport 32/32, resurrection 0, deletionResidue 0.

Reading notes, numbers only:
- Most decision items were judged correct claims (9/11), but few of their cited quotes alone supported them (3/11), which is why 7 of 11 decisions were rejected.
- Decision recall against AMI gold is low (4/17).
- Half of the commitment items were duplicates (2/4).
- Question and fact coverage cannot be measured with AMI gold.

## Task Commits

1. **Task 1: Run the real-meeting pilot outside the repository (orientation only).** This was a checkpoint:human-action (gate blocking-human), resolved by the user's reply "pilot copied, minimum 3". The pilot needed a blocking bug fix first: `388ddd5` (`fix(02-35): give imported audio a canonical meeting identity and evidence`).
2. **Task 2: Check the pilot report and commit it alone.** Commit `f242705` (`test(02-35): record real-meeting KNOW-07 pilot report (orientation only)`) contains only `eval/real-meeting-pilot-report.json`.

**Plan metadata:** committed with this SUMMARY (docs)

## Files Created/Modified

- `.planning/phases/02-evidence-linked-post-meeting-knowledge/eval/real-meeting-pilot-report.json`: the content-free pilot report, copied byte-for-byte from `$HOME/telu-know07-pilot/score/report.json` and never edited
- `frontend/src-tauri/src/audio/import.rs`: the import fix in `388ddd5`, with its regression test
- `.planning/phases/02-evidence-linked-post-meeting-knowledge/02-35-SUMMARY.md`: this file

Unchanged:
- `eval/pilot-report.json` (the 02-20 synthetic pilot) is byte-identical.
- `eval/representative-report.json` is absent.
- `eval/know-07-status.json`, `thresholds-v2.json` and `.planning/REQUIREMENTS.md` are unchanged.
- **The 02-32 and 02-33 SUMMARYs are unchanged** (no diff against HEAD and no commits since 02-34).

## Decisions Made

- **PILOT_MIN = 3.** This is the plan's proposed minimum (two representative meetings and one insufficient-evidence meeting), confirmed by the user.
- **Public AMI recordings instead of the user's meetings.** This was the user's choice. Consent comes from AMI's recording and public-release consent. These three meetings are now the pilot and can never be held-out meetings.
- **Claude did the review and labeling at the user's request.** The rules above were fixed before any item was judged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Telu's audio import had been broken since Phase 1**
- **Found during:** Task 1, before any pilot run
- **Issue:** `create_meeting_folder` required a canonical UUID, but import passed the meeting title, so every import failed. Imported meetings also lacked lifecycle and completeness state and `transcript_evidence`, so Find knowledge could not run on them.
- **Fix:** Imported audio now gets a canonical meeting identity and evidence, with a regression test.
- **Files modified:** `frontend/src-tauri/src/audio/import.rs`
- **Commit:** `388ddd5`

### Procedural Deviations

**2. Export taken before the review (02-33 step order reversed)**
- **Reason:** The export reads the current, corrected item text. Exporting after review would score corrected wording and could raise claimCorrectness.
- **Effect:** Predictions and labels both reflect the original model output. Review outcomes are still recorded from the app.

**3. Gold, review and labels by Claude, not the user**
- **Reason:** The user explicitly requested it on 2026-10-17.
- **Effect:** The pilot reflects Claude's judgment under the rules listed above. It is orientation only, as the plan requires in any case.

## Notes for 02-37 (held-out, not part of this plan)

- Prepared held-out audio is in `$HOME/telu-know07-audio/heldout`: ES2004c, IS1009c, TS3003c, ES2008b, EN2002b, IS1009a (first 5 min), and ES2004d with gaps. None of these are pilot meetings.
- EN2002b has no AMI abstractive summary. Swap it for TS3003b to keep AMI human gold.
- Imported audio is recorded as capture-complete, so the app cannot see the gaps in the degraded-capture meeting (they are silence). Its degraded-capture category is a label only.

## Consequences

- **The thresholds stay undeclared.** `thresholds-v2.json` is untouched, and its sha256 is still `aa1261fa...ae79`.
- **KNOW-07 stays open** (`quality_thresholds_undeclared`, `representative_evaluation_pending`). It is not listed under `requirements-completed`, `requirements.mark-complete` was not run, and REQUIREMENTS.md was not edited.
- Now that the pilot report is committed, the status module's `representative_not_held_out` rule excludes these three meetings from any representative report.

## Issues Encountered

None beyond the import bug above.

## User Setup Required

None.

## Next Phase Readiness

- 02-36 (the threshold declaration) can now proceed: a committed pilot exists as orientation. The declaration remains the user's decision.
- 02-37 needs at least 5 representative meetings, 1 insufficient-evidence meeting and 1 degraded-capture meeting, none from this pilot, each with a fresh first run and scored after the declaration commit.

---
*Phase: 02-evidence-linked-post-meeting-knowledge*
*Completed: 2026-10-17*

## Self-Check: PASSED

- FOUND: .planning/phases/02-evidence-linked-post-meeting-knowledge/eval/real-meeting-pilot-report.json
- FOUND: .planning/phases/02-evidence-linked-post-meeting-knowledge/02-35-SUMMARY.md
- FOUND commits: f242705 (pilot report, alone), 388ddd5 (import fix)
- Task 2 verify 1 to 5 exit 0 before the commit; verify 6 exit 0 after it
- Status module: open, quality_thresholds_undeclared, representative_evaluation_pending
- Frontmatter: requirements-completed: [], status: complete
