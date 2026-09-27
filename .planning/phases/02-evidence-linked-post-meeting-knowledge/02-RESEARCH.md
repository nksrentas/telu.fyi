# Phase 2: Evidence-Linked Post-Meeting Knowledge - Research

**Researched:** 2026-09-27
**Domain:** Rust/SQLite append-only knowledge ledger + LLM extraction with verbatim-span grounding; Tauri 2 macOS window chrome; Tailwind/shadcn design-token migration of a Next.js 14 static-export app
**Confidence:** MEDIUM-HIGH (in-repo facts HIGH, verified by reading source; Tauri chrome MEDIUM, cross-checked against the installed config schema and crate sources; extraction quality with 1–4B local models LOW until measured)

## Summary

Phase 2 is really two phases that share one exit gate. The first is a **trust-critical Rust ledger**: new append-only SQLite tables for extraction runs, candidate items, evidence links, reviews, revisions, suppressions and abstentions. Rust verifies every claim against a finalized `transcript_evidence` segment, and only verified claims are ever written. The second is a **full UI re-platform**: the Telu tokens replace shadcn's HSL variables, the SF system font replaces Source Sans 3, the window gets Overlay chrome with sidebar vibrancy, and a new shell ships with Today/Review tabs, recording in the shell, and a living-doc meeting page. These two tracks are mostly independent until the meeting page consumes the knowledge commands, so plan them as parallel waves that join late.

The biggest in-repo findings change the plan's shape:
1. **The re-skin is about twice the size CONTEXT estimated.** 36 files use shadcn token classes, but **70 of 121 `.tsx` files hold 1,072 hard-coded Tailwind palette classes** (`gray-*`, `blue-*`, …), and only 2 files have `dark:` variants. Dark mode cannot ship without replacing them.
2. **`transcript_evidence` text is mutable on redelivery.** The upsert does `ON CONFLICT(evidence_id) DO UPDATE SET … transcript = excluded.transcript`. A quote that was verified can therefore stop being true later. Knowledge must snapshot a hash of the evidence text and re-verify on read (KNOW-08 invalidation).
3. **There is no speaker attribution.** Every evidence row has `source_track = "mixed"`, so "attribution" can only mean an owner or due date *stated in the quoted words*.
4. **Imported and retranscribed meetings write only the legacy `transcripts` table,** so they have no evidence and cannot be extracted.
5. **sqlx enables `foreign_keys=ON` by default,** so FKs without CASCADE on the new tables make a missed explicit delete fail the whole transaction instead of silently leaving rows. This is the right enforcement mechanism for D-17.

The whole extraction-trust story rests on one rule: **the model never invents identifiers or offsets.** Segments are labeled `S1…Sn` in the prompt. The model returns a segment label plus a verbatim quote. Rust maps the label to the stable `evidence_id`, normalizes both strings, finds the quote, and records exact raw char offsets. Anything that fails is counted as an abstention and never shown (D-15). This is the pattern Google's LangExtract uses (source-grounded character offsets). Accept, correct, reject and restore are appended review events. Current state is a projection (a SQL view). Rows are immutable, enforced by `BEFORE UPDATE` triggers.

**Primary recommendation:** Build the Rust `knowledge` module first, test-first on in-memory SQLite: schema, immutability triggers, the evidence read path, span verifier, matcher, and the deletion transaction with a generic "zero rows in every table that has a `meeting_id` column" test. In parallel, run the token migration as its own wave behind a Playwright-WebKit screenshot gallery with a stubbed `__TAURI_INTERNALS__`. Only then build extraction orchestration, the shell and the knowledge UI on top.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Run/candidate/review/revision persistence | Database (SQLite, Rust-owned) | — | D-08: Rust owns persistence; append-only contract read by Phases 3–5 |
| Evidence-span verification and abstention | API/Backend (Rust `knowledge`) | — | D-15: Rust verifies; React never decides support |
| Extraction prompt, chunking, provider dispatch | API/Backend (Rust, via `llm_client::generate_summary`) | — | Must inherit route validation + outbound ledger (PRIV-01..03) |
| Regenerate matching/suppression | API/Backend (Rust) | Database | KNOW-05 must hold for every consumer, not only the UI |
| Eligibility projection ("Accepted · eligible") | Database (view) + Rust query | Browser (render only) | React renders Rust facts (Phase 1 pattern) |
| Meeting deletion + impact counts | API/Backend (one SQLite transaction) | Browser (Alert, Cancel-focused) | D-17/D-18 |
| Auto-run gate (setting + `complete` + validated route) | Browser (page effect) | API/Backend (re-validates route snapshot) | Existing gate lives in `page-content.tsx`; Rust re-checks before I/O |
| Design tokens, fonts, motion presets | Browser/Client (CSS vars, Tailwind, `motion.ts`) | — | Static export, no SSR |
| Window chrome, vibrancy, drag region | Native (Tauri config + capability) | Browser (`data-tauri-drag-region`) | Only native can set NSVisualEffect material |
| Recording start/stop/finalization in shell | Native/Rust (unchanged) | Browser (shell-level host) | Phase 1 behavior must not move tiers |
| Evaluation harness (KNOW-07) | Offline CLI (`src/bin/telu-knowledge-eval.rs`) | Database (review outcomes, counts only) | Content-bearing gold data must stay outside content-free evaluation tables |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Review UI and Design-System Migration (user chose "full shell now")
- **D-01:** Phase 2 ships the approved design system app-wide in one change. Telu tokens (light and dark) replace the shadcn HSL variables in `globals.css` and the Tailwind theme, the SF system font stack replaces Source Sans 3, and every existing screen is re-skinned (settings, model managers, permission/onboarding screens, meeting pages). This migration is its own first plan wave, with visual regression checks on every existing screen. — **Reversibility:** costly — about 35 files use shadcn token classes, plus every screen and the 900-line sidebar.
- **D-02:** The new shell follows the design skill: Tauri overlay title bar with hidden title and inset traffic lights, a translucent (vibrancy) sidebar, and agenda/doc toolbars with glass groups. The sidebar shows only tabs backed by real data: **Today** and **Review**. Upcoming, Found in Calendar and Series appear only once their data exists (calendar integration phase, Phase 5). No fake or placeholder data. — **Reversibility:** costly — window config, shell layout and navigation model change together.
- **D-03:** **Today** is the agenda timeline of meetings *recorded* on that day, from the meetings table. Each card shows its Telu state: recording, finalizing, "N to review", filed, or incomplete/recovered with gaps. It uses the EventCard/agenda components; the day stepper (←/→) navigates past days, and search finds older meetings. There are no calendar events yet.
- **D-04:** Recording lives in the shell. The toolbar Record button (⌘R) starts a meeting, using the Rust-allocated canonical id from Phase 1. While recording, the toolbar shows the recording capsule, the meeting appears on Today, and its meeting page or side peek shows the live transcript. This replaces the old recording home page and must keep every Phase 1 behavior: stop and finalization progress with real queue depth and oldest age, recovery reconciliation, completeness gaps, and provider boundary labels before data-bearing work. — **Reversibility:** costly — the recording UX and its Phase 1 hooks move into new components.
- **D-05:** The meeting page is a single-meeting page in the living-doc style (720px column): header, Summary, a Knowledge section (ReviewHead + CandidateRow), and a transcript drawer that highlights the evidence segment. The existing markdown summary stays and is labeled "unreviewed". Clicking a meeting on Today opens the side peek with the same blocks; "Open as page" opens the full page. There is no Docs section (document ingestion is Phase 3).
- **D-06:** Accepted items are meeting-scoped and labeled **"Accepted · eligible"**, not the prototype's "In Memory". Series Memory is Phase 5, and automatic promotion into it is a non-goal.
- **D-07:** The **Review** tab lists meetings with pending candidates ("N to review") and opens each meeting's review.

#### Extraction Runs
- **D-08:** Extraction is its own append-only derivation run, separate from the markdown summary; the summary flow stays unchanged. Runs, candidates, reviews and revisions live in new Rust-owned SQLite tables. Earlier runs are never mutated. — **Reversibility:** one-way — new migration and an append-only eligibility contract that Phases 3–5 will read.
- **D-09:** Extraction runs automatically only when all three hold: the auto-generate setting is on, the meeting's completeness is `Complete`, and the provider route is `validated` (reuse the existing gate in `page-content.tsx`). Incomplete or recovered meetings need an explicit user start, with their gaps shown. The Local/LAN/Remote label and destination appear before the data-bearing call, with no silent fallback (Phase 1 D-18/D-19).
- **D-10:** Extraction input comes from finalized `transcript_evidence` segments (stable evidence ids), not the legacy `transcripts` table. The read path that lists evidence by meeting, which doesn't exist yet, is part of this phase.
- **D-11:** Regenerate always creates a new run. New candidates are matched against existing items by type, normalized text and overlapping evidence ids:
  - a match to a rejected or superseded item is suppressed, recorded and never shown unless the user restores it (KNOW-05);
  - a match to an accepted item is linked as "reconfirmed" and not shown again;
  - an unmatched candidate appears as a new proposed candidate.

