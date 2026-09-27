---
quick_id: 260927-csg
phase: quick-260927-csg-packaged-macos-icon-uat
plan: 01
title: Build and visually verify the packaged Telu macOS icons
type: execute
wave: 1
depends_on: []
files_modified:
  - target/
  - frontend/.next/
  - frontend/out/
  - frontend/src-tauri/tauri.conf.json
  - frontend/src-tauri/src/tray.rs
  - frontend/src-tauri/icons/icon.png
  - frontend/src-tauri/icons/app_icon.icns
  - frontend/src-tauri/icons/app_icon.ico
  - frontend/src-tauri/icons/TeluMenuBarTemplate@2x.png
  - .github/verify-telu-icons.test.cjs
autonomous: true
requirements:
  - QUICK-260927-CSG
estimate:
  tokens: 18000
  raw_tokens: 18000
  tasks: 2
  confidence: low
must_haves:
  truths:
    - "A fresh app-only macOS package is built after removing only the three approved disposable output paths, with no stale frontend or Rust output reused."
    - "The exact packaged Telu.app bundle passes metadata, executable architecture, resource, icon, and code-signature checks before it is launched."
    - "The Telu mark is visibly correct on the exact packaged bundle in Finder and on the launched packaged process in the Dock."
    - "The packaged app's menu-bar template is crisp and recognizable in both fixed Light and fixed Dark appearances, with system tinting rather than a colored or boxed bitmap."
    - "The initial macOS appearance is restored exactly, the packaged app instance is closed, and every unrelated working-tree change is preserved."
  artifacts:
    - path: "target/release/bundle/macos/Telu.app"
      provides: "Fresh arm64 macOS application bundle produced by Tauri 2.11.1 with the app-only bundle option"
    - path: "target/release/bundle/macos/Telu.app/Contents/Info.plist"
      provides: "Inspectable package identity, version, executable, and icon-resource metadata"
    - path: ".github/verify-telu-icons.test.cjs"
      provides: "Existing source-to-package icon identity and tray-wiring regression contract"
    - path: ".planning/quick/260927-csg-build-a-fresh-packaged-macos-app-and-vis/260927-csg-SUMMARY.md"
      provides: "Exact bundle path, build/package checks, visual UAT results, initial/restored appearance, and cleanup evidence"
  key_links:
    - from: "frontend/src-tauri/tauri.conf.json"
      to: "target/release/bundle/macos/Telu.app/Contents/Resources"
      via: "Tauri app-only bundling copies the configured ICNS and resources into the packaged application"
      pattern: 'icons/app_icon\.icns'
    - from: "frontend/src-tauri/src/tray.rs"
      to: "target/release/bundle/macos/Telu.app/Contents/MacOS/Telu"
      via: "The macOS-only include_image template is compiled into the packaged executable and rendered with icon_as_template(true)"
      pattern: 'TeluMenuBarTemplate@2x\.png'
    - from: "target/release/bundle/macos/Telu.app"
      to: "Finder, Dock, and menu bar"
      via: "Reveal and launch the exact absolute bundle path, then visually inspect the resulting native surfaces"
      pattern: 'Telu\.app'
---

<objective>
Produce a clean packaged Telu macOS application and close the remaining icon UAT gap against the actual bundle rather than a development build.

Purpose: QUICK-260927-CSG proves that the supplied Telu artwork survives release packaging and renders correctly in Finder, Dock, and the macOS menu bar under both system appearances without disturbing unrelated source work or leaving the machine in a changed state.
Output: A verified `target/release/bundle/macos/Telu.app` plus a concise execution summary recording package evidence, visual verdicts, the exact initial/restored appearance, and final cleanup.
</objective>

<execution_context>
@/Users/nrentas/.codex/gsd-core/workflows/execute-plan.md
@/Users/nrentas/.codex/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@.planning/STATE.md
@.planning/quick/260926-w68-use-the-supplied-telu-macos-icon-kit-for/260926-w68-PLAN.md
@.planning/quick/260926-w68-use-the-supplied-telu-macos-icon-kit-for/260926-w68-SUMMARY.md
@frontend/package.json
@frontend/src-tauri/tauri.conf.json
@frontend/src-tauri/Cargo.toml
@frontend/src-tauri/src/tray.rs
@frontend/src-tauri/build.rs
@frontend/src-tauri/build/ffmpeg.rs
@.github/verify-telu-icons.test.cjs

