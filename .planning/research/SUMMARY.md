# Project Research Summary

**Project:** Telu
**Domain:** Local-first, evidence-aware desktop companion for recurring conversations
**Researched:** 2026-09-20
**Confidence:** MEDIUM

## Executive Summary

Telu is a brownfield product fork of Meetily Community Edition, not a transcription add-on and not a client of Meetily's Pro Agent API. The existing self-contained Tauri/Rust application, Next.js/React interface, local transcription paths, SQLite persistence, recovery behavior, and provider integrations are a promising foundation, but they are not yet validated for Telu's target hardware or end-to-end latency needs. Experts should extend the active Community Edition desktop code directly: Rust owns identity, persistence, evidence, lifecycle policy, cancellation, provider orchestration, and evaluation; React owns presentation and user review. The archived Python/FastAPI backend and the separate Pro API are outside this architecture.

The recommended milestone is validation-led and ordered by dependency: establish a reproducible baseline and canonical meeting lifecycle; build evidence-linked, correctable post-meeting knowledge; add bounded sourced preparation; validate a cancellable live loop; project accepted knowledge into explicit meeting-series memory; then harden cross-platform lifecycle, privacy, recovery, and claims. SQLite/SQLx remains the canonical store, direct bounded context precedes retrieval infrastructure, and existing Tokio/Tauri primitives are sufficient. Each slice must produce its own evaluation evidence rather than postponing trust, privacy, or measurement until release.

The existential risks are stale transcripts and queued live work, split meeting identity, fluent but unsupported claims, destructive corrections, citation drift, incomplete deletion, cross-series leakage, and misleading local-only claims when a hosted or LAN provider is selected. Mitigation is structural: monotonic stage instrumentation and held-out replay tests; one Rust-created meeting ID before preparation or recording; immutable source versions and evidence links; append-only correction/supersession; explicit provider/data-flow disclosure; bounded queues plus cancellation and generation fencing; and stop gates that prevent later phases from building on unvalidated assumptions.

## Key Findings

### Recommended Stack

Preserve the repository-resolved stack throughout the validation milestone so ecosystem upgrades do not confound product evidence. Telu should remain one packaged desktop application, using Rust services and SQLx migrations behind typed Tauri commands/events. Add dependencies only when a validated phase requires them. See [STACK.md](./STACK.md) for exact versions and source details.

**Core technologies:**

- **Tauri 2.11.1 + Rust 2021 (declared MSRV 1.77):** native shell, lifecycle, packaging, IPC, and policy enforcement — extend the active Community Edition application, not a web service.
- **Next.js 14.2.35 + React 18.3.1 + TypeScript 5.9.3:** statically exported desktop interface — keep durable identity and domain truth in Rust.
- **SQLite + SQLx 0.8.6:** canonical local store for meetings, transcripts, evidence, documents, knowledge, series state, and evaluation data — normalized relational records, not mutable summary blobs.
- **Tokio 1.52.3 + tokio-util 0.7.18:** async work, bounded channels, timeouts, and `CancellationToken` — add generation fencing because cooperative cancellation alone cannot reject late writes.
- **Serde, UUID, Chrono, tracing, sysinfo, and Reqwest:** typed provider contracts, stable identity, chronology, redacted diagnostics, resource measurement, and explicit remote-provider calls — all already fit the repository.
- **Whisper/ONNX transcription paths:** preserve and benchmark before changing segmentation, worker count, or queueing.

No new production dependency is required for baseline observability, structured knowledge, direct context, cancellation, or series memory. Begin document validation with pasted text and UTF-8 `.txt`/`.md`. Consider `pdf-extract` and narrow `zip`/`quick-xml` DOCX parsing only after golden-corpus, resource-limit, cross-platform, and Rust 1.77 compatibility gates. Add FTS5 only after direct selection demonstrably fails; defer embeddings, vector databases, agent frameworks, hosted telemetry, and parser sidecars.

Critical repository alignment work includes pinning the accepted baseline/toolchains, resolving the ignored CPAL workspace patch, verifying packaged SQLite features/version, enabling SQLite foreign keys per connection, narrowing broad filesystem capabilities before ingestion, and making every remote destination explicit. The public Pro Agent API is a separate product surface and provides no basis for claims about private Community Edition internals.

### Expected Features

The first milestone validates one loop: reviewed meeting knowledge becomes bounded preparation context, optionally informs a tightly controlled live intervention, and then carries forward through an explicit series chronology. See [FEATURES.md](./FEATURES.md) for detailed acceptance signals and evaluation measures.

**Must have (table stakes):**