#### Trust Rules
- **D-12:** Corrections create append-only revisions and never update in place. The correctable fields are text, owner and due date. Type isn't correctable; a wrong type is rejected instead. — **Reversibility:** one-way — revision lineage is a persisted audit contract (KNOW-04).
- **D-13:** A corrected item shows "✓ Corrected". Clicking it opens the history popover: the original proposal, each revision with its timestamp, and the unchanged evidence.
- **D-14:** Rejected items sit in a collapsed "Rejected (n)" group under the review header, each with Restore. Restoring is the only way a rejected item returns.
- **D-15:** Evidence rule: every claim's text must be backed by at least one exact quote span, which Rust verifies as a verbatim substring (after normalization) of a finalized `transcript_evidence` segment. If verification fails, Telu abstains: the item isn't shown, the run records the skipped count, and the review header says "n possible items skipped — not enough evidence".
- **D-16:** An owner or due date without its own supporting span shows as "not stated" (weaker, dashed). The user fills it in through Correct. An accepted item keeps these fields empty and shows as unresolved (KNOW-06).

#### Deletion
- **D-17:** Deleting a meeting removes everything derived from it in one transaction: candidates, accepted items, revisions, reviews, evidence links and runs. The deletes are explicit, backed by a test asserting zero rows remain in every derived table; don't rely on the implicit foreign-key cascade default. — **Reversibility:** one-way — the data is destroyed.
- **D-18:** The confirm dialog shows counts first ("3 accepted items and 5 suggestions from this meeting will be removed from this Mac"), with default focus on Cancel. There's no undo in Phase 2. Cleanup of audio folders, run bundles and caches stays with HARD-02 (Phase 6).

### Claude's Discretion
- **Evaluation harness (KNOW-07):** the gold set comes from representative meetings, including insufficient-evidence and degraded-capture cases. Metrics are reported by item type: claim correctness, exact-span support, attribution, duplication and review outcome, with thresholds declared before evaluation (ROADMAP exit gate). Reuse Phase 1's run bundles and evaluation tables where they fit.
- Rust module and table names, prompt design, extraction provider and model choice within the existing route system, text-normalization and matching details, component file structure (kebab-case), and exact copy.
- How non-meeting screens (settings, model managers) sit inside the new shell, provided they use the tokens and pass visual regression.

### Deferred Ideas (OUT OF SCOPE)
- **Calendar detection and series from the calendar** (INTG-01, currently v2): the user wants this as core. It needs its own phase (roadmap update), which brings the Upcoming and Found in Calendar tabs.
- **The Island**: user-designated MUST feature from the redesign. Needs its own phase (it depends on brief and live data from Phases 3–4).
- **C's first-run onboarding** (calendar permission → choose what to remember → ⌥Space): arrives with calendar detection.
- **The Series tab and series living doc / Memory**: Phase 5.
- **Undo for deletion, and cleanup of audio folders, run bundles and caches**: HARD-02, Phase 6.
- **Transcript-level (partial) deletion**: not a feature today; later phase if needed.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KNOW-01 | Derive typed decisions, commitments/action items, open questions, relevant facts from a completed meeting | Extraction pipeline (Pattern 3), prompt/JSON contract (Code Examples), `Capability::Summary` route reuse, chunking by existing context budget |
| KNOW-02 | Stable identity, derivation run, review state, exact evidence opening the segment in context | `knowledge_items` (UUID) + `knowledge_runs` + review projection view + `knowledge_evidence_links` with raw char offsets; `list_evidence_by_meeting` read path; TranscriptDrawer highlight |
| KNOW-03 | Accept/correct/reject independently, immediate eligibility feedback | Append-only `knowledge_reviews`; each command returns the Rust-projected item view incl. `eligibility`; UI renders "Accepted · eligible" from the response |
| KNOW-04 | Corrections are auditable revisions linked to proposal + evidence | `knowledge_revisions` (immutable, `based_on_revision_id`), evidence links never re-pointed; history popover (D-13) |
| KNOW-05 | Rejected/superseded never reappear after regeneration/projection unless restored | Matcher against *all* revision texts + evidence overlap; `knowledge_suppressions` log; eligibility view excludes non-accepted; resurrection-rate = 0 invariant test |
| KNOW-06 | Abstain or expose unresolved fields | Verifier abstains (per-candidate `knowledge_abstentions` rows + run `skipped_count`); owner/due `support = not_stated`; "n possible items skipped" header |
| KNOW-07 | Evaluate by type: evidence coverage, exact-span correctness, attribution, duplication, review outcome | `telu-knowledge-eval` CLI (score/run modes), gold + label JSON formats, thresholds file committed before evaluation; claim correctness scored separately from citation support |
| KNOW-08 | Meeting/transcript deletion removes or invalidates dependent knowledge visibly | Explicit child-first deletes in `delete_meeting_with_transaction` + FK NO ACTION backstop + generic zero-row test; evidence-hash drift → `evidence_changed` status, not eligible |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

From `./CLAUDE.md` (project) and `~/.claude/CLAUDE.md` plus `~/.claude/rules/common/*.md` (user global):

- **The supported app is Tauri/Rust + Next.js only.** Never add endpoints to `backend/app/main.py` and never reintroduce the archived FastAPI backend. New frontend-facing behavior goes through Tauri commands and events under `frontend/src-tauri/src`.
- **Adding a command** means defining a `#[tauri::command]`, registering it in `tauri::generate_handler![…]` in `lib.rs`, and calling it with `invoke` from the frontend.
- **Rust errors** use `anyhow::Result` per the project convention. The existing repositories return `sqlx::Error`; follow the local file's style. Frontend errors use try/catch with user-friendly messages.
- **Logging:** logs carry module context. Use `perf_debug!`/`perf_trace!` on hot paths. Phase 1 adds a stricter rule: no transcript or candidate content in logs or evaluation exports (HARD-06 direction).
- **File paths** come from Tauri path APIs. Never hardcode them.
- **Naming:** audio sources are "microphone" and "system", never "input"/"output".
- **Code style (user global):** no comments (self-explanatory names). **kebab-case file names for all JS/TS/TSX.** Rust module files must remain snake_case because the language requires identifiers; flag this to the user if challenged. SOLID without over-engineering: no single-implementation interfaces, no speculative layers.
- **Immutability:** create new objects rather than mutating. This fits the append-only ledger and immutable React state.
- **File size:** 200–400 lines typical, 800 max. Functions under 50 lines. Nesting at most 4 levels. The 900-line `components/Sidebar/index.tsx` is replaced, not extended.
- **Testing:** TDD (RED → GREEN → refactor), 80% coverage, and unit + integration + E2E. Rust tests go inline `#[cfg(test)]` or in `src-tauri/tests/`. Frontend tests use `bun:test` in `frontend/tests/`.
- **Security:** validate at every boundary, never log secrets, keep error messages free of sensitive data, and never trust LLM output or file content.
- **Git:** `<type>: <description>` conventional commits (the repo also uses `docs(02): …` scopes).
- **Design:** load the `sketch-findings-telu-fyi` skill before any UI work. Its "Resolve before building" items and "What to Avoid" lists are binding, except where CONTEXT D-06/D-12..D-18 override the prototype.

## Standard Stack

### Core (already installed — verified versions)

| Library | Version (resolved) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tauri | 2.11.1 `[VERIFIED: Cargo.lock]` | Window config (`titleBarStyle`, `windowEffects`), commands, events | Built-in `windowEffects` means no extra vibrancy crate is needed; `window-vibrancy 0.6.0` is already a transitive dependency `[VERIFIED: Cargo.lock]` |
| sqlx (sqlite) | 0.8.6 `[VERIFIED: Cargo.lock]` | Migrations, transactions, in-memory tests | `foreign_keys` pragma defaults to ON `[VERIFIED: ~/.cargo/registry/src/…/sqlx-sqlite-0.8.6/src/options/mod.rs:183-185]` |
| framer-motion | 11.18.2 `[VERIFIED: node_modules]` | Motion presets incl. `visualDuration` springs | Skill's `motion.ts` targets this exact version |
| radix-ui (meta package) | 1.4.3 `[VERIFIED: node_modules]` | Includes `AlertDialog`, `Checkbox`, `Collapsible`, `ContextMenu`, `ToggleGroup` | **No new Radix installs needed**: `import { AlertDialog } from "radix-ui"` (pattern already used in `components/ui/accordion.tsx:5`) |
| sonner | 2.0.7 | Toasts (Undo, "Correction saved") | Skill mandates sonner |
| lucide-react | 0.469.0 | Icons via a local `Icon` wrapper | Skill icon map |
| tailwindcss | 3.4.19 | Token mapping | `extend.colors` deep-merges (verified below) |
| next | 14.2.35 (`output: 'export'`) | Static export: query-param routes only | Existing constraint |
| @tauri-apps/api | 2.11.0 | `invoke`, `listen`, `mocks` (`mockIPC`) | `mocks.js` is plain browser JS (read this session) |

### Supporting (Rust — add as direct deps; both already in Cargo.lock transitively)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| unicode-normalization | 0.1.25 `[VERIFIED: Cargo.lock + crates.io]` | NFKC before quote matching | Span verifier normalization |
| strsim | 0.11.1 `[VERIFIED: Cargo.lock + crates.io]` | Normalized Levenshtein / Jaro for text similarity in the matcher | Regenerate matching only, never for evidence verification |

### Supporting (dev — new)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @playwright/test | 1.63.0 (latest; pin one) `[WARNING: flagged as suspicious — verify before using.]` | WebKit screenshot gallery of every existing screen before/after the token migration | Visual regression for D-01; needs `npx playwright install webkit` (download) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tauri `windowEffects` config | `window-vibrancy` crate called in `setup` | Only needed for runtime material switching; config covers D-02 |
| Playwright WebKit | Manual screenshots of the real Tauri app | Real WKWebView fidelity, but not repeatable in CI. Keep as an end-of-phase human check |
| Prompt-only JSON | Provider JSON mode (`response_format`) | Ollama's OpenAI-compat endpoint supports `response_format` `[CITED: docs.ollama.com/api/openai-compatibility]`; Claude's Messages API has no equivalent in this client. Make it an optional hint; the Rust parser and verifier stay authoritative |
| New `Capability::Extraction` | Reuse `Capability::Summary` route | New variant touches serde enums, TS types and outbound evidence. Reuse is lower risk (see Pattern 3) |

