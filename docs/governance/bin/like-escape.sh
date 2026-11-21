#!/usr/bin/env bash
#
# EVERY `LIKE` PATTERN IS ACCOUNTED FOR — DERIVED, NOT SWEPT.
#
# `_` matches any one character and `%` matches any run. This codebase names
# things `grp_w3_admins` and `stf_wfg_manager`, so a prefix written straight into
# a `LIKE` carries wildcards nobody intended and reaches further than it reads.
# It has bitten twice (`GEN-014` deleted rows a test did not own; `GEN-029`'s
# `grp_w3_%` matched `grp_w3g_admins`), and both times the remedy was a HAND
# SWEEP for `LIKE` — which is precisely the suggestion `R5b` retires. This check
# enumerates every `LIKE` in the tree and requires each one to account for itself,
# so a new call site is covered the moment it is written, with no list to update.
#
# ─── THE TWO RULES ───────────────────────────────────────────────────────────
#
# A1  NO RAW INTERPOLATION INTO A PATTERN. `LIKE '${x}%'` puts unescaped caller
#     text into a pattern — wrong at best, injection-adjacent at worst. Bind the
#     parameter and build the pattern with `likePattern`/`likePrefix`.
#
# A2  A LITERAL PATTERN CONTAINING `_` MUST SAY WHAT IT MEANS. Either it carries
#     `ESCAPE` (the `_` is literal, as intended), or it is marked
#     `-- like-wildcard: <reason>` on the same or previous line (the `_` really is
#     meant as a wildcard). Silence is the defect, because silence is
#     indistinguishable from not having thought about it.
#
# ─── WHY A2 EXISTS AT ALL, WHEN THE DISPATCH ASKED ONLY FOR A1 ───────────────
#
# MEASURED at the pin: the tree contained ZERO raw-interpolated `LIKE`s and 45
# unescaped `_` patterns. A1 alone could not have failed on this repository — a
# guard that cannot fire proves nothing and rots quietly. A2 is where the bug
# that actually bit twice lives. Both rules ship; A1 is prevention, A2 is the
# live hazard.
#
# ─── SCOPE ───────────────────────────────────────────────────────────────────
#
# `.ts` and `.mjs` under the workspaces, plus `database/`. NOT `.md` — a report
# quoting a `LIKE` is provenance, not an executable query, and a guard that
# flagged prose would flag this file's own documentation. NOT COMMENT LINES, for
# exactly the same reason and measured the same way: the first run of this check
# flagged `like-pattern.ts`'s own explanation of the bug, and two test files that
# describe in a comment the mistake they were written to prevent. The
# discriminator is ANCHORED — a line whose first non-space characters are `*`,
# `//` or `#` — so it classifies the line's ROLE, not whether the characters
# appear somewhere on it. NOT `.sql` migrations:
# their patterns are fixed at authoring time against a schema, carry no caller
# input, and are immutable once applied, so a finding there could not be acted on.

set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
cd "$REPO" || exit 2

FAILED=0
report(){ printf '  %-6s %s\n' "$1" "$2"; }

files(){
  find apps modules packages tests database -type f \( -name '*.ts' -o -name '*.mts' -o -name '*.mjs' \) \
    -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/build/*' 2>/dev/null | sort
}

# ─── A1: raw interpolation into a pattern ────────────────────────────────────
# `LIKE` followed by a quoted string (any quote style) that contains `${`.
interp="$(files | xargs grep -nE "LIKE[[:space:]]+[\`'\"][^\`'\"]*\\\$\{" 2>/dev/null | grep -vE ':[[:space:]]*(\*|//|#)' || true)"
if [ -n "$interp" ]; then
  report FAIL "like-escape A1: a LIKE pattern is built by raw interpolation"
  printf '%s\n' "$interp" | sed 's/^/          /'
  printf '          ^ Bind the value and build the pattern: likePrefix(x) with ESCAPE.\n'
  FAILED=1
fi

# ─── A2: a literal pattern containing `_`, unaccounted for ───────────────────
# Read line by line so each hit can be judged against its own line and the one
# before it — a marker is allowed on either, because the natural place to write
# it is above a long query.
unaccounted=""
while IFS= read -r hit; do
  file="${hit%%:*}"; rest="${hit#*:}"; line="${rest%%:*}"; text="${rest#*:}"
  # A COMMENT IS NOT A QUERY. Anchored to the start of the line, so a query with a
  # trailing comment is still judged as a query.
  printf '%s' "$text" | grep -qE "^[[:space:]]*(\*|//|#)" && continue
  # Already explicit: the escape clause is on this line.
  printf '%s' "$text" | grep -q "ESCAPE" && continue
  # Deliberate wildcard, declared as such, here or on the line above.
  printf '%s' "$text" | grep -q -- "like-wildcard:" && continue
  # THE MARKER IS SCOPED TO THE STATEMENT, NOT TO ONE LINE.
  #
  # A query spans several lines, and the natural place to write "this wildcard is
  # deliberate" is above the statement, not jammed against the matched line. So
  # walk BACK from the hit and stop at a blank line or the end of the previous
  # statement (`;`) — the marker may sit anywhere inside the statement it belongs
  # to, and cannot leak into the next one. Bounded at 8 lines so a runaway scan
  # cannot silently adopt a marker from far above.
  marked=0
  n=$((line-1)); floor=$((line-8)); [ "$floor" -lt 1 ] && floor=1
  while [ "$n" -ge "$floor" ]; do
    l="$(sed -n "${n}p" "$file" 2>/dev/null || true)"
    printf '%s' "$l" | grep -q -- "like-wildcard:" && { marked=1; break; }
    printf '%s' "$l" | grep -qE '^[[:space:]]*$|;[[:space:]]*$' && break
    n=$((n-1))
  done
  [ "$marked" = 1 ] && continue
  unaccounted="${unaccounted}${hit}
"
done < <(files | xargs grep -nE "LIKE[[:space:]]+'[^']*_[^']*'" 2>/dev/null || true)

if [ -n "${unaccounted//[$'\n']/}" ]; then
  n="$(printf '%s' "$unaccounted" | grep -c . || true)"
  report FAIL "like-escape A2: $n literal LIKE pattern(s) contain '_' and say nothing about it"
  printf '%s' "$unaccounted" | sed 's/^/          /' | head -20
  printf '          ^ Add ESCAPE (the _ is literal) or -- like-wildcard: <reason> (it is not).\n'
  FAILED=1
fi

if [ "$FAILED" = 0 ]; then
  total="$(files | xargs grep -cE "LIKE[[:space:]]" 2>/dev/null | awk -F: '{s+=$2} END {print s+0}')"
  report ok "every LIKE accounts for its wildcards            $total LIKE line(s) scanned"
fi
exit "$FAILED"
