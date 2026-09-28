---
phase: 02-evidence-linked-post-meeting-knowledge
verified: 2026-09-28T15:43:22Z
status: gaps_found
score: 6/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/7
  gaps_closed:
    - "SC3 / KNOW-05: rejected or superseded candidates remain excluded through regeneration and later projections unless explicitly restored (cross-type resurrection fixed in matcher.rs; eval resurrection measure no longer tautological)"
    - "SC4 / KNOW-06: Telu abstains or displays unresolved fields when evidence is inadequate (owner/due now whole-token, claim-tied, verbatim single-span)"
  gaps_remaining:
    - "SC5 / KNOW-07: code-side harness defects are fixed; the human representative evaluation and the pre-declared quality thresholds are still missing, by the user's option-keep-open decision (02-32)"
  regressions: []
gaps:
  - truth: "SC5 / KNOW-07: a maintainer can evaluate extraction by item type, claim correctness, evidence coverage, exact-span support, attribution, duplication and review outcome on representative meetings against thresholds declared before evaluation"
    status: failed
    reason: "Open by the user's decision. The harness defects from the first verification are fixed and tested: deletion residue is measured through the production delete, the resurrection measure works across types, null leaves give undeclared, unmeasured invariants fail, and v2 thresholds have maxDuplication and minReviewAccepted slots. But every quality leaf in thresholds-v2.json is null (the user chose option-keep-open at 02-32), and eval/representative-report.json does not exist (02-33 is halted at its precondition). The derived status is open with reasons [quality_thresholds_undeclared, representative_evaluation_pending], and the committed status file matches it. The ROADMAP exit gate needs predeclared representative-review thresholds to be met, so Phase 3 stays blocked. This is an honest, fail-closed open state, not a code defect."
    artifacts:
      - path: "frontend/src-tauri/tests/fixtures/knowledge-eval/thresholds-v2.json"
        issue: "All 31 quality leaves are null (committed alone in e6fe90c; unchanged since)"
      - path: ".planning/phases/02-evidence-linked-post-meeting-knowledge/eval/representative-report.json"
        issue: "Absent. 02-33 is halted (status: halted in 02-33-SUMMARY.md)"
      - path: ".planning/phases/02-evidence-linked-post-meeting-knowledge/eval/know-07-status.json"
        issue: "{status: open, reasons: [quality_thresholds_undeclared, representative_evaluation_pending]}, equal to the derived output"
    missing:
      - "HUMAN DECISION + ACTIVITY (not code): the user declares all 31 KNOW-07 quality leaves in thresholds-v2.json in a commit of its own (re-run 02-32 with a declaration), then re-runs 02-33: consented extraction on at least 5 representative, 1 insufficient-evidence and 1 degraded-capture meetings whose first run is after the 02-29 fix; gold and labels kept outside the repo; score with --db; commit only the content-free representative report; re-derive know-07-status.json with node .github/verify-phase2-know07-status.cjs"
      - "Alternatively, the user can explicitly re-scope the Phase 2 exit gate (ROADMAP change or an accepted override). The verifier cannot make that decision and has not assumed it"
deferred: []
human_verification:
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
    why_human: "Every automated extraction test injects the completion function. No test exercises a live provider reply through the real Summary route."
  - test: "Review-toast Undo (known review finding CR-40, routed to /gsd-code-review 2 --fix): accept item A, reject item B, then click Undo on A's toast."
    expected: "A is reverted. Today, B is restored instead and A stays accepted and eligible (the row shows this truthfully, but the Undo affordance is misleading)."
    why_human: "Multi-toast interaction; confirms whether the CR-40 fix has landed before Phase 3 reads eligibility."
---

# Phase 2: Evidence-Linked Post-Meeting Knowledge Verification Report

**Phase Goal:** Users can turn a completed meeting into trustworthy typed knowledge, inspect its exact evidence, and control what becomes eligible for future use.
**Verified:** 2026-09-28T15:43:22Z (HEAD 0d05df7; phase-2 code has no uncommitted changes. The uncommitted files in the working tree are unrelated phase-1, config and audio files, which were not touched.)
**Status:** gaps_found
**Re-verification:** Yes, after gap closure plans 02-27 to 02-33.
**Mode:** mvp (roadmap). The goal is not phrased as a user story, so verification runs against the roadmap success criteria as the contract.