**Installation:**
```bash
cd frontend/src-tauri && cargo add unicode-normalization@0.1.25 strsim@0.11.1
cd frontend && pnpm add -D @playwright/test@<pinned> && npx playwright install webkit
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| unicode-normalization | crates.io | 11 yrs (2015-04) | ~8.0M/wk | github.com/unicode-rs/unicode-normalization | [OK] | Approved (already transitive) |
| strsim | crates.io | 11 yrs (2015-02) | ~17.6M/wk | github.com/rapidfuzz/strsim-rs | [OK] | Approved (already transitive) |
| @playwright/test | npm | latest release 2026-09 ("too-new" signal is the release, not the package) | ~72M/wk | github.com/microsoft/playwright | [SUS] | Flagged — planner must add `checkpoint:human-verify` before install; pin a version at least a few weeks old; no postinstall script (`npm view … scripts.postinstall` empty) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** @playwright/test (the verdict comes from the latest publish date; the package itself is Microsoft's. Still gate it per protocol.)

## Architecture Patterns

### System Architecture Diagram

```
 Completed meeting (meetings.completeness)            User (shell: Today / Review / meeting page / peek)
        │                                                   │ Record ⌘R · Extract · Accept/Correct/Reject/Restore · Delete
        ▼                                                   ▼
 transcript_evidence (final, stable UUIDs) ──list_evidence_by_meeting──► Tauri commands (knowledge::commands)
        │                                                   │
        │                        ┌──────────────────────────┴───────────────┐
        │                        ▼                                          ▼
        │            start_extraction(meeting_id, expected_route)    review actions (append event / revision)
        │                        │                                          │
        │     gate: completeness ∈ {complete} or explicit user start       │
        │     route: validate_route_contract(expected, fresh) ─fail─► typed error, no I/O
        │                        ▼                                          │
        │     knowledge_runs INSERT (status=running, route snapshot,       │
        │                            input fingerprint)                     │
        │                        ▼                                          │
        ├──► chunk segments (label S1..Sn) ──► llm_client::generate_summary │
        │         (Capability::Summary, outbound ledger, cancel token)      │
        │                        ▼                                          │
        │     parse JSON ─malformed─► run failed (code), zero items        │
        │                        ▼                                          │
        └──► span verifier (NFKC + casefold + ws/quote/dash folding;       │
                  S-label → evidence_id; raw char offsets; min length)     │
                   │ fail → knowledge_abstentions (+skipped_count)         │
                   ▼ pass                                                   │
             matcher vs existing items (type, all revision texts,          │
                   evidence overlap) ──rejected/superseded──► suppression   │
                   │                 ──accepted──► reconfirmed link         │
                   │                 ──pending──► duplicate link            │
                   ▼ unmatched                                              │
             knowledge_items + knowledge_evidence_links (immutable)        │
                   ▼                                                        ▼
             run → succeeded (counts)          knowledge_reviews / knowledge_revisions (append-only)
                   │                                                        │
                   └────────────► knowledge_item_current VIEW ◄────────────┘
                                   (state, latest revision, evidence_status)
                                            │
                    emit "knowledge-updated" { meetingId, runId }
                                            ▼
             React: ReviewHead · CandidateRow · Rejected(n) · History popover · TranscriptDrawer
             Phase 3–5 readers: eligible = accepted ∧ evidence_status = valid ∧ meeting exists

 Delete meeting ─► knowledge_deletion_impact (counts) ─► Alert (focus Cancel) ─► delete_meeting_with_transaction
                   (cancel active extraction; explicit child-first deletes; FK NO ACTION backstop; commit)
```

### Recommended Project Structure

```
frontend/src-tauri/
├── migrations/20260927000100_phase2_knowledge.sql     # tables, triggers, view, indexes
├── src/knowledge/
│   ├── mod.rs
│   ├── models.rs            # KnowledgeType, ReviewState, EvidenceStatus, DTOs (serde camelCase)
│   ├── repository.rs        # inserts, append events, projections, eligibility, deletion-impact counts
│   ├── normalize.rs         # normalize_with_map (NFKC, casefold, folding) → (String, Vec<usize>)
│   ├── span_verifier.rs     # verify quote against labeled segments → EvidenceLink | Abstention
│   ├── matcher.rs           # candidate vs existing items → Match { Suppressed | Reconfirmed | Duplicate | New }
│   ├── prompt.rs            # system prompt, segment labelling, chunk windows, prompt_version const
│   ├── parse.rs             # tolerant JSON extraction + typed validation (limits)
│   ├── extraction.rs        # run orchestration (route, chunks, verify, match, persist, events)
│   └── commands.rs          # tauri commands
├── src/database/repositories/transcript.rs   # + list_evidence_by_meeting
├── src/database/repositories/meeting.rs      # delete: explicit knowledge deletes + impact
├── src/bin/telu-knowledge-eval.rs            # KNOW-07 harness (score | run)
└── tests/
    ├── knowledge_deletion.rs                 # generic zero-rows-in-every-meeting_id-table test
    └── fixtures/knowledge-eval/              # synthetic gold fixtures + thresholds-v1.json

frontend/src/
├── lib/motion.ts                  # skill's EASE/SPRING/DURATION/PRESET
├── lib/knowledge-service.ts       # typed invoke wrappers
├── components/app-shell/          # app-shell.tsx, sidebar.tsx, sidebar-nav-item.tsx, agenda-toolbar.tsx, doc-toolbar.tsx, recording-capsule.tsx, recording-host.tsx
├── components/agenda/             # today-view.tsx, event-card.tsx, day-stepper.tsx
├── components/living-doc/         # meeting-page.tsx, meeting-body.tsx, review-head.tsx, candidate-row.tsx, rejected-group.tsx, history-popover.tsx, transcript-drawer.tsx, source-chip.tsx, evidence-popover.tsx
├── components/side-peek/          # side-peek.tsx
└── components/telu-ui/            # button.tsx, glass-group.tsx, chip.tsx, alert.tsx … (Telu variants over Radix)
frontend/tests/visual/             # playwright.config.ts, tauri-ipc-stub.js, fixtures/*.json, screens.spec.ts
```

### Suggested Wave Order (planner's call; config granularity is `coarse`)

| Wave | Track A: Rust knowledge | Track B: UI |
|---|---|---|
| 0 | Test scaffolds: knowledge fixtures, generic deletion-residue test (RED) | Playwright WebKit + IPC stub spike; "before" screenshot gallery of every existing screen (checkpoint: install) |
| 1 | Migration + triggers + view; `list_evidence_by_meeting`; normalizer/verifier; matcher; deletion transaction + impact counts | Token/font/Tailwind migration + Telu primitives + grep gate + re-skin of all screens; `motion.ts` (checkpoint: human review of the after-gallery, dark-mode go/no-go) |
| 2 | Extraction orchestration + commands + events; shared summary dispatch resolver | Window chrome + shell (sidebar Today/Review, toolbars) + recording host move (all Phase 1 behaviors retested) |
| 3 | — | Meeting page (living doc) + side peek + Knowledge section, ReviewHead, CandidateRow, Rejected(n), history popover, EvidencePopover, TranscriptDrawer, delete Alert |
| 4 | `telu-knowledge-eval` + synthetic fixtures + thresholds commit (checkpoint: user declares quality thresholds) → evaluation run | End-of-phase human verification on a `tauri build` artifact (vibrancy, drag, traffic lights, ⌘R, deletion copy) |

### Pattern 1: Append-only ledger with an immutable-row trigger and a projection view

**What:** Items, evidence links, revisions and reviews are INSERT-only. `BEFORE UPDATE` triggers enforce this. **Do not add `BEFORE DELETE` triggers**, because D-17 deletion must work. Runs may update only while `status = 'running'`. Current state is derived from the latest review event.

**When:** Every table the eligibility contract depends on (D-08 and D-12 are one-way decisions).

**Example (schema sketch; the names are Claude's discretion):**
```sql
CREATE TABLE knowledge_runs (
    run_id TEXT PRIMARY KEY NOT NULL,
    meeting_id TEXT NOT NULL REFERENCES meetings(id),
    trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('auto','user','regenerate')),
    status TEXT NOT NULL CHECK (status IN ('running','succeeded','failed','cancelled')),
    provider_id TEXT NOT NULL, model_id TEXT NOT NULL,
    location_class TEXT NOT NULL CHECK (location_class IN ('local','lan','remote')),
    sanitized_origin TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    meeting_completeness_at_start TEXT NOT NULL,
    input_evidence_count INTEGER NOT NULL CHECK (input_evidence_count >= 0),
    input_fingerprint TEXT NOT NULL,
    proposed_count INTEGER NOT NULL DEFAULT 0, skipped_count INTEGER NOT NULL DEFAULT 0,
    suppressed_count INTEGER NOT NULL DEFAULT 0, reconfirmed_count INTEGER NOT NULL DEFAULT 0,
    failure_code TEXT, started_at_utc TEXT NOT NULL, finished_at_utc TEXT
);
CREATE TRIGGER knowledge_runs_frozen BEFORE UPDATE ON knowledge_runs
WHEN OLD.status <> 'running' BEGIN SELECT RAISE(ABORT, 'knowledge_runs row is final'); END;

