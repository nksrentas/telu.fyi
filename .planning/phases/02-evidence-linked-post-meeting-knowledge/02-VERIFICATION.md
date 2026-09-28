---
phase: 02-evidence-linked-post-meeting-knowledge
verified: 2026-09-28T12:07:14Z
status: gaps_found
score: 4/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "SC3 / KNOW-05: rejected or superseded candidates remain excluded through regeneration and later projections unless explicitly restored"
    status: partial
    reason: "Suppression only compares candidates against existing items of the same type. If a rejected claim comes back from Regenerate with identical text but a different type (for example, a rejected decision re-emitted as a commitment), it is stored as a new proposed item and shows up for review again. The resurrection metric in the eval harness replays identical replies and counts only same-type, same-key matches, so it cannot catch this."
    artifacts:
      - path: "frontend/src-tauri/src/knowledge/matcher.rs"
        issue: "match_candidate filters on `item.item_type == candidate.item_type && is_match(...)`; the unit test match_candidate_never_matches_another_type (line 136) asserts that a rejected 'Ship the beta' re-emitted as a question is MatchOutcome::New"
      - path: "frontend/src-tauri/src/knowledge/evaluation/replay.rs"
        issue: "measure_resurrection (line 161) replays the same replies and filters on `old.item_type == item.item_type && normalized_key(..) == normalized_key(..)`, so it is tautological with the matcher rule"
    missing:
      - "Match a candidate against rejected items (and corrected-away wording) regardless of type, at least for exact normalized-key and shared-evidence similarity matches. Keep the same-type rule only for the accepted and proposed dedupe outcomes."
      - "Replace match_candidate_never_matches_another_type with a regression test: reject an item, regenerate with the same text under another type, and assert zero new proposed items and a matched_rejected suppression"
      - "Make the eval resurrection measure count any new item whose normalized key matches a rejected item of any type, so the invariant can fail"
  - truth: "SC4 / KNOW-06: Telu abstains or displays unresolved fields when evidence is inadequate"
    status: partial
    reason: "Claim-level abstention works: the verbatim quote rule plus the minimum 3-word / 12-char check are enforced and tested. Owner and due attribution is not. verify_attribute accepts a value when `normalized_quote.contains(&normalized_value)`, which is a raw substring test with no word boundary and no minimum length. So owner 'Tom' is stored as Stated, with an owner evidence link, from a quote that only says 'tomorrow'; 'Ann' matches 'Joanne' and 'Ed' matches 'decided'. The field is then shown as quoted and supported rather than 'Owner not stated', and after Accept the item is not flagged unresolved. This breaks the 02-03 prohibition 'MUST NOT ... attribute an owner or due date that the quoted words do not state'."
    artifacts:
      - path: "frontend/src-tauri/src/knowledge/span_verifier.rs"
        issue: "verify_attribute line ~211: `!normalized_quote.contains(&normalized_value)` with no token boundary check; stated_text then slices the partial-word characters out of the quote as the stored owner/due text"
    missing:
      - "Require the normalized value to match whole tokens inside the normalized quote, with word boundaries on both sides"
      - "Add regression tests: owner 'Tom' with the quote 'we ship tomorrow' → NotStated; 'Ann' with a quote naming 'Joanne' → NotStated; the existing Maria / 'by Friday' cases stay Stated"
  - truth: "SC5 / KNOW-07: a maintainer can evaluate extraction by item type, claim correctness, evidence coverage, exact-span support, attribution, duplication and review outcome on representative meetings against thresholds declared before evaluation"
    status: failed
    reason: "KNOW-07 is deliberately open. thresholds-v1.json fixes the invariants, but every quality threshold is null. No eval/representative-report.json exists. eval/know-07-status.json reads {status: open, reasons: [quality_thresholds_undeclared, representative_evaluation_pending]}, and .github/verify-phase2-know07-status.test.cjs re-derives that value and passes (4/4). The harness exists and runs, but it has three defects that let a future representative gate pass without real evidence: (1) the report hard-codes deletion_residue to None, so that invariant can never fail in the gate; (2) the resurrection measure is tautological (see the KNOW-05 gap); (3) gate() treats a null leaf inside a declared scope as 'no constraint' rather than undeclared (evaluation/tests.rs asserts GateStatus::Pass with null semanticSupport, evidenceCoverage and attribution), which contradicts the 02-18 truth 'a null quality threshold yields gate status undeclared, never pass'. The .cjs status derivation compensates for (3) by requiring every leaf to be numeric, but it does not compensate for (1) or (2). The v1 thresholds schema also has no slot for duplication or review outcome, although SC5 names both."
    artifacts:
      - path: "frontend/src-tauri/tests/fixtures/knowledge-eval/thresholds-v1.json"
        issue: "All quality leaves are null (the user chose 'pilot first' at the 02-20 checkpoint)"
      - path: ".planning/phases/02-evidence-linked-post-meeting-knowledge/eval/know-07-status.json"
        issue: "status open: quality_thresholds_undeclared, representative_evaluation_pending"
      - path: "frontend/src-tauri/src/knowledge/evaluation/mod.rs"
        issue: "score() sets `deletion_residue: None` (line 443); gate() does not mark null leaves inside a declared scope as undeclared; ScopeThresholds has no duplication field"
    missing:
      - "HUMAN ACTIVITY, not code: with consent, run extraction on at least five representative meetings plus one insufficient-evidence and one degraded-capture meeting; export with telu-knowledge-eval; write gold items and labels outside the repo; declare the quality thresholds in thresholds-v1.json in a commit of their own before any scoring; score; commit only the content-free eval/representative-report.json; re-derive know-07-status.json"
      - "Code, before that evaluation counts: measure deletion residue in the eval run (or feed it in from the zero-residue integration test) so the invariant can fail; fix the resurrection measure; make gate() return undeclared for any null leaf; decide whether duplication gets a declared threshold"