## Goal Achievement

Two of the three previous gaps are closed in code, with regression tests that fail on the old behaviour:

- A rejected claim can no longer come back as a new suggestion under a different type.
- An owner or due value is shown as quoted only when it appears as whole words in evidence tied to the claim.

The third gap, the KNOW-07 exit gate, is now narrower. The harness defects are fixed, so a future representative gate can no longer pass without measured evidence. KNOW-07 stays **open** because the user chose to keep the quality thresholds undeclared (02-32, option-keep-open), and so the representative evaluation (02-33) is halted. The repository reports this honestly and fails closed. Nothing reads "satisfied", and no thresholds or data were invented.

### Observable Truths (roadmap success criteria are the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: derive decisions, commitments/actions, questions and facts from a completed meeting; each candidate exposes stable identity, derivation run, review state and exact transcript evidence in context | ✓ VERIFIED (regression check) | The claim quote path was tightened by WR-01. `match_across` now uses `find_whole_token`, so a quote that starts or ends mid-word no longer verifies. `knowledge_extraction_persists_a_verified_decision_with_its_exact_evidence_link` and `…abstains_on_missing_quotes_and_unknown_segments` are in the 98/98 passing `--lib knowledge` run. No frontend files changed since edaa8ee |
| 2 | SC2: accept, correct or reject each candidate independently and immediately see eligibility | ✓ VERIFIED (regression check) | `review.rs` and `candidate-row.tsx` are unchanged since the first verification. The `knowledge_review_*` tests pass. Known open item CR-40 (the Undo on an older toast reverts the latest action) is listed below. The row still shows the Rust-derived eligibility, so the criterion as written holds |
| 3 | SC3a: a correction creates an inspectable revision linked to the original proposal and evidence | ✓ VERIFIED (regression check) | `knowledge_review_correction_writes_revision_and_review_atomically`, `…rejects_stale_base_and_chains_revisions` and `knowledge_item_history_lists_original_revisions_and_reviews_in_order` pass |
| 4 | SC3b / KNOW-05: rejected or superseded candidates stay excluded through regeneration and later projections unless restored | ✓ VERIFIED (gap closed) | `matcher.rs::comparable_keys` compares a candidate with **all** wording of a rejected item regardless of type, and with the `superseded_keys` (corrected-away wording) of accepted and proposed items of another type. Same-type dedupe is kept only for current wording, per the user-accepted D-11 amendment in 02-CONTEXT.md:37. `repository.rs::match_keys` splits current from corrected-away wording, and `load_match_index` feeds it through `extraction.rs:150`. The old `match_candidate_never_matches_another_type` test is gone. New passing behavioural tests: `knowledge_regenerate_never_resurrects_a_rejected_item_under_another_type` (0 proposed, 1 `matched_rejected`, not in the view, not in `list_eligible_items`), `…suppresses_a_rejected_item_under_every_other_type` (3/3 suppressed), `…never_resurrects_corrected_away_wording_under_another_type`, and `load_match_index_separates_current_from_corrected_away_wording` |
| 5 | SC4a / KNOW-06: Telu abstains or shows unresolved fields when evidence is inadequate | ✓ VERIFIED (gap closed) | `verify_attribute` requires three things. First, `find_whole_token` (alphanumeric boundaries on both sides). Second, `is_attributable`: at least 2 characters and not i/we/you/they. Third, `is_tied_to_claim`: the span is in a claim segment or the segment right after it. It stores only a verbatim slice from a single span of at most 80 characters (`stated_text` / `whole_token_slice`). `verify_attribute_rejects_values_that_only_match_part_of_a_word` covers Tom/tomorrow, Ann/Joanne and Ed/decided. The end-to-end test `knowledge_extraction_never_states_an_owner_that_only_matches_part_of_a_word` checks `owner_text` NULL, `not_stated`, only claim links, and after Accept `(NotStated, unresolved=true)`. The Maria and "by Friday" cases stay Stated (`verify_attribute_requires_the_value_inside_its_own_verified_quote`). All pass |
| 6 | SC4b / KNOW-08: meeting or transcript deletion visibly invalidates or removes dependent knowledge | ✓ VERIFIED (regression check) | `tests/knowledge_deletion.rs` 3/3 passes on HEAD (re-run). `knowledge_eligibility_reports_missing_evidence_rows` and `knowledge_run_ends_quietly_when_its_meeting_is_deleted_mid_run` pass. The eval harness now also exercises `MeetingsRepository::delete_meeting` and counts residue across every `meeting_id` table |
| 7 | SC5 / KNOW-07: maintainer evaluates extraction on representative meetings against thresholds declared before evaluation | ✗ FAILED (open by user decision; fail-closed) | **Harness (code): fixed.** `replay.rs::measure_invariants` rejects every first-pass item, re-emits each under its own type and a rotated type (uppercased, trailing period), counts any-type key matches, then deletes through the production path and counts residue. `gate()` returns Undeclared for any null leaf, null scope or missing scope, and Fail for an unmeasured invariant or missing fixture categories (5/1/1 minimums). `THRESHOLDS_VERSION = 2` with maxDuplication and minReviewAccepted. The CLI refuses non-v2 thresholds and non-fixture gold files. **Gate (human): not met.** thresholds-v2.json has all 31 quality leaves null. It was committed alone in e6fe90c and is unchanged since. There is no representative report. `node .github/verify-phase2-know07-status.cjs` prints `open [quality_thresholds_undeclared, representative_evaluation_pending]`, which equals the committed status file. The synthetic report binds sha256 aa1261fa… (= thresholds-v2) with gate `fail` on `inputs.representativeFixtures`, so it can never pose as the representative result |

