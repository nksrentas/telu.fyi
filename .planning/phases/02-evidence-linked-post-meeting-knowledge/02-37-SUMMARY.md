---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 37
subsystem: testing
tags: [knowledge-eval, know-07, representative, held-out, ami-corpus, gap-closure]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-36 declared thresholds-v2.json (sha256 a0a8db80...66ae), committed alone in 27c10dc
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-35 committed real-meeting pilot report (f242705), whose fixtures the held-out set must avoid
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-29 span verifier fix (42866bb), the freshness reference for every scored run
provides:
  - Content-free held-out representative report at eval/representative-report.json (evaluationKind representative, 7 fixtures, gate fail with 18 failures)
  - Re-derived eval/know-07-status.json (open, representative_gate_not_pass)
affects: [KNOW-07, phase-03, 02-VERIFICATION]

actuals:
  tokens: 7900
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Held-out evaluation is checked, not attested: content, kind, threshold binding and order, freshness, disjointness from the pilot and eval/ isolation all pass before the commit"

key-files:
  created:
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/eval/representative-report.json
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/02-37-SUMMARY.md
  modified:
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/eval/know-07-status.json

key-decisions:
  - "Held-out representative KNOW-07 evaluation run on 7 public AMI meetings (5 representative, 1 insufficient-evidence, 1 degraded-capture), none from the 02-35 pilot, chosen and run by Claude under the user's delegation of 2026-10-17"
  - "Scored against the declared thresholds-v2.json (a0a8db80...66ae) without editing it: gate fail, 18 failures; derived KNOW-07 status open with representative_gate_not_pass"
  - "This plan supersedes the halted 02-33; 02-33-SUMMARY.md is unchanged"
  - "No new thresholds are proposed; thresholds-v2.json is now spent on this held-out set"

patterns-established:
  - "A held-out report and the status derived from it are committed together, and only these two eval paths enter the commit"

requirements-completed: []

coverage:
  - id: D1
    description: "Representative report is content-free, schemaVersion 1, evaluationKind representative"
    requirement: "KNOW-07"
    verification:
      - kind: other
        ref: "Task 2 verify 1 (contentFree, schemaVersion, evaluationKind): exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Report bound to the declared thresholds, declaration still last on the file, generated after the declaration commit"
    requirement: "KNOW-07"
    verification:
      - kind: other
        ref: "Task 2 verify 2 (subject of last commit on thresholds-v2.json, sha256 binding, generatedAtUtc > 27c10dc committer date): exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every scored meeting's earliest knowledge run is strictly later than the 02-29 fix commit"
    requirement: "KNOW-07"
    verification:
      - kind: other
        ref: "Task 2 verify 3 (read-only knowledge_runs via PRAGMA query_only): exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Pilot report has exactly one commit, a strict ancestor of the declaration; representative fixtures disjoint from pilot fixtures"
    requirement: "KNOW-07"
    verification:
      - kind: other
        ref: "Task 2 verify 4 (git ancestry and fixture disjointness): exit 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "Only representative-report.json was new in eval/ before the status was written"
    requirement: "KNOW-07"
    verification:
      - kind: other
        ref: "Task 2 verify 5 (git status of eval/): exit 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "Status written only from the module, equals the derived status, and the commit holds exactly the two eval paths with the exact subject"
    requirement: "KNOW-07"
    verification:
      - kind: unit
        ref: "node --test .github/verify-phase2-know07-status.test.cjs (14 pass, 0 fail)"
        status: pass
      - kind: other
        ref: "Task 2 verify 7 on 6cb394a: exit 0"
        status: pass
    human_judgment: false
  - id: D7
    description: "Meeting choice, gold and review judgments are fit for a held-out evaluation"
    requirement: "KNOW-07"
    verification:
      - kind: other
        ref: "Task 1 human-action checkpoint, resolved under the user's delegation (resume signal: report copied)"
        status: pass
    human_judgment: true
    rationale: "Meeting choice, gold and accept/correct/reject judgments are judgment calls. They were made by separate Claude agents and by Claude on public AMI recordings under the user's delegation, so the result reflects Claude's judgment, not the user's."

duration: 60min
completed: 2026-10-17
status: complete
---

# Phase 02 Plan 37: Held-Out Representative KNOW-07 Evaluation Summary

