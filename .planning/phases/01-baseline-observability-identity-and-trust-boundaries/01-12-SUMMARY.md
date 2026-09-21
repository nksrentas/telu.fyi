---
phase: 01-baseline-observability-identity-and-trust-boundaries
plan: 12
subsystem: outbound-attribution
tags: [rust, privacy, routing, observability, summaries, analytics, transcription, tdd]

requires:
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-10
    provides: Rust-owned EffectiveRoute resolution, location classification, sanitization, and dispatch validation
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-11
    provides: Action-time route validation and no-fallback provider behavior
provides:
  - Bounded per-run outbound-attempt evidence with stable ordering and explicit overflow incompleteness
  - Pre-dispatch attribution for summary providers, Ollama metadata lookup, and analytics capture
  - Retained blocked, failed, cancelled, status-error, and compatibility-retry outcomes without content or credentials
  - Explicit distinction between device-internal transcription and loopback network work
affects: [phase-01-evaluation, network-canary, provider-diagnostics, summary-generation, analytics]

actuals:
  tokens: 14315
  tasks: 2
  commits: 4
plan_head_before: 2893a3a58a088ed2106bbccd2db7957d2313f257

tech-stack:
  added: []
  patterns:
    - Every network dispatch passes through one fail-closed attribution gate before its request future is created
    - Monotonic offset plus stable sequence is the canonical ordering for concurrent attempts; UTC is correlation metadata only
    - A process-active ledger can be atomically replaced with a bounded evaluation-run ledger for later canary reconciliation

key-files:
  created:
    - frontend/src-tauri/src/trust/outbound.rs
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-12-task1-red.json
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-12-task2-red.json
  modified:
    - frontend/src-tauri/src/trust/mod.rs
    - frontend/src-tauri/src/trust/provider_route.rs
    - frontend/src-tauri/src/summary/llm_client.rs
    - frontend/src-tauri/src/summary/processor.rs
    - frontend/src-tauri/src/summary/service.rs
    - frontend/src-tauri/src/ollama/metadata.rs
    - frontend/src-tauri/src/ollama/ollama.rs
    - frontend/src-tauri/src/analytics/analytics.rs

key-decisions:
  - "Outbound evidence is fail-closed: an invalid record or full ledger prevents dispatch and marks the snapshot incomplete instead of silently dropping evidence."
  - "Device-internal work is excluded from the outbound ledger, while loopback HTTP remains a network attempt with its Local route identity intact."
  - "Summary generation and Ollama metadata reuse the canonical meeting ID; analytics uses it when the event already carries that ID, without adding event content to evidence."
  - "Ollama compatibility retry is a separate attributed attempt because it performs distinct network I/O."

patterns-established:
  - "Resolve, re-resolve, attribute, dispatch: record the sanitized active route synchronously before constructing or polling network work."
  - "Outcome mutation is narrow: only a permitted attempt can become failed, and only allowlisted redacted codes are retained."

requirements-completed: [PRIV-03]

coverage:
  - id: D1
    description: A bounded local ledger retains run and meeting identity, sanitized EffectiveRoute data, disposition, monotonic offset, UTC correlation, and stable sequence for every network attempt.
    requirement: PRIV-03
    verification:
      - kind: unit
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml outbound_ledger --lib -- --nocapture"
        status: pass
    human_judgment: false
  - id: D2
    description: Concurrent identical attempts remain distinct and deterministically ordered, while overflow increments an explicit counter and makes evidence incomplete.
    requirement: PRIV-03
    verification:
      - kind: unit
        ref: "trust::outbound::tests::outbound_ledger_keeps_identical_concurrent_attempts_distinct_and_ordered"
        status: pass
      - kind: unit
        ref: "trust::outbound::tests::outbound_ledger_marks_overflow_incomplete_without_erasing_retained_attempts"
        status: pass
    human_judgment: false
  - id: D3
    description: Summary provider, Ollama metadata, and analytics work records the effective Local, LAN, or Remote route before dispatch; blocked and failed attempts remain inspectable while device-only transcription stays outside the network ledger.
    requirement: PRIV-03
    verification:
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml outbound_attribution --lib -- --nocapture"
        status: pass
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml summary::llm_client::tests --lib -- --nocapture"
        status: pass
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml analytics::analytics::tests --lib -- --nocapture"
        status: pass
    human_judgment: false