Live planning observations on 2026-09-27:
- Host: macOS 26.6.2 on arm64.
- Locked local CLI: `tauri-cli 2.11.1`; its local help explicitly supports `tauri build --bundles app`.
- Package identity: `productName=Telu`, `version=0.4.1`, `identifier=com.meetily.ai`, frontend output `frontend/out`, and app/DMG are the configured macOS targets.
- The approved cleanup paths resolve to `/Users/nrentas/dev/telu-fyi/target` (present, 7.1G), `/Users/nrentas/dev/telu-fyi/frontend/.next` (absent), and `/Users/nrentas/dev/telu-fyi/frontend/out` (absent). `frontend/src-tauri/build` and `frontend/node_modules` are present protected paths.
- No previous `.app` exists anywhere under the current root `target/` tree.
- The arm64 FFmpeg and llama-helper sidecars already exist in `frontend/src-tauri/binaries/`; no dependency or sidecar installation is authorized.
- All four Telu icon assets match the hashes pinned by the prior plan, their seven source/wiring paths are clean, and `node --test .github/verify-telu-icons.test.cjs` passes 3/3.
- The worktree has unrelated tracked and untracked changes, including `frontend/src-tauri/build/ffmpeg.rs` and `frontend/src-tauri/src/audio/recording_commands.rs`; these are user-owned and must remain byte-for-byte untouched by this quick task.
</context>

<planner_contribution_applicability>
- API coverage: the deterministic detector returned `detected: false` for this quick task's exact goal text. It builds and inspects a local desktop artifact and does not integrate an external API, SDK, endpoint, webhook, or service, so no `COVERAGE.md` is applicable.
- Assumption delta: the phase-section detector returned `skipped: true, reason: phase_unresolved`, which is expected because GSD quick tasks do not have ROADMAP phase sections. No false negative is inferred and no identity-model checkpoint is introduced; this contribution is structurally inapplicable to the quick-task scope.
- Schema push: the exact generated paths and conditional repair scope contain no Payload, Prisma, Drizzle, Supabase, or TypeORM schema paths, so no schema push task applies.
- Security: enforcement is active at ASVS level 1 with a high blocking threshold; the threat model below treats exact-path cleanup, local bundle execution, transient UI observation, and appearance restoration as the relevant trust boundaries.
</planner_contribution_applicability>

<tasks>

<task type="tracer">
  <name>Task 1: Clean approved outputs and build one verified macOS app bundle</name>
  <precondition>The host is macOS arm64; the repository-local Tauri CLI reports version 2.11.1 and supports `--bundles app`; both configured arm64 sidecars exist; the seven icon source/wiring paths remain clean; and no active build process is using this repository's `target/` tree.</precondition>
  <files>/Users/nrentas/dev/telu-fyi/target, /Users/nrentas/dev/telu-fyi/frontend/.next, /Users/nrentas/dev/telu-fyi/frontend/out, /Users/nrentas/dev/telu-fyi/target/release/bundle/macos/Telu.app; conditional icon-only repair scope: frontend/src-tauri/tauri.conf.json, frontend/src-tauri/src/tray.rs, frontend/src-tauri/icons/icon.png, frontend/src-tauri/icons/app_icon.icns, frontend/src-tauri/icons/app_icon.ico, frontend/src-tauri/icons/TeluMenuBarTemplate@2x.png, .github/verify-telu-icons.test.cjs</files>
  <read_first>
    - AGENTS.md
    - .planning/quick/260926-w68-use-the-supplied-telu-macos-icon-kit-for/260926-w68-SUMMARY.md
    - frontend/package.json
    - frontend/src-tauri/tauri.conf.json
    - frontend/src-tauri/src/tray.rs
    - frontend/src-tauri/build.rs
    - frontend/src-tauri/build/ffmpeg.rs
    - .github/verify-telu-icons.test.cjs
  </read_first>
  <action>