**The held-out representative KNOW-07 evaluation ran on seven public AMI Meeting Corpus recordings (five representative, one insufficient-evidence, one degraded-capture) that the pilot never used. It was scored against the thresholds declared in 02-36, and the content-free report was committed with the status derived from it (`6cb394a`). The gate is `fail` with 18 failures. KNOW-07 stays open with `representative_gate_not_pass`, the Phase 2 exit gate has not passed, and Phase 3 stays blocked.**

This plan supersedes the halted 02-33. It runs the evaluation 02-33 could not run. `02-33-SUMMARY.md` is unchanged and still reads `status: halted`, which is an accurate record of that run.

## Performance

- **Duration:** about 60 min. Task 1 (import, extraction, gold, labels, review, export and scoring outside the repository) ran from about 17:56Z to report generation at 18:51:23Z. Task 2 checks and the commit took a few minutes.
- **Started:** 2026-10-17T17:56:00Z (approximate, after the 02-36 metadata commit)
- **Completed:** 2026-10-17T18:58:00Z
- **Tasks:** 2 of 2 (Task 1 human-action resolved under delegation, Task 2 automated)
- **Files modified:** 2 eval files, plus this SUMMARY and STATE.md/ROADMAP.md tracking

## Result, Verbatim

Gate and failures from `eval/representative-report.json`:

```json
"gate": "fail",
"failures": [
  "decision.claimCorrectness",
  "decision.semanticSupport",
  "decision.evidenceCoverage",
  "decision.minReviewAccepted",
  "commitment.semanticSupport",
  "commitment.attribution",
  "question.claimCorrectness",
  "question.semanticSupport",
  "question.evidenceCoverage",
  "question.minReviewAccepted",
  "fact.claimCorrectness",
  "fact.semanticSupport",
  "fact.evidenceCoverage",
  "fact.minReviewAccepted",
  "overall.claimCorrectness",
  "overall.semanticSupport",
  "overall.evidenceCoverage",
  "overall.minReviewAccepted"
]
```

There are no input failures (`inputs.*`) and no invariant failures.

Derived status, written to `eval/know-07-status.json` only from `node .github/verify-phase2-know07-status.cjs`:

```json
{
  "status": "open",
  "reasons": [
    "representative_gate_not_pass"
  ]
}
```

The module output deep-equals the committed file, and it contains neither `representative_kind_mismatch` nor `representative_not_held_out`.

Report identity: `schemaVersion` 1, `evaluationKind` `representative`, `promptVersion` `knowledge-extract-v2`, `thresholdsSha256` `a0a8db8068e93d271220bc60872f956981c1f129cf02c5f1613d35471a6566ae` (the declared file), `gitCommit` `ca45451`, `generatedAtUtc` `2026-10-17T18:51:23.369540+00:00`.

## How to Read This Result

These facts govern what the numbers mean. Read them before using any number below.

1. **Meetings: public recordings, chosen by Claude under delegation.** All seven meetings are public AMI Meeting Corpus recordings (University of Edinburgh, CC BY 4.0). Their participants consented to recording and to public release. Claude chose them under the user's delegation of 2026-10-17 ("make it autonomously").
   - All were imported through Telu's Import audio on a bundled debug build of this branch.
   - TS3003b replaced EN2002b, because EN2002b has no AMI human summary.
   - Audio, transcripts, gold, labels and the export stay outside the repository, in `$HOME/telu-know07-audio`, `$HOME/telu-know07-heldout` and `$HOME/telu-know07-heldout-prep`.

   | AMI meeting | Category |
   |---|---|
   | ES2004c | representative |
   | IS1009c | representative |
   | TS3003c | representative |
   | ES2008b | representative |
   | TS3003b | representative |
   | IS1009a, first 300 s | insufficient_evidence |
   | ES2004d, silence at 300–345, 780–870, 1320–1380 and 1800–1890 s | degraded_capture |

2. **Gold provenance (106 items).** A separate Claude agent wrote the gold blind. It saw only the transcripts and the AMI annotations, never Telu's predictions or the thresholds.
   - Decision gold = AMI human "decisions" sentences.
   - Commitment gold = AMI human "actions" sentences.
   - Question gold = AMI human "problems" that stayed unresolved in the meeting.
   - Fact gold = written by that agent from the transcript. This is model-written and is the weakest-provenance part of the gold.
   - The insufficient-evidence clip has no gold (`expectAbstain: true`).
   - Items that fall in the silenced gaps were omitted.
