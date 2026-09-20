# Phase 1 Multi-Source Coverage Audit

## Coverage Summary

All ROADMAP goal clauses, all 12 phase requirements, all 21 locked decisions, the in-scope research constraints, and all approved UI considerations are covered by Plans 01-09. CONTEXT has no deferred ideas. The phase introduces no package install and no external API capability.

| Source | ID | Feature / constraint | Plan | Status | Notes |
|---|---|---|---|---|---|
| GOAL | — | Measured, recoverable desktop foundation | 01-09 | COVERED | Identity, evidence, finalization, recovery, observability, and matrix evidence form the dependency chain. |
| GOAL | — | One meeting identity | 01-04 | COVERED | Rust-owned before capture; reused by evidence and recovery. |
| GOAL | — | Explicit Local/LAN/Remote boundaries | 05-06 | COVERED | Effective destination is authoritative. |
| REQ | BASE-01 | Reproducible target-hardware matrix | 09 | COVERED | Includes every roadmap scenario and explicit unverified combinations. |
| REQ | BASE-02 | Monotonic end-to-end stage timing | 02, 07 | COVERED | Includes visible UI acknowledgement; Phase 4-only stages remain reserved. |
| REQ | BASE-03 | Real queue depth/age/outcomes | 03, 07 | COVERED | Shared conservation ledger replaces placeholder status. |
| REQ | BASE-04 | CPU, memory, battery, provider, errors; local by default | 07-09 | COVERED | Unknown power evidence cannot pass a claimed gate. |
| REQ | BASE-05 | Stop, restart, recovery without duplicates/loss/ambiguity | 01, 03-04 | COVERED | Durable lifecycle and gap ledger govern completion. |
| REQ | BASE-06 | Evidence-derived threshold declaration | 09 | COVERED | Thresholds are recorded only after repeated baseline runs. |
| REQ | IDENT-01 | One durable Rust-owned ID | 01 | COVERED | Walking-skeleton tracer proves SQLite → IPC → React/recovery continuity. |
| REQ | IDENT-02 | Incremental idempotent final evidence | 02 | COVERED | Stable evidence IDs and final-only canonical persistence. |
| REQ | IDENT-03 | Repeat recovery reconciles | 04 | COVERED | Transactional same-ID reconciliation and count-invariance tests. |
| REQ | PRIV-01 | Visible route class and destination | 05 | COVERED | Settings and action-boundary disclosures use Rust DTOs. |
| REQ | PRIV-02 | No silent fallback | 05 | COVERED | Route failure preserves choice and exposes retry/reconfigure/cancel. |
| REQ | PRIV-03 | Local workflow without undisclosed egress | 06, 09 | COVERED | Attempt attribution plus network-blocked canary. |
| CONTEXT | D-01 | Versioned self-contained local bundle | 07 | COVERED | Manifest, environment, stages, queues, resources, routes, errors, result, summary. |
| CONTEXT | D-02 | Existing full stage path plus reserved future vocabulary | 02, 07 | COVERED | Reserved stages cannot be emitted in Phase 1. |
| CONTEXT | D-03 | Authoritative queue counters/depth/age | 03 | COVERED | Conservation and terminal-outcome tests. |
| CONTEXT | D-04 | Monotonic duration and complete environment metadata | 07 | COVERED | UTC only correlates records. |
| CONTEXT | D-05 | Required matrix and explicit unverified combinations | 09 | COVERED | Primary machine decision is a blocking-human gate. |
| CONTEXT | D-06 | Repeated evidence before threshold declaration | 09 | COVERED | Distributions/outliers retained; unknown fails. |
| CONTEXT | D-07 | Local raw artifacts and reviewable explicit export | 07-08 | COVERED | Transcript/audio opt-in separately for each export. |
| CONTEXT | D-08 | ID reused across all stores and consumers | 01-04 | COVERED | Recording metadata and IndexedDB are mirrors, not authorities. |
| CONTEXT | D-09 | Frontend never mints/remaps canonical ID | 01 | COVERED | Static and behavior checks remove timestamp identity. |
| CONTEXT | D-10 | Only finals are canonical evidence | 02 | COVERED | Partial UI text remains provisional. |
| CONTEXT | D-11 | Incremental idempotent stable evidence | 02 | COVERED | Upsert and redelivery tests. |
| CONTEXT | D-12 | Explicit durable lifecycle and strict complete predicate | 01, 03-04 | COVERED | Legacy status remains unverified. |
| CONTEXT | D-13 | Stop capture, close producers, bounded drain | 03 | COVERED | UI uses real depth/age. |
| CONTEXT | D-14 | Deadline/failure persists incomplete facts | 03 | COVERED | No quiet/fixed-delay completion. |
| CONTEXT | D-15 | Recovery reconciles rather than copies | 04 | COVERED | Repeat/concurrent recovery converges. |
| CONTEXT | D-16 | Missing/uncertain content remains visible | 04 | COVERED | History/detail/recovery expose gaps and unknowns. |
| CONTEXT | D-17 | Bounded overload with explicit outcomes | 03, 09 | COVERED | No audio-callback blocking or silent loss. |
| CONTEXT | D-18 | Route class + concrete destination at choice/action | 05 | COVERED | Effective route snapshot retained per meeting/run. |
| CONTEXT | D-19 | Visible failure and explicit recovery actions | 05 | COVERED | Provider choice/local data preserved. |
| CONTEXT | D-20 | Calm compact trust UI and deeper diagnostics | 05, 08 | COVERED | Approved UI contract is implemented without navigation redesign. |
| CONTEXT | D-21 | Network-blocked local canary | 06, 09 | COVERED | Every observed attempt reconciles with attribution. |
| RESEARCH | — | Five dependency boundaries | 01-09 | COVERED | Identity/evidence → queue/stop/recovery → trust/observability → evidence gate. |
| RESEARCH | — | Existing stack and lockfiles; no package install | 01-09 | COVERED | Package-legitimacy gate is not triggered. |
| RESEARCH | — | Forward-only SQLx migrations and legacy upgrade fixtures | 01-04, 07 | COVERED | Historical migrations remain immutable. |
| RESEARCH | — | Bounded Tokio admission without callback blocking | 03 | COVERED | VAD/ASR algorithms are not redesigned. |
| RESEARCH | — | Runtime route resolution and least-privilege capability scope | 05-06 | COVERED | Provider names do not determine locality. |
| RESEARCH | — | Redacted local observability and explicit export | 07-08 | COVERED | Raw content and secrets are excluded by default. |
| UI | empty | Diagnostics, recovery, and gap empty states | 04, 08 | COVERED | Exact approved copy; no blank panel. |
| UI | loading | Provider, finalization, recovery, diagnostic loading | 03-05, 08 | COVERED | Named state; surrounding content retained; no fabricated progress. |
| UI | error | Provider, recovery, diagnostic load/export errors | 04-05, 08 | COVERED | Inline noun/capability-specific recovery actions. |
| UI | populated | History, runs, recovery candidates, gaps | 04, 08 | COVERED | Compact ordered rows and contained scrolling. |
| UI | partial | Incomplete and recovered meetings | 04 | COVERED | Gaps and unknowns remain visible. |
| UI | overflow | History, diagnostics, recovery preview | 04, 08 | COVERED | Contained scroll; technical tables only scroll horizontally. |
| UI | zero-one-many | Queues, gaps, meetings, runs | 03-04, 08 | COVERED | Singular/plural and dedicated zero-state copy. |
| UI | long-text | Titles, destinations, errors, IDs | 04-05, 08 | COVERED | Compact truncation plus selectable sanitized detail. |

