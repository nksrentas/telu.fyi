---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 42
subsystem: knowledge-evaluation
status: complete
tags: [know-07, development-gate, gap-closure, decision-checkpoint, larger-local-model]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-41 labeled development measurement 02-41-3 (knowledge-extract-v6, clean tree at 092f1f5, qwen3.5:4b); thresholds-v2.json declared in 02-36
provides:
  - "eval/development-report.json: content-free KNOW-07 development gate report (evaluationKind development, gate fail, 16 failures), committed alone in 57d92a9"
  - "The user's recorded choice at the development gate: option-larger-local-model"
affects: [02-43, KNOW-07]

actuals:
  tokens: 5600
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/eval/development-report.json
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/02-42-SUMMARY.md
  modified: []

key-decisions:
  - "Development gate source is the existing labeled run 02-41-3: knowledgeTreeClean true and no knowledge-folder diff between 092f1f5 and HEAD, so no fresh run was made."
  - "Development gate: fail, 16 failures (knowledge-extract-v6, qwen3.5:4b, 10 spent meetings)."
  - "User choice at the decision checkpoint: option-larger-local-model. A candidate model's file, source and size go to the user for approval before any download; 02-43 stays blocked and KNOW-07 stays open."

patterns-established: []

requirements-completed: []

duration: Task 1 on 2026-10-18 (report committed 20:20 local); decision answered 2026-10-21
completed: 2026-10-21
---

# Phase 02 Plan 42: KNOW-07 Development Gate Summary

**The KNOW-07 development gate fails with 16 failures on qwen3.5:4b (knowledge-extract-v6), so the held-out set stays unspent. The user chose to try a larger local model, and a candidate needs their approval before any download.**

## Outcome

- **Gate:** `fail` (verbatim from `eval/development-report.json`).
- **Checkpoint:** presented. The user answered it on 2026-10-21.
- **User's choice (verbatim):** "option-larger-local-model: find a larger local model and bring me its file, source and size for approval before downloading."
- **KNOW-07:** stays open. REQUIREMENTS.md is unchanged.
- **02-43:** not started. It stays blocked until a later development gate is pass.
- **thresholds-v2.json:** unchanged (sha256 a0a8db8068e93d271220bc60872f956981c1f129cf02c5f1613d35471a6566ae).
- **Held-out set:** the 02-39 held-out set is unused and stays available.
- **Not done:** nothing was downloaded, no provider or Summary setting was changed, and no remote provider was used.

## Follow-up recorded

1. Find a larger local model candidate.
2. Bring the user its file, source and size.
3. Download nothing until the user approves that candidate.

Once the user approves, a new plan is needed for three things:

- the model definition and prompt template;
- the download itself;
- a repeat of the development measurement and gate on the 10 spent meetings, before 02-43 may run.

## Source measurement

- **Folder:** `$HOME/telu-know07-dev/02-41-3`, written to `$HOME/telu-know07-dev/gate-source.txt`.
  - Nothing outside the repository was committed.
- **Run details:**
  - live-run.json: gitCommit 092f1f5, knowledgeTreeClean true, model qwen3.5:4b.
  - promptVersion `knowledge-extract-v6` matches HEAD.
- **Tree check:** `git diff --quiet 092f1f5 HEAD -- frontend/src-tauri/src/knowledge` exited 0. No fresh run was needed.
- **Copy:** `score/report.json` was copied byte-for-byte (`cmp` identical) and never edited.
- **Verify commands:**
  - All four pre-commit verify commands exited 0.
  - After the commit, the single-file commit and subject check exited 0, and `node --test .github/verify-phase2-know07-status.test.cjs` reported 14 pass, 0 fail.
  - `node .github/verify-phase2-know07-status.cjs` printed the same output before and after, because the development report is not a KNOW-07 input.

## Development report

The report is a development measurement on the set the prompts were tuned on. It is not the representative result. Development numbers read optimistic, and only 02-43 tests the pipeline on unseen meetings.

**Failures (verbatim):**
`decision.claimCorrectness`, `decision.semanticSupport`, `decision.evidenceCoverage`, `commitment.semanticSupport`, `commitment.evidenceCoverage`, `commitment.attribution`, `commitment.maxDuplication`, `question.claimCorrectness`, `question.semanticSupport`, `question.evidenceCoverage`, `question.minReviewAccepted`, `fact.semanticSupport`, `fact.evidenceCoverage`, `overall.claimCorrectness`, `overall.semanticSupport`, `overall.evidenceCoverage`

