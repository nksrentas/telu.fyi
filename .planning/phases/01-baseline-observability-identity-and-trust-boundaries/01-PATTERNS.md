# Phase 1: Baseline Observability, Identity, and Trust Boundaries - Pattern Map

**Mapped:** 2026-09-20
**Files analyzed:** 28 likely new/modified files or file groups
**Analogs found:** 26 / 28

## Scope and Source Boundary

Use only the active Community Edition paths under `frontend/src-tauri` and `frontend/src`. The archived `backend/` Python/FastAPI implementation and the Meetily Pro Agent API are not analogs for this phase. Every analog named below is git-tracked (`git ls-files` verified). New module names remain discretionary; the assignments below express ownership and the nearest existing pattern.

## File Classification

| New/Modified File | Role | Data Flow | Closest Tracked Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src-tauri/migrations/<timestamp>_phase1_identity_observability.sql` | migration | CRUD | `frontend/src-tauri/migrations/20250916100000_initial_schema.sql` | exact |
| `frontend/src-tauri/src/database/models.rs` | model | transform/CRUD | same file, `MeetingModel`, `Transcript`, `Setting` | exact |
| `frontend/src-tauri/src/database/repositories/meeting.rs` | repository | CRUD | same file, transactional delete/update | exact |
| `frontend/src-tauri/src/database/repositories/transcript.rs` | repository | CRUD | same file, transactional transcript save | exact seam; semantics must change |
| `frontend/src-tauri/src/database/repositories/evaluation.rs` (new) | repository | CRUD/batch | `database/repositories/meeting.rs` | role-match |
| `frontend/src-tauri/src/meeting/{mod,session,lifecycle,recovery}.rs` (new) | service/model | event-driven/CRUD | `audio/recording_manager.rs`, `database/repositories/meeting.rs` | partial |
| `frontend/src-tauri/src/observability/{mod,stage_clock,queue_ledger}.rs` (new) | service/model | event-driven | `audio/batch_processor.rs`, `audio/transcription/worker.rs` | partial |
| `frontend/src-tauri/src/observability/{resource_sampler,run_bundle}.rs` (new) | service | batch/file-I/O | `whisper_engine/system_monitor.rs`, `audio/recording_saver.rs` | role-match |
| `frontend/src-tauri/src/trust/{mod,provider_route,outbound}.rs` (new) | service/model | request-response/event-driven | `summary/llm_client.rs` | role/data-flow match |
| `frontend/src-tauri/src/audio/recording_commands.rs` | controller/route | request-response | same file's Tauri commands | exact |
| `frontend/src-tauri/src/audio/recording_manager.rs` | service | streaming/event-driven | same file | exact |
| `frontend/src-tauri/src/audio/recording_state.rs` | store/model | event-driven | same file's `Arc<RwLock<_>>` state | exact |
| `frontend/src-tauri/src/audio/recording_saver.rs` | service | file-I/O | same file's temp-file/rename metadata writes | exact |
| `frontend/src-tauri/src/audio/pipeline.rs` | service | streaming | same file's nonblocking audio distribution | exact |
| `frontend/src-tauri/src/audio/transcription/worker.rs` | service | streaming/event-driven | same file's dispatcher/worker/event flow | exact seam; queue contract must change |
| `frontend/src-tauri/src/audio/transcription/engine.rs` | service | request-response | same file's configuration validation | exact |
| `frontend/src-tauri/src/api/{api,commands}.rs`, `src/lib.rs` | controller/DTO/config | request-response | existing API DTOs/commands and `generate_handler!` registration | exact |
| `frontend/src-tauri/tauri.conf.json` / capabilities | config | request-response/file-I/O | existing capability and CSP declarations | exact |
| `frontend/src/services/{recording,transcript,diagnostics}Service.ts` | service | request-response/event-driven | `transcriptService.ts`, `recordingService.ts` | exact |
| `frontend/src/services/indexedDBService.ts` | service/store | CRUD | same file's versioned stores and `put` updates | exact |
| `frontend/src/contexts/TranscriptContext.tsx` | provider/store | event-driven | same file's Tauri listener setup/cleanup | exact |
| `frontend/src/hooks/useRecordingStop.ts` | hook | request-response/event-driven | same file's stop orchestration | exact seam; inference must be replaced |
| `frontend/src/components/ProviderBoundary.tsx` (new) | component | transform | provider controls in `TranscriptSettings.tsx` and `SummaryModelSettings.tsx` | role-match |
| `frontend/src/app/_components/StatusOverlays.tsx` | component | event-driven | same fixed-bottom status card | exact |
| `frontend/src/components/TranscriptRecovery/TranscriptRecovery.tsx` | component | CRUD/request-response | same two-pane recovery dialog | exact |
| `frontend/src/components/Sidebar/*`, `app/meeting-details/page-content.tsx` | component | request-response | existing meeting rows/detail header | exact |
| `frontend/src/app/_components/SettingsModal.tsx` and diagnostics components | component | request-response/file-I/O | existing settings tabs/modal patterns | exact |
| `frontend/src-tauri/tests/*` and inline `#[cfg(test)]` modules | test | batch/CRUD | inline tests in `audio/transcription/worker.rs` | role-match |

## Pattern Assignments

### Domain schema, models, and repositories

**Apply to:** migration, `database/models.rs`, meeting/transcript/evaluation repositories, meeting lifecycle/recovery modules.

**Migration runner:** `frontend/src-tauri/src/database/manager.rs:33-37`

```rust
let pool = SqlitePool::connect(tauri_db_path).await?;
sqlx::migrate!("./migrations").run(&pool).await?;
Ok(DatabaseManager { pool })
```

Add a forward-only migration. Define lifecycle, gap/evidence identity, unique idempotency constraints, queue/run records, and conservative legacy state in SQL first; mirror them in typed Rust models. Do not edit historical migrations.

**Typed row convention:** `frontend/src-tauri/src/database/models.rs:5-16,24-38`

```rust
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct MeetingModel { /* database columns */ }

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(transparent)]
pub struct DateTimeUtc(pub DateTime<Utc>);
```

Use explicit enums for lifecycle/location/outcomes where SQLx compatibility permits; use `Serialize`/`Deserialize` DTOs at IPC boundaries. Extend `MeetingModel` and `Transcript`, rather than maintaining shadow frontend-only truth.

**Transaction and validation pattern:** `database/repositories/meeting.rs:18-47`

```rust
if meeting_id.trim().is_empty() {
    return Err(SqlxError::Protocol("meeting_id cannot be empty".to_string()));
}
let mut conn = pool.acquire().await?;
let mut transaction = conn.begin().await?;
match operation(&mut transaction, meeting_id).await {
    Ok(value) => { transaction.commit().await?; Ok(value) }
    Err(error) => { let _ = transaction.rollback().await; Err(error) }
}
```

Copy this shape for start-session, terminal lifecycle transition, reconciliation, and export/run indexing. Keep state transition validation in Rust and persistence atomic in SQLite.

**Existing seam to replace:** `database/repositories/transcript.rs:13-82` currently creates a new meeting and random transcript IDs at stop. Preserve its transaction/error style, but split it into (1) Rust-owned meeting creation before capture and (2) final-evidence UPSERT accepting caller-provided stable `meeting_id` and `evidence_id` (`ON CONFLICT ... DO UPDATE` or no-op). Never derive identity from transcript text, wall time, or React.

### Meeting aggregate and recording lifecycle

**Apply to:** new `meeting/*`, `recording_commands.rs`, `recording_manager.rs`, `recording_state.rs`, `recording_saver.rs`.

The nearest aggregate is the recording manager/state pair: shared native state is Rust-owned and passed across async work. Follow the established `Arc<RwLock<T>>`/atomic pattern, but make a typed `MeetingSession` hold the canonical meeting/run ID, lifecycle, route snapshot, queue/gap ledgers, monotonic origin, and UTC correlation start.

Start ordering must be: create UUID in Rust → persist `preparing` row → initialize recording directory/metadata with the same ID → publish command/event result → accept audio. Stop ordering must be: close producers → persist `finalizing` → drain authoritative ledger to deadline → atomically persist `complete` or `incomplete` with reasons. Repeated start/stop/recovery calls for the same ID must return durable state rather than create a new record.

For recording metadata/run bundles, copy the existing `recording_saver.rs` atomic temp-write-and-rename pattern (research-verified at lines 267-276). The saver mirrors the lifecycle result; it must not independently declare `completed`.

### Queue ledger, bounded transcription, and stage events

**Apply to:** new observability modules, `pipeline.rs`, `transcription/worker.rs`, status command/event DTOs.

**Existing dispatcher/event seam:** `audio/transcription/worker.rs:315-351,192-226`

```rust
while let Some(chunk) = receiver.recv().await {
    // admission/dispatch seam
    work_sender.send(chunk)?;
}
drop(work_sender);
for handle in worker_handles { handle.await?; }

let update = TranscriptUpdate { sequence_id, audio_start_time, audio_end_time, .. };
app.emit("transcript-update", &update)?;
```

Keep ordered native emission and recording-relative timing, but replace unbounded channels and task-local counters with bounded Tokio `mpsc` plus one shared per-meeting ledger. Record accepted/start/terminal timestamps and reason per work ID. Conservation contract:

```text
accepted = queued + active + completed + failed + cancelled + superseded
depth = queued + active
oldest_age = now_monotonic - oldest nonterminal accepted_at
```

Rejected work is not accepted; count it separately and create a durable gap/completeness fact. Persist final evidence before emitting its canonical event. Partials may remain provisional UI events.

Do not copy these current semantics: `transcription-queue-complete` is emitted before worker joins (`worker.rs:338-351`), fixed retry sleeps infer completion (`worker.rs:353-390`), and transcript content is logged (`worker.rs:167-173`). Diagnostics must be content-redacted by default.

**Stage clock:** create one Rust `Instant` origin per run and serialize integer offsets plus UTC correlation timestamps. Capture hot paths may only perform compact nonblocking admission; no file I/O, formatting, await, or blocking lock in the capture callback. UI acknowledgement uses an opaque token retained with a Rust `Instant`; React acknowledges after committing the displayed update.

### Resource sampling and local run bundles

**Apply to:** `observability/resource_sampler.rs`, `run_bundle.rs`, evaluation repository, diagnostics/export command.

Use `frontend/src-tauri/src/whisper_engine/system_monitor.rs` as the `sysinfo` process/system sampling analog and `audio/diagnostics.rs` as the audio-device/environment inventory analog. Convert their log-oriented output into typed, redacted records. Use the app-data path resolution pattern from `database/manager.rs:44-67`:

```rust
let app_data_dir = app_handle.path().app_data_dir()
    .expect("failed to get app data dir");
fs::create_dir_all(&app_data_dir)?;
let path = app_data_dir.join("...");
```

Bundles are versioned and self-contained: manifest, environment, stage events, queue/resource samples, effective routes/outbound attempts, errors, summary, and threshold declaration/result. Default exports exclude transcript/audio content and never upload. Unknown fields remain explicit `unknown` and fail a claimed gate.

### Provider boundary resolution

**Apply to:** new `trust/*`, transcription validation, summary request path, frontend route DTO/component.

**Provider/effective endpoint seam:** `summary/llm_client.rs:213-238,281-351`

```rust
pub enum LLMProvider { OpenAI, Claude, Groq, Ollama, OpenRouter, BuiltInAI, CustomOpenAI }

if provider == &LLMProvider::BuiltInAI { /* local sidecar */ }
let api_url = match provider {
    LLMProvider::OpenAI => "https://api.openai.com/...",
    LLMProvider::Ollama => configured_or("http://localhost:11434"),
    LLMProvider::CustomOpenAI => configured_endpoint?,
    /* ... */
};
```

Resolve from the effective sanitized URL/sidecar, not provider brand: sidecar/loopback = Local; private or explicit LAN = LAN; hosted/non-local = Remote. Return capability, provider, sanitized origin, class, encryption state, and validation result from Rust. Strip credentials, query, and sensitive paths. A materially different runtime resolution blocks work. Preserve the selected provider and return explicit retry/reconfigure/cancel state; remove configuration-error fallback behavior.

Record all permitted outbound attempts, including updater/analytics/model downloads during canary runs. Narrow `tauri.conf.json` filesystem scopes only with packaged recording/import/export regression coverage.

### Frontend identity, recovery cache, and authoritative stop

**Apply to:** services, `TranscriptContext.tsx`, `indexedDBService.ts`, `useRecordingStop.ts`, `useTranscriptRecovery.ts`.

**Listener pattern:** `TranscriptContext.tsx:84-143` initializes IndexedDB, installs Tauri listeners inside `useEffect`, and cleans them up. Keep that lifecycle, but delete the frontend minting at lines 97-103. The start command/event payload supplies the Rust ID, and the frontend only transports it.

**IndexedDB schema/update pattern:** `indexedDBService.ts:32-92,100-116`

```typescript
const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
request.onupgradeneeded = event => { /* create stores/indexes */ };

