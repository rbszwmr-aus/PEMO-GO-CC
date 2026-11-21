#!/usr/bin/env bash
#
# ONE DDL BITE, END TO END (GEN-053 D4): drop or grant, run ONE test file, restore, judge.
#
#   ddl-bite.sh "<mutate sql>" "<restore sql>" <test file> "<case name prefix>"
#
# Exits 1 printing `NAMED RED: <prefix>` when the named case — and only by name —
# went red with the mutation applied; exits 0 (the guard did not fire) otherwise.
# The runner's `guard` kind reads exactly that.
#
# Why a script and not an inline `bash -c`: the first two attempts at inlining
# this failed for two different quoting reasons — JSON-escaped quotes became
# literal, then a double-quoted outer shell expanded `$(node …)` and EXECUTED the
# TAP output as commands. A command that crosses three quoting layers is a
# command nobody can read; four plain arguments is what a manifest entry should be.
#
# The test run is CAPTURED before it is searched: a `grep -q` on the live pipe
# exits at its first match and kills `node --test` with SIGPIPE before its
# teardown runs — the duplicate the dropped constraint admitted then survives
# and the constraint cannot be put back. Three constraints went missing that way.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; REPO="$(cd "$HERE/../../.." && pwd)"
MUT="$1"; RESTORE="$2"; TESTFILE="$3"; PREFIX="$4"
cd "$REPO" || exit 2
out="$("$HERE/with-ddl-mutation.sh" "$MUT" "$RESTORE" -- \
        node --test --test-reporter=tap --env-file=database/dev/.env "$TESTFILE" 2>&1)"
printf '%s\n' "$out" | grep -q 'RESTORE FAILED' && { printf '%s\n' "$out" | grep -E 'RESTORE FAILED|because'; exit 9; }
if printf '%s\n' "$out" | grep -E '^not ok [0-9]+ - ' | grep -qF -- "- $PREFIX"; then
  printf 'NAMED RED: %s\n' "$PREFIX"; exit 1
fi
exit 0
