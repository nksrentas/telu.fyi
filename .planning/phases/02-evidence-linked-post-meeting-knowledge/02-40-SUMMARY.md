---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 40
subsystem: knowledge-extraction
status: complete
tags: [know-07, extraction, prompt-v3, windowing, development-set, gap-closure]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-38 headless live harness, Dev measurement procedure, Blind labeling brief and the labeled baseline 02-38-1
provides:
  - "knowledge-extract-v3 extraction prompt: agreed-only decisions, unanswered questions, specific facts, quote-bound text, stated role/group/relative owner and due"
  - "Extraction windows capped at MAX_WINDOW_TOKENS = 1500 for Find knowledge and live mode alike"
  - "knowledge::window::window_candidates (one cancellable completion, parse, span verification per window) and StageCounts in ExtractionOutcome and live-run.json"
  - "Labeled development measurement 02-40-4 of the v3 base pipeline (outside the repository)"
affects: [02-41, 02-42, 02-43, KNOW-07]

actuals:
  tokens: 7100
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "A lever is kept only through a recorded development rule over traced sweep runs; a rejected lever is removed with no disabled code path"

key-files:
  created:
    - frontend/src-tauri/src/knowledge/window.rs
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/02-40-SUMMARY.md
  modified:
    - frontend/src-tauri/src/knowledge/prompt.rs
    - frontend/src-tauri/src/knowledge/span_verifier.rs
    - frontend/src-tauri/src/knowledge/extraction.rs
    - frontend/src-tauri/src/knowledge/extraction_regenerate_tests.rs
    - frontend/src-tauri/src/knowledge/mod.rs
    - frontend/src-tauri/src/knowledge/test_support.rs
    - frontend/src-tauri/src/knowledge/evaluation/live.rs

key-decisions:
  - "MAX_WINDOW_TOKENS is 1500: overall evidenceCoverage 57/127 at 1500 against 49/127 at 3000, both with duplication at most 0.1 and abstention 2/2"
  - "The missed-items pass was removed: it raised overall evidenceCoverage by 0.016 (57/127 against 55/127 without it), below the required 0.02"
  - "Labeled v3 base measurement 02-40-4 (clean tree at 98b98ed): overall evidenceCoverage 48/127, claimCorrectness 110/157, semanticSupport 85/157, review accepted plus corrected 110/157, gate fail with 18 failures"
  - "Run-to-run variance of the local model on an identical configuration is 0.055 overall evidenceCoverage (55/127 in 02-40-3 against 48/127 in 02-40-4), larger than the 0.02 margin of the missed-pass rule"

patterns-established:
  - "Sweep runs on local edits save $ITER/knowledge.diff and are checked against knowledgeDiffSha256"

requirements-completed: []

duration: 4h35min
completed: 2026-10-18
---

# Phase 02 Plan 40: Extraction v3 With Capped Windows Summary

**Extraction now uses the knowledge-extract-v3 rules in windows of at most 1500 tokens. The missed-items pass was built, measured and then removed by the rule. On the 10 development meetings the labeled v3 base pipeline almost doubles evidence coverage (48/127 against 27/127) and nearly triples the item count (157 against 57). claimCorrectness and semanticSupport both rise. The gate still fails.**

## Performance

- **Duration:** about 4 h 35 min (10:03 to 14:38), most of it four 10-fixture live runs on qwen3.5:4b
- **Tasks:** 3
- **Files modified:** 8 (1 created)

## Accomplishments

- **Task 1:**
  - PROMPT_VERSION is `knowledge-extract-v3`. EXTRACTION_SYSTEM_PROMPT states the eight v3 rules and keeps the same JSON schema, so parse.rs is unchanged.
  - `window_budget` caps at `MAX_WINDOW_TOKENS` (1500) and keeps the floor, the 2-segment overlap and whole-segment windows.
  - span_verifier.rs gained only a test proving that "each of you", "the project manager" and "by the next meeting" are stated from a claim segment, while "you" alone is not.
