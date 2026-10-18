---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 41
subsystem: knowledge-extraction
status: complete
tags: [know-07, extraction, support-check, followup-check, prompt-v6, development-set, gap-closure]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-40 v3 base pipeline (capped windows, window_candidates, StageCounts) and its labeled measurement 02-40-4; 02-38 Dev measurement procedure and Blind labeling brief
provides:
  - "knowledge::support: SUPPORT_SYSTEM_PROMPT, support_prompt, parse_support, apply_support (keep, trim or drop against verified quotes)"
  - "knowledge::followup: FOLLOWUP_SYSTEM_PROMPT, FOLLOWUP_CONTEXT_TOKENS = 8000, later_context, followup_prompt, parse_followup, apply_followup (answered questions, superseded items)"
  - "Per-window support and follow-up completions in window_candidates; StageCounts support_* and followup_* counters in ExtractionOutcome, the run log and live-run.json"
  - "parse::json_object and parse::parse_verdicts shared by extraction and both checks"
  - "PROMPT_VERSION knowledge-extract-v6 and three labeled development measurements 02-41-1 to 02-41-3 (outside the repository)"
affects: [02-42, 02-43, KNOW-07]

actuals:
  tokens: 9800
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "Model checks may only keep, narrow text or drop a verified candidate; spans, owner, due and type are copied unchanged"
    - "Unusable check output fails open (the candidate is kept) and is counted per candidate as *_unparsed"

key-files:
  created:
    - frontend/src-tauri/src/knowledge/support.rs
    - frontend/src-tauri/src/knowledge/followup.rs
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/02-41-SUMMARY.md
  modified:
    - frontend/src-tauri/src/knowledge/window.rs
    - frontend/src-tauri/src/knowledge/parse.rs
    - frontend/src-tauri/src/knowledge/prompt.rs
    - frontend/src-tauri/src/knowledge/extraction.rs
    - frontend/src-tauri/src/knowledge/mod.rs
    - frontend/src-tauri/src/knowledge/test_support.rs
    - frontend/src-tauri/src/knowledge/evaluation/live.rs

key-decisions:
  - "Each window with verified candidates gets one support completion. Each window with survivors gets one follow-up completion over the transcript from the window's first segment, capped at 8000 tokens."
  - "Check drops are model filtering, not abstentions. There is no new reason code, migration or schema change."
  - "Unparsed counters count candidates left without a usable verdict, not replies."
  - "Iteration 2 (v5) tightened SUPPORT_SYSTEM_PROMPT and told both checks to answer with a verdicts object, never a bare array. Iteration 3 (v6) broadened 'answered' in the follow-up check and drops non-questions in the support check."
  - "Final labeled state 02-41-3 (v6, clean tree at 092f1f5): gate fail, 16 failures. overall claimCorrectness 75/90, semanticSupport 60/90, evidenceCoverage 24/127, review accepted plus corrected 75/90."

patterns-established:
  - "A check prompt's output contract is stated twice: in the schema line and as an explicit 'one JSON object, never a bare array' instruction"

requirements-completed: []

duration: about 5h40min (14:39 to 20:20 local), mostly three live 10-fixture runs on qwen3.5:4b and three rounds of blind labeling
completed: 2026-10-18
---

# Phase 02 Plan 41: Support And Follow-Up Checks Summary

**Each extraction window now has two local-model checks:**
- a support check that keeps, trims or drops each candidate against its own verified quotes;
- a follow-up check that drops questions answered later in the meeting and items superseded later.

**Results on the 10 development meetings with blind labels:**
- Precision rose: claimCorrectness went from 0.701 to 0.833 and semanticSupport from 0.541 to 0.667, comparing 02-40-4 with 02-41-3.
- Overall review acceptance (accepted plus corrected) now passes at 75/90.
- Evidence coverage fell from 48/127 to 24/127.
- The gate still fails, with 16 failures.

## Performance

