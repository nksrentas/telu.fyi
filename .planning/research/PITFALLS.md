# Domain Pitfalls

**Domain:** Local-first, evidence-aware meeting companion built as a Meetily desktop fork  
**Project:** Telu  
**Researched:** 2026-09-20  
**Overall confidence:** HIGH for checkout-specific risks; MEDIUM for ecosystem and research-derived mitigations

## Phase Vocabulary Used Here

The roadmap does not yet exist, so this document maps risks to the following recommended phase responsibilities. The names may change, but the gates and order should not.

| Phase | Required responsibility |
|---|---|
| **Phase 1 — Baseline, Identity, Privacy, and Observability** | Pin the Meetily fork; benchmark capture/transcription on target hardware; establish stable meeting identity; inventory data flows; expose real queue, age, recovery, and provider-boundary telemetry. |
| **Phase 2 — Evidence-Backed Structured Knowledge** | Extract decisions, commitments, actions, and open questions with immutable evidence; support correction, rejection, and audit history. |
| **Phase 3 — Bounded Documents and Pre-Meeting Briefings** | Add document ingestion, source/version lifecycle, bounded direct context, briefing generation, and deletion propagation. |
| **Phase 4 — Bounded Live Assistance** | Add deadline-aware, cancellable, backpressured live work; staleness and duplication policy; strict intervention budgets and deliberate silence. |
| **Phase 5 — Recurring-Series Memory** | Add explicit series membership, chronology, supersession, disputes, carry-forward rules, and repair tools. |
| **Phase 6 — Cross-Platform Hardening and Claims** | Validate representative workflows, permissions, recovery, privacy disclosures, performance, and product claims across supported platforms. |

## Critical Pitfalls

Mistakes in this section can force an information-model rewrite, expose sensitive meeting data, or invalidate the product thesis.

### Pitfall 1: Treating ASR inference time as transcript freshness

**What goes wrong:** A “fast” local Whisper or Parakeet call hides the dominant delay before the call begins. Meetily’s live VAD closes a segment only after 500 ms of qualifying silence and explicitly has no bounded segmentation for uninterrupted speech. Long monologues or continuous system audio can therefore withhold relevant words until the speaker pauses or the recording stops.

**Why it happens:** Teams benchmark isolated clips or model runtime rather than the complete path from spoken phrase through mixing, endpointing, queue wait, transcription, context selection, generation, and rendering. The current pipeline ignores its `target_chunk_duration_ms`; VAD alone controls live segmentation.

**Consequences:** Live suggestions arrive after the topic has changed; memory extraction is based on unusually large chunks; resource use spikes; the architecture is optimized around the wrong bottleneck. A later maximum-segment or rolling-partial design may require changes to timestamping, deduplication, and evidence anchors.

**Warning signs:**

- Transcript looks fresh for short question-answer exchanges but freezes during 20–60 second speech runs.
- Median latency looks acceptable while p95/p99 grows without bound.
- Final transcript quality is good, but spoken-phrase-to-visible age is not recorded.
- VAD logs warn about a large accumulated speech buffer.

**Prevention:** In Phase 1, define transcript freshness as age of the newest visible stable word, not ASR request duration. Benchmark short utterances, 30/60/120-second uninterrupted speech, continuous system audio, overlapping speakers, and slow hardware. Record every stage timestamp. Do not commit to the live-assistance architecture until a bounded continuous-speech strategy is proven without unacceptable duplication or word loss.

**Detection / verification:** Replay timestamped fixtures in real time; assert p50/p95/p99 spoken-word-to-transcript age and maximum silence-free blackout. Compare emitted segment boundaries with the reference audio timeline. Run the same matrix for every supported model/hardware profile.

**Phase gate:** **Phase 1 must prevent this. Phase 4 may not start until the freshness gate passes.**

**Evidence:** `frontend/src-tauri/src/audio/pipeline.rs` documents the 500 ms live policy and open bounded-segmentation issue; `frontend/src-tauri/src/audio/vad.rs` requires a speech-end transition. Streaming-ASR endpointing research likewise identifies the tradeoff between early truncation and late perceived response. **Confidence: HIGH.**

### Pitfall 2: “Zero chunk loss” implemented with unbounded memory and invisible backlog

**What goes wrong:** Audio capture, pipeline, recording, and transcription use unbounded Tokio channels. Transcription preserves chronological order with exactly one worker. If arrival rate exceeds processing rate, the app accumulates stale work and memory rather than applying backpressure, degrading quality, or dropping work by an explicit policy. Worse, both exposed `get_transcription_status` implementations report a constant queue size of zero.

**Why it happens:** “Never drop a chunk” is treated as the only correctness property. Queue age, memory growth, user-visible freshness, and shutdown time are not part of correctness.

**Consequences:** Suggestions are generated from old speech, shutdown can block indefinitely while draining, memory grows during long meetings, and dashboards falsely claim no backlog. Scaling the worker count later threatens chronological emission and deduplication.

