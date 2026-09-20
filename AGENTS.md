<!-- GSD:project-start source:PROJECT.md -->

## Project

**Telu**

Telu is a local-first, context-aware desktop companion for people whose work unfolds across recurring conversations. It helps a user prepare for a meeting, surfaces a small number of timely and evidence-backed facts or questions while the conversation is still actionable, and carries reliable decisions, commitments, open questions, and verified facts into the next meeting.

Telu is a substantial product fork of the open-source Meetily desktop application, not a transcription add-on. It retains Meetily's native capture, transcription, persistence, desktop, and model-provider foundations while adding structured knowledge, document context, trustworthy live assistance, and meeting-series memory.

**Core Value:** Telu surfaces the right evidence-backed context at the moment it is useful—and stays silent when an intervention would not add more value than distraction.

### Constraints

- **Architecture**: Extend the active Tauri/Rust core and Next.js/React desktop interface; do not reintroduce the archived Python/FastAPI backend as a supported dependency.
- **Privacy**: Keep capture, transcription, persistence, and memory local by default; disclose and configure every remote provider or destination.
- **Evidence**: Every extracted item, briefing claim, live suggestion, and carried-forward fact must retain source attribution suitable for user inspection.
- **Latency**: Judge live assistance by end-to-end spoken-phrase-to-visible-suggestion latency, including segmentation, queues, retrieval, generation, cancellation, and rendering.
- **Intervention quality**: Prefer a few high-confidence interventions and deliberate silence over frequent or weak suggestions.
- **Data lifecycle**: Document versions, ownership, deletion, meeting identity, series membership, chronology, and supersession must remain consistent across preparation, recording, recovery, and analysis.
- **Platform behavior**: Preserve native microphone/system-audio permissions, device handling, recovery, and resource constraints across supported desktop platforms.
- **Scope discipline**: Validate direct bounded context before introducing embeddings, vector infrastructure, or broad autonomous memory behavior.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Recommendation in One Sentence

## Existing Stack to Preserve

### Core Framework

| Technology | Resolved version | Purpose | Recommendation | Confidence |
|------------|------------------|---------|----------------|------------|
| Tauri Rust crate / CLI | 2.11.1 / 2.11.1 | Desktop shell, native lifecycle, packaging, IPC | Keep. Add Telu behavior through Rust services and Tauri commands/events. Do not add a web backend. | MEDIUM |
| `@tauri-apps/api` | 2.11.0 | Frontend-to-core IPC and events | Keep. Commands are for typed request/response operations; events are for one-way lifecycle/progress updates. | MEDIUM |
| Next.js | 14.2.35 | Statically exported frontend | Keep during validation. The repository's `output: 'export'` is aligned with an embedded desktop UI. | MEDIUM |
| React / React DOM | 18.3.1 | Desktop UI | Keep; do not mix a React upgrade into knowledge or latency validation. | MEDIUM |
| TypeScript | 5.9.3 | Frontend types | Keep the lockfile resolution. Use generated/shared DTO discipline at the IPC boundary rather than adding a second API client stack. | MEDIUM |
| Rust edition / declared MSRV | Edition 2021 / Rust 1.77 | Native application code | Preserve the declared MSRV until the project deliberately changes it. Any new crate must pass an MSRV check, not only the developer machine's current Rust 1.94 toolchain. | MEDIUM |

### Data, Async, and Native Processing