**Score:** 6/7 truths verified (0 present, behavior-unverified)

### KNOW-07 open-state honesty (explicitly requested check)

| Check | Result |
|-------|--------|
| The status is derived, not asserted | ✓ The `.cjs` output deep-equals `eval/know-07-status.json`. The node test "the committed KNOW-07 status equals the status derived from the committed files" passes |
| Fails closed on thresholds | ✓ Exact key sets at every level; version 2; invariants exactly 1/0/0; minimums in (0,1]; maxDuplication in [0,1). Any null leaf gives `quality_thresholds_undeclared`; anything else invalid gives `thresholds_invalid` |
| Fails closed on the report | ✓ Absent gives `representative_evaluation_pending`. A report must also be content-free, have schemaVersion 1, bind the sha256 of the committed thresholds, have gate `pass` with an empty failures array, and have measured invariants of exactly 1/0/0. Both CR-80 reproductions derive `open` (tests pass) |
| Nothing marks KNOW-07 complete | ✓ REQUIREMENTS.md: `[ ] KNOW-07`, traceability `Pending`. No SUMMARY lists KNOW-07 under requirements-completed (02-28, 02-30, 02-31, 02-32 and 02-33 are `[]`; 5616452 removed the stale claims). ROADMAP: Phase 2 `[ ]`, 32/33, and 02-33 marked HALTED |
| No invented thresholds or data | ✓ thresholds-v2.json is all null and has one commit. There is no representative report and no gold data in the repo beyond the synthetic fixtures |
| Halt is not treated as a pass | ✓ 02-33-SUMMARY `status: halted`, `requirements-completed: []`. This report scores SC5 as FAILED |

### Deferred Items

None. KNOW-07 is this phase's own exit gate, and no later phase takes it over (Phase 3 depends on it).

