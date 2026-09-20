# Phase 1: Baseline Observability, Identity, and Trust Boundaries - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-20
**Phase:** 1-Baseline Observability, Identity, and Trust Boundaries
**Areas discussed:** Baseline measurement contract, Meeting identity and durable transcript evidence, Stop, backlog, and recovery semantics, Provider boundaries and trust UX
**Mode:** `--auto` — all gray areas were selected and recommended defaults were applied in one pass.

---

## Baseline Measurement Contract

### Canonical evidence format

| Option | Description | Selected |
|--------|-------------|----------|
| Versioned local run bundle | Scenario manifest, environment fingerprint, raw monotonic events, resource samples, errors, and readable summary | ✓ |
| Aggregate counters only | Retain headline numbers without replayable event evidence | |
| Console logs | Interpret ad hoc application logs manually | |

**Auto-selected choice:** Versioned local run bundle.
**Notes:** Raw local evidence makes threshold decisions auditable and keeps evaluation private by default.

### Threshold policy

| Option | Description | Selected |
|--------|-------------|----------|
| Evidence-derived and predeclared | Repeat baseline runs, preserve distributions/outliers, and declare gates before dependent experiments | ✓ |
| Fixed targets now | Choose numeric limits before measuring the retained foundation | |
| Subjective judgment | Decide pass/fail after inspecting each run | |

**Auto-selected choice:** Evidence-derived and predeclared thresholds.
**Notes:** Unknown or missing evidence fails the relevant gate.

---

## Meeting Identity and Durable Transcript Evidence

### Canonical meeting identity

| Option | Description | Selected |
|--------|-------------|----------|
| Rust-owned identity at session creation | Allocate once before preparation/recording and reuse everywhere | ✓ |
| Identity at stop | Preserve current behavior that creates a meeting only during final save | |
| Frontend temporary identity | Create locally in React/IndexedDB and remap after persistence | |

**Auto-selected choice:** Rust-owned identity at session creation.
**Notes:** This removes split identity across recording, recovery, SQLite, and later evidence consumers.

### Durable transcript semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Final-only canonical evidence | Keep partial text provisional; incrementally upsert final segments with stable evidence IDs | ✓ |
| Partial and final are equal | Allow downstream citation of any emitted text | |
| Stop-time whole transcript | Persist only after recording finishes | |

**Auto-selected choice:** Final-only canonical evidence.
**Notes:** Partial text can remain useful in the UI without becoming trustworthy source material.

---

## Stop, Backlog, and Recovery Semantics

### Stop contract

| Option | Description | Selected |
|--------|-------------|----------|
| Bounded drain with incomplete state | Stop capture, close producers, drain to a deadline, then preserve explicit incomplete/recoverable state | ✓ |
| Indefinite drain | Keep the user waiting until all accepted work completes | |
| Timeout and mark complete | Use a fixed timeout and assume the remaining tail is safe | |

**Auto-selected choice:** Bounded drain with explicit incomplete state.
**Notes:** Completion must be based on authoritative work state, not quiet-time heuristics or placeholder depth.

### Recovery contract

| Option | Description | Selected |
|--------|-------------|----------|
| Idempotent reconciliation with visible gaps | Reuse canonical IDs, preserve durable segments, and expose missing intervals | ✓ |
| Create a recovered copy | Save every recovery attempt as a new meeting | |
| Replace without gap metadata | Overwrite the old record and present it as complete | |

**Auto-selected choice:** Idempotent reconciliation with visible gaps.
**Notes:** Repeating recovery must converge on one logical meeting.

---

## Provider Boundaries and Trust UX

### Boundary disclosure

| Option | Description | Selected |
|--------|-------------|----------|
| Point-of-use labels plus diagnostics | Show Local/LAN/Remote and destination at selection/use, with per-run detail available | ✓ |
| Settings-only disclosure | Describe destinations only on the settings page | |
| Modal for every request | Interrupt every provider operation with a confirmation | |

**Auto-selected choice:** Compact point-of-use labels plus diagnostic detail.
**Notes:** Keeps normal use calm while preserving inspectability.

### Provider failure

| Option | Description | Selected |
|--------|-------------|----------|
| Visible failure with no silent fallback | Preserve selection and local data; offer explicit retry/reconfigure/cancel | ✓ |
| Automatic fallback | Switch to another available destination without another decision | |
| Silent drop | Abandon the work without disrupting the UI | |

**Auto-selected choice:** Visible failure with no silent fallback.
**Notes:** A network-blocked local canary verifies the policy rather than relying on configuration inspection.

---

## the agent's Discretion

- Exact internal type, migration, serialization, and module names.
- Exact copy and placement of compact boundary/completeness UI.
- Exact repeat count for the initial benchmark harness, as long as it is recorded and not a single favorable run.

## Deferred Ideas

None.
