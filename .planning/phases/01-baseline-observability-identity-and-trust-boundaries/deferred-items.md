# Deferred Items

- **Pre-existing Rust formatting drift:** `cargo fmt --all -- --check` reports broad formatting differences across `frontend/src-tauri`, including files outside Plan 01-01. The plan's focused Rust suites and frontend production build pass; repository-wide mechanical formatting is deferred to a dedicated maintenance change to avoid unrelated churn.