### Required Artifacts (gap-closure plans 02-27 to 02-33)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/knowledge/matcher.rs` | Type-agnostic rejected and corrected-away matching; same-type dedupe on current wording | ✓ VERIFIED | Contains `superseded_keys` and `comparable_keys` |
| `src/knowledge/repository.rs` | `load_match_index` splits current from corrected-away wording | ✓ VERIFIED | `match_keys` at line 401 |
| `src/knowledge/extraction_regenerate_tests.rs` | Cross-type regenerate regressions | ✓ VERIFIED | 4 new tests pass |
| `src/knowledge/span_verifier.rs` | `find_whole_token`, claim-tied, verbatim single-span attributes | ✓ VERIFIED | Used by `match_across`, `verify_attribute` and `whole_token_slice` |
| `src/knowledge/extraction.rs` | Passes claim evidence ids to `verify_attribute`; end-to-end partial-word test | ✓ VERIFIED | `attribute_support(..., &claim_evidence_ids)` |
| `src/knowledge/evaluation/mod.rs` | v2 thresholds, null leaf undeclared, unmeasured invariants fail, input integrity | ✓ VERIFIED | `THRESHOLDS_VERSION = 2`, `MIN_REPRESENTATIVE_FIXTURES = 5` |
| `src/knowledge/evaluation/replay.rs` | Measured resurrection and deletion residue for replay and export | ✓ VERIFIED | `count_resurrected`, `count_deletion_residue`, `MeetingsRepository::delete_meeting` |
| `src/bin/telu-knowledge-eval.rs` | Strict gold dir, v2-only thresholds, review outcomes scoped to scored meetings | ✓ VERIFIED | CLI tests 7/7 |
| `.github/verify-phase2-know07-status.cjs` + `.test.cjs` | Pure derivation module plus contract tests | ✓ VERIFIED | node 12/12 |
| `tests/fixtures/knowledge-eval/thresholds-v2.json` | v2 schema with duplication and review-outcome slots, all null | ✓ VERIFIED (null by design) | Committed alone (e6fe90c) before the synthetic re-score (ffa8b28) |
| `eval/synthetic-report.json` | Bound to v2; gate fail on representativeFixtures | ✓ VERIFIED | invariants 1 (6/6 measured) / 0 / 0 |
| `eval/representative-report.json` | Content-free representative report | ✗ MISSING (expected: 02-33 halted) | Human activity |
| `eval/know-07-status.json` | Derived status | ✓ present, `open` | Equals the derived output |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| extraction.rs | matcher.rs | `place()` → `match_candidate` on the index from `load_match_index` (extraction.rs:150) | WIRED (type-agnostic for rejected items) |
| repository.rs | matcher.rs | `ExistingItem.superseded_keys` from `knowledge_item_current` + `knowledge_revisions` | WIRED |
| extraction.rs | span_verifier.rs | `verify_item` → `verify_claims`, then `attribute_support` → `verify_attribute(…, claim_evidence_ids)` | WIRED |
| evaluation/replay.rs | database/repositories/meeting.rs | `MeetingsRepository::delete_meeting` in `measure_invariants` | WIRED |
| evaluation/mod.rs | evaluation/replay.rs | `PredictionSet.deletion_residue_count` / `resurrection_count` → `report.invariants` → `invariant_failures` | WIRED |
| telu-knowledge-eval.rs | evaluation/mod.rs | `Thresholds::validate` before scoring (THRESHOLDS_INVALID) | WIRED |
| verify-phase2-know07-status.cjs | thresholds-v2.json / know-07-status.json | `readCommittedInputs` hashes and parses; the committed-equals-derived test | WIRED |
| synthetic-report.json | thresholds-v2.json | `thresholdsSha256` aa1261fa… | WIRED (hash matches) |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| Regenerate suppression | `ExistingItem.keys/superseded_keys` | SQL over `knowledge_item_current`, `knowledge_items`, `knowledge_revisions` | Yes | ✓ FLOWING |
| Owner/due support shown in the row | `owner_support`, `owner_text` | `verify_attribute` → persisted columns → `item_view` | Yes | ✓ FLOWING |
| Eval invariants | `resurrection`, `deletionResidue` | In-memory replay DB through the production extraction and delete paths | Yes (non-vacuous: seeded `evidence_id` = gold segment id, so `claim_evidence` resolves) | ✓ FLOWING |
| KNOW-07 status | `status`, `reasons` | Derived from the committed thresholds file and representative report | Yes | ✓ FLOWING |

