#!/usr/bin/env bash
#
# NO ORGANIZATION HOLDS A GRANT WITHOUT AN EFFECTIVE ADMINISTRATOR --
# the whole-table check on what the genesis act is supposed to guarantee.
#
# The provisioning act creates a principal, a group, a grant and a membership in
# ONE transaction so that an organization is never left with authority nobody
# can exercise. GEN-028 measured that state and it is the one this catches: a
# grant_administrator grant held by a group with no members reports an
# administrator who does not exist, and the organization is already
# unrecoverable while looking protected.
#
# The write path guarantees it for ACTS. A bulk load, a partial migration or a
# hand-run INSERT bypasses the write path -- 0115 chose a constraint over a
# trigger for exactly that reason -- and this is the part that does not care who
# wrote the row.
#
#   docs/governance/bin/provision-once-only.sh              skip loudly with no database
#   REQUIRE_DB=1 docs/governance/bin/provision-once-only.sh      absent database is FATAL

set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
ENVF="$REPO/database/dev/.env"
fail(){ printf '  FAIL  %s\n' "$1"; exit 1; }

if [ ! -f "$ENVF" ]; then
  msg="no database/dev/.env — cannot reach a database"
  if [ -n "${REQUIRE_DB:-}" ]; then fail "provision-once-only: $msg, and REQUIRE_DB is set"; fi
  printf '  SKIP  provision-once-only: %s\n' "$msg"
  printf '        ^ LOUD SKIP, not a pass. This check did not run. Set REQUIRE_DB=1 to make it fatal.\n'
  exit 0
fi
# shellcheck disable=SC1090
set -a; . "$ENVF"; set +a
export PGPASSWORD="${PEMO_DB_PASSWORD:-}"
PSQL=(psql -h "${PEMO_DB_HOST:-127.0.0.1}" -p "${PEMO_DB_PORT:-5432}" -U "${PEMO_DB_USER:-}" -d "${PEMO_DB_NAME:-}" -tAq)

if ! "${PSQL[@]}" -c 'SELECT 1' >/dev/null 2>&1; then
  msg="database ${PEMO_DB_NAME:-?} at ${PEMO_DB_HOST:-?}:${PEMO_DB_PORT:-?} is unreachable"
  if [ -n "${REQUIRE_DB:-}" ]; then fail "provision-once-only: $msg, and REQUIRE_DB is set"; fi
  printf '  SKIP  provision-once-only: %s\n' "$msg"
  printf '        ^ LOUD SKIP, not a pass. This check did not run. Set REQUIRE_DB=1 to make it fatal.\n'
  exit 0
fi

# LATEST-THEN-EVALUATE on both sides (ADR-013 D4): filtering on effective_to
# before resolving MAX(version) would count a revoked grant or a removed member
# as live -- and this check decides whether an organization looks administrable.
SQL="
WITH cur_grant AS (
  SELECT DISTINCT ON (g.grant_id) g.*, ug.organization_id
    FROM access.scope_grant g JOIN access.user_group ug ON ug.group_id = g.group_id
   ORDER BY g.grant_id, g.version DESC),
live_admin AS (
  SELECT * FROM cur_grant WHERE role = 'grant_administrator'
     AND effective_from <= now() AND (effective_to IS NULL OR effective_to > now())),
cur_mem AS (
  SELECT DISTINCT ON (membership_id) * FROM access.group_membership
   ORDER BY membership_id, version DESC),
live_mem AS (
  SELECT * FROM cur_mem WHERE effective_from <= now()
     AND (effective_to IS NULL OR effective_to > now()))
SELECT a.organization_id || ' -> admin grant ' || a.grant_id || ' held by a group with NO live member'
  FROM live_admin a
 WHERE NOT EXISTS (SELECT 1 FROM live_mem m WHERE m.group_id = a.group_id)"

offenders="$("${PSQL[@]}" -c "$SQL")" || fail "provision-once-only: the scan itself failed to run."

total="$("${PSQL[@]}" -c 'SELECT count(*) FROM access.scope_grant')"
if [ "${total:-0}" -eq 0 ]; then
  fail "provision-once-only: access.scope_grant is EMPTY, so the scan passed vacuously.
        ^ Not a clean result — the check had nothing to look at. Seed the database first."
fi

if [ -n "$offenders" ]; then
  printf '  FAIL  provision-once-only: %s administrator grant(s) held by a group with no live member\n' \
    "$(printf '%s\n' "$offenders" | wc -l)"
  printf '%s\n' "$offenders" | sed 's/^/          /'
  printf '          ^ The organization LOOKS administrable and is not: the guard over effective\n'
  printf '            administrators reports zero, so no grant can be conferred and provisioning\n'
  printf '            cannot re-enter (zero-grants-EVER is permanent). The genesis act creates the\n'
  printf '            membership in the same transaction precisely so this cannot arise from an act.\n'
  exit 1
fi

printf '  ok    every administrator grant has a live member       %s grant assertions scanned\n' "$total"