CREATE TABLE knowledge_items (
    item_id TEXT PRIMARY KEY NOT NULL,
    meeting_id TEXT NOT NULL REFERENCES meetings(id),
    origin_run_id TEXT NOT NULL REFERENCES knowledge_runs(run_id),
    item_type TEXT NOT NULL CHECK (item_type IN ('decision','commitment','question','fact')),
    text TEXT NOT NULL CHECK (length(trim(text)) > 0),
    owner_text TEXT, owner_support TEXT NOT NULL CHECK (owner_support IN ('stated','not_stated')),
    due_text TEXT,   due_support   TEXT NOT NULL CHECK (due_support IN ('stated','not_stated')),
    normalized_key TEXT NOT NULL,
    created_at_utc TEXT NOT NULL
);
CREATE TRIGGER knowledge_items_immutable BEFORE UPDATE ON knowledge_items
BEGIN SELECT RAISE(ABORT, 'knowledge_items is append-only'); END;
```
Every knowledge table carries `meeting_id`, including links, reviews, revisions, suppressions and abstentions. This lets the generic deletion test (Pattern 5) discover them automatically. `meeting_id` in the enum/`CHECK` values above is `[ASSUMED]` naming. The `location_class` values mirror the Rust serde values `Local, Lan, Remote` → snake_case `local, lan, remote` `[VERIFIED: frontend/src-tauri/src/trust/provider_route.rs:19-25]`, quoted: `pub enum LocationClass { Local, Lan, Remote, }` with `#[serde(rename_all = "snake_case")]`.

Review events: `knowledge_reviews(review_id, meeting_id, item_id, sequence, action CHECK IN ('accept','correct','reject','restore','reopen'), revision_id NULL, created_at_utc, UNIQUE(item_id, sequence))`. The projection maps: no event → `proposed`; `accept`/`correct` → `accepted`; `reject` → `rejected`; `restore`/`reopen` → `proposed`. `correct` = insert revision + review event in **one transaction**, and it implies accepted (002: "✓ Corrected · in Memory" → here "✓ Corrected · Accepted · eligible"). `reopen` backs the sonner Undo on Accept: an appended event, never a delete. It is Claude's discretion; drop it if Undo is cut.

### Pattern 2: Verbatim-span verification with a normalization index map

**What:** Normalize the segment text and the quote with the same function. Keep a `Vec<usize>` mapping each normalized char back to its raw char index, find the quote, and store raw `[start, end)` offsets plus the model's quote, the normalized quote and `sha256(raw segment text)`.

**Normalization (deterministic, unit-tested):** NFKC → Unicode lowercase → map `‘’‚‛“”„` to `'`/`"` and `–—‑−` to `-` → collapse all whitespace runs to one space → trim. Also strip leading/trailing punctuation from the *quote* only. **Do not** strip interior punctuation or stem words: that turns "verbatim" into fuzzy matching.

**Rules:**
- Quote minimum: ≥ 3 words **and** ≥ 12 normalized chars. Shorter fragments ("yes", "ok let's do it") match anywhere and prove nothing. Tune on fixtures and record the constant in `prompt_version`.
- The segment label must exist in the chunk the model saw. Unknown labels mean abstention (`unknown_segment`).
- **Cross-segment quotes:** transcription chunk boundaries cut sentences, so allow a quote to match inside the concatenation of **up to 2 consecutive segments** (joined with one space). Store one link per covered segment with its own offsets.
- Owner/due: `owner_support = 'stated'` only if the owner has its own verified span **and** `normalize(owner_text)` is a substring of that span. Otherwise store `not_stated` with `owner_text = NULL` (D-16). Store due dates **verbatim as stated** ("by Friday"). Never resolve them to calendar dates, because that is inference.
- Evidence rows whose `capture_completeness = 'incomplete'` may be cited but are flagged on the link (`segment_capture_incomplete = 1`) so the UI and the evaluation can show degraded support.

**Re-verification on read (KNOW-08):** `evidence_status` for an item is `valid` if every claim link's evidence row still exists **and** its current `sha256(transcript)` equals the stored hash, or the stored normalized quote is still found at any offset. It is `changed` if the quote is no longer present, and `missing` if the evidence row is gone. Only `valid` + `accepted` is eligible. Why this is needed: `upsert_final_evidence` rewrites text on redelivery. `[VERIFIED: frontend/src-tauri/src/database/repositories/transcript.rs:26-41]` quoted: `ON CONFLICT(evidence_id) DO UPDATE SET sequence = excluded.sequence, transcript = excluded.transcript, audio_start_time = excluded.audio_start_time, audio_end_time = excluded.audio_end_time, capture_completeness = excluded.capture_completeness, updated_at = excluded.updated_at`. This agrees with Phase 1 D-11 ("Re-delivery updates or no-ops the same evidence record").

### Pattern 3: Extraction orchestration through the existing summary route

**What:** `start_extraction(meeting_id, expected_route: EffectiveRoute, trigger)` runs these steps:
1. Load the meeting and check `lifecycle`/`completeness`. `complete` → allowed. `incomplete`/`recovered_with_gaps` → allowed only when `trigger = user` (D-09). `legacy`/`completion_not_verified`, or zero evidence rows → typed error `KNOWLEDGE_NO_EVIDENCE`.
2. Resolve the fresh Summary route and call `validate_route_contract(&expected, &fresh)`. On failure return the typed `ProviderRouteError` with no I/O (Phase 1 D-19).
3. Insert the run row (`running`, route snapshot, `input_fingerprint = sha256(ordered evidence_id ‖ sha256(text))`).
4. Chunk and call `llm_client::generate_summary`, which already does `authorize_provider_dispatch` + outbound ledger + cancellation for `Capability::Summary`, as `[VERIFIED: frontend/src-tauri/src/summary/llm_client.rs:308-348]` shows. The signature is `generate_summary(client, meeting_id, provider, model_name, api_key, system_prompt, user_prompt, ollama_endpoint, custom_openai_endpoint, max_tokens, temperature, top_p, app_data_dir, cancellation_token)`.
5. Parse → verify → match → persist in one transaction per run finalization.
6. Emit `knowledge-updated`.

**Why Summary, not Generation:** `configured_route` returns `not_configured` for `Generation` `[VERIFIED: frontend/src-tauri/src/trust/provider_route.rs:373-383]`, quoted: `Capability::DocumentProcessing | Capability::Generation | Capability::Analytics | Capability::Updater => { return Err(ProviderRouteError::unavailable(capability, "not_configured", "not_configured", None,)); }`. The user's configured Summary model is the only LLM route that exists. The UI must say "Knowledge extraction uses your Summary model · Local · This device" (or LAN/Remote with the origin) before the call.

**Provider/key plumbing:** `process_transcript_background` duplicates API-key/Ollama/custom-endpoint loading inline (`summary/service.rs:356-463`). Extract a small `resolve_summary_dispatch(pool, provider, model) -> SummaryDispatch` function and reuse it from both paths rather than copying. This is a behavior-preserving refactor; bracket it with the existing summary tests.

**Chunking:** Reuse the context budgets the summary path already computes: Ollama from metadata minus 300, BuiltInAI from `context_size` minus 300 (every built-in model is `context_size: 32768` `[VERIFIED: frontend/src-tauri/src/summary/summary_engine/models.rs:168-213]`), and cloud 100000. Reserve about 2,000 tokens for output. Window by **whole segments**, never split a segment, with a 2-segment overlap. Duplicates across windows are resolved by the same matcher (they count toward the duplication metric).

**Cancellation:** Use a separate registry keyed `knowledge:{meeting_id}` (the summary registry is keyed by meeting id and would cancel the summary). Delete and regenerate cancel the active run first.

**Meeting deleted mid-run:** inserts fail with an FK error once the meeting row is gone. Map `FOREIGN KEY constraint failed` or meeting-not-found to `cancelled` quietly, not to a user-facing failure.

### Pattern 4: Regenerate matching (D-11)

Match a verified candidate `c` to an existing item `i` of the **same type** in the same meeting when:
- `normalized_key(c)` equals `normalized_key` of `i`'s original text **or of any of its revisions**, or
- `c` shares at least one claim `evidence_id` with `i` **and** `normalized_levenshtein(c.text, any_text(i)) ≥ T_sim`. Start at T_sim = 0.6 and tune on fixtures. `[ASSUMED]` starting value.

Disposition by `i`'s projected state:
- `rejected` → suppressed (reason `matched_rejected`)
- `accepted` → reconfirmed link (not shown)
- `proposed` → duplicate link (not shown, no new item)
- no match → new item

Every non-new outcome writes a `knowledge_suppressions` row `(run_id, meeting_id, matched_item_id, reason, candidate_normalized_key, candidate_text)`, which is the audit trail. The bias is deliberate: a false match only hides a new item, while a missed match resurrects a rejected one, which is a stop condition. The evaluation treats **resurrection rate = 0** as a hard invariant.

"Superseded" in Phase 2 means an earlier *revision* wording of a corrected item. Matching against all revision texts is what keeps regenerate from re-proposing the wording the user corrected away. Item-level `superseded`/`disputed` states belong to Phase 5 (SERIES-04/05); do not add them now.

### Pattern 5: Deletion transaction + generic residue test (D-17, KNOW-08)