deferred: []
human_verification:
  - test: "Packaged-app window chrome (02-16): run `pnpm --dir frontend tauri:build`, install the DMG, then drag from the toolbar strip and the sidebar inset, click every toolbar button, enter and exit fullscreen, and switch apps."
    expected: "The sidebar shows native vibrancy that follows the window's active state. Traffic lights are centred on the 52px band, including after fullscreen. Dragging works only from the strips. Buttons stay clickable, and close hides the window. If DMG transparency fails (tauri#13415), the sidebar falls back to --window-bg."
    why_human: "NSVisualEffect material, traffic-light placement and DMG transparency cannot be observed in the WebKit gallery."
  - test: "Recording through the new single RecordingHost (02-19): in `pnpm --dir frontend tauri:dev`, press ⌘R on Today, speak for 30 seconds, open the recording card, and press Stop in the capsule. Then Record from the tray. Then force-quit during a second recording and relaunch."
    expected: "The capsule replaces Record. The Today card shows Recording, then Finalizing with real queue depth and oldest age. The meeting page shows LIVE TRANSCRIPT, then the finalized page. The tray toggle works. Relaunch offers recovery under the same meeting id. ⌘R is not swallowed by the WKWebView menu (RESEARCH A5)."
    why_human: "Real audio capture, native shortcut routing and crash recovery need the running desktop app."
  - test: "Before/after gallery and copy review (02-21): compare gallery/before/light (20 PNGs) with gallery/after/light (73 PNGs) for every existing screen, skim the dark set, and read the No evidence copy (A2), the run notice wording 'Uses your Summary model · {Local|LAN|Remote} · {origin}' (A4) and the delete dialog line 'The audio file isn't deleted yet.' (A5)."
    expected: "Every existing screen keeps its content and controls in Telu styling with no broken layout, and the copy is acceptable. Dark is either approved for a follow-up or stays off (A1)."
    why_human: "Visual regression across about 70 re-skinned files and copy acceptance are judgment calls."
  - test: "Representative-meeting KNOW-07 evaluation (02-20): the human activity listed in the SC5 gap."
    expected: "know-07-status.json reads satisfied only when every quality threshold is declared and the representative gate passes. Until then KNOW-07 stays Pending and Phase 3 stays blocked."
    why_human: "Representative meetings and gold labels are the user's private data and judgment. They cannot be synthesized or committed."
  - test: "Real-provider end-to-end knowledge loop: on a completed evidence-backed meeting in tauri:dev with a real Summary provider, check that the run notice is visible, then run Find knowledge. Accept one item, correct one (fill in Owner), reject one, and open a SourceChip → Open transcript. Then Regenerate, restore the rejected item, and finally delete the meeting from the ⋯ menu."
    expected: "Every listed item quotes the transcript verbatim, and the drawer centres the cited line with the exact span marked. Eligibility labels change immediately. History shows the original followed by the revision. Regenerate adds no rejected or corrected-away wording and toasts the 'already decided' count. Restore returns the item to review. Delete shows counts first, then removes the meeting and its knowledge, and the Today and Review counts update."
    why_human: "Every automated extraction test injects the completion function. No test exercises a live provider reply through the real Summary route."