Record the current commit, complete `git status --short --untracked-files=all`, the hashes of every currently dirty tracked file and relevant untracked file, the four installed icon hashes, and the local CLI version before changing generated output. This baseline is the preservation contract: do not stash, reset, checkout, clean, format, stage, or commit user-owned changes. In particular, never remove or alter `frontend/src-tauri/build/` or `frontend/node_modules/`.

Re-inspect each approved disposable path immediately before deletion. For every existing target, require an absolute literal path, require that it is a directory and not a symlink, and require `realpath` to equal exactly `/Users/nrentas/dev/telu-fyi/target`, `/Users/nrentas/dev/telu-fyi/frontend/.next`, or `/Users/nrentas/dev/telu-fyi/frontend/out`. If any check fails or another active build is using the root `target/`, stop without deleting anything. After those guards pass, remove only those three exact paths with explicit absolute operands, then prove all three are absent. Do not use `git clean`, a glob, a parent directory, a variable with an unverified value, or any cleanup that can reach `frontend/src-tauri/build/` or `frontend/node_modules/`.

Run `node --test .github/verify-telu-icons.test.cjs`, then run the repository-local locked CLI as `pnpm --dir /Users/nrentas/dev/telu-fyi/frontend exec tauri build --bundles app --ci`. This is the narrow supported app-only bundle path confirmed by the live CLI help; do not run the wrapper that drops extra bundle arguments, do not add another bundle target, and do not install or update dependencies. Capture the build log and the path emitted by Tauri. Require exactly one fresh app at `/Users/nrentas/dev/telu-fyi/target/release/bundle/macos/Telu.app`, record its modification time, and use that absolute path for every later check and launch.

Before launching anything, validate the bundle with `plutil -lint`, `codesign --verify --deep --strict --verbose=2`, `file`, and `lipo -archs`. Inspect `Info.plist` and require the Telu product name, `com.meetily.ai` identifier, `0.4.1` short version, an executable that exists inside `Contents/MacOS`, and a `CFBundleIconFile` that resolves to a real ICNS in `Contents/Resources`. Hash the packaged ICNS and require it to equal `frontend/src-tauri/icons/app_icon.icns`; inspect it with `sips` or `iconutil` to prove it decodes. Verify the configured `templates/*.json`, `ffmpeg`, and `llama-helper` resources/sidecars exist in the bundle at the paths Tauri produced. Record the exact resource and executable paths in the summary.

If the first build fails, classify it from the captured log before any edit. A failure is icon-integration-caused only when the diagnostic names the configured icon/template asset, its decode/signature/dimensions, `include_image!`, `icon_as_template`, or the relevant `tray.rs` macOS branch. For that class only, make the smallest causal correction within the conditional icon-only repair scope above, extend or adjust the focused icon test if its contract was incomplete, rerun the focused test, repeat the exact three-path cleanup, and rerun the same app-only build once. If the failure is in an unrelated dirty source file, build script, dependency, sidecar, toolchain, signing environment, frontend code, or remains unresolved after that one icon-specific correction, stop with the log and do not modify unrelated source. Any icon-specific source correction must be isolated from all pre-existing changes and committed separately; generated and ignored build output must never be staged or committed.
  </action>
  <verify>
    <automated>node --test .github/verify-telu-icons.test.cjs &amp;&amp; test -d /Users/nrentas/dev/telu-fyi/target/release/bundle/macos/Telu.app &amp;&amp; plutil -lint /Users/nrentas/dev/telu-fyi/target/release/bundle/macos/Telu.app/Contents/Info.plist &amp;&amp; test "$(plutil -extract CFBundleIdentifier raw /Users/nrentas/dev/telu-fyi/target/release/bundle/macos/Telu.app/Contents/Info.plist)" = com.meetily.ai &amp;&amp; test "$(plutil -extract CFBundleShortVersionString raw /Users/nrentas/dev/telu-fyi/target/release/bundle/macos/Telu.app/Contents/Info.plist)" = 0.4.1 &amp;&amp; codesign --verify --deep --strict --verbose=2 /Users/nrentas/dev/telu-fyi/target/release/bundle/macos/Telu.app</automated>
  </verify>
  <done>A fresh app-only `Telu.app` exists at the exact recorded path; its identity, version, executable architecture, icon, resources, sidecars, and signature validate before launch; the approved stale outputs were the only deleted paths; and unrelated working-tree content is unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Inspect the packaged icon surfaces in Finder, Dock, Light, and Dark</name>
  <precondition>Task 1 produced and validated `/Users/nrentas/dev/telu-fyi/target/release/bundle/macos/Telu.app`, and the executor has a functioning macOS visual-control/screenshot surface; if visual access is unavailable, return a blocking human-verification checkpoint rather than claiming a visual verdict.</precondition>
  <files>/Users/nrentas/dev/telu-fyi/target/release/bundle/macos/Telu.app, macOS Appearance preference (temporary and restored), transient visual observations only</files>
  <read_first>
    - .planning/quick/260926-w68-use-the-supplied-telu-macos-icon-kit-for/260926-w68-SUMMARY.md
    - frontend/src-tauri/tauri.conf.json
    - frontend/src-tauri/src/tray.rs
    - .github/verify-telu-icons.test.cjs
  </read_first>
  <action>