3. **Labels and review.** Another separate Claude agent produced `labels.json` and a per-item review plan. It never saw the thresholds and applied the same rules as the 02-35 pilot. Claude then applied the plan in the app: 21 accepted, 13 corrected, 17 rejected, 0 pending. The database was checked to match the plan for every item. The export was taken before any review, so the labels judge the original model output.
4. **Thresholds came first.** Claude declared them in 02-36 under the user's delegation (`27c10dc`), before any held-out meeting was imported. All knowledge runs started 2026-10-17 between 18:15Z and 18:17Z. That is after the 02-29 fix (`42866bb`, 2026-09-28T14:10:24Z) and after the declaration commit (2026-10-17T17:46:55Z).
5. **Caveat on degraded capture.** Imported audio is recorded as capture-complete. To the app, the degraded-capture meeting's gaps are plain silence it cannot detect, so its `degraded_capture` category is a label only.

## Metrics (from the committed report)

Numerator/denominator (value). The declared minimum or maximum is in brackets; failing cells are marked **FAIL**.

| Scope | claimCorrectness | semanticSupport | exactSpanSupport | evidenceCoverage | attribution | duplication |
|---|---|---|---|---|---|---|
| decision | 14/19 (0.737) [≥0.9] **FAIL** | 9/19 (0.474) [≥0.9] **FAIL** | 19/19 (1.000) | 8/36 (0.222) [≥0.5] **FAIL** | 38/38 (1.000) [≥0.9] | 0/19 (0.000) [≤0.1] |
| commitment | 7/7 (1.000) [≥0.9] | 6/7 (0.857) [≥0.9] **FAIL** | 7/7 (1.000) | 10/18 (0.556) [≥0.5] | 7/14 (0.500) [≥0.9] **FAIL** | 0/7 (0.000) [≤0.1] |
| question | 1/5 (0.200) [≥0.8] **FAIL** | 3/5 (0.600) [≥0.9] **FAIL** | 5/5 (1.000) | 0/6 (0.000) [≥0.5] **FAIL** | 10/10 (1.000) [≥0.9] | 0/5 (0.000) [≤0.1] |
| fact | 17/20 (0.850) [≥0.9] **FAIL** | 11/20 (0.550) [≥0.9] **FAIL** | 20/20 (1.000) | 7/46 (0.152) [≥0.5] **FAIL** | 40/40 (1.000) [≥0.9] | 0/20 (0.000) [≤0.1] |
| overall | 39/51 (0.765) [≥0.9] **FAIL** | 29/51 (0.569) [≥0.9] **FAIL** | 51/51 (1.000) | 25/106 (0.236) [≥0.5] **FAIL** | 95/102 (0.931) [≥0.9] | 0/51 (0.000) [≤0.1] |

rawGrounding, which has no threshold, is decision 19/22, commitment 7/11, question 5/7, fact 20/23 and overall 51/63.

**Abstention:** 1/1 (1.000) [≥1.0], met.

**Degraded capture (overall):** claimCorrectness 7/10, semanticSupport 8/10, exactSpanSupport 10/10, rawGrounding 10/12, evidenceCoverage 4/16, attribution 20/20, duplication 0/10.

**Review outcomes:**

| Scope | accepted | corrected | rejected | pending | minReviewAccepted (accepted + corrected) |
|---|---|---|---|---|---|
| decision | 8/19 | 4/19 | 7/19 | 0/19 | 12/19 (0.632) [≥0.75] **FAIL** |
| commitment | 2/7 | 5/7 | 0/7 | 0/7 | 7/7 (1.000) [≥0.75] |
| question | 1/5 | 0/5 | 4/5 | 0/5 | 1/5 (0.200) [≥0.75] **FAIL** |
| fact | 10/20 | 4/20 | 6/20 | 0/20 | 14/20 (0.700) [≥0.75] **FAIL** |
| total / overall | 21/51 | 13/51 | 17/51 | 0/51 | 34/51 (0.667) [≥0.75] **FAIL** |

The scorer computes minReviewAccepted as (accepted + corrected) / total (`review_accepted` in `frontend/src-tauri/src/knowledge/evaluation/mod.rs`). That is why commitment passes while only 2 of its 7 items were accepted unchanged.

**Invariants:** exactSpanSupport 51/51, resurrection 0, deletionResidue 0, all met.

## What Failed

The numbers below come from the report. No new thresholds are proposed.