- Extend `delete_meeting_with_transaction` (`[VERIFIED: frontend/src-tauri/src/database/repositories/meeting.rs:1190-1231]`, which today deletes only `transcript_chunks`, `summary_processes`, `transcripts`, `meetings`) with explicit child-first deletes: `knowledge_reviews` → `knowledge_revisions` → `knowledge_evidence_links` → `knowledge_suppressions` → `knowledge_abstentions` → `knowledge_items` → `knowledge_runs`. Then add explicit deletes for the Phase 1 tables too (`meeting_notes`, `meeting_finalization_gaps`, `meeting_finalizations`, `evaluation_*` child tables → `evaluation_runs`, `transcript_evidence`) so no table relies on cascade.
- New knowledge FKs use the default **NO ACTION** (no `ON DELETE CASCADE`). Because sqlx turns `foreign_keys` ON, a forgotten delete makes the meeting delete fail and roll back, so the test catches it instead of production silently keeping rows. Evidence links reference `transcript_evidence(evidence_id)` with NO ACTION, so links must be deleted before evidence.
- **Generic test:** after deleting a fully populated meeting (evidence, runs, items, reviews, revisions, suppressions, abstentions, eval rows), enumerate tables with a `meeting_id` column and assert zero rows for that id:
  ```sql
  SELECT m.name FROM sqlite_master m JOIN pragma_table_info(m.name) p
  WHERE m.type = 'table' AND p.name = 'meeting_id';
  ```
  Also assert a second meeting's rows are untouched (no cross-meeting deletes).
- `knowledge_deletion_impact(meeting_id) -> { accepted, suggestions, rejected, runs }` feeds D-18's copy. Copy must not claim audio files are removed (HARD-02 is deferred).

### Pattern 6: Token migration as one atomic change with a mechanical gate

- Replace both shadcn `@layer base` blocks in `globals.css` and repoint `tailwind.config.js` **in the same commit**, using the skill's paste-ready block. The current config wraps everything in `hsl(var(--x))` (e.g. `background: 'hsl(var(--background))'`, `accent: { DEFAULT: 'hsl(var(--accent))' … }`) `[VERIFIED: frontend/tailwind.config.js]`, so a Telu hex in `--accent` renders as invalid `hsl(#6366E8)`.
- Keep a `--radius`/`lg|md|sm` mapping (195 `rounded-lg|md|sm` uses) or map `borderRadius.lg` → `var(--r-control)`. Otherwise shadcn primitives lose their radii.
- `extend.colors` **deep-merges** with Tailwind's palette: overriding `amber` leaves `amber-50…950` available `[VERIFIED: tailwind resolveConfig run this session → "50,100,…,950,DEFAULT,soft"]`. The 1,072 hard-coded palette classes will therefore still compile and silently bypass tokens. Add a **grep gate** (bun test or CI script) that fails on `(bg|text|border|ring|from|to|via|fill|stroke)-(gray|slate|zinc|neutral|stone|blue|red|green|yellow|amber|orange|indigo|purple|pink|emerald|teal|sky|cyan|violet|rose|lime)-\d{2,3}` and `hsl\(var\(` under `src/`. Allow an explicit allow-list only for fixed brand hex (file badges, traffic lights).
- `accent` changes meaning from "pale highlight" to Telu Indigo. The 19 uses (`focus:bg-accent`, `hover:text-accent-foreground`, `data-[state=open]:bg-accent`, …) in `components/ui/{dialog,command,button,select,dropdown-menu}.tsx` must be restyled to the Telu variants (skill: primitives-and-overlays.md), or hover turns fully indigo with white text.
- Fonts: delete `next/font/google` `Source_Sans_3` from `layout.tsx`. This also removes a build-time network fetch in a static export, a privacy win. Set `fontFamily.sans` to the SF stack.
- Theme: `tauri.conf.json` forces `"theme": "Light"` `[VERIFIED: frontend/src-tauri/tauri.conf.json:20]`. For light+dark tokens, remove it and toggle `.dark` on `<html>` from `matchMedia('(prefers-color-scheme: dark)')`, with no transition on `:root`. **Decision needed:** if dark mode is not in the Phase 2 acceptance bar, keep `Light` and ship dark tokens unused. Otherwise every hard-coded `gray-*` must go (see Open Questions).

### Pattern 7: Window chrome (D-02)

```json
{
  "label": "main",
  "title": "Telu",
  "titleBarStyle": "Overlay",
  "hiddenTitle": true,
  "trafficLightPosition": { "x": 20, "y": 20 },
  "decorations": true,
  "transparent": true,
  "windowEffects": { "effects": ["sidebar"], "state": "followsWindowActiveState" }
}
```
- These keys and values exist in the installed schema `[VERIFIED: frontend/node_modules/@tauri-apps/cli/config.schema.json (CLI 2.11.1)]`. `TitleBarStyle` enum: `"Visible" | "Transparent" | "Overlay"`. `trafficLightPosition`: "Requires titleBarStyle: Overlay and decorations: true". `windowEffects`: "Requires the window to be transparent". `WindowEffect` includes `"sidebar"` (macOS 10.11+). `WindowEffectState`: `"followsWindowActiveState" | "active" | "inactive"`. `transparent` on macOS needs `macOSPrivateApi`, which is already `true` (`tauri.conf.json:24`).
- **Drag region needs a permission.** `core:window:default` does *not* include `allow-start-dragging`. `[VERIFIED: ~/.cargo/registry/src/…/tauri-2.11.1/permissions/window/autogenerated/reference.md:1-34]`, whose default list ends `… allow-is-always-on-top, allow-activity-name, allow-scene-identifier, allow-internal-toggle-maximize` with no start-dragging. Add `"core:window:allow-start-dragging"` to the `main` capability. `data-tauri-drag-region` works only on the element it's set on (not children) `[CITED: v2.tauri.app/learn/window-customization]`, so put it on the toolbar and on each spacer/title element, not on buttons.
- The webview `html, body` must be transparent for the material to show. The main column paints `--content-bg`; the sidebar paints `--sidebar` at alpha 0.6 over the native material.
- Traffic-light inset: tao 0.35.2 re-applies the inset on every `draw_rect` `[VERIFIED: ~/.cargo/registry/src/…/tao-0.35.2/src/platform_impl/macos/view.rs:341-349]`, so resize resets that older Tauri versions had should not recur. Still verify fullscreen enter/exit on device.
- Known risk: tauri#13415 (open) reports transparency lost in DMG builds on 2.5.1 `[CITED: github.com/tauri-apps/tauri/issues/13415]`. **Verify on a `tauri build` artifact, not only `tauri dev`.**
- Close = hide already exists (`lib.rs:604-614`, `CloseRequested` → `prevent_close` + `hide`).

### Pattern 8: Recording host moves to the shell, once

`app/page.tsx` owns `useRecordingStart`, `useRecordingStop`, `useRecordingStateSync`, `useTranscriptRecovery`, `StatusOverlays` and `TranscriptRecovery` today. Move them into **one** shell-level `recording-host.tsx` mounted in the layout (inside the existing providers), so recording, stop/finalization progress and recovery survive navigation between Today, the peek, the meeting page and settings.
- Delete the page-level mounts in the same change. Double-mounted hooks mean duplicate `listen` handlers (duplicate toasts, double stop).
- ⌘R: one `keydown` handler in the shell (`metaKey && key === 'r'`, `preventDefault`) that calls the same start/stop functions as the button. It animates like a click (skill motion rule 1: state-changing keyboard commands animate). The tray's `request-recording-toggle` → `start-recording-from-sidebar` window event path (`layout.tsx`) must keep working. Rename it only if every emitter changes too.
- `StatusOverlays` navigates to `/meeting-details?id=…` after finalization, and so do `useRecordingStop` and `TranscriptRecovery`. **Keep that route as the living-doc meeting page** so every Phase 1 deep link still resolves.

### Pattern 9: Evaluation harness (KNOW-07) as an offline CLI

**Why not the Phase 1 evaluation tables:** they are content-free and one run per meeting (`meeting_id TEXT NOT NULL UNIQUE`, and the header comment "deliberately have no transcript, audio, secret, request/response body, or sensitive path columns") `[VERIFIED: frontend/src-tauri/migrations/20260920000400_phase1_evaluation_runs.sql:1-15]`. Gold labels need content. Reuse the Phase 1 **patterns** instead: the `src/bin/telu-baseline.rs` clap CLI + `tests/baseline_matrix.rs` integration-test shape (`env!("CARGO_BIN_EXE_…")`), a 32 MiB input cap, and the run-bundle discipline of atomic writes, validation before publish, and content-free outputs.

**`telu-knowledge-eval` subcommands:**
- `run --gold-dir <dir> --out <dir>` feeds each fixture's segments through the *same* `knowledge::{prompt,parse,span_verifier,matcher}` functions with the configured Summary route. It writes `predictions.json` holding items, abstentions with reason codes, and duplicate/suppression links. This mode needs a provider and the user's consent for remote routes.
- `score --gold-dir <dir> --predictions <file> --labels <file> --thresholds <file> --out <dir>` is deterministic and offline, so it can run in CI on synthetic fixtures.

**Fixture format (gold):** `{ fixtureId, category: "representative"|"insufficient_evidence"|"degraded_capture", segments:[{id, start, end, text, captureCompleteness}], gold:[{goldId, type, text, evidenceSegmentIds:[…], owner|null, due|null}], expectAbstain: bool }`.

