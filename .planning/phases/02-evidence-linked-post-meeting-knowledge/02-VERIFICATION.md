---
phase: 02-evidence-linked-post-meeting-knowledge
verified: 2026-10-18T09:00:00Z
status: gaps_found
score: 6/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/7
  gaps_closed: []
  gaps_narrowed:
    - "SC5 / KNOW-07: the open reasons quality_thresholds_undeclared and representative_evaluation_pending are resolved. Thresholds are declared (27c10dc) and a held-out representative report exists (6cb394a). KNOW-07 is now open for one reason only: representative_gate_not_pass (measured quality below the declared thresholds, 18 failures)"
  gaps_remaining:
    - "SC5 / KNOW-07 and the Phase 2 exit gate: the held-out representative evaluation ran and failed the declared thresholds"
  regressions: []
gaps:
  - truth: "SC5 / KNOW-07 and the ROADMAP exit gate: extraction on representative meetings meets thresholds declared before evaluation (item correctness, exact-span support, abstention, regeneration safety, deletion effects)"
    status: failed
    reason: "The evaluation capability now exists and was exercised end to end, but the gate is not met. The derived status (`node .github/verify-phase2-know07-status.cjs`) is open with the single reason representative_gate_not_pass, and it deep-equals eval/know-07-status.json. The verifier recomputed the gate from the report's metrics against thresholds-v2.json and got the same 18 failures the report lists. Invariants, abstention, exact-span support and duplication pass. Semantic support fails in every scope (overall 29/51 vs 0.9), claim correctness fails for decision/question/fact/overall (overall 39/51 vs 0.9), evidence coverage fails for decision/question/fact/overall (overall 25/106 vs 0.5), commitment attribution fails (7/14 vs 0.9), and minReviewAccepted fails for decision/question/fact/overall (overall 34/51 vs 0.75). This is a measured product-quality failure, not a harness or bookkeeping defect."
    artifacts:
      - path: ".planning/phases/02-evidence-linked-post-meeting-knowledge/eval/representative-report.json"
        issue: "gate fail, 18 failures; evaluationKind representative; bound to the declared thresholds sha256 a0a8db80...66ae; 7 fixtures, disjoint from the pilot"
      - path: ".planning/phases/02-evidence-linked-post-meeting-knowledge/eval/know-07-status.json"
        issue: "{status: open, reasons: [representative_gate_not_pass]}, equal to the derived output"
      - path: "frontend/src-tauri/src/knowledge/extraction.rs"
        issue: "Extraction output: cited quotes are exact spans (51/51) but often do not support the whole claim (semanticSupport 29/51); recall against gold is low (25/106); questions are weakest (claimCorrectness 1/5, coverage 0/6)"
      - path: "frontend/src-tauri/src/knowledge/span_verifier.rs"
        issue: "Commitment owner/due attribution 7/14 on the held-out set"
    missing:
      - "Improve extraction quality where it measured below the bar: semantic support of the cited quote for the whole claim, claim correctness (especially questions), recall/evidence coverage, commitment owner/due attribution, and the share of items that survive review"
      - "Re-evaluate on a NEW held-out representative set (the 7 meetings in 6cb394a are spent for thresholds-v2), with fresh first runs after the fix, scored with --kind representative, disjoint from the pilot. Any threshold revision must be a new version declared in its own commit before scoring; thresholds-v2.json must not be edited after 6cb394a"
      - "Alternatively, the user explicitly re-scopes the Phase 2 exit gate (ROADMAP change or an accepted override). The verifier has not assumed this"
