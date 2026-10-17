---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 36
subsystem: testing
tags: [knowledge-eval, know-07, thresholds, declaration, gap-closure]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-35 real-meeting pilot report scored against the undeclared thresholds-v2.json (sha256 aa1261fa...ae79), committed in f242705
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-34 evaluationKind labels and the status module's held-out pilot check
provides:
  - Declared thresholds-v2.json (all 31 quality leaves, sha256 a0a8db80...66ae), committed alone in 27c10dc
  - Re-derived eval/know-07-status.json (open, representative_evaluation_pending only)
  - Synthetic report re-bound to the declared file (evaluationKind synthetic, gate fail)
affects: [02-37, KNOW-07, phase-03]

actuals:
  tokens: 5200
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Declaration order is checked by git ancestry and by the pilot's thresholdsSha256 matching the declaration commit's parent version of the file"

key-files:
  created:
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/02-36-SUMMARY.md
  modified:
    - frontend/src-tauri/tests/fixtures/knowledge-eval/thresholds-v2.json
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/eval/know-07-status.json
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/eval/synthetic-report.json

key-decisions:
  - "Task 1 resolved as option-declare. The user delegated the declaration on 2026-10-17; Claude (the orchestrator) declared the 31 values from the project's core value and the Phase 2 goal and exit gate, not from the pilot or synthetic numbers"
  - "KNOW-07 thresholds v2: abstention 1.0; every scope semanticSupport 0.9, evidenceCoverage 0.5, attribution 0.9, maxDuplication 0.1, minReviewAccepted 0.75, claimCorrectness 0.9 (question 0.8)"
  - "Thresholds fixed before any held-out meeting was imported; 02-37 has not started"

patterns-established:
  - "A threshold declaration is committed alone, then the status and synthetic report are re-derived in the next commit"

requirements-completed: []

coverage:
  - id: D1
    description: "thresholds-v2.json holds all 31 declared leaves, is valid and declared per the status module, and keeps version 2, the invariants, key order and formatting"
    requirement: "KNOW-07"
    verification:
      - kind: other
        ref: "Task 2 verify 1 (thresholdsValid && thresholdsDeclared): exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Declaration committed alone with the exact subject, after the pilot commit, and the pilot was scored against the pre-declaration file"
    requirement: "KNOW-07"
    verification:
      - kind: other
        ref: "Task 2 verify 2 (27c10dc contains only thresholds-v2.json, subject exact): exit 0"
        status: pass
      - kind: other
        ref: "Task 2 verify 3 (f242705 strict ancestor of 27c10dc; pilot thresholdsSha256 equals sha256 of 27c10dc^:thresholds-v2.json): exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Status re-derived from the module (open, representative_evaluation_pending only); synthetic report bound to the declared sha256, kind synthetic, gate fail; committed together without REQUIREMENTS.md"
    requirement: "KNOW-07"
    verification:
      - kind: other
        ref: "Task 3 verify 1 (status file equals module output, single reason): exit 0"
        status: pass
      - kind: other
        ref: "Task 3 verify 2 (synthetic thresholdsSha256, gate fail, evaluationKind synthetic): exit 0"
        status: pass
      - kind: unit
        ref: "node --test .github/verify-phase2-know07-status.test.cjs (14 pass, 0 fail)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The 31 values are the quality the product requires"
    requirement: "KNOW-07"
    verification:
      - kind: other
        ref: "Task 1 decision checkpoint, delegated by the user on 2026-10-17"
        status: pass
    human_judgment: true
    rationale: "The values are a product judgment. The user delegated it; Claude made it from the core value and the Phase 2 exit gate. The user can confirm or revise them as a new version before 02-37 scores anything."

duration: 8min
completed: 2026-10-17
status: complete
---

# Phase 02 Plan 36: KNOW-07 Threshold Declaration Summary

**All 31 KNOW-07 quality thresholds in `thresholds-v2.json` are now declared. The file was committed alone (`27c10dc`), after the real-meeting pilot and before any held-out meeting was imported. The derived status moved from two reasons to one: KNOW-07 is still open, with only `representative_evaluation_pending` left. The synthetic report is re-bound to the declared file, and its gate stays `fail`.**

## Performance

- **Duration:** about 8 min
- **Started:** 2026-10-17T17:46:47Z
- **Completed:** 2026-10-17T17:55:00Z
- **Tasks:** 3 of 3 (Task 1 decision resolved by delegation, Tasks 2 and 3 automated)
- **Files modified:** 3 (the thresholds file, the status file and the synthetic report), plus this SUMMARY and STATE.md/ROADMAP.md tracking