| Technology | Resolved version | Purpose | Recommendation | Confidence |
|------------|------------------|---------|----------------|------------|
| SQLite via SQLx | SQLx 0.8.6, `sqlx-sqlite` 0.8.6 | Local persistence and embedded migrations | Keep as the single canonical store for meetings, evidence, documents, series memory, evaluation runs, and user corrections. | MEDIUM |
| Tokio | 1.52.3 | Async runtime, tasks, channels, timeouts | Keep. Use bounded `mpsc` channels for Telu's post-transcript live-assistance stages. | MEDIUM |
| `tokio-util` | 0.7.18 | Async utilities | Keep and use `CancellationToken`; no new cancellation library is needed. | MEDIUM |
| Serde / `serde_json` | 1.0.228 / 1.0.149 | Typed DTOs and provider payloads | Keep. Structured meeting output should deserialize into explicit Rust DTOs and then pass domain validation before persistence. | MEDIUM |
| UUID / Chrono | 1.23.1 / 0.4.44 | Stable identity and UTC chronology | Keep. Meeting identity must be created before recording and reused through preparation, live work, recovery, and analysis. | MEDIUM |
| `tracing` | 0.1.44 | Structured async diagnostics | Keep. Use spans around discrete pipeline stages and redact content-bearing fields. | MEDIUM |
| `sysinfo` | 0.32.1 | CPU/memory/resource measurement | Keep for baseline sampling. Do not add a host metrics agent. | MEDIUM |
| Reqwest | 0.11.27 | Existing provider HTTP calls | Keep for explicitly selected remote model providers. Attach cancellation/deadline behavior at the service boundary. | MEDIUM |
| Criterion | 0.5.1, development dependency | Microbenchmarks | Keep for deterministic hot-path benchmarks, but do not mistake a microbenchmark for end-to-end product latency. | MEDIUM |
| Whisper / ONNX paths | `whisper-rs` 0.13.2; `ort` 2.0.0-rc.10 | Existing local transcription | Preserve and benchmark. Do not replace the transcription stack during the first Telu milestone. | MEDIUM |

### Supported Product Surface

## Minimal Additions by Capability

### 1. Baseline Instrumentation

- one correlation ID per recording/meeting and one generation ID per live-assistance attempt;
- monotonic `std::time::Instant` durations for capture-to-segment, segment-to-transcript, transcript queue age, context selection, provider generation, IPC emission, and visible acknowledgement;
- UTC timestamps only for cross-record correlation, never for calculating elapsed time;
- queue depth/capacity, dropped/coalesced/stale counters, cancellation reason, model/provider, resource samples, and app/build/platform metadata;
- a local SQLite `evaluation_runs`/`stage_measurements` design or an explicitly exported sanitized JSONL file for experiments.

### 2. Structured Meeting Knowledge

- `meetings` and pre-created meeting identity;
- `knowledge_items` with kind (`decision`, `commitment`, `action_item`, `open_question`, `fact`), normalized text, lifecycle status, timestamps, and extraction metadata;
- `evidence_spans` referencing a transcript row plus recording-relative start/end times, or a document/version plus page/section/paragraph locator;
- `knowledge_revisions` or explicit supersession links;
- user decisions (`accepted`, `corrected`, `rejected`) and the actor/time of the decision;
- provider run metadata separately from the accepted domain record.

### 3. Bounded Document Ingestion

| Addition | Version policy | Purpose | Gate before adoption | Confidence |
|----------|----------------|---------|----------------------|------------|
| `pdf-extract` | Candidate 0.12.1, verified in current official docs | Local PDF text extraction by page, giving a useful page-level evidence locator | Pass a Telu golden corpus across macOS/Windows/Linux; detect scanned/image-only PDFs; verify declared Rust 1.77 compatibility; enforce file/page/byte/time limits. | MEDIUM |
| `zip` + `quick-xml` | Reuse repository-compatible lines (`zip` 2.2 manifest line, resolved 2.4.2; `quick-xml` 0.37 line, resolved 0.37.5) | Narrow DOCX extraction from OOXML parts without a sidecar | Parse only an explicit subset (body paragraphs, headings, tables, footnotes if required); preserve part and paragraph/table locators; reject zip bombs and unsupported/encrypted packages. | MEDIUM |

### 4. Evidence-Aware Context Selection

### 5. Cancellable Live Assistance

