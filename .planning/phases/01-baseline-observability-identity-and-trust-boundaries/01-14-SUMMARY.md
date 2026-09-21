---
phase: 01-baseline-observability-identity-and-trust-boundaries
plan: 14
subsystem: renderer-security-and-local-egress-canary
tags: [tauri, rust, filesystem, csp, privacy, outbound-attribution, tdd]

requires:
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-12
    provides: Bounded fail-closed outbound attempt ledger and route authorization
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-13
    provides: Run-scoped canary controls and retained outbound evidence
provides:
  - Least-privilege renderer filesystem authority limited to app data and dialog-selected files
  - Static regression guard for broad filesystem permissions, scopes, and CSP destinations
  - Deterministic local workflow canary with ledger-presence, completeness, and route-attribution enforcement
affects: [phase-01-evaluation, plan-01-19, packaging, renderer-security, network-canary]

actuals:
  tokens: 5113
  tasks: 2
  commits: 4
plan_head_before: 82f532ce809ae05627498b400f9975eff2c9b6ad

tech-stack:
  added: []
  patterns:
    - Static Tauri capability contracts reject broad grants and require exact app-data and selected-file authority
    - A zero-attempt canary result is valid only for a present, complete, same-run attribution ledger
    - Local attempts remain attributable while LAN and Remote attempts require an exact declared origin

key-files:
  created:
    - .github/verify-phase1-egress-capabilities.test.cjs
    - frontend/src-tauri/tests/network_blocked_local.rs
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-14-task1-red.json
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-14-task2-red.json
  modified:
    - frontend/src-tauri/tauri.conf.json
    - frontend/src-tauri/src/config.rs

key-decisions:
  - "Static renderer filesystem scope covers only $APPDATA; dialog-open and dialog-save selections provide runtime authority for explicitly selected import and export files."
  - "Zero outbound attempts pass only when the ledger exists, matches the canary run, is complete and non-overflowed, and every required local workflow stage completed."
  - "Attributed Local attempts are permitted; LAN and Remote attempts pass only when their sanitized origin exactly matches the canary declaration."
  - "The application-side canary proves dispatch seams and attribution, while Plan 19 remains responsible for independent physical packet observation."

patterns-established:
  - "Renderer capability regression checks parse Tauri configuration and compare exact reviewed permission and scope sets."
  - "Canary evaluation reports missing evidence, run mismatch, incomplete evidence, incomplete workflow, and the exact unpermitted attempt as distinct failures."

requirements-completed: [PRIV-03]

coverage:
  - id: D1
    description: Renderer filesystem authority excludes global read/write access while preserving app-data and dialog-selected file flows under an exact CSP allowlist.
    requirement: PRIV-03
    verification:
      - kind: source-contract
        ref: "node --test .github/verify-phase1-egress-capabilities.test.cjs"
        status: pass
    human_judgment: false
  - id: D2
    description: A deny-all external connector permits the local capture, persistence, recovery, and evaluation fixture only with present and complete same-run attribution evidence.
    requirement: PRIV-03
    verification:
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml --test network_blocked_local -- --nocapture"
        status: pass
    human_judgment: false
  - id: D3
    description: Simulated undeclared LAN or Remote dispatch is blocked, retained in the ledger, and rejected with exact attribution; physical packet observation remains a Plan 19 gate.
    requirement: PRIV-03
    verification:
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml --test network_blocked_local -- --nocapture"
        status: pass
    human_judgment: true
    rationale: Independent OS or proxy observation requires the blocking reference-machine decision reserved for Plan 19.

duration: 17m
completed: 2026-09-21
status: complete
---

# Phase 01 Plan 14: Renderer Least Privilege and Local Network-Block Canary Summary

**Telu now limits renderer file authority to app-owned or explicitly selected files and deterministically rejects local-only canary evidence that is absent, incomplete, or contains an undeclared outbound attempt.**

## Performance

- **Duration:** 17m
- **Started:** 2026-09-21T08:47:43Z
- **Completed:** 2026-09-21T09:05:14Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Removed global renderer read/write and download-directory grants, retained exact app-data scope, and added explicit open/save dialog permissions for user-selected file flows.
- Added a Node regression guard that rejects broad filesystem authority and CSP wildcards while requiring the reviewed local permission and connect-source sets.
- Added a production canary evaluator that treats an absent ledger, run mismatch, incomplete attribution, overflow, and missing workflow stages as explicit failures rather than zero egress.
- Exercised capture identity, SQLite persistence, recovery reconciliation, and evaluation under a deny-all injected connector with no external connector invocation.
- Proved a simulated undeclared Remote dispatch is denied before connector use, recorded with its route identity, and rejected by the canary unless the exact origin is declared.
- Kept the evidence claim bounded to application seams so independent OS or proxy packet observation remains the Plan 19 blocking gate.