- **Duration:** about 5 h 40 min of wall time (14:39 to 20:20 local). Most of it is the three labeled live runs (summed per-fixture elapsed time 83, 97 and 122 minutes). It also covers a smoke run and three rounds of blind labeling run by the orchestrator.
- **Tasks:** 3 (Task 1 was a tracer).
- **Files:** 2 created, 7 modified.

## Accomplishments

### Task 1: Support check (tracer)
- **support.rs:**
  - `SUPPORT_SYSTEM_PROMPT` asks for a keep, trim or drop verdict per candidate.
  - `support_prompt` lists for each candidate its id C1..Cn, its type and text, its claim quotes, and its owner and due when stated.
  - `parse_support` and `apply_support` read and apply the verdicts.
  - A trim changes only `text` and `normalized_key`. A test asserts that claims, owner, due, type and item id are byte-identical after a trim.
- **parse.rs:**
  - `json_object` (the outermost-object extraction) was moved out of `parse_extraction` without changing its behavior.
  - `parse_verdicts` is shared by both checks.
- **window.rs:**
  - All three calls in a window go through one `ask` helper, which checks for cancellation before each call.
  - Support counters were added to StageCounts.
- **Tracer smoke** (`$HOME/telu-know07-dev/02-41-smoke`, fixture a5f25562, clean tree at 907d1ba):
  - The run used knowledge-extract-v4, 4 windows and 7 completions, and produced 12 items and 3 abstentions in 246 s.
  - Stage counters: supportChecks 3, trimmed 2, dropped 4, unparsed 0.
  - The replay is identical.
- **test_support.rs:** `staged_replies` serves each system prompt its own reply queue. `extraction_replies` is now built on top of it.

### Task 2: Follow-up check
- **followup.rs:**
  - `FOLLOWUP_SYSTEM_PROMPT` and `FOLLOWUP_CONTEXT_TOKENS = 8000`.
  - `later_context` packs whole segments starting at the window's first segment. It reuses `prompt::window_end`, which is now `pub(crate)`, so it uses the same token estimate as `chunk_windows`.
  - `followup_prompt` lists those transcript lines, then each candidate as "C1 question at S4: text".
  - `parse_followup` and `apply_followup` apply the verdicts. "answered" drops only questions. "superseded" drops only decisions, commitments and facts.
- **window.rs:**
  - `window_candidates` now also takes the whole meeting's segments.
  - The follow-up check runs only on the candidates that survived the support check.
- **extraction.rs:**
  - It passes the segments it already holds.
  - It logs all seven new counters in "knowledge run finished".

### Task 3: Three labeled development iterations
- Every iteration followed DMP steps 1 to 6.
- Every iteration ran on a clean committed tree, and every replay was identical.

## Task Commits

1. **Task 1:**
   - RED: `136276b` (test)
   - GREEN: `907d1ba` (feat, knowledge-extract-v4)
2. **Task 2:**
   - RED: `acf6052` (test)
   - GREEN: `4f0be94` (feat)
3. **Task 3:**
   - `18465c5`: feat, iteration 2 wording, v5
   - `092f1f5`: feat, iteration 3 wording, v6

## Labeling procedure and sources

- **Gold:** the gold items in the 10 development fixtures come from AMI human annotations.
- **Labels:** blind Claude agents produced the labels and review plans, as the user approved.
  - The orchestrator launched one agent per fixture.
  - Each agent got the 02-38 Blind labeling brief verbatim and only its own input file, `$ITER/label-input/<fixtureId>.json`. That file holds the fixture segments, the gold items and the predicted items. Link offsets are removed.
  - The agents never saw thresholds-v2.json, any report, the prompts, the plan, or which change was being measured.
- **Merge check:** a merge script checked every merge. Each predId has exactly one label and one review decision, every matchesGoldId is a known gold id, every boolean field is a boolean, and every action is one of accept, correct or reject.
- **Scoring:** `score --kind development --review-plan` against thresholds-v2.json, which is unchanged (sha256 a0a8db8068e93d27…).

## Iterations

