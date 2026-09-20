# Architecture Patterns

**Domain:** Evidence-aware meeting preparation, post-meeting knowledge, bounded live assistance, and recurring-meeting memory in a local-first Tauri desktop application
**Project:** Telu
**Researched:** 2026-09-20
**Repository revision inspected:** `0e36d88`
**Confidence:** HIGH for repository integration seams and persistence recommendations; MEDIUM for live-loop capacity and topic-change thresholds, which must be measured on target hardware

## Recommended Architecture

Telu should remain one Tauri desktop application. Rust should own canonical meeting identity, SQLite data, filesystem lifecycle, evidence assembly, provider orchestration, cancellation, freshness decisions, and evaluation telemetry. The Next.js/React frontend should own presentation, user edits, review actions, and rendering acknowledgement. It should not become a second source of truth for meeting identity, suggestion validity, or knowledge status.

```text
┌──────────────────────────── Next.js / React ────────────────────────────┐
│ Preparation UI │ Live suggestion UI │ Post-meeting review │ Series UI │
│                 feature services + typed command/event adapters          │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │ Tauri commands; lifecycle/events
                            ▼
┌──────────────────────────── Rust / Tauri ───────────────────────────────┐
│ MeetingSessionService  ─ stable identity and lifecycle                  │
│ KnowledgeService       ─ extraction, correction, status, supersession   │
│ DocumentService        ─ versions, extraction, deletion                 │
│ ContextAssembler       ─ bounded direct evidence selection              │
│ LiveAssistSupervisor   ─ trigger, cancel, coalesce, freshness gate      │
│ EvaluationRecorder     ─ latency, queue, silence, usefulness metrics    │
│ ProviderAdapters       ─ reuse existing summary/LLM configuration       │
└───────────────────────────┬─────────────────────────────────────────────┘
                            ▼
┌──────────────────── local SQLite + app-data files ─────────────────────┐
│ meetings/transcripts │ knowledge/evidence │ documents/versions │ runs  │
└────────────────────────────────────────────────────────────────────────┘
```

The first implementation slice is not the live assistant. It is a canonical lifecycle and evidence foundation, followed by structured post-meeting knowledge. Preparation and a deliberately narrow live spike then reuse the same accepted items, document passages, provider adapters, and provenance renderer. Meeting-series memory is an additional projection over accepted knowledge, not a separate memory database.

## Repository-Aligned Integration Seams

| Existing seam | Evidence in checkout | Telu use |
|---|---|---|
| SQLx migrations and one local SQLite pool | `frontend/src-tauri/src/database/manager.rs` runs `sqlx::migrate!("./migrations")`; schema is under `frontend/src-tauri/migrations/` | Add normal migrations, repositories, indexes, and transactions. Do not add another database service. |
| Tauri command registry | `frontend/src-tauri/src/lib.rs:613-760` registers recording, database, summary, and recovery commands | Add Telu commands through the same registry and keep domain logic in services/repositories rather than command handlers. |
| Rust-to-frontend transcript updates | `frontend/src-tauri/src/audio/transcription/worker.rs:200-224` emits `transcript-update` with sequence and audio-relative times | Feed a Rust-owned live supervisor from the completed transcript output. Do not route live decision logic through React. |
| Existing asynchronous provider orchestration | `frontend/src-tauri/src/summary/service.rs` owns provider selection, background work, result persistence, and cancellation | Reuse provider configuration and extract a shared generation boundary; do not duplicate provider code in the frontend. |
| Generation-specific cancellation | `frontend/src-tauri/src/summary/service.rs:217-265` keys a `CancellationToken` by meeting and `started_at`; repository updates reject stale completions | Generalize this proven pattern to a live request key with meeting, session, topic, and transcript high-watermark. |
| Recording recovery journal | `frontend/src/services/indexedDBService.ts` stores meeting metadata and segments; `TranscriptContext.tsx:94-120` creates a browser ID after `recording-started` | Retain IndexedDB only as a crash journal, but make it mirror the Rust-created canonical meeting ID. |
| Current late canonical ID creation | `frontend/src-tauri/src/database/repositories/transcript.rs:13-35` generates and inserts a meeting only when saving the completed transcript; `useRecordingStop.ts:235-266` invokes that save after stop | Replace with early meeting creation and idempotent segment/finalization writes. This is the primary prerequisite for all Telu flows. |
| Existing transcript location data | `transcripts.id`, `audio_start_time`, `audio_end_time`, and `duration` in migrations and models | Use transcript IDs plus audio time and optional text offsets as evidence locators. Reconcile the migrated `speaker` column with Rust/TypeScript models before relying on source attribution. |
| Current deletion path | `frontend/src-tauri/src/database/repositories/meeting.rs:233-273` manually deletes known child tables | Move Telu children under enforced foreign keys/cascades where appropriate and keep filesystem purge in a recoverable deletion job. |

