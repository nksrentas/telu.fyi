# Telu Phase 1 baseline scenario protocol

This protocol turns the Phase 1 instrumentation into repeatable local evidence. It does not declare the current machine primary, execute audio capture by itself, choose performance thresholds, or convert missing evidence into a pass.

## Runner contract

Use the `telu-baseline` executable bundled with the exact packaged application selected for approval, not a binary rebuilt from a later dirty working tree. For example:

```bash
BASELINE_CLI="/path/to/meetily.app/Contents/MacOS/telu-baseline"
"$BASELINE_CLI" validate MANIFEST.json
"$BASELINE_CLI" propose-reference
```

After the renewed revision decision, copy the versioned manifest to a run-specific local experiment directory, replace proposed/unknown fields only with approved values, and validate it. The manifest's observed `appRevision` must equal the full revision embedded in the packaged CLI. Do not edit the committed fixture into a false approval record.

Create the immutable ordered run ledger once:

```bash
"$BASELINE_CLI" plan MANIFEST.json MATRIX-PLAN.json
```

`plan` creates one distinct UUID and `run-<uuid>` bundle identity for every warm-up and measured repetition in manifest order. It uses create-new semantics and refuses to overwrite an existing ledger.

Immediately before each packaged-app run, authorize exactly one planned sequence into the packaged app's standard app-data directory:

```bash
"$BASELINE_CLI" authorize-run MANIFEST.json MATRIX-PLAN.json RUN_SEQUENCE
```

`authorize-run` fails closed unless the manifest is approved and complete, the plan is intact, the sequence exists, and the manifest revision exactly matches the revision embedded in the CLI. Its JSON response contains a one-time `assignmentId`, expiration, run/scenario identity, and a `launchEnvironment` entry named `TELU_BASELINE_ASSIGNMENT_ID`. Launch the packaged executable with that exact environment value and the matching app-data location. The app claims the assignment before native capture starts, injects the assigned run/scenario identity into the stage clock, and refuses malformed, expired, reused, tampered, unplanned, scenario-mismatched, or revision-mismatched assignments. Successful native finalization moves the assignment to finalized state and writes its provenance into the immutable run bundle.

After physical runs have produced Plan 17 bundles under a local bundle root, aggregate them to a new path:

```bash
"$BASELINE_CLI" aggregate MANIFEST.json MATRIX-PLAN.json BUNDLE-ROOT AGGREGATE.json
```

Aggregation revalidates each present bundle with the Plan 17 schema, ordering, queue-conservation, identity, and redaction validator. A malformed present bundle fails the command. A missing bundle remains `unknown`/`bundle_missing`. The report preserves individual run IDs, relative bundle names, raw metric samples, min/max distributions, limitations, and outliers. It refuses to publish inside the raw bundle root or overwrite an existing report.

After the threshold declaration and separate validation matrix exist, validate the gate artifact with the same packaged CLI:

```bash
"$BASELINE_CLI" verify-gate BASELINE-GATE.json
```

`verify-gate` is fail-closed: empty, missing, duplicated, reordered, late, lost, unknown, non-finite, aggregate-mismatched, or unsafe artifact evidence cannot produce `go`.

## Required preflight

Record the following before the first warm-up:

1. The approved fingerprint and methods from `baseline-reference.md`; exact packaged build/source revision; wall-clock synchronization; and the unmodified manifest/plan files.
2. Microphone and system-audio device names, permission state, sample rate/channels, transcription engine/model/checksum, acceleration backend, language, provider route, queue capacity, and finalization deadline.
3. Power source, battery method, stabilization/control conditions, sampler interval, and uncertainty.
4. OS network block/capture rules, interfaces, proxy/VPN/DNS state, start/end timestamps, restore procedure, and evidence location.
5. A writable app-data location with enough space. Preserve existing bundles; use new run IDs rather than deleting or replacing evidence.
6. Updater, analytics, model-download, and other background-network behavior set according to the canary manifest. Record any permitted attempt in the outbound ledger.

If a required device, model, permission, method, or packaged build is unavailable, stop that combination and record it as `unverified`. Do not substitute another provider, device, or model silently.

## Input discipline

- Fixture/replay inputs are immutable local files with a recorded checksum and recording-relative timing. They may exercise deterministic overload, stop, and recovery seams but do not replace physical microphone/system-audio smoke.
- Live inputs use a written phrase/script, declared speaker distance/level, and a recorded duration. Meeting words stay out of diagnostic exports by default.
- A packaged-app run is required for every primary scenario. A development build may diagnose failures but cannot satisfy packaged behavior.
- The committed fixture starts with one warm-up and two measured repeats per scenario. Those counts are experiment inputs, not release thresholds; increase them before approval if the chosen method cannot support a defensible distribution.
- Runs are never merged. Failed, interrupted, and outlier runs remain linked in their original manifest order.

## Ordered matrix

