---
phase: "2"
slug: "evidence-linked-post-meeting-knowledge"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-28"
---

# Phase 2 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Plans |
|----------|-------------|-------|
| Renderer → Tauri knowledge commands | meeting_id, expected_route and trigger are untrusted input | 02-01 |
| Rust → LLM provider | transcript content leaves the process only through the validated Summary route | 02-01 |
| LLM output → Rust ledger | model output is untrusted data (prompt injection can live in the transcript) | 02-01 |
| Rust → renderer | candidate and quote text are rendered in a webview that can reach IPC | 02-01 |
| npm registry → developer machine | a new dev dependency and a browser binary download | 02-02 |
| Test harness → app code | the stub replaces the Tauri IPC bridge in a browser only | 02-02 |
| LLM output → parser/verifier | untrusted text that may carry injected instructions from the transcript | 02-03 |
| Renderer → knowledge_cancel_extraction | untrusted meeting_id | 02-03 |
| Build → network | the removed Google font previously fetched at build time | 02-04 |
| Codemod → source tree | a script that rewrites source files in place | 02-04 |
| Renderer → review commands | meeting_id, item_id(s), action and correction text are untrusted | 02-05, 02-24 |
| Ledger → later phases | list_eligible_items is the eligibility contract others will trust | 02-05 |
| Shared primitives → every screen | a styling regression propagates app-wide | 02-06 |
| Settings UI → provider configuration | these screens configure the routes that decide where data goes | 02-07 |
| Consent UI → analytics | the consent switch decides whether analytics may run | 02-08 |
| Onboarding → OS permissions | the flow requests microphone and screen-recording permission | 02-09 |
| Import → local files | the import dialog opens user-selected files | 02-09 |
| Transcript/summary text → webview | meeting content rendered in a webview that can reach IPC | 02-10 |
| Confirmation modal → destructive callers | default focus decides what Enter does | 02-11 |
| LLM output → knowledge ledger | regenerated candidates are untrusted and may re-emit rejected content | 02-12 |
| Renderer → agenda/search commands | ranges and query strings are untrusted | 02-13 |
| Meeting titles and summary text → webview | meeting content rendered in the header, toolbar and summary next to IPC-capable code | 02-14 |
| Renderer → summary provider | the summary disclosure must still precede generation after the layout change | 02-14, 02-22 |
| Renderer → provider | extraction starts are data-bearing | 02-15 |
| Renderer → extraction commands | start, cancel and run-listing calls cross into Rust | 02-15 |
| Run notice origin and failure text → webview | Rust-provided strings rendered next to IPC-capable code | 02-15 |
| Renderer capability → native window | a new window permission (start dragging) is granted to the main webview | 02-16 |
| Rust counts → renderer | the Today count is a Rust fact rendered as-is | 02-16 |
| Renderer → api_delete_meeting | a destructive command with an untrusted meeting id | 02-17 |
| Deletion → background extraction | a run may be writing while the meeting is deleted | 02-17 |
| Maintainer-supplied files → CLI | gold, labels, predictions, thresholds and database paths are untrusted input | 02-18 |
| App database → export | sensitive meeting content leaves the app database into maintainer-chosen files | 02-18 |
| Record action → transcription route | audio leaves capture only through the displayed, revalidated route | 02-19 |
| Global keyboard handler → recording | ⌘R starts or stops capture | 02-19 |
| Maintainer data → evaluation | representative meetings and labels stay outside the repository | 02-20 |
| Search query → Rust | untrusted text into the evidence search | 02-21 |
| Evidence and titles → webview | meeting content rendered in the peek, search results and cards | 02-21 |
| Evidence and legacy transcript text → webview | meeting content rendered next to IPC-capable code | 02-22 |
| Quote, candidate and history text → webview | LLM- and transcript-derived text rendered next to IPC-capable code | 02-23 |
| Renderer → history command | item ids cross into Rust | 02-23 |
| Candidate, owner and due text → webview | LLM- and transcript-derived text rendered next to IPC-capable code | 02-24 |
| Rust projection → renderer | card states and queue details are Rust facts rendered as-is | 02-25, 02-26 |
| Meeting titles → webview | user- and import-supplied titles rendered on cards | 02-25, 02-26 |

