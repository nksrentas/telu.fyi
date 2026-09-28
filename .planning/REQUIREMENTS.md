# Requirements: Telu

**Defined:** 2026-09-20
**Core Value:** Telu surfaces the right evidence-backed context at the moment it is useful—and stays silent when an intervention would not add more value than distraction.

## v1 Requirements

### Baseline and Observability

- [ ] **BASE-01**: A maintainer can run a reproducible target-hardware scenario matrix covering short utterances, continuous speech, overlapping speech, sustained system audio, stop, restart, and recovery.
- [x] **BASE-02**: A maintainer can measure monotonic timestamps from captured audio through segmentation, transcription, context selection, generation, and visible UI acknowledgement.
- [x] **BASE-03**: A maintainer can observe real transcription and assistance queue depth, oldest-item age, throughput, cancellation, and dropped or superseded work rather than placeholder metrics.
- [x] **BASE-04**: A maintainer can measure CPU, memory, battery impact, model/provider choice, and error rates per meeting scenario without sending evaluation data off-device by default.
- [x] **BASE-05**: A user can stop, restart, and recover an interrupted meeting without duplicate meeting records, silent transcript loss, or ambiguous completion state.
- [ ] **BASE-06**: A maintainer can declare explicit go/no-go thresholds for later live-assistance experiments using baseline evidence rather than assumed performance.

### Meeting Identity and Privacy Boundaries

- [x] **IDENT-01**: A meeting receives one durable Rust-owned identifier before preparation or recording begins, and recording, recovery, documents, transcript, analysis, and series membership reuse it.
- [x] **IDENT-02**: Final transcript segments are persisted incrementally and idempotently with stable evidence identifiers and capture-completeness metadata.
- [x] **IDENT-03**: Repeated recovery or retry operations reconcile to the same meeting and transcript evidence instead of creating duplicates.
- [x] **PRIV-01**: A user can see whether each configured transcription, summary, document-processing, or generation path is local or remote and what destination receives data.
- [x] **PRIV-02**: Telu never silently falls back from a local path to a hosted provider; an unavailable selected path fails visibly and preserves user choice.
- [x] **PRIV-03**: Local capture, storage, and evaluation work without undisclosed network calls, while every enabled remote or LAN destination remains explicit and configurable.

### Evidence-Linked Post-Meeting Knowledge

- [ ] **KNOW-01**: A user can derive typed candidate decisions, commitments or action items, open questions, and relevant facts from a completed meeting.
- [ ] **KNOW-02**: Every candidate item has a stable identity, derivation run, review state, and exact transcript evidence that opens the supporting segment in context.
- [ ] **KNOW-03**: A user can accept, correct, or reject each candidate independently and immediately see its resulting eligibility for future context.
- [ ] **KNOW-04**: Corrections create an auditable revision linked to the original proposal and evidence instead of overwriting history.
- [x] **KNOW-05**: Rejected or superseded candidates do not reappear as current knowledge after regeneration, preparation, or series projection unless a user explicitly restores them.
- [x] **KNOW-06**: Telu abstains or exposes unresolved fields when available transcript evidence does not adequately support a candidate item.
- [ ] **KNOW-07**: A maintainer can evaluate extraction quality by item type, evidence coverage, exact source-span correctness, attribution, duplication, and user review outcome on representative meetings.
- [ ] **KNOW-08**: Deleting a meeting or transcript visibly removes or invalidates dependent candidate knowledge and evidence without leaving a claim that appears fully supported.

### Bounded Documents and Meeting Preparation

- [ ] **DOC-01**: A user can paste text or import a bounded local file from an explicitly supported format set, with clear size and resource limits and no execution of instructions embedded in source content.
- [ ] **DOC-02**: Every imported source has ownership, an immutable version or content hash, extraction status, and stable page, section, paragraph, or text-span locators appropriate to its format.
- [ ] **DOC-03**: A user can attach or select an explicit bounded set of document versions and accepted meeting knowledge for an upcoming meeting.
- [ ] **DOC-04**: A user can replace or delete a document and see dependent briefings, citations, cached context, and derived claims invalidated or repaired consistently.
- [ ] **PREP-01**: A user can generate a concise pre-meeting briefing containing relevant accepted decisions, commitments, open questions, and selected document facts.
- [ ] **PREP-02**: A user can generate candidate questions for the meeting, and every factual briefing statement or question rationale opens its exact source version and locator.
- [ ] **PREP-03**: A user can inspect what sources were included, truncated, or omitted from a briefing and why.
- [ ] **PREP-04**: Preparation uses deterministic per-source and total context budgets and reports missing, deleted, or unavailable evidence instead of fabricating continuity.
- [ ] **PREP-05**: A maintainer can measure supported-claim rate, source correctness, usefulness, stale or superseded content, and direct-context fit before introducing retrieval infrastructure.

### Bounded Live Assistance

