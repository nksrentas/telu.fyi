---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 38
subsystem: testing
status: complete
tags: [knowledge-eval, know-07, development-set, live-harness, local-model, gap-closure]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-37 held-out representative report (6cb394a), whose 7 spent fixtures join the development set and whose overall evidenceCoverage 25/106 is the calibration target
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-35 real-meeting pilot report (f242705), whose 3 fixtures join the development set
provides:
  - "telu-knowledge-eval live: headless production extraction on the local builtin qwen3.5:4b model with recorded completions and content-free live-run.json (gitCommit, knowledgeTreeClean, knowledgeDiffSha256)"
  - "telu-knowledge-eval run --budget-tokens: exact replay of a live run on the windows it was recorded on"
  - "telu-knowledge-eval score --review-plan: development-only review outcomes from a blind review plan (REVIEW_PLAN_NOT_ALLOWED for any other kind)"
  - "knowledge::dispatch (dispatch_completer, extraction_budget) shared by Find knowledge and live mode; prompt::window_budget"
  - "Development set of the 10 spent meetings at $HOME/telu-know07-dev/fixtures and the labeled, calibrated baseline 02-38-1 (outside the repository)"
affects: [02-40, 02-41, 02-42, 02-43, KNOW-07]

actuals:
  tokens: 12000
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Live and replay share replay.rs functions (labeled, fixture_predictions, measure_invariants, prediction_set), so a recorded live run replays to byte-identical predictions by construction"
    - "A development measurement names the exact knowledge code it ran through gitCommit, knowledgeTreeClean and knowledgeDiffSha256"

key-files:
  created:
    - frontend/src-tauri/src/knowledge/dispatch.rs
    - frontend/src-tauri/src/knowledge/evaluation/live.rs
    - frontend/src-tauri/src/knowledge/evaluation/review_plan.rs
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/02-38-SUMMARY.md
  modified:
    - frontend/src-tauri/src/knowledge/mod.rs
    - frontend/src-tauri/src/knowledge/commands.rs
    - frontend/src-tauri/src/knowledge/prompt.rs
    - frontend/src-tauri/src/knowledge/evaluation/mod.rs
    - frontend/src-tauri/src/knowledge/evaluation/replay.rs
    - frontend/src-tauri/src/knowledge/evaluation/tests.rs
    - frontend/src-tauri/src/bin/telu-knowledge-eval.rs
    - frontend/src-tauri/tests/knowledge_eval_cli.rs

key-decisions:
  - "Live mode refuses every route that is not a Local builtin route before the first completion (LIVE_MODEL_UNKNOWN, LIVE_MODEL_MISSING, LIVE_ROUTE_UNAVAILABLE)"
  - "A review plan is accepted only with --kind development, so a development report can never stand in for the representative evaluation"
  - "Baseline development measurement 02-38-1 (knowledge-extract-v2, clean tree at e4689be): overall evidenceCoverage 27/127, claimCorrectness 37/57, semanticSupport 22/57, review accepted plus corrected 37/57, gate fail with 19 failures"
  - "Calibration holds: overall evidenceCoverage on the 7 spent meetings is 27/106 (0.255) against 02-37's 25/106 (0.236), a 0.019 gap within 0.15"

patterns-established:
  - "Dev measurement procedure (DMP) and the Blind labeling brief in 02-38-PLAN.md are the fixed procedure for 02-40, 02-41 and 02-42"

requirements-completed: []

duration: 54min
completed: 2026-10-18
---

# Phase 02 Plan 38: Headless Live Dev Harness and 10-Meeting Baseline Summary

**`telu-knowledge-eval live` runs the production Find knowledge extraction headless on the local qwen3.5:4b model and replays it byte for byte. Development reports are scored from a blind review plan. A labeled baseline on the 10 spent meetings reproduces the app's measured coverage within 0.019.**

## Performance

- **Duration:** about 54 min, of which the 10-fixture live run took 2065 s
- **Started:** 2026-10-18T06:08Z
- **Completed:** 2026-10-18T07:02Z
- **Tasks:** 3
- **Files modified:** 11 (3 created)

## Accomplishments

- Find knowledge and evaluation now share one completer (`knowledge::dispatch::dispatch_completer`) and one window budget (`extraction_budget` → `prompt::window_budget`). This was a behavior-preserving refactor, and every existing test still passes unchanged.
- The `live` subcommand runs `extract_from_segments` per fixture through the production completer on a local builtin route only. It writes `predictions.json`, `completions.json` and a content-free `live-run.json` after every fixture, then shuts the sidecar down.
- `run --budget-tokens` replays on the recorded windows. `score --review-plan` with `--kind development` fills review outcomes without the app database, and any other kind is refused.
- The development set (3 pilot + 7 spent held-out fixtures, 7/2/1 by category) was copied unchanged to `$HOME/telu-know07-dev/fixtures`. The labeled baseline is at `$HOME/telu-know07-dev/02-38-1`.