- **Task 2:**
  - New `knowledge/window.rs` holds `window_candidates`, `StageCounts` and the moved `verify_item`, `verify_claims` and `attribute_support`.
  - `extract_from_segments` collects each window through `window_candidates` and places candidates with the unchanged matcher.
  - StageCounts appear in `ExtractionOutcome.stages`, in the "knowledge run finished" log and in live-run.json.
  - A missed-items pass was implemented with its own prompt, list-aware user prompt, counters and tests.
- **Task 3:** the development sweep chose cap 1500 and removed the missed-items pass (98b98ed). The final committed state was then measured with blind labels as 02-40-4.

## Task Commits

1. **Task 1: v3 prompt and capped windows (tracer)**
   - RED: `9f8f88a` (test)
   - GREEN: `c5a6568` (feat)
2. **Task 2: missed-items pass per window**
   - RED: `200be9c` (test)
   - GREEN: `54a0fc6` (feat)
3. **Task 3: sweep result.** `98b98ed` (feat) removes the missed-items pass. The cap stayed at 1500, so no cap commit was needed.

## Tracer smoke (Task 1, `$HOME/telu-know07-dev/02-40-smoke`)

- **Fixture:** a5f25562 (representative, fewest segments), run on the clean tree at c5a6568.
- **Result:** knowledge-extract-v3, budget 1500, 4 windows, 4 completions, 12 items, 2 abstentions, 429 s. The baseline had 4 items in 1 window.
- **Replay:** with budget 1500 it gives identical predictions.

## Sweep (label-free, DMP steps 1 to 4)

All replays are identical to their live runs. Abstention is 2/2 and exactSpanSupport is 1.0 in every run.

| Run | Cap | Missed pass | Code | overall evidenceCoverage | decision | commitment | question | fact | duplication | windows / completions | items / abstentions | wall |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 02-38-1 (baseline) | 30468 | none | clean e4689be, v2 | 27/127 (0.213) | 10/53 | 12/22 | 1/6 | 4/46 | 0/57 | 10 / 10 | 57 / 18 | 2065 s |
| 02-40-1 | 1500 | on | clean 54a0fc6 | 57/127 (0.449) | 19/53 | 12/22 | 2/6 | 24/46 | 7/197 (0.036) | 42 / 84 | 197 / 32 | 4743 s |
| 02-40-2 | 3000 | on | 54a0fc6 + edit A, diff sha256 5cff631f306f1fd2… | 49/127 (0.386) | 20/53 | 13/22 | 1/6 | 15/46 | 14/168 (0.083) | 23 / 46 | 168 / 33 | ≈4200 s |
| 02-40-3 | 1500 | off | 54a0fc6 + edit B, diff sha256 9f20691be5167100… | 55/127 (0.433) | 24/53 | 12/22 | 1/6 | 18/46 | 2/183 (0.011) | 42 / 42 | 183 / 32 | 3044 s |
| 02-40-4 (final) | 1500 | off | clean 98b98ed | 48/127 (0.378) | 21/53 | 14/22 | 2/6 | 11/46 | 2/157 (0.013) | 42 / 42 | 157 / 20 | 2485 s |

- **Edit A:** `MAX_WINDOW_TOKENS` set from 1500 to 3000 in prompt.rs. **Edit B:** the missed-items completion removed from `window_candidates`, with `completions` set to 1. Both diffs were saved as `$ITER/knowledge.diff`, both match their live-run.json knowledgeDiffSha256, and both were reverted with `git restore`.
- **Stage counters:** 02-40-1 had missedAdded 44 and missedMalformed 2. 02-40-2 had missedAdded 32 and missedMalformed 0.
- **Label-free gate:** fail in every run, with 23, 26, 24 and 24 failures for 02-40-1 to 02-40-4.

### The two choices

