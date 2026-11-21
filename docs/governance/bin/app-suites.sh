#!/usr/bin/env bash
#
# THE APP SUITES, GATED (GEN-046 G2).
#
# ─── WHY ─────────────────────────────────────────────────────────────────────
#
# A suite no gate runs does not stay green; it stops being true quietly. Both UI
# suites proved it at once. `apps/management-web` was 79/101 on `main` for three
# PIDs — `GEN-043`'s 2.0.0 reshape retired a fixture shape its corpus guard still
# asserted — and `apps/resident-portal` was red for the same span because
# `GEN-042` bumped `severity.json` to 0.4.0 and regenerated neither consumer.
# Nobody was told, because nothing ran them. The API battery had 31 guards and
# not one of them looked at an app.
#
# ─── DERIVED, NOT LISTED ─────────────────────────────────────────────────────
#
# The apps are discovered by walking `apps/*/package.json` for a `test:node`
# script, so a new app is gated the day it acquires a suite rather than the day
# somebody remembers to add it here. The INVENTORY arm is the other half: every
# test script an app declares and this gate does NOT run is NAMED, so a suite can
# never again be silently ungated — it is either run or listed as not run.
#
# `test:browser` is inventoried, not run: it needs Playwright browsers, and a gate
# that cannot run on a clean clone is a gate that gets bypassed. CI runs those.
#
# Each app is BUILT before it is tested, because the artefact tests assert on the
# production bundle — running them without a build reports failures that are
# nothing but a missing `dist/`.

set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
cd "$REPO" || exit 2

FAIL=0; RAN=0; NOT_RUN=()

for pkg in apps/*/package.json; do
  [ -f "$pkg" ] || continue
  app="$(basename "$(dirname "$pkg")")"
  has_node="$(node -e "try{process.stdout.write((require('./$pkg').scripts||{})['test:node']?'y':'')}catch{}")"
  [ -z "$has_node" ] && continue

  # Every OTHER test script this app declares is inventoried by name.
  while read -r s; do
    [ -n "$s" ] && NOT_RUN+=("$app:$s")
  done < <(node -e "
    const s=(require('./$pkg').scripts)||{};
    for(const k of Object.keys(s)) if(/^test(:|$)/.test(k) && k!=='test:node' && k!=='test') console.log(k);")

  if ! out="$(pnpm -s -C "apps/$app" run build 2>&1)"; then
    printf '  FAIL   %-22s BUILD FAILED — the artefact tests cannot mean anything\n' "$app"
    printf '%s\n' "$out" | tail -4 | sed 's/^/           /'
    FAIL=$((FAIL+1)); continue
  fi
  out="$(pnpm -s -C "apps/$app" run test:node 2>&1)"
  # ONE PARSER, ANY REPORTER FORMAT (GEN-048 F1): the battery never confuses "the
  # extractor could not read the result" (our bug — loud) with "the suite did not
  # run" (the app's — a verdict). node emits `# pass N` (tap) or `ℹ pass N` (spec)
  # depending on TTY and version; matching only one reported a green suite dead.
  verdict="$(printf '%s' "$out" | node "$HERE/parse-suite-result.mjs")"
  case "$verdict" in
    EXTRACTOR-ERROR*)
      printf '  FAIL   %-22s EXTRACTOR ERROR — %s\n' "$app" "${verdict#EXTRACTOR-ERROR }"
      printf '%s\n' "$out" | tail -4 | sed 's/^/           /'
      FAIL=$((FAIL+1)); continue ;;
    DID-NOT-RUN)
      printf '  FAIL   %-22s the suite did not run (no result and no duration)\n' "$app"
      printf '%s\n' "$out" | tail -4 | sed 's/^/           /'
      FAIL=$((FAIL+1)); continue ;;
  esac
  read -r _ pass bad skip <<EOF
$verdict
EOF
  if [ "$bad" != 0 ]; then
    printf '  FAIL   %-22s %s failing\n' "$app" "$bad"
    printf '%s\n' "$out" | grep -E '^✖' | head -6 | sed 's/^/           /'
    FAIL=$((FAIL+1)); continue
  fi
  printf '  ok     %-22s %s passed, %s skipped\n' "$app" "${pass:-?}" "${skip:-0}"
  RAN=$((RAN+1))
done

# VACUITY REFUSAL — this gate covered zero apps for the whole time both suites
# were red. A gate that runs nothing passes forever.
if [ "$RAN" = 0 ] && [ "$FAIL" = 0 ]; then
  printf '  FAIL   no app suite was run — this gate is vacuous\n'; exit 1
fi
if [ ${#NOT_RUN[@]} -gt 0 ]; then
  printf '  note   not run by this gate (CI job "the app browser suites"): %s\n' "$(printf '%s ' "${NOT_RUN[@]}")"
fi

# ─── the apps this gate cannot even see ──────────────────────────────────────
# The loop above is keyed on `package.json`, so an app in another language is
# invisible to it — and invisible is exactly the state that let two suites rot.
# `apps/resident-mobile` is Flutter: 8 `*_test.dart` files that NOTHING runs, not
# this gate and not CI. It is named here rather than skipped, because the whole
# point of the inventory is that a suite is either RUN or LISTED AS NOT RUN.
for d in apps/*/; do
  app="$(basename "$d")"
  [ -f "$d/package.json" ] && continue
  n="$(find "$d/test" -name '*_test.dart' 2>/dev/null | wc -l | tr -d ' ')"
  [ "${n:-0}" = 0 ] && continue
  printf '  note   %-22s %s Flutter test(s) — gated by CI job "the resident-mobile Flutter suite" (GEN-048 D1); prove.sh cannot run Flutter\n' "$app" "$n"
done

[ "$FAIL" = 0 ]
