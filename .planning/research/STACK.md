# Technology Stack

**Project:** Telu
**Milestone:** Brownfield validation of a Meetily Community Edition fork
**Researched:** 2026-09-20
**Checkout inspected:** `0e36d8835ad9e81f356412954a39f4771139aa2a`
**Overall confidence:** MEDIUM — recommendations combine direct inspection of one local revision with current official documentation; runtime behavior and target-hardware performance are not yet benchmarked.

## Recommendation in One Sentence

Keep the repository-pinned Tauri/Rust/Next.js/React/SQLite application, build Telu's knowledge and evaluation features as Rust services plus SQLx migrations exposed through Tauri commands/events, and use the Tokio, cancellation, tracing, serialization, resource-monitoring, and HTTP primitives already present; add parsers and frontend test packages only in the phases that exercise them.

## Existing Stack to Preserve

The versions below are the versions resolved by the checked-in lockfiles, not merely the wider ranges in the manifests. Preserve these during the validation milestone so that feature work is not confounded with an ecosystem upgrade.

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

Telu is a **Community Edition code fork**. The supported extension surface is the local Tauri application under `frontend/`, with native code under `frontend/src-tauri/`. The Pro Agent API is a separate product surface for clients of a running Pro desktop app; it is not the internal backend for this fork, and its gateway implementation must not be inferred from the public repository.

The archived `backend/` FastAPI/Docker code is migration history only. Do not add endpoints, dependencies, or new product behavior there.

## Minimal Additions by Capability

### 1. Baseline Instrumentation

**Add no telemetry platform.** Define a small Rust measurement model and persist locally:

- one correlation ID per recording/meeting and one generation ID per live-assistance attempt;
- monotonic `std::time::Instant` durations for capture-to-segment, segment-to-transcript, transcript queue age, context selection, provider generation, IPC emission, and visible acknowledgement;
- UTC timestamps only for cross-record correlation, never for calculating elapsed time;
- queue depth/capacity, dropped/coalesced/stale counters, cancellation reason, model/provider, resource samples, and app/build/platform metadata;
- a local SQLite `evaluation_runs`/`stage_measurements` design or an explicitly exported sanitized JSONL file for experiments.

The repository already has audio batching metrics, `sysinfo`, `tracing`, and extensive `log` calls. Promote the already-resolved `tracing-subscriber` 0.3 line from development-only to a normal dependency only when structured span output is wired; avoid OpenTelemetry, Prometheus, Sentry, or another remote collector in the validation milestone. The existing PostHog integration is opt-in and disabled by default; never send transcript text, document text, evidence snippets, meeting titles, file paths, suggestion contents, or stable meeting/series IDs through it.

**Repository-aligned corrective work:** the checkout currently grants `fs:read-all` and `fs:write-all`. Tauri's official capability model is designed for fine-grained scopes. Before document ingestion ships, replace broad filesystem grants with user-selected file access and narrow app-data scopes.

### 2. Structured Meeting Knowledge

Use SQLx migrations and normalized SQLite tables, not JSON blobs as the source of truth. A minimal model should separate:

- `meetings` and pre-created meeting identity;
- `knowledge_items` with kind (`decision`, `commitment`, `action_item`, `open_question`, `fact`), normalized text, lifecycle status, timestamps, and extraction metadata;
- `evidence_spans` referencing a transcript row plus recording-relative start/end times, or a document/version plus page/section/paragraph locator;
- `knowledge_revisions` or explicit supersession links;
- user decisions (`accepted`, `corrected`, `rejected`) and the actor/time of the decision;
- provider run metadata separately from the accepted domain record.

Use Rust enums/structs plus Serde for provider output and explicit domain validation for required evidence, allowed transitions, non-empty normalized text, and meeting/series scope. Keep raw model output only as a bounded diagnostic artifact with a retention policy. Do not add an ORM, graph database, event-store framework, `schemars`, or a JSON-schema validator until repeated schema drift shows that hand-maintained typed DTOs are insufficient.

