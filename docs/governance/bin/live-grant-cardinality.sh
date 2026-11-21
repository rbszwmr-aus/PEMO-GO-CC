#!/usr/bin/env bash
#
# AT MOST ONE LIVE GRANT PER (group, role, node).
#
# WHY THIS CHECK EXISTS, AND WHAT IT REPLACES.
#
# Until 0118 this invariant was held declaratively by
# `scope_grant_no_overlapping_periods`, a gist exclusion. 0118 dropped it, because
# under the ADR-013 assertion model it compared ASSERTED periods and an instance
# collided with its OWN history: version 1 asserts [t0, infinity) and version 2 —
# the revocation — asserts [t0, t1). Every declarative alternative needs "is this
# the latest assertion" as a STORED predicate, which means a flag something must
# flip, which is the UPDATE ADR-013 D2 abolished and pemo_app cannot issue.
#
# The write path holds the invariant now, with a per-key advisory transaction lock
# and the conflict check inside the act (ADR-013 D5/C3, the GEN-016 shape). But
# 0112 chose a CONSTRAINT over a trigger on the record that "a trigger is
# bypassable by a bulk load, which is exactly how bad history arrives" — and a
# write-path guard is bypassable in precisely that way. THIS is the part that is
# not: it reads the whole table and does not care who wrote the row.
#
# So the trade 0118 makes is prevention -> detection for the bulk-load case. The
# ambiguity is FOUND rather than forbidden. That is a real reduction and the
# migration states it plainly rather than glossing it.
#
# IT IS HYGIENE, NOT SAFETY, AND THE DISTINCTION IS WHY THIS IS A CHECK AND NOT A
# CONSTRAINT. GEN-023 measured that rights are a UNION and MONOTONIC (ADR-012 D5):
# two live identical grants authorize exactly what one does. Nothing is unsafe
# when one slips through; the history merely acquires two answers where it should
# have one, and "what was in force then" is the question effective dating exists
# to answer.
#
# WHAT IT DOES NOT CHECK, DELIBERATELY. Two DIFFERENT groups granting the same
# role at the same node is LEGAL (ADR-012 D5) and the reader returns both. The key
# below is (group, role, node) and never mentions a principal, so the design case
# cannot be caught by it. A version keyed on the principal would red on the
# shipped seed, which carries exactly that shape.
#
#   docs/governance/bin/live-grant-cardinality.sh          skip loudly with no database
#   REQUIRE_DB=1 docs/governance/bin/live-grant-cardinality.sh   absent database is FATAL

set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
ENVF="$REPO/database/dev/.env"

fail(){ printf '  FAIL  %s\n' "$1"; exit 1; }

if [ ! -f "$ENVF" ]; then
  msg="no database/dev/.env — cannot reach a database"
  if [ -n "${REQUIRE_DB:-}" ]; then fail "live-grant-cardinality: $msg, and REQUIRE_DB is set"; fi
  printf '  SKIP  live-grant-cardinality: %s\n' "$msg"
  printf '        ^ LOUD SKIP, not a pass. This check did not run. Set REQUIRE_DB=1 to make it fatal.\n'
  exit 0
fi

# shellcheck disable=SC1090
set -a; . "$ENVF"; set +a
export PGPASSWORD="${PEMO_DB_PASSWORD:-}"
PSQL=(psql -h "${PEMO_DB_HOST:-127.0.0.1}" -p "${PEMO_DB_PORT:-5432}" -U "${PEMO_DB_USER:-}" -d "${PEMO_DB_NAME:-}" -tAq)

if ! "${PSQL[@]}" -c 'SELECT 1' >/dev/null 2>&1; then
  msg="database ${PEMO_DB_NAME:-?} at ${PEMO_DB_HOST:-?}:${PEMO_DB_PORT:-?} is unreachable"
  if [ -n "${REQUIRE_DB:-}" ]; then fail "live-grant-cardinality: $msg, and REQUIRE_DB is set"; fi
  printf '  SKIP  live-grant-cardinality: %s\n' "$msg"
  printf '        ^ LOUD SKIP, not a pass. This check did not run. Set REQUIRE_DB=1 to make it fatal.\n'
  exit 0
fi

# ─── the scan ────────────────────────────────────────────────────────────────
#
# LATEST-THEN-EVALUATE, in that order (ADR-013 D4). `effective_to` CHANGES between
# assertions of one instance, so filtering on it BEFORE resolving the latest
# version would discard the revocation and count a revoked grant as live — which
# is the exact bug this model exists to prevent, reproduced inside its own
# detector. DISTINCT ON resolves first; the liveness test runs after.
SQL="
WITH current_assertion AS (
  SELECT DISTINCT ON (grant_id) grant_id, group_id, role, node_kind, node_id, effective_from, effective_to, version
    FROM access.scope_grant
   ORDER BY grant_id, version DESC
),
live AS (
  SELECT * FROM current_assertion
   WHERE effective_from <= now() AND (effective_to IS NULL OR effective_to > now())
)
SELECT group_id || ' / ' || role || ' / ' || node_kind || ':' || node_id
       || '  -> ' || count(*) || ' live grants: ' || string_agg(grant_id, ', ' ORDER BY grant_id)
  FROM live
 GROUP BY group_id, role, node_kind, node_id
HAVING count(*) > 1"

offenders="$("${PSQL[@]}" -c "$SQL")" || fail "live-grant-cardinality: the scan itself failed to run."

# VACUITY REFUSAL. A scan over an empty table reports no offenders and would pass
# for the wrong reason — the empty-oracle shape this corpus keeps catching. The
# seed always carries grants, so zero rows means the check did not look at the
# thing it claims to check.
total="$("${PSQL[@]}" -c 'SELECT count(*) FROM access.scope_grant')"
if [ "${total:-0}" -eq 0 ]; then
  fail "live-grant-cardinality: access.scope_grant is EMPTY, so the scan passed vacuously.
        ^ Not a clean result — the check had nothing to look at. Seed the database first."
fi

if [ -n "$offenders" ]; then
  printf '  FAIL  live-grant-cardinality: %s (group, role, node) key(s) hold more than one LIVE grant\n' \
    "$(printf '%s\n' "$offenders" | wc -l)"
  printf '%s\n' "$offenders" | sed 's/^/          /'
  printf '          ^ "What was in force then" now has two answers for one key. Until 0118 the\n'
  printf '            exclusion constraint made this unwritable; the write-path advisory guard\n'
  printf '            replaces it for acts, and a bulk load bypasses that guard — which is what\n'
  printf '            this check exists to catch. Two DIFFERENT groups at one node is legal and\n'
  printf '            is not what fired here: this key names one group.\n'
  exit 1
fi

printf '  ok    at most one live grant per key                       %s grant assertions scanned\n' "$total"