---

# Phase 2: Evidence-Linked Post-Meeting Knowledge Verification Report

**Phase Goal:** Users can turn a completed meeting into trustworthy typed knowledge, inspect its exact evidence, and control what becomes eligible for future use.
**Verified:** 2026-09-28T12:07:14Z (HEAD edaa8ee; the only commit after 2e55e8b is the docs-only 02-UI-REVIEW.md)
**Status:** gaps_found
**Re-verification:** No. This is the initial verification.
**Mode:** mvp (roadmap). The goal is not phrased as a user story, so verification runs against the roadmap success criteria as the contract.

## Goal Achievement

Most of the phase is real and well built: the append-only ledger, the verbatim span verifier, the review and revision lineage, Rust-derived eligibility, the zero-residue deletion, and evidence navigation. Three things stop the goal as stated, "trustworthy typed knowledge … control what becomes eligible for future use":

1. A rejected claim can come back as a new suggestion if the model re-types it on Regenerate.
2. An owner or due value can be marked as quoted and supported when it only matches part of a word.
3. KNOW-07 is still open. Closing it is a human activity, but the harness also has defects that need fixing first.

### Observable Truths (roadmap success criteria are the contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: User derives decisions, commitments/actions, questions and facts from a completed meeting; each candidate exposes stable identity, derivation run, review state and exact transcript evidence in context | ✓ VERIFIED | Ledger migration with BEFORE UPDATE abort triggers and a partial unique index for the single running run. `verify_claim_quote` does NFKC/case/punctuation-folded exact substring matching, with at most 2 segments and a minimum of 3 words / 12 chars. The extraction gate (`check_extraction_gate`) and `validate_route_contract` run before the run insert. Items carry itemId, originRunId, reviewState and links with evidenceId/rawStart/rawEnd. The drawer slices with `Array.from` (code points), which matches Rust char offsets. Named tests pass: `knowledge_extraction_persists_a_verified_decision_with_its_exact_evidence_link`, `…abstains_on_missing_quotes_and_unknown_segments`; bun evidence-popover and transcript-drawer tests pass |
| 2 | SC2: Accept, correct or reject each candidate independently and immediately see eligibility | ✓ VERIFIED | `review.rs` transition table uses BEGIN IMMEDIATE and UNIQUE(item_id, sequence). The commands return the Rust `item_view`. `candidate-row.tsx` renders `item.eligibility` from that response and never infers it locally. Tests: `knowledge_review_transitions_follow_the_state_table`, `knowledge_review_accept_appends_once_and_projects_accepted`, bun knowledge-review (all pass) |
| 3 | SC3a: A correction creates an inspectable revision linked to the original proposal and evidence | ✓ VERIFIED | `knowledge_revisions` with based_on_revision_id, plus a `correct` review, are written in one transaction. The stale base returns KNOWLEDGE_REVISION_CONFLICT. HistoryPopover goes through `getKnowledgeItemHistory`. Tests: `knowledge_review_correction_writes_revision_and_review_atomically`, `…rejects_stale_base_and_chains_revisions`, `knowledge_item_history_lists_original_revisions_and_reviews_in_order` |
| 4 | SC3b / KNOW-05: Rejected or superseded candidates stay excluded through regeneration and later projections unless restored | ✗ FAILED (partial) | Same-type suppression works and is tested (`knowledge_regenerate_never_resurrects_rejected_or_corrected_wording`, `…keeps_rejected_items_out_of_review_and_eligibility`). `list_eligible_items` returns only accepted items with valid evidence. **But** `match_candidate` filters by `item_type`, so the same rejected text re-emitted under another type becomes a new proposed item. The unit test `match_candidate_never_matches_another_type` codifies this, and the eval resurrection metric cannot detect it |
| 5 | SC4a / KNOW-06: Telu abstains or shows unresolved fields when evidence is inadequate | ✗ FAILED (partial) | Claim abstention and the skipped count are correct (skipped_count equals the abstention rows, and skipped text is never rendered). **But** `verify_attribute` uses a raw substring test, so owner "Tom" verifies against "tomorrow". The field is stored as Stated with an owner evidence link, rendered as a quoted value instead of the dashed "Owner not stated", and not flagged unresolved after Accept |
| 6 | SC4b / KNOW-08: Meeting or transcript deletion visibly invalidates or removes dependent knowledge | ✓ VERIFIED | `MEETING_SCOPED_DELETE_ORDER` deletes all 7 knowledge tables child-first in one transaction. Foreign keys are NO ACTION, and sqlx has foreign_keys ON by default. `api_delete_meeting` calls `cancel_active_extraction` first. The projection reports missing and changed evidence and drops eligibility. Tests pass: `deleting_a_meeting_leaves_zero_rows_in_every_meeting_scoped_table`, `foreign_keys_block_a_meeting_delete_that_would_orphan_knowledge`, `knowledge_eligibility_reports_missing_evidence_rows`, `knowledge_run_ends_quietly_when_its_meeting_is_deleted_mid_run`. No standalone transcript-delete path exists: retranscribe rewrites only the legacy `transcripts` table and is hidden on evidence meetings |
| 7 | SC5 / KNOW-07: Maintainer evaluates extraction on representative meetings against thresholds declared before evaluation | ✗ FAILED (open) | The harness exists (score / run / export, content-free, 4/4 CLI tests pass), and thresholds-v1.json was committed (61f30f7) before scoring (8d0b0e3). The synthetic report's thresholdsSha256 matches the file (6af4ebe9…) and its gate is `undeclared`. **Every quality threshold is null, and there is no representative report.** know-07-status.json is `open`. The harness defects are listed in the gaps. **Closing this needs a human activity: consented representative meetings, gold labels kept outside the repo, and thresholds declared in their own commit before scoring. More code alone will not close it.** |