- **Cap:** pick the higher overall evidenceCoverage among runs with duplication at most 0.1 and abstention 1.0. Both cap runs qualify (duplication 0.036 and 0.083). 1500 gives 0.449 and 3000 gives 0.386, so the cap is **1500**, the committed value.
- **Missed-items pass:** keep it only if it raises overall evidenceCoverage by at least 0.02 with duplication at most 0.1. With the pass coverage was 0.449 (02-40-1), without it 0.433 (02-40-3). The gain of 0.016 is below the bar, so the pass was **removed** (98b98ed). That removed the call, MISSED_ITEMS_SYSTEM_PROMPT, missed_items_prompt, the missed_added and missed_malformed counters and the missed_pass tests. prompt.rs is byte-identical to c5a6568.
- **Reuse:** the final tree differs from the one 02-40-1 ran on, so the labeled measurement is a fresh clean run, 02-40-4.

## Labeled development report 02-40-4 (10 fixtures, evaluationKind development)

**Run metadata:**
- promptVersion knowledge-extract-v3, model qwen3.5:4b, budgetTokens 1500.
- gitCommit 98b98ed, knowledgeTreeClean true, knowledgeDiffSha256 e3b0c442… (the hash of empty output).
- 42 windows and 42 completions, 157 items, 20 abstentions, 2485 s wall.
- Blind labels came from one agent per fixture using the 02-38 brief verbatim: 157/157 predIds, one label and one review decision each, every matchesGoldId a known gold id.

Gate **fail**, 18 failures (02-38-1: 19).

| Scope | claimCorrectness | semanticSupport | exactSpanSupport | rawGrounding | evidenceCoverage | attribution | duplication | review accepted + corrected |
|---|---|---|---|---|---|---|---|---|
| decision | 28/36 (0.778) | 12/36 (0.333) | 36/36 | 36/40 | 21/53 (0.396) | 72/72 | 0/36 | 28/36 (0.778) |
| commitment | 12/20 (0.600) | 13/20 (0.650) | 20/20 | 20/24 | 14/22 (0.636) | 24/40 (0.600) | 1/20 | 12/20 (0.600) |
| question | 4/27 (0.148) | 14/27 (0.519) | 27/27 | 27/29 | 2/6 (0.333) | 54/54 | 0/27 | 4/27 (0.148) |
| fact | 66/74 (0.892) | 46/74 (0.622) | 74/74 | 74/84 | 11/46 (0.239) | 148/148 | 1/74 | 66/74 (0.892) |
| overall | 110/157 (0.701) | 85/157 (0.541) | 157/157 | 157/177 | 48/127 (0.378) | 298/314 (0.949) | 2/157 (0.013) | 110/157 (0.701) |

### Against the 02-38-1 baseline (v2, one window per meeting)

| Scope | claimCorrectness | semanticSupport | evidenceCoverage | attribution | review accepted + corrected |
|---|---|---|---|---|---|
| decision | 15/22 (0.682) → 28/36 (0.778) | 7/22 (0.318) → 12/36 (0.333) | 10/53 (0.189) → 21/53 (0.396) | 44/44 → 72/72 | 15/22 → 28/36 |
| commitment | 6/9 (0.667) → 12/20 (0.600) | 4/9 (0.444) → 13/20 (0.650) | 12/22 (0.545) → 14/22 (0.636) | 11/18 (0.611) → 24/40 (0.600) | 6/9 → 12/20 |
| question | 2/10 (0.200) → 4/27 (0.148) | 2/10 (0.200) → 14/27 (0.519) | 1/6 (0.167) → 2/6 (0.333) | 20/20 → 54/54 | 2/10 → 4/27 |
| fact | 14/16 (0.875) → 66/74 (0.892) | 9/16 (0.563) → 46/74 (0.622) | 4/46 (0.087) → 11/46 (0.239) | 32/32 → 148/148 | 14/16 → 66/74 |
| overall | 37/57 (0.649) → 110/157 (0.701) | 22/57 (0.386) → 85/157 (0.541) | 27/127 (0.213) → 48/127 (0.378) | 107/114 (0.939) → 298/314 (0.949) | 37/57 (0.649) → 110/157 (0.701) |