deferred: []
human_verification:
  - test: "Delegated KNOW-07 judgment (02-35 to 02-37): review the provenance recorded in 02-36-SUMMARY.md and 02-37-SUMMARY.md. Thresholds, held-out meeting choice, gold (fact gold is model-written) and labels/review were produced by Claude under the user's delegation on public AMI recordings."
    expected: "The user confirms the declared thresholds and the evaluation method as their own, or declares a new threshold version / chooses a different gold process before the next representative run."
    why_human: "Whether delegated product thresholds and model-written gold are acceptable as the exit-gate basis is the user's decision. It does not change today's result, which fails either way."
  - test: "Packaged-app window chrome (02-16): run `pnpm --dir frontend tauri:build`, install the DMG, then drag from the toolbar strip and the sidebar inset, click every toolbar button, enter and exit fullscreen, and switch apps."
    expected: "The sidebar shows native vibrancy that follows the window's active state. Traffic lights are centred on the 52px band, including after fullscreen. Dragging works only from the strips. Buttons stay clickable, and close hides the window. If DMG transparency fails (tauri#13415), the sidebar falls back to --window-bg."
    why_human: "NSVisualEffect material, traffic-light placement and DMG transparency cannot be observed in the WebKit gallery."
  - test: "Recording through the single RecordingHost (02-19): in `pnpm --dir frontend tauri:dev`, press ⌘R on Today, speak for 30 seconds, open the recording card, and press Stop in the capsule. Then Record from the tray. Then force-quit during a second recording and relaunch."
    expected: "The capsule replaces Record. The Today card shows Recording, then Finalizing with real queue depth and oldest age. The meeting page shows LIVE TRANSCRIPT, then the finalized page. The tray toggle works. Relaunch offers recovery under the same meeting id. ⌘R is not swallowed by the WKWebView menu."
    why_human: "Real audio capture, native shortcut routing and crash recovery need the running desktop app."
  - test: "Before/after gallery and copy review (02-21): compare gallery/before/light with gallery/after/light for every existing screen, skim the dark set, and read the No evidence copy (A2), the run notice wording (A4) and the delete dialog audio line (A5)."
    expected: "Every existing screen keeps its content and controls in Telu styling with no broken layout, and the copy is acceptable. Dark is either approved for a follow-up or stays off (A1)."
    why_human: "Visual regression and copy acceptance are judgment calls."
  - test: "Real-provider end-to-end knowledge loop: on a completed evidence-backed meeting in tauri:dev with a real Summary provider, run Find knowledge. Accept one item, correct one (fill in Owner), reject one, open a SourceChip → Open transcript. Then Regenerate, including a case where the model re-types the rejected claim, restore the rejected item, and finally delete the meeting."
    expected: "Every listed item quotes the transcript verbatim. Owners appear as quoted only when the transcript names them as whole words next to the claim. Regenerate adds no rejected or corrected-away wording under any type. Restore returns the item to review. Delete shows counts first and removes the meeting and its knowledge."
    why_human: "The 02-35/02-37 runs exercised the live provider on imported audio, but no automated test drives the full review/regenerate/restore/delete loop through a live provider."
  - test: "Review-toast Undo (known review finding CR-40, routed to /gsd-code-review 2 --fix): accept item A, reject item B, then click Undo on A's toast."
    expected: "A is reverted. Today, B is restored instead and A stays accepted and eligible (the row shows this truthfully, but the Undo affordance is misleading)."
    why_human: "Multi-toast interaction; confirms whether the CR-40 fix has landed before Phase 3 reads eligibility."
---

# Phase 2: Evidence-Linked Post-Meeting Knowledge Verification Report

**Phase Goal:** Users can turn a completed meeting into trustworthy typed knowledge, inspect its exact evidence, and control what becomes eligible for future use.
**Verified:** 2026-10-18 (HEAD 15c9b23). Phase-2 code and eval files have no uncommitted changes. The uncommitted files in the working tree are unrelated phase-1, config, ffmpeg build and recording-command files, which were not touched.
**Status:** gaps_found
**Re-verification:** Yes, after gap closure round 2 (plans 02-34 to 02-37).
**Mode:** mvp (roadmap). Verification runs against the roadmap success criteria and the exit gate as the contract.

## Verification History

