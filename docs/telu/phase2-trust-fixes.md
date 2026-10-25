# Phase 2 trust fixes: resolution notes

Resolution notes for the Phase 2 GSD review (`02-REVIEW.md`, `02-VERIFICATION.md`). Branch `loop/phase2-trust`, base `7c13d69`. Nothing under `knowledge/` or `summary/` changed.

Each code fix has a test that fails on the base code for the reason the finding names. WR-82 to WR-86 are test-hardening fixes: the change is to the tests or the gallery config, and each item's evidence records a scratch break or zone run that the hardened check now catches. Test paths are relative to `frontend/`.

## Findings fixed

| Finding | Fix | Commit | Test that proves it |
|---|---|---|---|
| CR-40 | Each review toast's Undo reverts the action that toast reports. ⌘Z undoes the latest action. A correction dismisses earlier toasts whose Undo no longer applies. | `eaaf712` | `tests/components/knowledge-review.test.tsx`: "each toast's Undo reverts its own action; ⌘Z takes the latest; a correction dismisses the rest" |
| CR-40 (browser) | The gallery runs accept A, reject B, then Undo on A's toast. A goes back to Proposed and B stays Rejected. | `17255d0` | gallery screen `knowledge-review-undo` in `tests/visual/screens/knowledge.json` |
| WR-41 | Accept all counts and undoes only the items Rust actually accepted. | `4b8bffa` | `tests/components/knowledge-review.test.tsx`: "Accept all counts and undoes only the requested items Rust accepted", "Accept all with nothing accepted by Rust says so and offers no Undo" |
| WR-40 | Accept-all stagger timers are cleared on unmount and when the user makes a newer decision. | `76c3246` | `tests/components/knowledge-review.test.tsx`: "a decision made during the Accept-all stagger survives the late timers; unmount clears them" |
| IN-41 | The ⌘Z listener is attached once. An Undo entry expires when its toast closes. | `76c3246` | `tests/components/knowledge-review.test.tsx`: "the ⌘Z listener is attached once across re-renders", "an Undo entry expires when its toast closes" |
| WR-42 | A knowledge reload applies only the latest reply. A late older reply is ignored. | `14eefdf` | `tests/components/knowledge-section.test.tsx`: "ignores an older knowledge reply that arrives after a newer one" |
| WR-43 | A failed knowledge load shows an error with Try again, not a permanent skeleton or spinner. | `7cefa12` | `tests/components/knowledge-section.test.tsx`: "shows a load error with Try again when the knowledge load fails, and Try again reloads", "shows the load error, not a running spinner, when an auto-generate load fails"; gallery screen `knowledge-load-failed` in `tests/visual/screens/knowledge.json` |
| IN-44 | A rejected knowledge-updated subscription is logged, not left unhandled. | `7cefa12` | `tests/components/knowledge-section.test.tsx`: "logs a rejected knowledge-updated subscription instead of leaving it unhandled" |
| WR-44 | A failed route check clears on the next good check, and Check again triggers one. | `f026f75` | `tests/components/knowledge-run.test.tsx`: "a route check that fails before a start clears once the next check succeeds" |
| WR-45 | Stop handles a rejected cancel with a toast, and reloads when there was nothing to cancel. | `f026f75` | `tests/components/knowledge-run.test.tsx`: "Stop shows an error toast when the cancel is rejected", "Stop reloads the view when there was nothing to cancel" |
| WR-46 | A correction records the revision the editor opened from, so a concurrent change surfaces as a conflict. | `a2a76b0` | `tests/components/knowledge-review.test.tsx`: "a correction is based on the revision the editor opened from, not one that arrived while editing" |
| WR-47 | Enter during an IME composition does not save. | `a2a76b0` | `tests/components/knowledge-review.test.tsx`: "Enter during an IME composition does not save the correction" |
| IN-45 | The delete alert shows Try again when the impact query fails, instead of a dead dialog. | `264d4f5` | `tests/components/delete-meeting-alert.test.tsx`: "a failed impact query shows Try again, which reloads the counts and enables Delete"; gallery screen `delete-alert-impact-failed` in `tests/visual/screens/delete-alert.json` |
| IN-43 | Escape closes only the topmost layer: a popover in the transcript drawer closes first. | `264d4f5` | `tests/components/transcript-drawer.test.tsx`: "an Escape already handled by an open popover leaves the drawer open; the next Escape closes it" |
| CR-20 | Search snippets are sliced by character on the original text, so İstanbul, Greek and emoji cannot panic. | `448e6bf` | `src-tauri/src/database/repositories/transcript.rs`: `match_context_survives_lowercase_that_grows_in_bytes`, `match_context_keeps_greek_case_insensitive_matches`, `match_context_windows_by_characters_around_the_match`, `match_context_handles_matches_at_the_start_and_end`, `match_context_never_panics_on_mixed_width_text` |
| CR-60 | Transcript search runs once per query. Provider re-renders no longer fire it again. | `672e12a` | `tests/components/search-popover.test.tsx`: "a query runs the search command once; unrelated provider re-renders do not run it again" |
| CR-61, WR-20 | Search returns one best match per meeting, so popover keys and values are unique. | `ea55626` | `src-tauri/src/database/repositories/transcript.rs`: `transcript_search_returns_one_entry_per_meeting_preferring_the_title`, `transcript_search_keeps_the_earliest_segment_when_the_title_misses`, `transcript_search_does_not_let_one_meeting_crowd_out_others`; `tests/components/search-popover.test.tsx`: "renders one CommandItem per result with a unique value and no duplicate-key warning" |
| WR-22 | An agenda card keeps its accepted state after a failed regenerate. | `9c7eed6` | `src-tauri/src/agenda/mod.rs`: `agenda_keeps_accepted_knowledge_after_a_failed_regenerate` |
| IN-22 | Deleting a meeting cancels its extraction only after the delete succeeds. | `3fe77d4` | `src-tauri/tests/knowledge_deletion.rs`: `a_delete_of_an_unknown_meeting_leaves_its_extraction_running`, `a_delete_that_errors_leaves_the_extraction_running`, `a_successful_delete_cancels_the_extraction_and_leaves_no_residue` |
| WR-82 | The validate-before-start test asserts that validate was called. | `aa29521` | `tests/components/knowledge-run.test.tsx`: "Find knowledge is disabled while unvalidated and revalidates the route before starting" |
| WR-83 | The corrected-value test asserts the value exists before comparing it. | `aa29521` | `tests/components/knowledge-review.test.tsx`: "single Accept and Reject offer Undo and ⌘Z; ⌘Z in a text field and corrections do nothing" |
| WR-84 | The eligibility test uses a fixture the UI derives eligibility from, and asserts on rendered text. | `aa29521` | `tests/components/knowledge-review.test.tsx`: "invalid evidence is never eligible and keeps Reject and Correct…; unresolved accepted fields turn amber" |
| WR-85 | Every test file restores its module mocks, so files pass alone and in any order. | `45d12b5` | `tests/module-mocks-restored.test.ts`: "%s restores every module it mocks" |
| WR-86 | The gallery pins `Europe/Athens` and `en-GB`, and the stub's frozen date carries its offset. | `3855644` | `tests/visual/playwright.config.ts` (`timezoneId`, `locale`); gallery screen `today-populated` in `tests/visual/screens/today.json` renders the same under any machine zone |

