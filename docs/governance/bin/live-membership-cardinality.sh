#!/usr/bin/env bash
#
# AT MOST ONE LIVE MEMBERSHIP PER (group_id, principal_id).
#
# WHY THIS CHECK EXISTS, AND WHAT IT REPLACES.
#
# Until 0123 this invariant was held declaratively by
# `group_membership_no_overlapping_periods`. 0123 dropped it, because under the
# ADR-013 assertion model it compared ASSERTED periods and an instance collided
# with its OWN removal: version 1 asserts [t0, infinity) and version 2 -- the
# removal -- asserts [t0, t1). Every declarative alternative needs "is this the
# latest assertion" as a STORED predicate, which means a flag something must
# flip, which is the UPDATE ADR-013 D2 abolished and pemo_app cannot issue.
#
# The write path holds the invariant now (a per-(group, principal) advisory
# transaction lock with the check inside the act). But 0115 chose a CONSTRAINT
# over a trigger on the record that "a trigger is bypassable by a bulk load,
# which is exactly how bad history arrives" -- and a write-path guard is
# bypassable in precisely that way. THIS is the part that is not: it reads the
# whole table and does not care who wrote the row.
#
# WHY A DUPLICATE MATTERS HERE MORE THAN IT DID FOR GRANTS. group_membership is
# on the JOIN side of grant resolution, so it is a MULTIPLIER: two live
# memberships of one group return the SAME GRANT TWICE, where a duplicate grant
# would merely be two distinct grants a monotonic union absorbs. GEN-029 measured
# it -- 3 rows for 2 grants. No authorization decision changes, but
# `scope.grants` stops being a set, which later code will assume without
# checking. findGrantsAsAt's restored DISTINCT is the reader-side defence; this
# is the data-side one.
#
#   docs/governance/bin/live-membership-cardinality.sh          skip loudly with no database
#   REQUIRE_DB=1 docs/governance/bin/live-membership-cardinality.sh   absent database is FATAL

set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
ENVF="$REPO/database/dev/.env"

fail(){ printf '  FAIL  %s\n' "$1"; exit 1; }

if [ ! -f "$ENVF" ]; then
  msg="no database/dev/.env — cannot reach a database"
  if [ -n "${REQUIRE_DB:-}" ]; then fail "live-membership-cardinality: $msg, and REQUIRE_DB is set"; fi
  printf '  SKIP  live-membership-cardinality: %s\n' "$msg"
  printf '        ^ LOUD SKIP, not a pass. This check did not run. Set REQUIRE_DB=1 to make it fatal.\n'
  exit 0
fi

# shellcheck disable=SC1090
set -a; . "$ENVF"; set +a
export PGPASSWORD="${PEMO_DB_PASSWORD:-}"
PSQL=(psql -h "${PEMO_DB_HOST:-127.0.0.1}" -p "${PEMO_DB_PORT:-5432}" -U "${PEMO_DB_USER:-}" -d "${PEMO_DB_NAME:-}" -tAq)

if ! "${PSQL[@]}" -c 'SELECT 1' >/dev/null 2>&1; then
  msg="database ${PEMO_DB_NAME:-?} at ${PEMO_DB_HOST:-?}:${PEMO_DB_PORT:-?} is unreachable"
  if [ -n "${REQUIRE_DB:-}" ]; then fail "live-membership-cardinality: $msg, and REQUIRE_DB is set"; fi
  printf '  SKIP  live-membership-cardinality: %s\n' "$msg"
  printf '        ^ LOUD SKIP, not a pass. This check did not run. Set REQUIRE_DB=1 to make it fatal.\n'
  exit 0
fi

# LATEST-THEN-EVALUATE, in that order (ADR-013 D4). `effective_to` CHANGES between
# assertions of one instance, so filtering on it BEFORE resolving the latest
# version would discard the removal and count a removed membership as live --
# the exact bug this model exists to prevent, reproduced inside its own detector.
SQL="
WITH current_assertion AS (
  SELECT DISTINCT ON (membership_id)
         membership_id, group_id, principal_id, effective_from, effective_to, version
    FROM access.group_membership
   ORDER BY membership_id, version DESC
),
live AS (
  SELECT * FROM current_assertion
   WHERE effective_from <= now() AND (effective_to IS NULL OR effective_to > now())
)
SELECT group_id || ' / ' || principal_id
       || '  -> ' || count(*) || ' live memberships: ' || string_agg(membership_id, ', ' ORDER BY membership_id)
  FROM live
 GROUP BY group_id, principal_id
HAVING count(*) > 1"

offenders="$("${PSQL[@]}" -c "$SQL")" || fail "live-membership-cardinality: the scan itself failed to run."

# VACUITY REFUSAL. A scan over an empty table reports no offenders and would pass
# for the wrong reason. The seed always carries memberships, so zero rows means
# the check did not look at the thing it claims to check.
total="$("${PSQL[@]}" -c 'SELECT count(*) FROM access.group_membership')"
if [ "${total:-0}" -eq 0 ]; then
  fail "live-membership-cardinality: access.group_membership is EMPTY, so the scan passed vacuously.
        ^ Not a clean result — the check had nothing to look at. Seed the database first."
fi

if [ -n "$offenders" ]; then
  printf '  FAIL  live-membership-cardinality: %s (group, principal) pair(s) hold more than one LIVE membership\n' \
    "$(printf '%s\n' "$offenders" | wc -l)"
  printf '%s\n' "$offenders" | sed 's/^/          /'
  printf '          ^ This table is a JOIN MULTIPLIER: a duplicate returns the SAME GRANT TWICE from\n'
  printf '            findGrantsAsAt, so scope.grants stops being a set. Until 0123 the exclusion\n'
  printf '            constraint made this unwritable; the write-path advisory guard replaces it for\n'
  printf '            acts, and a bulk load bypasses that guard — which is what this catches.\n'
  exit 1
fi

printf '  ok    at most one live membership per pair              %s membership assertions scanned\n' "$total"