## Who Declared the Values, and Why

**The user delegated the declaration.** The plan's checkpoint, with the 02-32 context and the pilot's orientation table, was shown to the user. On 2026-10-17 the user replied "use the goal ... make it autonomously". The plan's must_have says "the user declares", and this was carried out by that delegation.

**Claude (the orchestrator) chose the values.** They come from two sources:
- the project's core value: Telu "surfaces the right evidence-backed context at the moment it is useful — and stays silent when an intervention would not add more value than distraction";
- the Phase 2 goal and exit gate: "trustworthy typed knowledge", with "fluent unsupported claims" as the stop condition.

**The values were not derived from the pilot or the synthetic numbers.** Those numbers were shown as orientation only. No pilot or synthetic value was copied, rounded or interpolated into a leaf.

**The values were fixed before any held-out meeting was imported.** 02-37 has not started, and no representative report exists.

Rationale per leaf family:
- **abstention.insufficientEvidence 1.0.** Staying silent when there is nothing to add is the core value, so every insufficient-evidence meeting must abstain.
- **semanticSupport 0.9 and claimCorrectness 0.9.** Knowledge is only worth surfacing if it is right and its exact quote backs it, and the Phase 2 stop condition is fluent unsupported claims. Questions get 0.8 for claimCorrectness: "asked and not answered" is a harder judgment, and a wrong open question costs less than a wrong decision or commitment.
- **attribution 0.9.** A wrong owner or due date misdirects work. Owners and due dates must be right, including a correct "not stated".
- **evidenceCoverage 0.5.** The core value puts precision ahead of recall (stay silent rather than distract). Covering half of the gold items is the floor for usefulness, not a higher recall bar.
- **minReviewAccepted 0.75.** If fewer than three of every four shown items are worth keeping, reviewing them costs more attention than they return.
- **maxDuplication 0.1.** Duplicates are pure distraction.

## Declared Values (thresholds-v2.json)

New sha256: `a0a8db8068e93d271220bc60872f956981c1f129cf02c5f1613d35471a6566ae`. The previous, undeclared sha256 was `aa1261fae592fb70282e68cdd02192191c1f8ef0c9d3d9541c47764c0693ae79`, and the pilot is bound to it.

`quality.abstention.insufficientEvidence` = **1.0**

| Scope | claimCorrectness | semanticSupport | evidenceCoverage | attribution | minReviewAccepted | maxDuplication |
|---|---|---|---|---|---|---|
| decision | 0.9 | 0.9 | 0.5 | 0.9 | 0.75 | 0.1 |
| commitment | 0.9 | 0.9 | 0.5 | 0.9 | 0.75 | 0.1 |
| question | 0.8 | 0.9 | 0.5 | 0.9 | 0.75 | 0.1 |
| fact | 0.9 | 0.9 | 0.5 | 0.9 | 0.75 | 0.1 |
| overall | 0.9 | 0.9 | 0.5 | 0.9 | 0.75 | 0.1 |

That is 1 + 5 × 6 = 31 leaves. Every minimum is in (0, 1] and is met when the measured value is greater than or equal to it. Every maxDuplication is in [0, 1) and is met when the measured value is less than or equal to it. `version` stays 2. The invariants (`exactSpanSupport` 1.0, `resurrection` 0, `deletionResidue` 0), the key order and the 2-space formatting are unchanged. The diff touches only the 31 leaf lines.

## Accomplishments

- **Declaration committed alone.** `27c10dc` contains only `thresholds-v2.json` and has the subject `test(02-36): declare KNOW-07 thresholds v2`.
- **Order checked, not attested.**
  - The pilot commit `f242705` is a strict ancestor of `27c10dc`.
  - The pilot's `thresholdsSha256` (`aa1261fa...ae79`) equals the sha256 of `thresholds-v2.json` in `27c10dc^`.
  - So the pilot was scored against the undeclared file, before the declaration.
- **Status re-derived from the module only.** `eval/know-07-status.json` equals the module output:
  ```json
  {
    "status": "open",
    "reasons": [
      "representative_evaluation_pending"
    ]
  }
  ```
- **Synthetic report re-bound.** It was re-scored with `--kind synthetic` and `--commit 27c10dc5b7d6...` against the declared file, and only `report.json` was copied. Its fields:
  - `evaluationKind` `synthetic`
  - `thresholdsSha256` `a0a8db80...66ae`
  - `gate` `fail`
  - `failures`: `inputs.representativeFixtures`, `decision.maxDuplication`, `decision.minReviewAccepted`, `commitment.minReviewAccepted`, `question.attribution`, `question.minReviewAccepted`, `fact.semanticSupport`, `fact.attribution`, `fact.minReviewAccepted`, `overall.semanticSupport`, `overall.maxDuplication`, `overall.minReviewAccepted`.

  The synthetic suite is 3 handcrafted fixtures. It is not a representative evaluation, and its failures say nothing about real meetings.

