#!/usr/bin/env bash
#
# THE SEED REPRODUCES FROM NOTHING.
#
# `migrate; seed` against an empty database must complete AND leave a complete
# world. Nothing asserted this, and its absence bit three PIDs: GEN-003 could not
# build a world at all; GEN-006's first full run read 163 pass / 7 fail where the
# seven were the missing world and not the change under test; GEN-007 was the PID
# that finally fixed the seed.
#
# IT ANCHORS ON THE TWO TABLES THE ABORT LEFT AT ZERO, not on "no error".
# `pnpm run seed` exiting non-zero is the obvious half; the half that matters is
# that a seed can exit non-zero PART WAY and leave a world that looks populated.
# When the F1 defect fired, all ten base seeds had applied and both of these read
# 0, because every scenario after the aborting one never ran:
#
#     dev_scaffold.screen_content   — every screen's content
#     home_safety.safety_event      — every safety event
#
# So those two are the assertion. "No error" is the empty assertion that let the
# defect survive in the first place; a specific expected outcome is what catches
# its own decay.
#
#   docs/governance/bin/seed-reproduces.sh          skip loudly with no database
#   REQUIRE_DB=1 docs/governance/bin/seed-reproduces.sh   absent database is FATAL
#
# REQUIRE_DB is the REQUIRE_DEPCRUISE lesson: in the environment that matters, a
# check that can answer "nothing to check" must be made to fail instead.

set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
ENVF="$REPO/database/dev/.env"

fail(){ printf '  FAIL  %s\n' "$1"; exit 1; }

if [ ! -f "$ENVF" ]; then
  msg="no database/dev/.env — cannot reach a database"
  if [ -n "${REQUIRE_DB:-}" ]; then fail "$msg, and REQUIRE_DB is set"; fi
  printf '  SKIP  seed-reproduces-from-nothing: %s\n' "$msg"
  printf '        ^ LOUD SKIP, not a pass. This check did not run. Set REQUIRE_DB=1 to make it fatal.\n'
  exit 0
fi

# shellcheck disable=SC1090
set -a; . "$ENVF"; set +a
export PGPASSWORD="${PEMO_DB_PASSWORD:-}"
PSQL=(psql -h "${PEMO_DB_HOST:-127.0.0.1}" -p "${PEMO_DB_PORT:-5432}" -U "${PEMO_DB_USER:-}" -d "${PEMO_DB_NAME:-}" -tAq)
# The DROP is OWNER work: pemo_app owns none of the schemas migrate creates, so a
# DROP SCHEMA as pemo_app aborts (one atomic statement over many schemas fails on
# the first it cannot drop and rolls the whole thing back, leaving EVERYTHING). The
# reset drops as pemo_owner, the role that created them — the same role bootstrap.sh
# migrates as. PGPASSWORD is switched per-invocation below so the app password is
# not the owner's.
PSQL_OWNER=(psql -h "${PEMO_DB_HOST:-127.0.0.1}" -p "${PEMO_DB_PORT:-5432}" -U "${PEMO_DB_OWNER_USER:-}" -d "${PEMO_DB_NAME:-}" -tAq)


# THE GUARD RUNS BEFORE THE CONNECTIVITY PROBE, and the ordering is the whole
# point. It was written after the probe first, and both of its proofs then
# "passed" for the wrong reason: an unreachable wrong target skipped green and
# the guard never executed at all. A safety check that a bad target can route
# around is not a safety check. This is a pure string test over configuration —
# it needs no database, so it goes first, before anything reaches out.
# ─── the destructive-drop guard ──────────────────────────────────────────────
# The next line drops every schema. Before it runs, confirm WHAT DATABASE THIS
# ACTUALLY IS — not what a variable claims it is.
#
# PEMO_ENV=development is a LABEL. The connection target is the thing itself. The
# misconfiguration that matters here is not a missing label: it is a correct
# PEMO_ENV=development sitting beside a connection string pasted from staging,
# which passes every label check and drops the wrong database. So the load-bearing
# test is the target — dbname and host — and PEMO_ENV is only a cheap extra.
#
# Read the artifact, not the summary, applied to a destructive act.
#
# These two patterns are deliberately narrow and deliberately literal: widening
# them is a visible diff someone has to justify, which is the point.
DEV_DB_PATTERN='^pemo_dev'
DEV_HOST_PATTERN='^(127\.0\.0\.1|localhost|::1)$'

target_db="${PEMO_DB_NAME:-}"
target_host="${PEMO_DB_HOST:-}"

if ! printf '%s' "$target_db" | grep -qE "$DEV_DB_PATTERN"; then
  fail "REFUSING to drop schemas: database name '$target_db' does not match $DEV_DB_PATTERN.
        This check reads the CONNECTION TARGET, not PEMO_ENV — a label can be right while the
        connection points somewhere else, and that is the case that destroys data."
fi
if ! printf '%s' "$target_host" | grep -qE "$DEV_HOST_PATTERN"; then
  fail "REFUSING to drop schemas: host '$target_host' is not loopback ($DEV_HOST_PATTERN).
        A development database is reached over loopback; anything else is a remote target and
        this script destroys what it points at."
