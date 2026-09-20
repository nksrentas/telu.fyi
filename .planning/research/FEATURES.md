# Feature Landscape

**Project:** Telu
**Domain:** Local-first, evidence-aware desktop companion for recurring conversations
**Researched:** 2026-09-20
**Research mode:** Ecosystem — feature behavior for a validation-led first milestone
**Overall confidence:** MEDIUM

## Product Boundary

Telu is not a transcription product with extra AI buttons. Its product loop is:

1. turn a completed meeting into reviewable, evidence-linked knowledge;
2. use a bounded amount of that accepted knowledge and selected documents to prepare the next meeting;
3. surface only timely, grounded help during a meeting, and otherwise stay silent;
4. preserve the chronology of what changed across the recurring series.

The first milestone should validate that loop in the requested order: **baseline → post-meeting slice → bounded pre-meeting context → live loop → series memory → hardening**. Trust behavior and evaluation instrumentation are dependencies of every slice, not a final polish phase.

## Existing Meetily Foundation vs. Telu Additions

The checked-out fork and official Community Edition materials show reusable foundations, but none are treated as validated on Telu's target hardware until the baseline phase measures them.

| Capability | Existing Meetily foundation | Telu milestone obligation | Confidence |
|---|---|---|---|
| Native capture | Microphone and system-audio capture, recording lifecycle, pause/resume, device and permission flows | Preserve behavior and benchmark platform-specific failures, recovery, CPU, memory, and battery | HIGH — current checkout and official repository |
| Local transcription | Local Whisper/Parakeet paths and transcript-related state/events | Measure phrase-to-stable-transcript freshness under short speech, continuous speech, overlapping speech, and sustained system audio | HIGH for existence; LOW until runtime measurement |
| Local persistence and history | SQLite-backed meetings, transcripts, meeting detail/history UI | Add a stable meeting identity that exists before recording and remains consistent through preparation, live work, recovery, and analysis | HIGH for foundation; Telu behavior unbuilt |
| Recovery | Startup recovery and audio/transcript recovery paths exist | Verify interrupted recording recovery and ensure recovered meetings retain the same identity and downstream knowledge links | HIGH for existence; LOW until runtime measurement |
| Summaries | Asynchronous, editable/regenerable summaries with local and configured hosted providers | Add typed decisions, commitments/actions, open questions, and verified facts; preserve per-item evidence and user review state | HIGH for summary foundation; Telu behavior unbuilt |
| Provider choice | Ollama/local model support plus explicit hosted or custom providers | Show the actual processing boundary before each remote run; never silently fall back from local to remote | HIGH |
| Deletion | Current repository transactionally removes core meeting, transcript, transcript-chunk, and summary database rows; temporary recovery storage has its own cleanup | Extend deletion to documents, document versions, extracted items, evidence links, series memory, caches, and any later index; verify no deleted source remains retrievable | HIGH for inspected database path; MEDIUM for complete filesystem behavior until tested |
| Cross-meeting memory | Meeting history exists, but durable series knowledge is not a Community Edition capability | Add stable series grouping, chronology, status transitions, conflict handling, and accepted-only carry-forward | HIGH |

**Conclusion:** capture, transcription, recovery, history, and summary orchestration are foundations to verify and preserve. Evidence-aware structured knowledge, bounded document context, live intervention policy, and recurring-series memory are Telu additions.

## Table Stakes

Missing any of these behaviors would make the validation result uninterpretable or the product untrustworthy.

### 1. Baseline and Measurement