| Round | Date | After plans | Status | Score | Outcome |
|-------|------|-------------|--------|-------|---------|
| Initial | 2026-09-28 | 02-01 to 02-26 | gaps_found | 4/7 | Gaps on KNOW-05 (cross-type resurrection), KNOW-06 (partial-word attribution), KNOW-07 (harness defects, no thresholds, no representative run) |
| Re-verification 1 | 2026-09-28 (6256706) | 02-27 to 02-33 | gaps_found | 6/7 | KNOW-05 and KNOW-06 closed. KNOW-07 open: `quality_thresholds_undeclared`, `representative_evaluation_pending` (user kept thresholds undeclared; 02-33 halted) |
| Re-verification 2 | 2026-10-18 (this report) | 02-34 to 02-37 | gaps_found | 6/7 | KNOW-07 narrowed to one reason: `representative_gate_not_pass`. The held-out representative evaluation ran against predeclared thresholds and failed 18 of them |

## Goal Achievement

Round 2 did what it set out to do as a process. The tooling now labels reports by kind and enforces a held-out set (02-34). A real-meeting pilot was scored against the undeclared thresholds and committed alone (02-35). The thresholds were declared in a commit of their own after the pilot and before any held-out meeting was imported (02-36). The held-out representative evaluation was scored against them and committed with the derived status (02-37). The verifier checked every ordering, binding, freshness and disjointness claim against git and the app database, and recomputed the gate independently. All of them hold.

The outcome is a measured failure. On seven held-out meetings, extraction falls below the declared bar for semantic support, claim correctness, evidence coverage, commitment attribution and review acceptance. The derived KNOW-07 status, which is the only authority, reads `open` with `representative_gate_not_pass`. The Phase 2 exit gate has not passed, and Phase 3 stays blocked.

Context, not a defect: 02-35 to 02-37 were run by Claude under the user's delegation (2026-10-17) on public AMI Meeting Corpus recordings (CC BY 4.0, participants consented to recording and release). The thresholds, the meeting choice, the gold (fact gold is model-written) and the review labels are Claude's judgment, as both SUMMARYs state. This is listed for the user's confirmation. It does not change today's verdict, which fails regardless.

### Observable Truths (roadmap success criteria are the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: derive decisions, commitments/actions, questions and facts from a completed meeting; each candidate exposes stable identity, derivation run, review state and exact transcript evidence in context | ✓ VERIFIED (regression check) | No knowledge core file (matcher, span_verifier, extraction, repository, review) changed since 0d05df7. `cargo test --lib --features coreml knowledge`: 98 passed, 0 failed (verifier run). The 02-37 held-out run also produced 51 items whose quotes are exact spans 51/51 |
| 2 | SC2: accept, correct or reject each candidate independently and immediately see eligibility | ✓ VERIFIED (regression check) | `review.rs` and `candidate-row.tsx` unchanged. `knowledge_review_*` tests pass within the 98. The 02-37 review applied 21 accept / 13 correct / 17 reject in the app, and review outcomes were read back from the database by `score --db`. CR-40 still open (below) |
| 3 | SC3a: a correction creates an inspectable revision linked to the original proposal and evidence | ✓ VERIFIED (regression check) | Revision and history tests pass within the 98 |
| 4 | SC3b / KNOW-05: rejected or superseded candidates stay excluded through regeneration and later projections unless restored | ✓ VERIFIED (regression check) | Cross-type regenerate tests pass within the 98. Held-out measured invariant `resurrection` = 0 through the production replay path |
| 5 | SC4a / KNOW-06: Telu abstains or shows unresolved fields when evidence is inadequate | ✓ VERIFIED (regression check) | Whole-token, claim-tied attribution tests pass within the 98. Held-out abstention 1/1 met. Note: commitment attribution scored 7/14 on the held-out set, which is a KNOW-07 quality failure (wrong owner/due values), not a failure of the abstain/unresolved mechanism this truth covers |
| 6 | SC4b / KNOW-08: meeting or transcript deletion visibly invalidates or removes dependent knowledge | ✓ VERIFIED (regression check) | `--test knowledge_deletion` 3/3 passed (verifier run). Held-out measured invariant `deletionResidue` = 0 through `MeetingsRepository::delete_meeting` |
| 7 | SC5 / KNOW-07 + exit gate: maintainer evaluates extraction on representative meetings against thresholds declared before evaluation, and the predeclared thresholds are met | ✗ FAILED (measured quality below the declared bar) | **Evaluation: done, and done correctly.** Declared thresholds (27c10dc, committed alone, sha256 a0a8db80...66ae). Held-out report (6cb394a): `evaluationKind` representative, schemaVersion 1, content-free, bound to that sha, generated 18:51:23Z after the declaration at 17:46:55Z, 7 fixtures (5 representative, 1 insufficient-evidence, 1 degraded-capture), no input or invariant failures. **Gate: fail.** `node .github/verify-phase2-know07-status.cjs` prints `open [representative_gate_not_pass]`, equal to `eval/know-07-status.json`. The verifier recomputed all 18 failures from the report's metrics and thresholds-v2.json and they match the report exactly |