duration: 25m
completed: 2026-09-21
status: complete
---

# Phase 01 Plan 12: Outbound Attempt Attribution Summary

**A bounded, content-redacted Rust ledger now records the active EffectiveRoute before summary-provider and analytics dispatch, preserving ordered evidence for failures, retries, concurrency, and overflow.**

## Performance

- **Duration:** 25m
- **Started:** 2026-09-21T07:48:58Z
- **Completed:** 2026-09-21T08:13:30Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Added a bounded `OutboundLedger` whose records contain only allowlisted run/meeting identity, sanitized route metadata, disposition, redacted code, monotonic offset, UTC correlation, and stable sequence.
- Kept simultaneous identical attempts separate and deterministically ordered, while capacity overflow advances an explicit counter and makes the snapshot incomplete without erasing retained evidence.
- Added one fail-closed pre-dispatch gate that validates the current route against the expected route and records permitted or blocked intent before network work can begin.
- Instrumented summary inference, each Ollama compatibility retry, Ollama metadata lookup, and analytics capture; request, cancellation, status, decoding, and analytics failures remain attributable.
- Kept in-process transcription explicitly device-internal while retaining loopback HTTP as a Local network attempt.

## Task Commits

Each TDD task was committed in RED/GREEN sequence:

1. **Task 1 RED: outbound ledger contracts** - `0be0c63` (test)
2. **Task 1 GREEN: bounded ordered outbound attribution** - `22a8e0a` (feat)
3. **Task 2 RED: dispatch attribution contracts** - `32803cf` (test)
4. **Task 2 GREEN: provider and analytics dispatch attribution** - `13d39fb` (feat)

## Files Created/Modified

- `frontend/src-tauri/src/trust/outbound.rs` - Defines bounded attempt storage, sanitized serialization, stable ordering, overflow completeness, failure transitions, the active ledger, and the common pre-dispatch gate.
- `frontend/src-tauri/src/trust/mod.rs` - Exports the outbound evidence API for provider and analytics seams.
- `frontend/src-tauri/src/trust/provider_route.rs` - Adds Analytics as a first-class route capability without changing existing provider configuration semantics.
- `frontend/src-tauri/src/summary/llm_client.rs` - Attributes provider requests and compatibility retries before dispatch and retains cancellation, send, and HTTP failure codes.
- `frontend/src-tauri/src/summary/processor.rs` and `frontend/src-tauri/src/summary/service.rs` - Carry the canonical meeting ID through chunking, synthesis, translation, normalization, and metadata lookup.
- `frontend/src-tauri/src/ollama/metadata.rs` and `frontend/src-tauri/src/ollama/ollama.rs` - Attribute uncached Ollama metadata HTTP work and retain network, status, and decode failures.
- `frontend/src-tauri/src/analytics/analytics.rs` - Honors the configured analytics host and attributes identify, event, and user-property captures through the shared gate.
- `01-12-task1-red.json` and `01-12-task2-red.json` - Preserve verified intentional RED evidence for both TDD tasks.

## Decisions Made

- Failed closed when an attribution record cannot be retained; an incomplete ledger can never be interpreted as evidence of zero egress.
- Used one monotonically increasing sequence as the concurrency tie-breaker after monotonic time, with UTC retained only for cross-record correlation.
- Excluded `RouteDestination::Device` from outbound evidence and retained all URL/socket routes, including loopback, so Local does not incorrectly mean in-process.
- Recorded each Ollama compatibility retry independently because each retry is a separate provider attempt.
- Reused canonical meeting identity where already available and otherwise left it absent rather than deriving identity from analytics or request payloads.

