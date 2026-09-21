---
status: resolved
trigger: "During the Phase 1 baseline review, the documented pnpm tauri:build command bundled telu-baseline as CFBundleExecutable, so the generated desktop app prints CLI help and exits instead of launching the Tauri GUI."
created: 2026-09-21T15:27:57Z
updated: 2026-09-21T15:45:59Z
---

## Current Focus

hypothesis: Resolved — the missing Cargo `default-run = "meetily"` left Tauri's main binary ambiguous after telu-baseline became a second package executable.
test: Human launched the fresh packaged app and independently inspected its process, app inventory, and accessible native window.
expecting: Confirmed — the meetily GUI process remains running and presents onboarding instead of baseline CLI help.
next_action: Archive this resolved session and commit only the focused Cargo declaration, regression test, and debug records.
bug_class: bohrbug
reasoning_checkpoint:
  hypothesis: "The absent Cargo package.default-run causes the wrong packaged executable because adding src/bin/telu-baseline.rs changed the package from one binary to two and Tauri uses default-run to mark the main bundle binary."
  confirming_evidence:
    - "Cargo metadata reports bin targets meetily and telu-baseline with default_run null."
    - "The generated meetily.app sets CFBundleExecutable to telu-baseline even though target/release/meetily exists."
    - "Tauri 2.11.1 source marks package.default-run as main and tells multi-bin packages to set it; mainBinaryName only renames the selected main."
    - "The agent-authored package contract fails only because default-run is undefined."
  falsification_test: "If adding only default-run = meetily still yields CFBundleExecutable telu-baseline or the contract remains red, this hypothesis is false or incomplete."
  fix_rationale: "Declaring the existing GUI target as Cargo's default run gives Cargo and Tauri one authoritative desktop entry while preserving telu-baseline as a separately addressable --bin CLI."
  blind_spots: "Fresh packaging can be checked on this macOS host; Windows/Linux installer entry points and successful updater signing are outside this narrow verification."
  candidate_causes:
    - "config: Cargo.toml does not declare package.default-run after the package gained a second bin target."
    - "code: src/bin/telu-baseline.rs is auto-discovered as a peer executable and Tauri builds/enumerates all bins."
    - "environment: Tauri CLI 2.11.1 multi-bin enumeration exposes the ambiguity but its documented selector is stable default-run."
    - "data: not applicable; bundle selection occurs before runtime input data."
  and_gate: "no — the single configuration defect is the missing main-target declaration for the package's current multi-bin shape; the auxiliary CLI is intended functionality, not an independent defect."
tdd_checkpoint: null

## Symptoms

expected: pnpm tauri:build creates a macOS meetily.app whose executable launches the Tauri desktop UI, while telu-baseline remains separately runnable for baseline validation.
actual: target/release/bundle/macos/meetily.app has CFBundleExecutable telu-baseline; direct execution prints baseline CLI help and exits, and GUI launch attempts time out.
errors: The package command later exits nonzero for missing optional TAURI_SIGNING_PRIVATE_KEY, but the app and DMG are created; updater signing is not the launch blocker.
reproduction: From commit afb264608983c4dc32daca99e5f65dc130148315 run the documented pnpm tauri:build, inspect the generated app Info.plist, then execute the bundled binary.
started: Introduced when Phase 1 Plan 01-19 added frontend/src-tauri/src/bin/telu-baseline.rs; first observed during the non-recording packaged-app preflight.

## Eliminated

- hypothesis: Missing updater signing or notarization prevents the desktop launch.
  evidence: The ad-hoc-signed app exists and validates; its configured executable is the baseline CLI, which prints help and exits.
  timestamp: 2026-09-21T15:27:57Z
- hypothesis: Tauri mainBinaryName or passing --bin meetily alone selects the GUI target.
  evidence: Both bounded diagnostic attempts still produced a bundle whose executable behaved as telu-baseline.
  timestamp: 2026-09-21T15:27:57Z

## Evidence