**Score:** 6/7 truths verified (0 present, behavior-unverified)

### KNOW-07 held-out result (recomputed by the verifier)

| Scope | claimCorrectness | semanticSupport | evidenceCoverage | attribution | duplication | review accepted+corrected |
|-------|------------------|-----------------|------------------|-------------|-------------|---------------------------|
| decision | 14/19 < 0.9 ✗ | 9/19 < 0.9 ✗ | 8/36 < 0.5 ✗ | 38/38 ✓ | 0/19 ✓ | 12/19 < 0.75 ✗ |
| commitment | 7/7 ✓ | 6/7 < 0.9 ✗ | 10/18 ✓ | 7/14 < 0.9 ✗ | 0/7 ✓ | 7/7 ✓ |
| question | 1/5 < 0.8 ✗ | 3/5 < 0.9 ✗ | 0/6 < 0.5 ✗ | 10/10 ✓ | 0/5 ✓ | 1/5 < 0.75 ✗ |
| fact | 17/20 < 0.9 ✗ | 11/20 < 0.9 ✗ | 7/46 < 0.5 ✗ | 40/40 ✓ | 0/20 ✓ | 14/20 < 0.75 ✗ |
| overall | 39/51 < 0.9 ✗ | 29/51 < 0.9 ✗ | 25/106 < 0.5 ✗ | 95/102 ✓ | 0/51 ✓ | 34/51 < 0.75 ✗ |

Passing: abstention 1/1 (≥ 1.0), invariants exactSpanSupport 51/51, resurrection 0, deletionResidue 0, duplication everywhere. 18 failures in total.

### KNOW-07 process integrity (checked, not attested)

| Check | Result |
|-------|--------|
| Status is derived, not asserted | ✓ Module output deep-equals `eval/know-07-status.json`; node contract test 14/14 passes, including "the committed KNOW-07 status equals the status derived from the committed files" |
| Pilot scored before the declaration | ✓ f242705 (pilot, only commit on that file) is a strict ancestor of 27c10dc; the pilot's `thresholdsSha256` aa1261fa...ae79 equals the sha256 of `27c10dc^:thresholds-v2.json` |
| Declaration alone and still last on the file | ✓ 27c10dc touches only thresholds-v2.json; `git log` on the file lists 27c10dc then e6fe90c; working-tree sha256 a0a8db80...66ae |
| Representative bound to the declared file, after it | ✓ `thresholdsSha256` matches; `generatedAtUtc` 2026-10-17T18:51:23Z > 27c10dc 17:46:55Z; report `gitCommit` ca45451 descends from 27c10dc |
| Held out from the pilot | ✓ 7 representative ids ∩ 3 pilot ids = ∅; the module reports no `representative_not_held_out` |
| Fresh runs after the 02-29 fix | ✓ Read-only query (`PRAGMA query_only=1`) on the app database: all 10 meetings have one knowledge run; earliest pilot run 17:11:30Z, earliest held-out run 18:15:54Z, all after 42866bb (2026-09-28T14:10:24Z), and all held-out runs after the declaration |
| No meeting content committed | ✓ `contentFree` true for both reports; no AMI audio, transcript, gold or label file is tracked |
| Nothing marks KNOW-07 complete | ✓ REQUIREMENTS.md `[ ] KNOW-07`, traceability Pending; 02-34 to 02-37 all `requirements-completed: []`; ROADMAP Phase 2 still `[ ]` |
| 02-33 history kept | ✓ 02-33-SUMMARY.md unchanged (`status: halted`); 02-37 states it supersedes 02-33 |