Before launching, record the exact initial macOS Appearance selection as Light, Dark, or Auto, including both `AppleInterfaceStyle` and `AppleInterfaceStyleSwitchesAutomatically`, and record the baseline set of running processes with bundle identifier `com.meetily.ai`. Treat Auto as a distinct setting: restoring only the currently effective light/dark boolean is not sufficient. Establish a guaranteed cleanup path that always restores the exact initial Appearance selection and closes only the packaged Telu process created by this task, including when an inspection fails or the app shows a permission dialog.

Reveal the exact absolute bundle with Finder and visually inspect the `Telu.app` item itself at a useful icon size. The icon must be the recognizable supplied Telu mark, not a generic application placeholder, the prior Meetily artwork, a blank tile, or a clipped/boxed rendering. Launch that exact bundle with a new instance, identify the newly added process, and verify its executable path is inside `/Users/nrentas/dev/telu-fyi/target/release/bundle/macos/Telu.app/Contents/MacOS/`; do not rely on an installed copy, a development process, Spotlight, or the app name alone. Inspect the icon created by that process in the Dock against the same criteria. If another `com.meetily.ai` process was already running, leave it untouched and use the new PID/path to distinguish the packaged instance.

Use macOS visual control to select fixed Light appearance, wait for the menu bar to repaint, and inspect the packaged app's actual menu-bar item. Click it once if needed to associate the glyph with Telu's tray menu. Record whether the template is crisp, properly sized, recognizable, unboxed, and tinted for the light menu bar. Then select fixed Dark appearance, wait for repaint, and repeat the same inspection; the glyph must retint automatically rather than remaining a fixed dark bitmap, disappearing, or showing a colored square. Inspect Finder and Dock while the package is running as corroborating evidence. Keep visual captures transient, frame them tightly enough to avoid unrelated desktop content, and never commit screenshots or other generated evidence.