const transaction = this.db!.transaction(['meetings'], 'readwrite');
transaction.objectStore('meetings').put(metadata);
```

Bump the schema version; key meetings by canonical Rust ID and evidence by stable evidence ID (not auto-increment identity). IndexedDB stays a recovery cache, never the authority. Preserve existing records during upgrade and reconcile them into SQLite idempotently.

**Stop seam to replace:** `useRecordingStop.ts:152-260` polls, treats quiet as complete, waits fixed delays, then performs the only SQLite save. Replace the loop with Rust lifecycle/queue snapshots and a deadline result. The UI may subscribe to progress events and request current state, but it must not infer completion. Remove transcript samples from logs.

### Trust and lifecycle UI

**Apply to:** provider settings, new `ProviderBoundary`, `RecordingControls`, `StatusOverlays`, sidebar/detail, recovery dialog, diagnostics tab.

**Fixed-bottom status analog:** `app/_components/StatusOverlays.tsx:17-36`

```tsx
if (!show) return null;
return <div className="fixed bottom-4 left-0 right-0 z-10">
  <div style={{ marginLeft: sidebarCollapsed ? '4rem' : '16rem' }}>
    <div className="w-2/3 max-w-[750px] ...">...</div>
  </div>
</div>;
```

Retain placement and sizing; replace generic booleans/messages with the Rust lifecycle snapshot. Render `Finalizing recording`, real depth, oldest age, and the zero-queue/saving state. Use `aria-live="polite"`, throttle spoken queue changes to five seconds, and never show a percentage without a finite total.

Use existing shadcn/Radix wrappers (`Alert`, `Button`, `Dialog`, `Tabs`, `Select`, `ScrollArea`, `Tooltip`, `Progress`, `Popover`, `Command`, `Input`, `Label`, `Separator`, `VisuallyHidden`) and Lucide; add no UI package. Follow the existing two-pane `components/TranscriptRecovery/TranscriptRecovery.tsx` dialog rather than creating a new recovery surface. Its actions must invoke Rust reconciliation and show the authoritative stable meeting result.

ProviderBoundary is a shared presentational component consuming the Rust-resolved DTO. Insert it in existing transcription/summary settings, directly at the recording action boundary, and beside summary generation. Do not infer route class in TypeScript.

Extend existing sidebar meeting rows and meeting-detail header with `Complete`, `Incomplete`, `Recovered with gaps`, or `Completion not verified`; gap details are ordered by recording-relative time. Add `Diagnostics` as the final existing Settings tab, one-column, with recent runs, details, review-before-export, and local-only export result.

### IPC and command registration

Use the established Community Edition contract: Tauri commands for authoritative operations/results and events for progress. Define serializable DTOs near the Rust API boundary, delegate to services/repositories, map internal errors to redacted user-facing errors, and register new commands in `frontend/src-tauri/src/lib.rs` with the existing `tauri::generate_handler!` list. Frontend services wrap `invoke`/`listen`; components should not duplicate command names or deserialize ad hoc payloads.

## Shared Patterns

### Authority and identity

- Rust creates UUIDs once; React, IndexedDB, folder metadata, SQLite, evidence, diagnostics, and future consumers reuse them.
- SQLite is canonical; IndexedDB and JSON metadata are recoverable mirrors/caches.
- Persist before canonical publish. A renderer crash after commit can replay; a retry reaches the same unique key.

### Error handling

- Validate empty/invalid identifiers before database work (`meeting.rs:18-23`).
- Use SQLx transactions with explicit rollback around multi-row lifecycle/evidence/recovery changes (`meeting.rs:25-46`).
- Surface unavailable providers inline while preserving provider choice and local data. Never silently switch routes.
- Redact transcript text, audio, keys, credentials, query strings, and full sensitive paths from default diagnostics.

### Async and cancellation

- Use bounded Tokio `mpsc`, `try_send` at nonblocking capture seams, `CancellationToken`, `tokio::select!`, and `tokio::time::timeout`.
- Close producers before drain; every accepted item receives exactly one terminal outcome.
- `Instant` measures duration; UTC exists only for correlation.

### Testing

- Put small pure tests beside lifecycle, queue, route, redaction, and schema code using the repository's inline `#[cfg(test)]` convention (`audio/transcription/worker.rs:593-605`).
- Add integration tests/fixtures under `frontend/src-tauri/tests` for fresh migration, legacy upgrade, idempotent upsert, repeated recovery, transaction rollback, bundle validation, and queue overload/drain.
- Run Rust focused/full tests plus `cargo fmt --check`, `cargo check`, `pnpm --dir frontend lint`, and `pnpm --dir frontend build`. Do not invent a generic `pnpm test` script unless frontend tests are deliberately added.