- timestamp: 2026-09-21T15:27:57Z
  checked: Generated target/release/bundle/macos/meetily.app Info.plist and executable behavior.
  found: CFBundleExecutable is telu-baseline; direct execution prints baseline CLI usage and exits.
  implication: The build compiled successfully but selected the wrong Cargo binary as the application entry point.
- timestamp: 2026-09-21T15:27:57Z
  checked: Local bundle signature and GUI launch attempts.
  found: Ad-hoc signature is valid; two bounded launches did not leave com.meetily.ai running.
  implication: This is target selection/packaging, not signing or UI automation.
- timestamp: 2026-09-21T15:32:22Z
  checked: Phase 0 semantic/keyword knowledge-base recall.
  found: MemPalace was not configured for this agent and .planning/debug/knowledge-base.md does not exist, so no known-pattern candidate was available.
  implication: Investigate the current Cargo/Tauri target graph directly.
- timestamp: 2026-09-21T15:32:22Z
  checked: Phase 1.25 spectrum-based fault localization eligibility.
  found: No failing/passing per-test coverage spectrum exists for the generated-bundle executable-selection failure.
  implication: SBFL is skipped; deterministic metadata and packaged-output differential checks are the appropriate Bohrbug route.
- timestamp: 2026-09-21T15:32:57Z
  checked: Cargo metadata for frontend/src-tauri/Cargo.toml.
  found: The meetily package has two `bin` targets (`meetily` from src/main.rs and `telu-baseline` from src/bin/telu-baseline.rs), while `default_run` is null; both targets are release-build candidates.
  implication: Adding the auxiliary CLI created a deterministic target-selection ambiguity at the package boundary.
- timestamp: 2026-09-21T15:32:57Z
  checked: Git history for the auxiliary binary.
  found: Commit afb2646 introduced telu-baseline at the exact point the packaged-app regression began; the pre-existing GUI remains src/main.rs.
  implication: The introducing change is localized to the additional auto-discovered Cargo binary, not the GUI entry implementation.
- timestamp: 2026-09-21T15:34:36Z
  checked: Existing root target release bundle and binaries.
  found: target/release contains both meetily (GUI-sized) and telu-baseline, while meetily.app contains only Contents/MacOS/telu-baseline and Info.plist sets CFBundleExecutable to telu-baseline.
  implication: Compilation produced the correct GUI target, but bundle target identity selected the auxiliary CLI.
- timestamp: 2026-09-21T15:34:36Z
  checked: Official Tauri 2 documentation and tauri-cli v2.11.1 source.
  found: The official Cargo.toml example declares `default-run`; Tauri v2.11.1 get_binaries marks a binary main when its name matches the package name or `package.default-run`, and app_binary_path explicitly errors when no main binary exists with guidance to set `package > default-run`.
  implication: Cargo `default-run` is the intended target identity contract for a Tauri package once it has multiple binary targets; `mainBinaryName` renames an already-selected main binary and does not choose one.
- timestamp: 2026-09-21T15:36:09Z
  checked: Agent-authored regression contract `.github/verify-tauri-binary-selection.test.cjs` before the fix.
  found: The test detects exactly two auto-discovered binaries and fails because Cargo package.default-run is undefined instead of meetily.
  implication: The packaging identity regression is reproducible without a full release bundle and has a specified, root-cause-level oracle.
- timestamp: 2026-09-21T15:37:11Z
  checked: Focused regression contract and Cargo metadata after the one-line fix.
  found: The contract passes; Cargo reports default_run `meetily` and retains both bin targets `meetily` and `telu-baseline`.
  implication: The main target is now explicit without removing or renaming the baseline CLI.
- timestamp: 2026-09-21T15:39:49Z
  checked: Fresh app-only Tauri 2.11.1 release bundle with updater artifacts disabled and signing skipped.
  found: Build exited 0; Info.plist now sets CFBundleExecutable to meetily, Contents/MacOS/meetily is byte-identical to target/release/meetily, and telu-baseline remains a distinct auxiliary executable whose help command exits 0.
  implication: The exact packaged executable selection regression is fixed while preserving the baseline CLI.