### Immediate seam correction: one meeting ID, created before recording

Today there are two identities:

1. React creates `meeting-${Date.now()}` for IndexedDB after `recording-started`.
2. Rust creates `meeting-${Uuid::new_v4()}` only when the frontend saves after recording stops.

Those IDs cannot anchor preparation, live requests, recovery data, recordings, transcripts, and post-meeting knowledge as one lifecycle. Add a Rust command such as `create_meeting_session` that inserts a `meetings` row before preparation or recording and returns its UUID. `start_recording` must accept that ID, the recording folder metadata must store it, every transcript event must carry it, and IndexedDB must mirror it. Stopping a recording should finalize the existing row, not create a second meeting.

For quick-record behavior, the Rust start command may create the session transactionally if no ID was supplied, but it must return/emit the ID before audio is considered live. Recovery imports should preserve the embedded ID when valid and create an explicit recovery mapping only for legacy folders that lack one.

## Component Boundaries

| Component | Layer | Responsibility | Communicates with |
|---|---|---|---|
| `MeetingSessionService` | Rust | Create stable meeting IDs; transition `draft → preparing → recording → processing → completed` or recovery/error states; attach series and folders; finalize timestamps | Meeting repository, recording commands, recovery, Tauri commands/events |
| `TranscriptRepository` | Rust | Idempotent insert/upsert of stable transcript segments; ordering by meeting-scoped sequence; preserve audio locations and speaker/source | Transcription worker, recovery, evidence service |
| `KnowledgeService` | Rust | Extract structured candidates, apply user accept/correct/reject actions, append superseding items, query current series state | Existing LLM adapters, knowledge/evidence repositories, review commands |
| `EvidenceService` | Rust | Create immutable evidence locators and derivation metadata; resolve evidence for UI; mark evidence unavailable on source deletion | Transcript, documents, knowledge, suggestion output |
| `DocumentService` | Rust | Import/copy files into app-managed storage, hash and version them, extract bounded passages with page/paragraph locations, purge consistently | Tauri file dialog/fs, document repository, context assembler |
| `ContextAssembler` | Rust | Select a small, deterministic context bundle from explicitly attached document versions and accepted knowledge; enforce count/byte/token budgets | Document and knowledge repositories, pre-meeting and live generation |
| `LiveAssistSupervisor` | Rust | Consume transcript completions through a bounded queue, maintain topic/request epochs, cancel/coalesce work, apply freshness and intervention policy, emit only valid suggestions | Transcript worker, context assembler, provider adapters, evaluation recorder |
| `EvaluationRecorder` | Rust | Record timestamped stage metrics, queue depth, coalescing, cancellations, staleness reasons, deliberate-silence reasons, and user outcomes locally | All pipeline stages, frontend render/outcome commands |
| Feature services/hooks | React | Invoke typed commands, subscribe to lifecycle/results, render evidence, submit edits/outcomes, acknowledge render time | Rust command/event surface and existing contexts |
| IndexedDB recovery journal | React/browser | Best-effort mirror of the active meeting and transcripts for renderer recovery only | Canonical meeting ID and transcript events; reconciliation command |

### Rust/core responsibilities

- Generate and validate canonical IDs and lifecycle transitions.
- Keep all durable records in SQLite and app-managed files.
- Make provider/network boundaries explicit and reuse existing configured provider adapters.
- Enforce context budgets, cancellation, concurrency, freshness, and staleness before emitting suggestions.
- Persist provenance and derivation records in the same transaction as durable generated items.
- Own deletion orchestration across database rows and filesystem artifacts.
- Emit typed low-frequency lifecycle/result events and expose command reads for recovery.

### Frontend responsibilities

- Let users select documents, configure preparation, review candidates, inspect evidence, and accept/correct/reject results.
- Render the currently valid suggestion set and send a render acknowledgement containing the request ID and render timestamp.
- Reject any event whose `meeting_id`, `session_epoch`, or `topic_epoch` does not match the active view as defense in depth.
- Never infer `current` versus `superseded`, perform provider calls, or synthesize provenance in React.
- Never mint a second durable meeting ID. IndexedDB keys must use the ID returned by Rust.

## Canonical Data Model

Use normalized SQLite rows for lifecycle and provenance. JSON remains appropriate for flexible model payloads and locators, but not as the only representation of status, ownership, source links, or deletion state.

### Meeting identity and chronology

Extend `meetings` rather than introduce a competing entity:

| Field | Purpose |
|---|---|
| `id TEXT PRIMARY KEY` | UUID created before preparation/recording; stable across recovery and analysis |
| `series_id TEXT NULL` | Optional recurring-series membership |
| `lifecycle_status TEXT` | `draft`, `preparing`, `recording`, `processing`, `completed`, `recovered`, `error` |
| `scheduled_at`, `started_at`, `ended_at` | Separate intended time from observed recording chronology |
| `created_at`, `updated_at` | Record lifecycle |
| `folder_path` | Existing app-managed recording folder; validate it is within approved storage before deletion |

Add `meeting_series(id, title, created_at, updated_at, archived_at)` and a history/audit row for series membership changes if reassignment must be explainable. A meeting belongs to at most one series in the MVP. Manual grouping should precede automatic grouping.

### Transcript evidence

The durable transcript row should be the source of truth for evidence locations:

- Preserve a Rust-generated `transcript_id` from emission through SQLite persistence; do not generate a replacement ID only at stop.
- Add `sequence_no` scoped to the meeting, `speaker/source`, `is_final`, and `captured_at`.
- Retain `audio_start_time` and `audio_end_time` as recording-relative seconds.
- Evidence may additionally store UTF-8 character offsets within the transcript row. The transcript ID and audio range remain the durable fallback if text normalization changes.
- Do not treat the current process-global `SEQUENCE_COUNTER` as an identity. It is an ordering signal, and requests must always scope it by meeting/session.

### Structured knowledge

Use an append-only correction and supersession model:

```text
knowledge_items
  id, meeting_id, series_id, kind, content_json,
  review_status, validity_status, asserted_at,
  supersedes_item_id, created_at, updated_at, derivation_run_id
```

- `kind`: `decision`, `commitment`, `action_item`, `open_question`, `fact`.
- `review_status`: `proposed`, `accepted`, `corrected`, `rejected`. Only accepted/corrected items may enter preparation or live context.
- `validity_status`: `current`, `superseded`, `disputed`, `unresolved`. An open question normally remains `unresolved`; a fact or decision may be `current`, `disputed`, or `superseded`.
- A correction inserts a new row whose `supersedes_item_id` points to the prior row and marks the prior row `superseded` in the same transaction. Never overwrite the old assertion and its evidence.
- `asserted_at` is the meeting chronology time, distinct from `created_at`, which is when Telu extracted or the user edited it.

This keeps history inspectable and makes the current series view a query over accepted leaf items, not mutable prose memory.

### Provenance and derivation

Give every extracted item, briefing claim, and shown suggestion at least one evidence link. Use a common evidence registry with constrained source-specific references:

```text
evidence_sources
  id, source_kind,
  transcript_id NULL, document_passage_id NULL, knowledge_item_id NULL,
  locator_json, excerpt, content_hash, availability, captured_at

provenance_links
  subject_kind, subject_id, evidence_source_id, relation, ordinal

derivation_runs
  id, purpose, meeting_id, status, provider, model,
  prompt_version, input_fingerprint, started_at, completed_at, error_code
```

Use a `CHECK` constraint so exactly one source reference is populated. `locator_json` holds source-specific details such as audio range, page number, paragraph index, or character span. `content_hash` detects source drift. `availability` is `available` or `deleted`; a tombstone can retain only the opaque source ID, hash, and deletion time after sensitive text is purged.

`subject_kind` is a practical polymorphic edge for the MVP, but repository methods must validate the subject exists because SQLite cannot enforce a polymorphic foreign key. If this becomes error-prone, split it into dedicated `knowledge_item_evidence`, `briefing_claim_evidence`, and `suggestion_evidence` tables rather than weakening validation.

### Documents and versions

```text
documents
  id, display_name, ownership_scope, lifecycle_status, created_at, deleted_at

document_versions
  id, document_id, version_no, sha256, mime_type, managed_path,
  extraction_status, created_at, UNIQUE(document_id, version_no), UNIQUE(document_id, sha256)

document_passages
  id, document_version_id, ordinal, text, locator_json, content_hash

meeting_documents
  meeting_id, document_version_id, role, attached_at
```

Copy imported files into app-managed storage or record an explicit user-approved external reference mode; do not silently assume an arbitrary original path remains available. A new file with changed bytes creates a new immutable version. Preparation always records the exact version used. The bounded MVP can extract paragraphs/pages and pass selected passages directly—no embeddings or external vector store.

### Briefings and live suggestions

Persist generated artifacts as runs plus inspectable outputs:

```text
briefings
  id, meeting_id, derivation_run_id, version_no, status, created_at
briefing_claims
  id, briefing_id, ordinal, text, claim_type

live_requests
  id, meeting_id, session_epoch, topic_epoch, request_seq,
  transcript_high_watermark, status, silence_reason,
  queued_at, context_started_at, model_started_at, model_completed_at,
  emitted_at, rendered_at, stale_reason

live_suggestions
  id, request_id, text, suggestion_kind, expires_at,
  disposition, displayed_at, acted_at
```