- **Semantic support fails in every scope** (overall 29/51). Every cited quote is an exact span of the transcript (51/51), but in many items the quote alone does not support the whole claim.
- **Claim correctness fails for decisions, questions, facts and overall** (overall 39/51). Questions are the weakest scope (1/5).
- **Evidence coverage (recall against gold) fails for decisions, questions, facts and overall** (overall 25/106). Question coverage is 0/6.
- **Commitment attribution fails** (7/14). Owners or due dates were wrong on half of the attribution checks.
- **Too few items survive review** for decisions, questions, facts and overall (overall 34/51 accepted or corrected).
- **Passing:** abstention, exact-span support, duplication, and all three invariants. Attribution passes everywhere except commitment. Commitment claimCorrectness and evidenceCoverage also pass.

## Task Commits

1. **Task 1: Run the held-out representative KNOW-07 evaluation outside the repository.** This was a checkpoint:human-action (gate blocking-human), resolved under the user's delegation with the resume signal "report copied". It made no commit.
2. **Task 2: Check the held-out report, derive the KNOW-07 status and commit both files.** Commit `6cb394a` (`test(02-37): record held-out representative KNOW-07 evaluation`) contains exactly `eval/know-07-status.json` and `eval/representative-report.json`.

**Plan metadata:** committed with this SUMMARY (docs)

## Verification

Before anything was written, in order:
- Verify 1 (contentFree, schemaVersion 1, evaluationKind representative): exit 0
- Verify 2 (declaration subject still last on thresholds-v2.json, sha256 binding, generatedAtUtc after the declaration commit): exit 0
- Verify 3 (every fixture's earliest knowledge run strictly after the 02-29 fix, read-only database): exit 0
- Verify 4 (pilot report committed once, as a strict ancestor of the declaration; fixtures disjoint from the pilot): exit 0
- Verify 5 (only representative-report.json new in eval/): exit 0

After the status was written and committed:
- Verify 6 (`node --test .github/verify-phase2-know07-status.test.cjs`): 14 tests, 14 pass, 0 fail
- Verify 7 (commit `6cb394a` holds exactly the two eval paths, with the exact subject): exit 0
- Acceptance: the module output deep-equals `eval/know-07-status.json`; no `representative_kind_mismatch` and no `representative_not_held_out`

## Files Created/Modified

- `.planning/phases/02-evidence-linked-post-meeting-knowledge/eval/representative-report.json`: content-free held-out report, copied byte-for-byte from `$HOME/telu-know07-heldout/score/report.json` and never edited
- `.planning/phases/02-evidence-linked-post-meeting-knowledge/eval/know-07-status.json`: written only from the status module
- `.planning/phases/02-evidence-linked-post-meeting-knowledge/02-37-SUMMARY.md`: this file

Unchanged:
- `thresholds-v2.json` (sha256 `a0a8db80...66ae`)
- `eval/real-meeting-pilot-report.json`, `eval/pilot-report.json` and `eval/synthetic-report.json`
- `.planning/REQUIREMENTS.md`
- `02-33-SUMMARY.md` (still `status: halted`)

## Deviations from Plan

**1. Meetings, gold, labels and review by Claude, not the user**
- **What the plan says:** the user runs extraction on consented meetings, reviews every item and writes gold and labels.
- **What happened:** the user delegated the evaluation on 2026-10-17 ("make it autonomously"). Claude chose public AMI recordings, whose participants consented to recording and public release. Separate Claude agents wrote the gold blind and wrote the labels and review plan without seeing the thresholds. Claude applied the review in the app.
- **Effect:** the result reflects Claude's judgment under the 02-35 rules, not the user's. Fact gold is model-written.

**2. Export taken before the review** (same as 02-35)
- **Reason:** the export reads the current, corrected item text, so exporting after review could raise claimCorrectness.
- **Effect:** labels judge the original model output. Review outcomes are still taken from the app.

Task 2 itself ran exactly as written.

## Consequences

- **KNOW-07 stays open** (`representative_gate_not_pass`). It is not listed under `requirements-completed`, `requirements.mark-complete` was not run, and REQUIREMENTS.md was not edited.
- **The Phase 2 exit gate has not passed.** Phase 3 stays blocked.
- **These seven meetings are now spent** as the evaluation set for `thresholds-v2.json`. Evaluating again needs a new declaration or a new held-out set.

## Issues Encountered

None in Task 2.

## User Setup Required

None.

## Next Phase Readiness

- KNOW-07 is open on measured quality, not on missing inputs. Phase 3 cannot start until a representative evaluation passes. What comes next (improving extraction, a new held-out set, or a new threshold version) is the user's decision.

---
*Phase: 02-evidence-linked-post-meeting-knowledge*
*Completed: 2026-10-17*