- timestamp: 2026-09-21T15:41:03Z
  checked: Adjacent baseline matrix suite and fixture validation.
  found: All 7 baseline_matrix tests pass; `cargo run --bin telu-baseline -- validate` exits 0 with all 10 ordered scenarios and explicit unknown reference fields.
  implication: Pinning the GUI default target does not regress the separately invoked baseline CLI or its matrix behavior.
- timestamp: 2026-09-21T15:43:06Z
  checked: Revert-and-reconfirm and fix-acceptance guardrail.
  found: Removing only `default-run = "meetily"` makes the focused contract fail with actual undefined; reapplying it makes the same contract pass. The fix diff is additive, no Stryker mutation runner is configured, and adjacent checks remain green.
  implication: The focused Cargo declaration is causally necessary for the regression guard and the fix is minimal rather than behavior-deleting.
- timestamp: 2026-09-21T15:45:59Z
  checked: Human verification of the freshly bundled macOS application.
  found: Native launch left PID 55031 running Contents/MacOS/meetily; app inventory reported meetily/com.meetily.ai running, and accessibility exposed a native meetily window with Welcome to Meetily onboarding and Get Started, with no baseline CLI help and no recording started.
  implication: The original end-to-end packaged-launch symptom is resolved in the real desktop workflow.

## Resolution

root_cause: frontend/src-tauri/Cargo.toml gained a second auto-discovered binary but did not declare `package.default-run = "meetily"`, so Tauri had no authoritative GUI main-target identity and packaged telu-baseline.
fix: Added `default-run = "meetily"` to the Cargo package and an agent-authored regression contract that requires the multi-bin Tauri package to pin its GUI target.
verification:
  target_test: { result: pass }
  mutation_check: { result: skipped, reason_if_skipped: "No Stryker or Rust mutation runner is configured; the targeted default-run deletion was nevertheless killed by the regression during revert-and-reconfirm.", mutant_killed: true }
  no_op_deletion: { result: pass, deletion_justified_by_rca: false }
  adjacent_tests: { result: pass, suites_run: ["node --test .github/verify-tauri-binary-selection.test.cjs", "cargo test --test baseline_matrix", "cargo run --bin telu-baseline -- validate manifest-v1.json", "app-only Tauri release bundle"] }
  revert_and_reconfirm: { result: pass, bug_returned_on_revert: true, fixed_on_reapply: true }
  packaged_app: { result: pass, cf_bundle_executable: meetily, bundled_gui_matches_release_binary: true, auxiliary_cli_preserved: true }
  human_verify: { result: pass, gui_process_running: true, native_window_visible: true, baseline_cli_help_absent: true, recording_started: false }
  guardrail_verdict: accepted
oracle_type: specified — the packaged desktop contract requires the meetily GUI, and Tauri 2 documents Cargo default-run as the main binary selector for a multi-binary package
files_changed: [frontend/src-tauri/Cargo.toml, .github/verify-tauri-binary-selection.test.cjs]

## Prevention

causal_branches:
  config: Cargo.toml did not gain an explicit default-run when the package changed from one binary to multiple binaries, so the main executable identity remained implicit.
  code: The intended auxiliary CLI lived under src/bin and was therefore automatically discovered and built as a peer package executable by Cargo/Tauri.
  environment: Tauri 2.11.1 correctly exposes the ambiguity through its multi-bin enumeration; signing and updater configuration were unrelated to executable identity.
  data: Runtime meeting or baseline inputs were not involved because the wrong executable was selected during packaging.
why_not_caught: No existing gate asserted the packaged main executable identity after adding an auxiliary Cargo binary; compilation and CLI tests passed while CFBundleExecutable was wrong.
recurrence_guard: The passing regression test `.github/verify-tauri-binary-selection.test.cjs` requires any multi-binary Tauri package containing meetily and telu-baseline to pin `package.default-run` to the meetily GUI.
