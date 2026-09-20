# Walking Skeleton — Telu

**Phase:** 1
**Generated:** 2026-09-20

## Capability Proven End-to-End

> A user can start a recording whose one Rust-owned meeting identity is persisted in SQLite before capture, returned through Tauri IPC, retained by React and the recovery cache, and reflected by the visible recording lifecycle.

This is a brownfield walking skeleton. It extends the retained Meetily Community Edition desktop application; it does not scaffold another application, introduce an HTTP backend, or use the Meetily Pro Agent API as an internal layer.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Desktop framework | Existing Tauri 2 Rust core with Next.js 14 / React 18 static-export UI | Native capture, transcription, persistence, and desktop lifecycle already live here; the skeleton proves the active product path. |
| Data layer | Existing SQLite database through SQLx embedded forward-only migrations | One local canonical store can enforce stable IDs, lifecycle transitions, evidence uniqueness, and recovery reconciliation transactionally. |
| IPC | Tauri commands for authoritative operations and snapshots; Tauri events for compact progress notifications | This preserves the Community Edition boundary and keeps Rust authoritative while React renders state. |
| Identity | UUID minted once by Rust before recording and reused by SQLite, recording metadata, frontend state, IndexedDB recovery, transcript evidence, diagnostics, and later phase consumers | Prevents renderer reloads, retries, and recovery from creating a second logical meeting. |
| Authentication | No new authentication surface | Phase 1 is a single-user local desktop capability; privileged operations remain constrained by Tauri command validation and capability scopes. |
| Runtime / distribution | Existing packaged Tauri application and documented `pnpm --dir frontend run tauri:dev` local full-stack command | The product is a desktop app; no web deployment or sidecar service is added. |
| Directory layout | Native capabilities under `frontend/src-tauri/src`, migrations under `frontend/src-tauri/migrations`, React UI under `frontend/src`, and local validation artifacts under app data | Follows current repository ownership and keeps runtime data out of tracked source. |
| Privacy boundary | Existing configured routes are resolved at runtime as Local, LAN, or Remote from their effective destination | Provider brand is a detail; the route contract is capability + boundary + sanitized destination + provider/model detail. |

## Stack Touched in Phase 1

- [x] Project scaffold — retain the checked-in Tauri/Next.js build, lint, and test commands; no new scaffold is created.
- [x] Routing — use existing recording/settings/meeting-detail surfaces and Tauri command registration.
- [x] Database — prove a real pre-capture meeting write and subsequent read of the same identity.
- [x] UI — consume the Rust-owned identity and lifecycle through typed services/context and render the authoritative state.
- [x] Runtime — exercise the full stack with `pnpm --dir frontend run tauri:dev` and focused Rust/frontend verification.

## Phase 1 Execution Map

- Plans 01-02: pre-capture Rust identity and same-ID recording/cache propagation.
- Plans 03-04: incremental final evidence and correlated renderer acknowledgement.
- Plans 05-07: bounded queue ledger, durable finalization, and truthful renderer status.
- Plans 08-09: transactional recovery and completeness/gap UI.
- Plans 10-14: effective routes, no-fallback UX, outbound attribution, canary control, and least privilege.
- Plans 15-17: monotonic/resource capture, evaluation persistence, and validated local bundles.
- Plans 18-19: Diagnostics/export UX and the approved physical baseline gate.

## Out of Scope (Deferred to Later Slices)

- Structured knowledge extraction, review, and evidence navigation (Phase 2).
- Document ingestion and sourced preparation (Phase 3).
- Live suggestions, topic handling, or intervention policy (Phase 4).
- Recurring-series memory (Phase 5).
- Embeddings, vector infrastructure, broad corpus chat, calendar/bot automation, and cloud collaboration.
- Broad ASR/VAD quality redesign before the Phase 1 measurements exist.
- The archived `backend/` FastAPI application and Meetily Pro Agent API internals.

## Subsequent Slice Plan

Each later phase adds a vertical slice without changing the skeleton's Rust/Tauri/SQLite authority boundary:

- Phase 2: derive reviewable evidence-linked post-meeting knowledge from canonical final transcript evidence.
- Phase 3: prepare from bounded accepted knowledge and versioned local documents.
- Phase 4: validate a bounded, cancellable, evidence-backed live-assistance loop.
- Phase 5: carry reviewed knowledge across explicitly managed recurring meeting series.
- Phase 6: harden lifecycle, privacy, migration, export, and platform behavior for release.