**Warning signs:**

- `chunks_queued - chunks_completed` grows during recording.
- RSS and stop latency grow with meeting length or slower models.
- Queue status remains zero while worker progress events show pending chunks.
- Suggestions refer to a topic from tens of seconds earlier.

**Prevention:** Phase 1 must replace fake status with real stage counters, oldest-item age, memory/queue watermarks, throughput, and dropped/coalesced counters. Phase 4 must use bounded queues and an explicit overload policy: coalesce transcript deltas, cancel or supersede suggestion work, preserve durable transcript audio separately, and degrade live assistance before capture or recording.

**Detection / verification:** Run overload tests where ASR and generation are deliberately slower than real time for at least an hour. Assert fixed memory ceilings, bounded oldest-live-work age, a deterministic degradation event, and nonblocking stop. Verify durable transcript completeness separately from live-suggestion freshness.

**Phase gate:** **Phase 1 adds observability and proves the baseline; Phase 4 implements bounded live queues before any live-assistant release.**

**Evidence:** `recording_state.rs`, `recording_manager.rs`, `pipeline.rs`, and `transcription/worker.rs` create unbounded channels; `worker.rs` sets `NUM_WORKERS` to 1; `lib.rs` and `recording_commands.rs` return placeholder queue metrics. **Confidence: HIGH.**

### Pitfall 3: Cancellation that stops the UI but not stale computation or writes

**What goes wrong:** A topic change, meeting stop, document deletion, provider switch, or new generation supersedes old live work, but the old task still retrieves, calls a model, consumes cost, and can publish or persist after the new state wins.

**Why it happens:** Cancellation is added as a button-level boolean rather than as a generation/epoch contract propagated through transcript selection, retrieval, provider calls, rendering, and persistence. “Ignore the result in React” does not stop remote work or stale database writes.

**Consequences:** Late suggestions distract users, deleted evidence reappears, provider changes leak data to the prior provider, and a stale result overwrites a corrected one. Live assistance becomes nondeterministic under exactly the topic changes it must handle.

**Warning signs:**

- Old suggestions flash after a newer transcript window is visible.
- Provider usage continues after disabling assistance.
- A cancelled task appears in history or memory.
- There is no request epoch containing meeting ID, transcript watermark, source-version set, policy version, and deadline.

**Prevention:** Give each derived operation an immutable scope token: stable meeting ID, monotonic transcript watermark, source-version IDs, generation ID, and absolute usefulness deadline. Propagate a cancellation token to every cancellable stage. Before display and before commit, revalidate that the token is current and all evidence versions still exist. Use compare-and-set or generation-scoped writes, following the checkout’s existing summary-process pattern that guards stale completions by `started_at`.

**Detection / verification:** Deterministic race tests must cancel at each boundary: before retrieval, during local inference, during remote request, after response but before render, and before database commit. Assert zero stale UI insertions and zero stale durable writes.

**Phase gate:** **Phase 4 owns the live contract; Phase 2 and Phase 3 must first establish generation-safe persistence patterns.**

**Evidence:** The summary subsystem already includes generation-specific cancellation and stale-completion checks, demonstrating the necessary local pattern; the proposed live loop does not yet exist. **Confidence: HIGH.**

### Pitfall 4: Optimizing suggestion frequency instead of the right to interrupt

**What goes wrong:** A system that produces many plausible facts is scored as productive even when suggestions are obvious, duplicative, weakly sourced, late, or no longer actionable. “Suggestion generated” becomes a success event, and silence looks like failure.

**Why it happens:** Offline datasets overrepresent moments with known answers and omit the negative class: stretches where the correct action is to stay silent. Teams tune generation before specifying intervention policy.

**Consequences:** Users stop looking at Telu, disable assistance, or mistake visual activity for reliable value. More retrieval and a better model cannot fix an interruption-policy failure.

**Warning signs:**

- No explicit intervention budget per minute/topic.
- Evaluations lack “should remain silent,” duplicate, stale, and already-known labels.
- Acceptance rate rises only because the UI has no dismiss/reject reason.
- Equivalent suggestions reappear after minor transcript changes.

**Prevention:** Separate candidate generation from a deterministic policy gate covering novelty, evidence strength, current-topic relevance, remaining actionability, recent duplicates, display capacity, and interruption budget. Default to silence on uncertainty. Keep only one or two visible interventions and expire them automatically.

**Detection / verification:** Evaluate on full meeting timelines, including long negative spans. Report useful, distracting, stale, incorrect, duplicate, and silence-correct rates plus time-to-dismiss and follow-through. Require blinded human comparison against no-assistance and reactive baselines on target hardware.

**Phase gate:** **Phase 4 must prevent this; Phase 6 validates it in representative use.**

**Evidence:** Telu’s project thesis requires deliberate silence. LlamaPIE treats “when to respond” as a separate problem and evaluates a mostly silent proactive design, but its results do not substitute for Telu-specific meeting evaluation. **Confidence: HIGH for the requirement; MEDIUM for transferred research guidance.**

