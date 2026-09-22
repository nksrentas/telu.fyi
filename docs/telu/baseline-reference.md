# Telu Phase 1 baseline reference

status: approved

This record is the approval boundary for the Phase 1 physical matrix. Nick approved reference configuration version `reference-2026-09-22.1` on 2026-09-22. Approval authorizes the matrix configuration and evidence procedures only; it does not assert that battery, packet, scenario, validation, or supported-platform evidence has been collected. Every such result remains `unverified` until its retained evidence passes review.

## Approved primary reference captured 2026-09-22

| Field | Approved value | State |
|---|---|---|
| Machine | 14-inch MacBook Pro, canonical macOS model identifier `Mac16,1` | approved primary reference |
| Processor | Apple M4, 10-core | approved |
| Memory | 16 GB | approved |
| Architecture | arm64 | approved |
| Operating system | macOS 26.6.2, build 25G83 | approved |
| Microphone | Built-in MacBook Pro microphone via CoreAudio | approved |
| System audio | Built-in speakers/output captured via ScreenCaptureKit | approved |
| Transcription | Parakeet TDT 0.6B v3 INT8; model ID `parakeet-tdt-0.6b-v3-int8`; ONNX Runtime CPU execution provider | approved |
| Encoder model | `encoder-model.int8.onnx`; SHA-256 `6139d2fa7e1b086097b277c7149725edbab89cc7c7ae64b23c741be4055aff09` | approved installed-model identifier |
| Preprocessor model | `nemo128.onnx`; SHA-256 `a9fde1486ebfcc08f328d75ad4610c67835fea58c73ba57e3209a6f6cf019e9f` | approved installed-model identifier |
| Decoder/joint model | `decoder_joint-model.int8.onnx`; SHA-256 `eea7483ee3d1a30375daedc8ed83e3960c91b098812127a0d99d1c8977667a70` | approved installed-model identifier |
| Evaluation language | English; automatic language detection disabled | approved |
| Packaged/source build revision | `da1ffc622efba4a9df55f369b2471c2cd15e34ca` | approved matrix input; packaged execution evidence not yet collected |
| Queue capacity | 8 | approved experiment input, not a performance threshold |
| Finalization deadline | 120000 ms | approved experiment input, not a performance threshold |
| Power snapshot | Earlier capture reported AC power, internal battery present at 99%, finishing charge | context only; not battery evidence |
| Capture sample baseline | 48 kHz; actual channel/sample configuration must be recorded per run | approved preflight baseline, not a performance threshold |
| Effective route | Local, this device | approved expected route; each run must retain its validated route record |

The generic `telu-baseline propose-reference` command independently reports the sanitized host class (`Apple M4; 16 GiB`, macOS/aarch64) and intentionally leaves the application revision unknown unless it was embedded at build time. The approved revision above is the exact revision selected for this matrix and must be compared with the packaged artifact before a run begins. The canonical model identifier came from the local macOS hardware report. Serial numbers, platform UUIDs, UDIDs, usernames, and full paths are deliberately excluded.

## Preflight comparison and still-unverified evidence

The reference configuration and procedures are approved. Before every measured run, preflight must compare the live machine and packaged artifact with every approved value above. A mismatch blocks that run rather than silently creating a new configuration.

The following evidence has not yet been collected and remains blocking/unverified:

- Live preflight proof that the packaged artifact maps to revision `da1ffc622efba4a9df55f369b2471c2cd15e34ca` and that the installed model files match all three approved SHA-256 values.
- Raw P1 idle/workload samples, `pmset` snapshots, thermal state, repeat distributions, outliers, and battery-resolution/uncertainty review.
- Raw N1 PF/tcpdump observation, redacted timestamps/destinations/dispositions/interface, outbound-ledger reconciliation, and proof that the original PF state was restored.
- Warm-up, measured-repeat, packaged-app smoke, aggregate, threshold-declaration, and later validation-run evidence for every required scenario.
- Any macOS combination other than this exact configuration and all Windows/Linux smoke coverage.

The committed fixture remains a deliberately unapproved example: its `power`, `devices`, `model`, `language`, and `networkCanaryMethod` values stay `unknown`. Approved values belong in a new run-specific local experiment manifest, never in a rewritten fixture that could be mistaken for collected evidence.

## Defensible battery and power methods

Select one authoritative method and record its exact procedure. CPU percentage is never relabeled as energy impact.

### Option P1 — macOS process energy sampling plus battery observation (recommended for the proposed host)

