# Phase 1: Baseline Observability, Identity, and Trust Boundaries - Research

**Researched:** 2026-09-20
**Domain:** Local-first Tauri/Rust meeting lifecycle, observability, recovery, and provider trust boundaries
**Confidence:** HIGH for repository findings; MEDIUM for the proposed implementation decomposition; LOW only where the product has not yet declared a reference machine or numeric thresholds

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Baseline Measurement Contract
- **D-01:** A baseline run produces a versioned, self-contained local run bundle: scenario manifest, environment fingerprint, monotonic stage events, queue samples, resource samples, provider choices, errors, and a concise human-readable result summary.
- **D-02:** Stage events cover the complete path that exists in the baseline—audio captured, speech/segment boundary, transcription enqueued, transcription started, final transcript produced, persisted, and acknowledged by the UI. The schema reserves context-selection, generation, cancellation, supersession, and visible-suggestion stages for later live-loop experiments without pretending those stages exist in Phase 1.
- **D-03:** Queue evidence must report actual accepted, started, completed, failed, cancelled, and superseded counts plus current depth and oldest-item age. A hard-coded empty queue or inferred “quiet means complete” state cannot satisfy the phase gate.
- **D-04:** Measurements use monotonic clocks for durations and retain wall-clock timestamps only for correlation. Run metadata records application revision, OS, hardware, power state, audio devices, sample configuration, transcription engine/model, provider location, language, and scenario version.
- **D-05:** The first benchmark matrix contains the roadmap scenarios—short utterances, continuous speech, overlapping speech, sustained system audio, overload, stop, restart, crash, and repeated recovery—on a declared primary reference machine. Supported-platform smoke coverage may be smaller initially, but every omitted combination remains explicitly unverified rather than implicitly passing.
- **D-06:** Numeric go/no-go thresholds are derived from repeat baseline runs and declared before a dependent experiment starts. Reports preserve distributions and outliers, not only averages. Unknown, missing, or non-reproducible measurements fail the relevant gate.
- **D-07:** Raw evaluation artifacts stay on device by default. Any export is a deliberate local action, is reviewable before sharing, and excludes transcript/audio content unless the user explicitly includes it.

### Meeting Identity and Durable Transcript Evidence
- **D-08:** Rust allocates one durable meeting identifier before preparation or recording begins. The same identifier is used by the recording directory, in-memory recording state, frontend state, IndexedDB recovery record, SQLite rows, transcript evidence, summaries, documents, and future series membership.
- **D-09:** The frontend may display and transport the identifier but does not mint a second canonical identity or remap a temporary identity after stop.
- **D-10:** Only finalized transcript segments become canonical evidence. Partial text may be shown during recording but remains clearly provisional and cannot be cited by downstream knowledge or memory features.
- **D-11:** Final segments are persisted incrementally and idempotently during the meeting. Every segment has a stable evidence identifier, source/track identity, recording-relative time bounds, finality, and capture-completeness metadata. Re-delivery updates or no-ops the same evidence record rather than inserting a duplicate.
- **D-12:** Meeting lifecycle state is explicit and durable: at minimum preparing, recording, finalizing, complete, incomplete, and recovered. “Complete” is allowed only after capture has stopped, accepted final-transcript work has reached a terminal state, and durable writes have succeeded.

### Stop, Backlog, and Recovery Semantics
- **D-13:** Stop first ends new capture promptly, closes producers, and then drains already accepted transcription work to a declared deadline. The UI shows real depth and oldest age while finalization is in progress.
- **D-14:** If finalization exceeds its deadline or work fails, Telu persists an incomplete meeting with the remaining-work and capture-gap facts needed for recovery. It never marks the meeting complete merely because polling was quiet or a fixed delay elapsed.
- **D-15:** Recovery is reconciliation, not copy creation. Repeating recovery for the same canonical meeting and evidence identifiers produces the same logical result, preserves already durable segments, and does not duplicate the meeting or its transcript.
- **D-16:** Missing audio, missing transcript intervals, device loss, forced cancellation, and uncertain tail completion remain visible in meeting completeness metadata and user-facing status. A recovered meeting can be usable without being mislabeled as complete.
- **D-17:** Overload tests must demonstrate how bounded work is handled. When a queue or deadline limit is reached, the system records which work was rejected, cancelled, or left incomplete; it does not allow unbounded growth or silent loss.

### Provider Boundaries and Trust UX
- **D-18:** Each transcription, summary, document-processing, and generation configuration is classified as Local, LAN, or Remote and names the concrete destination. The label appears at provider selection and again before data-bearing work begins; diagnostics retain the effective route per meeting/run.
- **D-19:** An unavailable selected route fails visibly while preserving the user's choice and local data. Recovery actions are explicit retry, reconfigure, or cancel; Telu never silently switches from local to LAN/remote or between remote providers.
- **D-20:** The user-facing treatment stays calm and compact: a short boundary label and destination at the point of choice, a clear error when the contract cannot be honored, and deeper technical evidence in a diagnostics view or local run bundle.
- **D-21:** A network-blocked canary is part of the baseline matrix. Local capture, transcription, persistence, recovery, and evaluation must complete without undisclosed egress; every permitted LAN or remote attempt must be attributable to the active configuration.

### the agent's Discretion
- Exact Rust type names, SQLite migration layout, telemetry serialization format, and module boundaries, provided the contracts above remain testable and the Rust core stays authoritative.
- Exact visual placement and copy of the compact provider labels, completeness state, and diagnostics affordance, provided users can see the boundary before data-bearing work and can inspect incomplete/recovered state afterward.
- The number of warm-up and repeat runs used by the initial harness, provided the run count is recorded and thresholds are not chosen from a single favorable run.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BASE-01 | A maintainer can run a reproducible target-hardware scenario matrix covering short utterances, continuous speech, overlapping speech, sustained system audio, stop, restart, and recovery. | Run-bundle contract, scenario harness, environment fingerprint, safe sequencing, and physical-device gate. |
| BASE-02 | A maintainer can measure monotonic timestamps from captured audio through segmentation, transcription, context selection, generation, and visible UI acknowledgement. | Stage vocabulary separates Phase 1 stages from reserved future stages; Rust-owned monotonic tracker and explicit UI acknowledgement pattern. |
| BASE-03 | A maintainer can observe real transcription and assistance queue depth, oldest-item age, throughput, cancellation, and dropped or superseded work rather than placeholder metrics. | Shared queue ledger and terminal-outcome accounting replace the placeholder status command and task-local counters. |
| BASE-04 | A maintainer can measure CPU, memory, battery impact, model/provider choice, and error rates per meeting scenario without sending evaluation data off-device by default. | Existing `sysinfo` integration, OS power sampling, local-only bundle, content-redaction contract, and explicit export. |
| BASE-05 | A user can stop, restart, and recover an interrupted meeting without duplicate meeting records, silent transcript loss, or ambiguous completion state. | Durable lifecycle, drain deadline, gap ledger, idempotent evidence upsert, and reconciliation command. |
| BASE-06 | A maintainer can declare explicit go/no-go thresholds for later live-assistance experiments using baseline evidence rather than assumed performance. | Repeated-run distributions, unknown-as-fail policy, pre-registration timing, and versioned threshold declaration. |
| IDENT-01 | A meeting receives one durable Rust-owned identifier before preparation or recording begins, and recording, recovery, documents, transcript, analysis, and series membership reuse it. | Start-session transaction, same ID through folder/SQLite/recording state/IPC/IndexedDB, and no frontend minting. |
| IDENT-02 | Final transcript segments are persisted incrementally and idempotently with stable evidence identifiers and capture-completeness metadata. | Final-only repository write before canonical event, unique evidence key, upsert, timing/source/finality/completeness fields. |
| IDENT-03 | Repeated recovery or retry operations reconcile to the same meeting and transcript evidence instead of creating duplicates. | IndexedDB schema upgrade, stable evidence keys, SQLite upsert, and repeat-recovery tests. |
| PRIV-01 | A user can see whether each configured transcription, summary, document-processing, or generation path is local or remote and what destination receives data. | Effective-route resolver, Local/LAN/Remote classification, selection/start disclosure, diagnostics. |
| PRIV-02 | Telu never silently falls back from a local path to a hosted provider; an unavailable selected path fails visibly and preserves user choice. | Remove current config-error fallback, route contract, explicit retry/reconfigure/cancel behavior. |
| PRIV-03 | Local capture, storage, and evaluation work without undisclosed network calls, while every enabled remote or LAN destination remains explicit and configurable. | Background-egress inventory, updater/analytics controls, network-blocked canary, and outbound-attribution ledger. |

Requirement text is quoted verbatim from `.planning/REQUIREMENTS.md`: the exact IDs and descriptions appear at lines 10-24. [VERIFIED: .planning/REQUIREMENTS.md:10-24]
</phase_requirements>

## Summary

Phase 1 is not one instrumentation task. It is a prerequisite chain: Rust must create and durably persist the meeting before recording; final segments must acquire stable evidence identity and be upserted during the meeting; queue/finalization state must become authoritative; recovery must reconcile those same records; and only then can the benchmark harness make reliable claims about timing, backlog, stop, recovery, and egress. The current flow violates every link in that chain in a concrete way: React mints an IndexedDB-only timestamp ID, SQLite mints another ID at stop, transcripts receive fresh random IDs on every save, queue status is hard-coded, and fixed delays precede the only SQLite save. [VERIFIED: frontend/src/contexts/TranscriptContext.tsx:84-120] [VERIFIED: frontend/src-tauri/src/database/repositories/transcript.rs:13-60] [VERIFIED: frontend/src-tauri/src/audio/recording_commands.rs:1049-1111] [VERIFIED: frontend/src/hooks/useRecordingStop.ts:152-260]

