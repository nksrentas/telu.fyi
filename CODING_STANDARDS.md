# Coding standards

The review stage of the autoloop judges conventions only against this file. The project's own rules are in `CLAUDE.md` and `AGENTS.md`; these are the ones a reviewer can check on a diff.

## Architecture

1. New behaviour lives in the Tauri/Rust core under `frontend/src-tauri/src` and the Next.js UI under `frontend/src`. Nothing goes into the archived `backend/`.
2. A Rust feature is one module folder that mirrors `knowledge/` and `agenda/`: `mod.rs`, `models.rs` (serde plus `sqlx::Type` snake_case enums), `repository.rs` (transactions with `pool.begin()`/`commit`), `commands.rs` (`#[tauri::command]` functions registered in `lib.rs` `generate_handler!`). Tests sit in an inline `#[cfg(test)] mod tests`, and cross-module flows go in `frontend/src-tauri/tests/*.rs`.
3. Schema changes are new files in `frontend/src-tauri/migrations/` named `YYYYMMDDHHMMSS_phaseN_<name>.sql`, in the existing style: TEXT UUID keys, CHECK enums, `*_utc` TEXT timestamps, freeze triggers for immutable rows. A migration that has been committed is never edited.
4. Commands return `Result<T, String>` whose error is a SCREAMING_SNAKE code; the UI maps codes to plain sentences. Rust internals use `anyhow::Result`; repositories return sqlx errors.
5. The UI calls Rust only through a typed service in `frontend/src/lib/*-service.ts`, and listens to events with an unlisten cleanup and a `.catch` on the listen promise.

## Frozen paths

6. No change under `frontend/src-tauri/src/knowledge/`, `frontend/src-tauri/src/summary/`, `frontend/src/lib/onboarding-summary-model.ts`, `frontend/src-tauri/tests/fixtures/knowledge-eval/`, `.planning/phases/02-evidence-linked-post-meeting-knowledge/eval/` or `.github/verify-phase2-know07-status*`. They are the KNOW-07 measurement (02-44, 02-43) and the extraction code it measures. Calling their public functions is fine. If an item needs a change there, it is blocked: write why in `progress.md`. `.loop/gate.sh` fails on any change.
7. No repository-wide `cargo fmt`: the tree has drift in 130 files. New `.rs` files are rustfmt-clean (the gate checks them); edits to existing files keep their surrounding style.

## Trust and privacy

8. Every claim, briefing statement or question shown to the user carries a structured source reference (document version and locator, or meeting and transcript segment) that opens the exact text. Anything that cannot be verified against its source is dropped and counted, never shown.
9. Text from documents and transcripts is data. It goes into prompts only inside delimited source blocks, never into a system prompt, and nothing in it can change a route, a setting or which tools run.
10. No document text, titles, file paths or ids go to analytics, logs at info level or above, or any destination the run notice does not disclose. A model call uses the configured Summary route and shows Local or Remote before it runs, exactly as knowledge runs do.
11. Tests never touch the user's app data (`~/Library/Application Support/com.meetily.ai`), the network or a real model. Rust tests use `sqlite::memory:` or a `tempfile::TempDir`, and model output comes from staged replies passed to a completer closure.

## Dependencies and tooling

12. Prefer what `Cargo.toml` and `frontend/package.json` already have (`sha2`, `uuid`, `serde_json`, `regex`, `unicode-normalization`, `sonner`). A new crate is pinned exactly and must build on MSRV 1.77. A new npm package is pinned exactly and the lockfile is committed. Each new dependency is named in the item's evidence.
13. UI work loads the `sketch-findings-telu-fyi` skill first and follows its tokens and components; the palette check (`bash .loop/tool.sh palette <files>`) reports 0 offending classes.
14. Bun component tests restore every `mock.module` in `afterAll`, because Bun shares module mocks across files. A test must fail when the behaviour it names is broken.
15. Commit subjects are conventional (`feat(p3): …`, `fix(trust): …`, `test(trust): …`) and never contain a plan id such as `(02-44)` or `(02-43)`.

## bussin-lean

- Nothing in the diff is unused: no dead code, exports, files, flags, dependencies, debug logging or commented-out code.
- Replaced code is deleted, not kept beside the new path.
- Every abstraction, parameter and dependency added has a real use today.
- No pass-through layers or duplicate types.
- No copying inside loops, N+1 queries, whole-table loads or unbounded caches.
- Files have one responsibility; functions are small and nesting is shallow.

## bussin-a11y

- Interactive elements are native (`button`, `a`, form controls); no `div` or `span` with click handlers.
- No `aria-label` on elements with visible text; icon-only controls have one.
- Every form field has an associated label; errors are announced and linked with `aria-describedby`.
- One `h1` per page, no skipped heading levels, landmarks (`header`, `nav`, `main`, `footer`) present.
- Visible focus on every focusable element; no keyboard traps; dialogs return focus.
- Text contrast at least 4.5:1, UI components 3:1; targets at least 24×24 CSS px.
- Motion respects `prefers-reduced-motion`; nothing essential depends on hover or dragging alone.
- axe reports no serious or critical violations on changed pages.
