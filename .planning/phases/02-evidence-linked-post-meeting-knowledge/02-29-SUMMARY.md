---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 29
subsystem: knowledge
tags: [rust, span-verifier, attribution, whole-token, know-06, gap-closure]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: "02-03 span verifier and extraction pipeline; 02-27 extraction.rs superseded_keys (left intact)"
provides:
  - "find_whole_token: whole-token matching shared by attribute verification, stated-text slicing and claim-quote matching"
  - "verify_attribute(value, label, quote, segments, claim_evidence_ids): stated only for whole-token, verbatim, single-span, claim-tied, non-pronoun values of at least 2 chars"
  - "Claim quotes abstain with quote_not_found when they start or end mid-word"
affects: [02-33 representative KNOW-07 evaluation, phase-03 recall eligibility]

actuals:
  tokens: 4200
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Attribute text is always sliced verbatim from one verified span; the model's value string is never stored as stated text"
    - "Token boundary = neighbouring char is not alphanumeric or is a text edge; checked at every start position, not only non-overlapping match_indices hits"

key-files:
  created: []
  modified:
    - frontend/src-tauri/src/knowledge/span_verifier.rs
    - frontend/src-tauri/src/knowledge/extraction.rs

key-decisions:
  - "find_whole_token scans every char start (char_indices + starts_with) instead of match_indices, so a whole-token occurrence that overlaps an earlier mid-word hit is still found"
  - "match_across takes the first whole-token occurrence and rejects it if it starts past the first covered segment; occurrences are position-ordered, so this equals skipping later ones"
  - "An attribute is claim-tied when any of its spans is in a claim segment or the segment right after the last claim segment; stated text is still the first whole-token occurrence in span order, as the plan specifies"

patterns-established:
  - "Whole-token rule: one private helper (find_whole_token) is the only substring matcher in span_verifier.rs"

requirements-completed: [KNOW-06]

coverage:
  - id: D1
    description: "A partial-word owner (Tom/tomorrow, Ann/Joanne, Ed/decided) persists as not_stated with NULL owner_text and no owner link; after Accept the item view reports NotStated and unresolved"
    requirement: KNOW-06
    verification:
      - kind: integration
        ref: "frontend/src-tauri/src/knowledge/extraction.rs#knowledge_extraction_never_states_an_owner_that_only_matches_part_of_a_word"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/span_verifier.rs#verify_attribute_rejects_values_that_only_match_part_of_a_word"
        status: pass
    human_judgment: false
  - id: D2
    description: "Stated attribute text is verbatim from one span, capped at 80 raw chars, never the model's value (WR-09)"
    requirement: KNOW-06
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/span_verifier.rs#verify_attribute_never_stores_text_that_crosses_a_segment_boundary"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/span_verifier.rs#verify_attribute_rejects_a_raw_slice_longer_than_the_attribute_cap"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/span_verifier.rs#verify_attribute_stores_the_first_whole_token_occurrence"
        status: pass
    human_judgment: false
  - id: D3
    description: "Pronouns (i, we, you, they), empty, whitespace-only and single-char values are never stated; attributes need a claim-tied span"
    requirement: KNOW-06
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/span_verifier.rs#verify_attribute_never_states_short_values_or_pronouns"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/span_verifier.rs#verify_attribute_requires_a_span_tied_to_the_claim"
        status: pass
    human_judgment: false
  - id: D4
    description: "Claim quotes verify only at whole-token occurrences; a mid-word first hit falls through to a later whole-token one (WR-01)"
    requirement: KNOW-06
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/span_verifier.rs#verify_claim_quote_rejects_quotes_that_start_or_end_mid_word"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/knowledge/span_verifier.rs#find_whole_token_sees_an_occurrence_that_overlaps_a_mid_word_one"
        status: pass
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml --test knowledge_eval_cli"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-09-28
status: complete
---

# Phase 02 Plan 29: Whole-Token, Claim-Tied Owner and Due Verification Summary