| Feature | Observable behavior / acceptance signal | Complexity | Notes |
|---|---|---:|---|
| Reproducible end-to-end baseline | A scripted test matrix records app revision, OS/hardware, capture devices, transcription/provider model, meeting duration, p50/p95 transcript freshness, queue depth/backlog, CPU, memory, battery, recovery outcome, and persistence outcome | Med | Measure the unmodified foundation before changing the hot path |
| End-to-end timestamps | Test runs can correlate speech time, segment close, transcription completion, context selection, generation start/end, and render time | Med | Required to locate latency rather than blaming only generation |
| Stress cases | Baseline explicitly covers short utterances, long uninterrupted speech, continuous system audio, overlap, silence, device loss, stop during backlog, and restart/recovery | Med | Results become go/no-go evidence for the live phase |
| Stable meeting identity | A meeting receives an ID when preparation starts; recording, recovery, documents, transcript, analysis, and later series membership all reuse it | High | Introduce the identity contract early even though series UX comes later |
| Honest local-first disclosure | The UI distinguishes on-device capture/transcription/storage from any selected remote summary or generation call, including destination/provider and data sent | Med | A hosted-provider configuration invalidates blanket claims that all processing is local |
| No silent remote fallback | If the selected local path is unavailable, the run fails visibly or asks for an explicit provider change; it never sends content remotely by convenience | Low | Test by disabling the local provider/network |
| Evaluation event model | Acceptance, correction, rejection, dismissal, source opening, suggestion display/suppression, stale cancellation, and generation failure are recorded locally with clear opt-in/visibility | Med | Product metrics must not require uploading meeting content |

### 2. Post-Meeting Structured Knowledge

| Feature | Observable behavior / acceptance signal | Complexity | Notes |
|---|---|---:|---|
| Typed extraction | A completed meeting yields separate candidate decisions, commitments/action items, open questions, and verified facts instead of only prose | High | Each item has a stable ID and type-specific fields; do not infer owners/dates when absent |
| Evidence for every candidate | Every extracted item links to one or more transcript segments with meeting ID, timestamp/range, and an inspectable excerpt | High | Clicking evidence opens the relevant transcript context; an item without evidence is withheld or marked unsupported, never presented as established |
| Accept, correct, reject | A user can accept, edit, or reject each candidate independently | Med | Rejection means “do not carry forward”; editing creates a user-authored revision rather than hiding the model output |
| Review-state visibility | Candidate, accepted, corrected, rejected, and unresolved states are visually distinct and filterable | Med | No ambiguous “saved” state that conflates generated and verified knowledge |
| Correction consequences | After an edit/rejection, the UI immediately states whether the item will appear in briefings, live context, or series memory | Med | Matches HAX guidance to convey action consequences |
| Regeneration safety | Re-running extraction does not overwrite accepted user edits or resurrect rejected items; changed candidates are diffable | High | Extraction run/version and model/provider metadata remain attributable |
| Abstention and uncertainty | When the transcript does not support an owner, deadline, decision, or answer, the system omits it or marks the field unresolved | High | Do not display decorative numeric confidence unless calibrated and actionable |
| Post-meeting evaluation | A reviewer can label item correctness, completeness, evidence-span correctness, attribution error, omission, and usefulness on a sampled test set | Med | Automatic summary scores alone are insufficient for meeting-specific errors |
| Lifecycle-consistent meeting deletion | Deleting a meeting removes or invalidates its derived items, evidence links, pending jobs, recovery state, and later memory references | High | A validation test searches all user-visible surfaces after deletion |

### 3. Bounded Pre-Meeting Context

| Feature | Observable behavior / acceptance signal | Complexity | Notes |
|---|---|---:|---|
| Explicit context selection | The user can paste text or attach a small bounded set of supported documents to a specific meeting | Med | The selected inputs and their inclusion status are visible before generation |
| Source extraction with locations | Parsed document content retains document ID, version/hash, page/section or character range, extraction status, and original file reference | High | PDF/DOCX support can be incremental; bad extraction must fail visibly |
| Version-aware replacement | Replacing a document creates a new version, indicates that prior outputs used an older version, and allows regeneration | High | Never silently repoint old citations to new content |
| Sourced concise briefing | The briefing prioritizes relevant accepted prior items, key document facts, unresolved questions, and commitments; each factual claim opens its source | High | Keep it brief enough to scan before a meeting; direct bounded context first |
| Sourced candidate questions | Candidate questions explain which prior open question, commitment, contradiction, or document passage motivated them | Med | The user can remove or edit candidates before the meeting |
| Missing/deleted-source behavior | If a referenced document or meeting is removed, affected briefing claims become unavailable/invalidated and are not silently regenerated from cached text | High | Test deletion across extracted text, caches, and future indexes |
| Context budget visibility | The product shows which sources were included, omitted, or truncated for a run | Med | Prevent hidden retrieval behavior and make failures diagnosable |