fi
if [ "${PEMO_ENV:-}" != "development" ]; then
  fail "REFUSING to drop schemas: PEMO_ENV is '${PEMO_ENV:-}', not 'development'.
        (The target checks above are the load-bearing ones; this is the cheap extra.)"
fi

if ! "${PSQL[@]}" -c 'SELECT 1' >/dev/null 2>&1; then
  msg="database ${PEMO_DB_NAME:-?} at ${PEMO_DB_HOST:-?}:${PEMO_DB_PORT:-?} is unreachable"
  if [ -n "${REQUIRE_DB:-}" ]; then fail "$msg, and REQUIRE_DB is set"; fi
  printf '  SKIP  seed-reproduces-from-nothing: %s\n' "$msg"
  printf '        ^ LOUD SKIP, not a pass. This check did not run. Set REQUIRE_DB=1 to make it fatal.\n'
  exit 0
fi

# FROM NOTHING means from nothing: drop EVERY schema the database holds, DERIVED
# from the catalog rather than a hand-kept list. The previous form named seven
# schemas by hand; the database had grown to ten (`helpdesk`, `notices`,
# `service_case` were missing), so "from nothing" had quietly left three schemas
# populated ever since they were added, and a re-seed against the leftover rows
# tripped `audit_event_group_id_fkey` the moment GEN-055 made those rows
# load-bearing. A hand-kept list of what to drop certifies the LIST, not the
# database (`[correlated-lists-certify-nothing]`,
# third instance of the class). `pg_namespace` cannot fall behind a migration.
# The dev-only / not-production guard above still gates whether we reach this line
# at all — the derivation changes WHAT is dropped, never WHETHER it is safe to drop.
drop_list="$(PGPASSWORD="${PEMO_DB_OWNER_PASSWORD:-}" "${PSQL_OWNER[@]}" -c "SELECT string_agg(quote_ident(nspname), ', ' ORDER BY nspname) FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname NOT IN ('information_schema', 'public');")"
if [ -n "$drop_list" ]; then
  PGPASSWORD="${PEMO_DB_OWNER_PASSWORD:-}" "${PSQL_OWNER[@]}" -c "DROP SCHEMA IF EXISTS $drop_list CASCADE;" >/dev/null 2>&1
fi

# POST-CONDITION: the reset must have left NOTHING but `public`. If any schema
# survived, "from nothing" was partial and every downstream assertion runs against
# a half-old world — which is how the hand-kept seven-schema list hid for as long
# as it did. Naming the survivor turns a later, mysterious FK into a precise
# finding, and is the bite for the derivation: revert the drop to a hand-kept list
# that misses a schema and this reds naming it.
leftover="$(PGPASSWORD="${PEMO_DB_OWNER_PASSWORD:-}" "${PSQL_OWNER[@]}" -c "SELECT string_agg(nspname, ', ' ORDER BY nspname) FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname NOT IN ('information_schema', 'public');")"
[ -z "$leftover" ] || fail "schemas SURVIVED the reset — 'from nothing' left: $leftover. The drop set does not cover every schema the database holds; derive it from the catalog, do not hand-keep it."

# Through the ONE ENTRYPOINT, not raw migrate+seed. Dropping the schemas drops
# pemo_app's grants with them, so a bare `migrate` would leave a database the
# application cannot read. bootstrap.sh is ensure-roles -> migrate ->
# apply-grants, which is the whole point of there being one entrypoint.
( cd "$REPO" && database/bootstrap.sh ) >/tmp/seed-repro-migrate.$$ 2>&1 \
  || { sed 's/^/        | /' /tmp/seed-repro-migrate.$$ | tail -8; rm -f /tmp/seed-repro-migrate.$$; fail "bootstrap did not complete"; }
rm -f /tmp/seed-repro-migrate.$$

( cd "$REPO/apps/api" && pnpm run seed ) >/tmp/seed-repro-seed.$$ 2>&1 || {
  grep -E 'error:|constraint:' /tmp/seed-repro-seed.$$ | head -3 | sed 's/^/        | /'
  rm -f /tmp/seed-repro-seed.$$
  fail "seed did not complete — the world is partial, and every scenario after the failing one never ran"
}
rm -f /tmp/seed-repro-seed.$$

scaffold=$("${PSQL[@]}" -c 'SELECT count(*) FROM dev_scaffold.screen_content;' 2>/dev/null || echo 0)
events=$("${PSQL[@]}"   -c 'SELECT count(*) FROM home_safety.safety_event;'   2>/dev/null || echo 0)

[ "${scaffold:-0}" -gt 0 ] || fail "dev_scaffold.screen_content is empty after seed — seed exited 0 but the scenario layer did not run"
[ "${events:-0}"   -gt 0 ] || fail "home_safety.safety_event is empty after seed — seed exited 0 but the scenario layer did not run"

printf '  ok    %-52s scaffold=%s events=%s\n' "seed reproduces from nothing" "$scaffold" "$events"
