# Roadmap: Telu

## Overview

Telu's MVP is a validation-led sequence of six vertical capabilities. It first makes the Meetily Community Edition foundation measurable, gives every meeting one durable identity, and makes local and remote trust boundaries truthful. It then proves evidence-linked post-meeting knowledge, bounded sourced preparation, a cancellable live-assistance loop, and recurring-series memory before integrating the whole product across supported desktop platforms. Each phase has a real exit gate: downstream work may proceed only when the evidence it depends on is known and passing against thresholds declared from baseline or user-evaluation evidence before the relevant experiment or release.

Telu extends the active Tauri/Rust and Next.js/React Community Edition application. The archived Python/FastAPI backend and the separate Meetily Pro Agent API are not part of Telu's internal architecture.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): planned MVP work
- Decimal phases (2.1, 2.2): urgent insertions, if later required

- [ ] **Phase 1: Baseline Observability, Identity, and Trust Boundaries** - Make the existing desktop foundation measurable, recoverable, consistently identified, and truthful about every data destination.
- [ ] **Phase 2: Evidence-Linked Post-Meeting Knowledge** - Turn completed meetings into inspectable, correctable, evidence-backed knowledge without erasing history.
- [ ] **Phase 3: Bounded Sourced Preparation** - Let users prepare from an explicit, lifecycle-safe set of accepted knowledge and versioned documents using direct bounded context.
- [ ] **Phase 4: Cancellable Live-Loop Validation** - Prove that a tightly bounded live loop can surface timely, grounded value and remain silent when intervention would distract.
- [ ] **Phase 5: Recurring-Series Memory** - Carry only reviewed knowledge across explicitly managed meeting series with chronology, conflict, and repair semantics intact.
- [ ] **Phase 6: Cross-Platform Hardening and Release Confidence** - Demonstrate that the integrated MVP survives migration, lifecycle, privacy, and platform failure scenarios and earns defensible release claims.

## Validation Policy

- Unknown evidence does not pass a gate. A failed prerequisite blocks the dependent capability until it is repaired, narrowed, or explicitly removed from the milestone.
- Thresholds are declared from Phase 1 baseline evidence and representative user evaluation before the relevant experiment or release; this roadmap does not invent numeric targets.
- Phase 2 may begin only after canonical identity, final-transcript persistence, recovery, and trust-boundary prerequisites pass. Phase 4 has an additional hard dependency on Phase 1's continuous-speech freshness, backlog, stop, and resource evidence.
- Sensitive document use waits for a passing lifecycle/deletion canary. Series carry-forward waits for stable review and supersession semantics. Release waits for the held-out integrated gate.

## Phase Details

### Phase 1: Baseline Observability, Identity, and Trust Boundaries

**Goal:** Maintainers and users can rely on a measured, recoverable desktop foundation with one meeting identity and explicit local, LAN, or remote data boundaries.
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** BASE-01, BASE-02, BASE-03, BASE-04, BASE-05, BASE-06, IDENT-01, IDENT-02, IDENT-03, PRIV-01, PRIV-02, PRIV-03
**Success Criteria** (what must be TRUE):

  1. A maintainer can run the reproducible target-hardware scenario matrix and inspect monotonic end-to-end stage timing, real queue depth and oldest age, throughput, cancellation or supersession, resource use, provider choice, and errors without evaluation data leaving the device by default.
  2. A user can create, record, stop, restart, and repeatedly recover one logical meeting under a single Rust-owned identifier, with final transcript evidence persisted incrementally and idempotently and with capture gaps or incomplete state shown rather than hidden.
  3. A user can see which transcription, summary, document-processing, or generation path is local, LAN, or remote and its destination; an unavailable selected path fails visibly without silent provider fallback, and network-blocked local workflows attempt no undisclosed egress.
  4. A maintainer can record an evidence-backed go/no-go decision and declare the thresholds that later live experiments and release checks will use, including an explicit result for continuous-speech freshness, backlog age, resource bounds, stop behavior, recovery, and identity continuity.

