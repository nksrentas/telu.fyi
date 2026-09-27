# Phase 2: Evidence-Linked Post-Meeting Knowledge - Pattern Map

**Mapped:** 2026-09-27
**Files analyzed:** 52 (new + modified; Rust knowledge module, migration, eval CLI, tests, token migration, shell, living-doc UI)
**Analogs found:** 44 / 52 (remaining UI composites map to tracked sketch sources in `.claude/skills/sketch-findings-telu-fyi/`)

All paths below are git-tracked (skill `references/` and 54 `sources/` files verified with `git ls-files`). `backend/` is never an analog. New files: kebab-case, comment-free. Note: existing Rust analogs contain doc/inline comments; do not copy those into new code.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src-tauri/migrations/20260927000100_phase2_knowledge.sql` | migration | CRUD / append-only | `migrations/20260920000200_phase1_transcript_evidence.sql`, `20260920000400_phase1_evaluation_runs.sql` | exact (but drop `ON DELETE CASCADE`) |
| `src-tauri/src/knowledge/mod.rs` | module root | — | `src-tauri/src/summary/mod.rs` (lines 34-41) | exact |
| `src-tauri/src/knowledge/models.rs` | model | transform | `src-tauri/src/database/models.rs` 1-70 | exact |
| `src-tauri/src/knowledge/repository.rs` | repository | CRUD, transactional | `database/repositories/transcript.rs` 11-165 | exact |
| `src-tauri/src/knowledge/normalize.rs` | utility | transform | none (pure fn) — tests follow `transcript.rs` 302+ | no analog |
| `src-tauri/src/knowledge/span_verifier.rs` | utility | transform | none — RESEARCH Pattern 2 | no analog |
| `src-tauri/src/knowledge/matcher.rs` | utility | transform | none — RESEARCH Pattern 4 | no analog |
| `src-tauri/src/knowledge/prompt.rs` | config/utility | transform | `src-tauri/src/summary/processor.rs` / `summary/templates` | role-match |
| `src-tauri/src/knowledge/parse.rs` | utility | transform (untrusted input) | `summary/processor.rs` `clean_llm_markdown_detailed` | partial |
| `src-tauri/src/knowledge/extraction.rs` | service | request-response, background | `summary/service.rs` `process_transcript_background` 350-470 | exact |
| `src-tauri/src/knowledge/commands.rs` | controller (tauri command) | request-response | `summary/commands.rs` 461-556, 355-460 | exact |
| `src-tauri/src/summary/service.rs` (extract `resolve_summary_dispatch`) | service refactor | — | itself, lines 356-463 | self |
| `src-tauri/src/database/repositories/transcript.rs` (+`list_evidence_by_meeting`) | repository | read | same file 61-66 (`query_as::<_, TranscriptEvidence>`) | exact |
| `src-tauri/src/database/repositories/meeting.rs` (delete + impact) | repository | transactional delete | same file 1190-1231 | self |
| `src-tauri/src/lib.rs` (register mod + commands) | config | — | lines 38-58, 616, 761 | self |
| `src-tauri/src/bin/telu-knowledge-eval.rs` | CLI | batch, file-I/O | `src-tauri/src/bin/telu-baseline.rs` 1-60 | exact |
| `src-tauri/tests/knowledge_deletion.rs` | test (integration) | CRUD | `database/repositories/transcript.rs` 302-368 (migrated pool) | role-match |
| `src-tauri/tests/knowledge_eval_cli.rs` (+ `tests/fixtures/knowledge-eval/*`) | test | batch | `src-tauri/tests/baseline_matrix.rs` 33-60 | exact |
| `src-tauri/tauri.conf.json`, capabilities `main` | config | — | RESEARCH Pattern 7 JSON | self |
| `frontend/src/app/globals.css` | config (tokens) | — | skill `foundations-and-motion.md` 296-455 | sketch |
| `frontend/tailwind.config.js` | config | — | skill `foundations-and-motion.md` 507-596 | sketch |
| `frontend/src/app/layout.tsx` | provider/layout | event-driven | itself 4, 30, 111-126 | self |
| `frontend/src/lib/motion.ts` | utility | — | skill `foundations-and-motion.md` 173-284 (paste-ready) | sketch-exact |
| `frontend/src/lib/knowledge-service.ts` | service (invoke wrappers) | request-response | `frontend/src/services/providerRouteService.ts` 1-80 | exact |
| `frontend/src/components/ui/{button,dialog,command,select,dropdown-menu,tooltip,switch,input,textarea}.tsx` | component (restyle) | — | self + `primitives-and-overlays.md` 360-438, 623-713 | self |
| `frontend/src/components/telu-ui/{glass-group,chip,knowledge-type,empty-state,indicators,icon}.tsx` | component | — | `components/ui/accordion.tsx` 1-20 (radix-ui meta import, `data-slot`) + `primitives-and-overlays.md` 360-622 | role-match |
| `components/app-shell/{app-shell,sidebar,sidebar-nav-item,agenda-toolbar,doc-toolbar,recording-capsule}.tsx` | component | event-driven | `components/Sidebar/index.tsx` + `SidebarProvider.tsx` (data), sketch `sources/002-final-app/app-shell.js`, `app-record.js`; `app-shell-and-navigation.md` | sketch + data analog |
| `components/app-shell/recording-host.tsx` | provider/host | event-driven | `frontend/src/app/page.tsx` 1-80 (moves hooks out) | exact (move) |
| `components/agenda/{today-view,review-view,event-card,day-stepper}.tsx` | component | request-response (list) | `SidebarProvider.tsx` 106 (`api_get_meetings`), sketch `app-agenda.js`; `calendar-and-agenda.md` 71-106, 225-512 | sketch |
| `components/living-doc/meeting-page.tsx` | page component | request-response | `frontend/src/app/meeting-details/page-content.tsx` (gate 261-290) | exact |
| `components/living-doc/{meeting-body,knowledge-section,review-head,candidate-row,rejected-group,history-popover,transcript-drawer,source-chip,evidence-popover}.tsx` | component | request-response / event-driven | sketch `doc-review.js`, `doc-popovers.js`, `doc-render.js`, `doc-page.js`; `living-doc-and-side-peek.md` 207-590 | sketch |
| `components/living-doc/delete-meeting-alert.tsx` | component | request-response | `components/Sidebar/index.tsx` ~334 (`api_delete_meeting`) + `primitives-and-overlays.md` 655-713 (Alert, focus Cancel) | role-match |
| `components/side-peek/side-peek.tsx` | component | — | sketch `app-peek.js`; `living-doc-and-side-peek.md` | sketch |
| `frontend/tests/**` (bun) for knowledge-service, gate, grep gate | test | — | `frontend/tests/hooks/summary-generation.test.tsx` 1-25 | exact |
| `frontend/tests/visual/*` (Playwright + IPC stub) | test | — | none | no analog |

## Pattern Assignments

### `migrations/20260927000100_phase2_knowledge.sql` (migration)

**Analog:** `frontend/src-tauri/migrations/20260920000200_phase1_transcript_evidence.sql` lines 1-25

```sql
CREATE TABLE transcript_evidence (
    evidence_id TEXT PRIMARY KEY NOT NULL,
    meeting_id TEXT NOT NULL,
    ...
    capture_completeness TEXT NOT NULL CHECK (
        capture_completeness IN ('complete', 'incomplete')
    ),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    UNIQUE (meeting_id, source_track, source_segment_key)
);
CREATE INDEX idx_transcript_evidence_meeting_sequence
    ON transcript_evidence (meeting_id, sequence);
```
Copy: TEXT PK UUIDs, `CHECK (... IN (...))` enums, `*_utc` TEXT timestamps (evaluation_runs style), `(meeting_id, …)` indexes. **Deviate:** no `ON DELETE CASCADE` (D-17; default NO ACTION), every table carries `meeting_id`, `BEFORE UPDATE` immutability triggers, no `BEFORE DELETE` triggers. Schema sketch: RESEARCH lines 276-311.

### `src/knowledge/models.rs` (model)

**Analog:** `frontend/src-tauri/src/database/models.rs` lines 1-70

```rust
use chrono::{DateTime, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(rename_all = "snake_case")]
pub enum MeetingCompleteness { Pending, Complete, Incomplete, RecoveredWithGaps, CompletionNotVerified }

impl MeetingCompleteness {
    pub const fn as_str(self) -> &'static str { match self { Self::Pending => "pending", ... } }
}
```
Apply to `KnowledgeType`, `ReviewAction`, `ReviewState`, `EvidenceStatus`, `RunStatus`, `TriggerKind`, `Support`. DTOs sent to React use `#[serde(rename_all = "camelCase")]` like `EffectiveRoute` (`trust/provider_route.rs` 41-53).

### `src/knowledge/repository.rs` (repository, transactional CRUD)

**Analog:** `frontend/src-tauri/src/database/repositories/transcript.rs`

Imports (1-7):
```rust
use chrono::Utc;
use sqlx::{Connection, Error as SqlxError, SqlitePool};
use tracing::{error, info, warn};
use uuid::Uuid;
pub struct TranscriptsRepository;
```
Transaction + rollback-on-error (24-86):
```rust
let mut transaction = pool.begin().await?;
let result = sqlx::query("INSERT INTO ... VALUES (?, ...)").bind(...).execute(&mut *transaction).await;
if let Err(error) = result {
    let _ = transaction.rollback().await;
    return Err(error);
}
let persisted = sqlx::query_as::<_, TranscriptEvidence>("SELECT * FROM transcript_evidence WHERE evidence_id = ?")
    .bind(&evidence.evidence_id).fetch_one(&mut *transaction).await;
...
transaction.commit().await?;
```
Validation at boundary (120-162): `Uuid::parse_str(&x).is_err()` → `SqlxError::Protocol("meeting_id must be a valid UUID".to_string())`; trimmed-empty checks. Use for accept/correct/reject/restore inputs, correction length caps. `correct` = revision insert + review event in one transaction.

### `database/repositories/transcript.rs` + `list_evidence_by_meeting`

Same file, add method on `TranscriptsRepository` using `sqlx::query_as::<_, TranscriptEvidence>("SELECT * FROM transcript_evidence WHERE meeting_id = ? ORDER BY sequence")` (index `idx_transcript_evidence_meeting_sequence` exists). Test in existing `transcript_evidence_repository_tests` module (302+) with `migrated_pool()`.

### `database/repositories/meeting.rs` (delete + impact)

**Analog:** self, lines 1190-1231
```rust
async fn delete_meeting_with_transaction(
    transaction: &mut SqliteConnection,
    meeting_id: &str,
) -> Result<bool, SqlxError> {
    let meeting_exists: Option<(i64,)> = sqlx::query_as("SELECT 1 FROM meetings WHERE id = ?")
        .bind(meeting_id).fetch_optional(&mut *transaction).await?;
    if meeting_exists.is_none() { error!(...); return Ok(false); }
    sqlx::query("DELETE FROM transcript_chunks WHERE meeting_id = ?").bind(meeting_id).execute(&mut *transaction).await?;
    ...
    let result = sqlx::query("DELETE FROM meetings WHERE id = ?").bind(meeting_id).execute(&mut *transaction).await?;
    Ok(result.rows_affected() > 0)
}
```
Insert child-first knowledge deletes before `transcript_evidence`/`meetings` (order: RESEARCH line 366). Prefer a `const` slice of table names looped over, rather than seven copy-pasted blocks. Public entry is `MeetingsRepository::delete_meeting` (line 358), called by `api_delete_meeting` in `src/api/api.rs:759` — cancel the `knowledge:{meeting_id}` run there first. Impact counts: new `knowledge_deletion_impact` read in `knowledge/repository.rs`.

### `src/knowledge/extraction.rs` (service, background orchestration)

**Analog:** `frontend/src-tauri/src/summary/service.rs` 350-470 (`process_transcript_background`)

Provider/key/endpoint resolution + route check (356-463), to be extracted into `resolve_summary_dispatch` and shared:
```rust
let provider = match LLMProvider::from_str(&model_provider) { Ok(p) => p, Err(e) => { Self::fail_and_cleanup(...).await; return; } };
let api_key = if provider == LLMProvider::Ollama || provider == LLMProvider::BuiltInAI || provider == LLMProvider::CustomOpenAI {
    String::new()
} else { match SettingsRepository::get_api_key(&pool, &model_provider).await { ... } };
...
let summary_route = if provider == LLMProvider::BuiltInAI {
    resolve_provider_route(Capability::Summary, &model_provider, &model_name, RouteDestination::Device).await
} else {
    resolve_provider_route(Capability::Summary, &model_provider, &model_name, RouteDestination::Url(route_destination.as_deref())).await
};
if let Err(route_error) = require_available_route(&summary_route) { ...; return; }
```
Then `validate_route_contract(&expected, &fresh)` (`trust/provider_route.rs` 256-278; used in `trust/outbound.rs` 576-586) before any I/O, then `llm_client::generate_summary(...)` (`summary/llm_client.rs` 308-348). Failure codes are typed strings (`"PROVIDER_ROUTE_UNAVAILABLE"`, new `"KNOWLEDGE_NO_EVIDENCE"`). Cancellation: mirror `SummaryService::register_cancellation_token` with a separate `knowledge:{meeting_id}` key. Emit event like `recording_commands.rs:541`: `app.emit("knowledge-updated", &payload)`.

### `src/knowledge/commands.rs` (tauri commands)

**Analog:** `frontend/src-tauri/src/summary/commands.rs`

Start-and-spawn (461-550):
```rust
#[tauri::command]
pub async fn api_process_transcript<R: Runtime>(
    app: AppHandle<R>,
    state: tauri::State<'_, AppState>,
    ...
) -> Result<ProcessTranscriptResponse, String> {
    let pool = state.db_manager.pool().clone();
    let _start_guard = SUMMARY_START_LOCK.lock().await;
    ...
    let cancellation_token = SummaryService::register_cancellation_token(&m_id, started_at);
    tauri::async_runtime::spawn(async move { SummaryService::process_transcript_background(app, pool, ...).await; });
    Ok(ProcessTranscriptResponse { ... })
}
```
Read command (355-458): `let pool = state.db_manager.pool();` → repository call → `Err(format!("Failed to retrieve summary: {}", e))`. Commands to add: list, accept, correct, reject, restore, regenerate/start, deletion impact. Typed `expected_route: EffectiveRoute` param (camelCase serde).

### `src/lib.rs` (registration)

Add `pub mod knowledge;` alongside lines 38-58; add commands in `tauri::generate_handler![ ... ]` (starts line 616) next to `summary::commands::api_process_transcript` (761).

### `src/bin/telu-knowledge-eval.rs` (CLI, batch)

**Analog:** `frontend/src-tauri/src/bin/telu-baseline.rs` 1-60
```rust
use app_lib::observability::run_bundle::validate_run_bundle_dir;
use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
const MAX_INPUT_BYTES: u64 = 32 * 1024 * 1024;

#[derive(Debug, Parser)]
#[command(name = "telu-baseline")]
struct Cli { #[command(subcommand)] command: Command }

#[derive(Debug, Subcommand)]
enum Command { Validate { manifest: PathBuf, ... } }
```
Subcommands `Run`, `Score` (RESEARCH 417-440). Thresholds file sha256 recorded in report.

### `tests/knowledge_eval_cli.rs` / `tests/knowledge_deletion.rs` (tests)

CLI test analog `frontend/src-tauri/tests/baseline_matrix.rs` 33-56:
```rust
fn runner() -> PathBuf { PathBuf::from(env!("CARGO_BIN_EXE_telu-baseline")) }
fn run(args: &[&str]) -> Output { ... }
fn parse_stdout(output: &Output) -> Value { ... }
```
DB test analog `database/repositories/transcript.rs` 311-338:
```rust
let pool = SqlitePoolOptions::new().max_connections(1).connect("sqlite::memory:").await.expect("in-memory SQLite pool");
sqlx::migrate!("./migrations").run(&pool).await.expect("fresh migration set");
sqlx::query("INSERT INTO meetings (id, title, created_at, updated_at, lifecycle, completeness, completeness_reason, started_at_utc) VALUES (?, 'Evidence test', ?, ?, 'recording', 'pending', NULL, ?)")
```
Residue query: RESEARCH lines 369-372 (`sqlite_master JOIN pragma_table_info`). Integration tests access internals via `app_lib::` (as in telu-baseline). Unit tests for normalize/span_verifier/matcher: inline `#[cfg(test)] mod` with plain `#[test]`.

### `frontend/src/lib/knowledge-service.ts` (typed invoke wrappers)

**Analog:** `frontend/src/services/providerRouteService.ts`
```ts
import { invoke } from '@tauri-apps/api/core';
export type LocationClass = 'local' | 'lan' | 'remote';
export interface EffectiveRoute { capability: ProviderCapability; providerId: string; ... }
export async function validateProviderRoute(expectedRoute: EffectiveRoute) {
  return invoke<EffectiveRoute>('validate_provider_route', { expectedRoute });
}
```
Import `EffectiveRoute` from `@/services/providerRouteService`; string-literal unions mirror Rust snake_case enums; args camelCase.

### `components/living-doc/meeting-page.tsx` (page; auto-run gate)

**Analog:** `frontend/src/app/meeting-details/page-content.tsx` 261-290
```tsx
useEffect(() => {
  if (!shouldAutoGenerate || summaryGeneration.summaryStatus !== 'idle' || isModelConfigLoading
      || meetingData.transcripts.length === 0
      || autoGenerationStartedMeetingIdRef.current === meeting.id) { return; }
  if (summaryRouteState.status !== 'validated') return;
  autoGenerationStartedMeetingIdRef.current = meeting.id;
  void executeSummaryAction('generate', '').then((started) => { if (!started) autoGenerationStartedMeetingIdRef.current = null; });
}, [...]);
```
Knowledge gate: separate ref, add `meeting.completeness === 'complete'`, `evidenceCount > 0`, no existing run. Route stays `/meeting-details?id=…` (static export; Phase 1 deep links). Drop the `console.log` emoji style.

### `components/app-shell/recording-host.tsx` (host, event-driven)

**Analog:** `frontend/src/app/page.tsx` 1-80 — move verbatim:
```tsx
const { isRecordingDisabled, setIsRecordingDisabled } = useRecordingStateSync(isRecording, setIsRecordingState, setIsMeetingActive);
const { handleRecordingStart } = useRecordingStart(isRecording, setIsRecordingState, showModal);
const { handleRecordingStop, setIsStopping } = useRecordingStop(setIsRecordingState, setIsRecordingDisabled);
const { recoverableMeetings, checkForRecoverableTranscripts, recoverMeeting, loadMeetingTranscripts, deleteRecoverableMeeting } = useTranscriptRecovery();
```
Plus `StatusOverlays` and `TranscriptRecovery` mounts; delete from `page.tsx` in the same change. Keep the tray path in `layout.tsx` 111-126 (`listen('request-recording-toggle')` → `window.dispatchEvent(new CustomEvent('start-recording-from-sidebar'))`). ⌘R per `app-shell-and-navigation.md` 457-475.

### `components/app-shell/sidebar.tsx`, `agenda/*` (list components)

Data analog: `frontend/src/components/Sidebar/SidebarProvider.tsx` 106 (`invoke('api_get_meetings')`), 210 (`api_search_transcripts`). Visual/behavior: sketch `sources/002-final-app/app-shell.js`, `app-agenda.js`, `app-record.js`; `calendar-and-agenda.md` §EventCard states (71-106), CSS 225-395, HTML 396-512; `app-shell-and-navigation.md` CSS 167-275, HTML 276-377. Replace, do not extend, `Sidebar/index.tsx`.

### `components/living-doc/*`, `side-peek/side-peek.tsx` (no code analog)

Sketch sources: `sources/002-final-app/doc-review.js` (ReviewHead/CandidateRow), `doc-popovers.js` (history/evidence popovers), `doc-render.js`, `doc-page.js`, `app-peek.js`; catalog `sources/003-component-catalog/`. Specs: `living-doc-and-side-peek.md` Components 51-92, Motion 93-206, CSS 207-369, HTML 370-460, Behavior 461-590. Copy overrides from CONTEXT: "Accepted · eligible" (not "In Memory"); delete copy counts first, no "items in Memory stay". Plain React text nodes only (never `dangerouslySetInnerHTML`, cf. `app/notes/[id]/page.tsx:174`).

### `components/living-doc/delete-meeting-alert.tsx`

Invoke analog: `components/Sidebar/index.tsx` ~334 `await invoke('api_delete_meeting', {...})`. Alert spec: `primitives-and-overlays.md` 655-713 (Radix `AlertDialog` from `radix-ui`, `onOpenAutoFocus` → Cancel). Precede with `knowledge_deletion_impact` call.

### `components/telu-ui/*` and restyled `components/ui/*`

Import/structure analog `frontend/src/components/ui/accordion.tsx` 1-20:
```tsx
"use client"
import * as React from "react"
import { Accordion as AccordionPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"
function Accordion({ ...props }: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}
```
cva analog `components/ui/button.tsx` 1-61 (`cva` + `VariantProps` + `forwardRef` + `Slot`); replace variants with the five Telu variants verbatim from `primitives-and-overlays.md` 360-393. Remove `green/blue/red/gray` palette variants (grep gate).

### `globals.css`, `tailwind.config.js`, `layout.tsx`, `lib/motion.ts` (tokens)

- `globals.css`: replace both `@layer base` blocks (lines 79, 136; `--accent: 239 74.3% 96%` HSL) with `foundations-and-motion.md` 296-455 block.
- `tailwind.config.js`: current `hsl(var(--x))` mapping (lines ~16-30) and `fontFamily.sans: ['var(--font-source-sans-3)']` → `foundations-and-motion.md` 507-596; keep radius mapping.
- `layout.tsx`: delete `Source_Sans_3` import (line 4) and init (30); add `<MotionConfig reducedMotion="user">`.
- `lib/motion.ts`: paste `foundations-and-motion.md` 173-284 (`EASE`, `SPRING`, `SPRING_BOUNCE`, `INSTANT`, `DURATION`, `PRESET`).

### `frontend/tests/**` (bun)

**Analog:** `frontend/tests/hooks/summary-generation.test.tsx` 1-25
```ts
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
const originalToast = { ...await import('sonner') };
afterAll(() => { mock.module('sonner', () => originalToast); });
mock.module('next/navigation', () => ({ usePathname: () => '/meeting-details', useRouter: () => ({}) }));
```
Restore mocked modules in `afterAll` (Bun shares module mocks). Grep-gate test: plain `bun:test` scanning `src/` with the regex in RESEARCH line 380.

## Shared Patterns

### Provider route boundary (all extraction paths)
**Source:** `frontend/src-tauri/src/trust/provider_route.rs` 256-291 (`validate_route_contract`, `require_available_route`, `authorize_provider_dispatch`); frontend `services/providerRouteService.ts`.
Apply to: `extraction.rs`, `commands.rs`, `meeting-page.tsx`, `knowledge-section.tsx` (label shown before call; no fallback).

### Error handling
Rust repositories return `Result<_, SqlxError>` with `SqlxError::Protocol(msg)` for validation (`transcript.rs` 120-162); commands map to `Err(String)` with `format!` (`summary/commands.rs` 455-457); typed codes as SCREAMING_SNAKE strings. Frontend: try/catch + `sonner` toast with user-facing copy.

### Transactions
`pool.begin()` → explicit `rollback()` on error → `commit()` (`transcript.rs` 24-86). Deletion uses `&mut SqliteConnection` helper (`meeting.rs` 1190).

### Tauri events
`app.emit("name", &payload)` (`audio/recording_commands.rs` 541); frontend `listen<T>(...)` with unlisten in effect cleanup (`layout.tsx` 111-126).

### Logging
Rust `tracing`/`log` macros with module context; no emojis in new code.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `knowledge/normalize.rs` | utility | transform | No Unicode normalization code exists; follow RESEARCH Pattern 2 |
| `knowledge/span_verifier.rs` | utility | transform | New concept; RESEARCH Pattern 2 |
| `knowledge/matcher.rs` | utility | transform | New concept; RESEARCH Pattern 4 |
| `knowledge/parse.rs` | utility | transform | Summary path parses markdown, not typed JSON; RESEARCH "Prompt contract" (~535) |
| `frontend/tests/visual/*` | test | — | No Playwright in repo; RESEARCH Wave 0 spike |
| `living-doc/*`, `side-peek/side-peek.tsx`, `agenda/*` (visual) | component | — | Code analog only for data; visual analog is the tracked sketch sources listed above |

## Metadata

**Analog search scope:** `frontend/src-tauri/{src,migrations,tests}`, `frontend/src/{app,components,services,hooks,lib}`, `frontend/tests`, `.claude/skills/sketch-findings-telu-fyi/`
**Files scanned:** ~40
**Pattern extraction date:** 2026-09-27
