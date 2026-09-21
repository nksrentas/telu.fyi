---
phase: 01-baseline-observability-identity-and-trust-boundaries
plan: 17
subsystem: local-evaluation-bundles
tags: [rust, tauri, sqlite, jsonl, observability, atomic-write, redaction, tdd]

requires:
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-16
    provides: Durable typed evaluation records under one canonical run and meeting identity
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-15
    provides: Versioned stage and resource evidence contracts
provides:
  - Atomic versioned local evaluation bundles with nine required self-contained artifacts
  - Content-redacted manifest, environment, evidence JSONL, result JSON, and diagnostic summary schemas
  - Typed Tauri commands to finalize, list, and read validated local bundle summaries
  - Public contract validation for schema identity, order, conservation, interruption, and sensitive content
affects: [plan-01-18, plan-01-19, target-hardware-gate, diagnostics, local-evaluation]

actuals:
  tokens: 26003
  tasks: 2
  commits: 4
plan_head_before: 7be0dc4947354e014f5a919408de3469528013d4

tech-stack:
  added: []
  patterns:
    - Evaluation bundles publish only after per-file sync and whole-directory validation succeeds
    - Bundle paths derive exclusively from validated UUIDs beneath the Tauri app-data directory
    - Portable diagnostics use allowlisted typed records and stable redacted reason codes, never raw meeting content
    - Invalid, partial, or interrupted evidence remains explicit and cannot qualify for later aggregation

key-files:
  created:
    - frontend/src-tauri/src/observability/run_bundle.rs
    - frontend/src-tauri/tests/run_bundle_contract.rs
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-17-task1-red.json
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-17-task2-red.json
  modified:
    - frontend/src-tauri/src/observability/mod.rs
    - frontend/src-tauri/src/audio/recording_saver.rs
    - frontend/src-tauri/src/lib.rs

key-decisions:
  - "A run bundle is published as run-<validated UUID> only after all nine required files are atomically written into a unique temporary directory and the complete directory passes validation."
  - "Bundle commands expose only finalize, redacted list metadata, and validated summary reads; raw bundles stay in local app data and no upload surface is introduced."
  - "Threshold-free runs preserve unknown outcomes, outliers, limitations, missing optional evidence, and interrupted writes explicitly instead of inventing defaults or pass criteria."
  - "The validator treats malformed timestamps, reserved stages, non-monotonic records, queue conservation failures, unsafe identities, and sensitive keys or values as disqualifying evidence."

patterns-established:
  - "Validate-before-publish: build in a unique sibling temp directory, validate the full artifact set, then rename the directory into its stable run identity."
  - "Redacted inspection surface: list and summary commands return validated content-free metadata rather than filesystem paths or raw evidence payloads."
  - "Evidence qualification: required files, canonical identities, monotonic order, conservation laws, explicit unknown semantics, and content policy are checked together."

requirements-completed: [BASE-02, BASE-03, BASE-04]

coverage:
  - id: D1
    description: Each durable evaluation run can finalize into one versioned self-contained local bundle tied to its canonical run and meeting identity.
    requirement: BASE-02
    verification:
      - kind: unit
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml run_bundle_writer --lib -- --nocapture"
        status: pass
    human_judgment: false
  - id: D2
    description: Required files, stage ordering, queue conservation, evidence ordering, reserved stages, malformed timestamps, and interrupted writes are rejected before aggregation.
    requirement: BASE-03
    verification:
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml --test run_bundle_contract -- --nocapture"
        status: pass
    human_judgment: false
  - id: D3
    description: Bundle environment, route, resource, error, result, and summary evidence remains local and excludes transcript/audio content, credentials, payloads, and sensitive full paths by default.
    requirement: BASE-04
    verification:
      - kind: unit
        ref: "frontend/src-tauri/src/observability/run_bundle.rs#run_bundle_writer_rejects_sensitive_defaults_and_unsafe_identity"
        status: pass
      - kind: integration
        ref: "frontend/src-tauri/tests/run_bundle_contract.rs#interrupted_and_sensitive_bundles_are_invalid"
        status: pass
    human_judgment: false

duration: 30m
completed: 2026-09-21
status: complete
---

# Phase 01 Plan 17: Atomic Local Run Bundles Summary

**Telu now converts one durable evaluation run into a validated, atomic, versioned, content-redacted local bundle that preserves explicit unknowns and rejects unsafe or inconsistent evidence.**

## Performance

