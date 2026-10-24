# Telu P3 sources

Task: Phase 3 build (DOC-01 to DOC-04, PREP-01 to PREP-05) on branch loop/phase3-sources, worktree /Users/nrentas/dev/telu.fyi-phase3, from 7c13d69 on codex/phase-01-baseline. Rules: CODING_STANDARDS.md and the constraints in .loop/config.json.

## Baseline (init, 2026-10-24)

- `bash .loop/gate.sh` green at 7c13d69 in about 6 minutes: cargo 477 lib tests passed (3 ignored) plus every integration test; bun 130 pass across 22 files; node 70 pass (.github contract tests and the onboarding test); typecheck 0 errors in src and 36 pre-existing errors in tests/ (bun runs those files fine; the gate fails above 36); gallery 146 passed (73 screens, light and dark, about 5 minutes).
- Tools added at init: cmake 4.4 and bun 1.4 (Homebrew), Playwright WebKit. The llama-helper and FFmpeg sidecars are in frontend/src-tauri/binaries (gitignored); init.sh provides them, because build/ffmpeg.rs rejects the FFmpeg zip with 'Invalid checksum' although unzip -t passes.
- `cargo fmt --check` fails on 130 existing files; the gate checks rustfmt only on new .rs files.

## Facts found at init

- Phase 3 is formally blocked in .planning/STATE.md until KNOW-07 passes. The user chose to build it on this branch anyway; it is not evaluated or merged until 02-44 and the gate are done.
- There is no upcoming-meeting entity in the app; P1 adds planned meetings. Linking a planned meeting to its recording is out of scope.
- Model seam: knowledge::extraction::run_extraction takes a completer closure FnMut(system, user) -> Future<Result<String, String>>. Copy that pattern into preparation; do not import knowledge test_support (it is #[cfg(test)] pub(crate)).
- Accepted knowledge to read: KnowledgeRepository::list_eligible_items(pool, meeting_id) in knowledge/projection.rs.
- Migrations: frontend/src-tauri/migrations, embedded with sqlx::migrate!, newest 20260927000300_phase2_knowledge_suppressions.sql. New ones use 2026102400xx00_phase3_<name>.sql.
- Rust file dialog: DialogExt::blocking_pick_file, as in audio/import.rs:959.
- Bun tests: frontend/tests/{components,hooks,lib}, bun:test with react-test-renderer; IPC mocked with mock.module('@tauri-apps/api/core'), restored in afterAll. Pattern: tests/components/knowledge-run.test.tsx.
- Gallery: frontend/tests/visual (gallery.visual.ts, tauri-ipc-stub.js, fixtures/base-ipc.json, screens/*.json). The stub is stateless with $byArg, $repeat, $pending and $error directives; unknown commands fail the test.
- pnpm is not installed globally: .loop/bin/pnpm runs corepack pnpm@9.15.9 under Node 24 (.loop/env.sh puts it on PATH).

## Open questions

## Sessions

## P1 · worker 1 · 2026-10-24
Did: migration 20261024000100_phase3_planned_meetings.sql (planned_meetings: id, title CHECK non-blank, start_utc nullable, purpose, created_utc, updated_utc). Module src/planning/ with models.rs (PlannedMeeting, PlannedMeetingInput, PlanningError codes PLANNED_MEETING_TITLE_REQUIRED / _INVALID_START / _INVALID_DAY / _NOT_FOUND / _STORAGE_FAILED), repository.rs (create, get, list_upcoming, update via UPDATE ... RETURNING, delete; tests inline) and commands.rs; five commands registered in lib.rs.
Assumptions: 'today' depends on the user's time zone, so planning_list_upcoming takes today_start_utc (RFC3339, start of the local day) from the UI, as agenda_list_day takes its range. 'Newest first' means created_utc DESC, id DESC. planning_update replaces title, start_utc and purpose; it does not patch individual fields. An empty or missing start_utc means undated.
Learned: start_utc is stored as millisecond UTC 'Z' text (to_rfc3339_opts(Millis, true)), so `start_utc >= ?` compares correctly as text. Bind today_start in the same format. Repository functions take `now: DateTime<Utc>` so tests are deterministic. Nothing logs titles or ids. Commands for U1: planning_create(title, startUtc?, purpose), planning_list_upcoming(todayStartUtc), planning_get(id), planning_update(id, title, startUtc?, purpose), planning_delete(id). The result is camelCase {id, title, startUtc, purpose, createdUtc, updatedUtc}.
Skipped context skills: bussin-a11y and sketch-findings-telu-fyi, because P1 has no UI.