- Reproducible full-path baseline: transcript freshness, real queue depth/age, CPU/memory, persistence, stop behavior, and recovery on target hardware.
- One durable meeting identity created before preparation or recording and reused by recording, recovery, documents, transcript, analysis, and series membership.
- Typed decisions, commitments/actions, open questions, and facts with stable IDs and exact transcript evidence.
- Per-item accept, correct, and reject behavior with visible review status, append-only lineage, regeneration safety, and deterministic downstream consequences.
- Explicit bounded source selection and concise pre-meeting briefings/questions whose factual claims open the exact source version and locator.
- A live loop with bounded concurrency, topic/request epochs, cancellation, late-result fencing, staleness/grounding/novelty gates, calm display limits, feedback, global off, and deliberate silence.
- Manual, correctable series grouping; accepted-only carry-forward; chronology; current/superseded/disputed/unresolved states; and conflict review.
- Truthful local-first behavior: no silent remote fallback, visible destination and context manifest, local evaluation by default, and lifecycle-complete deletion.

**Should have (competitive):**

- Evidence always one interaction away across knowledge, briefings, suggestions, and memory.
- Corrections that reliably change future behavior while preserving proposal and source history.
- Deliberate silence treated as a measured product outcome rather than missing output.
- Temporal truth and inspectable conflicts rather than semantic similarity or latest-mention-wins.
- Whole-loop spoken-phrase-to-visible latency and stale-result rejection.
- Source-lifecycle integrity across replacement, deletion, caches, derived artifacts, and later indexes.

**Defer (v2+ or until a measured gate fails):**

- Broad chat/RAG across all meetings, embeddings, an external vector store, or autonomous memory.
- Autonomous coaching, high-frequency interventions, bots, and automatic meeting joining.
- Cloud collaboration, teams/roles, calendar integration, and automatic series assignment.
- OCR, full-fidelity office-document support, cloud parsing, and advanced publishing/export.
- More than one in-flight live generation, streaming output, or complex topic models without measured benefit.

**MVP implication:** the first shippable product proof is the post-meeting knowledge slice, but only after baseline evidence and canonical identity exist. If item correctness, evidence-span correctness, and correction behavior do not meet an agreed gate, stop before preparation, live assistance, or series memory amplify unreliable knowledge.

### Architecture Approach

Use a single authoritative Rust core with thin Tauri adapters and a presentation-focused React frontend. Create the meeting in SQLite before any preparation or recording begins; persist final transcript segments incrementally with stable IDs; store knowledge as reviewed assertions linked to immutable evidence; assemble direct context deterministically under explicit budgets; and treat series memory as a relational projection over accepted items. Generated summaries may be derived views, never the source of truth. See [ARCHITECTURE.md](./ARCHITECTURE.md) for schema and data-flow detail.

**Major components:**

1. **MeetingSessionService + TranscriptRepository** — canonical ID, lifecycle transitions, incremental/idempotent transcript persistence, recovery reconciliation, and capture completeness.
2. **KnowledgeService + EvidenceService** — structured proposals, evidence resolution, accept/correct/reject actions, revisions, provenance, and supersession.
3. **DocumentService** — app-owned immutable versions, bounded extraction, stable locators, attachment, replacement, and recoverable deletion.
4. **ContextAssembler** — deterministic accepted-knowledge and selected-document bundles with per-source/total budgets and an included/omitted manifest.
5. **LiveAssistSupervisor** — bounded latest-work policy, request epochs, cancellation, generation fencing, freshness/grounding/intervention gates, and one in-flight generation per meeting.
6. **EvaluationRecorder** — local stage timing, queue/resource metrics, silence/suppression reasons, user outcomes, and sanitized experiment export.
7. **React feature services and views** — source selection, review and correction, evidence inspection, suggestion rendering, feedback, and render acknowledgement; never a second durable truth store.

**Patterns to follow:** thin commands and policy-owning services; provenance persisted transactionally with each subject; immutable source versions; append-only correction and supersession; cancellation plus commit/display fencing; events for notification with commands for recoverable reads; and durable deletion jobs for SQLite/filesystem coordination.

### Critical Pitfalls