- **Duration:** 30m
- **Started:** 2026-09-21T10:18:35Z
- **Completed:** 2026-09-21T10:48:22Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added a `RunBundleWriter` that loads Plan 16's typed SQLite evidence under one canonical run/meeting identity and writes manifest, environment, stage, queue, resource, route/outbound, error, result, and summary artifacts beneath Tauri app data.
- Made publication recoverable: every file is synced through a sibling temp write, the complete unique temp directory is validated, and only then is it atomically renamed to the stable run directory; leftover temp directories are reported as interrupted.
- Registered typed finalize, list, and summary-read commands that expose redacted local metadata without filesystem paths, raw evidence payloads, or upload behavior.
- Added a public validator and contract suite covering required artifacts, schema identity, RFC 3339 timestamps, reserved stages, monotonic order, queue conservation, evidence/gap/terminal structure, explicit unknown semantics, and content redaction.

## Task Commits

Each TDD task was committed in RED/GREEN sequence:

1. **Task 1 RED: atomic run bundle contracts** - `be4b4df` (test)
2. **Task 1 GREEN: atomic local run bundle writer and commands** - `79fd73a` (feat)
3. **Task 2 RED: bundle schema/order/conservation/redaction contracts** - `84dd4f8` (test)
4. **Task 2 GREEN: strict bundle qualification validator** - `e606bb7` (feat)

## Files Created/Modified

- `frontend/src-tauri/src/observability/run_bundle.rs` - Serializes durable evaluation rows, publishes atomic bundles, exposes local commands, and validates the complete contract.
- `frontend/src-tauri/tests/run_bundle_contract.rs` - Exercises valid unknown/outlier preservation plus missing, malformed, ordered, conserved, interrupted, and sensitive bundle cases.
- `frontend/src-tauri/src/observability/mod.rs` - Registers the run-bundle observability module.
- `frontend/src-tauri/src/audio/recording_saver.rs` - Provides the shared sync-and-rename atomic file helper used by bundle and recording persistence.
- `frontend/src-tauri/src/lib.rs` - Registers finalize/list/read-summary Tauri commands.
- `01-17-task1-red.json` and `01-17-task2-red.json` - Preserve validated intentional RED evidence for both TDD tasks.

## Decisions Made

- Used the durable evaluation run UUID as the only bundle identity and required the manifest's meeting UUID across every meeting-attributed artifact.
- Kept the raw bundle under app data and kept the command surface deliberately narrow: finalize, redacted list, and validated summary read only.
- Represented unavailable measurements and undeclared thresholds as explicit `unknown` values with stable reasons; no threshold is inferred during serialization or validation.
- Treated partial temp directories as first-class interrupted evidence and malformed published directories as invalid rather than silently repairing or filling them.
- Rejected content-bearing keys and credential/path signatures recursively across every JSON artifact and the Markdown summary.

## TDD Gate Compliance

- **Task 1 RED:** Three writer contracts failed against the intentional unavailable writer; `01-17-task1-red.json` passed `RED_EVIDENCE_OK`.
- **Task 1 GREEN:** Four focused writer tests pass, including a migrated in-memory SQLite run serialized through the production loader.
- **Task 2 RED:** The contract test rejected the validator's acceptance of a non-RFC-3339 manifest timestamp; `01-17-task2-red.json` passed `RED_EVIDENCE_OK`.
- **Task 2 GREEN:** Four integration tests pass across valid unknowns, missing artifacts, reserved and misordered stages, queue conservation, evidence ordering, interrupted writes, and sensitive content.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Formatting the shared recording saver initially reformatted unrelated pre-existing code. The file was restored and only the intended atomic-write edits were reapplied before the Task 1 commit.
- The first Task 2 RED-evidence transcript lacked the TAP-style test counters required by the GSD checker. The evidence record was corrected to reflect the actual intentional failure and then passed `RED_EVIDENCE_OK` before production changes began.

## Known Stubs

None. Touched-file scans found no TODOs, FIXMEs, skipped tests, placeholder implementation, mock data path, or incomplete data source introduced by this plan.

## User Setup Required

None.

## Next Phase Readiness

- Plan 18 can inspect finalized local runs without reconstructing IDs, measurement configuration, or content policy.
- Plan 19 can use `validate_run_bundle_dir` as the qualification gate before target-hardware aggregation.
- No blocker remains; bundles preserve raw diagnostic evidence locally while making invalid or incomplete runs visibly ineligible.

## Self-Check: PASSED

- All seven task-created or task-modified files, both RED-evidence records, and this summary exist on disk.
- Task commits `be4b4df`, `79fd73a`, `84dd4f8`, and `e606bb7` resolve in git history.
- The persisted plan ledger measures four task commits before metadata finalization; both required four-test suites pass, `cargo check` passes, and `git diff --check` is clean.

---
*Phase: 01-baseline-observability-identity-and-trust-boundaries*
*Completed: 2026-09-21*