**Non-goals:** Structured knowledge extraction, document ingestion, live suggestions, series memory, broad ASR or VAD redesign before measurement, the archived Python/FastAPI backend, or the separate Meetily Pro Agent API.
**Verification approach:** Run short, continuous, overlapping, sustained-system-audio, overload, stop, restart, crash, and repeated-recovery scenarios on the declared target matrix; inspect stage telemetry and resource samples; verify idempotent database state and stable evidence IDs; block network access in local mode; snapshot provider-boundary disclosures and failure behavior.
**Exit gate:** Phase 2 may proceed only when canonical meeting identity, stable final-transcript semantics, recovery reconciliation, capture-completeness reporting, and privacy-boundary checks pass. Phase 4 remains blocked unless continuous-speech freshness, backlog age, memory/resource behavior, and stop behavior are observable, bounded against the predeclared experiment thresholds, and passing. Unknown results count as failure.
**Principal risks / stop conditions:** Split or late identity, partial transcripts treated as durable evidence, placeholder queue metrics, unbounded freshness or memory, silent transcript loss, fabricated confidence, ambiguous provider destinations, undisclosed egress, or silent local-to-hosted fallback. Stop dependent work when any required measurement or trust boundary is unknown or failing.
**Plans:** 9/19 plans executed
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Prove one Rust-owned meeting identity through SQLite, Tauri IPC, and React before capture.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Propagate the same identity into recording metadata, IndexedDB, and legacy migration projection.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Persist stable final-only transcript evidence before canonical publication.

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-04-PLAN.md — Preserve final evidence in React/IndexedDB and close renderer acknowledgement timing.

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-05-PLAN.md — Bound transcription admission and expose the real queue conservation ledger.

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 01-06-PLAN.md — Make stop a durable idempotent close/drain/deadline transition.

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 01-07-PLAN.md — Render truthful finalization and mirror the committed lifecycle.

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 01-08-PLAN.md — Reconcile interrupted meetings transactionally under the same IDs.

**Wave 9** *(blocked on Wave 8 completion)*

- [x] 01-09-PLAN.md — Expose authoritative recovery, completeness, and time-ordered gaps in the UI.

**Wave 10** *(blocked on Wave 9 completion)*

- [ ] 01-10-PLAN.md — Resolve and enforce effective Local/LAN/Remote routes in Rust.

**Wave 11** *(blocked on Wave 10 completion)*

- [ ] 01-11-PLAN.md — Disclose routes in settings/actions and surface explicit no-fallback failures.

**Wave 12** *(blocked on Wave 11 completion)*

- [ ] 01-12-PLAN.md — Attribute every outbound attempt to its effective route.

**Wave 13** *(blocked on Wave 12 completion)*

- [ ] 01-13-PLAN.md — Control updater and analytics behavior during local canary runs.

**Wave 14** *(blocked on Wave 13 completion)*

- [ ] 01-14-PLAN.md — Narrow renderer capabilities and automate the application-side local canary.

**Wave 15** *(blocked on Wave 14 completion)*

- [ ] 01-15-PLAN.md — Capture monotonic stage and defensible resource/power evidence.

**Wave 16** *(blocked on Wave 15 completion)*

- [ ] 01-16-PLAN.md — Persist versioned local evaluation evidence with commit-ordered wiring.

**Wave 17** *(blocked on Wave 16 completion)*

- [ ] 01-17-PLAN.md — Write and validate atomic self-contained redacted run bundles.

**Wave 18** *(blocked on Wave 17 completion)*

- [ ] 01-18-PLAN.md — Add local Diagnostics inspection and review-before-export UX.

**Wave 19** *(blocked on Wave 18 completion)*

- [ ] 01-19-PLAN.md — Run the approved physical matrix and declare evidence-derived downstream gates.

**UI hint:** yes

### Phase 2: Evidence-Linked Post-Meeting Knowledge

**Goal:** Users can turn a completed meeting into trustworthy typed knowledge, inspect its exact evidence, and control what becomes eligible for future use.
**Mode:** mvp
**Depends on:** Phase 1 identity, final-transcript, recovery, completeness, and privacy exit prerequisites
**Requirements:** KNOW-01, KNOW-02, KNOW-03, KNOW-04, KNOW-05, KNOW-06, KNOW-07, KNOW-08
**Success Criteria** (what must be TRUE):

  1. A user can derive decisions, commitments or action items, open questions, and relevant facts from a completed meeting, and each candidate exposes a stable identity, derivation run, review state, and exact transcript evidence in context.
  2. A user can accept, correct, or reject each candidate independently and immediately see whether it is eligible for future context.
  3. A correction creates an inspectable revision linked to the original proposal and evidence, while rejected or superseded candidates remain excluded through regeneration and later projections unless explicitly restored.
  4. Telu abstains or displays unresolved fields when evidence is inadequate, and meeting or transcript deletion visibly invalidates or removes dependent knowledge rather than leaving apparently supported claims.
  5. A maintainer can evaluate extraction by item type, claim correctness, evidence coverage, exact-span support, attribution, duplication, and review outcome on representative meetings against thresholds declared before evaluation.