### 3. Bounded Document Ingestion

Start with pasted context and UTF-8 `.txt`/`.md`; this requires no parser dependency and is enough to validate ownership, versioning, deletion, evidence display, context budgets, and briefing usefulness.

When binary formats become part of an accepted phase:

| Addition | Version policy | Purpose | Gate before adoption | Confidence |
|----------|----------------|---------|----------------------|------------|
| `pdf-extract` | Candidate 0.12.1, verified in current official docs | Local PDF text extraction by page, giving a useful page-level evidence locator | Pass a Telu golden corpus across macOS/Windows/Linux; detect scanned/image-only PDFs; verify declared Rust 1.77 compatibility; enforce file/page/byte/time limits. | MEDIUM |
| `zip` + `quick-xml` | Reuse repository-compatible lines (`zip` 2.2 manifest line, resolved 2.4.2; `quick-xml` 0.37 line, resolved 0.37.5) | Narrow DOCX extraction from OOXML parts without a sidecar | Parse only an explicit subset (body paragraphs, headings, tables, footnotes if required); preserve part and paragraph/table locators; reject zip bombs and unsupported/encrypted packages. | MEDIUM |

Do **not** adopt current `docx-rs` by default: its current project documentation lists Rust 1.88 for development while this workspace declares 1.77, and its broad document model is more than Telu needs for bounded extraction. Re-evaluate it if full-fidelity DOCX semantics become a requirement.

Every document import should copy or normalize content into app-owned storage, record a content hash and parser version, preserve source metadata without relying on the original path, cap bytes/pages/extracted characters, and delete the document, extracted units, FTS rows, and derived claims transactionally. No OCR, browser upload, Java/Python sidecar, or cloud parser belongs in the baseline.

### 4. Evidence-Aware Context Selection

Use deterministic, bounded direct context first:

1. Filter by current meeting/series and lifecycle status.
2. Include accepted decisions, unresolved questions, active commitments, and user-selected current document versions.
3. Rank with explicit recency, status, source type, lexical overlap, and user pinning rules.
4. Apply per-source and total character/item budgets.
5. Carry stable evidence IDs into the prompt and require returned claims to reference only supplied IDs.
6. Validate returned evidence IDs and discard claims whose evidence is missing or out of scope.

Plain indexed SQL is sufficient for the earliest bounded corpus. SQLite FTS5 is the first retrieval addition once corpus tests show that scans are inadequate. Before enabling it, run a startup/build capability probe because FTS5 availability depends on how SQLite is compiled. Use FTS5 `bm25()`/`rank` only as a candidate generator; lifecycle status, chronology, scope, and evidence validity remain application-level filters.

Do not add embeddings, a vector database, a reranking service, LangChain/LlamaIndex, or an agent framework by default. Add embeddings only after a versioned evaluation set demonstrates that lexical/direct selection misses useful evidence at the accepted corpus size and that the improvement outweighs model storage, migration, deletion, and cross-platform cost.

### 5. Cancellable Live Assistance

The checkout's audio pipeline, recording path, and transcription worker currently contain multiple `tokio::sync::mpsc::unbounded_channel` instances, and transcription is serialized through one worker. This is evidence for the baseline risk, not permission to block the audio callback.

Use the existing Tokio stack as follows:

- leave raw capture/recording behavior unchanged until it is measured; CPAL callbacks must not await and the durable recording path has different loss requirements from suggestions;
- instrument current transcription queue age and backlog first;
- make the **post-transcript suggestion pipeline** bounded, normally one latest work item plus a very small pending capacity;
- coalesce transcript increments, cancel the previous generation on topic/version change, and reject results whose meeting ID, generation ID, transcript watermark, or deadline no longer matches;
- use `CancellationToken`, `tokio::select!`, `tokio::time::timeout`, and existing Reqwest cancellation-on-drop behavior;
- cap concurrent provider generations at one per meeting and cap visible suggestions at one or two;
- record `shown`, `suppressed`, `cancelled`, `stale`, `duplicate`, and `silence` outcomes.

