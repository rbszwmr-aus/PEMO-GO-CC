#!/usr/bin/env bash
#
# APPLY A DDL MUTATION TO THE DEV DATABASE, RUN A CHECK, RESTORE — ALWAYS (GEN-053 D4).
#
#   with-ddl-mutation.sh "<mutate sql>" "<restore sql>" -- <command...>
#
# The file-mutation harness cannot express the DDL/grants class: dropping a
# UNIQUE constraint or granting UPDATE to pemo_app changes the DATABASE, and every
# such bite since GEN-037 lived only in prose. This runs the mutation as the owner
# role — derived from database/dev/.env, never a hand-named container — runs the
# command, and restores in a trap, so a killed run cannot leave the schema mutated.
# The restore is VERIFIED: the restore SQL must succeed, and a probe re-runs the
# mutation's inverse expectation is left to the caller (a constraint that came back
# is what the next baseline proves).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; REPO="$(cd "$HERE/../../.." && pwd)"
MUT="$1"; RESTORE="$2"; shift 2; [ "${1:-}" = "--" ] && shift
set -a; . "$REPO/database/dev/.env"; set +a
psql_owner(){ PGPASSWORD="$PEMO_DB_OWNER_PASSWORD" psql -v ON_ERROR_STOP=1 -q -h "$PEMO_DB_HOST" -p "$PEMO_DB_PORT" -U "$PEMO_DB_OWNER_USER" -d "$PEMO_DB_NAME" -c "$1"; }
RESTORED=0
restore(){ [ "$RESTORED" = 1 ] && return 0; RESTORED=1
  # THE RESTORE IS THE POINT. A DDL bite whose test leaves rows the constraint
  # would have refused cannot put the constraint back — and GEN-053 found the
  # runner counting exactly that as "proven" while three constraints stayed gone.
  # The failure is printed on STDOUT with the database's own reason, and the
  # runner treats that line as a FAIL whatever else the run said.
  if ! err=$(psql_owner "$RESTORE" 2>&1); then
    printf '  RESTORE FAILED: %s\n  because: %s\n' "$RESTORE" "$(printf '%s' "$err" | grep -E 'ERROR|DETAIL' | head -2 | tr '\n' ' ')"
    exit 9
  fi; }
trap restore EXIT INT TERM HUP
psql_owner "$MUT" || { printf '  with-ddl-mutation: the mutation did not apply: %s\n' "$MUT" >&2; exit 3; }
"$@"; got=$?
restore
exit $got