## Task Commits

1. **Task 1: Shared completer and window budget**
   - RED: `6198aec` (test)
   - GREEN: `623d8f7` (refactor)
2. **Task 2: Headless live run, exact replay, development report (tracer)**
   - RED: `d6372e7` (test)
   - GREEN: `e4689be` (feat)
3. **Task 3: Development set and calibrated baseline.** Everything was written outside the repository, so there is no code commit.

## Baseline measurement 02-38-1 (content-free)

Run metadata: promptVersion knowledge-extract-v2, model qwen3.5:4b, budgetTokens 30468, gitCommit e4689be, knowledgeTreeClean true, knowledgeDiffSha256 e3b0c442 (the hash of empty output). The run made 10 completions (1 window per fixture), produced 57 items and 22 abstentions, and took 2065 s wall time. Replay of `completions.json` with budget 30468 gave predictions identical to the live run.

Per-fixture stage counters (windows / completions / items / abstentions / elapsed s):

| Fixture | Category | Counters |
|---|---|---|
| 0b045933 | insufficient_evidence | 1 / 1 / 4 / 0 / 47 |
| 6cbc0bfb | representative | 1 / 1 / 9 / 3 / 204 |
| 80c35127 | representative | 1 / 1 / 8 / 2 / 195 |
| 858f467a | representative | 1 / 1 / 5 / 4 / 179 |
| a5f25562 | representative | 1 / 1 / 4 / 4 / 136 |
| b6785f83 | representative | 1 / 1 / 0 / 0 / 615 |
| da46d11c | degraded_capture | 1 / 1 / 10 / 3 / 252 |
| deae606d | insufficient_evidence | 1 / 1 / 5 / 0 / 54 |
| f864c6d5 | representative | 1 / 1 / 6 / 2 / 208 |
| f91d9838 | representative | 1 / 1 / 6 / 0 / 156 |

### Labeled development report (10 fixtures, `$ITER/score/report.json`, evaluationKind development)

Gate **fail**, 19 failures.

| Scope | claimCorrectness | semanticSupport | exactSpanSupport | rawGrounding | evidenceCoverage | attribution | duplication | review accepted + corrected |
|---|---|---|---|---|---|---|---|---|
| decision | 15/22 (0.682) | 7/22 (0.318) | 22/22 | 22/28 | 10/53 (0.189) | 44/44 | 0/22 | 15/22 (0.682) |
| commitment | 6/9 (0.667) | 4/9 (0.444) | 9/9 | 9/14 | 12/22 (0.545) | 11/18 (0.611) | 0/9 | 6/9 (0.667) |
| question | 2/10 (0.200) | 2/10 (0.200) | 10/10 | 10/12 | 1/6 (0.167) | 20/20 | 0/10 | 2/10 (0.200) |
| fact | 14/16 (0.875) | 9/16 (0.563) | 16/16 | 16/21 | 4/46 (0.087) | 32/32 | 0/16 | 14/16 (0.875) |
| overall | 37/57 (0.649) | 22/57 (0.386) | 57/57 | 57/75 | 27/127 (0.213) | 107/114 (0.939) | 0/57 | 37/57 (0.649) |

- **Degraded capture (overall):** claimCorrectness 6/10, semanticSupport 6/10, exactSpanSupport 10/10, rawGrounding 10/13, evidenceCoverage 4/16, attribution 20/20, duplication 0/10.
- **Abstention:** 2/2. **Invariants:** exactSpanSupport 57/57, resurrection 0, deletion residue 0.

Review outcomes from the blind review plan:

| Type | accepted | corrected | rejected | pending |
|---|---|---|---|---|
| decision | 7/22 | 8/22 | 7/22 | 0/22 |
| commitment | 1/9 | 5/9 | 3/9 | 0/9 |
| question | 1/10 | 1/10 | 8/10 | 0/10 |
| fact | 9/16 | 5/16 | 2/16 | 0/16 |
| total | 18/57 | 19/57 | 20/57 | 0/57 |

Failure names:
- decision: claimCorrectness, semanticSupport, evidenceCoverage, minReviewAccepted
- commitment: claimCorrectness, semanticSupport, attribution, minReviewAccepted
- question: claimCorrectness, semanticSupport, evidenceCoverage, minReviewAccepted
- fact: claimCorrectness, semanticSupport, evidenceCoverage
- overall: claimCorrectness, semanticSupport, evidenceCoverage, minReviewAccepted

### Label-free score (DMP step 4, `$ITER/label-free`)

Gate fail, 24 failures. The metrics that do not depend on labels match the labeled report: evidenceCoverage, exactSpanSupport, rawGrounding and duplication per scope as above, and abstention 2/2.

### Calibration subset (7 spent held-out meetings, labeled, no review plan, `$ITER/spent-subset-score`)