- [ ] **LIVE-01**: A user can explicitly enable or disable live assistance independently of recording, and disabling it cancels pending assistance without stopping durable capture.
- [ ] **LIVE-02**: Live assistance receives sufficiently fresh transcript increments through a bounded non-blocking handoff that cannot stall the recording path.
- [ ] **LIVE-03**: Each request carries an immutable meeting scope, context snapshot, topic or request epoch, deadline, and source manifest that are revalidated before provider dispatch, persistence, and display.
- [ ] **LIVE-04**: Telu permits at most one in-flight live generation and one latest pending request per meeting unless later measurements justify broader concurrency.
- [ ] **LIVE-05**: Topic changes, newer transcript context, disable actions, and meeting termination cancel or supersede stale work, and generation fencing prevents late results from being stored or shown.
- [ ] **LIVE-06**: Telu shows a live intervention only when it passes freshness, evidence, relevance, novelty, duplicate, actionability, and display-capacity gates.
- [ ] **LIVE-07**: The interface shows no more than one primary suggestion and one secondary item at once, with direct evidence inspection, dismiss, and feedback controls.
- [ ] **LIVE-08**: Telu records explicit suppression reasons and treats appropriate silence during low-value periods as a measurable successful outcome.
- [ ] **LIVE-09**: A maintainer can replay deterministic meeting timelines and measure phrase-to-visible p50/p95 latency, cancellation, grounding, usefulness, stale, distracting, duplicate, and deliberate-silence behavior.
- [ ] **LIVE-10**: Live assistance remains feature-gated until predeclared latency, resource, grounding, usefulness, distraction, duplication, cancellation, and appropriate-silence thresholds pass on the target matrix.

### Recurring-Meeting Series Memory

- [ ] **SERIES-01**: A user can create a meeting series, assign or reassign meetings manually, inspect membership, and correct a mistaken assignment without changing meeting identity.
- [ ] **SERIES-02**: Only accepted or explicitly user-authored knowledge becomes durable series memory; unreviewed generated candidates remain meeting-scoped.
- [ ] **SERIES-03**: A user can inspect each remembered item with its originating meeting, date, evidence, revisions, review action, and status history.
- [ ] **SERIES-04**: Facts and decisions support current, superseded, disputed, and unresolved states; commitments additionally support open, completed, and cancelled states.
- [ ] **SERIES-05**: When evidence conflicts with current memory, Telu presents both versions and lets the user supersede, dispute, or leave the conflict unresolved instead of selecting truth by recency.
- [ ] **SERIES-06**: A new meeting briefing carries forward current accepted items and open commitments or questions while separating disputed, unresolved, superseded, rejected, or source-missing material.
- [ ] **SERIES-07**: Meeting deletion, document deletion or replacement, transcript correction, and series reassignment repair downstream memory and preparation consistently.
- [ ] **SERIES-08**: A maintainer can verify current-state correctness, chronology preservation, and absence of cross-series leakage using renamed, duplicate-title, split, merge, reassignment, and deletion scenarios.

### Hardening and Release Confidence

- [ ] **HARD-01**: Existing Meetily data migrates into each Telu schema revision without silent loss, and migration or rollback fixtures cover realistic prior databases.
- [ ] **HARD-02**: Meeting and document deletion, version replacement, regeneration, and series reassignment complete atomically or leave a visible recoverable job state across SQLite, files, caches, and derived data.
- [ ] **HARD-03**: Supported desktop platforms pass permission grant, denial, revocation, device loss or hot-swap, interrupted stop, process crash, restart, and recovery scenarios.
- [ ] **HARD-04**: A user can inspect and export meetings plus accepted structured knowledge and evidence in a durable local format.
- [ ] **HARD-05**: Settings, runtime UI, logs, and network behavior agree on local versus remote processing, data sent, destination, and failure state.
- [ ] **HARD-06**: Logs and evaluation exports redact sensitive content by default and require explicit user action before any data leaves the device.
- [ ] **HARD-07**: A release is blocked until held-out end-to-end checks pass the agreed grounding, source correctness, usefulness, distraction, silence, latency, resource, recovery, deletion, privacy, migration, and series-memory thresholds.

## Definition of Done

- Every v1 requirement is implemented, verified, and mapped to exactly one roadmap phase.
- Automated checks and required manual desktop scenarios pass on the declared supported-platform matrix.
- Each phase's validation gate has recorded evidence; downstream phases do not bypass a failed or unknown prerequisite.
- User-visible claims about privacy, local processing, evidence, latency, and memory match observed behavior.
- No destructive lifecycle operation leaves undisclosed orphaned files, citations, caches, indexes, or current-memory claims.

## v2 Requirements

### Retrieval and Conversation

- **RETR-01**: User can search or chat across a large multi-meeting corpus after direct-context limits demonstrate a measured need.
- **RETR-02**: Telu can use selective full-text or embedding retrieval with version-aware indexing and deletion guarantees after an explicit evaluation gate.
- **LIVE-11**: Telu can support more than one in-flight generation, streamed output, or a richer topic model after bounded single-flight behavior proves insufficient.