## Specless Edge Probe Accounting

Probe-surfaced items: **22**. Authored as explicit plan truths: **15**. Authored as flagged assumptions: **7**. Silent drops: **0**.

| Requirement | Category | Disposition | Plan acceptance |
|---|---|---|---|
| BASE-01 | adjacency | explicit | Adjacent/same-config runs keep separate run IDs and bundles. |
| BASE-01 | empty | explicit | Empty/missing manifest is invalid; one scenario is runnable. |
| BASE-01 | ordering | explicit | Manifest order is stable; equal offsets use event sequence. |
| BASE-02 | unclassified | flagged assumption | “Visible” means renderer acknowledgement, not physical pixel proof. |
| BASE-03 | adjacency | explicit | Simultaneous transitions retain one terminal outcome per work ID. |
| BASE-03 | empty | explicit | Empty queue reports depth 0 and no oldest age without implying completion. |
| BASE-03 | ordering | explicit | Equal admission times use stable work/event sequence ordering. |
| BASE-04 | unclassified | flagged assumption | Battery evidence may be unknown; CPU is not relabeled as energy. |
| BASE-05 | unclassified | flagged assumption | Recovery can be usable while incomplete and must preserve gaps. |
| BASE-06 | unclassified | flagged assumption | Threshold declaration is based on reviewed repeated runs, not auto-selected from a favorable run. |
| IDENT-01 | unclassified | flagged assumption | Existing historical IDs remain stable; only new sessions use the new pre-capture contract. |
| IDENT-02 | unclassified | flagged assumption | Source segment keys are stable per source/track and not derived from mutable text. |
| IDENT-03 | idempotency | explicit | Repeating recovery preserves meeting/evidence IDs and counts. |
| IDENT-03 | concurrency | explicit | Interrupted/concurrent reconciliation serializes transactionally to the same result. |
| PRIV-01 | adjacency | explicit | Same destination across capabilities remains separately disclosed per capability. |
| PRIV-01 | empty | explicit | Missing/invalid effective destination blocks work as unavailable. |
| PRIV-01 | ordering | explicit | Route rows use deterministic capability ordering. |
| PRIV-02 | unclassified | flagged assumption | Material route-resolution change is failure, not reclassification after consent. |
| PRIV-03 | adjacency | explicit | Identical/simultaneous attempts remain individually attributable. |
| PRIV-03 | empty | explicit | A local canary may have zero outbound attempts, but a missing ledger is invalid. |
| PRIV-03 | ordering | explicit | Attempts order by monotonic offset then stable event sequence. |
| PRIV-03 | concurrency | explicit | Concurrent attempts are individually attributed; any unattributed attempt fails the canary. |

## Prohibition Recall Accounting

Raw recall candidates were filtered to four bespoke privacy/transparency/safety constraints. Generic path traversal, injection, retention, and access-control items are canon and remain in each plan's ASVS L1 threat model rather than being minted as prohibitions.

Probe-kept prohibitions: **4**. Descriptor-less flagged-unverified entries authored in plan `must_haves.prohibitions`: **4**. Silent drops: **0**.

1. Diagnostic artifacts and exports must not include transcript/audio, credentials, or sensitive full paths by default, and export must not upload.
2. Baseline reports must not turn unknown, omitted, non-reproducible, or failed scenarios into a pass or universal support claim.
3. Recovery and completeness UI must not hide gaps or describe incomplete, recovered-with-gaps, or legacy-unverified meetings as complete.
4. Trust UI/runtime must not claim Local for LAN/Remote destinations or silently substitute another route/provider.