**Per-scope measured values (thresholds in brackets).** "Review accepted" is accepted plus corrected.

| Scope | claimCorrectness | semanticSupport | evidenceCoverage | attribution | duplication (max) | review accepted (min) |
|---|---|---|---|---|---|---|
| decision | 12/14 = 0.857 [0.9] FAIL | 9/14 = 0.643 [0.9] FAIL | 10/53 = 0.189 [0.5] FAIL | 28/28 = 1.000 [0.9] | 0/14 = 0.000 [0.1] | 12/14 = 0.857 [0.75] |
| commitment | 3/3 = 1.000 [0.9] | 1/3 = 0.333 [0.9] FAIL | 6/22 = 0.273 [0.5] FAIL | 3/6 = 0.500 [0.9] FAIL | 1/3 = 0.333 [0.1] FAIL | 3/3 = 1.000 [0.75] |
| question | 2/10 = 0.200 [0.8] FAIL | 8/10 = 0.800 [0.9] FAIL | 1/6 = 0.167 [0.5] FAIL | 18/20 = 0.900 [0.9] | 0/10 = 0.000 [0.1] | 2/10 = 0.200 [0.75] FAIL |
| fact | 58/63 = 0.921 [0.9] | 42/63 = 0.667 [0.9] FAIL | 7/46 = 0.152 [0.5] FAIL | 124/126 = 0.984 [0.9] | 1/63 = 0.016 [0.1] | 58/63 = 0.921 [0.75] |
| overall | 75/90 = 0.833 [0.9] FAIL | 60/90 = 0.667 [0.9] FAIL | 24/127 = 0.189 [0.5] FAIL | 173/180 = 0.961 [0.9] | 2/90 = 0.022 [0.1] | n/a |

**Other metrics:**
- Invariants: exactSpanSupport 90/90 = 1.0, resurrection 0, deletionResidue 0.
- Abstention: 2/2 = 1.0 [1.0].
- rawGrounding overall: 90/115.

**Stage counters for 02-41-3:**
- Support checks: 37 run, 28 trimmed, 44 dropped, 6 unparsed.
- Follow-up checks: 37 run, 41 dropped, 0 unparsed.

## Progression

All runs used local qwen3.5:4b on a clean knowledge tree, with blind labels, and every gate failed.

| Run | Prompt / commit | Failures | claimCorrectness | semanticSupport | evidenceCoverage | attribution | duplication |
|---|---|---|---|---|---|---|---|
| 02-38-1 (baseline) | v2 / e4689be | 19 | 37/57 = 0.649 | 22/57 = 0.386 | 27/127 = 0.213 | 0.939 | 0.000 |
| 02-40-4 | v3 / 98b98ed | 18 | 110/157 = 0.701 | 85/157 = 0.541 | 48/127 = 0.378 | 0.949 | 0.013 |
| 02-41-1 | v4 / 6f2f8f9 | 20 | 77/109 = 0.706 | 60/109 = 0.550 | 39/127 = 0.307 | 0.968 | 0.018 |
| 02-41-2 | v5 / 18465c5 | 18 | 63/86 = 0.733 | 57/86 = 0.663 | 27/127 = 0.213 | 0.959 | 0.000 |
| 02-41-3 | v6 / 092f1f5 | 16 | 75/90 = 0.833 | 60/90 = 0.667 | 24/127 = 0.189 | 0.961 | 0.022 |

All values above are overall-scope metrics.

- **Precision:** claimCorrectness and semanticSupport rose across the rounds.
- **Recall:** evidenceCoverage peaked at 0.378 in 02-40-4 and fell to 0.189 after the 02-41 support and follow-up checks. It is the furthest from its threshold in every scope.
- **Question claimCorrectness:** it stayed between 0.000 and 0.200 in every run.

## Deviations from Plan

None. The plan was executed exactly as written.

## Self-Check: PASSED

- FOUND: `.planning/phases/02-evidence-linked-post-meeting-knowledge/eval/development-report.json`
- FOUND: commit 57d92a9 `test(02-42): record KNOW-07 development gate report` (that one file only)
- FOUND: `$HOME/telu-know07-dev/gate-source.txt` (outside the repository)