### Pitfall 5: Creating meeting identity only when final persistence succeeds

**What goes wrong:** Preparation, live capture, crash recovery, and final SQLite persistence refer to different records. Current Meetily creates an IndexedDB ID such as `meeting-{timestamp}` at recording start, but `save_transcript` always creates a new UUID-based SQLite meeting. Recovery also saves into a newly generated SQLite ID.

**Why it happens:** Identity is modeled as an output of “save transcript” rather than the anchor created before any documents, series membership, live suggestions, or checkpoints exist.

**Consequences:** Crash recovery can orphan pre-meeting documents and live evidence, duplicate one meeting, lose series links, or attach corrected facts to the wrong logical meeting. Retrofitting stable identity later touches every foreign key and artifact.

**Warning signs:**

- Recovery returns a different meeting ID than the interrupted session.
- Mapping tables or title/timestamp heuristics are needed to reconnect artifacts.
- A meeting has multiple “temporary,” “recovered,” and “saved” identities.
- Folder paths or timestamps are treated as identity.

**Prevention:** Create one durable UUID before preparation or recording begins and carry it through IndexedDB, checkpoints, folder metadata, SQLite, events, summaries, documents, suggestions, and series membership. Make create/finalize/recover idempotent. Store recording attempts separately from logical meeting identity.

**Detection / verification:** Crash at each lifecycle boundary and assert that every recovered artifact retains the original ID and has exactly one owning meeting. Re-run recovery twice and assert no duplicate meeting or derived knowledge.

**Phase gate:** **Phase 1 must prevent this before Phase 2 adds foreign-keyed knowledge.**

**Evidence:** `TranscriptContext.tsx`, `indexedDBService.ts`, `useTranscriptRecovery.ts`, and `database/repositories/transcript.rs` show the current split identity. **Confidence: HIGH.**

### Pitfall 6: Treating user correction as destructive text editing

**What goes wrong:** A user edits “Budget approved: €50k” to “Budget discussed, not approved,” and Telu overwrites the generated row. The system can no longer distinguish model extraction, user rejection, corrected claim, source transcript, or later supersession.

**Why it happens:** Structured items are designed as mutable summary fields instead of claims with provenance and lifecycle. Rejection is implemented as delete, and correction as update-in-place.

**Consequences:** The audit trail disappears; rejected hallucinations can be regenerated; learning/evaluation data becomes mislabeled; later series memory cannot tell whether a fact changed in the meeting or the extraction was wrong.

**Warning signs:**

- One mutable `text` and `status` row is the entire knowledge model.
- “Edit” changes evidence spans or source text.
- Re-running extraction resurrects rejected items.
- No distinction exists among rejected, corrected, disputed, superseded, and resolved.

**Prevention:** Preserve model proposals as immutable assertions linked to immutable evidence spans and extraction version. Record user actions as separate decisions: accept, reject-with-reason, correct-by-replacement, dispute, resolve, or supersede. A corrected assertion points to the prior assertion and its own evidence or explicit user attestation. Never alter the transcript to make a claim appear grounded.

**Detection / verification:** Scenario tests cover reject/regenerate, correct/re-extract, undo correction, two conflicting user edits, and export/import. Assert the complete lineage remains inspectable and that rejected items do not silently re-enter memory.

**Phase gate:** **Phase 2 must prevent this; Phase 5 consumes the lifecycle and must not invent a second status model.**

**Evidence:** The current checkout persists transcripts and summaries but has no Telu structured-claim lifecycle yet, making Phase 2 the last inexpensive point to define it. **Confidence: HIGH.**

### Pitfall 7: Evidence pointers that silently drift after source edits or transcript reprocessing

**What goes wrong:** A claim cites page 7, paragraph 3, or transcript character offsets. The source document is replaced, OCR changes, or a meeting is retranscribed; the pointer still resolves, but to different content—or resolves nowhere.

**Why it happens:** A citation is stored as a display string or mutable file path rather than a reference to an immutable source version and exact evidence snapshot.

**Consequences:** Telu shows authoritative-looking but false evidence. Deletion and re-ingestion create dangling knowledge. Fixing it later requires reprocessing every claim and changing UI contracts.

**Warning signs:**

- Citations use filename plus page number only.
- Document replacement mutates a row in place.
- Transcript correction rewrites segment IDs.
- Citation tests check that a link exists, not that it supports the claim.

**Prevention:** Model immutable `source_version` records with content hashes, extraction/parser version, original metadata, and stable location descriptors. Evidence edges reference a source version plus quoted/snapshotted span or time interval and its hash. Replacing or retranscribing creates a new version; dependent claims become stale pending revalidation, never silently rebound.

**Detection / verification:** Golden tests edit, replace, delete, re-OCR, and retranscribe sources, then assert citations either reproduce the original evidence or visibly become unavailable/stale. Independently score claim correctness and citation support.

**Phase gate:** **Phase 2 defines transcript evidence; Phase 3 extends the same contract to documents.**