## Task Commits

Each TDD task was committed in RED/GREEN sequence:

1. **Task 1 RED: renderer capability regression contracts** - `8efbe30` (test)
2. **Task 1 GREEN: least-privilege renderer authority** - `f57b4fc` (feat)
3. **Task 2 RED: local network-block canary contracts** - `4a2fa91` (test)
4. **Task 2 GREEN: application-side canary evaluator** - `41f3b82` (feat)

## Files Created/Modified

- `.github/verify-phase1-egress-capabilities.test.cjs` - Parses the Tauri configuration and enforces the exact reviewed renderer capability and CSP contract.
- `frontend/src-tauri/tauri.conf.json` - Restricts renderer filesystem scope to app data and explicit dialog-selected files.
- `frontend/src-tauri/src/config.rs` - Defines typed local-canary stages, configuration, failure reasons, and the fail-closed evaluator.
- `frontend/src-tauri/tests/network_blocked_local.rs` - Runs the local identity, persistence, recovery, and evaluation fixture and exercises blocked outbound attribution.
- `01-14-task1-red.json` and `01-14-task2-red.json` - Preserve validated intentional RED evidence for both TDD tasks.

## Decisions Made

- Kept static renderer filesystem scope at `$APPDATA` and `$APPDATA/**`; user-selected paths receive runtime authority through Tauri's open/save dialogs rather than permanent directory-wide grants.
- Compared security-sensitive permission, scope, and CSP sets exactly so a future permissive addition fails the guard instead of silently expanding authority.
- Required all four local workflow stages and a present, same-run, complete, non-overflowed ledger before zero attempts can mean no attempted egress.
- Allowed attributed Local route attempts while requiring every LAN or Remote origin to be declared exactly; the first undeclared attempt remains identifiable by sequence, route class, and sanitized origin.
- Preserved the explicit provider-route authorization path and its no-fallback policy: denial is recorded before dispatch and the injected connector is never invoked.

## TDD Gate Compliance

- **Task 1 RED:** The capability guard failed because the renderer still held global read/write permissions and lacked scoped selected-file write authority; `01-14-task1-red.json` validates the targeted failure as `RED_EVIDENCE_OK`.
- **Task 1 GREEN:** All three Node tests pass, covering broad-grant rejection, named local flows, and exact CSP destinations.
- **Task 2 RED:** Three integration assertions failed against the intentional unavailable evaluator after real database migration, persistence, and recovery setup had completed; `01-14-task2-red.json` validates the targeted failures as `RED_EVIDENCE_OK`.
- **Task 2 GREEN:** All three Rust integration tests pass, including zero-versus-missing evidence and retained blocked-attempt attribution. `cargo check` also passes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Context7 was not installed in the execution environment. Current official Tauri capability documentation and the repository-resolved plugin permission metadata were used to confirm dialog-selected runtime scopes and app-data permissions.
- Rust verification continues to emit pre-existing warnings in unrelated audio, build-script, and summary code. No new compiler errors or task-blocking warnings were introduced.

## Known Stubs

None. Touched-file scans found no TODOs, FIXMEs, skipped tests, placeholder behavior, or intentional RED stubs remaining in production code.

## User Setup Required

None.

## Next Phase Readiness

- Plan 19 can reconcile this application-side evidence with independent OS firewall or proxy observation without conflating attempted dispatch with physical packets.
- Renderer filesystem and connect-source authority now has a fast deterministic regression guard suitable for packaging and CI checks.
- Missing or incomplete attribution fails explicitly, so an empty or disabled ledger cannot be presented as proof of local-only behavior.

## Self-Check: PASSED

- The renderer guard, scoped Tauri configuration, production canary evaluator, Rust integration test, both RED-evidence records, and this summary exist on disk.
- Task commits `8efbe30`, `f57b4fc`, `4a2fa91`, and `41f3b82` resolve in git history.
- The persisted plan ledger measures four task commits before metadata finalization, all required verification commands pass, and `git diff --check` is clean.

---
*Phase: 01-baseline-observability-identity-and-trust-boundaries*
*Completed: 2026-09-21*