**Score:** 4/7 truths verified (0 present-but-behavior-unverified)

Plan-level must-haves (26 plans): 73 of 74 declared artifacts pass. `knowledge/evaluation.rs` was split into `knowledge/evaluation/{mod,replay,tests}.rs`, which is documented in 02-18-SUMMARY, and the module path is unchanged. 46 of 47 key links pass. The remaining link, `evaluation → extract_from_segments`, was confirmed by hand in `evaluation/replay.rs:7,85`.

### Deferred Items

None. Step 9b checked later phases: Phase 3 consumes eligibility and Phase 5 covers series memory, but neither addresses cross-type suppression, attribute word boundaries or the KNOW-07 exit gate. KNOW-07 is this phase's own exit gate, so it cannot be deferred.

### Required Artifacts (key)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `migrations/20260927000100_phase2_knowledge_ledger.sql` | Append-only runs, items, links, abstentions | ✓ VERIFIED | Triggers, CHECKs and the one-running index are present |
| `migrations/20260927000200_phase2_knowledge_reviews.sql` | Reviews, revisions, `knowledge_item_current` | ✓ VERIFIED | The view picks the latest review by sequence and the latest revision as the chain tip |
| `migrations/20260927000300_phase2_knowledge_suppressions.sql` | Suppressions + duplicate_count | ✓ VERIFIED | |
| `src/knowledge/span_verifier.rs` | Normalization, claim and attribute verification | ⚠️ PARTIAL | The claim path is sound. The attribute path has the substring defect |
| `src/knowledge/matcher.rs` | Rejection-first suppression | ⚠️ PARTIAL | Priority rules are correct within a type. There is no cross-type rejection match |
| `src/knowledge/extraction.rs`, `commands.rs`, `review.rs`, `projection.rs`, `repository.rs` | Orchestration, commands, review, projection | ✓ VERIFIED | All 11 knowledge commands are registered in lib.rs:767-776 |
| `src/knowledge/evaluation/{mod,replay,tests}.rs`, `src/bin/telu-knowledge-eval.rs` | KNOW-07 harness | ⚠️ PARTIAL | Runs and is content-free, but deletion residue is never measured, resurrection is tautological, and null leaves in a declared scope pass |
| `tests/knowledge_deletion.rs` | Zero-residue deletion | ✓ VERIFIED | 3/3 pass |
| living-doc components (knowledge-section, candidate-row, review-head, rejected-group, source-chip, evidence-popover, history-popover, transcript-drawer, delete-meeting-alert, run-notice, meeting-page) | Review and evidence UI | ✓ VERIFIED | No raw-HTML APIs; text renders as plain nodes |
| agenda / app-shell / side-peek | Today, Review, shell, peek, search | ✓ VERIFIED | Card state comes from Rust `cardState`; agenda lib tests 5/5 |
| `eval/know-07-status.json`, `thresholds-v1.json`, `synthetic-report.json` | Derived KNOW-07 status | ✓ present, status `open` | Derivation test passes 4/4 |