**Evidence:** Primary RAG evaluation distinguishes response truthfulness from attribution groundedness; factual-summarization research shows fluent summaries can conflict with their sources. **Confidence: HIGH for the design risk; MEDIUM for metric selection.**

### Pitfall 8: Deleting the visible file but retaining its derived knowledge

**What goes wrong:** A user deletes a meeting or document, yet text remains in extracted chunks, briefing caches, structured facts, series memory, IndexedDB recovery, audio checkpoints, summary backups, evaluation traces, or a later-added index.

**Why it happens:** Each subsystem implements deletion locally. SQLite cascades are assumed to be universal, but foreign-key enforcement is connection-specific, and non-SQLite stores and files are outside those cascades. Current deletion explicitly lists only current Meetily tables.

**Consequences:** Privacy promises become false; deleted evidence reappears in suggestions; orphaned claims cannot be inspected; legal or enterprise deletion requirements are unmet.

**Warning signs:**

- Deletion is a series of best-effort calls with no durable deletion job/status.
- New tables are not added to deletion tests.
- IndexedDB, checkpoint folders, caches, and database are audited separately or not at all.
- A deleted source can still be found by search or regenerated summary.

**Prevention:** Define an ownership graph and deletion contract before document ingestion. Use a durable deletion transaction/job that marks roots unavailable immediately, cancels in-flight work, removes or tombstones dependents, purges non-database stores, and records completion/failures. Enable and verify SQLite foreign keys on every connection, but do not rely on cascades to reach files, IndexedDB, remote providers, or exported data.

**Detection / verification:** Seed a canary string into every representation, delete the root, restart/crash mid-delete, resume, then search SQLite, IndexedDB, caches, checkpoints, derived knowledge, and UI. Assert no active retrieval or suggestion path can return it. Run `foreign_key_check` and orphan queries after every migration.

**Phase gate:** **Phase 1 defines the lifecycle; Phase 3 must pass end-to-end document deletion before ingesting real sensitive documents; Phase 5 extends it to series memory.**

**Evidence:** `meeting.rs` performs a transaction over current tables only; recovery data and checkpoint files have separate lifecycles. SQLite documents that foreign-key enforcement must be enabled per connection. **Confidence: HIGH.**

### Pitfall 9: Series membership inferred from titles, calendar strings, or semantic similarity

**What goes wrong:** Two unrelated “Weekly Sync” meetings share memory, or a renamed series loses its history. A guest, client, or confidential topic receives facts from a different group.

**Why it happens:** Series detection is treated as retrieval or fuzzy matching rather than an explicit, user-correctable relationship with scope and history.

**Consequences:** Cross-client privacy leaks, wrong briefings, and poisoned memory. Once derived facts lose their original scope, cleanup is difficult.

**Warning signs:**

- Title similarity automatically commits series membership.
- Moving a meeting between series does not trigger revalidation of carried facts.
- A fact has only `meeting_id` or only `series_id`, not both source and allowed scope.
- One meeting can silently belong to multiple series with no conflict rules.

**Prevention:** Make series membership explicit and provisional when inferred. Persist stable series IDs, membership provenance, effective time, and user confirmation. Every carried fact retains its source meeting and series authorization. Moving or splitting membership invalidates affected briefings and memory projections.

**Detection / verification:** Use adversarial fixtures with identical titles across clients, renamed recurring meetings, one-off guests, merged/split series, and imported history. Assert zero cross-series retrieval without explicit membership.

**Phase gate:** **Phase 5 owns series memory, but Phase 1 stable identity and Phase 2 provenance are prerequisites.**

**Evidence:** Current Meetily history has meetings and text search but no series entity or scope contract. **Confidence: HIGH.**

### Pitfall 10: “Latest mention wins” masquerading as memory

**What goes wrong:** A newer transcript mention overwrites an accepted earlier decision even when it is hypothetical, disputed, quoted, or later retracted. Conversely, an old accepted fact remains “current” after a new decision supersedes it.

**Why it happens:** Memory is a collection of current strings instead of time-scoped assertions with event semantics. Semantic similarity is mistaken for equivalence or conflict.

**Consequences:** Briefings confidently surface obsolete budgets, dates, owners, and commitments. Users cannot reconstruct what was believed when or why the current state changed.

**Warning signs:**

- Upsert by normalized subject/predicate destroys prior rows.
- `updated_at` is the only chronology.
- Contradictions are automatically resolved by recency.
- A superseded item disappears instead of remaining inspectable.

**Prevention:** Keep assertions immutable with `asserted_at`, effective interval when known, source meeting, confidence, actor, and status. Model supersession and conflict as edges, not overwrites. Only explicit decisions or user confirmation promote a replacement to current. Retrieval must be “as of” a meeting and return unresolved conflicts rather than synthesize certainty.

**Detection / verification:** Story-based tests cover tentative then rejected plans, explicit reversals, parallel alternatives, corrected extraction, same-day conflicts, missing dates, and “what did we believe before meeting N?” queries.