### 4. Bounded Live Assistance Loop

| Feature | Observable behavior / acceptance signal | Complexity | Notes |
|---|---|---:|---|
| Fresh transcript input | The live pipeline consumes stable incremental transcript units with event time and processing time, not arbitrary UI state | High | Baseline determines whether the source is fresh enough to continue |
| Bounded queue and concurrency | At most a small fixed number of context/generation jobs can run; newer relevant work supersedes older work | High | No unbounded queue; expose dropped/cancelled/stale counts in diagnostics |
| Topic/version cancellation | Each job is tied to a transcript/topic revision; results from an obsolete revision are discarded before display | High | Test with rapid topic changes and deliberately slow generation |
| Staleness gate | A candidate older than the configured actionable window is suppressed and logged as stale | Med | The exact threshold is a phase experiment, not a hard-coded product truth |
| Grounding gate | A displayed suggestion has inspectable support from selected documents, accepted prior items, or transcript context; unsupported generations are suppressed | High | Source correctness must be scored separately from plausibility |
| Value and novelty gate | Obvious repetition, duplicate suggestions, already-answered questions, and low-value restatements are suppressed | High | Duplicate and suppression reasons are measurable |
| Deliberate silence | Low-confidence/low-value periods produce no card, and evaluation records whether silence was appropriate | High | “Nothing shown” is a first-class result, not missing telemetry |
| Calm presentation limit | No more than one primary and one queued/secondary intervention are visible; new cards do not continually displace attention | Med | Product should earn the right to interrupt |
| Fast dismiss and global off | A user can dismiss a suggestion in one action and disable live assistance without stopping capture/transcription | Low | Capture and assistance controls must be independent |
| Evidence inspection without losing place | A suggestion can reveal source type, source name, relevant excerpt, source date/version, and originating meeting while preserving the live view | Med | Progressive disclosure keeps the default card calm |
| Per-suggestion feedback | The user can mark useful, stale, obvious, incorrect, distracting, duplicate, or wrong-source | Med | Mutually exclusive primary labels plus optional detail make evaluation actionable |
| End-to-end live metrics | Report p50/p95 spoken-phrase-to-visible time, stale suppression, duplicates, displayed suggestions/hour, useful rate, distracting rate, and deliberate-silence precision/recall on annotated scenarios | High | Measure the full pipeline and segment by device/model/provider |

### 5. Recurring-Meeting Series Memory

| Feature | Observable behavior / acceptance signal | Complexity | Notes |
|---|---|---:|---|
| Stable series grouping | A user can create/assign meetings to a series, inspect membership, and correct an incorrect assignment without changing meeting identity | High | Avoid calendar integration in v1; manual/heuristic grouping is sufficient |
| Accepted-only durable memory | Only accepted or user-authored items become durable series memory; raw model candidates remain meeting-local | High | Prevents speculative extraction from becoming “what the team decided” |
| Chronological item history | Each knowledge item shows originating meeting/date, evidence, revisions, user action, and status changes | High | Preserve history rather than replacing the old value in place |
| Explicit temporal status | Facts and decisions can be current, superseded, disputed, or unresolved; commitments can additionally be open, done, or cancelled | High | Status transition requires evidence or a user action |
| Conflict presentation | When new evidence contradicts current memory, Telu presents both versions and asks the user to supersede, dispute, or leave unresolved | High | Never choose the newest sentence automatically as truth |
| Carry-forward control | The next briefing includes current accepted items and open questions/commitments, while clearly separating disputed or stale material | Med | Rejected, superseded, or deleted-source items do not reappear as current |
| Series chronology evaluation | Test scenarios cover changed dates/budgets/owners, reopened decisions, corrected transcripts, meeting deletion, document replacement, and reassignment between series | High | Score current-state correctness and history preservation separately |

