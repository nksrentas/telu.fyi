# Phase 1: Baseline Observability, Identity, and Trust Boundaries - Context

**Gathered:** 2026-09-20
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase makes the retained Meetily Community Edition foundation measurable and trustworthy before Telu adds product intelligence. It delivers reproducible local baseline runs; end-to-end timing, queue, resource, stop, and error evidence; one Rust-owned meeting identity; incremental final-transcript persistence; idempotent recovery with visible capture gaps; and explicit Local, LAN, or Remote provider boundaries. It does not deliver structured knowledge extraction, document ingestion, live suggestions, or series memory.

</domain>

<decisions>
## Implementation Decisions

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
- **D-22 (2026-09-26 scope revision):** Phase 2 readiness is decided only from canonical identity, durable final-transcript evidence, recovery reconciliation, capture completeness, and privacy-route enforcement. The full D-05/D-06/D-21 physical matrix remains required for Phase 4 live readiness, but it does not block Phase 2. Existing automated and packaged evidence is reused; at most one short packaged smoke is added when a prerequisite cannot otherwise be proven.

### the agent's Discretion
- Exact Rust type names, SQLite migration layout, telemetry serialization format, and module boundaries, provided the contracts above remain testable and the Rust core stays authoritative.
- Exact visual placement and copy of the compact provider labels, completeness state, and diagnostics affordance, provided users can see the boundary before data-bearing work and can inspect incomplete/recovered state afterward.
- The number of warm-up and repeat runs used by the initial harness, provided the run count is recorded and thresholds are not chosen from a single favorable run.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Telu Product Intent and Phase Contract
- `.planning/PROJECT.md` — Product value, local-first constraints, evidence requirements, and decisions carried into the phase.
- `.planning/REQUIREMENTS.md` — Normative Phase 1 requirements BASE-02 through BASE-05, IDENT-01 through IDENT-03, and PRIV-01 through PRIV-03. BASE-01 and BASE-06 remain milestone requirements assigned to Phase 4.
- `.planning/ROADMAP.md` — Phase 1 goal, non-goals, success criteria, verification approach, exit gates, and stop conditions.
- `docs/telu/README.md` — Telu's before/during/after product model and calm, evidence-aware behavior.
- `docs/telu/idea-verification.md` — Product and technical risk analysis, especially transcript freshness and validation-gated live assistance.

### Meetily Community Edition Architecture
- `README.md` — Supported Community Edition product surface and local-first positioning.
- `docs/architecture.md` — Existing desktop architecture and responsibility boundaries.
- `docs/BUILDING.md` — Supported development and build workflow for reproducible baseline runs.
- `frontend/src-tauri/src/audio/transcription/worker.rs` — Current single-worker transcription flow, unbounded work channel, counters, final/partial events, and completion behavior.
- `frontend/src-tauri/src/audio/recording_manager.rs` — Rust recording orchestration and current audio/transcription/save channels.
- `frontend/src-tauri/src/audio/recording_commands.rs` — Recording lifecycle commands and the current placeholder transcription status surface.
- `frontend/src-tauri/src/database/repositories/transcript.rs` — Current stop-time meeting creation and non-idempotent random transcript identifiers that Phase 1 must replace safely.
- `frontend/src/hooks/useRecordingStop.ts` — Current timeout/poll/delay/final-save sequence and visible finalization behavior.
- `frontend/src/contexts/TranscriptContext.tsx` — Current frontend buffering, sequence deduplication, and IndexedDB recovery handoff.

### Source Boundary
- `backend/README.md` — Historical Python/FastAPI backend documentation; reference only to avoid reintroducing it into the supported architecture.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src-tauri/src/audio/diagnostics.rs` and `audio/batch_processor.rs`: existing diagnostics and batched audio metrics can seed the local run bundle, but they do not yet provide the full stage/queue contract.
- `frontend/src-tauri/src/audio/recording_state.rs`: existing recording/error state and recoverable-error counters are natural inputs to explicit lifecycle and completeness reporting.
- `frontend/src/services/indexedDBService.ts`: existing crash-recovery staging can be keyed by the Rust-owned meeting identifier and retained as a recovery cache rather than a second source of identity.
- `frontend/src-tauri/src/database/repositories/meeting.rs`: current transactional meeting operations can host reconciliation and lifecycle updates.
- `frontend/src/services/transcriptService.ts`: the existing Tauri command/event wrapper is the frontend integration point for real queue/finalization status.

### Established Patterns
- Rust owns native capture, transcription engines, persistence commands, and orchestration; React consumes Tauri commands/events and renders state.
- SQLite is the durable product store, while IndexedDB/session storage currently bridge in-progress recovery.
- Transcript updates carry recording-relative audio bounds and a sequence identifier, but the current global sequence and randomly generated database identifiers are not yet a durable evidence contract.
- The active transcription path uses a single worker for ordered emission and unbounded Tokio channels. Current queue counters are local to the worker task and the public status command reports a placeholder zero depth.
- The current stop flow polls that placeholder status, uses fixed quiet/delay windows, and creates the SQLite meeting only after stop, so it cannot yet prove completeness, stable identity, or idempotent incremental persistence.

### Integration Points
- Allocate and persist the canonical meeting identity at the Rust recording/preparation boundary before `RecordingManager` accepts audio, then return it to React for all subsequent calls.
- Attach stage and queue instrumentation at capture/pipeline enqueue, transcription worker dequeue/result, repository write, and Tauri UI acknowledgement boundaries.
- Replace the placeholder `get_transcription_status` response with shared authoritative queue/finalization state consumed by `useRecordingStop.ts`.
- Evolve meeting/transcript repositories and migrations so finalized evidence is incrementally upserted by stable identifiers and recovery can reconcile the same records.
- Extend settings/start/finalization UI surfaces with effective provider boundary, destination, and completeness information without turning normal recording into a diagnostics dashboard.

</code_context>

<specifics>
## Specific Ideas

- Preserve Meetily's Tauri/Rust desktop core, Next.js/React UI, native microphone and system-audio capture, local transcription, SQLite history, recording recovery, and summary-provider integrations where Phase 1 evidence supports them.
- Treat live assistance as validation-gated. Phase 1 may reserve telemetry vocabulary for later stages, but it must not build or simulate live suggestions.
- Prefer deliberate, inspectable status over optimistic completion: an explicit incomplete or recovered-with-gaps meeting is better than a clean-looking but untrustworthy record.

</specifics>

<deferred>
## Deferred Ideas

- The full target-hardware physical matrix, repeated continuous/overload runs, battery/power measurement, independent packet capture, and numeric live-readiness threshold declaration are deferred to Phase 4 under BASE-01 and BASE-06. This is an execution-order change, not removal from the milestone.

</deferred>

---

*Phase: 1-Baseline Observability, Identity, and Trust Boundaries*
*Context gathered: 2026-09-20*
