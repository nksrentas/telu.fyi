# Sourced by init.sh, gate.sh and tool.sh: puts Node 24, the pinned pnpm shim and Homebrew tools on PATH.
node24="${NVM_DIR:-$HOME/.nvm}/versions/node/v24.22.1/bin"
loop_bin="$(git rev-parse --show-toplevel)/.loop/bin"
export PATH="$loop_bin:$node24:/opt/homebrew/bin:$HOME/.bun/bin:$PATH"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

free_port() {
  local port="$1"
  while lsof -iTCP:"$port" -sTCP:LISTEN > /dev/null 2>&1; do port=$((port + 1)); done
  echo "$port"
}