In a finally-style cleanup, quit only the newly launched packaged instance, prove the baseline process set is restored, restore the exact initial Light/Dark/Auto selection through the Appearance control, and verify both appearance preference values match the recorded baseline. Do not restart Finder or Dock, clear icon caches, change any other System Setting, or leave System Settings focused. Compare the final working-tree baseline with the initial record: apart from an explicitly justified icon-specific repair and later GSD summary/state bookkeeping, all pre-existing tracked and untracked content must remain unchanged. Record the exact app path, initial appearance, restored appearance, Finder verdict, Dock verdict, Light menu-bar verdict, Dark menu-bar verdict, package-process closure, and working-tree preservation in the summary. Any mismatch is a failed UAT result, not a reason to alter system caches or unrelated source.
  </action>
  <verify>
    <automated>node --test .github/verify-telu-icons.test.cjs &amp;&amp; test -d /Users/nrentas/dev/telu-fyi/target/release/bundle/macos/Telu.app &amp;&amp; codesign --verify --deep --strict --verbose=2 /Users/nrentas/dev/telu-fyi/target/release/bundle/macos/Telu.app</automated>
    <human-check>Using the macOS visual-control output, confirm the exact packaged `Telu.app` shows the supplied Telu mark in Finder and Dock; its menu-bar glyph is recognizable and correctly system-tinted in both fixed Light and fixed Dark appearances; the initial Light/Dark/Auto selection is restored; and the packaged process is closed.</human-check>
  </verify>
  <done>The exact packaged bundle has explicit PASS evidence for Finder, Dock, Light menu bar, and Dark menu bar; the original Appearance mode is restored exactly; only the launched packaged instance is closed; and the summary contains no unverified visual claim.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Exact cleanup targets -> user working tree | A destructive cleanup is required for three generated directories while adjacent source, `frontend/src-tauri/build/`, `frontend/node_modules/`, and unrelated dirty work must survive unchanged. |
| Dirty local checkout -> packaged executable | Tauri, Cargo build scripts, the frontend build, and existing sidecars transform the current user-owned checkout into a native executable that will be launched locally. |
| Packaged bundle -> macOS desktop surfaces | The verified local app obtains a process, Dock item, menu-bar item, and possibly native permission dialogs. |
| Visual observation -> conversation evidence | Finder, Dock, menu bar, and System Settings views can expose unrelated desktop information if captures are broader than necessary. |
| Temporary appearance changes -> global user preference | Light/Dark/Auto is a global macOS preference and must return to the exact starting selection on every exit path. |

## STRIDE Threat Register (ASVS L1; block on high)

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-QCSG-01 | Tampering / Denial of Service | Cleanup of `target/`, `frontend/.next/`, and `frontend/out/` | high | mitigate | Reject symlinks and realpath mismatches, use only three literal absolute operands after verification, prove protected paths remain, and forbid globs, variables with unverified values, parent cleanup, and `git clean`. |
| T-QCSG-02 | Tampering | Dirty checkout and local build inputs | medium | mitigate | Snapshot Git state and hashes, use the installed lockfile-resolved Tauri 2.11.1 CLI without installs or updates, verify existing arm64 sidecars, and stop on unrelated failures instead of editing user-owned source. |
| T-QCSG-03 | Spoofing / Elevation of Privilege | Launching the wrong or malformed Telu bundle | medium | mitigate | Require the exact fresh absolute bundle path, validate Info.plist identity/version, executable architecture, resources, ICNS hash, and strict code signature before launch, then bind visual inspection to the new process path/PID. |
| T-QCSG-04 | Tampering / Denial of Service | Global Appearance preference | medium | mitigate | Record Light/Dark/Auto and both backing preference values, restore in guaranteed cleanup, verify the exact baseline afterward, and change no other System Setting. |
| T-QCSG-05 | Information Disclosure | Visual captures | medium | mitigate | Keep observations transient, frame the minimum relevant Finder/Dock/menu-bar/System Settings region, do not save or commit screenshots, and avoid exposing unrelated desktop content. |
| T-QCSG-06 | Repudiation | Subjective icon UAT | low | mitigate | Record separate Finder, Dock, Light menu-bar, and Dark menu-bar verdicts plus exact bundle path, initial/restored appearance, and process cleanup in the GSD summary; do not convert an unavailable visual surface into a pass. |
</threat_model>

## Multi-Source Coverage Audit

