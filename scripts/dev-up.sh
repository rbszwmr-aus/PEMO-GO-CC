#!/usr/bin/env bash
# Start the PEMO Go stack on its own ports, refusing to touch a port that is
# already taken (another project's service is never stopped or reused).
#
#   scripts/dev-up.sh            db check, API, demo server, both UIs
#   scripts/dev-up.sh --no-ui    backend only
#   scripts/dev-up.sh --stop     stop what this script started (pid files in .run/)
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"
. scripts/ports.env
RUN="$REPO/.run"; mkdir -p "$RUN"
log() { printf '[pemo-go] %s\n' "$*"; }
die() { printf '[pemo-go] ERROR: %s\n' "$*" >&2; exit 1; }

listening() {  # is something listening on 127.0.0.1:$1 ?
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && { exec 3>&- 3<&-; return 0; } || return 1
}
require_free() { if listening "$1"; then die "port $1 ($2) is already in use — not ours, refusing to start. Free it or change scripts/ports.env."; fi; }

if [ "${1:-}" = "--stop" ]; then
  for f in "$RUN"/*.pid; do [ -e "$f" ] || continue; pid=$(cat "$f"); kill "$pid" 2>/dev/null && log "stopped $(basename "$f" .pid) ($pid)"; rm -f "$f"; done
  exit 0
fi

[ -f database/dev/.env ] || die "database/dev/.env is missing: cp database/dev/.env.example database/dev/.env and set the passwords"
listening "$PEMO_GO_DB_PORT" || die "no database on 127.0.0.1:$PEMO_GO_DB_PORT. Start it: docker compose --env-file database/dev/.env -f database/dev/docker-compose.yml up -d, then database/bootstrap.sh --with-seed"

for p in "$PEMO_GO_API_PORT:api" "$PEMO_GO_DEMO_PORT:demo"; do require_free "${p%%:*}" "${p#*:}"; done
if [ "${1:-}" != "--no-ui" ]; then require_free "$PEMO_GO_WEB_PORT" management-web; require_free "$PEMO_GO_PORTAL_PORT" resident-portal; fi

log "building backend"
(cd backend && go build -o bin/ ./cmd/...)

start() {  # name, logfile, command...
  local name="$1"; shift
  nohup "$@" >"$RUN/$name.log" 2>&1 &
  echo $! >"$RUN/$name.pid"
  log "$name started (pid $!, log .run/$name.log)"
}
PEMO_HTTP_PORT="$PEMO_GO_API_PORT" start api backend/bin/pemo-api -root "$REPO"
PEMO_DEMO_PORT="$PEMO_GO_DEMO_PORT" start demo backend/bin/pemo-demo
if [ "${1:-}" != "--no-ui" ]; then
  command -v pnpm >/dev/null || die "pnpm is needed for the UIs (corepack enable)"
  [ -d node_modules ] || pnpm install
  start management-web pnpm -C apps/management-web dev
  start resident-portal pnpm -C apps/resident-portal dev
fi
sleep 2
curl -fsS "http://127.0.0.1:$PEMO_GO_API_PORT/ready" >/dev/null && log "API ready  http://127.0.0.1:$PEMO_GO_API_PORT" || log "API not ready yet — see .run/api.log"
log "demo       http://127.0.0.1:$PEMO_GO_DEMO_PORT"
[ "${1:-}" = "--no-ui" ] || log "UIs        http://127.0.0.1:$PEMO_GO_WEB_PORT (management)  http://127.0.0.1:$PEMO_GO_PORTAL_PORT (portal)"