### Integrations and Collaboration

- **INTG-01**: User can connect a calendar to propose meeting-series membership after manual grouping semantics are validated.
- **INTG-02**: User can use meeting-platform bots or automatic joining after consent, identity, privacy, and platform-specific risks are separately scoped.
- **COLLAB-01**: Teams can share meeting knowledge through roles and permissions after the local single-user model is proven.

### Document Breadth and Publishing

- **DOC-05**: User can ingest OCR-dependent scans and broad office-document variants after bounded text, PDF, and DOCX extraction meet quality and lifecycle gates.
- **EXPORT-01**: User can publish advanced formatted reports beyond the inspectable local export required for v1.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Archived Python/FastAPI backend as a supported runtime | The active Meetily product is a self-contained Tauri/Rust application; a parallel backend would create drift and security ambiguity. |
| Pro Agent API as the Telu internal architecture | It is a separate Pro product surface and is not evidence of Community Edition implementation seams. |
| Transcription-only positioning | It does not deliver Telu's evidence-aware, cross-conversation value. |
| Automatic promotion of generated items into memory | Plausible extraction must not become durable organizational history without review. |
| In-place overwrite of decisions or facts | It destroys chronology, provenance, and correction semantics. |
| Source-free summaries, suggestions, briefings, or memory | Unsupported output cannot earn user trust or be repaired reliably. |
| High-frequency or autonomous coaching | It expands social and evaluation risk before a bounded intervention policy is proven. |
| Silent local-to-cloud failover | It violates explicit local-first expectations and provider consent. |
| External vector database by default | It adds indexing, deletion, privacy, and operational complexity before measured corpus needs justify it. |
| Cloud collaboration in the validation milestone | Roles, sharing, and hosted storage are separate product and security problems. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BASE-01 | Phase 4 | Pending |
| BASE-02 | Phase 1 | Complete |
| BASE-03 | Phase 1 | Complete |
| BASE-04 | Phase 1 | Complete |
| BASE-05 | Phase 1 | Complete |
| BASE-06 | Phase 4 | Pending |
| IDENT-01 | Phase 1 | Complete |
| IDENT-02 | Phase 1 | Complete |
| IDENT-03 | Phase 1 | Complete |
| PRIV-01 | Phase 1 | Complete |
| PRIV-02 | Phase 1 | Complete |
| PRIV-03 | Phase 1 | Complete |
| KNOW-01 | Phase 2 | Gaps Found |
| KNOW-02 | Phase 2 | Gaps Found |
| KNOW-03 | Phase 2 | Gaps Found |
| KNOW-04 | Phase 2 | Gaps Found |
| KNOW-05 | Phase 2 | Complete |
| KNOW-06 | Phase 2 | Complete |
| KNOW-07 | Phase 2 | Pending |
| KNOW-08 | Phase 2 | Gaps Found |
| DOC-01 | Phase 3 | Pending |
| DOC-02 | Phase 3 | Pending |
| DOC-03 | Phase 3 | Pending |
| DOC-04 | Phase 3 | Pending |
| PREP-01 | Phase 3 | Pending |
| PREP-02 | Phase 3 | Pending |
| PREP-03 | Phase 3 | Pending |
| PREP-04 | Phase 3 | Pending |
| PREP-05 | Phase 3 | Pending |
| LIVE-01 | Phase 4 | Pending |
| LIVE-02 | Phase 4 | Pending |
| LIVE-03 | Phase 4 | Pending |
| LIVE-04 | Phase 4 | Pending |
| LIVE-05 | Phase 4 | Pending |
| LIVE-06 | Phase 4 | Pending |
| LIVE-07 | Phase 4 | Pending |
| LIVE-08 | Phase 4 | Pending |
| LIVE-09 | Phase 4 | Pending |
| LIVE-10 | Phase 4 | Pending |
| SERIES-01 | Phase 5 | Pending |
| SERIES-02 | Phase 5 | Pending |
| SERIES-03 | Phase 5 | Pending |
| SERIES-04 | Phase 5 | Pending |
| SERIES-05 | Phase 5 | Pending |
| SERIES-06 | Phase 5 | Pending |
| SERIES-07 | Phase 5 | Pending |
| SERIES-08 | Phase 5 | Pending |
| HARD-01 | Phase 6 | Pending |
| HARD-02 | Phase 6 | Pending |
| HARD-03 | Phase 6 | Pending |
| HARD-04 | Phase 6 | Pending |
| HARD-05 | Phase 6 | Pending |
| HARD-06 | Phase 6 | Pending |
| HARD-07 | Phase 6 | Pending |

**Coverage:**

- v1 requirements: 54 total
- Mapped to phases: 54
- Unmapped: 0

---
*Requirements defined: 2026-09-20*
*Last updated: 2026-09-20 after roadmap creation*