### Deferred Items

None. KNOW-07 is this phase's own exit gate. Phase 3 depends on it and no later phase takes it over.

### Required Artifacts (round 2: 02-34 to 02-37)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/knowledge/evaluation/mod.rs` | `pub enum EvaluationKind`, optional `evaluation_kind` | ✓ VERIFIED | grep count 1; serde snake_case; `score()` sets None |
| `src/bin/telu-knowledge-eval.rs` | `score --kind` via `parse_kind` | ✓ VERIFIED | grep count 1; `score_labels_the_report_with_its_evaluation_kind` passes |
| `.github/verify-phase2-know07-status.cjs` | `representative_kind_mismatch`, `representative_not_held_out`, pilot input | ✓ VERIFIED | Both checks appended to `reportReasons`; no existing reason relaxed; `heldOutFromPilot` compares as a set and fails closed on missing arrays |
| `src/audio/import.rs` (388ddd5) | Canonical meeting UUID, lifecycle complete, `transcript_evidence` rows | ✓ VERIFIED | UUID minted before `create_meeting_folder`; meeting row inserted with lifecycle/completeness `complete`; one evidence row per spoken segment. `imported_meeting_is_canonical_complete_and_cites_spoken_segments` passes (verifier run) |
| `eval/real-meeting-pilot-report.json` | Content-free, real_meeting_pilot, bound to undeclared file, gate not pass | ✓ VERIFIED | 3 fixtures; gate fail on input minimums |
| `tests/fixtures/knowledge-eval/thresholds-v2.json` | 31 declared leaves, committed alone | ✓ VERIFIED | All leaves set; version 2; invariants 1/0/0 |
| `eval/synthetic-report.json` | Re-bound to declared file, kind synthetic, gate fail | ✓ VERIFIED | sha a0a8db80...; 12 failures incl. `inputs.representativeFixtures` |
| `eval/representative-report.json` | Content-free held-out report | ✓ VERIFIED (exists; its result is the gap) | gate fail, 18 failures |
| `eval/know-07-status.json` | Derived status | ✓ present, `open` | `[representative_gate_not_pass]` |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| telu-knowledge-eval.rs | verify-phase2-know07-status.cjs | `evaluationKind` written by `--kind`, read by `reportReasons` | WIRED (representative report carries `representative`; pilot carries `real_meeting_pilot`) |
| verify-phase2-know07-status.cjs | eval/real-meeting-pilot-report.json | `readCommittedInputs().pilotReport` → `heldOutFromPilot` | WIRED |
| real-meeting-pilot-report.json | thresholds-v2.json (pre-declaration) | `thresholdsSha256` aa1261fa... = `27c10dc^` version | WIRED |
| representative-report.json | thresholds-v2.json (declared) | `thresholdsSha256` a0a8db80... | WIRED (hash matches the working tree and HEAD) |
| synthetic-report.json | thresholds-v2.json (declared) | `thresholdsSha256` a0a8db80... | WIRED |
| verify-phase2-know07-status.cjs | eval/know-07-status.json | Printed status is the file's content | WIRED (deep-equal) |
| audio/import.rs | knowledge extraction | `transcript_evidence` rows + canonical id let Find knowledge run on imported meetings | WIRED (exercised by all 10 pilot/held-out meetings in the app database) |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| Representative report metrics | per-scope ratios | `score --db` over the export, out-of-repo gold and labels, and app review outcomes | Yes (7 AMI meetings, 51 items, 106 gold items) | ✓ FLOWING |
| Gate failures | `failures[]` | `gate()` in evaluation/mod.rs | Yes; recomputed independently by the verifier with an identical list | ✓ FLOWING |
| KNOW-07 status | `status`, `reasons` | Committed thresholds, representative report, pilot report | Yes | ✓ FLOWING |
| Imported meeting evidence | `transcript_evidence` | `create_meeting_with_transcripts` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks (run by the verifier on HEAD 15c9b23)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Derived KNOW-07 status | `node .github/verify-phase2-know07-status.cjs` | `open [representative_gate_not_pass]`, equal to the committed file | ✓ runs (gate not met) |
| KNOW-07 status contract | `node --test .github/verify-phase2-know07-status.test.cjs` | 14 pass, 0 fail | ✓ PASS |
| Independent gate recomputation | node script over report metrics vs thresholds-v2.json | 18 failures, identical to `report.failures` | ✓ PASS (confirms the fail) |
| Import regression | `cargo test --lib --features coreml imported_meeting_is_canonical_complete_and_cites_spoken_segments` | 1 passed | ✓ PASS |
| Knowledge module | `cargo test --lib --features coreml knowledge` | 98 passed, 0 failed | ✓ PASS |
| Eval CLI + deletion | `cargo test --features coreml --test knowledge_eval_cli --test knowledge_deletion` | 8 + 3 passed | ✓ PASS |
| Freshness and disjointness | read-only sqlite query on `meeting_minutes.sqlite`; fixture set intersection | all runs fresh; ∅ overlap | ✓ PASS |