**Phase gate:** **Phase 2 defines assertion/status primitives; Phase 5 implements temporal carry-forward and conflict UX.**

**Evidence:** Temporal knowledge research treats facts as time-scoped and conflict-prone; the Telu thesis explicitly requires current, superseded, disputed, and unresolved states. **Confidence: HIGH.**

### Pitfall 11: Calling the product “local-only” while hosted or LAN providers receive meeting content

**What goes wrong:** Marketing and in-product copy say all processing stays on-device while summaries, document excerpts, transcripts, or live context are sent to Claude, Groq, OpenAI, OpenRouter, or a custom endpoint. OpenRouter may route to a downstream provider with its own retention policy; a custom “Ollama” endpoint may be on the LAN or internet.

**Why it happens:** “Local capture and storage” is collapsed into “all processing is local,” and provider selection is treated as a settings detail instead of a data-boundary decision.

**Consequences:** A severe trust and compliance failure: users disclose sensitive meetings under a false assumption, retention/residency differs from expectations, and remote failures affect a supposedly local product.

**Warning signs:**

- Unconditional “never leaves your device” copy remains visible with a hosted provider selected.
- The confirmation UI names a model but not the destination, data categories, or retention caveat.
- Provider switching does not cancel in-flight work.
- Automatic routing can change the downstream provider without surfacing it.

**Prevention:** Build a runtime data-flow registry: feature, data categories, destination, transport, account, retention/ZDR status, and whether routing is indirect. Show a clear boundary before first transmission and persist consent per destination and purpose. Phrase claims precisely: capture/persistence are local by default; selected remote features transmit specified content. Include provider identity in every derived artifact’s provenance.

**Detection / verification:** Block network in local mode and assert core workflows continue without attempted egress. Use a test proxy to enumerate all destinations and payload categories. Snapshot-test privacy copy across every provider configuration, including custom endpoints and OpenRouter routing.

**Phase gate:** **Phase 1 must establish truthful boundaries before any Telu feature uses a provider; Phase 6 audits claims.**

**Evidence:** The checkout supports Ollama, Claude, Groq, OpenRouter, OpenAI, and custom OpenAI-compatible endpoints while README copy includes unconditional local/privacy language. Official provider documentation confirms that hosted requests transmit customer content and retention/control varies by endpoint and provider. **Confidence: HIGH.**

### Pitfall 12: Treating platform permission success as a permanent capture guarantee

**What goes wrong:** Telu starts recording after one permission check, then microphone or system-audio permission is denied, revoked, managed by policy, or requires restart. The app continues with one source missing and produces incomplete but authoritative-looking transcripts and memory.

**Why it happens:** macOS microphone and ScreenCaptureKit/system-audio permissions, Windows microphone privacy/policy, and Linux audio/session behavior are flattened into one generic `permission_denied` state. Device presence is confused with actual samples.

**Consequences:** Silent capture gaps corrupt decisions and evidence. Users believe both sides were recorded. Cross-platform bug fixes become invasive because permission state is not part of recording provenance.

**Warning signs:**

- A recording can complete without declaring which sources actually produced audio.
- Permission is checked only during onboarding.
- Zero-RMS or device-loss periods are logs, not durable gap events.
- Tests cover “granted” but not deny, revoke, policy deny, restart-required, or hot-swap.

**Prevention:** Define per-source state machines for permission, device selection, active samples, disconnect, recovery, and permanent gap. Persist source availability and gap intervals with the meeting. Make partial capture conspicuous during and after the meeting. Use platform-specific recovery instructions and validate on physical target systems.

**Detection / verification:** Platform matrix tests revoke permissions mid-session, disconnect devices, change defaults, apply Windows organization policy, require macOS restart, and remove Linux audio services. Assert UI, recording metadata, transcript evidence, and recovery all reflect the exact gap.

**Phase gate:** **Phase 1 baselines current behavior; Phase 6 blocks release until supported-platform matrices pass.**

**Evidence:** Official Apple documentation requires explicit microphone and screen/system-audio authorization and notes permission/restart behavior; Microsoft documents user- and organization-controlled microphone access. The checkout already contains device recovery logic, which must not be mistaken for permission coverage. **Confidence: HIGH.**

### Pitfall 13: Evaluating on curated demos or with the same model that generated the answer

**What goes wrong:** Telu appears accurate because evaluation meetings are short, clean, English, single-topic, and selected after development; labels come from the same model family; only cases where a suggestion should fire are included; target-hardware constraints are absent.

**Why it happens:** Evaluation is used to showcase progress instead of test a predeclared product claim. Generic summary or RAG benchmarks replace representative recurring-meeting workflows.

**Consequences:** Misleading claims about usefulness, grounding, latency, and memory correctness. Real meetings with accents, overlap, corrections, sparse documents, and long negative spans fail after architecture decisions are locked.

**Warning signs:**

