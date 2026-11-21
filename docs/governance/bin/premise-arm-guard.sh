#!/usr/bin/env bash
#
# grants-complete.sh's PREMISE ARM cannot be deleted without something noticing.
#
# THE HOLE THIS CLOSES. GEN-012 added the premise arm — pemo_app is not a
# superuser, holds no forbidden attribute, owns nothing — because a superuser
# bypasses privilege checks and acquires nothing that appears in
# role_table_grants, so the EXCESS arm was blind to the one drift that fully
# defeats ADR-010 D1's fourth property. It had been green over a rewritable,
# erasable audit since GEN-010.
#
# But nothing asserted the arm STAYS. Delete it and the battery still passed
# 22/22 — a principle is not a control, turned on the control itself. This is the
# control for the control: it flips the attribute and requires grants-complete.sh
# to notice.
#
# WHY SUPERUSER AND NEVER OWNERSHIP. SUPERUSER is reversible with one statement.
# Ownership is not: GEN-012 measured that transferring a table to pemo_app and
# back DROPS the grants an owner does not need, so the "restore" leaves the app
# unable to read its own audit and the MISSING arm reds for an unrelated reason.
# A guard whose restore breaks something else is not a guard.
#
# THE PROBE MUST BITE. After flipping, this confirms the flip actually took
# effect before asserting the red — a mutation that silently failed to apply
# would make grants-complete.sh's green look like a passing guard when the guard
# had never been tested at all.
#
#   docs/governance/bin/premise-arm-guard.sh        loud skip with no database
#   REQUIRE_DB=1 …                                  absent database is FATAL

set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
ENVF="${PEMO_GOVERNANCE_ENV:-$REPO/database/dev/.env}"

fail(){ printf '  FAIL  premise-arm-guard: %s\n' "$1"; exit 1; }

[ -f "$ENVF" ] || {
  printf '  SKIP  premise-arm-guard: no database/dev/.env\n        ^ LOUD SKIP, not a pass. Set REQUIRE_DB=1 to make it fatal.\n'
  [ -n "${REQUIRE_DB:-}" ] && fail "no database/dev/.env, and REQUIRE_DB is set"; exit 0; }
# shellcheck disable=SC1090
set -a; . "$ENVF"; set +a

# ─── THE DESTRUCTIVE-TARGET GUARD, AND IT RUNS BEFORE ANY NETWORK REACH ──────
# This script ALTERs a cluster-global role. `[destructive-target-confirmed]` and
# its ordering amendment: the confirmation is a pure-configuration check placed
# BEFORE anything reaches out, because a guard sitting downstream of a
# reachability probe is bypassable — a wrong target that happens to be
# unreachable short-circuits into a skip and the guard never executes.
DEV_DB_PATTERN='^pemo_dev'
# /.*  — unix socket directory (private initdb, listen_addresses empty). TCP still must be loopback.
DEV_HOST_PATTERN='^(127\.0\.0\.1|localhost|::1|/.*)$'
target_db="${PEMO_DB_NAME:-}"
target_host="${PEMO_DB_HOST:-}"

printf '%s' "$target_db" | grep -qE "$DEV_DB_PATTERN" || fail \
  "REFUSING to alter a role: database name '$target_db' does not match $DEV_DB_PATTERN.
        This reads the CONNECTION TARGET, not PEMO_ENV — a label can be right while the
        connection points elsewhere, and that is the case that matters."
printf '%s' "$target_host" | grep -qE "$DEV_HOST_PATTERN" || fail \
  "REFUSING to alter a role: host '$target_host' is not loopback ($DEV_HOST_PATTERN).
        A role is CLUSTER-GLOBAL: altering one on a shared or remote cluster reaches
        every database on it, not just this one."
[ "${PEMO_ENV:-}" = "development" ] || fail \
  "REFUSING to alter a role: PEMO_ENV is '${PEMO_ENV:-}', not 'development'.
        (The target checks above are the load-bearing ones; this is the cheap extra.)"

export PGPASSWORD="${PEMO_DB_OWNER_PASSWORD:-}"
PSQL=(psql -h "$target_host" -p "${PEMO_DB_PORT:-5432}" -U "${PEMO_DB_OWNER_USER:-}" -d "$target_db" -tAq)
# Flip one production module login (lean). grants-complete iterates every
# production login, so a SUPERUSER on this one must turn it red.
LOGIN_PREFIX="${PEMO_DB_LOGIN_PREFIX:-pemo_app_}"
APP="${PEMO_PROBE_LOGIN:-${LOGIN_PREFIX}property}"
MODEL="${PEMO_APP_ROLE_MODEL:-pemo_app}"
ident(){ case "$1" in ''|*[!a-zA-Z0-9_]*) fail "$2 is not a safe SQL identifier: $1";; esac; }
ident "$APP" PEMO_PROBE_LOGIN
ident "$MODEL" PEMO_APP_ROLE_MODEL

"${PSQL[@]}" -c 'SELECT 1' >/dev/null 2>&1 || {
  msg="database ${target_db:-?} at ${target_host:-?}:${PEMO_DB_PORT:-?} is unreachable"
  [ -n "${REQUIRE_DB:-}" ] && fail "$msg, and REQUIRE_DB is set"
  printf '  SKIP  premise-arm-guard: %s\n        ^ LOUD SKIP, not a pass. This check did not run.\n' "$msg"; exit 0; }