### 6. Hardening and Release Confidence

| Feature | Observable behavior / acceptance signal | Complexity | Notes |
|---|---|---:|---|
| Cross-platform recovery matrix | Supported platforms pass device loss, process crash, interrupted stop, restart, and partial-output recovery tests | High | Preserve native permission differences |
| Atomic lifecycle operations | Meeting/document deletion, version replacement, series reassignment, and regeneration either complete consistently or leave a recoverable state | High | Include filesystem artifacts and caches, not just SQLite rows |
| Migration and rollback fixtures | Existing Meetily data opens without loss; schema migrations are tested against realistic old databases | High | Brownfield requirement |
| Export/inspection | Users can inspect/export meetings and accepted structured knowledge with sources in a durable, non-proprietary form | Med | Supports local ownership; broad publishing/collaboration is deferred |
| Provider/data-flow audit | Settings and run-time UI agree on local vs remote processing, data sent, destination, retention assumptions, and errors | Med | Re-verify whenever a provider path changes |
| Evaluation release gate | Release requires agreed targets for grounding, source correctness, useful/stale/distracting rate, deliberate silence, latency, resource use, recovery, and series-memory correctness | High | Thresholds should come from benchmark evidence, not this ecosystem survey |

## Differentiators

These are not generic meeting-assistant expectations. Together they define Telu's reason to exist.

| Feature | Value Proposition | Complexity | Validation signal | Confidence |
|---|---|---:|---|---|
| Evidence is one interaction away | Users can verify why a decision, briefing claim, live suggestion, or remembered fact exists without hunting through a transcript | High | Source-open rate, source correctness, time-to-verification, correction rate | HIGH that behavior supports calibrated trust; MEDIUM on exact UX |
| Correction changes future behavior | Accept/edit/reject is not cosmetic feedback: it deterministically controls carry-forward and creates an auditable revision | High | Rejected items never recur; corrected form is used; original provenance remains inspectable | HIGH |
| Deliberate silence as a product outcome | Telu optimizes for a few actionable interventions rather than maximizing visible AI activity | High | Annotated low-value scenarios show high appropriate-silence rate and low distraction | MEDIUM — exact policy requires user study |
| Temporal truth, not semantic similarity | Series memory distinguishes current, superseded, disputed, and unresolved claims while retaining chronology | High | Change-of-decision scenarios resolve to correct current state without erasing history | HIGH for need; MEDIUM for interaction design |
| Whole-loop latency and staleness control | Telu measures from spoken phrase through rendering and prevents late work from surfacing | High | p50/p95 latency plus zero displayed results from cancelled/expired revisions in adversarial tests | HIGH |
| Local-first with truthful boundaries | Sensitive source data is local by default, while every remote provider/destination is disclosed at the moment it matters | Med | Offline core behavior; no network calls on local path; explicit confirmation/configuration for remote path | HIGH |
| Source-lifecycle integrity | Document replacement or deletion and meeting deletion propagate through briefings, suggestions, memory, and caches | High | Exhaustive before/after retrieval tests find no stale user-visible claims | HIGH |

## Anti-Features