1. **Mistaking model runtime for transcript freshness** — measure from spoken audio through segmentation, queueing, transcription, context, generation, and rendered acknowledgement; Phase 4 cannot start until continuous-speech freshness is observable and bounded.
2. **Preserving every chunk through unbounded queues** — expose real backlog and oldest-item age, keep durable recording separate, and make live assistance bounded/latest-wins so overload degrades suggestions before capture.
3. **Allowing split or late meeting identity** — create one Rust-owned UUID before preparation/recording and prove it survives crashes and repeated recovery without duplicates.
4. **Treating cancellation or UI suppression as stale-work safety** — propagate immutable scope/epoch/deadline data and revalidate before provider dispatch, persistence, and display.
5. **Mutable, drifting, or unsupported knowledge** — keep proposals and source versions immutable; cite supplied evidence IDs; validate claim support separately from claim correctness; record correction as replacement rather than overwrite.
6. **Incomplete deletion and misleading privacy claims** — define an ownership graph, purge every representation through recoverable jobs/tests, and distinguish local capture/storage from explicitly selected remote processing.
7. **Poisoning series memory by fuzzy grouping or latest-mention-wins** — use explicit correctable membership, source scope, chronology, supersession/conflict edges, and accepted-only promotion.
8. **Optimizing intervention frequency instead of usefulness** — use explicit novelty, evidence, actionability, duplicate, display-capacity, and interruption-budget gates; evaluate full timelines including silence-required windows.

## Implications for Roadmap

The roadmap should use six vertical validation phases. Baseline observability includes the identity and lifecycle corrections every later slice depends on; this preserves the explicit priority order while absorbing the architecture research's prerequisite grouping.

### Phase 1: Baseline Observability, Identity, and Trust Boundaries

**Rationale:** Every later result is uninterpretable without full-path measurements and one durable meeting identity. Static inspection shows unbounded queues, placeholder queue metrics, split IDs, broad file permissions, and provider-boundary ambiguity.

**Delivers:** pinned/reproducible baseline; target-hardware scenario matrix; monotonic stage timestamps; real queue age/depth and resource metrics; stable pre-recording ID; idempotent incremental transcript persistence and recovery mapping; per-source capture completeness; evaluation event model; foreign-key/lifecycle foundations; provider/data-flow registry and truthful disclosure.

**Addresses:** baseline and measurement, stable identity, local-first disclosure, no silent fallback, privacy-safe local evaluation.

**Avoids:** optimizing ASR runtime instead of freshness, invisible backlog, split recovery identity, fabricated confidence, partial transcripts as durable evidence, misleading local-only claims.

**Exit gate:** continuous-speech and overload behavior, stop/recovery, persistence, resource use, and identity continuity are measurable. Do not enter live implementation unless transcript/backlog age and memory behavior are bounded on the target matrix.

### Phase 2: Evidence-Linked Post-Meeting Knowledge

**Rationale:** This is the lowest-latency-risk Telu value slice and defines the assertion, provenance, review, and status model reused by preparation and series memory.

**Delivers:** derivation runs; typed candidate items; immutable transcript evidence; source inspection; accept/correct/reject; append-only revisions; regeneration-safe deduplication; explicit uncertainty; local correctness/evidence evaluation; deletion effects.

**Addresses:** typed extraction, per-item evidence, review-state visibility, correction consequences, abstention, and post-meeting evaluation.

**Avoids:** destructive correction, unsupported claims, citation reconstruction, rejected-item resurrection, mutable memory blobs.

**Exit gate:** representative review sets meet agreed item and evidence-span quality, and user actions reliably control eligibility for future context.

### Phase 3: Bounded Sourced Preparation

**Rationale:** Preparation reuses the Phase 2 evidence contract while adding source lifecycle risk without real-time constraints. Direct, user-selected context tests the product need before retrieval infrastructure.

**Delivers:** pasted text and bounded document import; immutable versions/hashes; stable page/section/paragraph locators; narrow filesystem scopes; source ownership and deletion jobs; deterministic context budgets/manifests; sourced concise briefings and candidate questions; replacement/deletion invalidation.

**Addresses:** explicit context selection, version-aware sources, sourced briefings/questions, visible truncation/omission, missing-source behavior.

**Avoids:** citation drift, prompt-like source instructions, zip/resource abuse, incomplete deletion, premature FTS/embeddings.

**Exit gate:** golden-corpus extraction and locator tests pass; delete/replace canaries cover SQLite, files, recovery stores, caches, and derived claims; direct-context fit and miss rates are quantified.

### Phase 4: Cancellable Live-Loop Validation

**Rationale:** Live assistance is the highest-risk capability and may proceed only with Phase 1 freshness evidence plus Phase 2/3 grounding primitives. It is an experiment behind a feature flag, not a broad coaching launch.

**Delivers:** stable transcript input; bounded nonblocking handoff; one in-flight generation and one latest pending request; topic/session epochs; cooperative cancellation plus generation fence; context snapshot; staleness, evidence, novelty, duplicate, and intervention gates; one primary suggestion; global off/dismiss; render acknowledgement; deterministic replay and human usefulness/silence evaluation.

