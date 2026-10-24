#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
source .loop/env.sh

gallery_base=3260

if [ "${1:-}" = "stop" ]; then
  rm -f .loop/port
  echo "autoloop: nothing to stop; the gallery starts and stops its own Next.js server"
  exit 0
fi

for tool in cmake bun cargo corepack; do
  command -v "$tool" > /dev/null || { echo "autoloop: $tool is not installed or not on PATH" >&2; exit 1; }
done

[ -e frontend/node_modules/.bin ] || pnpm --dir frontend install --frozen-lockfile > /dev/null

ls "$HOME/Library/Caches/ms-playwright" 2> /dev/null | grep -q '^webkit-' || pnpm --dir frontend exec playwright install webkit

helper=frontend/src-tauri/binaries/llama-helper-aarch64-apple-darwin
if [ ! -x "$helper" ]; then
  mkdir -p "$(dirname "$helper")"
  if [ -n "${LOOP_MAIN_DIR:-}" ] && [ -x "$LOOP_MAIN_DIR/$helper" ]; then
    cp "$LOOP_MAIN_DIR/$helper" "$helper"
  else
    cargo build --release -p llama-helper --features metal
    cp target/release/llama-helper "$helper"
  fi
fi

# build/ffmpeg.rs rejects this zip ("Invalid checksum") although unzip -t passes, so place the sidecar ourselves.
ffmpeg=frontend/src-tauri/binaries/ffmpeg-aarch64-apple-darwin
if [ ! -x "$ffmpeg" ]; then
  if [ -n "${LOOP_MAIN_DIR:-}" ] && [ -x "$LOOP_MAIN_DIR/$ffmpeg" ]; then
    cp "$LOOP_MAIN_DIR/$ffmpeg" "$ffmpeg"
  else
    tmp="$(mktemp -d)"
    curl -sSfL -o "$tmp/ffmpeg.zip" https://github.com/Zackriya-Solutions/ffmpeg-binaries/releases/download/0.0.1/ffmpeg80arm.zip
    unzip -oq "$tmp/ffmpeg.zip" ffmpeg -d "$tmp"
    install -m 755 "$tmp/ffmpeg" "$ffmpeg"
    rm -rf "$tmp"
  fi
fi

port="$(free_port $((gallery_base + ${LOOP_WORKER:-0} * 3)))"
echo "$port" > .loop/port
echo "autoloop: ready. No dev server; the app's data dir is never used. Gate: bash .loop/gate.sh. Focused runs: cargo test --manifest-path frontend/src-tauri/Cargo.toml --features coreml <filter>, bash .loop/tool.sh bun <file>, bash .loop/tool.sh gallery <grep> (port $port)."