The loop also added these checks. They are not tied to a single finding:

| Check | Commit | Test |
|---|---|---|
| Undo on an item that changed elsewhere says nothing was undone and touches no other item. | `4de8b49` | `tests/components/knowledge-review.test.tsx`: "Undo on an item that changed elsewhere (${code}) says nothing was undone and touches no other item", "a batch Undo that hits a changed item after reverting another says only part was undone" |
| A second click on Accept, Reject, Restore or Undo while the first is in flight sends nothing. | `01b880e` | `tests/components/knowledge-review.test.tsx`: describe "a second click while the first call is in flight sends nothing" |
| Blank search queries send nothing. One-character, combining-mark-only and 500-character queries stay within the result cap. | `8119f7f` | `src-tauri/src/database/repositories/transcript.rs`: `transcript_search_handles_one_char_combining_mark_and_500_char_queries_within_the_cap`; `tests/components/search-popover.test.tsx`: "an empty or whitespace-only query sends no search command" |
| Human check 5 automated with a staged model: review, regenerate, restore, then delete leaves no residue. | `546b255` | `src-tauri/tests/knowledge_review_loop.rs`: `review_regenerate_restore_and_delete_loop_with_a_staged_model` |

## Human checks still left for a person

These are from `02-VERIFICATION.md` `human_verification`. Code cannot prove them.

1. **Packaged window chrome (02-16).** Build and install the DMG, then check native vibrancy, traffic-light placement (including after fullscreen), drag strips, toolbar buttons, and that close hides the window.
2. **Real recording (02-19).** In `tauri:dev`: ⌘R on Today, Stop in the capsule, Record from the tray, then force-quit and relaunch to check recovery.
3. **Gallery and copy review (02-21).** Compare the before and after gallery sets, and read the No evidence copy, the run notice and the delete dialog audio line.
4. **Delegated KNOW-07 judgment (02-35 to 02-37).** The user confirms or replaces the thresholds and the gold process that Claude chose under delegation. Today's status is unchanged: `{"status":"open","reasons":["representative_gate_not_pass"]}`.
5. **Real-provider loop.** Run the review, regenerate, restore and delete loop against a live Summary provider. The staged-model test (`546b255`) covers the logic, but not the real model's quoting or owner behaviour.

The sixth check, the review-toast Undo (CR-40), is now covered by `eaaf712` and `17255d0`.

## Findings deliberately left open

Other `02-REVIEW.md` findings not listed in these notes are out of scope for this branch. The four below were deliberately left because they live in a frozen path (`frontend/src-tauri/src/knowledge/`), which this branch does not touch:

| Finding | Location | Summary |
|---|---|---|
| WR-02 | `knowledge/projection.rs` | Evidence stays "Valid" after the transcript changes, while the stored offsets are stale. |
| WR-05 | `knowledge/commands.rs` | A `running` run left by a crash or panic is never finalized unless the user starts a new run. |
| WR-08 | `knowledge/extraction.rs`, `knowledge/commands.rs` | Cancelling removes the registry entry before the task stops, so a quick restart runs two extractions at once. |
| IN-03 | `knowledge/review.rs` | Correction cleaning joins words across line breaks. |