These should be explicitly rejected in the first milestone because they undermine validation or expand the product beyond its thesis.

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| Transcription-only positioning | Meetily already supplies transcription; it does not validate Telu's cross-meeting value | Treat transcription as measured infrastructure |
| High-frequency “always helpful” cards | Frequency creates distraction and can reward obvious or late suggestions | Hard caps, grounding/value gates, and deliberate silence |
| Source-free summaries, suggestions, or memory | Fluent output cannot be checked and errors become durable | Require inspectable evidence or abstain |
| Automatic promotion of generated items to durable memory | A plausible extraction can become false organizational history | Require acceptance or explicit user authorship |
| In-place overwrite of decisions/facts | Hides chronology and makes corrections/supersession impossible to audit | Append revisions and status transitions |
| Decorative confidence percentages | Uncalibrated numbers imply precision and can mislead users | Show evidence, scope, unresolved fields, and actionable uncertainty states |
| Chat across all meetings | Creates broad retrieval, privacy, evaluation, and scope obligations before the core loop is proven | Build constrained briefing and evidence inspection workflows |
| Autonomous coaching or conversation steering | Hard to evaluate, socially intrusive, and beyond the validated intervention policy | Candidate fact/question cards only, with user control |
| Meeting bots or automatic joining | Adds platform integrations, participant consent, identity, and cloud-path complexity | Preserve native local capture initiated by the user |
| Cloud collaboration, team workspaces, and sharing roles | Conflicts with the local-first single-user validation focus and expands security scope | Local export/inspection only in v1 |
| Calendar integration as a prerequisite | Delays core series-memory validation and adds provider-specific permissions | Manual series assignment first; calendar integration later if justified |
| Embeddings/external vector database by default | Adds indexing, deletion, privacy, and evaluation complexity before corpus scale requires it | Bounded direct context; add selective retrieval only after measured need |
| Silent local-to-cloud failover | Violates user expectations and local-first disclosure | Fail visibly and ask for an explicit provider decision |
| Deleting only the source row/file | Leaves derived knowledge, citations, caches, or memory inconsistent | Cascade deletion or visibly invalidate all dependents |
| Unbounded queues and concurrent live requests | Produces suggestions that are correct but no longer actionable | Bounded queues, cancellation, topic revisions, TTL/staleness gate |
| Using acceptance/dismissal as hidden training data | User action has ambiguous meaning and undisclosed collection damages trust | Explain local evaluation logging and require opt-in for any external use |

## Feature Dependencies

```text
Measured Meetily baseline
  ├─> stable pre-recording meeting identity
  ├─> end-to-end timestamps and evaluation event model
  └─> transcript-freshness go/no-go evidence

Stable meeting identity
  └─> typed post-meeting items
       └─> evidence links + accept/correct/reject + revision/status model
            ├─> bounded document context and sourced pre-meeting briefing
            │    └─> grounded context selector for the bounded live loop
            └─> accepted-only recurring-series memory

Transcript-freshness evidence + grounded context selector + cancellation/TTL
  └─> bounded live assistance
       └─> measured intervention policy and deliberate-silence evidence

Accepted post-meeting items + stable series grouping + chronology/status model
  └─> recurring-series memory
       └─> trustworthy carry-forward into the next briefing

All slices
  └─> lifecycle, migration, recovery, privacy-boundary, and cross-platform hardening
```

### Dependency Rules That Affect Delivery Order

1. **Do not tune live generation before measuring transcript freshness.** A fast model cannot rescue words that have not left VAD/transcription queues.
2. **Do not build pre-meeting or series memory before the post-meeting item contract.** Decisions, commitments, questions, statuses, evidence, and review actions are the shared data model.
3. **Do not let documents or extracted items enter later phases without stable identity/version fields.** Retrofitting provenance and deletion after retrieval is a rewrite risk.
4. **Do not launch live assistance without bounded concurrency, cancellation, staleness rejection, and an off switch.** Those behaviors are prerequisites, not optimizations.
5. **Do not auto-resolve contradictions.** Series memory depends on explicit status transitions and user review.
6. **Introduce lifecycle contracts early, prove them comprehensively during hardening.** Every vertical slice must register what it derives so deletion/version tests can cover it later.

## MVP Recommendation

The first shippable proof should be a **reviewable post-meeting knowledge slice**, preceded by the baseline and followed by gated extensions in the requested order.

### Prioritize