---

## Threat Register

| Threat ID | Plan | Category | Component | Severity | Disposition | Mitigation (verified evidence) | Status |
|-----------|------|----------|-----------|----------|-------------|--------------------------------|--------|
| T-02-01 | 02-01 | Tampering | extraction.rs parse/verify | high | mitigate | parse.rs:7-8,105-123 caps + enum types; span_verifier.rs:115-128,151 verbatim match; extraction.rs:275 ids from Uuid::new_v4, offsets from the verifier only | closed |
| T-02-02 | 02-01 | Information disclosure | knowledge_start_extraction | high | mitigate | commands.rs:66 validate_route_contract before insert_running_run (:87) and spawn (:115); llm_client.rs:478 outbound ledger; test knowledge_start_fails_on_a_changed_route_before_any_run_or_dispatch | closed |
| T-02-03 | 02-01 | Tampering | knowledge ledger tables | high | mitigate | ledger migration triggers knowledge_runs_frozen / items / evidence_links / abstentions immutable; test knowledge_ledger_rows_are_append_only_and_runs_freeze_after_finalization | closed |
| T-02-04 | 02-01 | Elevation of privilege | knowledge-section.tsx | high | mitigate | living-doc renders text nodes only; gate knowledge-review.test.tsx:387; knowledge-section.test.tsx:124-125 | closed |
| T-02-05 | 02-01 | Tampering | commands.rs inputs | medium | mitigate | commands.rs:43,121 Uuid::parse_str; repository.rs:398 validate_meeting_id; all queries bound and meeting-scoped | closed |
| T-02-06 | 02-01 | Information disclosure | logs | medium | mitigate | commands.rs:72,108,268,335; extraction.rs:166-175,375; llm_client.rs:474,585,599 log ids, counts and codes only | closed |
| T-02-07 | 02-01 | Denial of service | parse | low | mitigate | parse.rs:105-106,121 caps; extraction.rs:317-322 MALFORMED_OUTPUT (oversized items become per-item abstentions per 02-03) | closed |
| T-02-SC | 02-02 | Tampering | npm install of @playwright/test | high | mitigate | package.json:100 exact pin 1.63.0; lockfile has no requiresBuild; published 24 days before install; approval in 02-02-SUMMARY.md:43 | closed |
| T-02-08 | 02-02 | Information disclosure | gallery fixtures and PNGs | medium | mitigate | visual fixtures contain synthetic content only | closed |
| T-02-09 | 02-02 | Tampering | IPC stub leaking into the app | low | accept | accepted: tauri-ipc-stub.js loaded only by gallery.visual.ts:28,79 via addInitScript; nothing in src/, next.config.js or tauri.conf.json references it | closed |
| T-02-10 | 02-03 | Tampering | parse.rs / span_verifier.rs | high | mitigate | span_verifier.rs:151 exact normalized substring; :5-6,110-113 3-word/12-char minimum; :197-221 attribute needs its own located quote (see Hardening 1) | closed |
| T-02-11 | 02-03 | Repudiation | knowledge_runs lifecycle | medium | mitigate | extraction.rs:316-354,375,425-441 terminal codes; repository.rs:246-262 stale runs cancelled as INTERRUPTED; test knowledge_start_finalizes_a_stale_running_run_before_starting_again | closed |
| T-02-12 | 02-03 | Denial of service | extraction windows | medium | mitigate | commands.rs:250-253 context budget; extraction.rs:197 per-window cancel, :203-206 malformed window isolated; tested | closed |
| T-02-13 | 02-03 | Information disclosure | logs | medium | mitigate | same log sites as T-02-06 | closed |
| T-02-14 | 02-03 | Spoofing | owner attribution | medium | mitigate | prompt.rs:77-84 no speaker labels, :14 no guessing of I/we; span_verifier.rs:204-219 NotStated unless inside its verified quote (see Hardening 1) | closed |
| T-02-15 | 02-04 | Information disclosure | layout.tsx fonts | low | mitigate | no next/font or googleapis reference in src/; layout.tsx:247 font-sans | closed |
| T-02-16 | 02-04 | Tampering | telu-palette.mjs migrate | medium | mitigate | telu-palette.mjs:214-215 explicit paths, :199-206 per-file counts; telu-design-system.test.tsx:114,131 | closed |
| T-02-17 | 02-04 | Denial of service | token swap | medium | mitigate | contract tests 60/60, bun 130/130, palette 0, gallery PNGs committed | closed |
| T-02-18 | 02-05 | Tampering | review.rs cross-meeting ids | high | mitigate | review.rs:153-169 meeting check inside BEGIN IMMEDIATE (:272), :120-136 ids loaded before insert, :261 UUIDs; test knowledge_review_rejects_items_outside_the_meeting | closed |
| T-02-19 | 02-05 | Tampering | knowledge_reviews / knowledge_revisions | high | mitigate | reviews migration immutable triggers, UNIQUE(item_id, sequence); review.rs:138-151 transition table; tested | closed |
| T-02-20 | 02-05 | Elevation of privilege | eligibility | high | mitigate | projection.rs:289-319 eligibility = accepted and all claim links valid; renderer reads item.eligibility only (candidate-row.tsx:81,95) | closed |
| T-02-21 | 02-05 | Tampering | correction input | medium | mitigate | review.rs:231-259 trim, 400/80 caps, control-character strip, typed error; migration CHECKs | closed |
| T-02-22 | 02-05 | Repudiation | review history | medium | mitigate | review.rs:171-201 sequence, created_at_utc and revision_id per action | closed |
| T-02-23 | 02-06 | Denial of service | restyled primitives | low | mitigate | gates green (as T-02-17) | closed |
| T-02-24 | 02-06 | Spoofing | focus visibility | low | mitigate | OPEN: ui/accordion.tsx:38 outline-none overrides the base-layer :focus-visible ring (globals.css:288); ring removed in cbaab4d (02-11); reachable via WhisperModelManager.tsx:522 | open — below high threshold (non-blocking) |
| T-02-25 | 02-07 | Information disclosure | TranscriptSettings / SummaryModelSettings | medium | mitigate | verify-phase1-provider-boundary.test.cjs:26-27 passes | closed |
| T-02-26 | 02-07 | Tampering | codemod over settings | low | mitigate | palette 0; gates green | closed |
| T-02-27 | 02-08 | Information disclosure | AnalyticsConsentSwitch | medium | mitigate | AnalyticsConsentSwitch.tsx Phase 2 diff (9667949) is className-only | closed |
| T-02-28 | 02-08 | Spoofing | warnings | low | mitigate | PermissionWarning.tsx:59-65, BluetoothPlaybackWarning.tsx:71-76, ComplianceNotification.tsx:78 keep icon and text | closed |
| T-02-29 | 02-09 | Elevation of privilege | PermissionsStep | low | mitigate | PermissionsStep.tsx diff (462a8a9) changes the button variant only | closed |
| T-02-30 | 02-09 | Tampering | ImportAudioDialog | low | accept | accepted: ImportAudioDialog diff only adds variant="primary"; fs scope and dialog permissions unchanged (egress test passes) | closed |
| T-02-31 | 02-10 | Elevation of privilege | transcript and summary rendering | medium | mitigate | no raw-HTML API added in src/ since 5fca229^; notes/[id]/page.tsx:174 predates Phase 2 (static sample data, restyled only) | closed |
| T-02-32 | 02-10 | Tampering | codemod | low | mitigate | gates green | closed |
| T-02-33 | 02-11 | Tampering | confirmation-modal default focus | medium | mitigate | confirmation-modal.tsx:28 Cancel autoFocus; TranscriptRecovery.tsx:369-393 Keep meeting first; delete alert focuses Cancel | closed |
| T-02-34 | 02-12 | Tampering | matcher.rs | high | mitigate | matcher.rs:62-68 rejected wins first; repository.rs:225,235 all revisions matched; test knowledge_regenerate_never_resurrects_rejected_or_corrected_wording (same-type only, see Hardening 5) | closed |
| T-02-35 | 02-12 | Repudiation | suppressions | medium | mitigate | suppressions migration immutable trigger; extraction.rs:258-263; test knowledge_suppressions_are_append_only | closed |
| T-02-36 | 02-12 | Information disclosure | logs | low | mitigate | extraction.rs:166-175 counts only; matcher logs nothing | closed |
| T-02-37 | 02-13 | Tampering | search_transcripts | high | mitigate | transcript.rs:11-18 escapes \ % _, :280,288,294 ESCAPE, :297 LIMIT 50, :299 bound; tests transcript_search_treats_wildcards_literally, _caps_results | closed |
| T-02-38 | 02-13 | Denial of service | agenda_list_day | medium | mitigate | agenda/mod.rs:118-129 from<to and at most 48h; agenda/commands.rs:11,32; subqueries scoped by m.id; tested (see Hardening 2) | closed |
| T-02-39 | 02-13 | Information disclosure | logs | low | mitigate | api.rs:381-385 logs query_length only | closed |
| T-02-42 | 02-14 | Tampering | Retranscribe menu item | medium | mitigate | meeting-page.tsx:175,181,245 canRetranscribe requires no evidence (UI-only, see Hardening 3) | closed |
| T-02-66 | 02-14 | Information disclosure | page-content.tsx summary order | high | mitigate | page-content.tsx:308 ProviderBoundary before SummaryPanel (:342); validate (:166) before handleGenerateSummary (:186); contract test :65-68 | closed |
| T-02-44 | 02-15 | Information disclosure | knowledge-section start paths | high | mitigate | knowledge-section.tsx:110-138 validate (:117) then start (:122); :260,319 actions gated; RunNotice :285,290,317; knowledge-run.test.tsx:200 | closed |
| T-02-67 | 02-15 | Information disclosure | D-09 auto-run gate | medium | mitigate | knowledge-section.tsx:44,237-242 per-meeting set plus latestRun check; knowledge-run.test.tsx:213 | closed |
| T-02-68 | 02-15 | Elevation of privilege | run-notice / run-details-popover / knowledge-section | high | mitigate | text nodes only; living-doc gate knowledge-review.test.tsx:387 | closed |
| T-02-47 | 02-16 | Elevation of privilege | tauri.conf.json capability | medium | mitigate | tauri.conf.json:66 only adds core:window:allow-start-dragging (382f66a); egress/CSP test passes | closed |
| T-02-49 | 02-16 | Information disclosure | sidebar footer copy | low | mitigate | sidebar.tsx:174 "Stored on this Mac"; no local-processing claim | closed |
| T-02-50 | 02-17 | Information disclosure | delete_meeting_with_transaction | high | mitigate | meeting.rs:1197-1268 children first, one transaction, NO ACTION FKs; knowledge_deletion.rs:256 zero rows, :278 FK backstop | closed |
| T-02-51 | 02-17 | Tampering | deletion vs running extraction | medium | mitigate | api.rs:772 cancel before delete (:776); extraction.rs:368-381 MEETING_DELETED; tested | closed |
| T-02-52 | 02-17 | Tampering | SQL in the delete loop | medium | mitigate | meeting.rs:1197 table names from a constant slice; :1225-1234,1253 bound meeting id | closed |
| T-02-53 | 02-17 | Repudiation | destructive UX | medium | mitigate | delete-meeting-alert.tsx:134 Delete disabled until counts load, :100-103 Cancel focused, Radix Esc, :19,121 audio note; tests :109,121,134 | closed |
| T-02-54 | 02-18 | Information disclosure | evaluation reports | high | mitigate | evaluation/mod.rs:198-218 metrics, ids and hashes only; knowledge_eval_cli.rs:61,89 assert no fixture text | closed |
| T-02-55 | 02-18 | Information disclosure | export subcommand | medium | mitigate | telu-knowledge-eval.rs:50-57 required --meeting/--out; replay.rs:310 UUID, :331-334 read_only; counts/codes output | closed |
| T-02-56 | 02-18 | Denial of service | input parsing | medium | mitigate | telu-knowledge-eval.rs:14 32 MiB cap, :180-189 regular file + canonicalize, :200 typed serde; test score_rejects_inputs_over_32_mib | closed |
| T-02-57 | 02-18 | Information disclosure | provider dispatch | medium | mitigate | no generate_summary or reqwest in evaluation/ or the bin; replay.rs:78-81 replay closure | closed |
| T-02-58 | 02-19 | Information disclosure | use-recording-controls.ts | high | mitigate | use-recording-controls.ts:169-183 validate before start, :267 canRecord; recording-host.tsx:186 ProviderBoundary; recording-host.test.tsx:218 (see Unregistered Flag 1) | closed |
| T-02-59 | 02-19 | Tampering | duplicate listeners | medium | mitigate | layout.tsx:267 mounted once; hooks only in recording-host.tsx:152-154; recording-host.test.tsx:203 | closed |
| T-02-60 | 02-19 | Elevation of privilege | ⌘R handler | low | mitigate | recording-host.tsx:37-45 typing and open-layer guards; :53-58 same start/stop | closed |
| T-02-61 | 02-20 | Repudiation | thresholds-v1.json | medium | mitigate | thresholds-v1.json alone in 61f30f7 before the report in 8d0b0e3; report sha256 6af4ebe9… matches and records 61f30f7 | closed |
| T-02-62 | 02-20 | Information disclosure | eval reports | medium | mitigate | eval/*.json hold metrics, status, ids and hashes only; fixtures synthetic | closed |
| T-02-73 | 02-20 | Repudiation | KNOW-07 status | high | mitigate | verify-phase2-know07-status.test.cjs derives the status and compares it to the committed file; passes with status open (see Hardening 6) | closed |
| T-02-63 | 02-21 | Elevation of privilege | side-peek / search results | high | mitigate | no raw-HTML API in agenda, app-shell, side-peek or living-doc; today-view.test.tsx:453,466-470 (see Hardening 4) | closed |
| T-02-64 | 02-21 | Tampering | search | medium | mitigate | search-popover.tsx:13,29-35 debounce; SidebarProvider.tsx:202 sends the query string only | closed |
| T-02-65 | 02-21 | Repudiation | context-menu delete | medium | mitigate | deleteMeeting called only from delete-meeting-alert.tsx:81; card and page go through the alert; today-view.test.tsx:474 | closed |
| T-02-40 | 02-22 | Elevation of privilege | transcript-drawer.tsx | high | mitigate | transcript-drawer.tsx:124-135 bounds-checked code-point slices rendered as text in <mark>; transcript-drawer.test.tsx:137 | closed |
| T-02-41 | 02-22 | Information disclosure | summary input | medium | mitigate | 0f701c1 changes only the input source in useSummaryGeneration.ts; dispatch still after page-content.tsx:166 validation | closed |
| T-02-69 | 02-23 | Elevation of privilege | source-chip / evidence-popover / history-popover | high | mitigate | text nodes; living-doc gate; evidence-popover.test.tsx:294 renders an <img onerror> payload verbatim | closed |
| T-02-70 | 02-23 | Spoofing | evidence-popover quote | medium | mitigate | evidence-popover.tsx:68 verified quoteText, :58-59 changed/missing notes; source-chip.tsx:35 alert glyph; tests :151,164,186 | closed |
| T-02-43 | 02-24 | Elevation of privilege | living-doc components | high | mitigate | knowledge-review.test.tsx:387-393 gate | closed |
| T-02-45 | 02-24 | Spoofing | eligibility display | medium | mitigate | candidate-row.tsx:161-174 applies only Rust-returned views; knowledge-review.test.tsx:208,265 | closed |
| T-02-46 | 02-24 | Tampering | correction input | medium | mitigate | candidate-row.tsx:27-28,134,147 maxLength 400/80, :182 basedOnRevisionId; review.rs:106 RevisionConflict | closed |
| T-02-48 | 02-25 | Spoofing | EventCard state | medium | mitigate | event-card.tsx:52-78,137,210-218 driven by cardState; agenda/mod.rs:87-116; today-view.test.tsx:226,247 | closed |
| T-02-71 | 02-25 | Elevation of privilege | event-card / today-view titles | high | mitigate | event-card.tsx:228 title as text; no raw-HTML API in components/agenda | closed |
| T-02-72 | 02-26 | Spoofing | Review counts and rows | medium | mitigate | review-view.tsx:63-100 rows from agenda_list_review, :134 sums Rust pendingCount; sidebar.tsx:89,140 agenda_counts; agenda-review.test.tsx:197,238,262 | closed |
| T-02-71 | 02-26 | Elevation of privilege | review-view titles | high | mitigate | rows render through AgendaTimeline and EventCard (agenda-timeline.tsx:163); no raw-HTML API in components/agenda | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*
*T-02-71 is registered twice (02-25 cards, 02-26 review rows) and verified separately.*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-09 (02-02) | The IPC stub lives only under frontend/tests/visual and is injected by Playwright; nothing in src/ imports it (re-confirmed 2026-09-28) | Plan 02-02 threat model | 2026-09-27 |
| AR-02-02 | T-02-30 (02-09) | File selection and parsing in ImportAudioDialog are unchanged by Phase 2; Phase 1 capability scoping still applies (re-confirmed 2026-09-28) | Plan 02-09 threat model | 2026-09-27 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags (non-blocking)

1. **The tray and sidebar recording starts skip the renderer route check.** `useRecordingStart.ts:315-397` handles `start-recording-from-sidebar` (sent by layout.tsx:133 and SidebarProvider.tsx:177). It calls `startRecordingWithDevices` without `validateProviderRoute` or the transcription ProviderBoundary. Audio still cannot leave the device: Rust accepts only a local Device route for transcription and fails closed on every start (engine.rs:72-87).

## Hardening Notes (not counted; L1 audit)

1. **T-02-10 / T-02-14 → code review CR-01, verification gap KNOW-06.** `verify_attribute` matches by plain substring with no minimum length. Owner "Ann" from "planned", "Tom" from "tomorrow" and the pronoun "I" are stored as stated. The fix is word-boundary matching plus a pronoun stoplist.
2. **T-02-38.** `load_meetings` loads every meeting before range filtering. The 48h cap bounds the response, not the query cost.
3. **T-02-42.** The re-transcription guard lives only in the UI; `start_retranscription_command` in Rust does not refuse meetings that have evidence.
4. **T-02-63 / T-02-71.** The committed raw-HTML test covers only components/living-doc. Agenda, app-shell and side-peek were checked once by grep in 02-21; make that a test.
5. **T-02-34 → code review CR-02, verification gap KNOW-05.** Suppression is verified only within one item type. A rejected item re-emitted under another type is proposed again.
6. **T-02-73 → code review CR-80.** The KNOW-07 derivation accepts a partial or empty scope and ignores `failures` and the invariants. It still reads `open` today.
7. **Outside the register → code review CR-20.** `get_match_context` (transcript.rs:315-336) slices by bytes and can panic on non-ASCII text. The Phase 2 search now calls it on every query.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-28 | 75 | 74 | 1 (low, non-blocking) | gsd-security-auditor (ASVS L1, block_on high) |

Supporting runs: `node --test .github/*.test.cjs` 60/60 · `bun test` 130/130 · `cargo test --lib` (knowledge, agenda, meeting, search, transcript) 148 · `--test knowledge_deletion` 3/3 · `--test knowledge_eval_cli` 4/4 · palette check 0.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-28 (L1). The hardening notes above feed Phase 2 gap closure.
