#!/usr/bin/env bash
# The full gate. verify.sh runs it and writes the commit marker only when every step passes.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
source .loop/env.sh

config="$(git show HEAD:.loop/config.json 2> /dev/null || cat .loop/config.json)"
base="$(jq -r '.base' <<< "$config")"
step() { echo; echo "== gate: $1"; }

step "frozen paths (KNOW-07 measurement and extraction code) unchanged since $base"
frozen=(
  frontend/src-tauri/src/knowledge
  frontend/src-tauri/src/summary
  frontend/src/lib/onboarding-summary-model.ts
  frontend/tests/lib/onboarding-summary-model.test.mjs
  frontend/src-tauri/tests/fixtures/knowledge-eval
  .planning/phases/02-evidence-linked-post-meeting-knowledge/eval
  .github/verify-phase2-know07-status.cjs
  .github/verify-phase2-know07-status.test.cjs
)
changed="$( { git diff --name-only "$base" -- "${frozen[@]}"; git ls-files --others --exclude-standard -- "${frozen[@]}"; } | sort -u)"
if [ -n "$changed" ]; then
  echo "gate: these frozen paths changed:" >&2
  echo "$changed" >&2
  exit 1
fi

step "rustfmt on Rust files added since $base"
new_rs="$( { git diff --name-only --diff-filter=A "$base" -- '*.rs'; git ls-files --others --exclude-standard -- '*.rs'; } | sort -u)"
if [ -n "$new_rs" ]; then
  # shellcheck disable=SC2086
  rustfmt --edition 2021 --check $new_rs
fi

step "cargo test (lib, bins and integration tests)"
cargo test --manifest-path frontend/src-tauri/Cargo.toml --features coreml

step "bun tests"
(cd frontend && bun test)

step "node and contract tests"
node frontend/tests/lib/onboarding-summary-model.test.mjs
node --test .github/*.test.cjs

step "typecheck (no errors outside tests/; test files may not exceed the base's 36)"
tsc_out="$(pnpm --dir frontend exec tsc --noEmit 2>&1 || true)"
src_errors="$(grep -E '^[^ ].*\([0-9]+,[0-9]+\): error' <<< "$tsc_out" | grep -vc '^tests/' || true)"
test_errors="$(grep -E '^tests/.*\([0-9]+,[0-9]+\): error' <<< "$tsc_out" | wc -l | tr -d ' ')"
echo "typecheck: $src_errors errors outside tests/, $test_errors in tests/"
if [ "$src_errors" -ne 0 ] || [ "$test_errors" -gt 36 ]; then
  echo "$tsc_out" >&2
  exit 1
fi

step "gallery (WebKit, light and dark)"
TELU_GALLERY_PORT="$(free_port "$(cat .loop/port 2> /dev/null || echo 3280)")" pnpm --dir frontend gallery

echo
echo "gate: all steps passed"