The current transcription path also has two unbounded Tokio queues and one worker. Its counters are task-local, model-unloaded work is counted as completed, queue-complete is emitted before workers finish, and a mismatch produces an event but no durable incomplete state. That implementation cannot support BASE-03 or D-17 without a shared queue ledger and bounded admission semantics. [VERIFIED: frontend/src-tauri/src/audio/transcription/worker.rs:50-80] [VERIFIED: frontend/src-tauri/src/audio/transcription/worker.rs:142-147] [VERIFIED: frontend/src-tauri/src/audio/transcription/worker.rs:315-390]

The trust boundary is broader than model calls. Summary providers include fixed hosted endpoints, local sidecar, localhost Ollama, and arbitrary configured endpoints; endpoint host resolution, not provider name, must determine Local/LAN/Remote for configurable HTTP routes. Startup also performs an updater check two seconds after mount, while opted-in analytics targets PostHog. A valid network-blocked canary therefore needs a recorded outbound-attempt inventory and an explicit test mode that suppresses unrelated updater/analytics/model-download traffic—not an assumption that “local model” means “no network.” [VERIFIED: frontend/src-tauri/src/summary/llm_client.rs:213-351] [VERIFIED: frontend/src/hooks/useUpdateCheck.ts:11-58] [VERIFIED: frontend/src-tauri/tauri.conf.json:113-119] [VERIFIED: frontend/src/components/AnalyticsProvider.tsx:33-71]