### Key Link Verification (critical)

| From | To | Via | Status |
|------|----|-----|--------|
| knowledge-section.tsx | knowledge_start_extraction | `validateProviderRoute` (line 117) then `startKnowledgeExtraction` (line 122); Rust revalidates in `begin_run` before inserting the run | WIRED |
| extraction.rs | span_verifier.rs | `verify_claim_quote` / `verify_attribute` run on every parsed item before persistence | WIRED |
| extraction.rs | matcher.rs | `place()` → `match_candidate` | WIRED (same-type only) |
| candidate-row.tsx | knowledge_review_item / correct_item | knowledge-service invoke wrappers; the Rust view is applied | WIRED |
| evidence-popover.tsx | transcript-drawer.tsx | `EvidenceNavigationContext.openEvidence` → `highlightFor` → `scrollToEvidence` | WIRED |
| delete-meeting-alert.tsx | knowledge_deletion_impact / api_delete_meeting | `getDeletionImpact`, `deleteMeeting` | WIRED |
| api.rs | extraction.rs | `cancel_active_extraction` before `delete_meeting` (api.rs:772) | WIRED |
| evaluation/replay.rs | extraction.rs | `extract_from_segments` (the same pure pipeline the app uses) | WIRED |
| verify-phase2-know07-status.test.cjs | know-07-status.json | re-derives the status and compares it with the committed file | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| CandidateRow eligibility | `item.eligibility` | Rust `item_view` → `knowledge_item_current` + link re-verification | Yes | ✓ FLOWING |
| EventCard state / counts | `cardState`, `pendingCount` | `agenda_list_day` / `agenda_counts` SQL | Yes | ✓ FLOWING |
| Transcript drawer lines | evidence rows | `knowledge_list_evidence` → `list_evidence_by_meeting`; legacy fallback only when there are zero evidence rows | Yes | ✓ FLOWING |
| Delete alert counts | impact | `knowledge_deletion_impact` SQL | Yes | ✓ FLOWING |