**Addresses:** fresh input, bounded work, stale-result suppression, grounding, value/novelty, deliberate silence, calm presentation, evidence inspection, and whole-loop metrics.

**Avoids:** FIFO backlog replay, late writes, topic-change races, suggestion-frequency optimization, distraction, audio-path blocking.

**Exit gate:** predeclared p50/p95 latency, cancellation, resource, useful/stale/distracting, duplicate, grounding, and appropriate-silence thresholds pass. If not, stop or narrow the intervention types.

### Phase 5: Recurring-Series Memory

**Rationale:** Series memory should consume a correction model proven in real post-meeting use; implementing it earlier would freeze untested terminology and conflict semantics.

**Delivers:** stable manual series membership and repair; accepted-only projection; source-scoped chronology; current/superseded/disputed/unresolved and commitment states; reviewed conflicts; as-of inspection; controlled carry-forward into preparation; reassignment and deletion repair.

**Addresses:** series grouping, chronological history, temporal status, conflict presentation, carry-forward control, and series correctness evaluation.

**Avoids:** title/similarity-based cross-series leakage, automatic truth by recency, erased history, raw candidates becoming durable memory.

**Exit gate:** adversarial renamed/duplicate-title/split/merge/reassignment scenarios show no unauthorized cross-series retrieval, and current-state accuracy is measured separately from history preservation.

### Phase 6: Cross-Platform Hardening and Release Claims

**Rationale:** Hardening integrates all lifecycle surfaces and turns phase evidence into defensible release boundaries; it must not be used to postpone basic safeguards from earlier slices.

**Delivers:** migration/rollback fixtures from Meetily data; crash/recovery and deletion-job replay; platform permission/revocation/hot-swap matrix; provider failure and egress audit; retention/logging controls; durable local export/inspection; integrity tooling; held-out end-to-end release suite and calibrated product/privacy claims.

**Addresses:** recovery, atomic lifecycle operations, migrations, export/ownership, provider audit, and release gates.

**Avoids:** authoritative output from partial capture, orphaned sensitive data, curated-demo claims, contaminated evaluation, platform-generalized permission assumptions.

**Exit gate:** agreed grounding, source correctness, usefulness/distraction/silence, latency/resource, recovery, deletion, privacy, migration, and series-memory thresholds pass on supported packaged platforms.

### Phase Ordering Rationale

- Phase 1 is the dependency root: identity, final transcript semantics, measurement, privacy boundaries, and lifecycle integrity are required by every foreign key and evaluation claim.
- Phase 2 proves provenance and correction asynchronously before those records influence briefings or memory.
- Phase 3 reuses accepted knowledge and evidence rendering while validating document ownership/version/deletion under bounded direct context.
- Phase 4 begins only after transcript freshness is measurable and the same context/evidence primitives can ground and fence live work.
- Phase 5 follows observed correction behavior so chronology and conflict UX are based on real lifecycle evidence, not an invented memory summary.
- Phase 6 integrates and audits the system, while each preceding phase still owns local safeguards and acceptance tests.

**Roadmap stop conditions:** stop before live work if continuous-speech freshness/backlog/resource bounds are unknown; before structured knowledge if stable identity is not proven; before sensitive documents if lifecycle deletion lacks a canary; before series memory if review/supersession semantics are unstable; and before any evidence-backed or local-only claim if source support or data egress is ambiguous.

### Research Flags

Phases needing deeper phase-specific research:

- **Phase 1:** target hardware/OS/language matrix; continuous-speech segmentation alternatives; queue measurement and capacity evidence; CPAL patch/runtime verification; SQLite packaging/WAL safety; crash/recovery migration.
- **Phase 2:** assertion/evidence schema; transcript revision anchors; correction lineage and user terminology; calibrated versus unavailable confidence; representative extraction labels.
- **Phase 3:** accepted formats; PDF/DOCX corpus and MSRV compatibility; locator stability; parser resource/security limits; deletion semantics for accepted claims; measurable threshold for FTS5 or embeddings.
- **Phase 4:** actionable-age thresholds by intervention type; topic stability; overload/coalescing policy; provider cancellation/streaming behavior; novelty and interruption budgets; deliberate-silence annotation protocol.
- **Phase 5:** effective-time semantics; series membership repair; conflict/supersession language; as-of queries; behavior for source deletion and reassignment.
- **Phase 6:** supported-platform permission behavior on physical devices; provider/account retention disclosures; diagnostic-log policy; legal/product wording and statistical release thresholds.