### Behavioral Spot-Checks (run by the verifier on HEAD 0d05df7)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Knowledge module: matcher, span verifier, extraction, regenerate, review, projection, eval | `CARGO_INCREMENTAL=0 cargo test --manifest-path frontend/src-tauri/Cargo.toml --lib knowledge` | 98 passed, 0 failed | ✓ PASS |
| Zero-residue deletion | `… --test knowledge_deletion` | 3 passed | ✓ PASS |
| Eval CLI (strict inputs, v2 only, scoped review outcomes, replay without resurrection) | `… --test knowledge_eval_cli` | 7 passed | ✓ PASS |
| KNOW-07 status contract | `node --test .github/verify-phase2-know07-status.test.cjs` | 12 passed | ✓ PASS |
| Derived KNOW-07 status | `node .github/verify-phase2-know07-status.cjs` | `open [quality_thresholds_undeclared, representative_evaluation_pending]` | ✓ matches the committed file (gate not met) |
| Threshold binding | `shasum -a 256 thresholds-v2.json` vs `synthetic-report.thresholdsSha256` | both aa1261fa… | ✓ PASS |

The orchestrator's full runs on the same tree (cargo 483 passed / 0 failed / 3 ignored; node `.github/*.test.cjs` 68/68) were not repeated. The targeted runs above agree with them.

### Probe Execution

Step 7c: SKIPPED. No `scripts/*/tests/probe-*.sh` exists and no plan declares one.

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|--------------|--------|----------|
| KNOW-01 | 02-01, 02-03, 02-12, 02-15, 02-19 | ✓ SATISFIED | Truth 1 |
| KNOW-02 | 02-01…02-11, 02-14, 02-19, 02-21, 02-22, 02-23 | ✓ SATISFIED | Truth 1 |
| KNOW-03 | 02-02, 02-04…02-11, 02-13, 02-16, 02-21, 02-24, 02-25, 02-26 | ✓ SATISFIED | Truth 2 (CR-40 noted) |
| KNOW-04 | 02-05, 02-23, 02-24 | ✓ SATISFIED | Truth 3 |
| KNOW-05 | 02-12, 02-15, 02-24, **02-27** | ✓ SATISFIED (gap closed) | Truth 4. REQUIREMENTS.md `[x]` is now supported by the code |
| KNOW-06 | 02-03, 02-05, 02-15, 02-24, **02-29** | ✓ SATISFIED (gap closed) | Truth 5. REQUIREMENTS.md `[x]` is now supported by the code |
| KNOW-07 | 02-18, 02-20, 02-27, 02-28, 02-30, 02-31, 02-32, 02-33 | ✗ OPEN (not satisfied, never passed) | Truth 7. REQUIREMENTS.md correctly keeps it `[ ]` / Pending |
| KNOW-08 | 02-05, 02-17, 02-23, 02-24 | ✓ SATISFIED | Truth 6 |

Orphaned requirements: none. All 8 Phase 2 IDs are claimed by at least one plan.

Traceability note: the REQUIREMENTS.md table shows KNOW-01…04 and KNOW-08 as "Gaps Found" and KNOW-05/06 as "Complete", while the checkboxes show KNOW-01…04 and 08 as `[ ]`. That is stale bookkeeping from the first verification and is left to the orchestrator. This report finds KNOW-01…06 and 08 satisfied and KNOW-07 open.

### Prohibitions (judgment tier; the LLM-judge verdict is non-authoritative and each is flagged for human review)