| Iteration | Code | Change (no meeting content) | Windows / completions | Items / abstentions | Live wall |
|---|---|---|---|---|---|
| 02-41-1 | clean 4f0be94, knowledge-extract-v4 | Task 1 and 2 code as planned | 42 / 108 | 109 / 23 | 4997 s |
| 02-41-2 | clean 18465c5, knowledge-extract-v5 | SUPPORT_SYSTEM_PROMPT tightened (read word by word; trim anything beyond the quotes, trim when in doubt; drop items whose quotes only ask, guess or suggest). Both check prompts ask for one JSON object with a "verdicts" array, never a bare array | 42 / 115 | 86 / 23 | 5830 s |
| 02-41-3 | clean 092f1f5, knowledge-extract-v6 | FOLLOWUP_SYSTEM_PROMPT counts any later response, even short, partial or tentative, as answering a question. SUPPORT_SYSTEM_PROMPT drops question items whose quotes are statements, rhetorical questions or suggestions | 42 / 116 | 90 / 25 | 7337 s |

- budgetTokens was 1500 and FOLLOWUP_CONTEXT_TOKENS stayed 8000 in every iteration.
- Live wall is the sum of per-fixture elapsedMs.

### Stage counters

| Iteration | support checks | trimmed | dropped | unparsed | follow-up checks | dropped | unparsed |
|---|---|---|---|---|---|---|---|
| 02-41-1 | 33 | 18 | 37 | 4 | 33 | 30 | **47** |
| 02-41-2 | 37 | 27 | 49 | 2 | 36 | 39 | 0 |
| 02-41-3 | 37 | 28 | 44 | 6 | 37 | 41 | 0 |

### Why each iteration targeted what it did

- **After 02-41-1, the target was semanticSupport and the unparsed follow-up replies.**
  - semanticSupport was furthest below its threshold: 0.550 against 0.9.
  - The development labels showed that most unsupported items added small details their quotes do not state. Others stated as settled something the quotes only ask about or guess.
  - 47 follow-up candidates had no usable verdict. 10 replies were not strict JSON, and 7 of them were bare verdict arrays (6 follow-up, 1 support). `json_object` takes the first `{` to the last `}`, so a bare array never parses.
  - After the wording fix in v5, follow-up unparsed went to 0 in both later runs.
- **After 02-41-2, the target was question claimCorrectness.** It was furthest below its threshold: 0/12 against 0.8. The labels showed questions that are answered later, or that are statements or suggestions phrased as questions.

## Labeled development reports

### 02-41-1 (v4)
Gate **fail**, 20 failures.

| Scope | claimCorrectness | semanticSupport | exactSpanSupport | evidenceCoverage | attribution | duplication | review accepted + corrected |
|---|---|---|---|---|---|---|---|
| decision | 16/21 | 13/21 | 21/21 | 11/53 | 42/42 | 1/21 | 16/21 |
| commitment | 5/10 | 2/10 | 10/10 | 9/22 | 15/20 | 1/10 | 5/10 |
| question | 2/14 | 7/14 | 14/14 | 2/6 | 28/28 | 0/14 | 2/14 |
| fact | 54/64 | 38/64 | 64/64 | 17/46 | 126/128 | 0/64 | 54/64 |
| overall | 77/109 (0.706) | 60/109 (0.550) | 109/109 | 39/127 (0.307) | 211/218 (0.968) | 2/109 | 77/109 (0.706) |

- Other results: abstention 1/2, rawGrounding 109/132, resurrection 0, deletion residue 0.
- Review decisions: 46 accepted, 31 corrected, 32 rejected.
- Degraded capture (overall): claimCorrectness 5/7, semanticSupport 4/7, evidenceCoverage 4/16.
- Failures:
  - decision: claimCorrectness, semanticSupport, evidenceCoverage
  - commitment: claimCorrectness, semanticSupport, evidenceCoverage, attribution, minReviewAccepted
  - question: claimCorrectness, semanticSupport, evidenceCoverage, minReviewAccepted
  - fact: claimCorrectness, semanticSupport, evidenceCoverage
  - overall: claimCorrectness, semanticSupport, evidenceCoverage, minReviewAccepted
  - abstention.insufficientEvidence