**Non-goals:** Document ingestion, live intervention, automatic promotion into series memory, destructive in-place edits, source-free summaries, or broad retrieval infrastructure.
**Verification approach:** Use representative held-out transcripts plus insufficient-evidence and degraded-capture cases; test exact evidence navigation and semantic support separately; exercise accept, reject, correct, restore, regenerate, delete, and retry scenarios; audit append-only lineage and future-context eligibility.
**Exit gate:** Phase 3 may proceed only when item correctness, exact evidence-span support, abstention behavior, correction lineage, regeneration safety, and deletion effects meet the predeclared representative-review thresholds. If provenance or user actions do not deterministically control future eligibility, stop before preparation, live assistance, or series memory can amplify the defect.
**Principal risks / stop conditions:** Fluent unsupported claims, reconstructed citations, destructive correction, rejected-item resurrection, incomplete evidence, mutable summary blobs, or one score conflating claim correctness with citation support. Stop when evidence lineage is ambiguous or review actions fail to propagate.
**Plans:** TBD
**UI hint:** yes

### Phase 3: Bounded Sourced Preparation

**Goal:** Users can prepare for an upcoming meeting from an explicit, bounded set of accepted knowledge and immutable document versions, with every factual output traceable to its source.
**Mode:** mvp
**Depends on:** Phase 2 evidence, review, correction, and deletion exit gate
**Requirements:** DOC-01, DOC-02, DOC-03, DOC-04, PREP-01, PREP-02, PREP-03, PREP-04, PREP-05
**Success Criteria** (what must be TRUE):

  1. A user can paste text or import an explicitly supported bounded local format under visible size and resource limits; each source has ownership, immutable version or hash, extraction status, and a stable format-appropriate locator, while embedded instructions cannot change Telu's policy or authority.
  2. A user can select an explicit bounded set of document versions and accepted meeting knowledge for an upcoming meeting.
  3. A user can generate a concise briefing and candidate questions, and every factual statement or question rationale opens the exact source version and locator that supports it.
  4. A user can inspect which sources were included, truncated, omitted, missing, deleted, or unavailable and why under deterministic per-source and total context budgets.
  5. Replacing or deleting a document consistently invalidates or repairs dependent briefings, citations, cached context, and derived claims, while a maintainer can measure supported-claim rate, source correctness, usefulness, stale content, and direct-context fit.

**Non-goals:** Embeddings, an external vector database, broad corpus chat, automatic source discovery, OCR or unrestricted office-format breadth, cloud parsing by default, or live assistance.
**Verification approach:** Run a versioned golden corpus for every accepted format and locator; test size, archive, and parser-resource limits plus adversarial prompt-like source text; use source perturbation and missing-evidence cases; run replace/delete crash canaries across SQLite, managed files, recovery stores, caches, citations, and derived artifacts; evaluate direct-context fit on held-out preparation tasks.
**Exit gate:** Phase 4 may proceed only when extraction and locator stability, claim support and correctness, deterministic budgeting, source-manifest transparency, prompt-injection resistance, and replace/delete propagation pass thresholds declared before the evaluation. Retrieval infrastructure remains deferred unless measured direct-context failure justifies a separately researched phase.
**Principal risks / stop conditions:** Citation drift, unsupported yet fluent briefings, incomplete deletion, unbounded or unsafe parsing, source instructions influencing system behavior, stale versions, or premature retrieval infrastructure. Do not ingest sensitive documents without a passing end-to-end lifecycle canary.
**Plans:** TBD
**UI hint:** yes

### Phase 4: Cancellable Live-Loop Validation