The orchestrator's full lib run on the same tree (451 passed, 0 failed, 3 ignored) was not repeated.

### Probe Execution

Step 7c: SKIPPED. No `scripts/*/tests/probe-*.sh` exists and no plan declares one.

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|--------------|--------|----------|
| KNOW-01 | 02-01, 02-03, 02-12, 02-15, 02-19 | ✓ SATISFIED | Truth 1 |
| KNOW-02 | 02-01…02-11, 02-14, 02-19, 02-21, 02-22, 02-23 | ✓ SATISFIED | Truth 1 |
| KNOW-03 | 02-02, 02-04…02-11, 02-13, 02-16, 02-21, 02-24, 02-25, 02-26 | ✓ SATISFIED | Truth 2 (CR-40 noted) |
| KNOW-04 | 02-05, 02-23, 02-24 | ✓ SATISFIED | Truth 3 |
| KNOW-05 | 02-12, 02-15, 02-24, 02-27 | ✓ SATISFIED | Truth 4 |
| KNOW-06 | 02-03, 02-05, 02-15, 02-24, 02-29 | ✓ SATISFIED | Truth 5 |
| KNOW-07 | 02-18, 02-20, 02-27, 02-28, 02-30…02-37 | ✗ BLOCKED (evaluated; representative gate fails) | Truth 7. REQUIREMENTS.md correctly keeps it `[ ]` / Pending |
| KNOW-08 | 02-05, 02-17, 02-23, 02-24 | ✓ SATISFIED | Truth 6 |

Orphaned requirements: none. All 8 Phase 2 IDs are claimed by at least one plan; 02-34 to 02-37 each declare `requirements: [KNOW-07]`.

Traceability note: REQUIREMENTS.md currently shows every KNOW checkbox `[ ]` and KNOW-01…06/08 as "Gaps Found" in the table (set in 6256706 while the phase is not passed). This report finds the code for KNOW-01…06 and 08 satisfied and KNOW-07 blocked. The bookkeeping is left to the orchestrator.

### Prohibitions (judgment tier; the LLM-judge verdict is non-authoritative and each is flagged for human review)

