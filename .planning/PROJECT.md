# Telu

## What This Is

Telu is a local-first, context-aware desktop companion for people whose work unfolds across recurring conversations. It helps a user prepare for a meeting, surfaces a small number of timely and evidence-backed facts or questions while the conversation is still actionable, and carries reliable decisions, commitments, open questions, and verified facts into the next meeting.

Telu is a substantial product fork of the open-source Meetily desktop application, not a transcription add-on. It retains Meetily's native capture, transcription, persistence, desktop, and model-provider foundations while adding structured knowledge, document context, trustworthy live assistance, and meeting-series memory.

## Core Value

Telu surfaces the right evidence-backed context at the moment it is useful—and stays silent when an intervention would not add more value than distraction.

## Requirements

### Validated

(None yet — the Meetily foundation and Telu product assumptions must be measured and validated on the target hardware.)

### Active

- [ ] Establish a reproducible Meetily baseline covering end-to-end transcript freshness, queue behavior, resource use, persistence, and recovery.
- [ ] Preserve the existing Tauri/Rust desktop shell, Next.js/React interface, native microphone and system-audio capture, local transcription, SQLite persistence, recording recovery, history, and summary-provider integrations where baseline evidence supports them.
- [ ] Convert completed meetings into structured decisions, commitments, action items, and open questions with transcript evidence and user correction or rejection.
- [ ] Ingest a bounded set of reference documents or pasted context and produce concise pre-meeting briefings and candidate questions with explicit sources.
- [ ] Prove a bounded and cancellable live-assistance loop that rejects stale work, limits concurrent suggestions, handles topic changes and backpressure, and measures spoken-phrase-to-visible-suggestion latency.
- [ ] Group recurring meetings into stable series and carry forward accepted facts and structured knowledge with chronology, provenance, and current, superseded, disputed, or unresolved status.
- [ ] Expose the evidence behind every suggestion or remembered fact through calm trust UX.
- [ ] Evaluate usefulness, distraction, latency, grounding, duplication, deliberate silence, resource consumption, and memory correctness.
- [ ] Preserve a local-first privacy model while making every remote provider, LAN path, or external destination explicit and user-controlled.

### Out of Scope

- A transcription-only product — transcription is retained infrastructure, not Telu's differentiator.
- Immediate broad real-time coaching — live assistance remains gated on transcript freshness and usefulness evidence.
- Premature embeddings or an external vector database — use direct bounded context until corpus size and retrieval quality justify additional infrastructure.
- A new standalone Python/FastAPI application backend — Meetily's archived backend is not the supported product architecture.
- Cloud-by-default audio, transcript, or memory storage — remote processing occurs only through an explicitly selected provider or destination.
- High-frequency or unsourced interventions — Telu should prefer deliberate silence to late, obvious, redundant, or weakly grounded suggestions.

## Context

The source product thesis and sequencing live in `docs/telu/`. Those documents describe three connected experiences:

- Before meetings: select relevant material, recall prior decisions and unresolved questions, and produce a concise sourced briefing.
- During meetings: capture locally, maintain a fresh transcript, connect speech to relevant evidence, and surface only timely high-value interventions.
- After meetings: structure what was decided, what must happen next, what remains unanswered, and what should carry into the next conversation.

Meetily is a credible foundation because its active product is a self-contained Tauri application: Rust owns native audio, transcription, persistence, and orchestration, while a Next.js/React frontend presents the desktop experience. Existing meeting history, recording lifecycle, local SQLite data, model integrations, and asynchronous summaries reduce the amount of infrastructure Telu must rebuild.

The foundation has not yet been benchmarked or commit-pinned for Telu. The prior audit was static. The immediate technical risk is end-to-end transcript freshness: voice-activity boundaries can delay long uninterrupted speech, and a single worker with unbounded queues can make suggestions stale even when model inference is fast. The relevant latency path runs from spoken words through segmentation, transcription, context selection, generation, and rendering.

Post-meeting structured knowledge is the first product slice because it extends existing persistence and summary behavior without requiring real-time guarantees. It also creates the corrected decisions, actions, and open questions needed by later briefings and meeting-series memory.

The hardest long-term problem is intervention policy, not connecting an LLM. A suggestion must be new, relevant, still actionable, evidence-backed, non-duplicative, and worth the interruption. Product evaluation must therefore measure deliberate silence as well as suggestion acceptance.

Brand direction is calm, precise, warm, and native to a high-quality desktop productivity application. The product name is **Telu**, styled as **telu** in brand contexts, with `telu.fyi` as the intended domain direction subject to re-verification before purchase.

## Constraints

- **Architecture**: Extend the active Tauri/Rust core and Next.js/React desktop interface; do not reintroduce the archived Python/FastAPI backend as a supported dependency.
- **Privacy**: Keep capture, transcription, persistence, and memory local by default; disclose and configure every remote provider or destination.
- **Evidence**: Every extracted item, briefing claim, live suggestion, and carried-forward fact must retain source attribution suitable for user inspection.
- **Latency**: Judge live assistance by end-to-end spoken-phrase-to-visible-suggestion latency, including segmentation, queues, retrieval, generation, cancellation, and rendering.
- **Intervention quality**: Prefer a few high-confidence interventions and deliberate silence over frequent or weak suggestions.
- **Data lifecycle**: Document versions, ownership, deletion, meeting identity, series membership, chronology, and supersession must remain consistent across preparation, recording, recovery, and analysis.
- **Platform behavior**: Preserve native microphone/system-audio permissions, device handling, recovery, and resource constraints across supported desktop platforms.
- **Scope discipline**: Validate direct bounded context before introducing embeddings, vector infrastructure, or broad autonomous memory behavior.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork Meetily rather than rebuild capture and transcription | Meetily already provides valuable native desktop, audio, transcription, persistence, and provider infrastructure | — Pending baseline validation |
| Treat the first milestone as validation-led product development | Transcript freshness and intervention usefulness are existential risks that architecture alone cannot answer | — Pending |
| Build structured post-meeting knowledge before live assistance | It is lower risk, extends existing asynchronous behavior, and produces the information model later phases require | — Pending |
| Use bounded direct context before adding retrieval infrastructure | Embeddings and external vector databases add complexity before corpus size or quality demonstrates a need | — Pending |
| Make evidence and correction first-class | Trust requires inspectable sources and a way to reject or repair extracted knowledge | — Pending |
| Gate live assistance on usefulness and staleness measurements | Technically correct but late or distracting suggestions undermine the product | — Pending |
| Preserve local-first behavior and explicit remote boundaries | Meeting audio, transcripts, and accumulated memory are sensitive user data | — Pending |
| Structure delivery as vertical MVP slices | Each phase should prove an end-to-end user capability and reduce risk before deeper investment | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition**:
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone**:
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current evidence, feedback, and measurements

---
*Last updated: 2026-09-20 after initialization*