1. **Baseline:** reproduce capture/transcription/persistence/recovery behavior and collect full-path freshness/resource measurements on target hardware.
2. **Post-meeting slice:** extract typed decisions, commitments/actions, and open questions; attach exact transcript evidence; let the user accept, correct, or reject; preserve revisions; measure item and source correctness.
3. **Bounded pre-meeting context:** attach/paste a small explicit source set and generate a concise sourced briefing plus candidate questions using direct context.
4. **Bounded live loop:** only after a baseline go/no-go, run a cancellable, stale-aware, max-two-card experiment with grounding, feedback, off control, and deliberate-silence evaluation.
5. **Series memory:** carry forward accepted items with chronology and current/superseded/disputed/unresolved state; require user review for conflicts.
6. **Hardening:** verify migrations, recovery, deletion/version consistency, remote-boundary disclosure, cross-platform behavior, and release thresholds across all slices.

### MVP Gate

The post-meeting slice is successful only if a user can answer all four questions for each item:

- What exactly is Telu claiming?
- Which transcript evidence supports it?
- Can I correct or reject it quickly?
- Will that action reliably control what appears next time?

If this slice cannot achieve acceptable item correctness, evidence-span correctness, and correction behavior, defer pre-meeting, live, and series features rather than layering more automation on unreliable memory.

### Defer

- broad chat/RAG across all meetings;
- autonomous coaching;
- bots and automatic meeting joining;
- team/cloud collaboration and role systems;
- calendar integration;
- embeddings or an external vector database until direct-context limits are measured;
- unsupervised auto-memory and auto-resolution of contradictions;
- advanced exports beyond a simple inspectable local format.

## Evaluation Matrix

| Product behavior | Primary metric | Required failure labels |
|---|---|---|
| Post-meeting extraction | Per-item precision/recall by type and human usefulness | unsupported, wrong type, wrong owner/date, duplicate, omitted, wrong attribution |
| Evidence | Evidence coverage and exact source-span correctness | missing source, wrong span, wrong document/version, insufficient support |
| Correction/rejection | Action success and recurrence rate | overwritten edit, rejected item resurfaced, consequence unclear |
| Pre-meeting briefing | Supported-claim rate, question usefulness, scan time | irrelevant, stale, superseded, missing critical context, source mismatch |
| Live assistance | p50/p95 phrase-to-visible latency, useful rate, stale rate, distraction rate | late, obvious, duplicate, incorrect, wrong-source, no longer actionable |
| Deliberate silence | Appropriate-silence precision/recall on annotated windows | missed high-value moment, unnecessary interruption |
| Series memory | Current-state accuracy plus chronology preservation | superseded shown current, dispute hidden, wrong series, deleted source retained |
| Privacy/lifecycle | Offline-path network audit and deletion/version consistency | undisclosed remote call, orphaned derived data, stale cache/index result |
| Foundation health | Recovery rate and CPU/memory/battery per meeting hour | dropped transcript, growing backlog, corrupted/duplicate meeting, unrecoverable stop |

Metrics should be segmented by hardware, OS, transcription model, language, meeting shape, and generation provider. Numeric release thresholds are intentionally not invented here; the baseline and user evaluations must establish them.

## Confidence and Open Questions

| Area | Confidence | Reason / unresolved question |
|---|---|---|
| Existing Meetily capability boundary | HIGH | Confirmed in the current checkout and official repository/release documentation; actual performance remains unmeasured |
| Evidence, correction, control, and disclosure behaviors | HIGH | Supported by independent Microsoft HAX, Google PAIR, provenance, and local-first sources |
| Post-meeting-first sequencing | HIGH | Strong dependency fit with existing asynchronous summary/persistence foundation and Telu's shared knowledge model |
| Live-assistance behavior | MEDIUM | Research supports context-sensitive timing/control, but Telu-specific value, thresholds, and acceptable interruption rates require experiments |
| Recurring-series status model | MEDIUM | Provenance concepts are strong; user terminology and conflict-resolution UX need phase-specific testing |
| Exact success thresholds | LOW | Must be derived from target hardware benchmarks and representative-user evaluations |

