# Telu P2 trust gaps

Task: fix the open Phase 2 review findings outside knowledge/ and summary/, tighten weak tests, and automate the provable human checks, on branch loop/phase2-trust, worktree /Users/nrentas/dev/telu.fyi-trust, from 7c13d69 on codex/phase-01-baseline. Rules: CODING_STANDARDS.md and the constraints in .loop/config.json.

## Baseline (init, 2026-10-24)

- `bash .loop/gate.sh` green at 7c13d69 in about 6 minutes: cargo 477 lib tests passed (3 ignored) plus every integration test; bun 130 pass across 22 files; node 70 pass (.github contract tests and the onboarding test); typecheck 0 errors in src and 36 pre-existing errors in tests/ (bun runs those files fine; the gate fails above 36); gallery 146 passed (73 screens, light and dark, about 5 minutes).
- Tools added at init: cmake 4.4 and bun 1.4 (Homebrew), Playwright WebKit. The llama-helper and FFmpeg sidecars are in frontend/src-tauri/binaries (gitignored); init.sh provides them, because build/ffmpeg.rs rejects the FFmpeg zip with 'Invalid checksum' although unzip -t passes.
- `cargo fmt --check` fails on 130 existing files; the gate checks rustfmt only on new .rs files.

## Facts found at init

- Findings and their code (from .planning/phases/02-evidence-linked-post-meeting-knowledge/02-REVIEW.md, 02-VERIFICATION.md):
  - CR-40: review-block.tsx useUndo keeps one `last` ref (lines 77-96); every toast's Undo calls the same undo() (157-160); remember(null) after correct or restore (138) disables every visible Undo. Suggested fix in 02-REVIEW.md lines 651-675.
  - WR-40 stagger setTimeout (111-115); WR-41 knowledge_accept_all drops Rust's accepted count, so derive it from the returned view; IN-41 ⌘Z listener re-attached each render.
  - CR-20: database/repositories/transcript.rs get_match_context (315-336) slices the original with byte offsets from the lowercased string.
  - CR-60: search-popover.tsx effect (30-35, 53) depends on `search`; SidebarProvider.tsx:192 searchTranscripts is a plain async arrow.
  - CR-61/WR-20: search-popover.tsx:81 CommandItem key and value are result.id; the UNION returns several rows per meeting.
  - WR-42 to WR-45 in knowledge-section.tsx (reload ordering 65-96, Stop at 284); WR-46/47 in candidate-row.tsx (182); WR-22 in agenda/mod.rs (95-115); IN-22 in api/api.rs (772-776); IN-45 delete alert; IN-43 Escape; IN-44 listen catch.
  - Weak tests: WR-82 knowledge-run.test.tsx:209; WR-83 knowledge-review.test.tsx:379-380; WR-84 knowledge-review.test.tsx:265-268; WR-85 module mocks leak; WR-86 playwright.config.ts has no timezoneId or locale.
- Knowledge test helpers (knowledge/test_support.rs) are #[cfg(test)] pub(crate), so T18 writes its own helpers in the integration test.
- Bun tests mock IPC with mock.module('@tauri-apps/api/core'); toasts are checked with spyOn(toast, ...).
- The gallery IPC stub (frontend/tests/visual/tauri-ipc-stub.js) is stateless today; T17 adds an opt-in state.
- pnpm is not installed globally: .loop/bin/pnpm runs corepack pnpm@9.15.9 under Node 24 (.loop/env.sh puts it on PATH).

## Open questions

## Sessions

## Session 1 · T1 · 2026-10-24
Did: CR-40. useUndo in review-block.tsx now keeps a list of live entries keyed by a module-wide toast id (`review-undo-N`, passed as sonner `id`). Each toast's Undo undoes its own entry, ⌘Z the newest, and a new undoable decision on an item dismisses older toasts for that item. correct, restore and reopen call forgetAll(), which dismisses every live Undo toast; this keeps the old "those actions clear undo" behaviour, now visibly. New test in knowledge-review.test.tsx; on base it got item-2 restore instead of item-1 reopen. Two review passes: fixed toast-id reuse across remounts (the counter is module-level, not per instance), a double filter, and weak asserts.
Learned:
- A valid accepted row has no Reject button, only the "More" menu (Correct…, Move back to review = reopen). Only accepted rows with an evidence problem show Reject. Test helpers that index `buttons('Reject')[n]` hit the wrong row; pick the row by `data-item-id` (see `decide` in the new test).
- The typecheck gate allows at most 36 errors in tests/, and the base already has exactly 36. Every `x.mock.calls[i]?.[1] as {...}` cast on a sonner toast adds TS2352 errors. Cast through `unknown` (the test's `undoOf` helper) and type override objects as `Partial<KnowledgeItemView>`.
- The gate's long output is truncated in the tool view; it is saved under tool-results and `tail`/`grep` on that file show the result. Shell pipes and redirects need approval in loop sessions.
- forgetAll() also fires on reopen ("Move back to review"). T3 (an undo entry expires when its toast closes) can hook into the same `live` list via sonner's onDismiss/onAutoClose.
Next: T2

## Session 2 · T2 · 2026-10-25
Did: WR-41. useAcceptAll keeps only the requested ids from the returned view and counts those whose reviewState is 'accepted'; the toast count and the Undo list use that set. When Rust accepted none, an info toast (REVIEW_TOAST.noneAccepted) replaces "Accepted 0 items" and there is no Undo. Two new tests; on base they got "Accepted 3 items" and a success toast. Picked up the uncommitted work of the first T2 attempt, which had the code and tests in place; the gate passed this time.
Learned:
- Rust apply_accept_all (knowledge/review.rs:120-136) skips items that are not proposed in the DB. An item that a stale UI sees as proposed but that was already accepted elsewhere comes back 'accepted' and is still counted. Only a Rust change can tell those apart, and Rust is out of scope.
- To prove a test fails on base without git stash, write `git show HEAD:<file>` over the file, run the test, then copy your saved version back.
Lesson: [this project] the first T2 session failed without committing and left no progress note → when a session runs out, write a progress line about the uncommitted work before stopping.
Next: T3
