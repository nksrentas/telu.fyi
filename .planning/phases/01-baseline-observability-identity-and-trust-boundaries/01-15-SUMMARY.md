---
phase: 01-baseline-observability-identity-and-trust-boundaries
plan: 15
subsystem: observability-and-resource-evidence
tags: [rust, tokio, sysinfo, monotonic-timing, power, battery, tdd]

requires:
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-03
    provides: Stable meeting identity and recording lifecycle seams
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-04
    provides: Evidence identity and final transcript persistence acknowledgement
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-05
    provides: Renderer acknowledgement contract for visible transcript evidence
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-06
    provides: Bounded transcription queue ledger and stable work identity
provides:
  - One Rust monotonic origin for the actual Phase 1 capture-to-visible stage path
  - Bounded non-blocking redacted stage admission with explicit overflow evidence
  - Run-correlated process/system CPU and memory samples with measured intervals
  - Platform-local power source and battery observations with method, uncertainty, and explicit unknown energy impact
affects: [phase-01-evaluation, plan-01-16, plan-01-18, plan-01-19, latency-analysis, resource-gates]

actuals:
  tokens: 13169
  tasks: 2
  commits: 4
plan_head_before: 2091087c4f9a745264e161a1d88f33be8659c33b

tech-stack:
  added: []
  patterns:
    - A queue-owned StageClock supplies one monotonic run origin to capture, worker, persistence, and UI acknowledgement seams
    - Hot observability admission uses bounded try_send and records overflow independently from transcription acceptance
    - Resource records distinguish process and system scope and preserve sample interval and monotonic run offset
    - Platform power collectors report method and uncertainty while unavailable energy impact remains an explicit blocking unknown

key-files:
  created:
    - frontend/src-tauri/src/observability/mod.rs
    - frontend/src-tauri/src/observability/stage_clock.rs
    - frontend/src-tauri/src/observability/resource_sampler.rs
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-15-task1-red.json
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-15-task2-red.json
  modified:
    - frontend/src-tauri/src/lib.rs
    - frontend/src-tauri/src/audio/pipeline.rs
    - frontend/src-tauri/src/audio/recording_commands.rs
    - frontend/src-tauri/src/audio/transcription/queue_ledger.rs
    - frontend/src-tauri/src/audio/transcription/worker.rs

key-decisions:
  - "The transcription QueueLedger owns the per-meeting StageClock so capture admission, worker execution, persistence, and renderer acknowledgement share one run identity and monotonic origin."
  - "Evidence identity is allocated at the segment boundary and reused through enqueue, worker output, persistence, and UI acknowledgement instead of being reconstructed from wall-clock data."
  - "Observability overflow is counted but never changes transcription acceptance, keeping telemetry bounded and off the critical audio path."
  - "Power source and battery percentage are platform observations; energy impact is never inferred from CPU and remains explicit unknown until an approved collector measures it."

patterns-established:
  - "Monotonic stage evidence: serialize offsets and stable sequence from a Rust Instant origin; retain UTC only for cross-record correlation."
  - "Honest resource evidence: every sample names scope, interval, collector, method, and uncertainty, and an unavailable measurement fails closed."

requirements-completed: [BASE-02, BASE-03, BASE-04]