### Behavioral Spot-Checks (run by the verifier on HEAD)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Knowledge module (extraction, review, projection, matcher, regenerate, eval) | `cargo test --lib knowledge::` | 61 passed, 0 failed | ✓ PASS |
| Knowledge-named invariant tests | `cargo test --lib knowledge_` | 37 passed | ✓ PASS |
| Zero-residue deletion | `cargo test --test knowledge_deletion` | 3 passed | ✓ PASS |
| Eval CLI (content-free, replay, export, 32 MiB cap) | `cargo test --test knowledge_eval_cli` | 4 passed | ✓ PASS |
| Agenda projection | `cargo test --lib agenda` | 5 passed | ✓ PASS |
| Knowledge UI components | `bun test` on knowledge-review, evidence-popover, delete-meeting-alert, knowledge-section, knowledge-run, transcript-drawer | 40 passed | ✓ PASS |
| KNOW-07 status derivation | `node --test .github/verify-phase2-know07-status.test.cjs` | 4 passed; status `open` | ✓ PASS (status open) |
| Palette gate over frontend/src | `node frontend/scripts/telu-palette.mjs check` | exit 0 | ✓ PASS |
| Threshold hash binding | `shasum -a 256 thresholds-v1.json` vs synthetic-report.thresholdsSha256 | both 6af4ebe9… | ✓ PASS |

The orchestrator's full-suite results (node 60/60, bun 130/130, cargo workspace 417 lib tests) were not re-run in full. The targeted runs above agree with them. Note that the passing suite includes a test that asserts the cross-type resurrection behaviour, so the suite being green does not rule out the KNOW-05 gap.

### Probe Execution

Step 7c: SKIPPED. No `scripts/*/tests/probe-*.sh` exists and no plan declares one.

### Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|--------------|--------|----------|
| KNOW-01 | 02-01, 02-03, 02-12, 02-15, 02-19 | ✓ SATISFIED | Truth 1 |
| KNOW-02 | 02-01…02-11, 02-14, 02-19, 02-21, 02-22, 02-23 | ✓ SATISFIED | Truth 1; SourceChip, EvidencePopover, drawer highlight |
| KNOW-03 | 02-02, 02-04…02-11, 02-13, 02-16, 02-21, 02-24, 02-25, 02-26 | ✓ SATISFIED | Truth 2 |
| KNOW-04 | 02-05, 02-23, 02-24 | ✓ SATISFIED | Truth 3 |
| KNOW-05 | 02-12, 02-15, 02-24 | ✗ BLOCKED (partial) | Truth 4: cross-type resurrection. REQUIREMENTS.md currently marks it [x] Complete, and this report disputes that |
| KNOW-06 | 02-03, 02-05, 02-15, 02-24 | ✗ BLOCKED (partial) | Truth 5: substring attribution. REQUIREMENTS.md currently marks it [x] Complete, and this report disputes that |
| KNOW-07 | 02-18, 02-20 | ✗ OPEN (not satisfied, never passed) | Truth 7. REQUIREMENTS.md correctly keeps it Pending |
| KNOW-08 | 02-05, 02-17, 02-23, 02-24 | ✓ SATISFIED | Truth 6 |

Orphaned requirements: none. All 8 IDs mapped to Phase 2 in REQUIREMENTS.md are claimed by at least one plan.

### Prohibitions (judgment tier; the LLM-judge verdict is non-authoritative and each is flagged for human review)