- **Degraded capture (overall):** claimCorrectness 17/20, semanticSupport 11/20, exactSpanSupport 20/20, rawGrounding 20/22, evidenceCoverage 10/16, attribution 37/40, duplication 0/20.
- **Abstention:** 2/2. **Invariants:** exactSpanSupport 157/157, resurrection 0, deletion residue 0.

Review outcomes from the blind review plan:

| Type | accepted | corrected | rejected | pending |
|---|---|---|---|---|
| decision | 10/36 | 18/36 | 8/36 | 0/36 |
| commitment | 1/20 | 11/20 | 8/20 | 0/20 |
| question | 2/27 | 2/27 | 23/27 | 0/27 |
| fact | 42/74 | 24/74 | 8/74 | 0/74 |
| total | 55/157 | 55/157 | 47/157 | 0/157 |

Failure names:
- decision: claimCorrectness, semanticSupport, evidenceCoverage
- commitment: claimCorrectness, semanticSupport, attribution, minReviewAccepted
- question: claimCorrectness, semanticSupport, evidenceCoverage, minReviewAccepted
- fact: claimCorrectness, semanticSupport, evidenceCoverage
- overall: claimCorrectness, semanticSupport, evidenceCoverage, minReviewAccepted

Decision minReviewAccepted no longer fails; it did in 02-38-1.

### Attribution diagnostic (02-40-4 completions.json, counts only)

- 42 replies were read; 1 could not be parsed as strict JSON after stripping think blocks.
- The parsed replies hold 25 raw commitment items. 15 of them name an owner or a due (15 owner, 3 due).
- After verification there are 20 commitment items, and 4 of them carry a stated owner or due (3 owner, 1 due). Most owners the model names do not survive the 02-29 rules. The 02-29 rules are whole-token, verbatim and claim-tied, and pronoun values are never stated.

## Findings

- **Run-to-run variance is larger than the missed-pass margin.**
  - 02-40-3 and 02-40-4 ran the same behavior: cap 1500, no missed-items pass. 02-40-3 ran as a traced edit and 02-40-4 as the committed code.
  - Overall evidenceCoverage was 55/127 and 48/127, a 0.055 difference. Fact coverage alone moved from 18/46 to 11/46.
  - A single 10-fixture run therefore cannot resolve a 0.02 effect. The missed-pass decision followed the recorded rule, but at this noise level it is weak evidence either way. Later plans (02-41, 02-42) should expect about ±0.05 between identical runs.
- **The degenerate reply is gone.** b6785f83 now contributes 20 items over 7 windows. In 02-38-1 it was one 615 s window with zero items. Capped windows also bound per-completion time: the longest fixture took 412 s, against 615 s in the baseline.
- **Questions stay the weakest scope.** Only 4/27 are claim-correct and 23/27 were rejected in review. The v3 "not answered later" rule cannot be applied inside a window that does not see the later answer. This is a candidate for the follow-up checks in 02-41.
- **Commitment attribution is unchanged** (0.611 → 0.600). The prompt now asks for role, group and relative values, but few of them reach the verifier as stated values; see the diagnostic above.

## Decisions Made

See key-decisions in the frontmatter. No threshold, scorer metric, gate rule, input minimum, labeling brief, span-verifier production code or 02-29/02-27 rule changed. thresholds-v2.json still hashes to a0a8db8068e93d27…

## Deviations from Plan

**1. [Rule 1 - Bug] The live replay test had to follow the completion count**
- **Found during:** Task 2
- **Issue:** `live_recording_replays_to_identical_predictions` scripted replies in call order without looking at the system prompt. Once a second completion per window existed, its expectations no longer described the pipeline.
- **Fix:** the test now uses `extraction_replies`. While the pass existed it expected 4 completions. After the removal in 98b98ed its assertions are back to the original (2, 2, 2, 1), plus `stages == StageCounts { completions: 2 }`.
- **Files modified:** frontend/src-tauri/src/knowledge/evaluation/live.rs
- **Commits:** 200be9c, 98b98ed