# ─── THE ATTRIBUTE SET, DERIVED FROM THE DECLARATION ─────────────────────────
# grants-complete.sh derives what it asserts from database/roles/000-roles.sql;
# this derives what it FLIPS from the same line, so the guard cannot fall behind
# the arm it guards. Declare a new NO<ATTR> there and it is exercised here the
# same day — where a hand-written list would leave the new attribute unguarded,
# which is precisely the shape that left 4 of 5 unguarded before this change.
#
# OWNERSHIP IS NOT HERE AND MUST NOT BE. It is not a role attribute, and GEN-012
# measured that it is not reversible: transferring a table to the app role and
# back DROPS the grants an owner does not need, so the restore leaves the app
# unable to read its own audit and grants-complete reds for an unrelated reason.
# The arm asserts ownership; this guard cannot exercise that assertion, and §6 of
# the GEN-021 report records the gap rather than pretending otherwise.
ROLES_SQL="$REPO/database/roles/000-roles.sql"
[ -f "$ROLES_SQL" ] || fail "$ROLES_SQL is missing — the attribute set is derived from it"
DECL="$(grep -iE "^[[:space:]]*ALTER[[:space:]]+ROLE[[:space:]]+$MODEL\b" "$ROLES_SQL" | head -1)"
[ -n "$DECL" ] || fail "no ALTER ROLE declaration for $MODEL in $ROLES_SQL.
        The attributes are DERIVED, never assumed. No declaration means nothing to
        flip, and a guard that flips nothing passes vacuously."
ATTRS="$(printf '%s' "$DECL" | tr 'a-z' 'A-Z' \
  | grep -oE '\bNO(SUPERUSER|CREATEDB|CREATEROLE|BYPASSRLS)\b' | sed 's/^NO//' | sort -u)"
[ -n "$ATTRS" ] || fail "the declaration names no reversible attribute, so this guard would assert nothing:
        $DECL"

col_for(){ case "$1" in
  SUPERUSER) echo rolsuper;; CREATEDB) echo rolcreatedb;;
  CREATEROLE) echo rolcreaterole;; BYPASSRLS) echo rolbypassrls;;
  *) echo "";; esac; }
held(){ "${PSQL[@]}" -c "SELECT $(col_for "$1") FROM pg_roles WHERE rolname='$APP';"; }
# The trap restores EVERY attribute this guard can flip, not only the last one:
# a failure part-way through the loop must not leave an earlier flip standing.
restore(){ for a in $ATTRS; do "${PSQL[@]}" -c "ALTER ROLE $APP NO$a;" >/dev/null 2>&1 || true; done; }
trap restore EXIT INT TERM HUP

# ─── PRE-FLIGHT ──────────────────────────────────────────────────────────────
# An interrupted earlier run could have left the role flipped. Testing a guard
# against an already-tainted role proves nothing: grants-complete.sh would red
# for a state this run did not create, and the red would look like a pass.
for a in $ATTRS; do
  [ "$(held "$a")" = "f" ] || fail \
    "pre-flight: $APP ALREADY holds $a before this guard flipped anything.
        A previous run was interrupted, or the role model is genuinely breached.
        Refusing to test a guard against a tainted role — run
        'ALTER ROLE $APP NO$a;' and investigate why it was set."
done

# grants-complete.sh must be GREEN to begin with, or the red below proves nothing.
if ! "$HERE/grants-complete.sh" >/dev/null 2>&1; then
  fail "pre-flight: grants-complete.sh already fails before the flip, so its failure
        after the flip would not be attributable to the flip. Fix that first."
fi

# ─── ONE FLIP PER ATTRIBUTE ──────────────────────────────────────────────────
# EACH attribute gets its own flip → red → restore → green. Exercising only
# SUPERUSER left the other three assertions with no oracle at all: deleting the
# bypassrls line would have gone unnoticed, which is the GEN-012 failure one
# attribute over.
for a in $ATTRS; do
  "${PSQL[@]}" -c "ALTER ROLE $APP $a;" >/dev/null || fail "could not flip $APP to $a"

  # [probe-must-bite]: confirm the mutation LANDED before believing what follows.
  # A flip that silently failed would leave grants-complete.sh green, and that
  # green would read as "the guard is fine" when it was never exercised.
  [ "$(held "$a")" = "t" ] || fail "the $a flip did not take effect — $(col_for "$a") is still false.
        The red below would have been asserted against an unchanged database."

  if "$HERE/grants-complete.sh" >/dev/null 2>&1; then
    fail "grants-complete.sh PASSED while $APP holds $a.
        The premise arm is missing, or no longer asserts $(col_for "$a"). A role holding
        $a is outside the posture 000-roles.sql declares, and for SUPERUSER in particular
        it bypasses every table permission while acquiring nothing visible in
        role_table_grants — so the audit is rewritable and erasable right now."
  fi

  "${PSQL[@]}" -c "ALTER ROLE $APP NO$a;" >/dev/null || fail "could not restore $APP to NO$a"
  [ "$(held "$a")" = "f" ] || fail "could not restore $APP to NO$a — the role is left flipped."

  "$HERE/grants-complete.sh" >/dev/null 2>&1 || fail \
    "grants-complete.sh still fails after $a was restored.
        The red above is therefore not attributable to the $a flip, and this guard has
        proven nothing about it."
done

printf '  ok    %-52s %s\n' "premise arm bites on every reversible attribute" \
  "$(printf '%s' "$ATTRS" | tr '\n' ',' | sed 's/,$//')"