| Plan | Prohibition | Verdict |
|------|-------------|---------|
| 02-34 | MUST NOT relax or remove any existing KNOW-07 status reason | Holds: both new checks are appended; all prior checks are present |
| 02-34 | MUST NOT change thresholds, eval files or REQUIREMENTS.md; MUST NOT mark KNOW-07 complete | Holds: 02-34 commits touch only the five code/test files |
| 02-35 | MUST NOT invent or edit pilot data; MUST NOT commit meeting content; MUST NOT write the pilot as pilot-report.json or representative-report.json | Holds: pilot at its own path, content-free, committed alone; 02-20 pilot-report.json has one commit (17019e4). Meetings, gold and labels were made by Claude under delegation, which the SUMMARY discloses |
| 02-35 / 02-37 | MUST NOT include a meeting without consent of the people recorded | Holds as recorded: public AMI recordings with release consent (CC BY 4.0) |
| 02-36 | MUST NOT invent or fill thresholds the user did not state; MUST NOT pre-fill from pilot or synthetic numbers | Flagged for the user: the user delegated the declaration ("make it autonomously"), so Claude chose the values. They are round product-level numbers (0.9 / 0.5 / 0.75 / 0.1 / 1.0), not copies of pilot values, and were committed before any held-out import. Listed under human verification |
| 02-36 / 02-37 | MUST NOT change thresholds-v2.json after a representative report is scored against it | Holds: the last commit on the file is 27c10dc, before 6cb394a |
| 02-37 | MUST NOT score a pilot meeting in the held-out evaluation | Holds: disjoint fixture sets |
| 02-37 | MUST NOT mark KNOW-07 complete or the exit gate passed; MUST NOT rewrite 02-33-SUMMARY.md | Holds |
| Earlier plans (02-01 … 02-33) | As in previous reports | No regression: no knowledge core file changed since 0d05df7 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| 6 code files changed since 0d05df7 | — | TBD / FIXME / XXX / TODO / HACK / `todo!` / `unimplemented!` | none found | — |
| `src/audio/import.rs` | 712 | Imported meetings are always written with `completeness = 'complete'` | ⚠️ Warning | The held-out degraded-capture meeting (ES2004d with silenced gaps) is `complete` in the app database (verified), so the app's capture-completeness path was not exercised; the category is a label only, as 02-35/02-37 disclose. The ROADMAP verification approach asks for degraded-capture cases. Before a future run is accepted as a pass, the degraded-capture fixture should come from a capture the app itself marks degraded, or the user should accept the label-only proxy |
| `.github/verify-phase2-know07-status.cjs` | 113 | `gatePassed(report)` trusts the report's own `gate`/`failures` rather than re-deriving them from metrics and thresholds | ℹ️ Info | For this report the verifier's recomputation matches exactly, so there is no effect today. Worth hardening before a future `pass` is relied on |
| `src/knowledge/evaluation/replay.rs` | 199-202 | `probes = rejected.len()` counts rejected items whose re-emission may be dropped | ℹ️ Info | Carried from the previous report; resurrection 0 is unaffected for single- and two-segment claims |
| `.github/workflows/*` | — | No workflow runs `cargo test` or the node status tests | ℹ️ Info | Pre-existing; not a phase-2 gap |

### Known Open Items (not counted as gaps)

- **Review criticals** (→ `/gsd-code-review 2 --fix`): CR-20 (search panics on non-ASCII text), CR-40 (review-toast Undo reverts the latest action, not its own), CR-60 (search debounce re-fires), CR-61 (search result key/value collide), and the remaining 02-REVIEW.md warnings.
- **UAT items** (→ `/gsd-verify-work 2`): delegated-judgment confirmation, packaged-app chrome, RecordingHost, gallery and copy review, the real-provider loop, and the CR-40 Undo check. These are listed in the frontmatter.

### Gaps Summary

One gap remains, and it is now a product-quality gap rather than a process or bookkeeping one:

- **SC5 / KNOW-07 exit gate.** The evaluation pipeline is trustworthy and was run as the plans required: pilot first, thresholds declared alone, held-out set disjoint and fresh, content-free report, status derived. The result fails 18 of the declared thresholds. The common root cause is extraction quality. Quotes are exact spans, but often too narrow to support the whole claim (semantic support 29/51). Many claims are wrong, especially questions (1/5). Recall is low (25/106). Commitment owners/due dates are wrong half the time (7/14). As a result, too few items survive review (34/51).

  Closing it needs, in order:
  1. Extraction improvements targeting those measures.
  2. A new held-out representative set, because the current seven meetings are spent for thresholds-v2. Fresh runs after the fix, scored with `--kind representative` and disjoint from the pilot.
  3. Any threshold change as a new version declared in its own commit before scoring.

  Alternatively, the user explicitly re-scopes the exit gate. Until the derived status reads `satisfied`, Phase 3 stays blocked per the ROADMAP.

---

_Verified: 2026-10-18_
_Verifier: Claude (gsd-verifier)_