| Plan | Prohibition | Verdict |
|------|-------------|---------|
| 02-01 | No candidate with a non-verbatim citation | Holds: `verify_claim_quote` is required and zero-link items abstain |
| 02-01 | No transcript to an unrevalidated route | Holds: `validate_route_contract` runs before the run insert and before the spawn |
| 02-02 | Pinned Playwright | Holds: `"@playwright/test": "1.63.0"` |
| 02-03 | MUST NOT attribute an owner or due that the quoted words do not state | **VIOLATED**: substring match (gap 2) |
| 02-04 | No hard-coded palette classes | Holds: palette check exits 0 |
| 02-05 | No ineligible item made eligible; no overwrite of history | Holds |
| 02-12 | MUST NOT resurrect a rejected item through regeneration | **VIOLATED**: cross-type re-emission (gap 1) |
| 02-15 | No extraction before the route is visible and revalidated | Holds in code; visibility is part of the copy review |
| 02-16 / 02-25 | No fake or unbacked rows, cards or states | Holds |
| 02-17 | No leftover knowledge; no false claim that audio was removed | Holds |
| 02-18 | No content in reports | Holds: content-free test passes |
| 02-20 | Do not present synthetic metrics as representative; do not mark KNOW-07 complete | Holds: this report records KNOW-07 as open |
| 02-24 | No skipped text shown; changed or missing evidence never eligible | Holds |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (all 210 files changed since 5fca229) | — | TBD / FIXME / XXX / TODO / HACK / placeholder | none found | — |
| living-doc, agenda, app-shell, side-peek | — | `dangerouslySetInnerHTML` / `innerHTML` | none found | — |
| `src/knowledge/matcher.rs` | 136 | Test that asserts the resurrection path as intended behaviour | 🛑 Blocker | Keeps KNOW-05 open in CI |
| `src/knowledge/evaluation/mod.rs` | 443 | `deletion_residue: None` hard-coded | ⚠️ Warning | The eval gate cannot fail that invariant |
| `src/knowledge/projection.rs` / `transcript-drawer.tsx` | 293 / 125 | After evidence redelivery (`upsert_final_evidence` can rewrite text), a link stays `valid` if the quote still appears somewhere, but the highlight uses the stored raw offsets | ℹ️ Info | The drawer may mark the wrong characters on a re-delivered segment. Eligibility itself is correct |

### Human Verification Required

These items are also listed in the frontmatter. They were collected from the 02-16, 02-19, 02-20 and 02-21 summaries and their `<human-check>` blocks, plus one real-provider loop the verifier added.

1. **Packaged-app window chrome (02-16):** DMG vibrancy, traffic lights, drag strips, fullscreen, close-to-hide.
2. **Recording via RecordingHost (02-19):** ⌘R, capsule Stop, tray Record, force-quit recovery under the same id.
3. **Before/after gallery and copy review (02-21):** A1 dark mode, A2 No evidence copy, A4 run notice wording, A5 delete audio line.
4. **Representative KNOW-07 evaluation (02-20):** human data and judgment.
5. **Real-provider end-to-end knowledge loop:** no automated test uses a live provider reply.

### Gaps Summary

There are three gaps with two root-cause groups:

- **Trust in reviewed knowledge (code, small, blocking):**
  - Gap 1 (KNOW-05): the matcher's same-type filter lets a rejected claim return under a different type. The eval resurrection metric uses the same rule, so it cannot detect this.
  - Gap 2 (KNOW-06): owner and due verification is a substring test, so partial-word matches become quoted, "stated" attribution.
  - Both are narrow fixes (type-agnostic matching against rejected items; whole-token matching for attributes), each with a regression test. Both also affect the Phase 3 contract: Phase 3 reads `list_eligible_items`, so a resurrected item that the user accepts again, or a fabricated owner, would reach preparation context.
- **KNOW-07 exit gate (mostly human):** thresholds are undeclared and the representative evaluation has not happened. This is by the user's "pilot first" choice at the 02-20 checkpoint, and the repo reflects it honestly. Closing it requires the user to run consented representative meetings, keep gold labels outside the repo, and declare thresholds in their own commit before scoring. Before that evaluation can count, the harness needs three fixes: measure deletion residue, make the resurrection measure non-tautological, and return undeclared for any null leaf. Phase 3 stays blocked until `eval/know-07-status.json` reads `satisfied`.

REQUIREMENTS.md currently marks KNOW-05 and KNOW-06 as `[x] Complete`. This verification disputes both. The file was not edited here; that decision is left to the orchestrator.

---

_Verified: 2026-09-28T12:07:14Z_
_Verifier: Claude (gsd-verifier)_