coverage:
  - id: D1
    description: The actual Phase 1 capture, segment, enqueue, worker start, final output, persistence, and UI acknowledgement path shares one monotonic timeline and stable correlation identity.
    requirement: BASE-02
    verification:
      - kind: unit
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml observability_stage --lib -- --nocapture"
        status: pass
    human_judgment: false
  - id: D2
    description: Hot stage admission is bounded, non-blocking, content-redacted, and reports overflow without changing transcription acceptance.
    requirement: BASE-03
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/observability/stage_clock.rs#observability_stage_hot_admission_is_bounded_and_overflow_explicit"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/observability/stage_clock.rs#observability_stage_actual_phase1_seams_are_wired_and_content_redacted"
        status: pass
    human_judgment: false
  - id: D3
    description: CPU and memory samples carry process/system scope, measured interval, run identity, and monotonic offset; power evidence carries a local collector method and explicit uncertainty.
    requirement: BASE-04
    verification:
      - kind: unit
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml resource_sampler --lib -- --nocapture"
        status: pass
      - kind: other
        ref: "/usr/bin/pmset -g batt"
        status: pass
    human_judgment: false
  - id: D4
    description: A battery-impact claim remains blocked when the approved evidence method is unavailable; CPU is never relabeled as energy impact.
    requirement: BASE-04
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/observability/resource_sampler.rs#resource_sampler_unknown_power_is_blocking_and_never_cpu_derived"
        status: pass
      - kind: unit
        ref: "frontend/src-tauri/src/observability/resource_sampler.rs#resource_sampler_platform_collector_never_infers_energy_from_cpu"
        status: pass
    human_judgment: true
    rationale: Plan 19 retains the blocking reference-machine decision that selects and validates the authoritative battery or power-impact evidence method.

duration: 27m
completed: 2026-09-21
status: complete
---

# Phase 01 Plan 15: Monotonic Stage and Resource Evidence Summary

**Telu now measures its real capture-to-visible transcript path on one bounded, content-redacted Rust monotonic timeline and records scoped local resource and power evidence without fabricating battery impact.**

## Performance

- **Duration:** 27m
- **Started:** 2026-09-21T09:10:29Z
- **Completed:** 2026-09-21T09:37:42Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added a versioned `StageClock` whose stable sequence and offsets come from one Rust `Instant` origin while UTC remains correlation metadata only.
- Wired the actual audio-capture, segment, queue acceptance, worker start, final transcript, persistence, and renderer acknowledgement seams to the same run, meeting, work, and evidence identity.
- Kept hot-path telemetry bounded and non-blocking with explicit overflow accounting, allowlisted identifier fields, and no transcript, audio, provider secret, file I/O, await, or blocking lock at admission.
- Added run-correlated process/system CPU and memory samples with explicit scope, interval, and monotonic observation offset.
- Added local macOS `pmset` and Linux sysfs power collectors that report source, battery percentage, method, and uncertainty while leaving unmeasured energy impact as an explicit unknown.

## Task Commits

Each TDD task was committed in RED/GREEN sequence:

1. **Task 1 RED: monotonic and bounded stage-path contracts** - `b65ff52` (test)
2. **Task 1 GREEN: actual capture-to-visible monotonic instrumentation** - `9b8b8a3` (feat)
3. **Task 2 RED: scoped resource and honest power-evidence contracts** - `968ef7d` (test)
4. **Task 2 GREEN: local resource and platform power sampling** - `75dd521` (feat)

## Files Created/Modified

- `frontend/src-tauri/src/observability/mod.rs` - Exposes the stage clock and resource-evidence types.
- `frontend/src-tauri/src/observability/stage_clock.rs` - Implements the bounded stage channel, monotonic offsets, stable sequence, future-stage rejection, and redaction contracts.
- `frontend/src-tauri/src/observability/resource_sampler.rs` - Samples scoped CPU/memory data and typed platform power evidence without CPU-derived energy claims.
- `frontend/src-tauri/src/audio/pipeline.rs` - Admits audio-capture, segment-boundary, and accepted-enqueue stage evidence without blocking capture.
- `frontend/src-tauri/src/audio/transcription/queue_ledger.rs` - Owns the per-meeting clock and stable work/evidence correlation carried through the queue.
- `frontend/src-tauri/src/audio/transcription/worker.rs` - Records worker start, final transcript production, and successful persistence on the shared clock.
- `frontend/src-tauri/src/audio/recording_commands.rs` - Records renderer acknowledgement only after the existing validated UI acknowledgement seam succeeds.
- `frontend/src-tauri/src/lib.rs` - Registers the observability module.
- `01-15-task1-red.json` and `01-15-task2-red.json` - Preserve validated intentional RED evidence for both TDD tasks.

## Decisions Made

