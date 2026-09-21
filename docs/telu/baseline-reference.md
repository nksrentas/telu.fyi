# Telu Phase 1 baseline reference

status: unverified

This record is the approval boundary for the Phase 1 physical matrix. `proposed` means the host was observed but has not been accepted as the primary reference machine. No matrix result, threshold, or downstream gate may treat this record as approved until every blocking field below is complete and the approval section records an explicit decision.

## Proposed host captured 2026-09-21

| Field | Proposed value | State |
|---|---|---|
| Machine | MacBook Pro, model identifier `Mac16,1` | proposed, not approved |
| Processor | Apple M4, 10-core configuration reported by macOS | proposed, not approved |
| Memory | 16 GB | proposed, not approved |
| Architecture | arm64 / aarch64 | proposed, not approved |
| Operating system | macOS 26.6.2, build 25G83 | proposed, not approved |
| Source revision | `f0780df4e666f3d5e352fb9bfdf378be75c003b0` | observed; the packaged build revision must match |
| Power snapshot | AC power, internal battery present at 99% and finishing charge | context only; not battery evidence |
| Capture sample baseline | 48 kHz; actual channel/sample configuration must be recorded per run | proposed input, not a performance threshold |
| Effective route | Local, this device | proposed; each run must retain its validated route record |

The generic `telu-baseline propose-reference` command independently reports the sanitized host class (`Apple M4; 16 GiB`, macOS/aarch64) and intentionally leaves the application revision unknown unless it was embedded at build time. The more specific model identifier above came from the local macOS hardware report. Serial numbers, platform UUIDs, UDIDs, usernames, and full paths are deliberately excluded.

## Blocking fields

The primary reference is not reproducible until all of these are supplied and approved:

- Exact microphone device name and connection path.
- Exact system-audio device or capture path; state `none` only if the matrix is deliberately narrowed and sustained/overlapping system-audio scenarios remain blocked.
- Transcription engine, model filename/version, acceleration backend, and model checksum or other stable local identifier.
- Evaluation language and any language-detection setting.
- Packaged application build identifier that maps to the source revision above.
- Authoritative battery/power evidence method, including power source, stabilization, sampling interval, idle control, repeat duration, uncertainty, and any privileges required.
- Authoritative OS firewall/proxy observation method for the network-blocked canary, including block scope, capture interface, observation window, privilege requirements, and retained redacted evidence.
- Exact queue-capacity and finalization-deadline experiment inputs. These are recorded inputs, not thresholds.

The versioned fixture therefore records `power`, `devices`, `model`, `language`, and `networkCanaryMethod` as `unknown`. macOS, Windows, and Linux smoke coverage remain `unverified` until executed on named configurations.

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

## Approval

- Primary reference decision: pending
- Exact fingerprint approved: no
- Battery/power method: pending
- OS network-block/capture method: pending
- Approval date: pending
- Approver: pending

Changing an approved machine, device, model, language, power method, or canary method creates a new version of this record and a new matrix plan. It does not rewrite prior run evidence.