- No held-out real-time replay set or blinded human ratings.
- One aggregate “accuracy” or “groundedness” score.
- No confidence intervals, p95/p99 latency, subgroup slices, or error taxonomy.
- The judge sees model identity, expected answer, or retrieved evidence unavailable to users.

**Prevention:** Before tuning, freeze a versioned evaluation protocol and held-out scenarios representing target hardware, accents/languages, noise, meeting length, continuous speech, overlapping speakers, document versions, corrections, conflicts, and silence-required periods. Separate ASR fidelity, claim correctness, citation support, retrieval coverage, intervention usefulness, distraction, duplicate rate, silence accuracy, resource use, and deletion/privacy tests. Use human adjudication for high-impact claims and report uncertainty and exclusions.

**Detection / verification:** Re-run locked evaluation sets on every model/policy change; audit label provenance and judge agreement; include negative controls and source perturbations. Keep a sequestered release set not used for prompts or tuning.

**Phase gate:** **Phase 1 defines baseline protocol; every later phase adds acceptance suites; Phase 6 owns final claims.**

**Evidence:** NIST emphasizes explicit objectives, representative/held-out evaluation, reproducibility, and real-world impact. Primary work on factual-summary evaluation shows protocol design materially changes rating reliability. **Confidence: MEDIUM-HIGH.**

### Pitfall 14: Installing embeddings/vector infrastructure before bounded context fails

**What goes wrong:** Telu adds an embedding model, chunk store, vector database, synchronization jobs, and retrieval tuning before demonstrating that the initial bounded set of meeting facts and documents exceeds direct context.

**Why it happens:** Retrieval infrastructure feels like prerequisite architecture for “knowledge,” while source lifecycle, corrections, chronology, and evaluation are less visible but more fundamental.

**Consequences:** New deletion surfaces, stale indexes, citation drift, model migration work, retrieval false positives, larger installers, and resource contention with local ASR—all before a measured user need. The schema hardens around chunks rather than evidence and assertions.

**Warning signs:**

- No corpus-size/latency/quality threshold justifies retrieval.
- Embeddings are the canonical source of evidence.
- The vector store can return deleted or superseded content.
- Retrieval metrics improve without end-to-end briefing or suggestion gains.

**Prevention:** Start with explicitly selected, bounded direct context and deterministic source filtering. Instrument token/corpus size, truncation, briefing quality, latency, and miss cases. Introduce retrieval only after a failure analysis shows direct context is the bottleneck. Keep SQLite/source versions canonical; indexes are rebuildable projections.

**Detection / verification:** Compare direct context against proposed retrieval on the same held-out tasks, including distractors, deletion, version replacement, and temporal conflicts. Require a material end-to-end gain after latency, resource, privacy, and lifecycle costs.

**Phase gate:** **Phase 3 must enforce this decision gate; later retrieval work needs separate phase research.**

**Evidence:** This is an explicit Telu project constraint and follows from the current small, bounded document goal. RAG research also separates retrieval coverage from answer correctness and grounding, so adding retrieval is not itself evidence of better answers. **Confidence: HIGH.**

## Moderate Pitfalls

### Pitfall 1: Fabricating confidence when a provider supplies none

**What goes wrong:** `worker.rs` assigns a default confidence of `0.85` when a provider has no confidence score. Downstream trust UX may interpret that as measured certainty.

**Prevention:** Make confidence provenance explicit: measured, calibrated proxy, unavailable, or policy score. Never convert “unavailable” into a high numeric value. Calibrate ASR and knowledge confidence separately on representative data.

**Phase mapping:** **Phase 1 telemetry and Phase 2 trust schema.**

### Pitfall 2: Persisting partial/final transcript events as independent evidence

**What goes wrong:** Partial hypotheses and finals are appended rather than revisioned, creating duplicate or contradictory evidence. The current worker comments and event model retain an `is_partial` flag, while history later treats segments as final.

**Prevention:** Define a segment revision key and finalization contract. Structured knowledge and durable evidence may depend only on final/stable transcript revisions; partials are ephemeral live input with replacement semantics.

**Phase mapping:** **Phase 1 before structured extraction or live work.**

### Pitfall 3: Letting ingested documents or transcripts instruct the assistant

**What goes wrong:** A document contains prompt-like text that alters extraction, retrieval, or live behavior, causing data exfiltration or misleading suggestions.

**Prevention:** Treat sources as untrusted data; delimit source content, use constrained schemas, prohibit tool/network authority from retrieved text, and add adversarial ingestion fixtures. Evidence content can support a claim but cannot change system policy.

**Phase mapping:** **Phase 3 ingestion and Phase 4 live assistance; security review before release.**

### Pitfall 4: Logging sensitive transcript or path content during debugging

**What goes wrong:** Debug logs include transcript snippets, folder paths, meeting titles, endpoints, or provider responses and outlive the meeting deletion lifecycle.

**Prevention:** Classify log fields, redact meeting content by default, separate user-enabled diagnostic bundles, apply bounded retention, and include logs in deletion/privacy threat modeling. Never log API keys or complete provider payloads.

