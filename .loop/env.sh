# Sourced by init.sh, gate.sh and tool.sh: puts Node 24, the pinned pnpm shim and Homebrew tools on PATH.
# Node 24 is the newest nvm v24.x, else Homebrew's node@24, else whatever node is already on PATH.
node24=""
for dir in "$(ls -d "${NVM_DIR:-$HOME/.nvm}"/versions/node/v24.*/bin 2> /dev/null | sort -V | tail -1)" /opt/homebrew/opt/node@24/bin /usr/local/opt/node@24/bin; do
  if [ -n "$dir" ] && [ -x "$dir/node" ]; then
    node24="$dir"
    break
  fi
done
loop_bin="$(git rev-parse --show-toplevel)/.loop/bin"
export PATH="$loop_bin:${node24:+$node24:}/opt/homebrew/bin:$HOME/.bun/bin:$PATH"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

free_port() {
  local port="$1"
  while lsof -iTCP:"$port" -sTCP:LISTEN > /dev/null 2>&1; do port=$((port + 1)); done
  echo "$port"
}