The subset report fails `inputs.predictionsMismatch` and has no review outcomes, both expected. Only its metrics are read here.

| Scope | claimCorrectness | semanticSupport | exactSpanSupport | evidenceCoverage (02-38) | evidenceCoverage (02-37) | attribution |
|---|---|---|---|---|---|---|
| decision | 15/22 | 7/22 | 22/22 | 10/36 | 8/36 | 44/44 |
| commitment | 6/8 | 4/8 | 8/8 | 12/18 | 10/18 | 9/16 |
| question | 0/7 | 1/7 | 7/7 | 1/6 | 0/6 | 14/14 |
| fact | 5/7 | 2/7 | 7/7 | 4/46 | 7/46 | 14/14 |
| overall | 26/44 | 14/44 | 44/44 | **27/106 (0.255)** | **25/106 (0.236)** | 81/88 |

For reference, 02-37 overall had claimCorrectness 39/51 and semanticSupport 29/51. **Calibration check passes:** the coverage gap is 0.019, well within 0.15, so the dev tool measures what the app measured.

## Findings

- **Degenerate reply on b6785f83.** The single window ran for 615 s and returned a 15136-character reply (the others ran 1622 to 6874 characters). The production parser recovered no items from it and no abstentions, so this representative meeting contributes 0 of its 10 gold items. A strict JSON parse also fails on all 10 replies; the lenient production parser recovers items from the other 9. Later lever plans should count malformed or degenerate windows. live-run.json carries no malformed-window counter today.
- On the synthetic standup smoke fixture, the model closed an evidence array with `}`. The window was counted as malformed and yielded 0 items. This is pipeline behavior, not a harness defect.
- Question claims are the weakest scope: 8 of 10 questions were rejected in review, and claimCorrectness is 2/10.

## Decisions Made

See key-decisions in the frontmatter. No threshold, metric definition, gate rule or input minimum changed. thresholds-v2.json still hashes to a0a8db8068e93d27…

## Deviations from Plan

**1. [Rule 3 - Environment] I did not quit the running Telu app before the live runs (DMP step 1)**
- **Found during:** Task 2 smoke and Task 3 live run
- **Issue:** The bundled debug Telu.app was running, and the concurrent 02-39 executor might rely on it.
- **Fix:** I left it running. It had no llama-helper sidecar loaded, so exactly one model was loaded during both runs. The harness uses only an in-memory database and never opened the app database.
- **Files modified:** none
- **Commit:** none

**2. [Process] Blind labels came from orchestrator-launched agents**
- **Found during:** Task 3, DMP step 5
- **Issue:** This executor could not spawn subagents.
- **Fix:** I returned a checkpoint naming the 9 label-input files; b6785f83 had no items. The orchestrator launched one blind labeling agent per file with the brief verbatim. I merged the outputs and checked them: 57/57 predIds, one label and one decision each, every matchesGoldId a known gold id.
- **Files modified:** none in the repository

**Total deviations:** 2, neither affecting the code. The replay helper signature took one added budget parameter instead of a new struct, which keeps it minimal.

## Issues Encountered

In zsh an unquoted `$EVAL` does not word-split. Later plans should wrap the EVAL command in a shell function when following the DMP.

## TDD Gate Compliance

- Task 1: RED `6198aec`, then refactor `623d8f7`.
- Task 2: RED `d6372e7`, then GREEN `e4689be`.
- Both RED runs failed before implementation: compile errors, plus 3 failing CLI tests.

## Verification

- Task 1: `window_budget` 1 passed; `knowledge --lib` 99 passed; `knowledge_eval_cli` + `knowledge_deletion` 3 + 8 passed.
- Task 2:
  - Unit and CLI tests: `evaluation::live` 2 passed, `review_plan` 2 passed, `knowledge_eval_cli` 11 passed, `knowledge --lib` 103 passed.
  - The real smoke run on qwen3.5:4b exited 0 (69 s).
- Task 3: verify 1 (development set), verify 2 (replay identical; labels and decisions complete), verify 3 (content-free, development kind, 10 fixtures, review outcomes, calibration within 0.15) and verify 4 (no output in the knowledge sources, tests or eval/) all exit 0.

## Next Phase Readiness

02-40 and 02-41 compare against this baseline using the DMP. KNOW-07 stays open, and REQUIREMENTS.md is unchanged.

## Self-Check: PASSED

- FOUND: frontend/src-tauri/src/knowledge/dispatch.rs, frontend/src-tauri/src/knowledge/evaluation/live.rs, frontend/src-tauri/src/knowledge/evaluation/review_plan.rs
- FOUND commits: 6198aec, 623d8f7, d6372e7, e4689be
- FOUND outside the repository: $HOME/telu-know07-dev/fixtures (10), $HOME/telu-know07-dev/02-38-1/score/report.json, spent-subset-score/report.json