**2. [Rule 3 - Blocking] `extraction_replies` signature**
- **Found during:** Task 2
- **Issue:** the regenerate tests build their reply at runtime, so a `Vec<&'static str>` parameter could not serve them.
- **Fix:** the helper takes `Vec<S: Into<String>>`. It stays after the removal because the extraction, regenerate and live tests use it, and it is test-only.
- **Files modified:** frontend/src-tauri/src/knowledge/test_support.rs
- **Commit:** 200be9c

**3. [Rule 1] `WindowCandidates.malformed` instead of `first_pass_malformed`**
- **Found during:** Task 3 removal
- **Issue:** with one completion per window there is no "first pass" any more.
- **Fix:** the field was renamed. Malformed windows are still counted from the single extraction reply.
- **Commit:** 98b98ed

**4. [Environment] The background sweep script was killed during 02-40-2**
- **Found during:** Task 3
- **Issue:** the sweep shell exited with code 144 while 02-40-2's live process kept running.
- **Fix:** I let the orphaned live process finish. Then I ran DMP steps 3 and 4 by hand with edit A still in place, and only then restored prompt.rs. The diff hash still matches. Wall time comes from the run start and end (11:39 to 12:49).

**5. [Environment] The Telu app stayed running (DMP step 1), as in 02-38**
- The debug Telu.app had no llama-helper loaded, so exactly one model ran in each live run. The harness uses only an in-memory database and never opened the app database.

**6. [Process] The Task 1 smoke replay ran on Task 1 code**
- Task 2 was committed before the smoke replay finished. So I temporarily checked out c5a6568's knowledge directory, replayed, and restored HEAD. A mistaken `git rm --cached` staged a deletion of window.rs for a moment; I undid it with `git restore --staged` before any commit.

**Total deviations:** 6. None changes a guard, metric or threshold.

## Issues Encountered

None beyond the deviations above.

## TDD Gate Compliance

- **Task 1:** RED `9f8f88a` failed to compile because `MAX_WINDOW_TOKENS` was missing. GREEN `c5a6568` passed.
- **Task 2:** RED `200be9c` failed to compile because `window_candidates`, `StageCounts` and `MISSED_ITEMS_SYSTEM_PROMPT` were missing. GREEN `54a0fc6` passed.
- **Task 3:** `98b98ed` removes the rejected lever under the plan's rule, with its tests.

## Verification

- **Task 1:** `window_budget` 1 passed; `span_verifier` 15 passed; the smoke verify exits 0.
- **Task 2:** `missed_pass` 2 passed; `knowledge --lib` 108 passed; `knowledge_eval_cli` 11 and `knowledge_deletion` 3 passed. extraction.rs is now 709 lines.
- **Task 3:**
  - Verify 1 (labeled, committed code at HEAD, cap 1500, v3, development, 10 fixtures, content-free) exits 0.
  - Verify 2 (three or more traced sweep runs, caps 1500 and 3000, a run without missed completions at the chosen cap) exits 0.
  - Verify 3 (`cargo test --features coreml --lib`) passed: 459 passed, 3 ignored.
  - Verify 4 (no local edit or development output in the repository) exits 0.

## Next Phase Readiness

02-41 layers its support and follow-up checks on this v3 base pipeline. It should be compared with 02-40-4 while keeping the measured ±0.05 run-to-run variance in mind. KNOW-07 stays open, and REQUIREMENTS.md is unchanged.

## Self-Check: PASSED

- FOUND: frontend/src-tauri/src/knowledge/window.rs, frontend/src-tauri/src/knowledge/prompt.rs
- FOUND commits: 9f8f88a, c5a6568, 200be9c, 54a0fc6, 98b98ed
- FOUND outside the repository: $HOME/telu-know07-dev/02-40-smoke, 02-40-1 to 02-40-4 (label-free reports), 02-40-4/score/report.json
