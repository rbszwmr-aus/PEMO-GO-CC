#!/usr/bin/env bash
#
# ONE BUILD SEQUENCE, RUN BY BOTH THE HOOK-BATTERY AND CI (GEN-048 R6).
#
# CI was red on `main` while every local "from-nothing rebuild green" said
# otherwise, because the local rebuild kept node_modules and dist while the runner
# keeps nothing — and prove.sh's build was a loop of our own, not the command the
# workflow runs. This is the single source: the workflow calls it and prove.sh
# --ci calls it, so what one proves the other runs, byte for byte.
#
# It does EXACTLY what a fresh runner does, in this order:
#   1. print the environment (R8) — Node, pnpm, TZ, LANG, and Postgres if reachable
#   2. remove every node_modules, dist and tsconfig.tsbuildinfo (keep nothing)
#   3. pnpm install --frozen-lockfile
#   4. the EXACT build command the workflow runs: pnpm --filter @pemo/api build
#
# If this is green and the workflow invokes this same script, CI green and local
# green cannot disagree except on the environment printed in step 1 — which is the
# point of printing it.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; REPO="$(cd "$HERE/../../.." && pwd)"; cd "$REPO"

# ─── 1. ENVIRONMENT HEADER (R8) — in the first ten lines of any log ───────────
printf '  ── environment ───────────────────────────────────────────────\n'
printf '  node   %s\n' "$(node --version 2>&1)"
printf '  pnpm   %s\n' "$(corepack pnpm --version 2>/dev/null || pnpm --version 2>&1)"
printf '  TZ     %s\n' "${TZ:-<unset, system default $(date +%Z)>}"
printf '  LANG   %s   LC_ALL %s\n' "${LANG:-<unset>}" "${LC_ALL:-<unset>}"
if command -v psql >/dev/null 2>&1 && [ -f database/dev/.env ]; then
  # shellcheck disable=SC1091
  set +u; . database/dev/.env; set -u
  pgver="$(PGPASSWORD="${PEMO_DB_OWNER_PASSWORD:-}" psql -h "${PEMO_DB_HOST:-127.0.0.1}" -p "${PEMO_DB_PORT:-5432}" -U "${PEMO_DB_OWNER_USER:-}" -d "${PEMO_DB_NAME:-}" -Atc 'SHOW server_version' 2>/dev/null || echo unreachable)"
  printf '  pg     %s   lc_collate %s\n' "$pgver" "$(PGPASSWORD="${PEMO_DB_OWNER_PASSWORD:-}" psql -h "${PEMO_DB_HOST:-127.0.0.1}" -p "${PEMO_DB_PORT:-5432}" -U "${PEMO_DB_OWNER_USER:-}" -d "${PEMO_DB_NAME:-}" -Atc 'SHOW lc_collate' 2>/dev/null || echo '?')"
fi
printf '  ──────────────────────────────────────────────────────────────\n'

PNPM() { corepack pnpm "$@" 2>/dev/null || pnpm "$@"; }

# ─── 2. KEEP NOTHING ─────────────────────────────────────────────────────────
find . -name node_modules -type d -prune -not -path './.git/*' -exec rm -rf {} + 2>/dev/null || true
find . \( -name node_modules -o -name .git \) -prune -o \( -name dist -type d -o -name 'tsconfig.tsbuildinfo' \) -print0 2>/dev/null | xargs -0 rm -rf 2>/dev/null || true

# ─── 3 + 4. INSTALL AND BUILD, THE RUNNER'S COMMANDS VERBATIM ─────────────────
PNPM install --frozen-lockfile
PNPM --filter @pemo/api build
printf '  ok     ci-preflight: install --frozen-lockfile + pnpm --filter @pemo/api build (from nothing)\n'