**Goal:** Users can opt into a calm live-assistance experiment that surfaces only timely, grounded, actionable context and safely stays silent or cancels when its work is no longer valid.
**Mode:** mvp
**Depends on:** Phase 1 live-readiness gate and Phase 2-3 evidence, correction, context-budget, and source-lifecycle gates
**Requirements:** LIVE-01, LIVE-02, LIVE-03, LIVE-04, LIVE-05, LIVE-06, LIVE-07, LIVE-08, LIVE-09, LIVE-10
**Success Criteria** (what must be TRUE):

  1. A user can enable or disable live assistance independently of recording; disabling, changing topic, changing relevant context, or ending the meeting cancels or supersedes pending assistance without interrupting durable capture.
  2. Live assistance consumes fresh transcript increments through a bounded non-blocking handoff and maintains at most one in-flight generation plus one latest pending request per meeting, so overload cannot stall recording or replay an old FIFO backlog.
  3. Every request carries immutable meeting scope, context snapshot, epoch, deadline, and source manifest, and stale or late results are fenced before provider dispatch, persistence, and display.
  4. A user sees at most one primary suggestion and one secondary item, only after freshness, evidence, relevance, novelty, duplicate, actionability, and capacity gates pass, with direct evidence inspection, dismiss, and feedback controls.
  5. A maintainer can replay deterministic timelines and measure phrase-to-visible p50/p95 latency, cancellation, grounding, usefulness, stale or distracting output, duplication, suppression reasons, and appropriate silence; the feature stays gated until all predeclared experiment thresholds pass.

**Non-goals:** Broad or autonomous coaching, high-frequency interventions, more than one in-flight generation, streamed partial output, a complex always-on topic model, or weakening durable capture to improve suggestion latency.
**Verification approach:** Replay timestamped full meeting timelines with overload, silence-required spans, topic changes, provider delay, ignored cancellation, source deletion, meeting switch, renderer reload, and disable/stop races; compare blinded human ratings against no-assistance and reactive baselines; verify all stage timestamps, fencing points, resource effects, and suppression reasons on the target matrix.
**Exit gate:** The live capability may advance only if latency, backlog/resource, cancellation, grounding, usefulness, distraction, duplication, staleness, and appropriate-silence thresholds were declared from prior evidence before the experiment and all pass. If they fail, stop, narrow the allowed intervention types, or keep the feature disabled; do not expand concurrency or intervention frequency.
**Principal risks / stop conditions:** Unbounded queueing, stale work persisting or displaying after cancellation, topic-epoch races, audio-path blocking, weakly grounded interruptions, duplicate suggestions, misleading latency measurement, or treating frequent output as success. Any failing or unknown live threshold is a stop condition for live expansion and the phase exit.
**Plans:** TBD
**UI hint:** yes

### Phase 5: Recurring-Series Memory

**Goal:** Users can carry reviewed knowledge across recurring meetings without losing chronology, inventing certainty, or leaking context between series.
**Mode:** mvp
**Depends on:** Phase 4 exit gate, plus the Phase 2 review model and Phase 3 preparation lifecycle remaining passing
**Requirements:** SERIES-01, SERIES-02, SERIES-03, SERIES-04, SERIES-05, SERIES-06, SERIES-07, SERIES-08
**Success Criteria** (what must be TRUE):

  1. A user can create a series, assign or reassign meetings, inspect membership, and repair mistakes without changing any meeting's durable identity.
  2. Only accepted or explicitly user-authored knowledge becomes series memory, and a user can inspect every remembered item's originating meeting, date, evidence, revisions, review action, and status history.
  3. Facts and decisions expose current, superseded, disputed, or unresolved states, commitments expose open, completed, or cancelled states, and conflicting evidence remains side by side until the user chooses to supersede, dispute, or leave it unresolved.
  4. A new meeting briefing carries forward current accepted items and open commitments or questions while visibly separating disputed, unresolved, superseded, rejected, and source-missing material.
  5. Deletion, document replacement, transcript correction, and series reassignment repair downstream memory and preparation, and adversarial renamed, duplicate-title, split, merge, reassignment, and deletion scenarios preserve chronology with no cross-series leakage.