Open questions for phase research:

- Which target hardware/OS/language combinations define the baseline matrix?
- What transcript age still feels actionable for each intervention type?
- What evidence granularity is fastest to verify: exact span, surrounding turns, or page/section preview?
- What item types require user acceptance versus allowing deterministic extraction?
- How should “disputed” differ from “unresolved” in the user's language?
- When a source is deleted, should dependent accepted knowledge be removed, retained as user-authored but source-missing, or require a choice?
- What local evaluation telemetry is acceptable by default, and what may ever leave the device?

## Sources

### Project and inspected foundation

- [Telu PROJECT.md](../PROJECT.md) — authoritative product scope, sequencing, constraints, and active requirements. **Confidence: HIGH.**
- [Idea verification](../../docs/telu/idea-verification.md) — source audit, product thesis, risks, success measures, and recommended validation order. **Confidence: HIGH.**
- Current repository inspection at commit `0e36d8835ad9e81f356412954a39f4771139aa2a` on 2026-09-20, especially `frontend/src-tauri/src/database/repositories/meeting.rs`, summary repositories/commands, recording/recovery paths, and frontend meeting services. **Confidence: HIGH for code presence; runtime behavior not yet benchmarked.**
- [Meetily Community Edition README](https://github.com/Zackriya-Solutions/meetily/blob/main/README.md) and [releases](https://github.com/Zackriya-Solutions/meetily/releases) — current official feature and architecture claims. **Confidence: MEDIUM after cross-check with checkout.**
- [Meetily privacy policy](https://github.com/Zackriya-Solutions/meetily/blob/main/PRIVACY_POLICY.md) — official local-first/provider boundary claims; implementation must still be tested. **Confidence: MEDIUM.**

### Human-AI behavior and evaluation

- [Microsoft Guidelines for Human-AI Interaction](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/) and [CHI 2019 publication](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/) — timing, dismissal, correction, uncertainty scoping, explanations, feedback, and controls. **Confidence: MEDIUM via research-provider classification; evidence quality is primary/official.**
- [Google PAIR: Feedback + Control](https://pair.withgoogle.com/chapter/feedback-controls/) and [PAIR design patterns](https://pair.withgoogle.com/guidebook-v2/patterns) — transparent feedback use, editing/resetting, control, supervision, and graceful failure. **Confidence: MEDIUM via research-provider classification; evidence quality is official.**
- [Building Proactive Voice Assistants: When and How (not) to Interact](https://arxiv.org/abs/2005.01322) and [May I Interrupt? Diverging Opinions on Proactive Smart Speakers](https://discovery.ucl.ac.uk/id/eprint/10152524/) — timing, social appropriateness, intrusiveness, and user control for proactive systems. **Confidence: MEDIUM; adjacent rather than meeting-specific.**
- [What's under the hood: Investigating Automatic Metrics on Meeting Summarization](https://aclanthology.org/2024.findings-emnlp.393/) — established automatic metrics can mask meeting-specific errors, supporting human task-level evaluation. **Confidence: MEDIUM via research-provider classification; peer-reviewed primary research.**
- [NIST AI Risk Management Framework and Generative AI Profile](https://www.nist.gov/itl/ai-risk-management-framework) — risk-based testing, evaluation, verification, and validation. **Confidence: MEDIUM via research-provider classification; authoritative primary source.**

### Provenance and local-first behavior

- [W3C PROV-O Recommendation](https://www.w3.org/TR/prov-o/) — generation, attribution, derivation, revision, specialization, and invalidation concepts used as a product-model analogue, not as a requirement to adopt RDF. **Confidence: MEDIUM via research-provider classification; normative primary source.**
- [Local-First Software: You Own Your Data, in Spite of the Cloud](https://www.inkandswitch.com/essay/local-first/) — on-device authority, offline operation, privacy, ownership, and deletion/control principles. **Confidence: MEDIUM via research-provider classification; peer-reviewed primary source.**