- leave raw capture/recording behavior unchanged until it is measured; CPAL callbacks must not await and the durable recording path has different loss requirements from suggestions;
- instrument current transcription queue age and backlog first;
- make the **post-transcript suggestion pipeline** bounded, normally one latest work item plus a very small pending capacity;
- coalesce transcript increments, cancel the previous generation on topic/version change, and reject results whose meeting ID, generation ID, transcript watermark, or deadline no longer matches;
- use `CancellationToken`, `tokio::select!`, `tokio::time::timeout`, and existing Reqwest cancellation-on-drop behavior;
- cap concurrent provider generations at one per meeting and cap visible suggestions at one or two;
- record `shown`, `suppressed`, `cancelled`, `stale`, `duplicate`, and `silence` outcomes.

### 6. Series Memory

- `meeting_series` and `series_meetings` with an explicit ordering/date;
- stable knowledge IDs and revision/supersession relations;
- status values such as current, superseded, disputed, unresolved, and rejected;
- evidence joins back to the exact meeting/transcript/document version;
- transactional updates so correction, supersession, and deletion cannot leave dangling current facts.

### 7. Product Evaluation

- Rust unit tests for validation, status transitions, evidence resolution, ranking, staleness, deduplication, and cancellation;
- SQLx repository tests against temporary SQLite databases and migration upgrade tests from representative older schemas;
- replay tests that feed timestamped transcript increments into the suggestion policy without live recording;
- golden document fixtures for extraction/page/paragraph locators and deletion;
- Criterion only for isolated deterministic hot paths;
- target-hardware scenario runs for end-to-end latency, CPU, memory, battery proxy, queue age, and recovery;
- human review labels for usefulness, distraction, source correctness, duplication, and appropriate silence.

## Infrastructure and Privacy Boundaries

| Boundary | Prescriptive choice | Why |
|----------|---------------------|-----|
| Storage | Tauri app-data directory + SQLite + app-owned document files | Cross-platform, local-first, already established in the repository |
| IPC | Tauri commands for operations/results; events for progress and state changes | Matches Community Edition and official Tauri semantics |
| Network | Existing provider clients only, behind explicit provider selection and a visible context manifest | Users must know exactly what leaves the machine |
| Telemetry | Local by default; sanitized opt-in export/analytics only | Meeting and document contents are sensitive |
| File access | Dialog-selected files and narrow capability scopes | The current broad `read-all`/`write-all` grants are not appropriate for Telu's trust model |
| Parsing | In-process Rust with strict resource limits | Avoids a second runtime, daemon, cloud upload, and packaging divergence |
| Platform validation | macOS, Windows, and Linux packaged-app checks | Audio, permissions, paths, WebViews, models, and native libraries differ materially |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Now |
|----------|-------------|-------------|-------------|
| Application backend | Existing Rust/Tauri core | Archived FastAPI backend | Unsupported architecture; adds a runtime, service lifecycle, CORS/security surface, and packaging burden |
| Meetily integration | Community source extension | Pro Agent API | The Agent API is a separate Pro client surface, not the fork's internal backend |
| Knowledge store | Existing SQLite/SQLx | Postgres, graph DB, event store | Local single-user workload does not justify a server or new persistence model |
| Retrieval | Bounded SQL/direct context, then optional FTS5 | External vector database | Premature operational, privacy, deletion, migration, and evaluation complexity |
| Cancellation/backpressure | Tokio bounded channels + `CancellationToken` | Redis/NATS/queue framework | All work is local and process-scoped; existing primitives are sufficient |
| Observability | Local typed measurements + tracing | OpenTelemetry/hosted APM | Adds export/configuration risk before metrics and privacy rules stabilize |
| Document parsing | Pasted text first; phase-gated Rust parsers | Python/Java/Tika/cloud service | Breaks the self-contained desktop model and complicates cross-platform distribution |
| Structured LLM output | Serde DTOs + domain validation | AI orchestration/schema framework | Adds abstraction before the provider contract and failure modes are understood |
| Frontend unit tests | `next/jest` + Testing Library when trust UI begins | Immediate broad Playwright suite | Browser E2E does not cover native capture/permissions and is not needed for baseline instrumentation |