**Labels (human, per predicted item):** `{ predId: { matchesGoldId|null, claimCorrect: bool, quoteSupportsClaim: bool, ownerCorrect: bool|null, dueCorrect: bool|null } }`. Claim correctness and semantic support are labeled **separately** (roadmap stop condition).

**Metrics, reported per item type and overall:**

| Metric | Definition | Source |
|---|---|---|
| Claim correctness | `claimCorrect` / shown items | labels |
| Semantic support | `quoteSupportsClaim` / shown items | labels |
| Exact-span support | shown items whose every claim link re-verifies verbatim / shown items (expected 100% by construction; any miss is a bug) | automatic |
| Raw grounding rate | model items passing verification / all model items (before abstention) | automatic |
| Evidence coverage | gold items with ≥1 predicted item citing a gold evidence segment / gold items | automatic |
| Attribution | owner and due correct, including correct "not stated" / items with gold owner or due | labels + automatic |
| Duplication | within-run duplicate links / shown items; **cross-run resurrection of rejected items (must be 0)** | automatic (replay: reject → regenerate) |
| Abstention | on `insufficient_evidence` fixtures: runs with zero shown items or only unresolved fields / fixtures | automatic |
| Degraded capture | the same metrics restricted to `degraded_capture` fixtures, with links on incomplete segments flagged | automatic |
| Review outcome | accept / correct / reject / pending rates by type from `knowledge_reviews` (optional `--db`, counts only) | local DB |

**Thresholds before evaluation:** `tests/fixtures/knowledge-eval/thresholds-v1.json` is committed in its own commit **before** any `score` run that counts toward the exit gate. The report records its sha256 and the git commit. Deterministic invariants are fixed now: exact-span support = 1.0, resurrection = 0, deletion residue = 0. Quality thresholds (claim correctness, coverage, attribution, abstention) are **declared by the user** from pilot evidence (A9). Research does not set these numbers. The planner needs a `checkpoint:decision` for them.

### Anti-Patterns to Avoid