**Phase mapping:** **Phase 1 privacy inventory and Phase 6 release audit.**

## Minor Pitfalls

### Pitfall 1: Confusing wall-clock timestamps with recording-relative evidence time

**What goes wrong:** DST/time-zone changes or recovery reorder evidence when wall clock is used as the primary transcript position.

**Prevention:** Use monotonic recording-relative intervals for evidence ordering; retain wall clock only as display/context metadata.

**Phase mapping:** **Phase 1 identity/evidence baseline.**

### Pitfall 2: Treating a source link that opens as proof that it supports the claim

**What goes wrong:** Trust UX validates navigation, not semantic support.

**Prevention:** Display the exact evidence excerpt/time interval and test claim-to-span entailment separately from link integrity.

**Phase mapping:** **Phase 2 and Phase 3.**

### Pitfall 3: Hiding degraded capture or provider state behind generic success

**What goes wrong:** A meeting summary completes even though one audio source, several chunks, or remote calls failed.

**Prevention:** Carry completeness and degradation metadata into summaries, claims, briefings, and exports; block strong claims when evidence is incomplete.

**Phase mapping:** **Phase 1 state model; every later phase consumes it.**

## Phase-Specific Warnings

| Phase topic | Likely pitfall | Required mitigation / exit gate |
|---|---|---|
| Baseline capture/transcription | Freshness measured as inference time; fake queue metrics | Real stage timestamps, queue age/depth, continuous-speech and overload replay on target hardware |
| Identity and recovery | Temporary and persisted IDs diverge | One pre-recording durable UUID; idempotent crash/recovery tests |
| Privacy/provider boundary | “Local-only” claim survives hosted provider selection | Runtime data-flow registry, egress tests, provider-specific disclosure and cancellation |
| Structured post-meeting knowledge | Corrections overwrite proposals; partial transcripts become evidence | Immutable assertions/evidence, revision semantics, accept/reject/correct lineage |
| Document ingestion | Citation drift and incomplete deletion | Immutable versions and hashes; end-to-end delete canary; prompt-injection fixtures |
| Pre-meeting briefings | Retrieval added before need; grounded-but-wrong claims | Bounded direct context first; separate correctness, coverage, and citation-support gates |
| Live assistance | Stale, uncancellable, unbounded work and excessive interventions | Deadlines/epochs, bounded queues, stale-result suppression, duplicate/silence evaluation |
| Recurring memory | Cross-series leakage and latest-mention-wins | Explicit membership, temporal assertions, supersession/conflict edges, repair UI |
| Cross-platform release | Permissions/capture gaps produce authoritative output | Physical-device permission/revocation/hot-swap matrix; persistent completeness metadata |
| Product claims | Curated or contaminated evaluation overstates performance | Held-out representative set, blinded humans, uncertainty, subgroup and tail reporting |

## Roadmap Stop Conditions

The roadmap should stop rather than advance when any of these conditions hold:

1. **Do not enter live-assistance implementation** if continuous-speech transcript age, backlog age, memory ceiling, and stop behavior are not observable and bounded on target hardware.
2. **Do not add structured knowledge tables** until one stable meeting ID survives preparation, recording, crash recovery, and final persistence.
3. **Do not ingest sensitive documents** until replace/delete propagation has an end-to-end canary test covering SQLite, files, IndexedDB, caches, and derived items.
4. **Do not claim evidence-backed output** if citation support and claim correctness are measured as one score.
5. **Do not claim local-only processing** while any configured hosted or non-loopback provider can receive meeting-derived content.
6. **Do not add series carry-forward** until correction, rejection, chronology, supersession, and dispute semantics are stable.
7. **Do not add vector infrastructure** until bounded direct context fails a predeclared quality or scale threshold in held-out evaluation.

## Sources

### Local primary evidence — HIGH confidence

- `.planning/PROJECT.md` — product constraints, phase-order rationale, privacy and evidence requirements.
- `docs/telu/idea-verification.md` — static source audit and required validation sequence.
- `frontend/src-tauri/src/audio/pipeline.rs` — 500 ms live VAD redemption, no bounded uninterrupted-speech delivery, unbounded channel construction, pipeline flow.
- `frontend/src-tauri/src/audio/vad.rs` — speech-end-based emission and accumulated-speech warning.
- `frontend/src-tauri/src/audio/transcription/worker.rs` — single ordered worker, unbounded work queue, progress counters, default confidence behavior.
- `frontend/src-tauri/src/audio/recording_state.rs` and `recording_manager.rs` — unbounded audio/recording/transcription channels and state lifecycle.
- `frontend/src-tauri/src/lib.rs` and `audio/recording_commands.rs` — placeholder transcription queue status.
- `frontend/src/contexts/TranscriptContext.tsx`, `frontend/src/services/indexedDBService.ts`, and `frontend/src/hooks/useTranscriptRecovery.ts` — temporary recovery identity and recovery lifecycle.
- `frontend/src-tauri/src/database/repositories/transcript.rs` and `meeting.rs` — final ID creation and current explicit deletion scope.
- `frontend/src-tauri/src/summary/service.rs` and `database/repositories/summary.rs` — generation-specific cancellation/stale-write pattern to reuse.
- `frontend/src-tauri/src/summary/llm_client.rs`, `README.md`, and `frontend/README.md` — hosted-provider support versus broad local-processing claims.