## Phase-Aware Installation

# Baseline: use the lockfiles exactly as checked in.

# Optional when structured tracing output is implemented:

# move tracing-subscriber from dev-dependencies to dependencies,

# preserving the repository-resolved 0.3 line.

# Document phase only, after golden-corpus and Rust 1.77 compatibility checks:

# Trust-UX phase only; use the versions resolved into pnpm-lock.yaml at that time:

## Immediate Repository Alignment Work

## Sources

### Local primary sources

- `frontend/package.json` and `frontend/pnpm-lock.yaml` — resolved Next.js, React, Tauri JS, TypeScript, and UI dependencies.
- `frontend/src-tauri/Cargo.toml` and root `Cargo.lock` — Rust dependencies, declared MSRV, target features, and exact resolutions.
- `frontend/src-tauri/src/audio/pipeline.rs`, `audio/recording_manager.rs`, and `audio/transcription/worker.rs` — live segmentation, unbounded channels, and serialized transcription worker.
- `frontend/src-tauri/src/database/manager.rs`, `database/models.rs`, and `frontend/src-tauri/migrations/` — SQLite/SQLx conventions and existing schema.
- `frontend/src-tauri/tauri.conf.json` — static export, capabilities, CSP, bundle targets, and current filesystem permissions.
- `CLAUDE.md` and the Meetily Community reference — supported Community Edition architecture and archived backend boundary.

### Current official documentation

- [Tauri 2 IPC: commands and events](https://v2.tauri.app/concept/inter-process-communication/)
- [Tauri 2 capabilities](https://v2.tauri.app/security/capabilities/)
- [Tauri filesystem scopes](https://v2.tauri.app/reference/javascript/fs/)
- [Tokio bounded `mpsc::channel`](https://docs.rs/tokio/latest/tokio/sync/mpsc/fn.channel.html)
- [`tokio-util` cancellation primitives](https://docs.rs/tokio-util/latest/tokio_util/sync/index.html)
- [Rust `Instant`](https://doc.rust-lang.org/std/time/struct.Instant.html)
- [`tracing` structured spans](https://docs.rs/tracing/latest/tracing/span/index.html)
- [SQLx embedded migrations](https://docs.rs/sqlx/latest/sqlx/macro.migrate.html)
- [SQLx transactions](https://docs.rs/sqlx/latest/sqlx/struct.Transaction.html)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
- [SQLite WAL](https://www.sqlite.org/wal.html)
- [`pdf-extract` 0.12.1 docs](https://docs.rs/pdf-extract/latest/pdf_extract/)
- [`pdf-extract` official repository](https://github.com/jrmuizel/pdf-extract)
- [`docx-rs` official repository and current requirements](https://github.com/bokuweb/docx-rs)
- [Next.js 14 Jest and React Testing Library guidance](https://nextjs.org/docs/14/pages/building-your-application/testing/jest)
- [Meetily Community legacy-backend status](https://github.com/Zackriya-Solutions/meetily/blob/main/backend/SCRIPTS_DOCUMENTATION.md)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Existing versions and local architecture | MEDIUM | Directly inspected lockfiles and source at one commit; runtime and other target platforms are unverified. |
| Tokio/SQLite/Tauri patterns | MEDIUM | Current official docs agree with local patterns; behavior still requires packaged-app validation. |
| Document parser choices | MEDIUM | APIs and current project requirements are documented; extraction quality and MSRV compatibility require a Telu corpus spike. |
| Retrieval recommendation | MEDIUM | Strong fit for the stated bounded corpus, but the threshold for FTS/embeddings must come from evaluation data. |
| Evaluation tooling | MEDIUM | Uses established repository and framework facilities; product-quality thresholds remain a project decision. |
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `$gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `$gsd-debug` for investigation and bug fixing
- `$gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `$gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