### 02-41-2 (v5)
Gate **fail**, 18 failures.

| Scope | claimCorrectness | semanticSupport | exactSpanSupport | evidenceCoverage | attribution | duplication | review accepted + corrected |
|---|---|---|---|---|---|---|---|
| decision | 17/21 | 11/21 | 21/21 | 8/53 | 42/42 | 0/21 | 17/21 |
| commitment | 5/7 | 7/7 | 7/7 | 9/22 | 8/14 | 0/7 | 5/7 |
| question | 0/12 | 7/12 | 12/12 | 1/6 | 24/24 | 0/12 | 0/12 |
| fact | 41/46 | 32/46 | 46/46 | 9/46 | 91/92 | 0/46 | 41/46 |
| overall | 63/86 (0.733) | 57/86 (0.663) | 86/86 | 27/127 (0.213) | 165/172 (0.959) | 0/86 | 63/86 (0.733) |

- Other results: abstention 2/2, rawGrounding 86/109, resurrection 0, deletion residue 0.
- Review decisions: 38 accepted, 25 corrected, 23 rejected.
- Degraded capture (overall): claimCorrectness 4/7, semanticSupport 4/7, evidenceCoverage 1/16.
- Failures:
  - decision: claimCorrectness, semanticSupport, evidenceCoverage
  - commitment: claimCorrectness, evidenceCoverage, attribution, minReviewAccepted
  - question: claimCorrectness, semanticSupport, evidenceCoverage, minReviewAccepted
  - fact: claimCorrectness, semanticSupport, evidenceCoverage
  - overall: claimCorrectness, semanticSupport, evidenceCoverage, minReviewAccepted

### 02-41-3 (v6, final)
Gate **fail**, 16 failures.

| Scope | claimCorrectness | semanticSupport | exactSpanSupport | evidenceCoverage | attribution | duplication | review accepted + corrected |
|---|---|---|---|---|---|---|---|
| decision | 12/14 (0.857) | 9/14 (0.643) | 14/14 | 10/53 (0.189) | 28/28 | 0/14 | 12/14 (0.857) |
| commitment | 3/3 (1.000) | 1/3 (0.333) | 3/3 | 6/22 (0.273) | 3/6 (0.500) | 1/3 | 3/3 (1.000) |
| question | 2/10 (0.200) | 8/10 (0.800) | 10/10 | 1/6 (0.167) | 18/20 (0.900) | 0/10 | 2/10 (0.200) |
| fact | 58/63 (0.921) | 42/63 (0.667) | 63/63 | 7/46 (0.152) | 124/126 | 1/63 | 58/63 (0.921) |
| overall | 75/90 (0.833) | 60/90 (0.667) | 90/90 | 24/127 (0.189) | 173/180 (0.961) | 2/90 (0.022) | 75/90 (0.833) |

- Other results: abstention 2/2, rawGrounding 90/115, resurrection 0, deletion residue 0.
- Review decisions:

| Type | accepted | corrected | rejected |
|---|---|---|---|
| decision | 7 | 5 | 2 |
| commitment | 0 | 3 | 0 |
| question | 2 | 0 | 8 |
| fact | 41 | 17 | 5 |
| total | 50 | 25 | 15 |

- Degraded capture (overall): claimCorrectness 8/11, semanticSupport 9/11, exactSpanSupport 11/11, rawGrounding 11/12, evidenceCoverage 4/16, attribution 22/22, duplication 0/11.
- Failures, verbatim:
  - decision.claimCorrectness, decision.semanticSupport, decision.evidenceCoverage
  - commitment.semanticSupport, commitment.evidenceCoverage, commitment.attribution, commitment.maxDuplication
  - question.claimCorrectness, question.semanticSupport, question.evidenceCoverage, question.minReviewAccepted
  - fact.semanticSupport, fact.evidenceCoverage
  - overall.claimCorrectness, overall.semanticSupport, overall.evidenceCoverage
- Compared with 02-40-4:
  - These now pass: fact.claimCorrectness, overall.minReviewAccepted, commitment.claimCorrectness, commitment.minReviewAccepted.
  - commitment.maxDuplication is new: 1 duplicate in 3 commitment items.