Keep live text only as long as needed for inspection/evaluation according to an explicit retention setting. The metadata needed to measure latency and cancellation can remain after ephemeral text is purged.

## Data Flow

### 1. Preparation

```text
React creates/opens meeting
  → Rust inserts stable meeting row (`draft`/`preparing`)
  → user attaches exact document versions and optionally a series
  → ContextAssembler selects bounded passages + accepted current items
  → provider generates structured briefing claims
  → Rust validates claims have evidence, persists run + claims + links
  → React renders concise briefing and source inspection
```

Selection should be deterministic and inspectable: explicit attachments first, unresolved questions next, then recent accepted series items. Enforce hard limits by source count, passage count, bytes/tokens, and per-source share. If the material does not fit, explain what was omitted instead of silently adding opaque retrieval.

### 2. Recording and transcript persistence

```text
Rust creates meeting ID
  → start_recording(meeting_id)
  → audio pipeline/VAD/transcription (existing path)
  → final TranscriptUpdate includes meeting/session/segment identity and timing
  → Rust idempotently persists segment and emits UI update
  → IndexedDB mirrors the same IDs for crash recovery
  → stop finalizes existing meeting row
```

Persistence should not depend on a 4-second frontend delay or a successful renderer. Frontend recovery can remain an additional copy, but the canonical write must move into Rust as segments finalize. A uniqueness constraint on `(meeting_id, segment_id)` or `(meeting_id, sequence_no)` makes replay safe.

### 3. Post-meeting knowledge

```text
completed transcript snapshot
  → derivation run with transcript fingerprint
  → structured candidates + transcript locators
  → schema/evidence validation
  → proposed knowledge rows
  → user accepts, corrects, or rejects
  → accepted current items become eligible context
```

Extraction must never directly publish series memory as truth. A model output is a proposal until user review. Re-running extraction creates a new derivation run and deduplicates by stable evidence/content fingerprints; it must not erase prior user decisions.

### 4. Series memory

```text
accepted meeting knowledge
  → series projection ordered by asserted_at and meeting time
  → supersession/dispute rules
  → current facts + unresolved questions + chronology
  → bounded preparation/live context
```

The series projection is queryable SQL, not a separately generated summary blob. A summary may be cached for display, but accepted source items and their supersession edges remain authoritative.

### 5. Live assistance

```text
final transcript segment
  → non-blocking offer to bounded live-input queue
  → coalesce into latest transcript window
  → topic/request epoch decision
  → cancel obsolete child token
  → bounded ContextAssembler snapshot
  → one in-flight generation per meeting
  → Rust freshness + evidence + intervention-policy gate
  → persist request outcome
  → emit valid suggestion
  → React validates epoch, renders, acknowledges render time
```

Live assistance consumes transcription output; it must never sit between audio capture and transcript persistence. If its queue is full, Telu drops or coalesces live-assistance work—not audio and not durable transcript segments.

## Bounded, Cancellable Live Pipeline

### Work identity

Every request carries:

```text
(meeting_id, session_epoch, topic_epoch, request_seq, transcript_high_watermark)
```

`session_epoch` changes whenever recording resumes as a logically new live session or recovery restarts the supervisor. `topic_epoch` changes on a confirmed topic shift. `request_seq` is monotonic within the session. `transcript_high_watermark` is the newest durable segment included in the context snapshot.

### Queue and backpressure policy

- Use a bounded `tokio::sync::mpsc::channel` between transcript completion and live trigger evaluation. Official Tokio documentation explicitly defines bounded channels as backpressured; capacity must be selected from baseline measurements, not guessed.
- The transcription emitter must use a non-blocking handoff (`try_send` or an equivalent latest-slot/coalescing structure). On full capacity, merge pending same-topic transcript windows or replace the oldest unstarted trigger with the newest. Increment `live_input_coalesced_total` or `live_input_dropped_total` with a reason.
- Keep at most one provider generation in flight per meeting and one pending latest request. A small global semaphore may cap model work across windows, but the actual limit is validation-gated by local model/resource measurements.
- Never replay a backlog of old live requests. Once context is no longer actionable, record `stale_before_start` and discard it.
- Keep the existing audio/transcription queues unchanged during the baseline phase except for instrumentation. Their present unbounded, single-worker shape (`recording_manager.rs:237-238`, `worker.rs:73-76`) is an explicit risk to measure before selecting a safer capacity/segmentation policy.

### Cancellation and stale-result rejection

Cancellation is cooperative and is not sufficient by itself. Use both a `CancellationToken` and a generation check:

1. A meeting/session root token owns topic/request child tokens.
2. Stop, meeting switch, feature disable, privacy-setting change, or session recovery cancels the root.
3. A confirmed topic change cancels the prior topic token and increments `topic_epoch`.
4. A newer request on the same topic cancels/replaces an older request only when the older result would no longer add value; otherwise coalesce input into the next request.
5. Check cancellation before and after context assembly, before provider dispatch, after provider return, before persistence, and immediately before emit.
6. Before accepting a result, atomically compare its full work identity with the supervisor's current identity. A late provider response can never become visible even if transport cancellation did not stop computation.
7. Update `live_requests.status` with compare-and-set semantics keyed by request ID/epoch so a stale task cannot overwrite the active state.

The existing summary implementation demonstrates the right local pattern: replacement cancels the prior token, cleanup only removes the matching generation, and database completion can report a stale write rather than overwrite it (`summary/service.rs:217-265`, `610-645`). Reuse that shape rather than inventing a frontend `AbortController` as the primary authority.

### Freshness gate

Reject a suggestion in Rust if any condition holds:

- active meeting or session differs;
- topic epoch changed;
- request was cancelled;
- `expires_at` passed;
- transcript high-watermark has advanced beyond the validated maximum age/window;
- supporting evidence became unavailable or was superseded;
- an equivalent suggestion was already shown/dismissed;
- intervention policy returns a silence reason such as `low_confidence`, `insufficient_evidence`, `duplicate`, `obvious`, `topic_unstable`, or `too_late`.

React repeats the identity/expiry check before rendering. This is defense in depth, not a substitute for the Rust gate.

### Topic-change behavior

Start with explainable signals: a silence boundary plus a configurable amount of new transcript, an explicit user reset, or a strong lexical/entity discontinuity within a small rolling window. Topic change should advance an epoch only after a short stability/debounce period, because flapping epochs would cancel useful work. Do not add an always-on topic-model service in the MVP. Thresholds and whether topic detection needs an LLM remain validation-gated.

### Observable latency

Capture monotonic timestamps at these boundaries:

1. audio end for the triggering segment;
2. transcript emitted and durably stored;
3. live input queued/coalesced;
4. context assembly start/end;
5. provider dispatch/first byte/completion where available;
6. freshness decision;
7. suggestion emitted;
8. frontend render acknowledgement.

Compute spoken-phrase-to-visible latency from stages 1→8 and retain its components. Also record queue depth/high-watermark, dropped/coalesced triggers, cancellation latency, stale reason, evidence count, visible suggestion count, user disposition, and deliberate-silence reason. `get_transcription_status` currently returns placeholder zeros, so it cannot serve as this instrumentation surface.

## Deletion, Versioning, and Supersession

### Meeting deletion

Perform database deletion in one transaction with enforced foreign keys, then execute filesystem deletion through a durable `deletion_jobs`/outbox row:

1. cancel active generation and recording tasks for the meeting;
2. mark the meeting `deleting` so no new work can attach;
3. transactionally delete/cascade transcripts, knowledge, evidence links, briefings, live artifacts, attachments, and series membership;
4. enqueue the validated app-managed folder/file paths for purge;
5. after commit, delete files and mark the job complete; retry safely after a crash.

This avoids claiming atomicity across SQLite and the filesystem. Never recursively delete a path solely because it was stored in the database; resolve it under an approved recordings/documents root first.

### Document deletion

Cancel extraction/generation using the version, detach it from meetings, purge managed bytes and extracted passage text, and replace evidence content with an opaque tombstone (`availability=deleted`, hash, deletion timestamp). Unreviewed derived candidates based solely on the deleted source should be purged. Accepted knowledge may remain as a user-approved assertion, but its `evidence_state` becomes `source_unavailable` and it must not be presented as currently grounded until re-verified.

### Versioning and supersession

- Document bytes are immutable per version; changed bytes produce a new version and briefing runs reference the exact version IDs.
- Transcript corrections should create explicit revision/audit data or a replacement segment while preserving the original evidence history; do not silently mutate a cited string.
- Knowledge correction is append-only through `supersedes_item_id`.
- A newer assertion does not automatically supersede an older one. Supersession requires user action or a reviewed extraction relationship. Conflicting accepted assertions are `disputed` until resolved.
- Current memory queries select accepted/corrected leaf items whose evidence is available and whose validity is `current`, while separately surfacing disputed and unresolved items.

## Patterns to Follow

### Pattern 1: Commands as thin adapters, services as policy owners

**What:** Tauri commands deserialize/authorize, call a Rust service, and convert errors. Repositories own SQL; services own transactions and policy.
**When:** Every Telu feature crossing React/Rust.

