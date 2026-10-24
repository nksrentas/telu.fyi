#!/usr/bin/env bash
# Focused checks for loop sessions: bash .loop/tool.sh <bun|tsc|lint|gallery|palette|node-tests|pnpm> [args]
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
source .loop/env.sh

command="${1:-}"
shift || true
case "$command" in
  bun) cd frontend && exec bun test "$@" ;;
  tsc) exec pnpm --dir frontend exec tsc --noEmit ;;
  lint) exec pnpm --dir frontend lint ;;
  gallery)
    port="$(free_port "$(cat .loop/port 2> /dev/null || echo 3260)")"
    if [ $# -gt 0 ]; then
      TELU_GALLERY_PORT="$port" exec pnpm --dir frontend gallery --grep "$*"
    fi
    TELU_GALLERY_PORT="$port" exec pnpm --dir frontend gallery ;;
  palette) exec node frontend/scripts/telu-palette.mjs check "$@" ;;
  node-tests)
    node frontend/tests/lib/onboarding-summary-model.test.mjs
    exec node --test .github/*.test.cjs ;;
  pnpm) exec pnpm "$@" ;;
  *) echo "usage: bash .loop/tool.sh <bun|tsc|lint|gallery|palette|node-tests|pnpm> [args]" >&2; exit 2 ;;
esac
