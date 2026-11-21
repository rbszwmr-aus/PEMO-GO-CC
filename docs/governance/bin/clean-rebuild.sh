#!/usr/bin/env bash
#
# REBUILD FROM NOTHING — node_modules included (GEN-048 R2).
#
# `prove.sh`'s "from-nothing" rebuild dropped the database schemas and rebuilt
# dist/, and kept node_modules. CI, which keeps nothing, was red for six runs on a
# tsconfig reference every local build had silently supplied. A rebuild that
# keeps node_modules is not from nothing: `[a-rebuild-that-keeps-node_modules-is-not-from-nothing]`.
#
# Removes every node_modules in the workspace, reinstalls with the frozen lockfile
# (offline when the store has everything — the same store CI hard-links from),
# then builds apps/api exactly as CI does: `pnpm --filter @pemo/api build`.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; REPO="$(cd "$HERE/../../.." && pwd)"; cd "$REPO"
find . -name node_modules -type d -prune -not -path './.git/*' -exec rm -rf {} +
# AND EVERY BUILD OUTPUT. The first version kept dist/, and the R2 bite stayed
# green: a reference removed from apps/api's tsconfig was satisfied by the
# notices dist the previous run had built — the GEN-039 dist hazard at workspace
# scale. Kept output is kept state; from nothing keeps none of it.
find . \( -name node_modules -o -name .git \) -prune -o \( -name dist -type d -o -name tsconfig.tsbuildinfo \) -print0 | xargs -0 rm -rf
pnpm install --frozen-lockfile --offline >/dev/null 2>&1 || pnpm install --frozen-lockfile >/dev/null
pnpm --filter @pemo/api build