```rust
#[tauri::command]
async fn accept_knowledge_item(
    state: tauri::State<'_, AppState>,
    item_id: String,
) -> Result<KnowledgeItemDto, CommandError> {
    state.knowledge_service.accept(&item_id).await.map(Into::into)
}
```

### Pattern 2: Persist provenance with the subject

**What:** Validate locators, create the generated item and its evidence links in one transaction, and fail closed if a required claim has no resolvable source.
**When:** Structured extraction, briefing claims, and live suggestions.

### Pattern 3: Direct bounded context with explicit budgets

**What:** Assemble recent accepted items and selected document passages using deterministic SQL/order rules and hard limits. Return a manifest of included and omitted sources.
**When:** MVP preparation and live assistance. This deliberately precedes embeddings, vector stores, or broad semantic search.

### Pattern 4: Cancellation plus generation fencing

**What:** Cancellation requests stop cooperative work; generation IDs prevent non-cooperative late results from committing or displaying.
**When:** Provider calls, topic changes, regenerated briefings, extraction replacement, and app shutdown.

### Pattern 5: Lifecycle events, recoverable reads

**What:** Events notify React that state changed; commands read canonical state after reload or missed events. For high-rate ordered streams, evaluate Tauri channels.
**When:** Recording/live lifecycle. Official Tauri 2 guidance describes events as simple global communication and channels as fast ordered streaming. Keep existing events for baseline compatibility, and validation-gate a transcript/suggestion channel migration based on measured loss, ordering, and overhead.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Parallel Python/FastAPI backend

**What:** Adding document, memory, or suggestion endpoints to the archived backend.
**Why bad:** Splits identity, persistence, packaging, privacy, and cancellation across unsupported processes.
**Instead:** Add Rust services and Tauri commands/events within the existing application.

### Anti-Pattern 2: Frontend-generated canonical IDs and post-stop-only persistence

**What:** Continue using a browser timestamp ID during recording, then create a different SQLite UUID after stop.
**Why bad:** Preparation, recovery, evidence, and live requests cannot form durable foreign-key relationships; renderer failure can lose the canonical save.
**Instead:** Create the SQLite meeting before recording and mirror its ID everywhere.

### Anti-Pattern 3: Unbounded live work and FIFO backlog replay

**What:** Feed every transcript update into an unbounded suggestion queue and eventually process all of them.
**Why bad:** Old requests consume model time and surface after the conversation has moved on.
**Instead:** Bound, coalesce, cancel, and record explicit overflow/stale outcomes.

### Anti-Pattern 4: Cancellation without a commit/display fence

**What:** Assume cancelling a token guarantees an HTTP/local-model call stops before returning.
**Why bad:** A late result may still persist or display.
**Instead:** Compare the full generation identity immediately before every durable write and UI emit.

### Anti-Pattern 5: Mutable memory blobs

**What:** Replace a series summary JSON whenever a new meeting finishes.
**Why bad:** Loses chronology, provenance, user corrections, and conflict history.
**Instead:** Append reviewed structured items and calculate the current projection from status/supersession edges.

### Anti-Pattern 6: Citations reconstructed after generation

**What:** Ask a model for prose, then search for text that appears to support it.
**Why bad:** Produces plausible but false provenance.
**Instead:** Build the input as identified evidence units and require outputs to cite those IDs; validate all cited IDs before persistence.

### Anti-Pattern 7: Premature FTS/vector infrastructure

**What:** Introduce embeddings, an external vector store, or even a complex FTS5 external-content index before bounded context fails.
**Why bad:** Adds index lifecycle and deletion-consistency risk without evidence it improves this small corpus.
**Instead:** Use explicit attachments, status/chronology queries, and direct passage selection. If FTS5 is later justified, use triggers and a tested rebuild path; SQLite's official documentation warns external-content indexes can become inconsistent with their content tables.

## Migration Plan

1. Add migration-level schema tests and configure every SQLx connection with `PRAGMA foreign_keys = ON`; current pool creation does not visibly enable it. Test cascades explicitly rather than relying on schema declarations.
2. Add lifecycle/series columns and backfill existing meetings as `completed`, with `started_at` derived conservatively from `created_at` and `series_id = NULL`.
3. Reconcile schema/model drift: the `speaker` migration exists, but `database/models.rs`, transcript inserts, and API DTOs do not currently carry it.
4. Add `create_meeting_session`, change recording start to accept/return the canonical ID, embed it in metadata/recovery, and make save/finalize idempotent.
5. Persist final transcript segments incrementally from Rust using stable IDs. Keep IndexedDB recovery until crash/reload tests prove Rust persistence is sufficient; then simplify, do not abruptly remove it.
6. Add derivation, knowledge, and evidence tables/repositories; ship post-meeting extraction/review first.
7. Add documents/versions/passages and transactional attachment/deletion flows; use direct bounded context for preparation.
8. Add the isolated live supervisor behind a feature flag with local metrics and synthetic/replayed transcript tests. It must be disableable without affecting recording/transcription.
9. Add series projection and reviewed supersession behavior after the item model is exercised by real post-meeting corrections.