### Progression (overall)

| Run | prompt | items | claimCorrectness | semanticSupport | evidenceCoverage | attribution | review accepted + corrected | abstention | gate |
|---|---|---|---|---|---|---|---|---|---|
| 02-38-1 | v2 | 57 | 37/57 (0.649) | 22/57 (0.386) | 27/127 (0.213) | 107/114 (0.939) | 37/57 (0.649) | 2/2 | fail, 19 |
| 02-40-4 | v3 | 157 | 110/157 (0.701) | 85/157 (0.541) | 48/127 (0.378) | 298/314 (0.949) | 110/157 (0.701) | 2/2 | fail, 18 |
| 02-41-1 | v4 | 109 | 77/109 (0.706) | 60/109 (0.550) | 39/127 (0.307) | 211/218 (0.968) | 77/109 (0.706) | 1/2 | fail, 20 |
| 02-41-2 | v5 | 86 | 63/86 (0.733) | 57/86 (0.663) | 27/127 (0.213) | 165/172 (0.959) | 63/86 (0.733) | 2/2 | fail, 18 |
| 02-41-3 | v6 | 90 | 75/90 (0.833) | 60/90 (0.667) | 24/127 (0.189) | 173/180 (0.961) | 75/90 (0.833) | 2/2 | fail, 16 |

### Per-scope evidenceCoverage

| Scope | 02-38-1 | 02-40-4 | 02-41-1 | 02-41-2 | 02-41-3 |
|---|---|---|---|---|---|
| decision | 10/53 | 21/53 | 11/53 | 8/53 | 10/53 |
| commitment | 12/22 | 14/22 | 9/22 | 9/22 | 6/22 |
| question | 1/6 | 2/6 | 2/6 | 1/6 | 1/6 |
| fact | 4/46 | 11/46 | 17/46 | 9/46 | 7/46 |

exactSpanSupport is 1.0, resurrection is 0 and deletion residue is 0 in every run.

## Findings

- **The checks buy precision with recall.**
  - Overall claimCorrectness rose from 0.701 to 0.833 and semanticSupport from 0.541 to 0.667.
  - Overall review acceptance now passes, at 0.833 against 0.75.
  - Coverage fell from 0.378 to 0.189, back to about the 02-38-1 baseline (0.213).
  - The two checks together drop 67, 88 and 85 candidates per run. Some of those were true and matched gold items.
- **Unparsed follow-up output was a real failure mode.**
  - 02-41-1 left 47 follow-up candidates unchecked, mostly because qwen3.5:4b replied with a bare verdict array.
  - Stating the object contract explicitly fixed this: 0 unparsed in both later runs.
  - Support unparsed stayed small: 4, 2 and 6.
- **Questions are still the weakest scope.**
  - claimCorrectness is 2/10 even with the broadened follow-up rule.
  - The labels mark most surviving questions as answered later or as not really questions. The 4B model rarely marks them "answered" over an 8000-token context.
- **semanticSupport is stuck at about 0.66.**
  - The strict support wording raised trims (18 to 28) but did not lift fact semanticSupport above 0.67. Trimmed texts often still paraphrase beyond the quotes.
- **Variance:** 02-40 measured about ±0.05 overall coverage between identical runs. The per-scope swings between iterations are of that order, so per-scope coverage differences of a few items are not meaningful.

## Decisions Made

See key-decisions in the frontmatter. The following did not change:
- thresholds, scorer metrics, gate rules, input minimums;
- the labeling brief, the window cap of 1500, and the 02-40 missed-items choice;
- the span verifier, the owner and due rules, and the matcher.

There is no migration, no schema change and no new abstention or suppression reason. REQUIREMENTS.md is unchanged, and KNOW-07 stays open.

## Deviations from Plan