**Owner and due values are stated only when the transcript names them as whole words, sliced verbatim from one span that is tied to the claim. Pronouns and 1-char values are never stated, and claim quotes carved out of words like "disagree" or "cannot" now abstain.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-09-28T13:59:44Z
- **Completed:** 2026-09-28T14:11:07Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Closed verification gap 2 (KNOW-06 / SC4, review CR-01). Owners Tom, Ann and Ed are no longer stated from "tomorrow", "Joanne" and "decided". This holds end to end: persistence stores `not_stated` with a NULL `owner_text` and no owner link, and after Accept the item view reports `FieldSupport::NotStated` with `unresolved = true`.
- WR-09: `stated_text` now returns `Option<String>`. It slices only from one span's whole-token occurrence, returns `None` if the raw slice is over 80 characters, and no longer falls back to the model's value.
- CR-01 hardening: added `MIN_ATTRIBUTE_CHARS = 2` and `NON_ATTRIBUTE_VALUES = [i, we, you, they]`. An attribute is stated only if one of its spans sits in a claim segment or the segment right after the last claim segment. `extraction::verify_item` passes the verified claim evidence ids through `attribute_support`.
- WR-01: `match_across` locates claim quotes through `find_whole_token`. "agree with the plan to ship Friday" no longer verifies inside "I disagree ...", and "not ship the beta today" no longer verifies inside "We cannot ...". A mid-word first hit falls through to a later whole-token one.
- Maria / "by Friday" stay stated. The eval CLI replay still yields 4 standup items with owner Maria and due "by Thursday".

## Task Commits

1. **Task 1 (tracer): partial-word owner never stored as stated**
   - `19d4337` test(02-29): add failing partial-word owner tests for CR-01 (RED)
   - `a5721a0` fix(02-29): match owner and due values only as whole tokens (GREEN)
2. **Task 2: verbatim single-span text, min length/pronouns, claim tie, whole-token claim quotes**
   - `13474d2` test(02-29): add failing tests for WR-09, CR-01 claim tie and pronouns, WR-01 (RED)
   - `42866bb` fix(02-29): state attributes only as verbatim whole tokens tied to the claim (GREEN)

No REFACTOR commits. The one tidy-up (early returns in `verify_attribute`) went into the GREEN commit before it was committed.

## TDD Gate Compliance

Both tasks have a RED commit (`test(02-29)`) followed by a GREEN commit (`fix(02-29)`).

**Task 1 RED evidence** (`cargo test ... knowledge:: --lib` at 19d4337: 69 passed, 2 failed):
- `knowledge_extraction_never_states_an_owner_that_only_matches_part_of_a_word` panicked: `assertion failed: owners.iter().all(|owner| owner == &(None, "not_stated".to_string()))`
- `verify_attribute_rejects_values_that_only_match_part_of_a_word`: `left: Stated { text: "tom", spans: [... quote_text: "We ship tomorrow for sure" ...] }`, `right: NotStated`. The raw substring check sliced "tom" out of "tomorrow".

**Task 2 RED evidence** (at 13474d2: 72 passed, 6 failed):
- crossing segment boundary: `Stated { text: "on Friday", ... }`, which is the model's own value (WR-09 fallback)
- raw slice cap: `Stated { text: "Maria     Nadia ...     Vera" }`, 89 raw chars
- pronouns: `value "I"` gave `Stated { text: "I", ... quote_text: "I'll take it from here" }`
- claim tie: owner in S3 with claim ids [evidence-S1] gave `Stated { text: "Maria" }`
- mid-word claim quote: `Ok([... raw_start: 5, quote_text: "agree with the plan to ship Friday" ...])` carved from "disagree"
- `find_whole_token("xab ab ab", "ab ab")` gave `None` (match_indices skipped the overlapping whole-token hit)

`verify_attribute_stores_the_first_whole_token_occurrence` (Test 5) already passed at RED, because Task 1's `stated_text` change made it true. It stays as the regression test for the ordering edge.