**Non-goals:** Automatic title-, calendar-, or similarity-based grouping, calendar integration, shared team memory, autonomous truth selection by recency, unreviewed candidate promotion, or a mutable generated series-summary blob as source of truth.
**Verification approach:** Exercise story-based chronology and conflict fixtures plus adversarial series membership cases; compare current-state correctness separately from history preservation; verify accepted-only projection, as-of inspection, deletion/replacement repair, reassignment invalidation, and zero unauthorized cross-series retrieval.
**Exit gate:** Phase 6 may proceed only when current-state correctness, chronology preservation, conflict handling, accepted-only promotion, repair propagation, and cross-series isolation meet predeclared evaluation thresholds. If correction or supersession semantics remain unstable, stop rather than institutionalize them as durable memory.
**Principal risks / stop conditions:** Fuzzy grouping leaks, latest-mention-wins behavior, erased history, raw generated candidates becoming memory, unresolved conflicts presented as truth, or lifecycle changes leaving stale carry-forward. Any cross-series leak or ambiguous current-state derivation blocks exit.
**Plans:** TBD
**UI hint:** yes

### Phase 6: Cross-Platform Hardening and Release Confidence

**Goal:** Users can trust the integrated Telu MVP across its declared desktop platforms, data lifecycles, provider configurations, and recovery paths, and release claims match held-out evidence.
**Mode:** mvp
**Depends on:** Phase 5 exit gate and all earlier privacy, provenance, lifecycle, usefulness, and live-readiness gates remaining passing
**Requirements:** HARD-01, HARD-02, HARD-03, HARD-04, HARD-05, HARD-06, HARD-07
**Success Criteria** (what must be TRUE):

  1. Existing Meetily data migrates through every Telu schema revision without silent loss, and realistic migration, rollback, integrity, crash, and job-replay fixtures leave lifecycle operations complete or visibly recoverable.
  2. Supported packaged platforms pass permission grant, denial, revocation, restart-required, device loss or hot-swap, interrupted stop, process crash, restart, and recovery scenarios, with incomplete capture visibly reflected in downstream evidence and claims.
  3. A user can inspect and export meetings, accepted structured knowledge, and evidence in a durable local format.
  4. Settings, runtime UI, logs, and observed network behavior agree about local versus remote processing, data sent, destination, and failures; logs and evaluation exports redact sensitive content by default and require explicit action before leaving the device.
  5. The release remains blocked until a sequestered held-out suite passes every agreed grounding, source-correctness, usefulness, distraction, silence, latency, resource, recovery, deletion, privacy, migration, and series-memory threshold on the declared supported-platform matrix.

**Non-goals:** New product capabilities, wider document or provider breadth, embeddings, higher live concurrency, automatic series grouping, collaboration, or claims for untested platforms and configurations.
**Verification approach:** Run migration and rollback fixtures from realistic prior databases; replay deletion/version/regeneration/reassignment jobs through crash boundaries; execute the physical-device permission and recovery matrix; audit egress with a test proxy and network blocking; inspect redacted diagnostics and exports; run the locked held-out end-to-end suite without using it for tuning.
**Exit gate:** Release only when every threshold was declared before the release evaluation and all required held-out checks pass on every declared supported packaged platform. Unknown, excluded without disclosure, or failing results block release and the corresponding product, privacy, performance, or platform claim.
**Principal risks / stop conditions:** Silent migration loss, orphaned sensitive data, non-atomic lifecycle effects without visible recovery, authoritative output after partial capture, privacy-copy/runtime disagreement, unredacted diagnostics, contaminated evaluation, or claims extrapolated beyond tested systems. Any unresolved high-impact integrity, privacy, or held-out failure blocks release.
**Plans:** TBD
**UI hint:** yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6. Each phase's exit gate is enforced before its dependent phase starts.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Baseline Observability, Identity, and Trust Boundaries | 9/19 | In Progress|  |
| 2. Evidence-Linked Post-Meeting Knowledge | 0/TBD | Not started | - |
| 3. Bounded Sourced Preparation | 0/TBD | Not started | - |
| 4. Cancellable Live-Loop Validation | 0/TBD | Not started | - |
| 5. Recurring-Series Memory | 0/TBD | Not started | - |
| 6. Cross-Platform Hardening and Release Confidence | 0/TBD | Not started | - |

---
*Roadmap created: 2026-09-20*
*Granularity: coarse, retaining six explicit validation boundaries required by the product dependencies*