- Put the clock on the queue ledger rather than constructing independent clocks in capture and worker code, preserving one authoritative monotonic origin across asynchronous boundaries.
- Generate a stable evidence UUID at segmentation and carry it forward with the accepted work item so persistence and UI acknowledgement identify the same evidence.
- Treat observability admission as lossy but auditable: `try_send` reports acceptance, closure, or overflow, and an atomic overflow counter keeps dropped telemetry visible without backpressuring audio.
- Reserve Phase 4 context/generation/cancellation/suggestion stage variants in the schema but reject their emission during Phase 1.
- Keep energy impact distinct from CPU utilization. Production collectors can report power source and battery percentage now, while energy impact remains `Unknown(EnergyImpactNotMeasured)` until an authoritative method exists.

## TDD Gate Compliance

- **Task 1 RED:** Six focused contracts failed against the unavailable stage-clock skeleton; `01-15-task1-red.json` validates the intentional failure as `RED_EVIDENCE_OK`.
- **Task 1 GREEN:** Six focused stage tests pass, including UTC-jump immunity, stable complete-path ordering, future-stage rejection, bounded overflow, actual seam wiring, and content redaction.
- **Task 2 RED:** The focused tests failed because interval was discarded, process data was mislabeled as system scope, and valid platform power evidence remained unknown; `01-15-task2-red.json` validates the intentional failure as `RED_EVIDENCE_OK`.
- **Task 2 GREEN:** Five focused resource tests pass, including scoped metrics, shared monotonic correlation, local power parsing, fail-closed unknown handling, and the prohibition on CPU-derived energy impact. `cargo check` also passes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended adjacent identity and acknowledgement seams omitted from the task file list**
- **Found during:** Task 1 (Implement monotonic stage correlation and bounded admission)
- **Issue:** The listed pipeline and worker files could not alone provide one stable evidence identity through queue ownership, persistence, and the actual validated renderer acknowledgement seam required by the plan's must-have truth.
- **Fix:** Registered the observability module, made the existing queue ledger own the clock and correlation identity, and emitted the final UI stage from the existing recording acknowledgement command.
- **Files modified:** `frontend/src-tauri/src/lib.rs`, `frontend/src-tauri/src/audio/transcription/queue_ledger.rs`, `frontend/src-tauri/src/audio/recording_commands.rs`
- **Verification:** The six `observability_stage` tests prove actual seam wiring, stable order/correlation, redaction, and bounded admission; transcript evidence, UI acknowledgement, and bounded-transcription regression suites also pass.
- **Committed in:** `9b8b8a3`

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking issue)
**Impact on plan:** The adjacent changes were required to instrument the complete actual path promised by the plan; no new product surface or dependency was added.

## Issues Encountered

- Context7 was unavailable and the `ctx7` CLI was not installed. Version-specific `sysinfo` behavior was verified against the exact repository-locked `sysinfo 0.32.1` source already present in the local Cargo registry.
- An initial formatter invocation touched broad pre-existing formatting in large audio files. That churn was discarded before the GREEN commit and only the targeted semantic edits were reapplied.
- Rust verification continues to emit pre-existing warnings in unrelated build-script, audio, and summary code. No new compiler error or task-blocking warning was introduced.

## Known Stubs

None. Touched-diff scans found no TODOs, FIXMEs, skipped tests, placeholder behavior, or intentional RED implementation remaining. Explicit `Unknown` power evidence is the production fail-closed contract, not a stub.

## User Setup Required

None.

## Next Phase Readiness

- Later aggregation can persist stage and resource records without reconciling independent clocks or wall-clock durations.
- Plan 19 can choose and validate the authoritative reference-machine battery or energy-impact method against an explicit unknown-as-fail contract.
- Reserved Phase 4 stages are schema-compatible but cannot be emitted prematurely during Phase 1.

## Self-Check: PASSED

- All ten task-created or task-modified files and both RED-evidence records exist on disk.
- Task commits `b65ff52`, `9b8b8a3`, `968ef7d`, and `75dd521` resolve in git history.
- The persisted plan ledger measures four task commits before metadata finalization; both focused test commands and `cargo check` pass, and `git diff --check` is clean.

---
*Phase: 01-baseline-observability-identity-and-trust-boundaries*
*Completed: 2026-09-21*