For Task 2, the RED commit also gave `verify_attribute` a `_claim_evidence_ids` parameter that it ignored, and extraction.rs passed the claim ids into it. This let the new tests compile and fail on behavior rather than on a compile error. GREEN put the parameter to use.

## Files Created/Modified

- `frontend/src-tauri/src/knowledge/span_verifier.rs`: `find_whole_token`, `is_token_boundary`, `is_attributable`, `is_tied_to_claim`, `whole_token_slice`, `stated_text -> Option<String>`, constants `MIN_ATTRIBUTE_CHARS` / `NON_ATTRIBUTE_VALUES`, `verify_attribute` with `claim_evidence_ids`, `match_across` using whole tokens, and 8 new unit tests.
- `frontend/src-tauri/src/knowledge/extraction.rs`: `verify_item` collects claim evidence ids, `attribute_support` passes them on, and the new end-to-end regression test.

## Decisions Made

- `find_whole_token` checks every char start position (`char_indices` + `starts_with`) rather than only the non-overlapping `match_indices` hits the plan and review sketched. With `match_indices`, a mid-word hit can hide a whole-token occurrence that overlaps it. Inputs are single segments or two-segment joins, so O(n*m) is negligible. An empty needle returns `None`.
- `match_across` takes the first whole-token occurrence and rejects it if it starts past the first covered segment. Occurrences and the raw map are both monotonic, so this is the same as the plan's "skip mid-word ones and ones past the first segment".
- The claim tie is a necessary condition on the attribute's spans. The stored text is still the first whole-token occurrence in span order, as the plan specifies.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] find_whole_token missed whole-token occurrences overlapping a mid-word hit**
- **Found during:** Task 2 (designing the WR-01 fall-through)
- **Issue:** The Task 1 implementation iterated `match_indices`, which yields only non-overlapping matches. `find_whole_token("xab ab ab", "ab ab")` returned `None` even though a whole-token occurrence exists at 4. A claim quote or attribute could wrongly abstain or be not-stated.
- **Fix:** Iterate every char start with `starts_with`, and treat an empty needle as `None`.
- **Files modified:** frontend/src-tauri/src/knowledge/span_verifier.rs
- **Verification:** `find_whole_token_sees_an_occurrence_that_overlaps_a_mid_word_one` (red at 13474d2, green at 42866bb)
- **Committed in:** 13474d2 (test), 42866bb (fix)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** This is a correctness fix inside the plan's own helper. No scope change.

## Issues Encountered

- Free disk space dropped from 8.1 GiB to 3.7 GiB during the cargo test runs. Building the `knowledge_eval_cli` integration test binary accounts for most of the drop. I did not run a clean. Later plans should watch the remaining space.

## Threat Model Coverage

- T-02-80 (spoofing of stated attribution): mitigated by whole-token matching, the minimum length, the pronoun list, verbatim single-span text and the claim tie (D1 to D3).
- T-02-81 (tampering via mid-word claim quotes): mitigated by whole-token matching in `match_across` (D4).
- T-02-82 (attribution recall): accepted. More attributes now show as "not stated", and the user fills them in through Correct.

## Known Stubs

None.

## User Setup Required

None. No external service configuration required.

## Next Phase Readiness

- The KNOW-06 / SC4 gap is closed in code. Rows persisted before this fix keep their stored attribute support, because nothing re-verifies on read. Per the plan's flagged assumption, 02-33 must score only meetings whose first knowledge run started after commit `42866bb`.
- Ready for the remaining Phase 02 gap plans.

---
*Phase: 02-evidence-linked-post-meeting-knowledge*
*Completed: 2026-09-28*

## Self-Check: PASSED

- FOUND: frontend/src-tauri/src/knowledge/span_verifier.rs, frontend/src-tauri/src/knowledge/extraction.rs
- FOUND commits: 19d4337, a5721a0, 13474d2, 42866bb
- Plan verification: `knowledge::` 78 passed / 0 failed; `knowledge_eval_cli` 4 passed; full lib 434 passed / 0 failed
