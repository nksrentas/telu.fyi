# Idea verification

## Product thesis

Telu is a context-aware desktop companion for ongoing conversations. It should help a user prepare for a meeting, recognize useful context while the meeting is happening, and carry reliable memory into the next conversation.

The value is not transcription by itself. The differentiator is timely, evidence-aware assistance across a series of meetings.

## Intended experience

### Before a meeting

- Attach or select relevant reference material.
- Bring forward prior decisions, unresolved questions, commitments, and important facts from the same meeting series.
- Produce a concise briefing focused on what the user needs to know and ask.

### During a meeting

- Capture microphone and system audio locally.
- Maintain a sufficiently fresh transcript.
- Detect when new speech connects to a relevant document, prior decision, open question, or contradiction.
- Surface a small number of timely, useful questions or facts.
- Stay silent when confidence or value is too low.
- Preserve the evidence behind every suggestion so the user can trust it.

### After a meeting

- Produce a summary, decisions, action items, and unresolved questions.
- Identify important questions that were not asked or answered.
- Update the meeting-series memory without losing source attribution, chronology, or superseded facts.
- Prepare reliable context for the next meeting.

## Fit assessment: Meetily

Meetily is a credible foundation for Telu as a desktop application, but Telu is **not** a small feature extension. The appropriate framing is a substantial product fork that retains valuable native capabilities while introducing new knowledge, memory, and live-assistance systems.

### Strong foundations to retain

- Tauri/Rust desktop architecture with a Next.js/React interface.
- Native microphone and system-audio capture.
- Local Whisper/Parakeet transcription integration.
- Existing transcript events and recording lifecycle.
- Meeting history and local SQLite persistence.
- Recording management and recovery mechanisms.
- Existing local and hosted LLM integrations.
- Asynchronous post-meeting summary processing.

These are meaningful reusable capabilities. They make Meetily a better starting point than rebuilding audio capture, transcription plumbing, persistence, and the desktop shell from zero.

### Major systems Telu still needs

- A stable meeting identity that exists before recording begins and persists through preparation, live assistance, recovery, and post-meeting analysis.
- Meeting-series relationships and series-scoped memory.
- PDF, DOCX, and other reference-document ingestion with extraction, source locations, versioning, ownership, and deletion consistency.
- Evidence-aware retrieval across current-meeting documents and historical series context.
- A low-latency live-assistance loop that handles cancellation, backpressure, stale work, and topic changes.
- A suggestion policy that decides when a question is useful enough to show and when Telu should stay silent.
- Structured decisions, commitments, action items, open questions, and their status over time.
- Conflict handling for old versus new facts, including superseded budgets, dates, decisions, and plans.
- Trust UX that exposes the source behind a suggestion.
- Product evaluation and telemetry for usefulness, distraction, latency, and factual grounding.

## Key findings from the source audit

The prior verification was a static review of Meetily's public `main` branch, not a running benchmark or a commit-pinned production assessment. Its conclusions should guide the first experiments, not replace measurements.

### Architecture

The active product is a self-contained Tauri application. Rust owns the native capabilities and the Next.js frontend is statically exported. The old Python backend is archived and should not be treated as the current application backend.

### Transcript freshness is the immediate technical risk

Meetily emits transcript updates that Telu can conceptually consume, which is a useful integration point. However, the inspected live path closes speech segments based on voice-activity boundaries. During long uninterrupted speech or continuous system audio, relevant words may not reach the assistant quickly enough.

The active transcription flow also uses a single worker with unbounded queues. If transcription becomes slower than incoming audio, a backlog can form and suggestions can become stale even when the language model itself is fast.

The important latency is end-to-end:

1. relevant words are spoken;
2. audio is segmented;
3. transcription completes;
4. context is selected;
5. a suggestion is generated;
6. the suggestion becomes visible.

Optimizing only step 5 will not solve the product problem.

### Existing history is not yet conversational memory

Meetily stores meetings and transcripts, but transcript search is simple text matching rather than a reliable series-memory system. A useful memory layer must preserve chronology, scope, source evidence, and fact status—not just retrieve semantically similar text.

### Document knowledge is new functionality

The existing import flow is for audio meetings, not knowledge documents. Document extraction, chunking or structured parsing, retrieval, citations, versioning, and cleanup should be treated as a new subsystem.

### Post-meeting work is the most natural early extension

Meetily already has asynchronous summaries and meeting persistence. Structured post-meeting output is therefore a lower-risk first product slice than immediate real-time coaching. It can also generate the clean decisions, actions, and open questions needed by later series memory.

## The hardest product problem

The enduring challenge is not connecting an LLM. It is deciding which intervention is valuable **right now**.

A technically correct suggestion can still be harmful when it is late, obvious, redundant, poorly sourced, too frequent, or disconnected from the speaker's current intent. Telu should optimize for a few high-value interventions and deliberate silence.

Every live suggestion should be evaluated against at least these questions:

- Is it new and relevant to the current topic?
- Can the user still act on it?
- Is there trustworthy supporting evidence?
- Does it add more value than distraction?
- Has an equivalent suggestion already been shown?
- Has the conversation moved on since the request began?

## Recommended validation sequence

### 1. Establish the baseline

- Run the unmodified Meetily application on the target hardware.
- Measure transcript delay during short utterances, long uninterrupted speech, overlapping speech, and continuous system audio.
- Record CPU, memory, model choice, and queue behavior.
- Confirm recovery and meeting persistence behavior.

### 2. Prove a narrow post-meeting slice

- Convert one completed meeting into structured decisions, action items, and open questions.
- Preserve source transcript references for each item.
- Let a user correct or reject extracted items.

This validates the core information model without requiring real-time performance.

### 3. Prove pre-meeting context without premature infrastructure

- Start with a small, bounded set of pasted text or extracted documents.
- Generate a briefing and candidate questions with explicit sources.
- Use direct context when it fits; introduce selective retrieval only when corpus size and quality require it.

Retrieval does not automatically require embeddings, and embeddings do not automatically require an external vector database.

### 4. Prove the live loop

- Feed fresh transcript increments into a bounded, cancellable suggestion pipeline.
- Reject work that becomes stale after a topic change.
- Display at most one or two high-confidence interventions at a time.
- Measure from spoken phrase to visible suggestion.

### 5. Add series memory

- Group recurring meetings into a series.
- Carry forward accepted decisions, commitments, open questions, and verified facts.
- Preserve dates and sources.
- Mark facts as current, superseded, disputed, or unresolved.

## Initial success measures

Before broad implementation, define target ranges for:

- Median and 95th-percentile time from relevant speech to visible suggestion.
- Percentage of suggestions judged useful.
- Percentage judged stale, obvious, incorrect, or distracting.
- Suggestion acceptance or follow-through rate.
- Grounding accuracy and source correctness.
- Duplicate-suggestion rate.
- Rate of deliberate silence during low-value periods.
- CPU, memory, battery, and model cost per meeting hour.
- Accuracy of carried-forward decisions and open questions across a meeting series.

## Current conclusion

Proceed with the Meetily fork, but treat the first phase as validation rather than a feature build-out. Preserve the native capture, transcription, desktop, and persistence strengths. Test transcript freshness and structured post-meeting knowledge before committing to a full real-time assistant architecture.

The immediate technical question is whether Telu can receive and process relevant speech while it is still actionable. The defining product question is whether Telu can earn the right to interrupt.