| Plan | Prohibition | Verdict |
|------|-------------|---------|
| 02-03 / 02-29 | MUST NOT state an owner or due date that the quoted words do not name as whole words in claim-tied evidence; MUST NOT infer I/we/you/they | Holds (was VIOLATED): whole-token, claim-tie and pronoun rules are enforced and tested |
| 02-12 / 02-27 | MUST NOT resurrect a rejected item or corrected-away wording through regeneration, whatever the type | Holds (was VIOLATED): type-agnostic rejected match, tested under all 3 other types |
| 02-28 | MUST NOT report KNOW-07 satisfied unless derived | Holds |
| 02-30 | No content in reports; no gate pass with unmeasured invariants, categories or predictions | Holds: `invariant_failures`/`input_failures`; the content-free CLI test passes |
| 02-31 | No synthetic metrics presented as the representative result | Holds: the synthetic gate is `fail` on `inputs.representativeFixtures`, and the synthetic report is not an input to the status |
| 02-32 | MUST NOT invent or fill thresholds; MUST NOT mark KNOW-07 complete | Holds: all null, one commit, user-chosen keep-open |
| 02-33 | MUST NOT fabricate representative data; MUST NOT commit meeting content; MUST NOT mark the exit gate passed | Holds: no representative report exists, and the plan is halted |
| Earlier plans (02-01, 02-02, 02-04, 02-05, 02-15, 02-16/25, 02-17, 02-18, 02-20, 02-24) | As in the first report | No regression: none of their files changed except the knowledge Rust modules re-checked above |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| 17 code files changed since edaa8ee | — | TBD / FIXME / XXX / TODO / HACK / `todo!` / `unimplemented!` | none found | — |
| `src/knowledge/evaluation/replay.rs` | 199-202 | `probes = rejected.len()` counts every rejected item, even one whose re-emission is dropped because `claim_evidence` returns None or its quote no longer verifies | ℹ️ Info | For such an item, resurrection reads 0 without a real re-emission. This does not affect single- or two-consecutive-segment claims. Consider counting only the re-emitted items as probes before the representative run |
| `.github/verify-phase2-know07-status.cjs` | 101-111 | The status trusts the report's own `gate`/`failures` for fixture minimums and does not re-check fixture categories or generatedAt | ℹ️ Info | Hand-editing is forbidden by 02-33's prohibition and hash binding. Worth hardening later |
| `.github/workflows/*` | — | No workflow runs `cargo test` or `node --test .github/*.test.cjs` | ℹ️ Info | The derived-equals-committed check runs locally only. This existed before phase 2 and is not a phase-2 gap |

### Known Open Items (out of scope for this re-verification; not counted as gaps)

- **Review criticals** (→ `/gsd-code-review 2 --fix`):
  - CR-20: search panics on non-ASCII text because of byte slicing.
  - CR-40: the review-toast Undo reverts the latest action, not the toast's own. A user can believe item A was reverted while A stays accepted and eligible. The row renders the true Rust eligibility, so SC2 holds as written, but this should land before Phase 3 reads eligibility. It is added as a UAT item.
  - CR-60: the search debounce re-fires forever.
  - CR-61: the search result key and value collide.
  - The remaining warnings in 02-REVIEW.md.
- **UAT items** (→ `/gsd-verify-work 2`): packaged-app chrome, RecordingHost, gallery and copy review, the real-provider loop, and the CR-40 Undo check. These are listed in the frontmatter.

### Gaps Summary

One gap remains, and it cannot be closed with code:

- **SC5 / KNOW-07 exit gate:** the harness is now trustworthy. It measures deletion residue and cross-type resurrection, returns undeclared for any null leaf, fails on unmeasured invariants and missing fixture categories, and requires v2 thresholds. The gate itself needs:
  1. The user to declare the 31 quality thresholds in their own commit before scoring. They chose not to (02-32 option-keep-open, consistent with the 02-20 "pilot first" choice).
  2. The representative evaluation (02-33, halted).

  The repository states this honestly and fails closed: `know-07-status.json` is `open`, KNOW-07 is Pending, and 02-33 is halted. Per the ROADMAP exit gate, Phase 3 stays blocked until the derived status reads `satisfied`, or until the user explicitly re-scopes the gate.

Gaps 1 (KNOW-05) and 2 (KNOW-06) are closed. KNOW-05 was closed with the user-accepted D-11 amendment. Its D-12 consequence is that a correctly typed re-emission of a wrongly typed rejected item is also suppressed, and only Restore brings it back.

---

_Verified: 2026-09-28T15:43:22Z_
_Verifier: Claude (gsd-verifier)_
