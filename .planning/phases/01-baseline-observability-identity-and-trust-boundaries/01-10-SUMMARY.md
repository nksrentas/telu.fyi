---
phase: 01-baseline-observability-identity-and-trust-boundaries
plan: 10
subsystem: provider-route-trust-boundaries
tags: [rust, tauri, privacy, dns, routing, transcription, summaries, tdd]

requires:
  - phase: 01-baseline-observability-identity-and-trust-boundaries/01-09
    provides: Authoritative recovery and completeness surfaces on the measured desktop foundation
provides:
  - Rust-owned EffectiveRoute records for capability, provider, model, Local/LAN/Remote boundary, sanitized origin, encryption, validation, and resolved addresses
  - Fail-closed route validation for missing, invalid, unresolved, or materially changed destinations
  - Pre-dispatch enforcement for transcription and summary providers without silent provider or model substitution
  - Tauri commands for reading and validating the current configured route
affects: [privacy-settings, diagnostics, transcription, summaries, provider-dispatch, phase-01-evaluation]

actuals:
  tokens: 12092
  tasks: 2
  commits: 4
plan_head_before: a73dbb08eb71e3dba37edd227d685196d45c8e50

tech-stack:
  added: []
  patterns:
    - Effective destinations, not provider brands, determine Local, LAN, or Remote classification
    - Provider dispatch compares a validated route snapshot with a fresh resolution immediately before request I/O
    - Missing configuration and unavailable models return stable typed errors without provider substitution

key-files:
  created:
    - frontend/src-tauri/src/trust/mod.rs
    - frontend/src-tauri/src/trust/provider_route.rs
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-10-task1-red.json
    - .planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-10-task2-red.json
  modified:
    - frontend/src-tauri/src/audio/transcription/engine.rs
    - frontend/src-tauri/src/summary/llm_client.rs
    - frontend/src-tauri/src/summary/service.rs
    - frontend/src-tauri/src/api/api.rs
    - frontend/src-tauri/src/lib.rs

key-decisions:
  - "Route classification follows the resolved effective destination: device and loopback are Local, private or link-local addresses are LAN, and public addresses are Remote."
  - "A route is unavailable when its destination is missing, invalid, unresolved, or resolves across conflicting boundary classes; no case defaults to Local."
  - "Provider/model identity, sanitized origin, encryption state, boundary class, and resolved addresses are material contract fields; any change blocks dispatch with a typed error."
  - "Transcription and summary configuration failures preserve the selected provider and local data instead of substituting Parakeet, Whisper, a different model, or a localhost endpoint."

patterns-established:
  - "Resolve, snapshot, re-resolve, compare: external provider I/O occurs only after the current effective route matches its validated snapshot."
  - "Sanitized route DTOs expose origins only: credentials, path, query, and fragment never enter the route record or typed error."
  - "Capability is part of route identity, so a shared endpoint produces distinct transcription and summary records."

requirements-completed: [PRIV-01, PRIV-02]

coverage:
  - id: D1
    description: Effective routes classify device, loopback, private, link-local, and public destinations by actual resolution while retaining capability, provider, and model identity.
    requirement: PRIV-01
    verification:
      - kind: unit
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml provider_route_resolution --lib -- --nocapture"
        status: pass
    human_judgment: false
  - id: D2
    description: Credentials, paths, queries, and fragments are removed from route DTOs and errors, and missing or invalid destinations are unavailable rather than Local.
    requirement: PRIV-01
    verification:
      - kind: unit
        ref: "trust::provider_route::tests::provider_route_resolution_redacts_credentials_query_fragment_and_sensitive_path"
        status: pass
      - kind: unit
        ref: "trust::provider_route::tests::provider_route_resolution_rejects_missing_invalid_and_materially_changed_routes"
        status: pass
    human_judgment: false
  - id: D3
    description: Transcription and summary dispatch fail closed when configuration is absent or the effective route changes, with no request or provider/model fallback.
    requirement: PRIV-02
    verification:
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml provider_route --lib -- --nocapture"
        status: pass
      - kind: integration
        ref: "cargo test --manifest-path frontend/src-tauri/Cargo.toml summary::llm_client::tests --lib -- --nocapture"
        status: pass
      - kind: other
        ref: "cargo check --manifest-path frontend/src-tauri/Cargo.toml"
        status: pass
    human_judgment: false

duration: 26m
completed: 2026-09-21
status: complete
---

# Phase 01 Plan 10: Effective Provider Route Contract Summary

**Rust now classifies provider work by its effective Local, LAN, or Remote destination and blocks transcription or summary dispatch when that sanitized route is unavailable or materially changes.**

## Performance

- **Duration:** 26m
- **Started:** 2026-09-21T06:52:24Z
- **Completed:** 2026-09-21T07:18:41Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added the `EffectiveRoute` privacy contract with capability, provider/model detail, sanitized origin, encryption state, resolved addresses, and Local/LAN/Remote classification derived from the effective destination.
- Added fail-closed validation for missing, malformed, unresolved, mixed-class, or materially changed destinations, with typed errors that expose no sensitive URL components.
- Bound summary HTTP and built-in dispatch to a validated route snapshot and a fresh pre-request resolution before request I/O.
- Removed silent transcription configuration, provider, and model fallbacks as well as the implicit Ollama localhost fallback.
- Registered Tauri commands that return the current configured route and validate a previously shown route against current configuration and resolution.

## Task Commits

Each TDD task was committed in RED/GREEN sequence:

1. **Task 1 RED: effective route resolution contracts** - `2502c9d` (test)
2. **Task 1 GREEN: resolve and sanitize effective routes** - `9036e05` (feat)
3. **Task 2 RED: provider dispatch enforcement contracts** - `9452a47` (test)
4. **Task 2 GREEN: enforce routes before dispatch** - `b99dbb0` (feat)

## Files Created/Modified

- `frontend/src-tauri/src/trust/provider_route.rs` - Owns route DTOs, destination resolution, classification, sanitization, material-change validation, configured-route lookup, dispatch authorization, and Tauri commands.
- `frontend/src-tauri/src/trust/mod.rs` - Exposes the Rust trust module.
- `frontend/src-tauri/src/audio/transcription/engine.rs` - Requires explicit local transcription configuration and model identity, validates the route, and removes provider/model substitution.
- `frontend/src-tauri/src/summary/llm_client.rs` - Resolves, snapshots, re-resolves, and authorizes the effective route before built-in or HTTP provider dispatch.
- `frontend/src-tauri/src/summary/service.rs` - Validates summary routes before Ollama metadata I/O and removes config-read and raw-endpoint fallbacks/logging.
- `frontend/src-tauri/src/api/api.rs` - Returns absent transcription configuration as absent instead of synthesizing Parakeet.
- `frontend/src-tauri/src/lib.rs` - Registers current-route and route-validation commands.
- `.planning/phases/01-baseline-observability-identity-and-trust-boundaries/01-10-task1-red.json` and `01-10-task2-red.json` - Preserve verified intentional RED evidence for both TDD tasks.

## Decisions Made

- Provider brand is descriptive detail only; the resolved destination determines the trust boundary.
- DNS/address changes, provider/model changes, origin changes, transport encryption changes, and boundary changes are material and require explicit reconfiguration.
- Device-local execution uses a concrete `This device` destination record, while absent URL configuration remains unavailable.
- Dispatch errors use stable route codes and sanitized origin metadata; raw endpoints and secrets are not included.

## TDD Gate Compliance

- **Task 1 RED:** Four route-resolution tests failed against the intentional resolver stub; `01-10-task1-red.json` passed `tdd-red-evidence` with intentional RED evidence.
- **Task 1 GREEN:** All four resolution tests pass, covering device, loopback, private/public IPs, IPv6, redaction, invalid destinations, material change, and per-capability identity.
- **Task 2 RED:** Five dispatch/config/registration checks failed before enforcement; `01-10-task2-red.json` passed `tdd-red-evidence` with intentional RED evidence.
- **Task 2 GREEN:** All nine `provider_route` tests pass, summary-client regression tests pass, and `cargo check` succeeds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Integration] Removed the API-level synthetic transcription default**
- **Found during:** Task 2 (Enforce the route contract at provider dispatch)
- **Issue:** The transcription API converted an absent database row into a Parakeet configuration before the engine could enforce the selected-route contract.
- **Fix:** Return `None` for absent configuration so the engine emits `TRANSCRIPTION_ROUTE_CONFIG_UNAVAILABLE` without changing provider or model.
- **Files modified:** `frontend/src-tauri/src/api/api.rs`
- **Verification:** Both transcription no-fallback tests and the full focused route suite pass.
- **Committed in:** `b99dbb0`

**2. [Rule 2 - Missing Critical] Enforced routes before summary metadata network I/O**
- **Found during:** Task 2 (Enforce the route contract at provider dispatch)
- **Issue:** Ollama model metadata could perform HTTP work in `SummaryService` before the planned `llm_client` dispatch gate, and a settings read error silently flowed into a default endpoint path.
- **Fix:** Resolve and require the summary route before metadata lookup, fail closed on endpoint config read failure, and stop logging the raw custom endpoint.
- **Files modified:** `frontend/src-tauri/src/summary/service.rs`
- **Verification:** Focused route tests, all summary-client tests, and `cargo check` pass.
- **Committed in:** `b99dbb0`

---

**Total deviations:** 2 auto-fixed (1 blocking integration, 1 missing critical trust-boundary enforcement)
**Impact on plan:** Both changes were necessary to make the planned no-fallback and pre-dispatch guarantees true across the existing call path; no dependency, endpoint, database schema, or architecture was added.

## Issues Encountered

- A scoped `rustfmt` invocation recursively formatted imported Rust modules. All unrelated formatter-only changes were restored, then the six intended Task 2 files were reconstructed as narrow semantic diffs before verification and commit.
- Summary-client tests that bind localhost were initially denied by the filesystem/network sandbox. The identical test command passed outside that sandbox; this was an execution-environment restriction, not a product failure.
- Existing build warnings remain in untouched code. No broad warning or formatting cleanup was attempted.

## Known Stubs

None. Touched-file and added-line scans found no TODOs, FIXMEs, placeholders, skipped tests, or empty/mock values that prevent the route-contract goal.

## User Setup Required

None.

## Next Phase Readiness

- Privacy settings, diagnostics, and evaluation work can consume one Rust-owned route DTO rather than inferring locality from provider names.
- Provider execution now fails closed on unavailable or changed destinations and preserves explicit user configuration.
- No implementation blocker remains for Plan 01-11.

## Self-Check: PASSED

- The route module, both RED-evidence records, and summary exist on disk.
- All four RED/GREEN task commits resolve in git history.
- The persisted plan ledger measures four task commits before metadata finalization, and `git diff --check` passes.

---
*Phase: 01-baseline-observability-identity-and-trust-boundaries*
*Completed: 2026-09-21*