## No Analog Found

| File/Capability | Role | Data Flow | Reason / Planner Guidance |
|---|---|---|---|
| Versioned baseline scenario matrix runner and threshold declaration | test/harness | batch/file-I/O | No current end-to-end scenario harness. Use the run-bundle schema and RESEARCH.md matrix; keep hardware/network-block method explicit. |
| OS-level network-blocked canary controller | test/harness | event-driven | No cross-platform project analog. Plan per-platform external blocking/capture instructions plus in-app outbound-attempt attribution; do not claim a universal implementation. |

## Planner Guardrails

- Preserve the five dependency boundaries: schema/domain → canonical identity/evidence → bounded finalization/recovery → trust UI/capabilities → scenario evidence/thresholds.
- Do not change VAD/ASR quality algorithms while changing queue/finalization semantics.
- Do not call a meeting complete from empty queues, quiet time, event emission, or filesystem metadata alone.
- Do not add knowledge extraction, document ingestion, live suggestions, embeddings, or series memory in Phase 1.
- Do not use Python/FastAPI or a new local HTTP service for internal IPC.

## Metadata

**Analog search scope:** `frontend/src-tauri/src`, `frontend/src-tauri/migrations`, `frontend/src`, active Community Edition configuration/tests
**Files scanned:** 60+ candidate source files; 18 primary analog files read or research-verified
**Tracked-source gate:** all named analogs verified in `git ls-files`
**Pattern extraction date:** 2026-09-20