**Primary recommendation:** Plan Phase 1 as five ordered implementation waves—domain/schema foundation, identity plus incremental final evidence, authoritative bounded finalization and recovery, provider/trust UX, then the scenario harness and threshold gate—and do not parallelize work across a wave boundary where the later task depends on the earlier contract. [ASSUMED]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Canonical meeting identity and lifecycle | API / Rust core | Database / SQLite | Rust owns native recording orchestration; lifecycle must survive renderer reload and therefore be durable. [VERIFIED: docs/architecture.md] |
| Final transcript evidence identity and persistence | Database / SQLite | API / Rust core | SQLite uniqueness and transactions enforce idempotence; Rust decides when a segment is final. [VERIFIED: frontend/src-tauri/src/database/repositories/transcript.rs:13-82] |
| Queue admission, counters, drain, deadline | API / Rust core | Browser / React status view | The queue lives in Tokio; the frontend displays but cannot infer the authoritative state. [VERIFIED: frontend/src-tauri/src/audio/transcription/worker.rs:50-80] |
| Run bundle and resource sampling | API / Rust core | OS / local filesystem | Native stage clocks, process resources, device metadata, and app-data paths belong in Rust; export remains explicit. [VERIFIED: frontend/src-tauri/src/whisper_engine/system_monitor.rs:1-106] |
| Visible UI acknowledgement | Browser / React | API / Rust core | React knows when state has rendered; Rust must retain the originating monotonic timer and accept an acknowledgement token. [CITED: https://v2.tauri.app/concept/inter-process-communication/] |
| Recovery cache | Browser / IndexedDB | Database / SQLite | IndexedDB is crash staging only; SQLite and the Rust lifecycle remain canonical. [VERIFIED: frontend/src/services/indexedDBService.ts:7-35] |
| Provider boundary classification | API / Rust core | Browser / React configuration and disclosure | The effective runtime URL determines Local/LAN/Remote; React renders the resolved contract before work. [VERIFIED: frontend/src-tauri/src/summary/llm_client.rs:301-351] |
| Network-blocked canary | OS / test harness | API / Rust diagnostics | Only an OS/proxy-level block plus app-attempt ledger can distinguish intended failures from undisclosed egress. [ASSUMED] |

## Project Constraints (from AGENTS.md)

- Extend the active Tauri/Rust core and Next.js/React interface; do not add supported behavior to the archived Python/FastAPI backend. [VERIFIED: AGENTS.md:13-16]
- Keep capture, transcription, persistence, and memory local by default, and disclose/configure every remote provider or destination. [VERIFIED: AGENTS.md:16-16]
- Preserve inspectable source attribution, end-to-end latency accounting, lifecycle consistency, native permissions/device handling/recovery/resource limits, and bounded-scope validation. [VERIFIED: AGENTS.md:17-22]
- Preserve the locked stack and existing lockfiles: Tauri/React/Next.js, SQLite/SQLx, Tokio, Serde, UUID/Chrono, tracing, sysinfo, Reqwest, and the existing transcription engines. [VERIFIED: AGENTS.md:34-58]
- Keep Community Edition, the archived backend, and the separate Pro Agent API distinct; the supported internal surface is Rust/Tauri commands and events. [VERIFIED: AGENTS.md:130-142] [VERIFIED: CLAUDE.md:5-18]
- Follow nearby source/module/test patterns, use performance-aware logging in hot audio paths, retain microphone versus system-audio terminology, and use Tauri path APIs rather than hard-coded user paths. [VERIFIED: /Users/nrentas/.codex/skills/meetily-development/references/community-repo.md]
- The repository has no additional project skills; conventions and architecture mapping remain intentionally emergent from current code. [VERIFIED: AGENTS.md:201-219]
- This research was started through the Phase 1 GSD planning workflow; implementation must proceed through the applicable GSD execution workflow. [VERIFIED: AGENTS.md:222-235]

## Current-State Findings and Exact Integration Points

### Identity and persistence defects

| Current behavior | Consequence | Required integration point |
|------------------|-------------|----------------------------|
| React handles `recording-started` by creating ``meeting-${Date.now()}``, then writes that value to session storage and IndexedDB. [VERIFIED: frontend/src/contexts/TranscriptContext.tsx:94-120] | The recovery identity is not authoritative and can diverge from SQLite. | Change the recording/preparation command response/event payload to carry the Rust-created ID; React only transports it. |
| `save_transcript` creates ``meeting-${Uuid::new_v4()}`` and a new ``transcript-${Uuid::new_v4()}`` for every segment. [VERIFIED: frontend/src-tauri/src/database/repositories/transcript.rs:13-60] | Retry and recovery create new logical records. | Split “create meeting session” from “upsert final evidence”; accept the existing meeting/evidence IDs as required parameters. |
| The initial schema defines exact columns `meetings(id, title, created_at, updated_at)` and `transcripts(id, meeting_id, transcript, timestamp, summary, action_items, key_points)`; later migrations add `folder_path`, `audio_start_time`, `audio_end_time`, `duration`, and `speaker`. [VERIFIED: frontend/src-tauri/migrations/20250916100000_initial_schema.sql:1-19] [VERIFIED: frontend/src-tauri/migrations/20251006000000_add_audio_sync_fields.sql:6-17] [VERIFIED: frontend/src-tauri/migrations/20251110000001_add_speaker_field.sql:1-5] | There is no lifecycle, completeness/gap, stable source identity, finality, or run telemetry in the durable model. | Add forward-only migrations and update `database/models.rs`, repositories, and command DTOs together. |
| `RecordingSaver` metadata has `meeting_id: Option<String>` initialized to `None` and string status documented as `"recording", "completed", "error"`; the exact values are quoted here verbatim. [VERIFIED: frontend/src-tauri/src/audio/recording_saver.rs:27-41] [VERIFIED: frontend/src-tauri/src/audio/recording_saver.rs:240-256] | Folder metadata cannot prove identity continuity and its status vocabulary conflicts with the locked lifecycle. | Pass meeting ID and typed lifecycle into `RecordingSaver::start`; include the ID in directory metadata from the first write. |
| Folder creation currently uses ``{sanitized meeting name}_{UTC minute}``, quoted from `format!("{}_{}", sanitized_name, timestamp)`. [VERIFIED: frontend/src-tauri/src/audio/audio_processing.rs:27-46] | Two meetings can share a human title/minute, and the path cannot itself prove canonical identity. | Make the generated Rust meeting ID an immutable folder component; retain title only as human-readable metadata. |

### Queue, stop, and completeness defects

| Current behavior | Consequence | Required integration point |
|------------------|-------------|----------------------------|
| `AudioPipeline` receives and sends through `mpsc::UnboundedReceiver<AudioChunk>` / `mpsc::UnboundedSender<AudioChunk>`, and the worker creates a second `unbounded_channel::<AudioChunk>()`. [VERIFIED: frontend/src-tauri/src/audio/pipeline.rs:691-706] [VERIFIED: frontend/src-tauri/src/audio/transcription/worker.rs:50-80] | Sustained overload can grow memory without a declared capacity or rejection record. | Bound the transcription handoff(s), keep callback-facing admission non-blocking, and record every `Full`/closed rejection as a gap/outcome. |
| Exact current public status fields are `chunks_in_queue`, `is_processing`, and `last_activity_ms`; the command returns exact values `0`, `IS_RECORDING`, and `0`. [VERIFIED: frontend/src-tauri/src/audio/recording_commands.rs:122-127] [VERIFIED: frontend/src-tauri/src/audio/recording_commands.rs:1105-1111] | The UI cannot distinguish queued, active, failed, or terminal work. | Replace with a shared per-meeting snapshot containing capacity/depth/oldest age and cumulative accepted/started/completed/failed/cancelled/superseded/rejected counts. |
| One worker is hard-coded as `const NUM_WORKERS: usize = 1`; model-unloaded work increments completed and continues. [VERIFIED: frontend/src-tauri/src/audio/transcription/worker.rs:73-83] [VERIFIED: frontend/src-tauri/src/audio/transcription/worker.rs:142-147] | “Completed” currently means dequeued/abandoned as well as successfully terminal, corrupting throughput/loss evidence. | Give every accepted work item exactly one explicit terminal outcome and persist the failure/gap reason. |
| The stop path waits up to exact `600` seconds for transcription and `300` seconds for recording save, then continues on error/timeout. [VERIFIED: frontend/src-tauri/src/audio/recording_commands.rs:747-805] [VERIFIED: frontend/src-tauri/src/audio/recording_commands.rs:1015-1041] | Continuing is reasonable, but no durable incomplete lifecycle is written before the “complete” event. | Move state to `finalizing` before drain; on deadline/failure atomically persist `incomplete` plus remaining IDs/depth/oldest age/gaps before returning. |
| React polls for exact `60000` ms, treats quiet status as complete, waits another exact `4000` ms, flushes, waits exact `500` ms, then performs the only SQLite meeting save. [VERIFIED: frontend/src/hooks/useRecordingStop.ts:152-208] [VERIFIED: frontend/src/hooks/useRecordingStop.ts:211-260] | Fixed delays and placeholder zero depth can falsely declare completion, and a renderer crash before save loses canonical persistence. | Delete frontend completion inference; Rust owns finalization and returns an authoritative lifecycle snapshot. |
| `RecordingSaver::stop_and_save` waits exact `200` ms and writes metadata status `"completed"`; if auto-save is disabled it returns before that status update. [VERIFIED: frontend/src-tauri/src/audio/recording_saver.rs:347-373] [VERIFIED: frontend/src-tauri/src/audio/recording_saver.rs:394-431] | File metadata may disagree with SQLite/UI and cannot represent recovered-with-gaps. | Centralize lifecycle transition and mirror the committed durable result to file metadata; never let the saver invent completion independently. |

### Recovery defects

IndexedDB exact current values are database `"MeetilyRecoveryDB"`, version `1`, meeting key `meetingId`, and transcript auto-increment key `id`; transcripts are inserted with `add`. [VERIFIED: frontend/src/services/indexedDBService.ts:7-35] [VERIFIED: frontend/src/services/indexedDBService.ts:66-84] [VERIFIED: frontend/src/services/indexedDBService.ts:225-249] The schema therefore has no unique stable evidence key and redelivery can duplicate cached segments. [VERIFIED: frontend/src/services/indexedDBService.ts:76-84]

The recovery hook loads those records, manufactures a fallback display ID, calls the same “save new meeting” API, receives a new meeting ID, and only afterward marks the old IndexedDB meeting saved. [VERIFIED: frontend/src/hooks/useTranscriptRecovery.ts:110-123] [VERIFIED: frontend/src/hooks/useTranscriptRecovery.ts:164-217] A crash or retry before the mark can create another SQLite meeting. [VERIFIED: frontend/src-tauri/src/database/repositories/transcript.rs:13-60]

Plan an IndexedDB version upgrade that makes the Rust meeting ID the meeting key and stable evidence ID the transcript key (or a unique composite index), stores only final evidence as canonical recovery input, uses `put` semantics, and retains partial UI text in a clearly provisional store/field. Recovery should call a Rust reconciliation command with the same IDs and should be safe to repeat before or after any individual write. [ASSUMED]

## Standard Stack

### Core

| Library / facility | Resolved version | Purpose in Phase 1 | Prescription |
|--------------------|------------------|--------------------|--------------|
| Tauri Rust crate / CLI | `2.11.1` / `2.11.1` | Commands, events, app-data paths, capability boundary, packaged harness | Keep; use commands for authoritative operations/snapshots and events for compact progress/lifecycle notifications. [VERIFIED: AGENTS.md:36-43] [CITED: https://v2.tauri.app/concept/inter-process-communication/] |
| Tokio | `1.52.3` | Bounded queues, drain, deadlines, task coordination | Keep; replace unbounded transcription work with finite-capacity `mpsc`, and explicitly close/drain the receiver. [VERIFIED: AGENTS.md:47-55] [CITED: https://docs.rs/tokio/latest/tokio/sync/mpsc/fn.channel.html] |
| `tokio-util` | `0.7.18` | Cancellation token for deadline/cancel propagation | Keep; no new cancellation framework. [VERIFIED: AGENTS.md:47-55] [CITED: https://docs.rs/tokio-util/latest/tokio_util/sync/index.html] |
| SQLx + SQLite | `0.8.6` / `0.8.6` | Canonical lifecycle, evidence upsert, run index, transactions, migrations | Keep; use unique constraints, `ON CONFLICT`, and transactions for state/evidence reconciliation. [VERIFIED: AGENTS.md:47-55] [CITED: https://docs.rs/sqlx/0.8.6/sqlx/struct.Transaction.html] |
| Serde / `serde_json` | `1.0.228` / `1.0.149` | Typed IPC/status/run records and local JSON/JSONL bundle | Keep; version every exported schema. [VERIFIED: AGENTS.md:47-55] |
| UUID / Chrono / `std::time::Instant` | `1.23.1` / `0.4.44` / standard library | Stable IDs, UTC correlation, monotonic elapsed durations | Keep; UUID is minted once in Rust, Chrono timestamps correlate, and `Instant` deltas measure duration. [VERIFIED: AGENTS.md:47-55] [CITED: https://doc.rust-lang.org/std/time/struct.Instant.html] |
| `tracing` | `0.1.44` | Structured diagnostic spans and correlation fields | Keep; telemetry payloads should be typed and content-redacted rather than transcript-bearing logs. [VERIFIED: AGENTS.md:47-55] [CITED: https://docs.rs/tracing/latest/tracing/span/index.html] |
| `sysinfo` | `0.32.1` | CPU and memory sampling | Keep; reuse/adapt the current two-refresh sampler and add process/run correlation. [VERIFIED: AGENTS.md:47-55] [VERIFIED: frontend/src-tauri/src/whisper_engine/system_monitor.rs:43-106] |
| Reqwest | `0.11.27` | Existing LAN/remote provider traffic | Keep behind an effective-route contract with deadline/cancellation and diagnostic attribution. [VERIFIED: AGENTS.md:47-57] |

### Supporting repository facilities

| Facility | Purpose | When to use |
|----------|---------|-------------|
| `DatabaseManager::with_transaction` | Existing transaction wrapper commits success and rolls back errors. [VERIFIED: frontend/src-tauri/src/database/manager.rs:164-181] | Meeting creation, evidence upsert plus lifecycle/gap updates, and recovery reconciliation. |
| `sqlx::migrate!("./migrations")` | Existing embedded migration mechanism. [VERIFIED: frontend/src-tauri/src/database/manager.rs:33-37] | Add lifecycle/evidence/run tables and upgrade fixtures; also add migration-directory rebuild tracking because current `build.rs` has no such directive. [VERIFIED: frontend/src-tauri/build.rs:1-25] [CITED: https://docs.rs/sqlx/0.8.6/sqlx/macro.migrate.html] |
| `RecordingSaver` atomic temp-file rename | Existing metadata/transcript file writes use temp then rename. [VERIFIED: frontend/src-tauri/src/audio/recording_saver.rs:267-276] | Keep for run manifests and recording metadata mirrors after SQLite commits. |
| Tauri plugin store / IndexedDB | Local renderer persistence | Preferences and crash cache only; never a second canonical meeting/evidence authority. [VERIFIED: frontend/src/components/AnalyticsProvider.tsx:33-50] [VERIFIED: frontend/src/services/indexedDBService.ts:7-35] |
| OS-native power snapshot | Battery/power evidence | Record start/end power source, battery percent/status, duration, and CPU/memory alongside the run; treat energy conclusions as unknown where the OS cannot provide defensible data. [ASSUMED] |

### Alternatives considered and rejected

| Instead of | Do not use | Reason |
|------------|------------|--------|
| Existing Rust/Tauri core | Archived FastAPI backend | It is explicitly unsupported and would split lifecycle/identity across processes. [VERIFIED: backend/README.md:1-23] |
| Existing SQLite | New server database or event store | Phase 1 is local single-user validation; SQLx already owns migrations and transactions. [VERIFIED: AGENTS.md:130-142] |
| Typed local measurements | Hosted APM/OpenTelemetry exporter | Raw meeting telemetry is local by default and export must be deliberate/reviewable. [VERIFIED: .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-CONTEXT.md:16-23] |
| Tokio bounded queues | Redis/NATS/custom broker | Work is process-local and existing async primitives provide capacity, backpressure, close, and drain. [VERIFIED: AGENTS.md:130-142] [CITED: https://docs.rs/tokio/latest/tokio/sync/mpsc/fn.channel.html] |
| Explicit UI acknowledgement command | Inferring visibility from Rust event emission | Tauri events prove emission, not React rendering; commands provide a request/response acknowledgement path. [CITED: https://v2.tauri.app/concept/inter-process-communication/] |

**Installation:** no external package installation is required. Use the checked-in lockfiles and existing dependencies. [VERIFIED: frontend/src-tauri/Cargo.toml:75-145] [VERIFIED: frontend/src-tauri/Cargo.toml:203-210]

## Package Legitimacy Audit

No external packages are recommended for this phase, so the package-legitimacy gate is not triggered. [VERIFIED: frontend/src-tauri/Cargo.toml:75-145] If implementation introduces any package despite this recommendation, the planner must add the ecosystem registry check, legitimacy seam, Node postinstall inspection where applicable, MSRV check against exact declared `rust-version = "1.77"`, and a human checkpoint for every `SUS` result. [VERIFIED: frontend/src-tauri/Cargo.toml:1-9]

**Packages removed due to `SLOP` verdict:** none.

**Packages flagged as suspicious `SUS`:** none.

## Architecture Patterns

### System architecture and data flow

```text
User chooses provider/devices and starts
        |
        v
Rust StartMeeting transaction
  -> UUID + meeting row(status=preparing)
  -> recording folder/metadata keyed by same UUID
  -> effective provider route snapshot
        |
        v
Capture callback --non-blocking--> bounded audio/pipeline admission
        |                                |
        |                            rejection/full
        |                                v
        |                         durable capture-gap fact
        v
VAD / segment boundary
        |
        v
bounded transcription queue + shared QueueLedger
 accepted -> started -> completed(final) / failed / cancelled / superseded
        |                    |
        |                    v
        |              SQLite evidence UPSERT
        |                    |
        |                    v
        |              compact Tauri event -> React render
        |                                      |
        |                                      v
        +<---------- ack command(token) --------+
        |
        v
Stop: close producers -> status=finalizing -> drain until deadline
        |                         |
   all terminal + durable     deadline/failure/gap
        |                         |
        v                         v
 status=complete          status=incomplete
        \_________________________/
                    |
                    v
        local versioned run bundle + explicit reviewable export

Provider route resolver:
  local sidecar / loopback -> Local
  private or explicitly LAN host -> LAN
  hosted/non-local destination -> Remote
  unavailable -> visible failure; never implicit route substitution
```

This flow follows the locked exact lifecycle vocabulary `preparing`, `recording`, `finalizing`, `complete`, `incomplete`, and `recovered`, quoted verbatim from D-12. [VERIFIED: .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-CONTEXT.md:25-30]

### Recommended project structure

```text
frontend/src-tauri/src/
├── meeting/                 # meeting session, lifecycle, completeness, reconciliation
├── observability/           # stage clock, queue ledger, resource sampler, run bundle
├── trust/                   # provider destination resolution and outbound attribution
├── audio/                   # retained capture, segmentation, bounded transcription integration
├── database/                # migrations, meeting/evidence/run repositories
└── api/                     # Tauri command DTOs and registration

frontend/src/
├── services/                # typed command/event clients and IndexedDB cache upgrade
├── contexts/                # consumes Rust meeting ID and canonical status
└── components/              # compact route/completeness/diagnostics UI

frontend/src-tauri/tests/
├── fixtures/                # migration/recovery/queue scenario fixtures
└── ...                      # integration tests that can run without a physical device
```

The exact module names are discretionary; preserving Rust ownership and nearby layer boundaries is mandatory. [VERIFIED: .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-CONTEXT.md:45-48] [VERIFIED: /Users/nrentas/.codex/skills/meetily-development/references/community-repo.md]

### Pattern 1: Rust-owned session aggregate

Create a `MeetingSession`-shaped aggregate before any capture state accepts audio. It owns meeting ID, lifecycle, run ID, provider route snapshot, queue ledger, gap ledger, start `Instant`, and UTC start. Persist the meeting row first, initialize folder metadata with the same ID second, then publish the start result. If folder initialization fails, preserve a failed/incomplete durable row or roll the transaction back before capture begins; never let React create a replacement ID. [ASSUMED]

### Pattern 2: Persist-before-canonical-publish

Partials may be emitted to the UI as provisional. For a final segment, assign its evidence ID once in Rust, upsert it transactionally, update queue outcome, then emit the canonical event carrying that same ID. A renderer crash after commit can replay from SQLite; a retry hits the same uniqueness constraint. [ASSUMED]

Recommended evidence uniqueness is the stable `evidence_id` primary key plus an optional uniqueness constraint over `(meeting_id, source_track, source_segment_key)` to detect programming errors. Do not derive identity solely from mutable transcript text, wall-clock time, or the global process sequence counter. [ASSUMED] The current counter is exact global `SEQUENCE_COUNTER: AtomicU64 = AtomicU64::new(0)` and only the speech flag is reset per session. [VERIFIED: frontend/src-tauri/src/audio/transcription/worker.rs:14-23]

### Pattern 3: Single queue ledger with conservation invariants

The shared per-meeting ledger—not worker-local atomics—must own admission time, start time, terminal outcome, and reason for each work ID. Its snapshot should satisfy:

```text
accepted = queued + active + completed + failed + cancelled + superseded
depth = queued + active
oldest_age = now_monotonic - min(nonterminal.accepted_at)
```

`rejected` is tracked separately because it was not accepted; it must still create a capture-gap/completeness fact. The exact locked terminal labels are quoted in D-03 as `accepted`, `started`, `completed`, `failed`, `cancelled`, and `superseded`. [VERIFIED: .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-CONTEXT.md:16-23] The conservation equation and separate rejected counter are recommended design details. [ASSUMED]

### Pattern 4: Monotonic span tracker with serializable offsets

Keep an in-memory Rust `Instant` origin per run and serialize integer nanosecond or microsecond offsets from that origin plus UTC timestamps for cross-record correlation. Do not serialize `Instant` itself, compare JavaScript and Rust monotonic clock origins, or compute durations from UTC. Rust documents `Instant` as opaque and monotonically nondecreasing, not as a portable serializable timestamp; suspend behavior can vary by platform. [CITED: https://doc.rust-lang.org/std/time/struct.Instant.html]

For UI acknowledgement, emit an opaque delivery token after the evidence commit, retain its Rust `Instant`, let React acknowledge after the transcript state is committed (prefer a post-layout/animation-frame callback), and calculate duration when the Rust command receives that token. Label this “UI acknowledgement,” not guaranteed physical pixel presentation. [ASSUMED]

### Pattern 5: Explicit finalization state machine

`stop` must be idempotent for a meeting ID. First transition `recording -> finalizing`, close producers, freeze accepted work, and expose depth/oldest age. Then drain until all accepted work has one terminal outcome or the declared deadline expires. Finally, in one transaction, persist `complete` only when capture stopped, all accepted work is terminal, and required writes succeeded; otherwise persist `incomplete` with reasons and remaining work IDs. Repeated stop returns the durable result. The exact lifecycle and completion condition are locked by D-12 through D-17. [VERIFIED: .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-CONTEXT.md:25-37]

### Pattern 6: Route resolution from effective destination

Represent a provider choice as provider ID + concrete effective destination + location class + capability/data category. Fixed hosted APIs are Remote; the built-in sidecar is Local; loopback is Local; configurable Ollama/custom endpoints require URL parsing and IP/hostname classification at execution time. A provider label alone is insufficient because exact `Ollama` can target a configured endpoint and exact `CustomOpenAI` accepts an arbitrary endpoint. [VERIFIED: frontend/src-tauri/src/summary/llm_client.rs:213-235] [VERIFIED: frontend/src-tauri/src/summary/llm_client.rs:301-345]

DNS names that can resolve differently introduce rebinding/ambiguity. Resolve and record the effective host/address for diagnostics, but do not silently reclassify after the user confirmed a materially different route; fail and request reconfiguration if the route contract changes. [ASSUMED]

### Anti-patterns to avoid

- **Frontend-created canonical IDs:** renderer state is reloadable and currently diverges from SQLite. [VERIFIED: frontend/src/contexts/TranscriptContext.tsx:94-120]
- **“Quiet means done”:** the current public status is a placeholder, so silence/fixed waits cannot prove terminal work. [VERIFIED: frontend/src-tauri/src/audio/recording_commands.rs:1105-1111] [VERIFIED: frontend/src/hooks/useRecordingStop.ts:163-208]
- **Counting abandoned work as completed:** model-unloaded chunks currently do exactly this. [VERIFIED: frontend/src-tauri/src/audio/transcription/worker.rs:142-147]
- **Telemetry on the hot callback path:** avoid filesystem writes, async waits, formatting, or locks in capture callbacks; enqueue a compact event non-blockingly and record overflow. [ASSUMED]
- **Transcript content in diagnostic logs/bundles by default:** current code logs transcript text and the frontend logs samples; Phase 1 diagnostics should use IDs/lengths/timing unless explicit content inclusion is selected. [VERIFIED: frontend/src-tauri/src/audio/transcription/worker.rs:167-173] [VERIFIED: frontend/src/hooks/useRecordingStop.ts:247-253]
- **Provider-name-only privacy labels:** configurable URLs make that inaccurate. [VERIFIED: frontend/src-tauri/src/summary/llm_client.rs:314-329]
- **Automatic provider fallback on config read error:** current transcription validation defaults to exact provider `"parakeet"` both when configuration is absent and when reading it fails. The read-error branch must fail visibly rather than substituting. [VERIFIED: frontend/src-tauri/src/audio/transcription/engine.rs:54-87]
- **Independent lifecycle writers:** recording metadata, SQLite, frontend state, and IndexedDB must reflect one Rust transition rather than each declaring completion. [VERIFIED: frontend/src-tauri/src/audio/recording_saver.rs:410-431] [VERIFIED: frontend/src/hooks/useRecordingStop.ts:233-266]

## Safe Sequencing Plan

1. **Wave 0 — executable characterization and migration fixtures.** Add focused tests around current database upgrades, evidence upsert/replay, lifecycle transition legality, queue conservation, provider route classification, and repeated recovery. Capture one unmodified/current-behavior diagnostic run before changing semantics so regressions are distinguishable from pre-existing defects. [ASSUMED]
2. **Wave 1 — domain types and forward-only schema.** Introduce typed meeting lifecycle, completeness/gap reason, evidence metadata, provider route, run record, and queue snapshot. Add migrations and legacy fixtures before changing the start path. [ASSUMED]
3. **Wave 2 — canonical identity and incremental evidence.** Rust creates the meeting row and folder before recording, returns the ID, and threads it through `RecordingManager`, `RecordingSaver`, events/commands, React, IndexedDB, and repositories. Persist final evidence incrementally before canonical publish; leave partial UI behavior provisional. [ASSUMED]
4. **Wave 3 — bounded queue and finalization/recovery.** Replace transcription unbounded work channels with bounded admission and a shared ledger, then replace the placeholder status and frontend delay loop. Implement close/drain/deadline, durable incomplete/gaps, idempotent stop, IndexedDB upgrade, and reconciliation. Do not change VAD/ASR quality algorithms in this wave. [ASSUMED]
5. **Wave 4 — trust boundaries and least privilege.** Resolve effective destinations, remove silent config-error fallback, add compact selection/start disclosures and diagnostics, suppress/attribute background egress in canary mode, and narrow Tauri filesystem capabilities. [ASSUMED]
6. **Wave 5 — versioned harness and exit evidence.** Add run bundle writer, resource/power sampler, explicit UI acknowledgements, matrix runner/guide, repeat aggregation, and threshold declaration. Execute target hardware plus smaller supported-platform smoke; unknown combinations remain unverified. [ASSUMED]

The sequencing is intentionally asymmetric: instrumentation primitives can start early, but final claims must be rerun after identity, persistence, and finalization semantics change. Otherwise the baseline would measure a system that no longer defines work/completion the same way. [ASSUMED]

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Stable identifiers | Timestamp/counter/string remapping | Existing `uuid` crate, minted once in Rust | Timestamp IDs collide semantically and remapping breaks recovery lineage. [VERIFIED: AGENTS.md:47-55] |
| Idempotent persistence | Read-then-insert duplicate suppression in React | SQLite unique constraints + `ON CONFLICT` inside SQLx transaction | Database constraints remain correct across crash/retry/concurrency. [CITED: https://www.sqlite.org/lang_upsert.html] [CITED: https://docs.rs/sqlx/0.8.6/sqlx/struct.Transaction.html] |
| Backpressure | Home-grown queue around `Vec`/mutex | Tokio bounded `mpsc`, `try_send` at non-blocking boundaries, close/drain | Capacity and failure semantics are explicit and tested upstream. [CITED: https://docs.rs/tokio/latest/tokio/sync/mpsc/fn.channel.html] |
| Cancellation/deadline propagation | Global booleans and sleeps | `CancellationToken`, `tokio::select!`, `tokio::time::timeout` | Existing stack already supplies structured cancellation/timeouts. [CITED: https://docs.rs/tokio-util/latest/tokio_util/sync/index.html] |
| Duration measurement | UTC subtraction or cross-runtime clock comparison | Rust `Instant` deltas | Wall clocks can jump and JS/Rust monotonic origins are unrelated. [CITED: https://doc.rust-lang.org/std/time/struct.Instant.html] |
| IPC protocol | New local HTTP server/FastAPI | Tauri commands for authoritative operations and events for progress | Matches supported Community Edition architecture. [VERIFIED: CLAUDE.md:5-18] [CITED: https://v2.tauri.app/concept/inter-process-communication/] |
| Resource sampling | Hosted metrics agent | Existing `sysinfo` plus OS-local power snapshot | Keeps raw evaluation local and avoids a new runtime/export path. [VERIFIED: frontend/src-tauri/src/whisper_engine/system_monitor.rs:43-106] |
| File paths | Hard-coded platform locations | Tauri path APIs and app-data directory | Existing DB manager already resolves app data through Tauri. [VERIFIED: frontend/src-tauri/src/database/manager.rs:44-67] |
| Security boundary | UI-only “Local” badge | Runtime effective-route resolver + capability scope + outbound attribution | The displayed claim must match actual destination and permissions. [CITED: https://v2.tauri.app/security/capabilities/] |

**Key insight:** Most Phase 1 guarantees are conservation and authority guarantees—one identity, one terminal outcome per accepted item, one canonical store, one explicit route—not UI polish or additional infrastructure. [ASSUMED]

## Runtime State Inventory

| Category | Items found | Action required |
|----------|-------------|-----------------|
| Stored data | App-data SQLite exact files `meeting_minutes.sqlite` and legacy `meeting_minutes.db`; browser IndexedDB exact database `MeetilyRecoveryDB` version `1`; recording folders with `metadata.json`, `transcripts.json`, audio, and checkpoints. [VERIFIED: frontend/src-tauri/src/database/manager.rs:44-67] [VERIFIED: frontend/src/services/indexedDBService.ts:32-35] [VERIFIED: frontend/src-tauri/src/audio/recording_saver.rs:240-255] | Forward-only SQLite migration; IndexedDB version upgrade; reconciliation of existing unsaved cache; keep existing meeting/transcript IDs. Do not claim old rows are complete: legacy completeness is unknowable from current columns, so migrate them to a conservative explicit legacy/unknown-incomplete representation or gate the exact policy as an open decision. [ASSUMED] |
| Live service config | Provider choice, keys, Ollama endpoint, and custom OpenAI configuration are in local SQLite settings; no separate supported server-side service configuration was found. [VERIFIED: frontend/src-tauri/migrations/20250916100000_initial_schema.sql:50-72] [VERIFIED: frontend/src-tauri/src/database/models.rs:69-108] | Add/derive effective location and destination at runtime; preserve selected choice on failure. No external data migration is required for current CE config. [ASSUMED] |
| OS-registered state | Native microphone/system-audio permissions, device availability, updater registration/config, and packaged app identity affect runs; no phase-specific launchd/systemd/Task Scheduler meeting identity was found in the supported path. [VERIFIED: CLAUDE.md:99-129] [VERIFIED: frontend/src-tauri/tauri.conf.json:81-119] | Do not rename/re-register platform permissions in Phase 1; capture permission/device state in the environment fingerprint and run packaged smoke tests. Updater traffic must be disabled or attributed during the network canary. [ASSUMED] |
| Secrets/env vars | API keys and custom endpoints are stored in SQLite setting fields with exact names `groqApiKey`, `openaiApiKey`, `anthropicApiKey`, `ollamaApiKey`, `openRouterApiKey`, `ollamaEndpoint`, and `customOpenAIConfig`. [VERIFIED: frontend/src-tauri/src/database/models.rs:69-108] | Do not rename keys in this phase. Never write their values to run bundles/logs; record provider ID, location class, redacted destination, and whether credentials were present. [ASSUMED] |
| Build artifacts / installed packages | Embedded migrations are compiled through `sqlx::migrate!("./migrations")`; current `build.rs` has no migration-directory `rerun-if-changed`. [VERIFIED: frontend/src-tauri/src/database/manager.rs:33-37] [VERIFIED: frontend/src-tauri/build.rs:1-25] | Add the SQLx-recommended build tracking, rebuild packaged artifacts, and test upgrade from representative old databases rather than only fresh schema. [CITED: https://docs.rs/sqlx/0.8.6/sqlx/macro.migrate.html] |

## Run Bundle Contract

Use a self-contained versioned directory under a Tauri-resolved app-data evaluation location. Exact filenames remain discretionary; a prescriptive candidate is below. [ASSUMED]

```text
run-<run_uuid>/
├── manifest.json           # schema version, scenario, revision, start/end, inclusion policy
├── environment.json        # OS/hardware/power/devices/sample/model/effective route
├── stages.jsonl            # monotonic offsets, UTC correlation, meeting/work/evidence IDs
├── queues.jsonl            # capacity/depth/oldest age/cumulative outcomes
├── resources.jsonl         # process/system CPU, memory, power/battery observations
├── errors.jsonl            # typed/redacted failures, gaps, cancellation/deadline reasons
├── result.json             # distributions, outliers, pass/fail/unknown per declared gate
└── summary.md              # concise human-readable findings and limitations
```

The bundle must default to no transcript text, no audio, no API keys, and no full sensitive local paths. A separate explicit export step shows the manifest and content categories, lets the user opt into transcript/audio inclusion, and writes a sanitized copy rather than changing the raw local run. This implements D-01/D-07 without making hosted telemetry a dependency. [VERIFIED: .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-CONTEXT.md:16-23]

Every event should carry schema version, run ID, meeting ID, stage, monotonic offset, UTC timestamp, and relevant work/evidence ID. Queue samples additionally carry capacity/depth/oldest age and cumulative outcomes; resource samples carry interval and scope. Reserve future stage names but reject emitting them unless the corresponding Phase 4 work exists. [ASSUMED]

## Scenario Matrix and Threshold Process

| Scenario | Primary evidence | Required failure/edge injection |
|----------|------------------|---------------------------------|
| Short utterances | capture-to-segment, segment-to-final, final-to-durable, durable-to-UI-ack | cold and warm model runs |
| Continuous speech | segment freshness distribution and maximum open-segment age | sustained speech beyond normal VAD boundary |
| Overlapping speech | source/track attribution, timing overlap, evidence ordering | mic + system overlap |
| Sustained system audio | backlog age, memory, transcript freshness | long continuous system source |
| Overload | capacity, rejected work, gap ledger, peak memory | slowed transcription / accelerated replay |
| Stop | time to capture close, drain behavior, terminal accounting | stop with empty, shallow, and full queue |
| Restart | distinct IDs/runs, no stale worker/event leakage | immediate restart after complete/incomplete stop |
| Crash | durable meeting/evidence before crash and visible gaps after launch | kill at preparing, recording, finalizing, and evidence write boundaries |
| Repeated recovery | invariant row/evidence counts and stable IDs | repeat before/after partial reconciliation and cleanup |
| Network blocked | local flow completes; every attempted destination is attributable | block external network while updater/analytics are controlled |

The scenario names and required primary reference machine are locked verbatim in D-05; the edge injections above are implementation recommendations. [VERIFIED: .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-CONTEXT.md:20-23] [ASSUMED]

Use at least one recorded warm-up and multiple measured repeats; report p50/p95 where sample size supports them, min/max, all outliers, and individual-run links. Do not set numeric go/no-go values in the implementation plan. Run the matrix, review distributions, declare thresholds in a versioned decision artifact, then apply those thresholds to a separate subsequent run before unblocking dependent work. The exact repeat count and metric cutoffs remain open because the primary reference machine is not yet declared. [VERIFIED: .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-CONTEXT.md:20-23] [ASSUMED]

## Verification Strategy and Commands

Nyquist validation is explicitly disabled (`"nyquist_validation": false`), so this research intentionally omits the formal `Validation Architecture` section. [VERIFIED: .planning/config.json:20-25] Phase verification is still required by the roadmap and should be planned in the implementation waves. [VERIFIED: .planning/ROADMAP.md:31-43]

### Automated layers

| Layer | What it proves | Command |
|-------|----------------|---------|
| Rust focused unit tests | lifecycle transitions, queue conservation, route parsing/classification, redaction, bundle schema | `cargo test --manifest-path frontend/src-tauri/Cargo.toml <focused_filter>` [ASSUMED] |
| Rust repository integration tests | fresh migration, upgrade fixtures, idempotent evidence upsert, repeated reconciliation, transaction rollback | `cargo test --manifest-path frontend/src-tauri/Cargo.toml database` [ASSUMED] |
| Rust full library tests | existing audio/database behavior remains green | `cargo test --manifest-path frontend/src-tauri/Cargo.toml --lib` [ASSUMED] |
| Format and static checks | Rust formatting and type/build correctness | `cargo fmt --manifest-path frontend/src-tauri/Cargo.toml -- --check`; `cargo check --manifest-path frontend/src-tauri/Cargo.toml` [ASSUMED] |
| Frontend compile/lint | DTO consumers and static export compile | `pnpm --dir frontend lint`; `pnpm --dir frontend build` [VERIFIED: frontend/package.json:1-31] |
| Existing portable native guard | current Node test convention remains intact | `node --test .github/verify-portable-ggml.test.cjs` [VERIFIED: .github/verify-portable-ggml.test.cjs:1-11] |
| Harness schema/invariant test | every run bundle parses, has required files, stage order, queue conservation, and no default content fields | planner should create a focused Rust/Node validator and invoke it on fixture bundles. [ASSUMED] |

The repository contains Rust inline tests but no package-level frontend `test` script, so the plan should not invent a generic `pnpm test`; add an explicit script only if Phase 1 adds frontend unit tests. [VERIFIED: frontend/package.json:1-31] [VERIFIED: frontend/src-tauri/src/audio/transcription/worker.rs:593-605]

### Manual/physical verification

- Run the complete matrix on the declared primary reference machine with exact OS, hardware, power state, device names, sample configuration, model, language, app revision, and scenario version captured. [VERIFIED: .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-CONTEXT.md:20-23]
- Run smaller packaged-app smoke coverage on each claimed supported platform; an unrun combination is `unverified`, not passing. [VERIFIED: .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-CONTEXT.md:20-22]
- Snapshot the provider disclosure at configuration and immediately before data-bearing work, then make the route unavailable and verify explicit retry/reconfigure/cancel behavior with no setting mutation. [VERIFIED: .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-CONTEXT.md:39-43]
- Run the network-blocked canary at OS/proxy level with updater, analytics, and model-download behavior explicitly controlled; reconcile every observed connection attempt with the diagnostics ledger. [ASSUMED]
- Crash at each durable boundary and repeat recovery at least twice, verifying stable meeting/evidence IDs, invariant counts, lifecycle/completeness, and preserved gaps. [ASSUMED]

## Common Pitfalls

### Pitfall 1: Instrumenting after the first unbounded queue

**What goes wrong:** capture timestamps look healthy while segmentation or queue wait dominates end-to-end freshness.

**Why it happens:** the existing worker sees chunks only after VAD and queueing. [VERIFIED: frontend/src-tauri/src/audio/pipeline.rs:735-759]

**How to avoid:** instrument capture, segment boundary, acceptance, start, final, persistence, emit, and acknowledgement separately.

**Warning sign:** only provider/transcription duration is available, or total delay cannot be decomposed. [ASSUMED]

### Pitfall 2: Blocking the capture callback to get backpressure

**What goes wrong:** native audio capture stalls or becomes unstable.

**Why it happens:** awaiting capacity on a latency-sensitive callback conflates durable capture and transcription admission.

**How to avoid:** use non-blocking bounded admission at callback-facing seams, explicitly record `Full` as rejection/gap, and keep recording durability separate from suggestion/transcription work. [ASSUMED]

**Warning sign:** `.await`, file I/O, JSON serialization, or contended locks appear in the capture callback. [ASSUMED]

### Pitfall 3: Treating sequence order as evidence identity

**What goes wrong:** process-global counters, restart, retry, or recovery create collisions/remapping.

**Why it happens:** current sequence IDs are useful for ordering but the counter is global and not reset. [VERIFIED: frontend/src-tauri/src/audio/transcription/worker.rs:14-23]

**How to avoid:** assign an independent stable evidence UUID once; keep session-local sequence only for display ordering. [ASSUMED]

### Pitfall 4: Backfilling historical “complete” without evidence

**What goes wrong:** old meetings gain a guarantee the old schema never recorded.

**Why it happens:** a non-null migration default is convenient.

**How to avoid:** mark legacy completeness as unknown/incomplete with a reason, or require an explicit product decision backed by a reconstruction rule. [ASSUMED]

**Warning sign:** migration sets every existing row to `complete`. [ASSUMED]

### Pitfall 5: Letting three stores become three authorities

**What goes wrong:** SQLite, recording metadata, and IndexedDB disagree after crash.

**Why it happens:** each currently writes its own identity/status on a different timeline. [VERIFIED: frontend/src-tauri/src/audio/recording_saver.rs:240-255] [VERIFIED: frontend/src/services/indexedDBService.ts:95-116] [VERIFIED: frontend/src-tauri/src/database/repositories/transcript.rs:13-60]

**How to avoid:** SQLite/Rust lifecycle is canonical; folder metadata mirrors it; IndexedDB is an idempotent cache/recovery carrier. [ASSUMED]

### Pitfall 6: Calling an emitted event “visible”

**What goes wrong:** the metric omits IPC parsing, React scheduling, and rendering.

**Why it happens:** Rust only observes successful event dispatch. [CITED: https://v2.tauri.app/concept/inter-process-communication/]

**How to avoid:** correlate an opaque delivery token with an explicit frontend acknowledgement after state commit.

**Warning sign:** `app.emit()` timestamp is the endpoint of BASE-02. [ASSUMED]

### Pitfall 7: A local provider with remote background traffic

**What goes wrong:** the canary sees egress from updater, analytics, model metadata/download, or configurable endpoints and misattributes it—or misses it entirely.

**Why it happens:** provider locality covers one operation, not the whole app. Startup update check is enabled by default. [VERIFIED: frontend/src/hooks/useUpdateCheck.ts:11-58]

**How to avoid:** test-mode control and outbound-attempt attribution must include all network-capable subsystems. [ASSUMED]

### Pitfall 8: Overclaiming battery impact

**What goes wrong:** CPU percentage is reported as energy consumption or coarse battery percentage is treated as precise.

**Why it happens:** current `sysinfo` integration measures memory/CPU but not battery. [VERIFIED: frontend/src-tauri/src/whisper_engine/system_monitor.rs:8-16]

**How to avoid:** record power source and battery start/end/duration on declared hardware, separate CPU/memory proxy from observed battery delta, and report unknown where measurement resolution is inadequate. [ASSUMED]

### Pitfall 9: Embedded migration not rebuilt

**What goes wrong:** a migration file changes but the binary does not embed it during an incremental rebuild.

**Why it happens:** SQLx documents the stable-Rust need for a migration-directory rerun directive, and current `build.rs` lacks it. [CITED: https://docs.rs/sqlx/0.8.6/sqlx/macro.migrate.html] [VERIFIED: frontend/src-tauri/build.rs:1-25]

**How to avoid:** add the directive and a packaged upgrade test. [ASSUMED]

## Code Examples

These are planning skeletons, not drop-in code; exact names are discretionary. [ASSUMED]

### Idempotent final-evidence upsert

```sql
-- Source: SQLite UPSERT official documentation.
INSERT INTO transcript_evidence (
  evidence_id, meeting_id, source_track, source_segment_key,
  transcript, audio_start_time, audio_end_time, is_final,
  capture_complete, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
ON CONFLICT(evidence_id) DO UPDATE SET
  transcript = excluded.transcript,
  audio_start_time = excluded.audio_start_time,
  audio_end_time = excluded.audio_end_time,
  capture_complete = excluded.capture_complete,
  updated_at = excluded.updated_at;
```

The proposed table/column names and exact `1` encoding are [ASSUMED]; the use of SQLite `ON CONFLICT` is documented officially. [CITED: https://www.sqlite.org/lang_upsert.html]

### Bounded admission and explicit rejection

```rust
// Source: Tokio bounded mpsc official documentation; schematic only.
match sender.try_send(work) {
    Ok(()) => ledger.accept(work_id, accepted_at),
    Err(TrySendError::Full(work)) => {
        ledger.reject(work_id, "capacity");
        gaps.record_from(work);
    }
    Err(TrySendError::Closed(work)) => {
        ledger.reject(work_id, "closed");
        gaps.record_from(work);
    }
}
```

The exact reasons `"capacity"` and `"closed"` are proposed [ASSUMED]; bounded channel/`try_send` behavior comes from Tokio. [CITED: https://docs.rs/tokio/latest/tokio/sync/mpsc/fn.channel.html]

### Rust-clock UI acknowledgement

```rust
// Source: Tauri commands/events + Rust Instant official docs; schematic only.
let token = delivery_tracker.register(meeting_id, evidence_id, Instant::now());
app.emit("transcript-final", payload.with_delivery_token(token))?;

#[tauri::command]
fn acknowledge_transcript_visible(token: DeliveryToken) -> Result<(), AckError> {
    delivery_tracker.finish(token, Instant::now())
}
```

The event/command names and types are [ASSUMED]; the architectural split follows official Tauri IPC and `Instant` semantics. [CITED: https://v2.tauri.app/concept/inter-process-communication/] [CITED: https://doc.rust-lang.org/std/time/struct.Instant.html]

## State of the Art

| Old/current approach | Phase 1 approach | Impact |
|----------------------|------------------|--------|
| Stop-time bulk meeting creation with random IDs. [VERIFIED: frontend/src-tauri/src/database/repositories/transcript.rs:13-60] | Pre-created Rust identity and incremental final-evidence upsert. [ASSUMED] | Recovery/retry can converge on one logical record. |
| Unbounded Tokio work queues. [VERIFIED: frontend/src-tauri/src/audio/transcription/worker.rs:50-80] | Finite capacity, non-blocking admission at hot seams, explicit rejected/gap accounting. [CITED: https://docs.rs/tokio/latest/tokio/sync/mpsc/fn.channel.html] | Backlog and memory become measurable/bounded. |
| Placeholder depth plus fixed quiet delays. [VERIFIED: frontend/src-tauri/src/audio/recording_commands.rs:1105-1111] [VERIFIED: frontend/src/hooks/useRecordingStop.ts:152-231] | Shared queue ledger and lifecycle-driven finalization. [ASSUMED] | Completion becomes a durable fact instead of an inference. |
| Provider brand treated as location. [VERIFIED: frontend/src-tauri/src/summary/llm_client.rs:213-235] | Effective destination resolved to Local/LAN/Remote at execution. [ASSUMED] | Privacy copy can match actual routing. |
| Broad `fs:read-all` and `fs:write-all` capability. Exact values quoted verbatim. [VERIFIED: frontend/src-tauri/tauri.conf.json:38-76] | App-owned scopes plus explicit user-selected file access. [CITED: https://v2.tauri.app/security/capabilities/] | Reduces renderer/plugin filesystem blast radius. |
| Event emission used as the observable UI boundary. [VERIFIED: frontend/src-tauri/src/audio/transcription/worker.rs:204-226] | Token-correlated frontend acknowledgement command. [ASSUMED] | BASE-02 includes IPC/render scheduling. |

## Environment Availability

| Dependency | Required by | Available | Observed version/state | Fallback |
|------------|-------------|-----------|------------------------|----------|
| Rust/Cargo | core, tests, harness | ✓ | `rustc 1.94.0`, `cargo 1.94.0`; project declares exact MSRV `1.77`. [VERIFIED: local command probe] [VERIFIED: frontend/src-tauri/Cargo.toml:1-9] | Also run an MSRV job/container before accepting new dependencies. [ASSUMED] |
| Node.js | frontend build and existing Node guards | ✓ | `v26.8.2`. [VERIFIED: local command probe] | CI-supported Node version should be recorded by the run/build manifest. [ASSUMED] |
| pnpm | locked frontend build | ✓ | `10.34.5`. [VERIFIED: local command probe] | Repository BUILDING guide requests frozen install; preserve lockfile. [VERIFIED: docs/BUILDING.md] |
| SQLite CLI | migration/debug inspection | ✓ | `3.51.0`. [VERIFIED: local command probe] | SQLx tests do not require CLI for normal execution. [ASSUMED] |
| ffmpeg | existing native recording/import workflows | ✓ | `8.1.2`. [VERIFIED: local command probe] | Packaged app bundles a sidecar; validate packaged path separately. [VERIFIED: frontend/src-tauri/tauri.conf.json:97-103] |
| macOS power tool | battery/power snapshots on current host | ✓ | `/usr/bin/pmset`; current probe reported AC power and battery present. [VERIFIED: local command probe] | On Windows/Linux use platform-specific collectors; unsupported collectors yield `unknown`, never pass. [ASSUMED] |
| Audio devices and local model files | physical matrix | Unverified | No recording/model scenario was run during research. [ASSUMED] | Planner must include a preflight that records missing model/device as an explicit blocked scenario. [ASSUMED] |
| Network blocking/proxy capture | PRIV-03 canary | Unverified | No standard project harness exists. [ASSUMED] | Choose a declared OS firewall/proxy method per reference machine and store its configuration in the scenario manifest. [ASSUMED] |

**Missing dependencies with no fallback:** declared primary reference machine/configuration and a network-blocking capture method; both are planning inputs for the final matrix, not blockers to implementing the earlier waves. [ASSUMED]

**Missing dependencies with fallback:** cross-platform battery collection can report `unknown` during early smoke, but that result fails BASE-04 for any platform/configuration being claimed. [ASSUMED]

## Security Domain

Security enforcement is exact `true`, ASVS level is exact `1`, and high findings block according to project config. [VERIFIED: .planning/config.json:47-49] OWASP’s current stable ASVS is version `5.0.0`; Phase 1 should reference versioned controls because identifiers changed from ASVS 4.x. [CITED: https://owasp.org/projects/asvs]

### Applicable ASVS 5.0 categories

| ASVS category | Applies | Phase 1 control |
|---------------|---------|-----------------|
| V1 Encoding and Sanitization | yes | Validate IPC strings/URLs/identifiers and encode any user-controlled value written to human-readable diagnostics. [CITED: https://owasp.org/projects/asvs] |
| V2 Validation and Business Logic | yes | Enforce lifecycle transitions, one terminal queue outcome, idempotent stop/recovery, and destination contract in Rust. [ASSUMED] |
| V3 Web Frontend Security | yes | Retain restrictive CSP and avoid remote web content; trust labels are display-only views of Rust-resolved state. [CITED: https://v2.tauri.app/security/capabilities/] |
| V4 API and Web Service | yes | Treat Tauri commands as privileged API surface; validate meeting/evidence IDs and authorize operations to current app state. [ASSUMED] |
| V5 File Handling | yes | Use Tauri-generated app-data paths, internally generated IDs, and explicit selected-file scopes; prevent traversal and broad renderer access. [CITED: https://cornucopia.owasp.org/taxonomy/asvs-5.0/05-file-handling/03-file-storage] |
| V6 Authentication | no | Single-user local desktop Phase 1 adds no authentication surface. [ASSUMED] |
| V7 Session Management | no | Meeting session lifecycle is domain state, not an authenticated web session. [ASSUMED] |
| V8 Authorization | limited | Capability scopes and Tauri command validation are the applicable local authorization boundary. [CITED: https://v2.tauri.app/security/capabilities/] |
| V11 Cryptography / V12 Secure Communication | yes for remote routes | Use existing TLS-capable Reqwest/provider endpoints; do not hand-roll crypto or silently downgrade HTTPS. LAN HTTP must be labeled plainly. [VERIFIED: frontend/src-tauri/src/summary/llm_client.rs:301-345] |
| V13 Configuration | yes | Effective endpoint allow/attribution, timeout/retry behavior, preserved provider choice, and no default-on hidden egress. [CITED: https://cornucopia.owasp.org/taxonomy/asvs-5.0/13-configuration/02-backend-communication-configuration] |
| V14 Data Protection | yes | Classify transcript/audio/run metadata as sensitive, keep raw artifacts local, redact diagnostics/exports, and document retention/deletion. [CITED: https://cornucopia.owasp.org/taxonomy/asvs-5.0/14-data-protection/01-data-protection-documentation] |
| V15 Secure Coding and Architecture | yes | Bounded resource allocation, safe concurrency, transactional state, supported Community Edition boundary. [CITED: https://owasp.org/projects/asvs] |
| V16 Security Logging and Error Handling | yes | Correlatable UTC + monotonic metadata, explicit typed errors, no credentials/transcript content by default, local documented sinks. [CITED: https://cornucopia.owasp.org/taxonomy/asvs-5.0/16-security-logging-and-error-handling/02-general-logging] |

### Known threat patterns

| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| Renderer invokes lifecycle/recovery with forged or stale IDs | Spoofing / Tampering | Rust validates ID existence/current state; SQLite foreign keys/unique constraints; idempotency. [ASSUMED] |
| Path traversal through meeting title or export path | Tampering | Generated UUID path component, Tauri path API, selected-directory scope, strict filename sanitation. Current title sanitizer replaces a fixed set but path authority should not depend on it. [VERIFIED: frontend/src-tauri/src/audio/audio_processing.rs:14-46] |
| Sensitive transcript/API key leakage in logs or bundles | Information disclosure | Structured allowlisted fields, redaction tests, content-free default export, no full paths/keys. Current logs include transcript text, so this needs an explicit remediation task. [VERIFIED: frontend/src-tauri/src/audio/transcription/worker.rs:167-173] |
| Custom endpoint/hostname misclassified as Local | Spoofing / Information disclosure | Parse URL, resolve effective destination, classify loopback/private/public, record route, fail on contract-changing resolution. [ASSUMED] |
| Queue/resource exhaustion | Denial of service | Bounded capacity, non-blocking capture seam, explicit rejection/gap, drain deadline, resource samples. [CITED: https://docs.rs/tokio/latest/tokio/sync/mpsc/fn.channel.html] |
| Duplicate or rewritten evidence after crash/retry | Tampering / Repudiation | Stable Rust evidence ID, unique constraints, transactional upsert, append-only run evidence, repeat-recovery tests. [ASSUMED] |
| Broad renderer filesystem capability | Elevation of privilege / Information disclosure | Remove exact current grants `"fs:read-all"` and `"fs:write-all"`; scope app data and user-selected files. [VERIFIED: frontend/src-tauri/tauri.conf.json:38-76] [CITED: https://v2.tauri.app/security/capabilities/] |
| Undisclosed startup updater traffic in local canary | Information disclosure / Repudiation | Explicit canary mode disables check-on-mount or records the attempt; updater remains a separate user-visible function. [VERIFIED: frontend/src/hooks/useUpdateCheck.ts:49-58] |

### Capability/CSP finding

The current main capability includes exact permissions `"fs:read-all"`, `"fs:write-all"`, updater, process, and an asset protocol scope of exact `"$APPDATA/**"`; CSP connect sources include exact `http://localhost:11434`, `http://localhost:5167`, `http://localhost:8178`, and `https://api.ollama.ai`. [VERIFIED: frontend/src-tauri/tauri.conf.json:25-78] This is wider than Phase 1 needs and should be reduced/tested as part of PRIV-03, with care not to break explicit file selection, recordings, models, or updater behavior. [ASSUMED]

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Proposed five-wave task decomposition and module/file layout. | Summary, Architecture, Safe Sequencing | Planner may need to merge/split tasks around actual ownership or compile dependencies. |
| A2 | Evidence UUID plus optional `(meeting_id, source_track, source_segment_key)` uniqueness is the best stable-key design. | Architecture Patterns | Incorrect source-key semantics could over-deduplicate corrected/finalized segments. |
| A3 | Legacy rows should conservatively represent unknown/incomplete completeness rather than `complete`. | Runtime State Inventory | Product may prefer a distinct legacy lifecycle/status; must be decided before migration ships. |
| A4 | OS power-state and battery delta plus CPU/memory is an adequate Phase 1 battery evidence method on the reference machine. | Standard Stack, Environment | Coarse readings may not satisfy BASE-04; a platform energy tool may be required. |
| A5 | Post-render frontend acknowledgement via a token is an acceptable “visible UI acknowledgement.” | Architecture, Code Examples | It measures renderer acknowledgement, not physical display presentation; naming must stay precise. |
| A6 | Route classification rules for loopback/private/public hosts and contract-changing DNS resolution. | Architecture, Security | VPN, mDNS, IPv6, proxies, or split DNS may need a richer policy. |
| A7 | Exact run-bundle filenames/schema and repeat statistics. | Run Bundle, Scenario Matrix | Planner can change serialization/layout, but must preserve D-01 through D-07. |
| A8 | Network canary uses OS firewall/proxy capture plus app attribution and a canary mode for unrelated background traffic. | Verification, Security | Platform tooling may require separate implementation/manual steps. |
| A9 | Proposed queue capacity/rejection reasons and non-blocking admission design. | Architecture, Code Examples | Capacity must be determined empirically; callback/channel topology may require a ring-buffer-specific seam. |

## Open Questions

1. **What is the declared primary reference machine?**
   - What we know: D-05 requires one and current research host is macOS `26.6.2`, with Rust/Cargo/Node/pnpm/ffmpeg/sqlite available. [VERIFIED: local command probe]
   - What is unclear: exact hardware, approved model/language/audio devices, AC versus battery protocol, and whether this host is the project’s reference machine. [ASSUMED]
   - Recommendation: make the first plan checkpoint record and approve the complete reference fingerprint before matrix execution. [ASSUMED]
2. **How should pre-Phase-1 historical meetings be labeled?**
   - What we know: existing schema lacks lifecycle/completeness/gap fields. [VERIFIED: frontend/src-tauri/migrations/20250916100000_initial_schema.sql:1-19]
   - What is unclear: whether to use `incomplete` + legacy reason or add a separate legacy/unknown state while preserving the locked minimum lifecycle. [ASSUMED]
   - Recommendation: never backfill `complete` solely from absence of errors; choose the explicit representation before the migration is finalized. [ASSUMED]
3. **What battery evidence is strong enough for BASE-04?**
   - What we know: current integration reports CPU/memory but not battery; `pmset` exists on the current host. [VERIFIED: frontend/src-tauri/src/whisper_engine/system_monitor.rs:8-16] [VERIFIED: local command probe]
   - What is unclear: precision, minimum scenario duration, AC/battery protocol, and Windows/Linux collectors. [ASSUMED]
   - Recommendation: define measurement uncertainty and allow `unknown` (which fails a claimed gate) instead of deriving energy from CPU percentage. [ASSUMED]
4. **What finalization deadline and queue capacity should be used?**
   - What we know: current exact timeouts are 600 seconds in Rust and 60 seconds in React, neither derived from real backlog evidence. [VERIFIED: frontend/src-tauri/src/audio/recording_commands.rs:789-804] [VERIFIED: frontend/src/hooks/useRecordingStop.ts:152-155]
   - What is unclear: acceptable stop UX and target-hardware throughput. [ASSUMED]
   - Recommendation: implement configurable recorded values, choose initial conservative experimental settings, then lock thresholds from repeated baseline evidence rather than calling the current values standards. [ASSUMED]
5. **How will the network-blocked canary observe attempts on each OS?**
   - What we know: updater and optional analytics are current egress sources beyond provider calls. [VERIFIED: frontend/src/hooks/useUpdateCheck.ts:49-58] [VERIFIED: frontend/src-tauri/src/analytics/analytics.rs:44-50]
   - What is unclear: approved firewall/proxy tooling and whether CI can exercise it. [ASSUMED]
   - Recommendation: define one authoritative method on the reference machine and smaller manual smoke procedures on other claimed platforms. [ASSUMED]

## Sources

### Primary — repository and locked project sources (HIGH confidence)

- `.planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-CONTEXT.md` — locked measurement, identity, lifecycle, recovery, and trust decisions.
- `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` — normative requirement text, exit gates, non-goals, verification, stop conditions.
- `AGENTS.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/BUILDING.md`, `README.md`, `backend/README.md` — supported Community Edition architecture and development boundary.
- `frontend/src-tauri/src/audio/{pipeline.rs,recording_manager.rs,recording_commands.rs,recording_saver.rs,transcription/worker.rs,transcription/engine.rs}` — current capture, queue, stop, status, evidence, and fallback behavior.
- `frontend/src-tauri/src/database/{manager.rs,models.rs,repositories/transcript.rs}` and `frontend/src-tauri/migrations/` — current durable schema, transactions, IDs, and migration mechanism.
- `frontend/src/{contexts/TranscriptContext.tsx,hooks/useRecordingStop.ts,hooks/useTranscriptRecovery.ts,services/indexedDBService.ts}` — current renderer identity, completion inference, cache, and recovery behavior.
- `frontend/src-tauri/src/summary/llm_client.rs`, `frontend/src/components/AnalyticsProvider.tsx`, `frontend/src/hooks/useUpdateCheck.ts`, and `frontend/src-tauri/tauri.conf.json` — current provider routes and background egress/capability surface.
- `/Users/nrentas/.codex/skills/meetily-development/references/community-repo.md` — Community Edition conventions and product/API boundary.

### Official documentation (MEDIUM confidence)

- [Tokio bounded MPSC](https://docs.rs/tokio/latest/tokio/sync/mpsc/fn.channel.html) and [MPSC module shutdown semantics](https://docs.rs/tokio/latest/tokio/sync/mpsc/) — capacity, backpressure, close, drain.
- [Tokio-util cancellation](https://docs.rs/tokio-util/latest/tokio_util/sync/index.html) — existing cancellation primitive.
- [Rust `Instant`](https://doc.rust-lang.org/std/time/struct.Instant.html) — monotonic elapsed-time semantics and caveats.
- [SQLx embedded migrations](https://docs.rs/sqlx/0.8.6/sqlx/macro.migrate.html) and [transactions](https://docs.rs/sqlx/0.8.6/sqlx/struct.Transaction.html) — migration embedding/rebuild and transactional behavior.
- [SQLite UPSERT](https://www.sqlite.org/lang_upsert.html) — native `ON CONFLICT` behavior.
- [Tauri IPC](https://v2.tauri.app/concept/inter-process-communication/), [capabilities](https://v2.tauri.app/security/capabilities/), and [filesystem scopes](https://v2.tauri.app/reference/javascript/fs/) — command/event roles and least privilege.
- [OWASP ASVS](https://owasp.org/projects/asvs), [file storage](https://cornucopia.owasp.org/taxonomy/asvs-5.0/05-file-handling/03-file-storage), [configuration](https://cornucopia.owasp.org/taxonomy/asvs-5.0/13-configuration/02-backend-communication-configuration), [data protection](https://cornucopia.owasp.org/taxonomy/asvs-5.0/14-data-protection/01-data-protection-documentation), and [logging](https://cornucopia.owasp.org/taxonomy/asvs-5.0/16-security-logging-and-error-handling/02-general-logging) — applicable security controls.

### Tertiary (LOW confidence)

- None. All LOW-confidence claims are explicitly tagged `[ASSUMED]` and collected in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions and availability were read from lockfiles/manifests or probed locally; no new packages are proposed.
- Current architecture and defects: HIGH — each claim is tied to source-of-truth code opened during this research.
- Recommended architecture: MEDIUM — grounded in official Tokio/SQLx/Tauri semantics and locked project decisions, but exact module/schema design remains implementation discretion.
- Pitfalls: HIGH for observed failure modes; MEDIUM for the recommended remedy details.
- Environment and thresholds: LOW until the project declares a reference machine, exact model/language/device matrix, battery protocol, queue capacity, and finalization deadline.

**Research date:** 2026-09-20

**Valid until:** 2026-10-20 for stable repository findings; re-check official dependency/security docs and the live branch immediately before planning if the checkout changes.