Migrations should be additive first. Do not rewrite existing IDs or transcript text in place. Provide integrity queries for orphan rows, duplicate sequence numbers, missing evidence, supersession cycles, deleted-source use, and more than one current successor.

## Suggested Build Order and Phase Dependencies

1. **Baseline and observability**
   - Pin a Meetily commit and benchmark VAD-to-transcript freshness, current queue growth, resource use, persistence, shutdown, and recovery.
   - Add stage timestamps and replay fixtures before changing queue behavior.
   - Gate: target latency/resource envelopes and whether transcript segmentation must change.

2. **Canonical meeting lifecycle and persistence hardening**
   - Early Rust-owned meeting ID, lifecycle states, incremental transcript persistence, IndexedDB reconciliation, foreign-key enforcement, deletion outbox.
   - This phase is required by every later phase.

3. **Evidence foundation plus structured post-meeting knowledge**
   - Derivation runs, evidence locators, decisions/commitments/actions/open questions/facts, and accept/correct/reject flows.
   - Proves the information model without real-time constraints and creates trustworthy context for later phases.

4. **Versioned documents and sourced preparation**
   - Bounded ingestion, exact document versions, page/paragraph locators, meeting attachments, direct context assembly, briefing claims and candidate questions.
   - Gate: corpus sizes and context-fit rates; only research retrieval/indexing if direct context fails.

5. **Bounded live-assistance validation slice**
   - Feature-flagged supervisor, bounded latest-wins queue, cancellation/generation fencing, one visible suggestion, evidence view, end-to-end latency and deliberate-silence evaluation.
   - Gate: freshness, usefulness, distraction, cancellation latency, and resource budget. Do not expand intervention breadth unless thresholds pass.

6. **Meeting-series projection and memory UX**
   - Manual series grouping, chronology, current/superseded/disputed/unresolved views, carry-forward into preparation, and source inspection.
   - This comes after real corrections expose the status model; automatic grouping remains deferred.

7. **Hardening and selective scale work**
   - Cross-platform recovery/deletion tests, provider failure/privacy UX, retention controls, migration integrity tooling.
   - Consider Tauri channels, FTS5, embeddings, or greater concurrency only when phase metrics identify a concrete bottleneck.

**Ordering rationale:** stable identity is the dependency root. Provenance must exist before claims and memory can be trusted. Post-meeting review exercises provenance/status at low latency risk. Documents reuse that base. The live slice then reuses accepted knowledge, evidence rendering, provider adapters, and context budgets while isolating real-time risk. Series memory is safest after user corrections validate the supersession model.

## Decisions That Must Remain Validation-Gated

| Decision | Evidence required before commitment |
|---|---|
| VAD/segment boundary changes | Measured long-speech and continuous-system-audio transcript freshness on target hardware |
| Capacity of transcription and live queues | Arrival/service-time distributions, memory growth, drop/coalesce rates, shutdown behavior |
| Event-to-Tauri-channel migration | Reproducible ordering/loss/throughput issue or material latency win |
| Topic-change threshold/model | Replay evaluation showing fewer stale suggestions without cancellation flapping |
| Streaming provider output | Provider support plus measured time-to-useful-suggestion improvement; partial text must still pass evidence/freshness gates |
| FTS5 | Direct bounded context no longer fits and keyword search measurably improves selection; index deletion/rebuild tests pass |
| Embeddings/vector store | Representative corpus shows lexical/direct selection misses useful evidence; privacy/deletion costs are justified |
| Automatic series grouping | Manual grouping data demonstrates reliable signals and offers reversible confirmation |
| More than one in-flight suggestion | One-request policy fails throughput goals without increasing distraction/staleness/resource use |

## Scalability Considerations

Telu is a desktop product, so scale is driven more by meeting duration, local corpus size, model throughput, and device resources than by concurrent users.

| Concern | Small local corpus | Hundreds of meetings | Large multi-year corpus |
|---|---|---|---|
| Structured memory | Indexed SQLite queries on `series_id`, status, and chronology | Composite indexes and cached current projection | Re-evaluate archive/compaction only after query measurements |
| Documents | Explicitly attached versions; direct passages | Bounded keyword/metadata filtering | Validate FTS5 before embeddings; keep source version/deletion invariants |
| Live work | One meeting, one in-flight request | Same bounded per-meeting policy | Corpus size must not widen live context; precompute reviewed series projection |
| Transcript rendering | Existing pagination/virtualization | Continue paginated reads | Archive old transcript payloads only with preserved evidence locators |
| Provider load | One generation at a time | Local global semaphore and cancellation | User-configurable resource budget; never let background work starve transcription |
| Provenance | Direct row joins | Index subject/source IDs and availability | Integrity audit and retention policy; do not denormalize away chronology |

