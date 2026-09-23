---
quick_id: 260923-q8n
title: Rename the active desktop app from Meetily to Telu
status: complete
date: 2026-09-23
commit: d6fd543
---

# Summary

Renamed the active desktop product from Meetily to Telu across the React interface, native Rust surfaces, Tauri/Cargo/package metadata, build helpers, CI artifact names, public documentation, and transcript tooling.

## Compatibility retained

- Kept `com.meetily.ai` as the installed application identifier so app data and OS permissions remain attached to existing installations.
- Kept legacy database, IndexedDB, session-storage, local-storage, notification-settings, template, and downloaded-model paths readable.
- Kept upstream model/update URLs, existing signing secret names, the legacy llama-helper environment variable alias, and explicit Meetily attribution.

## Verification

- `node --test .github/verify-telu-branding.test.cjs .github/verify-tauri-binary-selection.test.cjs` — passed (3 tests).
- `cargo check -p telu --bin telu` — passed.
- `cargo test -p telu --lib downloaded_model_sends_user_agent_and_rejects_undersized_valid_header` — passed when allowed to bind its local loopback test socket.
- `python3 -m py_compile scripts/inject_transcript.py` — passed.
- `pnpm exec tsc --noEmit` — reached a pre-existing unrelated fixture failure in `tests/hooks/paginated-transcripts.test.tsx`; its `MeetingMetadata` object lacks the newer lifecycle, completeness, and gap fields.
- `pnpm lint` — unavailable non-interactively because this repository has not configured ESLint and Next.js launches its first-time setup prompt.
- Whole-workspace `cargo fmt --check` — reports broad pre-existing formatting drift in unrelated files; rename-specific diffs pass `git diff --check`.

## Outcome

The shipped app, package, binary, UI, notifications, build output, and public artifact naming now use Telu. Remaining Meetily strings are intentional compatibility, upstream, legacy-import, or historical references and are covered by a regression test.
