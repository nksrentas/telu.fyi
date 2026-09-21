# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## tauri-bundles-baseline-cli — Tauri bundled the auxiliary baseline CLI as the desktop app entry
- **Date:** 2026-09-21
- **Error patterns:** CFBundleExecutable telu-baseline, packaged app prints baseline CLI help and exits, multi-binary Cargo package, default_run null
- **Root cause(s):** `frontend/src-tauri/Cargo.toml` gained the auto-discovered `telu-baseline` binary without declaring `package.default-run = "meetily"`, so Tauri had no authoritative GUI main-target identity.
- **Fix:** Declared `default-run = "meetily"` and added a focused multi-binary package regression contract.
- **Files changed:** `frontend/src-tauri/Cargo.toml`, `.github/verify-tauri-binary-selection.test.cjs`
- **Why not caught:** No existing gate asserted packaged main-executable identity after an auxiliary Cargo binary was added; compilation and CLI tests passed while `CFBundleExecutable` was wrong.
- **Recurrence guard:** Regression test `.github/verify-tauri-binary-selection.test.cjs` requires the multi-binary Tauri package to pin the `meetily` GUI as Cargo `default-run`.
---