## TDD Gate Compliance

- **Task 1 RED:** Four ledger behavior tests failed against the intentional empty-record stub; `01-12-task1-red.json` returns `RED_EVIDENCE_OK` with the target assertion failure.
- **Task 1 GREEN:** All five `outbound_ledger` tests pass, covering fields, concurrency, deterministic ordering, overflow, redaction, and device-versus-loopback separation.
- **Task 2 RED:** Four dispatch tests failed before attribution and route enforcement were implemented; `01-12-task2-red.json` returns `RED_EVIDENCE_OK` with the target assertion failure.
- **Task 2 GREEN:** All four `outbound_attribution` tests pass, and the existing summary (9/9) and analytics (3/3) focused suites remain green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added an Analytics EffectiveRoute capability**
- **Found during:** Task 2 (Instrument provider and analytics dispatch seams)
- **Issue:** The route contract had no capability identity for analytics, so analytics attempts could not preserve their own active route as required.
- **Fix:** Added `Capability::Analytics` and resolved the configured PostHog origin through the same sanitized route classifier used by providers.
- **Files modified:** `frontend/src-tauri/src/trust/provider_route.rs`, `frontend/src-tauri/src/analytics/analytics.rs`
- **Verification:** `outbound_attribution`, analytics-focused tests, and `cargo check` pass.
- **Committed in:** `13d39fb`

**2. [Rule 2 - Missing Critical] Threaded canonical meeting identity and covered Ollama metadata dispatch**
- **Found during:** Task 2 (Instrument provider and analytics dispatch seams)
- **Issue:** The low-level summary client did not receive the canonical meeting ID, and an uncached Ollama metadata request performed summary-provider network I/O before inference without attribution.
- **Fix:** Passed the meeting ID through summary processing and transforms, then placed both metadata lookup and inference/retry requests behind the shared fail-closed gate.
- **Files modified:** `frontend/src-tauri/src/summary/llm_client.rs`, `frontend/src-tauri/src/summary/processor.rs`, `frontend/src-tauri/src/summary/service.rs`, `frontend/src-tauri/src/ollama/metadata.rs`, `frontend/src-tauri/src/ollama/ollama.rs`
- **Verification:** `outbound_attribution`, summary-focused tests, and `cargo check` pass.
- **Committed in:** `13d39fb`

---

**Total deviations:** 2 auto-fixed missing-critical trust-boundary gaps.
**Impact on plan:** Both changes are required to make the planned evidence complete. They add no dependency, provider fallback, endpoint, schema, or external telemetry.

## Issues Encountered

- Loopback summary and analytics fixtures require local socket access, so their focused suites were rerun with the existing permission-enabled test command; all passed.
- The Rust build emits existing warnings in unrelated audio, build-script, and summary code. No new compiler errors or task-blocking warnings were introduced.

## Known Stubs

None. Touched-file scans found no TODOs, FIXMEs, skipped tests, placeholder text, or intentional RED stubs remaining in production code.

## User Setup Required

None.

## Next Phase Readiness

- The later physical network canary can replace the process-active ledger with an evaluation-run ledger and reconcile its bounded snapshot against observed traffic.
- Summary and analytics attempts now expose ordered intent without storing prompts, transcripts, event payloads, credentials, query strings, or sensitive paths.
- A full ledger or invalid evidence field blocks dispatch with `OUTBOUND_ATTRIBUTION_INCOMPLETE`, so missing evidence is explicit.

## Self-Check: PASSED

- The outbound ledger, all nine modified Rust integration files, both RED-evidence records, and this summary exist on disk.
- Task commits `0be0c63`, `22a8e0a`, `32803cf`, and `13d39fb` resolve in git history.
- The persisted plan ledger measures four task commits before metadata finalization, both required plan verification commands pass, and `git diff --check` is clean.

---
*Phase: 01-baseline-observability-identity-and-trust-boundaries*
*Completed: 2026-09-21*
