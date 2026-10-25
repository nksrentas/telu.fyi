---
phase: 02-evidence-linked-post-meeting-knowledge
plan: 44
subsystem: knowledge-evaluation
status: stopped
tags: [know-07, development-gate, gap-closure, larger-local-model, deferred]

requires:
  - phase: 02-evidence-linked-post-meeting-knowledge
    provides: 02-42 user choice option-larger-local-model; the approved Qwen3.5-9B-Q4_K_M.gguf candidate
provides:
  - "qwen3.5:9b registered as a builtin summary model (419cc70 RED, e9502a1 GREEN), with its onboarding size mirror"
  - "A passing 9B smoke on one development meeting after a clean restart"
affects: [02-43, KNOW-07]

actuals:
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/02-evidence-linked-post-meeting-knowledge/02-44-SUMMARY.md
  modified:
    - frontend/src-tauri/src/summary/summary_engine/models.rs
    - frontend/src/lib/onboarding-summary-model.ts
    - frontend/tests/lib/onboarding-summary-model.test.mjs

key-decisions:
  - "The user stopped the 9B development measurement and deferred KNOW-07: \"Stop the 9B run and defer KNOW-07: record it as deferred in the planning docs so Phase 2 can close, and skip 02-43.\""
  - "Deviation accepted by the user: frontend/src-tauri/src/audio/recording_commands.rs differs from 092f1f5 by a rustfmt-only change in 7c13d69 (identical once whitespace is stripped)."

patterns-established: []

requirements-completed: []

duration: 2026-10-21 to 2026-10-25
completed: 2026-10-25
---

# Phase 02 Plan 44: qwen3.5:9b Development Gate Summary

**Stopped by the user before the development gate was measured. The 9B model is registered and passed its smoke run, but the full measurement was stopped at 2 of 10 meetings and KNOW-07 is deferred.**

## Outcome

- **Task 1 (tracer):** done.
  - RED 419cc70 and GREEN e9502a1 are in place; the definition, full lib suite, onboarding mirror, commit-scope and installed-file verifies passed on 2026-10-25.
  - Installed file: 5680522464 bytes, sha256 03b74727a860a56338e042c4420bb3f04b2fec5734175f4cb9fa853daf52b7e8. llama-helper sha256 b88b3f990edcafb40cd1631285392ace5f68318d67c21429f8a802f787c76fdf.
- **Smoke:** three attempts aborted on critical memory pressure (level 4) on this 16 GB Mac (2026-10-21, and twice on 2026-10-25; peak helper RSS up to 8704 MiB). After a restart with other apps closed, the fourth attempt passed: exit 0, model qwen3.5:9b, budget 1500, knowledge tree clean, maximum pressure level 2, peak helper RSS 7943 MiB, 11.7 min, ratio 1.52 against the 4B on the same fixture (projected full run 3.1 h).
- **Task 2:** started at 15:56 local on 2026-10-25 and stopped by the user after 2 of 10 meetings. The partial run stays outside the repository in `$HOME/telu-know07-dev/02-44-1` and was not scored.
- **Tasks 3 to 5:** not run. No blind labels, no score, no decision checkpoint.
- **eval/development-report.json:** unchanged; still the 4B report from 57d92a9.
- **Unchanged:** thresholds-v2.json, the held-out set (unspent), the provider route and the app's settings. Nothing was downloaded.

## User decision

Verbatim, 2026-10-25: "Stop the 9B run and defer KNOW-07: record it as deferred in the planning docs so Phase 2 can close, and skip 02-43."

KNOW-07 is deferred, not satisfied. `node .github/verify-phase2-know07-status.cjs` still derives open; the override is recorded in 02-VERIFICATION.md.

## Picking it up again

The 9B smoke passes only with a freshly restarted Mac and other apps closed. A resumed measurement needs the same conditions for about 3 hours, then the 02-38 blind labels and the Task 4 score, before 02-43 can run.