### Authoritative platform/provider sources — MEDIUM confidence via verified web lookup

- [SQLite foreign key support](https://www.sqlite.org/foreignkeys.html) — per-connection enforcement and referential actions.
- [Apple: Requesting authorization for media capture on macOS](https://developer.apple.com/documentation/bundleresources/requesting-authorization-for-media-capture-on-macos) — microphone/system-audio authorization and usage descriptions.
- [Apple: ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit) — screen/audio capture consent and content selection.
- [Microsoft: Windows app privacy policy controls](https://learn.microsoft.com/en-us/windows/client-management/mdm/policy-csp-Privacy) — user/organization control of microphone access.
- [OpenAI API data controls](https://platform.openai.com/docs/models/default-usage-policies-by-endpoint) — endpoint-specific storage and retention controls.
- [GroqCloud: Your Data](https://console.groq.com/docs/your-data) — inference retention conditions and ZDR controls.
- [OpenRouter privacy policy](https://openrouter.ai/privacy/) — transmission to selected/automatically routed downstream model providers.
- [Anthropic Privacy Center: Zero data retention scope](https://privacy.anthropic.com/en/articles/8956058-i-have-a-zero-data-retention-agreement-with-anthropic-what-products-does-it-apply-to) — contractual/product scope of ZDR.

### Primary research and evaluation guidance — MEDIUM confidence

- [Improving endpoint detection in end-to-end streaming ASR for conversational speech](https://arxiv.org/abs/2505.17070) — early-cut versus endpoint-delay tradeoff.
- [LlamaPIE: Proactive In-Ear Conversation Assistants](https://aclanthology.org/2025.findings-acl.710/) — separates when-to-respond policy from response generation and evaluates unobtrusive proactive assistance.
- [Correctness is not Faithfulness in RAG Attributions](https://arxiv.org/abs/2412.18004) — citation correctness and answer correctness require distinct evaluation.
- [Asking and Answering Questions to Evaluate the Factual Consistency of Summaries](https://aclanthology.org/2020.acl-main.450/) — summary fluency/overlap is insufficient for factual consistency.
- [Investigating Crowdsourcing Protocols for Evaluating the Factual Consistency of Summaries](https://aclanthology.org/2022.naacl-main.417/) — evaluation design affects human-rating reliability.
- [NIST AI measurement and evaluation](https://www.nist.gov/ai-measurement-and-evaluation) — meaningful datasets, technical limitations, and trustworthy measurement.

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Transcript segmentation, queueing, and telemetry risks | HIGH | Directly evidenced in the pinned local checkout; runtime severity still requires Phase 1 measurement. |
| Identity and recovery split | HIGH | Direct code path shows two ID schemes and creation of a new SQLite ID during recovery. |
| Structured correction, evidence, document, and series risks | HIGH | Required by the project model and absent from the current foundation; mitigations are standard data-lifecycle design but need phase-specific schemas. |
| Privacy/provider claim risk | HIGH | Direct provider implementations and product copy conflict at the level of unconditional claims; exact retention varies by current provider/account settings. |
| Cross-platform permission behavior | MEDIUM-HIGH | Official platform guidance is clear; actual behavior must be validated on supported physical systems and packaging modes. |
| Evaluation and intervention-policy guidance | MEDIUM-HIGH | Supported by primary research and NIST guidance, but Telu-specific thresholds need empirical study. |
| Retrieval/vector deferral | HIGH | Explicit project constraint; the exact threshold for introducing retrieval remains an open Phase 3 decision. |

## Research Flags

- **Phase 1 requires deeper experimental research:** target-hardware benchmark design, bounded continuous-speech segmentation options, real queue instrumentation, crash/recovery identity migration, and platform test matrix.
- **Phase 2 requires schema-focused research:** assertion/evidence immutability, correction lineage, transcript revision anchors, and calibrated confidence semantics.
- **Phase 3 requires parser/lifecycle research:** PDF/DOCX location stability, version hashing, source prompt-injection defenses, deletion propagation, and a quantified retrieval-introduction threshold.
- **Phase 4 requires product/evaluation research:** absolute staleness deadlines, overload behavior, novelty/duplicate policy, interruption budget, and deliberate-silence labels.
- **Phase 5 requires temporal-model research:** series membership repair, effective-time semantics, supersession/conflict rules, and “as-of” retrieval.
- **Phase 6 requires legal/claims review:** supported-platform permission disclosures, provider-specific data boundaries, diagnostic-log policy, and wording of privacy/performance claims.