- Run the packaged app on battery after a declared stabilization period with fixed display brightness, low-power mode, model, devices, and background workload.
- Capture local process/system samples with macOS `powermetrics` at a declared interval and retain `pmset` power-source/battery snapshots before and after each run.
- Run an equivalent idle/control window and multiple measured repeats. Preserve raw local samples, elapsed time, battery resolution, thermal state, and outliers.
- Record that `powermetrics` requires elevated local privileges and that its energy-impact observations are platform estimates, not laboratory joules.

### Option P2 — controlled battery-discharge delta with an idle control

- Run unplugged from a declared starting charge range for a long enough fixed interval that battery-percentage resolution is meaningful.
- Fix display, sleep, radios, devices, model, and background workload; record `pmset`/system power snapshots, elapsed time, idle control, repeats, and uncertainty.
- Use only when process energy sampling is unavailable. It can support a coarse whole-system battery claim but cannot isolate Telu precisely.

### Option P3 — external power instrumentation

- Use named calibrated hardware and a written sampling/export procedure, with the host battery state controlled and an idle comparison.
- Preserve device model, calibration date, sample interval, raw export, repeats, and uncertainty. This is strongest for whole-device power but requires additional equipment.

If none is selected or the chosen method cannot produce defensible observations, battery evidence remains `unknown` and BASE-04 does not pass.

### Approved procedure P1 — `power-method-p1-2026-09-22.1`

- Run unplugged and stabilize for 10 minutes before each observation window.
- Fix the display at 50%; keep Low Power Mode off; keep the approved model, devices, and background workload fixed.
- Collect `powermetrics` samples every 5 seconds. Elevated local privileges are required.
- Use matching 15-minute idle and workload windows with three measured repeats.
- Retain `pmset` snapshots before and after each window, thermal state, all raw local samples, and all outliers.
- Record the battery-percentage resolution and state explicitly that `powermetrics` observations are platform estimates, not laboratory joules.
- Until those retained observations are collected and reviewed, battery outcome status is `unverified` and BASE-04 remains blocked.

## Defensible network canary methods

Select one authoritative method and record its exact rules and capture procedure. The application ledger is necessary but is not independent packet evidence.

### Option N1 — macOS PF deny rule plus packet capture (recommended for the proposed host)

- Install a temporary, narrowly documented PF anchor/ruleset that blocks the declared non-loopback egress scope for the canary, with an explicit restore procedure.
- Capture the observation window on the relevant physical interfaces with `tcpdump` or another OS packet capture while the local matrix scenario runs.
- Retain a redacted capture summary containing timestamps, destinations, dispositions, and interface—not payload content—and reconcile every observed attempt with the Telu outbound ledger.
- Record required elevated privileges, VPN/proxy state, loopback exclusions, DNS behavior, and proof that the original PF state was restored.

### Option N2 — host firewall with auditable connection log

- Use a named firewall that can deny all non-loopback Telu traffic and export an authoritative timestamped connection log.
- Document rule scope, direct-connection coverage, DNS/VPN behavior, restore procedure, and export format. A UI screenshot alone is insufficient evidence.

### Option N3 — isolated network namespace or external capture point

- Run the packaged app in a declared isolated host/VM/network where an external capture point denies and records every non-loopback packet.
- Preserve the VM/host fingerprint, routing configuration, capture filter, timestamps, and reconciliation procedure. This does not validate the proposed physical host unless that limitation is explicit.

A proxy-only method that can be bypassed by direct sockets is not authoritative unless direct traffic is independently blocked or captured.

### Approved procedure N1 — `network-method-n1-2026-09-22.1`

- Disable VPN and proxies before preflight and record that state.
- On active physical interface `en0`, install a temporary, narrowly scoped PF deny ruleset for non-loopback egress.
- Simultaneously capture `en0` with `tcpdump`, including DNS, for the complete observation window.
- Retain only redacted timestamps, destinations, dispositions, and interface; do not retain packet payloads.
- Reconcile every observed attempt with the Telu outbound ledger and record loopback/DNS handling explicitly.
- Record that elevated local privileges are required.
- Restore the original PF state after the window and retain proof that restoration succeeded.
- Until block/capture, reconciliation, and restoration evidence are collected and reviewed, the network-canary outcome is `unverified` and PRIV-03 remains blocked.

## Approval

- Primary reference decision: approved — captured 14-inch MacBook Pro configuration above
- Exact fingerprint approved: yes, configuration version `reference-2026-09-22.1`
- Battery/power method: approved — P1, procedure `power-method-p1-2026-09-22.1`
- OS network-block/capture method: approved — N1, procedure `network-method-n1-2026-09-22.1`
- Approval date: 2026-09-22
- Approver: Nick
- Evidence collection status: unverified — approval does not substitute for raw physical observations or validation

Changing an approved machine, device, model, language, power method, or canary method creates a new version of this record and a new matrix plan. It does not rewrite prior run evidence.