**1. [Rule 1] Two existing tests' completion assertions follow the new calls**
- **Found during:** Tasks 1 and 2.
- **Issue:** every check call is a completion, and StageCounts gained fields. As a result, `stage_counts_record_every_completion_call` (window.rs) and `live_recording_replays_to_identical_predictions` (live.rs) could not keep their literal counts (2) or the `StageCounts { completions: 2 }` literal.
- **Fix:**
  - window.rs: the count is now 4, with `support_checks 1` and `followup_checks 1`.
  - live.rs: completions are now 6, with the full StageCounts.
  - The replay-identity and resurrection assertions are unchanged.
- **Commits:** 136276b, acf6052.

**2. [Rule 3] The window_candidates call in the cancellation test passes the meeting segments**
- This follows from the signature change the plan names.
- **Commit:** acf6052.

**3. [Rule 2] Unparsed counts are per candidate, and an identical trim is a keep**
- A reply that fails to parse counts every candidate. A missing or unusable verdict counts that candidate.
- This makes a partly broken reply visible, which is the purpose of T-02-128.
- A trim whose text equals the original is a keep and is not counted as trimmed.
- **Commit:** 907d1ba.

**4. [Scope] Iteration 2 also changed FOLLOWUP_SYSTEM_PROMPT**
- The change was one line asking for a verdicts object, next to the SUPPORT_SYSTEM_PROMPT change aimed at semanticSupport.
- It stays within the plan's allowed wording-only change. It fixes the unparsed replies that left the check inactive, which hid that failure family.
- **Commit:** 18465c5.

**5. [Environment] DMP step 1 and the app**
- As in 02-38 and 02-40, the harness used only an in-memory database and never opened the app database.
- Each live run started the local llama-helper sidecar, and the sidecar exited at the end of each run.

**Total deviations:** 5. None changes a guard, a metric or a threshold.

## Known Stubs

None.

## TDD Gate Compliance

- **Task 1:** RED `136276b` failed to compile because SupportVerdict, parse_support, apply_support and the StageCounts fields were missing. GREEN `907d1ba` passed.
- **Task 2:** RED `acf6052` failed to compile because later_context, apply_followup, FollowupVerdict, FOLLOWUP_SYSTEM_PROMPT and the followup_* fields were missing. GREEN `4f0be94` passed.

## Verification

- **Task 1:**
  - `support --lib`: 14 passed.
  - `knowledge --lib`: 116 passed.
  - `knowledge_eval_cli` 11 and `knowledge_deletion` 3 passed.
  - The smoke verify node command exits 0.
  - window.rs mentions SUPPORT_SYSTEM_PROMPT 6 times, and `pub(crate) fn json_object` appears once in parse.rs.
  - No commit touches migrations or models.rs.
- **Task 2:**
  - `followup --lib`: 7 passed.
  - `knowledge --lib`: 123 passed.
  - `knowledge_eval_cli` 11 and `knowledge_deletion` 3 passed.
  - window.rs mentions FOLLOWUP_SYSTEM_PROMPT 5 times.
  - window.rs is 488 lines and extraction.rs is 716.
- **Task 3:**
  - Verify 1: three labeled 02-41 runs; the last one is 02-41-3, run on HEAD's knowledge code at v6, development kind, 10 fixtures, content-free. Exits 0.
  - Verify 2: `cargo test --features coreml --lib` passed, 476 passed and 3 ignored.
  - Verify 3: no uncommitted knowledge edit or development output in the repository. Exits 0.

## Next Phase Readiness

- 02-42 should take 02-41-3 (v6) as the checked pipeline's development numbers.
- The open trade-off: the checks raise precision and review acceptance, but coverage falls to 24/127, which fails 0.5 in every scope.
- KNOW-07 stays open.

## Self-Check: PASSED

- FOUND: frontend/src-tauri/src/knowledge/support.rs, frontend/src-tauri/src/knowledge/followup.rs
- FOUND commits: 136276b, 907d1ba, acf6052, 4f0be94, 18465c5, 092f1f5
- FOUND outside the repository: $HOME/telu-know07-dev/02-41-smoke, and 02-41-1, 02-41-2 and 02-41-3, each with live-run.json, replay, label-free, labels.json, review-plan.json and score/report.json