Well-documented patterns that do not need broad exploratory research:

- Tauri command/event integration, SQLx migrations and transactions, normalized SQLite storage, Rust service boundaries, Serde DTO validation, Tokio cancellation primitives, and React presentation adapters. Planning should still verify repository-specific seams.
- Append-only revisions, generation fencing, immutable version references, migration fixtures, and deterministic replay testing. These need design decisions and tests, not a search for a new framework.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Exact lockfile versions and local seams were inspected and align with official documentation, but the checkout is one revision and runtime/MSRV/cross-platform behavior is unverified. |
| Features | MEDIUM | Trust, evidence, correction, disclosure, and sequencing are well supported; Telu-specific thresholds, interruption value, and terminology require user and target-hardware evidence. |
| Architecture | HIGH for boundaries; MEDIUM for live parameters | The dual-ID flow, repositories, command registry, cancellation pattern, and queues were directly inspected. Queue sizes, time windows, topic policy, and retrieval need empirical gates. |
| Pitfalls | HIGH for checkout risks; MEDIUM-HIGH for mitigations | Identity, queueing, telemetry, deletion, and provider-boundary risks are directly evidenced. Cross-platform severity and product-policy thresholds remain unmeasured. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **No benchmark-validated foundation:** pin the accepted commit/toolchains only after Phase 1 measurements on an explicit hardware/OS/model/language matrix.
- **No numeric success thresholds:** predeclare phase metrics and derive thresholds from baseline and representative users; do not invent them in the roadmap.
- **Continuous-speech freshness is unresolved:** compare bounded segmentation/partial strategies without sacrificing transcript integrity or evidence anchors.
- **Exact document scope is undecided:** begin with pasted text and `.txt`/`.md`; make PDF/DOCX acceptance depend on a representative golden corpus and resource/security tests.
- **Deletion semantics for accepted knowledge need a product decision:** choose whether source deletion purges it, retains an explicitly user-authored source-unavailable assertion, or asks the user.
- **Intervention policy is empirically open:** actionable age, novelty, topic change, duplicate rules, budgets, and silence labels require replay plus human comparison.
- **Series terminology and temporal rules need validation:** especially disputed versus unresolved, effective time, and conflict repair.
- **Remote-provider boundaries vary by configuration/account:** audit actual destinations, context sent, retention assumptions, and cancellation for each supported route.
- **SQLite and platform packaging details need verification:** foreign-key enforcement, FTS5 availability, WAL version/safety, filesystem scopes, and physical-device permissions cannot be inferred from dependency versions alone.

## Sources

### Primary (HIGH confidence)

- [PROJECT.md](../PROJECT.md) — authoritative product priority, constraints, exclusions, and validation-led sequencing.
- [STACK.md](./STACK.md), [FEATURES.md](./FEATURES.md), [ARCHITECTURE.md](./ARCHITECTURE.md), and [PITFALLS.md](./PITFALLS.md) — dimension research synthesized here.
- Inspected Community Edition checkout at `0e36d8835ad9e81f356412954a39f4771139aa2a` — active Tauri/Rust frontend, SQLx migrations/repositories, audio/transcription pipeline, summary provider orchestration, recovery, and deletion paths.
- Repository lockfiles/manifests — resolved Tauri, Next.js, React, TypeScript, SQLx, Tokio, transcription, and supporting dependency versions.
- Official Tauri, Tokio, SQLx, SQLite, Rust, Next.js, Apple, and Microsoft documentation cited in the dimension research — IPC, capabilities, cancellation/backpressure, persistence, testing, and platform permissions.

### Secondary (MEDIUM confidence)

- Meetily Community Edition repository, releases, privacy policy, and archived-backend documentation — public product/architecture claims cross-checked against the checkout.
- Microsoft HAX, Google PAIR, NIST AI measurement/risk guidance, W3C PROV-O, and local-first software research — correction, control, provenance, evaluation, and ownership patterns.
- Peer-reviewed work on proactive assistants, streaming ASR endpointing, meeting-summary evaluation, factual consistency, attribution, and human-rating protocols — design and evaluation guidance that still requires Telu-specific validation.
- Official provider privacy/data-control documentation — destination and retention constraints that remain account, endpoint, and routing dependent.

### Tertiary (LOW confidence)

- None used as a roadmap foundation. Exact thresholds and product claims remain intentionally unasserted until Telu's own benchmarks and user studies exist.

---
*Research completed: 2026-09-20*
*Ready for roadmap: yes*
