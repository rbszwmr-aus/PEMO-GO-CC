#!/usr/bin/env bash
# Start the PEMO Go stack on Linux / WSL / macOS, on its own ports, refusing to
# touch a port that is already taken (another project's service is never stopped).
#
#   scripts/dev-up.sh            API (if the database is there), demo server, both UIs
#   scripts/dev-up.sh --no-ui    backend only
#   scripts/dev-up.sh --stop     stop what this script started (pid files in .run/)
#
# WSL: run it from the repo inside WSL (e.g. /mnt/f/Projects/PEMO-GO-CC) and open
# the UIs from the Windows browser at http://localhost:23281 / :23282 (WSL2
# forwards localhost).
set -euo pipefail
trap 'rc=$?; [ $rc -ne 0 ] && printf "[pemo-go] ERROR: stopped at line %s (exit %s): %s\n" "$LINENO" "$rc" "$BASH_COMMAND" >&2' EXIT
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"
# shellcheck disable=SC1091
. <(tr -d '\r' < scripts/ports.env)
RUN="$REPO/.run"; mkdir -p "$RUN"
NO_UI=0; [ "${1:-}" = "--no-ui" ] && NO_UI=1
log()  { printf '[pemo-go] %s\n' "$*"; }
warn() { printf '[pemo-go] WARNING: %s\n' "$*" >&2; }
die()  { printf '[pemo-go] ERROR: %s\n' "$*" >&2; exit 1; }

# Bounded so a filtered port (WSL mirrored networking, firewalls) cannot hang the script.
listening() { timeout 2 bash -c "exec 3<>/dev/tcp/127.0.0.1/$1" 2>/dev/null; }
require_free() { if listening "$1"; then die "port $1 ($2) is already in use — not ours, refusing to start. Free it or change scripts/ports.env."; fi; }

if [ "${1:-}" = "--stop" ]; then
  for f in "$RUN"/*.pid; do [ -e "$f" ] || continue; pid=$(cat "$f"); kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true; log "stopped $(basename "$f" .pid) ($pid)"; rm -f "$f"; done
  exit 0
fi

# ---- check everything before starting anything ----
START_API=1
if [ ! -f database/dev/.env ]; then
  warn "database/dev/.env is missing - starting WITHOUT the API (cp database/dev/.env.example database/dev/.env and set the passwords)"; START_API=0
elif ! listening "$PEMO_GO_DB_PORT"; then
  warn "no database on 127.0.0.1:$PEMO_GO_DB_PORT - starting WITHOUT the API (docker compose --env-file database/dev/.env -f database/dev/docker-compose.yml up -d; then database/bootstrap.sh --with-seed)"; START_API=0
fi
PNPM=()
if [ "$NO_UI" = 0 ]; then
  command -v node >/dev/null || die "Node.js not found in this shell (needed for the web UIs). In WSL: install Node 22.6+ (e.g. nvm install 24). Backend only: --no-ui"
  NODE_VER="$(node -v | sed 's/^v//')"
  [ "$(printf '%s\n22.6.0\n' "$NODE_VER" | sort -V | head -1)" = "22.6.0" ] || die "Node $NODE_VER is too old for the UIs; 22.6+ is required"
  if command -v pnpm >/dev/null; then PNPM=(pnpm)
  elif command -v corepack >/dev/null; then
    # The UI packages' own scripts call `pnpm` by name, so a real pnpm command
    # must be on PATH: let corepack put its shim in ~/.local/bin (no sudo needed).
    mkdir -p "$HOME/.local/bin"
    corepack enable --install-directory "$HOME/.local/bin" pnpm
    export PATH="$HOME/.local/bin:$PATH"
    PNPM=(pnpm); log "pnpm enabled through corepack in ~/.local/bin"
  else PNPM=(npx --yes pnpm@11); log "pnpm not on PATH - using it through npx"; fi
fi
[ "$START_API" = 1 ] && require_free "$PEMO_GO_API_PORT" api
require_free "$PEMO_GO_DEMO_PORT" demo
if [ "$NO_UI" = 0 ]; then require_free "$PEMO_GO_WEB_PORT" management-web; require_free "$PEMO_GO_PORTAL_PORT" resident-portal; fi

# ---- backend binaries: build if Go is here, else use the prebuilt Linux ones ----
if command -v go >/dev/null; then
  log "building backend"; (cd backend && go build -o bin/ ./cmd/...)
elif [ -x backend/bin/linux-amd64/pemo-api ]; then
  log "Go not found - using the prebuilt backend/bin/linux-amd64/*"; mkdir -p backend/bin
  for b in pemo pemo-api pemo-demo pemo-mcp; do cp -f "backend/bin/linux-amd64/$b" "backend/bin/$b"; chmod +x "backend/bin/$b"; done
else
  die "Go not found and no prebuilt backend/bin/linux-amd64 binaries"
fi

start() {  # name, command...
  local name="$1"; shift
  setsid nohup "$@" >"$RUN/$name.log" 2>&1 < /dev/null &
  echo $! >"$RUN/$name.pid"
  log "$name started (pid $!, log .run/$name.log)"
}
[ "$START_API" = 1 ] && PEMO_HTTP_PORT="$PEMO_GO_API_PORT" start api backend/bin/pemo-api -root "$REPO"
PEMO_DEMO_PORT="$PEMO_GO_DEMO_PORT" start demo backend/bin/pemo-demo
if [ "$NO_UI" = 0 ]; then
  if [ ! -d node_modules ]; then
    log "installing UI packages (first run, a few minutes)"
    "${PNPM[@]}" install --no-frozen-lockfile || die "pnpm install failed - see above"
  fi
  start management-web "${PNPM[@]}" -C apps/management-web dev
  start resident-portal "${PNPM[@]}" -C apps/resident-portal dev
fi

wait_port() {  # port name seconds
  for _ in $(seq 1 "$3"); do if listening "$1"; then log "$2 up      http://127.0.0.1:$1"; return; fi; sleep 1; done
  warn "$2 did NOT come up on $1. Last log lines:"; tail -15 "$RUN/$2.log" | sed 's/^/    /'
}
[ "$START_API" = 1 ] && wait_port "$PEMO_GO_API_PORT" api 15
wait_port "$PEMO_GO_DEMO_PORT" demo 10
if [ "$NO_UI" = 0 ]; then wait_port "$PEMO_GO_WEB_PORT" management-web 120; wait_port "$PEMO_GO_PORTAL_PORT" resident-portal 120; fi