| Source | Item | Status | Plan coverage |
|--------|------|--------|---------------|
| GOAL | Build a fresh packaged macOS app and visually verify Telu in Finder, Dock, and both menu-bar appearances. | COVERED | Task 1 produces and validates the app-only bundle; Task 2 performs all four named visual checks against that exact bundle. |
| REQ | QUICK-260927-CSG: close the packaged macOS icon UAT gap left by quick task 260926-w68. | COVERED | The two-task tracer path goes from clean outputs through native packaging to actual OS surfaces and records the result. |
| RESEARCH | No research artifact is present or permitted for this quick task. | EXCLUDED | The live local CLI help, package scripts, Tauri configuration, prior icon plan/summary, and current generated-output inspection provide deterministic execution evidence. |
| CONTEXT | Remove only root `target/`, `frontend/.next/`, and `frontend/out/`; preserve `frontend/src-tauri/build/` and `frontend/node_modules/`. | COVERED | Task 1 uses literal absolute paths, symlink/realpath guards, and protected-path checks before and after cleanup. |
| CONTEXT | Prefer the locked CLI's narrow app-only bundle and record the exact `.app` path. | COVERED | Task 1 uses local Tauri 2.11.1 with `--bundles app`, requires the exact `target/release/bundle/macos/Telu.app`, and records it. |
| CONTEXT | Launch the packaged application, not a development build; inspect Finder, Dock, and Light/Dark menu-bar rendering. | COVERED | Task 2 reveals and launches the absolute app path, binds observation to the new executable path/PID, and records four separate visual verdicts. |
| CONTEXT | Record and restore initial appearance, close the package, and avoid unrelated system changes. | COVERED | Task 2 treats Auto distinctly, uses guaranteed cleanup, verifies restoration, closes only the new process, and forbids cache or other System Settings changes. |
| CONTEXT | Repair only an icon-caused build failure; stop with evidence on unrelated failure. | COVERED | Task 1 has a one-retry, icon-only conditional repair scope and an explicit stop boundary for every other failure class. |
| CONTEXT | Preserve all unrelated working-tree changes and never commit generated build output. | COVERED | Both tasks use a before/after preservation contract; only an isolated icon-specific source correction may be committed, while `target/`, `.next/`, `out/`, and visual evidence remain uncommitted. |
| CONTEXT | No CONTEXT.md D-NN decisions or deferred ideas exist for this quick task. | EXCLUDED | Direct user/orchestrator constraints above are complete; no deferred feature is introduced. |

<verification>
- Pre-build evidence records the local CLI version/help, current Git state, current icon hashes, exact cleanup target identities, protected paths, sidecar architecture, and absence of a prior `.app`.
- Task 1's automated check reruns the focused 3-test icon contract and validates the fresh app's Info.plist, identifier, short version, directory, and strict code signature.
- Package inspection additionally records the fresh bundle mtime, executable architecture/path, resolved ICNS path/hash/decodability, configured templates, and both native sidecars before launch.
- Task 2 records separate visual PASS/FAIL outcomes for Finder, Dock, Light menu bar, and Dark menu bar against the exact bundle and new process; unavailable visual access becomes a checkpoint, never an inferred pass.
- Final cleanup proves the exact initial Light/Dark/Auto state is restored, the new packaged process is gone, existing processes are untouched, and unrelated tracked/untracked content matches the baseline.
- `git status --short --untracked-files=all` contains no staged or committed generated output from `target/`, `frontend/.next/`, `frontend/out/`, or transient visual evidence.
</verification>

<success_criteria>
- A fresh arm64 `Telu.app` is produced by the locked local Tauri CLI's app-only bundle path after the three approved output directories are safely cleared.
- The package is structurally valid and contains the expected Telu identity, version, executable, configured ICNS, templates, FFmpeg, and llama-helper; its code signature verifies before launch.
- The exact packaged bundle visibly shows the supplied Telu mark in Finder and Dock.
- The exact packaged process visibly shows a crisp template-tinted Telu menu-bar glyph in both fixed Light and fixed Dark appearances.
- The original Light/Dark/Auto setting is restored exactly, the packaged process is closed, no icon caches or unrelated System Settings are changed, and no generated output is committed.
- Existing unrelated working-tree changes remain byte-for-byte preserved; an unrelated build failure stops with captured evidence instead of triggering source edits.
</success_criteria>

<output>
Create `.planning/quick/260927-csg-build-a-fresh-packaged-macos-app-and-vis/260927-csg-SUMMARY.md` when done, including the exact app path, package checks, four visual verdicts, initial/restored Appearance mode, process cleanup, working-tree preservation, and any narrowly scoped icon repair.
</output>
