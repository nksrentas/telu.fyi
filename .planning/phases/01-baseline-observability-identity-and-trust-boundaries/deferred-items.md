# Deferred Items

- **Pre-existing Rust formatting drift:** `cargo fmt --all -- --check` reports broad formatting differences across `frontend/src-tauri`, including files outside Plan 01-01. The plan's focused Rust suites and frontend production build pass; repository-wide mechanical formatting is deferred to a dedicated maintenance change to avoid unrelated churn.
- **Pre-existing isolated TypeScript test fixture drift:** `pnpm --dir frontend exec tsc --noEmit` reports `tests/hooks/paginated-transcripts.test.tsx:46` constructing `MeetingMetadata` without the lifecycle, completeness, gap count, and gaps fields introduced before Plan 01-13. The production Next.js build and Plan 01-13 source contracts pass; updating that unrelated fixture is deferred to its owning test change.
