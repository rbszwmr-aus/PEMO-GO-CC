#!/usr/bin/env bash
# PEMO database bootstrap (Go build).
#
# The Node build's version needed bash, psql and pnpm. The same steps now live
# in the Go CLI, so this works anywhere the backend builds (no psql needed):
#
#   1. database/roles/000-roles.sql      ensure roles (pemo.env from PEMO_ENV)
#   2. login passwords                    pemo_app and pemo_app_<schema>
#   3. migrations                         as the owner, with the same ledger
#   4. database/roles/010-grants.sql     per-module grants
#   5. --with-seed                        base seeds + default scenarios
#
# Usage: database/bootstrap.sh [--with-seed]
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
BIN="$REPO/backend/bin/pemo"
if [ ! -x "$BIN" ] && [ ! -x "$BIN.exe" ]; then
  (cd "$REPO/backend" && go build -o bin/ ./cmd/...)
fi
[ -x "$BIN" ] || BIN="$BIN.exe"
exec "$BIN" -root "$REPO" bootstrap "$@"