## Verification Strategy

- Repository tests: migration from a copy of the current schema, foreign-key enforcement on every pool connection, cascades, deletion job replay, idempotent transcript replay, recovery using one canonical ID.
- Knowledge tests: evidence required, rejected items excluded, corrections append rather than overwrite, supersession cycles rejected, disputed facts excluded from current-memory claims.
- Document tests: identical-byte deduplication, changed-byte versioning, locator stability, delete-during-extraction cancellation, source-unavailable propagation.
- Live deterministic tests: recorded transcript streams with controlled timestamps; queue saturation; same-topic coalescing; topic-change cancellation; provider ignores cancellation; late completion; meeting switch; renderer reload; duplicate suppression; deliberate silence.
- End-to-end measurement: spoken audio fixture to rendered acknowledgement, with stage-by-stage median/p95 and resource use.
- Privacy tests: no raw transcript/document excerpts in diagnostic logs or remote analytics; remote provider use is explicit and scoped to the selected context manifest.

## Sources

### Local repository — HIGH confidence

- `frontend/src-tauri/src/database/manager.rs` — SQLite path, pool, and embedded migration runner.
- `frontend/src-tauri/migrations/20250916100000_initial_schema.sql` through `20251229000000_add_gemini_api_key.sql` — current schema evolution.
- `frontend/src-tauri/src/database/repositories/transcript.rs:13-82` — meeting UUID is currently created with the final transcript save.
- `frontend/src/contexts/TranscriptContext.tsx:84-135` — a separate timestamp-based IndexedDB recovery ID is currently created after recording starts.
- `frontend/src/hooks/useRecordingStop.ts:235-266` — frontend performs canonical SQLite save after stop.
- `frontend/src-tauri/src/audio/recording_manager.rs:228-248` and `audio/transcription/worker.rs:50-81` — unbounded transcription channels and one worker.
- `frontend/src-tauri/src/audio/transcription/worker.rs:200-224` — current transcript event payload and audio-relative timing.
- `frontend/src-tauri/src/summary/service.rs:217-265, 610-645` — existing generation-scoped cancellation and stale update handling.
- `frontend/src-tauri/src/database/repositories/meeting.rs:233-273` — current manual meeting deletion transaction.
- `frontend/src-tauri/Cargo.toml` and `frontend/package.json` — Tauri 2.6.2, Tokio 1.32, tokio-util 0.7, SQLx 0.8, Next.js 14, React 18.

### Current official documentation — MEDIUM confidence after repository cross-check

- [Tokio bounded channels](https://docs.rs/tokio/latest/tokio/sync/mpsc/fn.channel.html) and [Tokio channel guidance](https://tokio.rs/tokio/tutorial/channels) — bounded capacity and backpressure.
- [tokio-util `CancellationToken`](https://docs.rs/tokio-util/latest/tokio_util/sync/struct.CancellationToken.html) — token trees, cancellation futures, and cancellation-safety limits.
- [Tauri 2: Calling the Frontend from Rust](https://v2.tauri.app/develop/calling-frontend/) — events versus ordered streaming channels.
- [SQLite foreign keys](https://www.sqlite.org/foreignkeys.html) — per-connection enforcement and cascading actions.
- [SQLite FTS5](https://www.sqlite.org/fts5.html) — external-content consistency, trigger, deletion, and rebuild obligations.

## Confidence and Open Questions

| Area | Confidence | Reason |
|---|---|---|
| Rust/frontend boundaries | HIGH | Directly verified in the checkout and maintainer guidance |
| Stable identity and persistence migration | HIGH | Current dual-ID/late-save flow is explicit in source |
| Provenance, chronology, deletion, supersession | HIGH | Normalized model follows project constraints and SQLite capabilities |
| Cancellation and stale fencing | HIGH | Reuses an existing tested summary pattern plus current Tokio primitives |
| Queue capacities and time windows | MEDIUM | Correct mechanisms are known; values require baseline data |
| Topic-change policy | MEDIUM | Start-simple architecture is clear; useful thresholds require replay and user evaluation |
| Need for FTS/embeddings | MEDIUM | The bounded MVP should avoid them, but future corpus behavior is unmeasured |

Open questions for phase-specific research are: target hardware and supported platform matrix; acceptable transcript and suggestion p95 latency; retention expectations for live request text and deleted-source tombstones; supported document formats and extraction fidelity; and whether existing provider clients expose cancellation/streaming behavior sufficient for the measured latency target.