## Task Commits

1. **Task 1: Declare the KNOW-07 quality thresholds.** This was a checkpoint:decision (gate blocking-human), resolved as option-declare by the user's delegation on 2026-10-17. It made no commit.
2. **Task 2: Write the declared values verbatim and commit thresholds-v2.json alone.** Commit `27c10dc` (`test(02-36): declare KNOW-07 thresholds v2`).
3. **Task 3: Re-derive the KNOW-07 status and re-bind the synthetic report.** Commit `f8db596` (`test(02-36): re-derive KNOW-07 status and synthetic report after the threshold declaration`), which contains exactly `eval/know-07-status.json` and `eval/synthetic-report.json`.

**Plan metadata:** committed with this SUMMARY (docs)

## Verification

- Task 2 verify 1 (valid and declared): exit 0
- Task 2 verify 2 (declaration commit contains only the file, subject exact): exit 0
- Task 2 verify 3 (pilot is a strict ancestor, pilot sha equals the parent version): exit 0
- Task 3 verify 1 (status file equals module output, single reason): exit 0
- Task 3 verify 2 (synthetic report bound to the declared sha, gate fail, kind synthetic): exit 0
- Task 3 verify 3 (`node --test .github/verify-phase2-know07-status.test.cjs`): 14 tests, 14 pass, 0 fail
- Task 3 acceptance: `git show --name-only --format= f8db596 | sort | paste -sd, -` prints exactly the two eval paths

## Files Created/Modified

- `frontend/src-tauri/tests/fixtures/knowledge-eval/thresholds-v2.json`: 31 null leaves replaced with the declared values
- `.planning/phases/02-evidence-linked-post-meeting-knowledge/eval/know-07-status.json`: written only from the status module
- `.planning/phases/02-evidence-linked-post-meeting-knowledge/eval/synthetic-report.json`: re-scored synthetic report, bound to the declared file
- `.planning/phases/02-evidence-linked-post-meeting-knowledge/02-36-SUMMARY.md`: this file

Unchanged:
- `eval/real-meeting-pilot-report.json` and `eval/pilot-report.json`
- `.planning/REQUIREMENTS.md`
- The 02-32 SUMMARY (option-keep-open), which stays as history

## Deviations from Plan

**1. Declaration by delegation, not by the user directly**
- **What the plan says:** "the user declares" all 31 leaves at the blocking-human checkpoint.
- **What happened:** The checkpoint was shown to the user, and the user delegated the decision ("use the goal ... make it autonomously"). Claude declared the values from the core value and the Phase 2 exit gate, as described above, and not from the pilot or synthetic numbers.
- **Effect:** The executor transcribed the declared values exactly, with no rounding or other values. The user can revise them as a new version in its own commit, as long as no representative report has been scored against this one.

Otherwise the plan was executed exactly as written.

## Consequences

- **KNOW-07 is still open.** Its only remaining reason is `representative_evaluation_pending`. It is not listed under `requirements-completed`, `requirements.mark-complete` was not run, and REQUIREMENTS.md was not edited.
- **The Phase 2 exit gate has not passed.** Phase 3 stays blocked until the held-out representative evaluation (02-37) passes against these thresholds.
- **`thresholds-v2.json` must not change once a representative report is scored against it.** Any revision needs a new version, declared in its own commit before new scoring.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- 02-37 (the held-out representative evaluation) can now pass its threshold precondition. It still needs at least 5 representative meetings, 1 insufficient-evidence meeting and 1 degraded-capture meeting. None may come from the 02-35 pilot, each needs a fresh first run, and all must be scored after `27c10dc`.

---
*Phase: 02-evidence-linked-post-meeting-knowledge*
*Completed: 2026-10-17*

## Self-Check: PASSED

- FOUND: frontend/src-tauri/tests/fixtures/knowledge-eval/thresholds-v2.json (sha256 a0a8db8068e93d271220bc60872f956981c1f129cf02c5f1613d35471a6566ae)
- FOUND: eval/know-07-status.json, eval/synthetic-report.json
- FOUND commits: 27c10dc (declaration, alone), f8db596 (status and synthetic report), f242705 (pilot, strict ancestor)
- Status module: open, representative_evaluation_pending
- Frontmatter: requirements-completed: [], status: complete