- **Letting the model emit `evidence_id` UUIDs or char offsets:** it will hallucinate them. Use `S`-labels; Rust owns ids and offsets.
- **Storing a single `state` column updated in place:** violates D-08/D-12. Use append events + a view.
- **`ON DELETE CASCADE` on the new tables:** hides missed deletes, which D-17 explicitly rejects.
- **`BEFORE DELETE` immutability triggers:** would break meeting deletion.
- **Fuzzy (similarity) evidence verification:** "after normalization" means exact substring. Fuzziness belongs only in the regenerate matcher.
- **Inferring owners from "I'll do it":** `source_track` is always `"mixed"` `[VERIFIED: frontend/src-tauri/src/audio/transcription/worker.rs:378]` (quoted: `let source_track = "mixed".to_string();`), so there is no speaker identity. Such items are `owner not stated`.
- **Rendering LLM/transcript text as HTML:** plain React text nodes only. `app/notes/[id]/page.tsx:174` uses `dangerouslySetInnerHTML`; never copy that pattern into knowledge UI (Tauri IPC is reachable from the webview).
- **Pasting Telu tokens next to shadcn HSL vars,** and naming keyframes `enter`/`exit` (reserved by tailwindcss-animate), are both warned against in the skill.
- **Animating keyboard navigation** (↑/↓ peek swaps, ←/→ day steps, Esc/⌘[): the skill says these must be instant.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unicode normalization | Custom char tables | `unicode-normalization` NFKC | Ligatures, full-width, compatibility forms |
| String similarity for matching | Custom edit distance | `strsim::normalized_levenshtein` | Correct, fast, already in the lockfile |
| Route validation + outbound ledger | New HTTP client for extraction | `llm_client::generate_summary` (+ shared dispatch resolver) | Phase 1 privacy guarantees and tests already cover it |
| Transactions/migrations | Manual `BEGIN`/versioning | `sqlx::migrate!` + `pool.begin()` | Existing pattern; in-memory tests via `sqlx::migrate!` |
| Popover/Alert/Checkbox/Collapsible/ContextMenu/ToggleGroup | Custom primitives | `radix-ui` 1.4.3 meta package (installed) | Focus management, Esc, `aria-*` |
| Toasts with Undo | Custom toast | sonner | Skill mandates it |
| Vibrancy | NSVisualEffectView FFI | Tauri `windowEffects` | Built in since Tauri 2 |
| IPC stubbing for screenshots | Ad-hoc `window.invoke` hacks | A copy of `mockIPC` logic from `@tauri-apps/api/mocks` injected with `page.addInitScript` | Uses the real `__TAURI_INTERNALS__.invoke/transformCallback` contract the app calls |
| JSON extraction from LLM text | Regex field scraping | Locate the outermost `{…}`, `serde_json::from_str` into typed structs, then validate | Typed limits, exact errors |

**Key insight:** in this domain the dangerous failures are *plausible-looking* outputs: a fluent claim with a near-miss quote, a resurrected rejected item, a cascade that "usually" works. Every guard must be deterministic Rust code with a unit test. Never make it a prompt instruction the model may ignore.

## Runtime State Inventory

This phase migrates the schema, the design system and the recording UX.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing meetings: legacy rows (`lifecycle='legacy'`, `completion_not_verified`) and imported/retranscribed meetings write only legacy `transcripts` (`audio/import.rs:723`, `audio/retranscription.rs:445`), so they have **no `transcript_evidence`**. New knowledge tables start empty; no backfill. | Code: extraction returns `KNOWLEDGE_NO_EVIDENCE` and the UI says why. No data migration. |
| Live service config | None. There are no external services with Telu state. Provider settings live in SQLite `settings` and are unchanged. | None |
| OS-registered state | The main window's config changes (Overlay, transparent, effects). macOS may restore the saved window frame; there is no `tauri-plugin-window-state`. Tray (`tray.rs`) unchanged. | Verify first launch after upgrade on device; no re-registration |
| Secrets/env vars | None renamed. API keys stay in `settings`. | None |
| Build artifacts | `frontend/out/` (stale static export), `.next/` cache holding the Source Sans font download, Playwright WebKit binary (new, per machine) | `pnpm build` regenerates; add `npx playwright install webkit` to the Wave 0 setup |
| Browser storage | IndexedDB transcript mirrors (Phase 1 recovery) and `localStorage` beta flags/sidebar state | Deletion of these stays with HARD-02. Sidebar collapsed-state keys become dead when the old sidebar is removed; remove their reads |

## Common Pitfalls

### Pitfall 1: Verified quote, unsupported claim
**What goes wrong:** The quote is verbatim, but the claim says more than the quote ("We decided to ship Friday" from "maybe Friday?").
**Why:** Exact-span support ≠ semantic support. The roadmap stop condition forbids conflating them.
**How to avoid:** Keep the claim-correctness and "quote supports claim" labels as **separate human-labeled metrics** in the evaluation. Prompt for the shortest self-contained quote that states the claim. Questions must quote a question.
**Warning signs:** High exact-span rate with a low accept rate or a high correct rate in review outcomes.

### Pitfall 2: Small local models emit malformed or partial JSON
**What goes wrong:** Qwen/Gemma 1–4B wrap JSON in prose or code fences, truncate, or emit `<think>` blocks.
**How to avoid:** `generate_summary` already separates reasoning (`LlmCompletion.reasoning_stripped`). Strip fences, take the outermost `{…}`, parse typed structs, and cap items per chunk (e.g. 40) and text length (e.g. 400 chars). One malformed chunk fails *that chunk* with a code recorded on the run. Never guess.
**Warning signs:** `failure_code = MALFORMED_OUTPUT` rate per model in the evaluation.

### Pitfall 3: Evidence text changes after verification
**What goes wrong:** Redelivery or recovery rewrites `transcript_evidence.transcript`, so an "accepted · eligible" item now cites words that aren't there.
**How to avoid:** Store the text hash on the link and re-verify on read (Pattern 2). `changed`/`missing` → not eligible, with a visible "Evidence changed" state.

### Pitfall 4: Chunk-boundary quotes
**What goes wrong:** A decision spans two transcription chunks, so the quote fails and the item abstains.
**How to avoid:** Cross-segment matching over at most 2 consecutive segments, plus a segment overlap between LLM windows.

### Pitfall 5: Regenerate resurrects a corrected item's old wording
**How to avoid:** Match against the original text **and every revision**. Test: correct → regenerate with the original wording → assert suppression row and no new item.

### Pitfall 6: Double-mounted recording hooks after the shell move
**What goes wrong:** Hooks live in both the old page and the new shell, so there are two `listen` subscriptions: duplicate toasts, double stop, double navigation.
**How to avoid:** Remove the page mounts in the same change. Add a bun test that renders the shell and asserts one subscription per event name (mock `listen`).

### Pitfall 7: Token migration looks fine in light mode, breaks in dark
**What goes wrong:** Hard-coded `bg-white`/`text-gray-900` ignore `.dark`.
**How to avoid:** The grep gate plus a dark-mode pass of the screenshot gallery (`colorScheme: 'dark'` in Playwright).

### Pitfall 8: Overlay title bar steals clicks or can't drag
**What goes wrong:** Drag region on a parent doesn't propagate, the permission is missing, and buttons inside the drag region can't be clicked.
**How to avoid:** Add `core:window:allow-start-dragging`. Put the attribute only on non-interactive toolbar surfaces. The toolbar's left inset must clear the traffic lights (≈ 78px + inset). Note: an unfocused Overlay window can't be dragged (the schema description links tauri#4316).

### Pitfall 9: Search and meeting page still read legacy `transcripts`
**What goes wrong:** `api_search_transcripts` joins `transcripts` only, and `get_meeting_transcripts_paginated` reads `transcripts` (`meeting.rs:530-538`). Canonical meetings look empty or unsearchable.
**How to avoid:** The new meeting page and TranscriptDrawer read `list_evidence_by_meeting`. Search must also query `transcript_evidence` (escape `%`/`_` in `LIKE` input).

### Pitfall 10: Extraction starts on a meeting that is still finalizing
**How to avoid:** Rust re-checks lifecycle/completeness inside `start_extraction`. Never trust the React gate alone.

### Pitfall 11: FK failure mid-run after deletion
**How to avoid:** Cancel the active run before deleting. Map FK/meeting-missing errors during run persistence to `cancelled`.

### Pitfall 12: Screenshot flakiness
**What goes wrong:** Time-dependent text (timers, "Today"), animations, and font rendering differences.
**How to avoid:** Freeze `Date` in the init script, use `animations: 'disabled'`, a stylePath that hides live timers, and a fixed viewport. Baselines are per browser+OS (`*-webkit-darwin.png`) `[CITED: playwright.dev/docs/test-snapshots]`.

## Code Examples

### Prompt contract (Rust `prompt.rs`; wording is Claude's discretion)
```text
SYSTEM:
You extract meeting knowledge from a transcript. Output JSON only, no prose.
Types: "decision" (something agreed), "commitment" (someone will do something),
"question" (asked and not answered in the transcript), "fact" (a stated fact relevant later).
Rules:
- Every item needs at least one evidence entry: {"segment": "<label>", "quote": "<exact words copied from that segment>"}.
- Copy quotes character for character. Never paraphrase inside "quote".
- "owner"/"due" only when the words name them; give their own segment and quote. Otherwise null.
- Never guess who "I" or "we" is.
- If nothing qualifies, return {"items": []}.
Schema: {"items":[{"type":"...","text":"...","evidence":[{"segment":"S3","quote":"..."}],
"owner":{"value":"...","segment":"S4","quote":"..."}|null,"due":{"value":"...","segment":"S4","quote":"..."}|null}]}

USER:
[S1 00:00] ...
[S2 00:07] ...
```
The line prefix `[S{n} {mm:ss}]` comes from `audio_start_time`. The Rust map `S{n} → evidence_id` is built per chunk.

### Normalization with an index map
```rust
use unicode_normalization::UnicodeNormalization;

pub fn normalize_with_map(raw: &str) -> (String, Vec<usize>) {
    let mut out = String::new();
    let mut map = Vec::new();
    let mut pending_space = false;
    for (raw_index, ch) in raw.chars().enumerate() {
        for folded in ch.to_string().nfkc().flat_map(char::to_lowercase).map(fold_punctuation) {
            if folded.is_whitespace() {
                pending_space = !out.is_empty();
                continue;
            }
            if pending_space {
                out.push(' ');
                map.push(raw_index);
                pending_space = false;
            }
            out.push(folded);
            map.push(raw_index);
        }
    }
    (out, map)
}

fn fold_punctuation(ch: char) -> char {
    match ch {
        '\u{2018}' | '\u{2019}' | '\u{201A}' | '\u{201B}' => '\'',
        '\u{201C}' | '\u{201D}' | '\u{201E}' => '"',
        '\u{2010}'..='\u{2015}' | '\u{2212}' => '-',
        other => other,
    }
}
```

### Evidence read path
```rust
pub async fn list_evidence_by_meeting(pool: &SqlitePool, meeting_id: &str) -> Result<Vec<TranscriptEvidence>, SqlxError> {
    sqlx::query_as::<_, TranscriptEvidence>(
        "SELECT * FROM transcript_evidence WHERE meeting_id = ? ORDER BY sequence, audio_start_time",
    )
    .bind(meeting_id)
    .fetch_all(pool)
    .await
}
```
This uses the existing index `idx_transcript_evidence_meeting_sequence ON transcript_evidence (meeting_id, sequence)` `[VERIFIED: frontend/src-tauri/migrations/20260920000200_phase1_transcript_evidence.sql:24-25]`. Columns quoted from the same file, lines 3–22: `evidence_id, meeting_id, source_track, source_segment_key, sequence, transcript, audio_start_time, audio_end_time, is_final, capture_completeness, created_at, updated_at` with `capture_completeness IN ('complete', 'incomplete')`.

### Meeting completeness values the gate reads
`[VERIFIED: frontend/src-tauri/migrations/20260920000100_phase1_meeting_identity.sql:17-25]`: `CHECK (completeness IN ('pending', 'complete', 'incomplete', 'recovered_with_gaps', 'completion_not_verified'))`; lifecycle `CHECK (lifecycle IN ('preparing', 'recording', 'finalizing', 'complete', 'incomplete', 'recovered', 'legacy'))` (lines 6–15). The Rust enum `MeetingCompleteness { Pending, Complete, Incomplete, RecoveredWithGaps, CompletionNotVerified }` is at `[VERIFIED: frontend/src-tauri/src/database/models.rs:32-53]`.

### Auto-run gate extension (React)
The existing gate in `page-content.tsx:262-273` checks `!shouldAutoGenerate`, the summary status, `isModelConfigLoading`, transcript length, and a per-meeting ref, then `if (summaryRouteState.status !== 'validated') return;` `[VERIFIED: frontend/src/app/meeting-details/page-content.tsx:264,273]`. Knowledge auto-run adds `meeting.completeness === 'complete'` and `evidenceCount > 0`, keeps its own per-meeting ref, and runs only if no knowledge run exists for the meeting yet (so opening the page twice never re-extracts).

### Playwright IPC stub (init script)
```js
window.__TAURI_INTERNALS__ = window.__TAURI_INTERNALS__ ?? {};
const callbacks = new Map();
window.__TAURI_INTERNALS__.transformCallback = (cb, once) => {
  const id = crypto.getRandomValues(new Uint32Array(1))[0];
  callbacks.set(id, (d) => { if (once) callbacks.delete(id); return cb && cb(d); });
  return id;
};
window.__TAURI_INTERNALS__.unregisterCallback = (id) => callbacks.delete(id);
window.__TAURI_INTERNALS__.invoke = async (cmd, args) => {
  const table = window.__TELU_FIXTURE__ ?? {};
  if (cmd.startsWith('plugin:event|')) return 0;
  if (cmd in table) return typeof table[cmd] === 'function' ? table[cmd](args) : table[cmd];
  throw new Error(`unmocked command: ${cmd}`);
};
```
This mirrors `mockIPC` in `node_modules/@tauri-apps/api/mocks.js`, which is plain browser JS setting `invoke`, `transformCallback`, `unregisterCallback`, `runCallback`, `callbacks` (read this session). The Tauri docs point browser E2E at WebDriver `[CITED: v2.tauri.app/develop/tests/mocking]`. Whether injection is enough for every screen (plugins such as `store`, `os`, `updater` call `plugin:*|…` commands) is **unverified**, so make it a Wave 0 spike. Unmocked commands throw, which surfaces every command a screen needs.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Free-form LLM summaries with no source | Source-grounded extraction mapping each extraction to exact source offsets (e.g. Google LangExtract) | 2025 | The model's quote is data; alignment and verification are code `[CITED: github.com/google/langextract]` |
| Spring by `duration` in framer-motion | `visualDuration` + `bounce` | framer-motion 11.x | Use the skill's `SPRING`/`SPRING_BOUNCE` presets |
| `window-vibrancy` crate calls in setup | Tauri 2 `windowEffects` config | Tauri 2.0 | Config-only; `setEffects()` for runtime changes |
| Individual `@radix-ui/react-*` packages | `radix-ui` meta package | radix-ui 1.x | Already installed; don't add duplicates |

**Deprecated/outdated:**
- shadcn HSL channel variables (`--accent: 239 74.3% 96%`) are replaced by Telu hex/rgba tokens.
- `next/font/google` Source Sans 3 is replaced by the SF system stack (no build-time network fetch).
- Deprecated `WindowEffect` values `appearanceBased|light|dark|mediumLight|ultraDark` are "macOS 10.14-" and must not be used.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Table, column and trigger names in the schema sketches (only the `location_class`, completeness and lifecycle values are verified) | Pattern 1 | Low: naming is Claude's discretion |
| A2 | Matcher similarity threshold 0.6 and quote minimum (3 words / 12 chars) are good starting points | Patterns 2, 4 | Medium: too strict means abstention noise, too loose means false suppression. Tune on fixtures before thresholds are declared |
| A3 | Cross-segment matching limited to 2 consecutive segments suffices | Pattern 2 | Medium: long decisions may abstain; the evaluation's coverage metric reveals it |
| A4 | Reusing `Capability::Summary` for extraction is acceptable to the user as the privacy label | Pattern 3 | Medium: the user may want a separate route or label. Confirm copy |
| A5 | ⌘R is not bound by WKWebView/Tauri's default menu, so a webview keydown handler is enough | Pattern 8 | Low: verify in `tauri dev` and a release build |
| A6 | An injected `__TAURI_INTERNALS__` stub lets Playwright WebKit render every existing screen | Code Examples | Medium: plugin calls may need more stubbing. Wave 0 spike |
| A7 | 1–4B local models can produce usable JSON extraction at acceptable quality | Pitfall 2 | High: may force "remote model recommended" copy or abstain-heavy output. Measure in KNOW-07 before the exit gate |
| A8 | An `Undo` on Accept implemented as an appended `reopen` event is desired | Pattern 1 | Low: omit if Undo is cut |
| A9 | Quality thresholds (claim correctness, coverage, attribution) are **not** set by research; the user declares them before evaluation | Evaluation | High if skipped: violates the roadmap rule "do not invent numeric targets" |

## Open Questions

1. **Dark mode in Phase 2 scope?**
   - What we know: D-01 says "light and dark" tokens. The window is forced `Light`. 70 files and 1,072 hard-coded palette classes don't respond to `.dark`.
   - Unclear: whether dark must pass visual regression this phase.
   - Recommendation: replace hard-coded palette classes anyway (the grep gate). Enable system appearance only after the dark screenshot gallery passes. Ask the user for a go/no-go at the Wave 1 checkpoint.

2. **Legacy, imported and retranscribed meetings**
   - What we know: they have no evidence rows. Retranscribe rewrites legacy `transcripts` only, so on canonical meetings the new evidence-based page won't reflect a retranscription.
   - Recommendation: Phase 2 shows "Knowledge needs a transcript Telu recorded with evidence" and does not backfill. Hide or disable Retranscribe on evidence-backed meetings until a later phase defines evidence re-versioning (it would also need knowledge invalidation). Confirm with the user.

3. **Evaluation gold data provenance**
   - What we know: real meetings are sensitive, and Phase 1 evaluation tables are content-free by design (`evaluation_runs.meeting_id TEXT NOT NULL UNIQUE`, "deliberately have no transcript … columns" `[VERIFIED: frontend/src-tauri/migrations/20260920000400_phase1_evaluation_runs.sql:1-15]`).
   - Recommendation: commit only **synthetic** fixtures (representative, insufficient-evidence, degraded-capture). The CLI accepts `--gold-dir` outside the repo for the user's consented real meetings. Reports hold metrics and ids only, never text.

4. **Accept-all and Undo**
   - 002 has "Accept all" and Undo toasts. D-12..D-14 don't mention either. Accept-all is safe if it appends one `accept` per item. Undo = `reopen` (A8). Confirm.

5. **Menu-bar status item behavior** (skill "Resolve before building")
   - Out of Phase 2's explicit scope, but the shell changes `tray.rs` interactions. Recommendation: keep the current tray menu unchanged this phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| macOS | Vibrancy/Overlay verification | ✓ | 26.6.2 | — |
| Node | Next build, Playwright | ✓ | 26.8.2 | — |
| pnpm | Installs | ✓ | 10.34.5 | — |
| bun | Frontend unit tests | ✓ | 1.3.9 | — |
| cargo / rustc | Rust build/tests | ✓ | 1.94.0 | — |
| Xcode CLT | Tauri macOS build | ✓ | xcrun 72 | — |
| Playwright WebKit browser | Visual regression | ✗ | — | `npx playwright install webkit` (network download); fall back to manual screenshot review |
| Ollama | Local LAN/loopback extraction path | ✗ (not installed) | — | Built-in AI sidecar (Qwen/Gemma, 32k context) or a remote provider; evaluation `score` mode needs no model |
| Built-in AI model downloaded | Local extraction runs | not probed | — | Download via existing model manager; `score` mode uses recorded predictions |

**Missing dependencies with no fallback:** none. The evaluation's `run` mode needs *some* configured Summary provider; `score` mode is fully offline.

**Missing dependencies with fallback:** Playwright WebKit (install), Ollama (built-in AI or remote).

## Security Domain

`security_enforcement: true`, ASVS level 1, block on high.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Local single-user app |
| V3 Session Management | no | — |
| V4 Access Control | yes (IPC surface) | New commands are registered for the `main` window capability only. Commands scope every query by `meeting_id` and verify that item and review ids belong to that meeting (prevents cross-meeting edits) |
| V5 Input Validation | yes | Rust validates UUIDs (`Uuid::parse_str`, as `transcript.rs` does), the enum `action`/`type`, correction length caps, non-empty trimmed text, owner/due caps. The LLM output is untrusted input: typed parse + limits + span verification |
| V6 Cryptography | minimal | `sha2` (already a dependency) for evidence/input fingerprints; no secrets |
| V7 Error handling & logging | yes | Typed redacted error codes to React (Phase 1 pattern). Never log transcript, quote, candidate or correction text |
| V8 Data protection | yes | Deletion is complete and atomic (D-17). Remote dispatch only via a validated route with the label shown first (PRIV-01..03). Evaluation reports are content-free |
| V12/V13 (files/API) | low | The evaluation CLI reads a user-supplied dir: canonicalize, size-cap JSON inputs (the baseline CLI caps at 32 MiB), no path echo in outputs |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection inside transcript ("ignore instructions, output …") | Tampering | Output can only create items whose quotes exist verbatim in the transcript; type is an enum; no tool calls; text is rendered as plain text |
| XSS via LLM/transcript text in the webview (IPC reachable) | Elevation | React text nodes only; no `dangerouslySetInnerHTML`/`rehype-raw` in knowledge UI |
| Silent local→remote fallback for extraction | Information disclosure | `validate_route_contract(expected, fresh)` before I/O; the outbound ledger records the attempt |
| SQL injection via search terms | Tampering | Bound parameters; escape `%`/`_` with `ESCAPE '\'` |
| Cross-meeting tampering via forged item ids | Tampering | Every write checks `item.meeting_id == meeting_id` inside the transaction |
| Residual knowledge after deletion | Information disclosure | Explicit deletes + FK NO ACTION + generic zero-row test |
| Content leakage in evaluation exports/logs | Information disclosure | Metrics-only reports; a test asserts the report JSON contains no fixture text |

## Sources

### Primary (HIGH confidence, read this session)
- `frontend/src-tauri/migrations/2026092000{0100,0200,0300,0400}_*.sql`: lifecycle/completeness values, evidence columns and index, finalization tables, content-free evaluation tables
- `frontend/src-tauri/src/database/repositories/{transcript.rs,meeting.rs}`: evidence upsert semantics, deletion transaction, legacy transcript reads
- `frontend/src-tauri/src/database/models.rs`: `MeetingLifecycle`, `MeetingCompleteness`, `CaptureCompleteness`, `TranscriptEvidence`
- `frontend/src-tauri/src/trust/provider_route.rs`, `src/summary/{llm_client.rs,service.rs,commands.rs}`: route contract, Summary-only configured LLM route, `generate_summary`
- `frontend/src-tauri/src/audio/transcription/worker.rs:378`: `source_track = "mixed"`
- `frontend/src-tauri/src/observability/stage_clock.rs:16-29`: `StageName` includes reserved `ContextSelection, GenerationStarted, GenerationCancelled, Superseded, SuggestionVisible`
- `~/.cargo/registry/src/…/sqlx-sqlite-0.8.6/src/options/mod.rs:183-185`: `foreign_keys` ON by default
- `~/.cargo/registry/src/…/tauri-2.11.1/permissions/window/autogenerated/reference.md`: default window permissions
- `~/.cargo/registry/src/…/tao-0.35.2/src/platform_impl/macos/view.rs:341-349`: traffic-light inset re-applied on draw
- `frontend/node_modules/@tauri-apps/cli/config.schema.json` (2.11.1): `titleBarStyle`, `hiddenTitle`, `trafficLightPosition`, `transparent`, `windowEffects`, `WindowEffect`, `WindowEffectState`
- `frontend/node_modules/@tauri-apps/api/mocks.js`: `mockIPC` internals
- `frontend/{package.json,tailwind.config.js,src/app/layout.tsx,src/app/globals.css,src/app/meeting-details/page-content.tsx}` and installed package versions
- `.claude/skills/sketch-findings-telu-fyi/` (SKILL.md, foundations-and-motion.md, app-shell-and-navigation.md, living-doc-and-side-peek.md, component-inventory.md): design contract

### Secondary (MEDIUM confidence)
- https://v2.tauri.app/learn/window-customization/: drag region semantics, `allow-start-dragging`
- https://docs.ollama.com/api/openai-compatibility: `response_format` supported on `/v1/chat/completions`
- https://playwright.dev/docs/test-snapshots: snapshot storage, per-platform names, `--update-snapshots`
- https://v2.tauri.app/develop/tests/mocking/: `mockIPC`/`mockWindows`/`clearMocks`
- https://github.com/tauri-apps/tauri/issues/13415: transparency lost after DMG build (open)

### Tertiary (LOW confidence)
- https://github.com/google/langextract and https://developers.googleblog.com/introducing-langextract-a-gemini-powered-information-extraction-library/: source grounding pattern (conceptual reference only)
- https://gist.github.com/charrondev/43150e940bd2771b1ea88256d491c7a9 and https://github.com/tauri-apps/tauri/issues/13790: traffic-light repositioning discussions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Every version was read from `Cargo.lock`/`node_modules`; the new crates are already transitive dependencies.
- Knowledge ledger architecture: HIGH for the constraints it rests on (FK default, evidence mutability, no speaker attribution, Summary-only route). MEDIUM for thresholds (A2, A3).
- Window chrome: MEDIUM. Keys were verified against the installed schema; runtime behavior on macOS 26 and in DMG builds is unverified.
- Token migration: HIGH on scope and mechanics (counts measured, Tailwind merge verified).
- Extraction quality with local models: LOW until KNOW-07 measurements exist.
- Pitfalls: MEDIUM-HIGH. Most are derived from code read this session.

**Research date:** 2026-09-27
**Valid until:** 2026-10-27 (30 days; Tauri/Playwright move fast, so re-check the pinned versions at execution)