| Order | Scenario | Required setup and action | Primary evidence | Required edge/failure observation |
|---:|---|---|---|---|
| 1 | `short_utterance` | Cold then warm local model; speak/replay the declared short phrase and stop after final evidence. | Full stage chain, canonical ID, evidence commit, queue samples, resource samples, UI acknowledgement. | Cold/warm distinction; no provisional text cited as final. |
| 2 | `continuous_speech` | Sustain the declared speech script beyond ordinary segment boundaries. | Segment-open/freshness samples, segment-to-final and end-to-end distributions, maximum queue age. | Long speech must not disappear behind average latency. |
| 3 | `overlapping_speech` | Use the approved microphone and system-audio path with controlled overlap. | Source/track attribution, time overlap, stable evidence ordering, completeness. | Device absence or ambiguous attribution is unverified/fail, not a substituted single-source pass. |
| 4 | `sustained_system_audio` | Play the declared system source for the fixed duration while capture remains active. | Backlog age/depth, transcript freshness, memory/CPU/power observations. | Sustained source must expose growth, drops, or bounded behavior. |
| 5 | `overload` | Replay at the declared accelerated rate or apply the declared transcription slowdown without changing queue capacity mid-run. | Accepted/started/terminal conservation, rejected work, gaps, peak depth/age/memory. | Capacity pressure must remain bounded; rejection or deadline work stays explicit. |
| 6 | `stop` | Stop with empty, shallow, and full accepted queues according to the written subcases. | Capture-close time, drain/deadline, terminal lifecycle, remaining work and gaps. | Repeated stop returns the same committed terminal result. |
| 7 | `restart` | Start the next meeting immediately after complete and incomplete stop subcases. | Distinct meeting/run IDs, no stale event/worker leakage, unchanged prior evidence. | Same configuration still receives new IDs and bundles. |
| 8 | `crash` | Use the declared injection/forced-termination procedure at preparing, recording, finalizing, and evidence-write boundaries. | Durable identity/evidence before termination, launch-time candidate, explicit uncertain gaps. | Never stage content as safely committed unless SQLite/run evidence proves it. |
| 9 | `repeated_recovery` | Recover the same interrupted meeting at least twice before and after partial reconciliation. | Stable meeting/evidence IDs and counts, unchanged already-durable rows, preserved gaps and reconciliation timestamp rules. | Recovery converges; it does not create a copy. |
| 10 | `network_blocked` | Activate the approved independent OS block/capture, start the application canary, and run local capture/transcription/persistence/recovery/evaluation. | OS observation plus same-run complete non-overflowed outbound ledger and required local stages. | Any unmatched packet/attempt, missing ledger, background exception, or absent OS evidence fails; zero attempts pass only with complete two-source evidence. |

## Per-run sequence

1. Confirm the run ID, run sequence, scenario, and expected `run-<uuid>` directory from the immutable matrix plan.
2. Create a fresh one-time assignment with packaged `authorize-run`; verify its returned run/scenario/revision identity and expiration. Never reuse an assignment from an earlier launch.
3. Capture preflight state and start the approved resource/power and, for the canary, OS network observers.
4. Start the packaged executable with the returned `TELU_BASELINE_ASSIGNMENT_ID` and verify the displayed effective route before data-bearing work.
5. Execute only the named scenario and its declared injection. Do not tune VAD, ASR, model, queue capacity, or deadline between measured repetitions.
6. Stop or force termination exactly as specified; wait only for the authoritative finalization/recovery state, never a fixed quiet delay.
7. Confirm native finalization created the immutable Plan 17 bundle with the assigned run ID and assignment provenance. Validate it locally and record any failure without replacing the directory.
8. Stop observers, record end state/uncertainty, and reconcile canary OS evidence with the app ledger.
9. Inspect Diagnostics for the same run ID. Retain unknowns, failures, limitations, and outliers.

## Crash and recovery safety

Use only the approved local fixture or a deliberately created test meeting. Before each injection, record the exact boundary and run ID. Forced termination must not use destructive database edits. On restart, use the product recovery workflow, inspect the durable lifecycle/gaps, repeat recovery, and compare stable IDs/counts. Never delete the original recording folder or SQLite rows to make a retry pass.

## Cleanup

- Restore firewall/proxy, VPN/DNS, analytics/updater, display/power, and sleep settings to their captured preflight state; record the restore check.
- Stop fixture audio and release audio devices.
- Keep raw bundles immutable. Diagnostic exports are new sanitized copies and do not replace originals.
- Keep matrix plan, manifest, aggregate, OS/power evidence, and review notes together in the local experiment directory. Store only relative bundle references in review artifacts.
- If a partial report was created outside the runner, do not promote it; rerun to a new output name after resolving the cause.

## Threshold and gate separation

This protocol yields evidence, not thresholds. Review all measured distributions, individual runs, failures, limitations, and outliers first. Then write a versioned declaration in `baseline-gate.md` before running a separate validation matrix. Phase 2 and Phase 4 receive separate dispositions; `unknown`, `unverified`, non-reproducible, or failing evidence cannot produce `go`.