If the transcription queue itself must later be bounded, design that separately with an explicit overflow/spill/coalescing policy and tests for recording integrity. A generic queue framework is not justified.

### 6. Series Memory

Keep series memory relational in SQLite:

- `meeting_series` and `series_meetings` with an explicit ordering/date;
- stable knowledge IDs and revision/supersession relations;
- status values such as current, superseded, disputed, unresolved, and rejected;
- evidence joins back to the exact meeting/transcript/document version;
- transactional updates so correction, supersession, and deletion cannot leave dangling current facts.

Do not model memory as a single generated summary, an append-only prompt, or a vector collection. A generated series briefing is a derived view that can be rebuilt from accepted records.

### 7. Product Evaluation

Use a local, versioned evaluation corpus and ordinary repository tests before adding an evaluation SaaS:

- Rust unit tests for validation, status transitions, evidence resolution, ranking, staleness, deduplication, and cancellation;
- SQLx repository tests against temporary SQLite databases and migration upgrade tests from representative older schemas;
- replay tests that feed timestamped transcript increments into the suggestion policy without live recording;
- golden document fixtures for extraction/page/paragraph locators and deletion;
- Criterion only for isolated deterministic hot paths;
- target-hardware scenario runs for end-to-end latency, CPU, memory, battery proxy, queue age, and recovery;
- human review labels for usefulness, distraction, source correctness, duplication, and appropriate silence.

The frontend currently has no declared Jest/Vitest/Playwright harness. When evidence correction and trust UX begins, add the Next.js 14-aligned `next/jest`, `jest-environment-jsdom`, React Testing Library, and `@testing-library/jest-dom` development packages. Add Playwright only when a concrete static-webview flow needs browser-level testing; it does not replace packaged Tauri tests or platform permission checks.

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

No production dependency installation is required for baseline queue/resource instrumentation, structured knowledge, direct context selection, cancellation, series memory, or the evaluation data model.

```bash
# Baseline: use the lockfiles exactly as checked in.
pnpm --dir frontend install --frozen-lockfile

# Optional when structured tracing output is implemented:
# move tracing-subscriber from dev-dependencies to dependencies,
# preserving the repository-resolved 0.3 line.

# Document phase only, after golden-corpus and Rust 1.77 compatibility checks:
cargo add --manifest-path frontend/src-tauri/Cargo.toml pdf-extract@0.12.1
cargo add --manifest-path frontend/src-tauri/Cargo.toml zip@2.2 quick-xml@0.37

# Trust-UX phase only; use the versions resolved into pnpm-lock.yaml at that time:
pnpm --dir frontend add -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom
```

Before accepting any dependency change, run the target project's normal checks under the declared MSRV and all supported desktop targets. Do not copy version numbers from a globally installed toolchain into manifests.

## Immediate Repository Alignment Work

These are stack prerequisites for trustworthy benchmarking rather than new product frameworks:

1. Record a reproducible toolchain for the baseline. The checkout declares Rust 1.77 but does not pin a Rust toolchain, Node version, pnpm version, or `packageManager` field.
2. Resolve the workspace warning that the `[patch.crates-io]` section in `frontend/src-tauri/Cargo.toml` is ignored because patches must be declared at the workspace root. Otherwise the intended CPAL fork may not be active during benchmarking.
3. Confirm what SQLite library/version is packaged on every target before relying on WAL concurrency or FTS5. Current SQLite documentation reports a WAL-reset corruption bug fixed in SQLite 3.51.3 and selected backports; do not assume the bundled version from the SQLx crate version alone.
4. Replace broad Tauri filesystem capabilities before exposing document selection.
5. Commit-pin the accepted Meetily baseline after end-to-end measurements; the current commit is only the inspected research snapshot.
6. Treat remote providers as explicit data egress. Store which evidence units were sent, but not secrets or full sensitive payloads in logs.

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

