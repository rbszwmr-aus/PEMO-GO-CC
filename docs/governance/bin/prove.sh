#!/usr/bin/env bash
#
# The register's guards, proven by making each one fire.
#
# Every case asserts an EXACT exit code. A mutation that returns 0 is a FAILURE
# of this battery, not a pass — that is the whole point: a schema change can
# silently weaken a guard, and a suite that only checks "still green" cannot see
# it. Distinct exit codes exist so each guard is shown firing FOR ITS OWN REASON;
# this script is what holds them to it.
#
# The battery grows; it does not get curated. Add a case when you add a guard.
#
#   docs/governance/bin/prove.sh            run every case
#   docs/governance/bin/prove.sh -v         also print each command's output
#
# Mutations are applied to a SNAPSHOT-BACKED copy of the register and reverted
# from that snapshot — never with `git checkout`, which restores to HEAD and
# would destroy uncommitted work mid-battery.

set -uo pipefail
VERBOSE=${1:-}
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GOV="$(cd "$HERE/.." && pwd)"
GEN="$GOV/bin/pid-index.mjs"
SNAP="$(mktemp -d)"; WORK=""
# git does not track an empty directory, so when the LAST open PID closes, a fresh
# checkout (CI) has no pids/ at all — and the snapshot, the synthetic victim and
# restore() all cp against a directory that is not there. A tracked .gitkeep keeps
# the directory in git; this mkdir is the belt to that braces, so the battery never
# assumes the directory into which it works exists. (GEN-062: git-tracking-is-not-existence.)
mkdir -p "$GOV/pids" "$GOV/archive" "$GOV/reports"
cp -a "$GOV/." "$SNAP/"

restore(){ rm -rf "$GOV/pids" "$GOV/archive" "$GOV/reports"; cp -a "$SNAP/pids" "$SNAP/archive" "$SNAP/reports" "$GOV/";
           cp -a "$SNAP/PID-INDEX.md" "$GOV/PID-INDEX.md"; rm -f "$GOV/pids/.gitignore"; }

# RESTORE IS TRAPPED, NOT SEQUENTIAL, and it runs before the snapshot is deleted.
# A sequential restore is fine until the run dies between the mutation and the
# restore — Ctrl-C, an OOM kill, a failing assertion that exits early. On an
# ephemeral CI runner the leftover is harmless. Locally it is not: the mutation
# still sitting in the tree is a DELIBERATELY WEAKENED GUARD or a duplicate PID,
# waiting to be committed by whoever runs `git add` next. The battery that exists
# to prove the guards work would have been the thing that broke one.
cleanup(){
  if [ -n "$SNAP" ] && [ -d "$SNAP/pids" ]; then restore; fi
  # The synthetic victim is scaffolding, never an allocation: it must not survive.
  if [ -n "${SYNTH:-}" ]; then
    rm -f "$SYNTH"
    (cd "$GOV" && node "$GEN") >/dev/null 2>&1   # the index must not remember it
  fi
  [ -n "$SNAP" ] && rm -rf "$SNAP"
  [ -n "$WORK" ] && rm -rf "$WORK"
}
trap cleanup EXIT INT TERM HUP

PASS=0; FAIL=0
check(){ # check <name> <expected-exit> <mutation-fn>
  local name="$1" want="$2" fn="$3" got out
  $fn
  out="$(cd "$GOV" && node "$GEN" --check 2>&1)"; got=$?
  restore
  if [ "$got" = "$want" ]; then printf '  ok    %-52s exit %s\n' "$name" "$got"; PASS=$((PASS+1))
  else
    printf '  FAIL  %-52s expected %s, got %s\n' "$name" "$want" "$got"; FAIL=$((FAIL+1))
    [ "$got" = 0 ] && printf '        ^ the mutation was NOT caught — a guard has been weakened\n'
    printf '%s\n' "$out" | sed 's/^/        | /' | head -6
  fi
  [ -n "$VERBOSE" ] && printf '%s\n' "$out" | sed 's/^/        > /'
  return 0
}


# ─── execution-surface scan: a bare-name `npx` is a network call ─────────────
# `npx depcruise` fetched a dependency-confusion placeholder from the public
# registry and exited 0 — a tool that never ran, reporting success. The guard's
# domain is EXECUTION SURFACES ONLY: shell scripts, package.json scripts, CI
# YAML, Makefiles, bin/. Never *.md. That scoping is deliberate and does two
# jobs: a closed PID's report mentioning the string is provenance, not an
# instruction anyone executes, so rule 7 needs no exception — and this guard
# cannot flag its own ban, or the PID text that bans it, or this comment.
npx_scan(){
  local root="$1" hits=0 f
  while IFS= read -r f; do
    # An INVOCATION at a COMMAND POSITION, not any mention of the string.
    # Scoping to execution surfaces is not enough on its own: this file's own
    # case labels contain the word. So the match requires `npx` to start a
    # command — line-leading, after a YAML `run:` or `- `, after a shell
    # operator, or opening a package.json script value — and comment lines are
    # dropped. A guard that flags its own ban is the defect it exists to prevent.
    grep -Hn -E '(^[[:space:]]*(-[[:space:]]+)?(run:[[:space:]]*)?|[;&|][[:space:]]*|":[[:space:]]*")npx[[:space:]]' "$f" 2>/dev/null \
      | grep -vE '^[^:]*:[0-9]+:[[:space:]]*#' && hits=1
  done < <(
    find "$root" \( -path '*/node_modules' -o -path '*/.git' -o -path '*/dist' \) -prune -o \
         \( -name '*.sh' -o -name 'Makefile' -o -name 'package.json' \
            -o -path '*/.github/workflows/*.yml' -o -path '*/.github/workflows/*.yaml' \
            -o -path '*/bin/*' \) -type f -print
  )
  return $hits
}

REPO="$(cd "$GOV/../.." && pwd)"

# ─── R6/R8 (GEN-048): --ci runs the SAME clean build the workflow runs ────────
# The workflow calls docs/governance/bin/ci-preflight.sh; so does this, under
# --ci. What one proves the other runs. Without --ci prove.sh assumes an already
# installed workspace (the fast pre-push habit); with --ci it keeps nothing first.
if [ "${1:-}" = "--ci" ]; then
  "$GOV/bin/ci-preflight.sh" || { echo "  REFUSED: the from-nothing build failed — see above."; exit 1; }
fi
DEPCRUISE="$REPO/apps/api/node_modules/.bin/depcruise"
DC_CFG="$REPO/apps/api/.dependency-cruiser.cjs"
dc_violations(){ # prints "<count> <rulename|->"
  (cd "$REPO" && "$DEPCRUISE" --config "$DC_CFG" --output-type json apps modules packages 2>/dev/null) \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const v=JSON.parse(s).summary.violations;console.log(v.length+" "+(v[0]?v[0].rule.name:"-"));}catch{console.log("ERR -");}})'
}


# The mutation victim is DERIVED from pids/, never named. Naming one is the
# frozen-axis defect: this battery hard-coded GEN-003.md, GEN-003 closed and
# moved to archive/, and six cases silently mutated a file that no longer
# existed — sed on a missing path changes nothing, so the guards "passed" by
# doing nothing. The battery went red and said so, which is the only reason it
# was caught. An in-flight PID always exists; if one does not, say so and stop.
# GEN-046: "an in-flight PID always exists" was FALSE, and the way it failed was
# a DEADLOCK. Closing the last in-flight PID empties pids/, so the battery aborts,
# so the pre-push gate refuses, so the close can never be pushed — and the only
# way out is the `--no-verify` the protocol forbids. GEN-046 hit it closing itself.
#
# The fix keeps the derivation: when pids/ is empty, an in-flight victim is
# SYNTHESISED from the newest archived PID — its status flipped back to draft and
# its close keys dropped — under the number the generator would allocate next.
# Nothing is named, and it is removed on the way out.
#
# archive/ alone does not work as a fallback: two cases need a victim that is IN
# pids/ and IN FLIGHT. `m_dup_location` copies it INTO archive/ (a no-op when it
# is already there) and `m_ignored_pid` needs a status that belongs in pids/, so
# both reported the wrong fault. Measured, not assumed.
#
# Taking the next number transiently is not a new hazard: `m_ignored_pid` has
# always created `pids/<TYPE>-<next>.md` for the same reason.
VICTIM_PATH="$(ls "$GOV"/pids/*.md 2>/dev/null | head -1)"
SYNTH=""
if [ -z "$VICTIM_PATH" ]; then
  SRC="$(ls "$GOV"/archive/*.md 2>/dev/null | grep -v 'PID-INDEX' | tail -1)"
  [ -n "$SRC" ] || { echo "  ABORT: neither pids/ nor archive/ holds a PID file; the battery cannot run."; exit 10; }
  SB="$(basename "$SRC" .md)"; ST="${SB%%-*}"
  SN="$(cd "$GOV" && node "$GEN" --next 2>/dev/null)"
  [ -n "$SN" ] || { echo "  ABORT: could not derive the next number for a synthetic victim."; exit 10; }
  SYNTH="$GOV/pids/$ST-$SN.md"
  sed -e "s/^id: $SB\$/id: $ST-$SN/" -e "s/^# $SB —/# $ST-$SN —/" \
      -e "s/^status: .*\$/status: draft/" -e "/^closed:/d" -e "/^ruling:/d" "$SRC" > "$SYNTH"
  # The snapshot is already taken, and restore() wipes pids/ from it after every
  # case — so the victim must exist in BOTH or it vanishes at the first restore.
  cp "$SYNTH" "$SNAP/pids/"
  VICTIM_PATH="$SYNTH"
  # The index is GENERATED, so a victim in pids/ that the index does not list is
  # drift — and "clean register" would fail on the scaffolding rather than on the
  # register. Regenerate around it, into the snapshot too, and regenerate again on
  # the way out so the committed index is exactly what the real directory makes.
  (cd "$GOV" && node "$GEN") >/dev/null 2>&1
  cp "$GOV/PID-INDEX.md" "$SNAP/PID-INDEX.md"
  cp "$GOV/archive/PID-INDEX-ARCHIVE.md" "$SNAP/archive/PID-INDEX-ARCHIVE.md" 2>/dev/null
  printf '  note   pids/ is empty (the last PID closed) — synthesised %s from %s\n' "$ST-$SN" "$SB"
fi
VICTIM="$(basename "$VICTIM_PATH" .md)"
VICTIM_TYPE="${VICTIM%%-*}"; VICTIM_NNN="${VICTIM##*-}"
OTHER_TYPE=$([ "$VICTIM_TYPE" = "API" ] && echo GEN || echo API)

m_none(){ :; }
m_dup_prefix(){ sed "s/^id: $VICTIM/id: $OTHER_TYPE-$VICTIM_NNN/; s/^type: $VICTIM_TYPE/type: $OTHER_TYPE/; s/^# $VICTIM —/# $OTHER_TYPE-$VICTIM_NNN —/" "$VICTIM_PATH" > "$GOV/pids/$OTHER_TYPE-$VICTIM_NNN.md"; }
m_dup_location(){ cp "$VICTIM_PATH" "$GOV/archive/$VICTIM.md"; }
m_missing_key(){ grep -v '^write_scope:' "$VICTIM_PATH" > "$GOV/pids/.t" && mv "$GOV/pids/.t" "$VICTIM_PATH"; }
m_template_comment(){ sed -i "s/^type: $VICTIM_TYPE\$/type: $VICTIM_TYPE            # API | GEN | UI | DOC/" "$VICTIM_PATH"; }
m_reports_leftover(){ sed -i "/^write_scope:/a reports: reports/$VICTIM-step*.md" "$VICTIM_PATH"; }
m_unknown_key(){ sed -i '/^write_scope:/a owner: someone' "$VICTIM_PATH"; }
m_index_drift(){ printf '\n<!-- hand edit -->\n' >> "$GOV/PID-INDEX.md"; }
# A NEW, not-yet-committed PID file. git applies .gitignore only to UNTRACKED
# paths, so an already-committed PID cannot be hidden this way — the dangerous
# window is exactly the one before a file is first committed, and that is what
# this reproduces. (GEN-001's proof used a then-untracked file; committing the
# register changed that guard's red condition.)
m_ignored_pid(){ local n; n="$(node "$GEN" --next 2>/dev/null)"
                 sed "s/^id: $VICTIM/id: $VICTIM_TYPE-$n/; s/^# $VICTIM —/# $VICTIM_TYPE-$n —/" "$VICTIM_PATH" > "$GOV/pids/$VICTIM_TYPE-$n.md"
                 printf '%s\n' "$VICTIM_TYPE-$n.md" > "$GOV/pids/.gitignore"; }
m_orphan_report(){ cp "$GOV/reports/GEN-005-step1.md" "$GOV/reports/API-009-step1.md"; }
m_closed_no_ruling(){ for f in "$GOV"/reports/GEN-001-RULINGS-*; do rm -f "$f"; done; }


# ─── pre-flight: the boundary cases mutate REAL SOURCE ───────────────────────
# The trap covers EXIT INT TERM HUP; SIGKILL is uncoverable, so a hard kill mid
# boundary-case leaves an injected cross-module or simulator import in real
# source. That leftover is SELF-CATCHING — it is precisely a violation the guard
# that injected it fires on, so it cannot pass a later battery run. But
# self-catching means "caught at build time"; this pre-flight makes it caught at
# the NEXT START, before anything is trusted or committed.
# ─── the injection targets are DERIVED, never named ─────────────────────────
# These were two hard-coded source paths — the frozen-axis class that already
# broke this battery once, when rule 7 moved the register victim it named. A
# renamed file would make every injection mutate nothing, the guards report
# clean, and the battery pass while testing nothing.
#
# The derivation is constrained rather than free. A cross-module victim needs a
# file in one module and an importable file in ANOTHER non-platform module
# (platform is exempt from no-module-to-module, so importing it proves nothing).
# A simulator victim must sit on a RUNTIME path — not src/testing/, not the dev
# seam — or the injected import lands where the rule deliberately tolerates it.
#
# IT ABORTS RATHER THAN SKIPS when no victim can be derived. A battery that
# quietly drops a case because it could not build its own injection is the empty
# oracle it exists to prevent.
derive_targets(){
  IMPORT_TARGET="$(ls -d "$REPO"/modules/*/src/types.ts 2>/dev/null | grep -v '/platform/' | sort | head -1)"
  [ -n "$IMPORT_TARGET" ] || { echo "  ABORT: no modules/*/src/types.ts to import (cross-module injection cannot be built)"; exit 11; }
  local tgt_mod; tgt_mod="$(basename "$(dirname "$(dirname "$IMPORT_TARGET")")")"
  CROSS_VICTIM="$(find "$REPO"/modules -path "$REPO/modules/$tgt_mod" -prune -o -path "$REPO/modules/platform" -prune -o \
                    -path '*/src/*' -name '*.ts' -print 2>/dev/null | grep -v '/dev-simulator/' | sort | head -1)"
  [ -n "$CROSS_VICTIM" ] || { echo "  ABORT: no second non-platform module to inject into"; exit 11; }
  SIM_MAIN="$REPO/modules/home-safety/dev-simulator/src/main.ts"
  [ -f "$SIM_MAIN" ] || { echo "  ABORT: the dev simulator is gone; no-simulator-in-runtime cannot be provoked"; exit 11; }
  SIM_VICTIM="$(find "$REPO"/apps/api/src -name '*.ts' 2>/dev/null | grep -vE '/testing/|dev-seam' | sort | head -1)"
  [ -n "$SIM_VICTIM" ] || { echo "  ABORT: no runtime file under apps/api/src to inject into"; exit 11; }
  BOUNDARY_TARGETS="$(realpath --relative-to="$REPO" "$CROSS_VICTIM") $(realpath --relative-to="$REPO" "$SIM_VICTIM")"
}
# A relative ESM specifier from one file to another, with the .ts → .js the
# compiled output uses.
rel_spec(){ local from_dir; from_dir="$(dirname "$1")"
  local r; r="$(realpath --relative-to="$from_dir" "$2")"; r="${r%.ts}.js"
  case "$r" in .*) printf '%s' "$r";; *) printf './%s' "$r";; esac; }
derive_targets
preflight(){
  git -C "$REPO" rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
    echo "  NOTE: pre-flight byte-identity check SKIPPED — not a git work tree (LOUD, not a pass)"; return 0; }
  # ─── WHAT A LEFTOVER ACTUALLY LOOKS LIKE ──────────────────────────────────
  #
  # This used to compare each target against origin/main and abort on ANY
  # difference, on the premise that a difference could only be a killed battery's
  # injected import. That premise is false, and GEN-044 proved it: the victims are
  # DERIVED from the tree (the first sorted source file in a non-platform module),
  # so any PID that legitimately edits the file it happens to land on is blocked
  # from running the battery at all — with a message telling it to discard its own
  # work.
  #
  # The discriminator is now ANCHORED ON THE INJECTION ITSELF: a leftover is an
  # import of exactly the specifier this script injects, on the first line, which
  # ordinary code has no reason to contain. `[anchor-the-discriminator]` — classify
  # the thing you mean, not a proxy that happens to correlate with it.
  local bad=0 f
  for f in $BOUNDARY_TARGETS; do
    [ -f "$REPO/$f" ] || continue
    local cross_spec sim_spec
    cross_spec="$(rel_spec "$REPO/$f" "$IMPORT_TARGET")"
    sim_spec="$(rel_spec "$REPO/$f" "$SIM_MAIN")"
    if head -1 "$REPO/$f" | grep -qF "import type * as __probe from '$cross_spec'" \
       || head -1 "$REPO/$f" | grep -qF "import '$sim_spec'"; then
      echo "  ABORT: $f still carries THIS SCRIPT'S injected import."
      echo "         A previous battery was killed mid-mutation and its injected import is still in the tree."
      echo "         Restore it from origin/main, then re-run. Refusing to proceed."
      bad=1
    fi
  done
  [ "$bad" -eq 0 ] || exit 9
}
preflight

echo "Register guards — each must fire for its own reason"
check "clean register"                             0 m_none
check "duplicate NNN (a): two type prefixes"       1 m_dup_prefix
check "duplicate NNN (b): one id, two locations"   1 m_dup_location
check "missing required key"                       2 m_missing_key
check "template '#' comment copied into a value"   2 m_template_comment
check "leftover 'reports:' key"                    2 m_reports_leftover
check "unknown key"                                2 m_unknown_key
check "hand-edited index"                          3 m_index_drift
check "PID file ignored by git"                    4 m_ignored_pid
check "orphan report"                              5 m_orphan_report
check "closed PID with no filed ruling"            6 m_closed_no_ruling

# Cases that need a different environment than --check in place.
WORK="$(mktemp -d)"; cp -a "$GOV/." "$WORK/"
out="$(cd "$WORK" && node "$WORK/bin/pid-index.mjs" --check 2>&1)"; got=$?
# Asserted on the STABLE part of the message, not its wording: this case caught
# its own decay when the generator's skip line grew to name three checks instead
# of one. That is the specific-assertion principle working — and the fix is to
# assert what must be true (a loud skip naming the git work tree), not to loosen
# it to "something was printed".
if [ "$got" = 0 ] && printf '%s' "$out" | grep -q 'SKIPPED' && printf '%s' "$out" | grep -q 'git work tree'; then
  printf '  ok    %-52s exit 0 + loud skip\n' "outside a git work tree: core runs, skip is LOUD"; PASS=$((PASS+1))
else printf '  FAIL  %-52s exit %s (or skip was silent)\n' "outside a git work tree" "$got"; FAIL=$((FAIL+1)); fi
(cd "$WORK" && node "$WORK/bin/pid-index.mjs" --check --require-git >/dev/null 2>&1); got=$?
if [ "$got" = 4 ]; then printf '  ok    %-52s exit 4\n' "--require-git makes the skip fatal"; PASS=$((PASS+1))
else printf '  FAIL  %-52s expected 4, got %s\n' "--require-git makes the skip fatal" "$got"; FAIL=$((FAIL+1)); fi

# max(NNN)+1 must be FED by archive/, not merely agree with it.
# BOTH the synthetic number and the expected result are DERIVED. This case used
# to hard-code DOC-009 and expect "010"; allocating GEN-010 made next=011, the
# synthetic no longer raised anything, and the case failed for a reason that had
# nothing to do with what it tests. GEN-008 derived the mutation VICTIM and left
# this expected VALUE literal — the same frozen-axis, half-fixed. Patching it to
# "011" would only move the bomb to the next allocation.
#
# `base` is the next free number, so by definition it is above every allocated
# one: archiving a PID AT that number must push next to base+1.
base="$(cd "$GOV" && node "$GEN" --next 2>/dev/null)"
syn="$base"
expected="$(printf '%03d' "$((10#$base + 1))")"
sed "s/^id: DOC-002/id: DOC-$syn/; s/^# DOC-002 —/# DOC-$syn —/" "$GOV/archive/DOC-002.md" > "$GOV/archive/DOC-$syn.md"
cp "$GOV/reports/DOC-002-RULINGS-step2.md" "$GOV/reports/DOC-$syn-RULINGS-step2.md"
raised="$(cd "$GOV" && node "$GEN" --next 2>/dev/null)"
restore
after="$(cd "$GOV" && node "$GEN" --next 2>/dev/null)"
if [ "$base" = "$after" ] && [ "$raised" = "$expected" ] && [ "$raised" != "$base" ]; then
  printf '  ok    %-52s %s -> %s -> %s\n' "archive/ FEEDS max(NNN)+1" "$base" "$raised" "$after"; PASS=$((PASS+1))
else printf '  FAIL  %-52s %s -> %s -> %s\n' "archive/ FEEDS max(NNN)+1" "$base" "$raised" "$after"; FAIL=$((FAIL+1)); fi

# ─── F1: the npx guard, proven by planting one ───────────────────────────────
plant="$GOV/bin/.npx-plant.sh"
printf '#!/bin/sh\nnpx depcruise --config x\n' > "$plant"
if npx_scan "$GOV" >/dev/null 2>&1; then
  printf '  FAIL  %-52s the planted bare-name npx was NOT flagged\n' "npx guard fires on an execution surface"; FAIL=$((FAIL+1))
else
  printf '  ok    %-52s flagged\n' "npx guard fires on an execution surface"; PASS=$((PASS+1))
fi
rm -f "$plant"
if npx_scan "$GOV" >/dev/null 2>&1; then
  printf '  ok    %-52s clean\n' "npx guard is silent with no plant (and on its own ban)"; PASS=$((PASS+1))
else
  printf '  FAIL  %-52s flagged something with nothing planted\n' "npx guard silent when clean"; FAIL=$((FAIL+1))
fi

# ─── the module-boundary guards, each proven by a CAUGHT EDGE ────────────────
# A zero from dependency-cruiser is trusted only after its red has been seen.
if [ ! -x "$DEPCRUISE" ]; then
  printf '  SKIP  %-52s dependency-cruiser not installed (run pnpm install)\n' "module-boundary guards"
  printf '        ^ LOUD SKIP, not a pass. These cases did not run.\n'
  [ -n "${REQUIRE_DEPCRUISE:-}" ] && { printf '        REQUIRE_DEPCRUISE set -> failing\n'; FAIL=$((FAIL+1)); }
else
  read -r base_n base_r <<<"$(dc_violations)"
  [ "$base_n" = 0 ] && { printf '  ok    %-52s %s violations\n' "boundary baseline is clean" "$base_n"; PASS=$((PASS+1)); } \
                    || { printf '  FAIL  %-52s expected 0, got %s (%s)\n' "boundary baseline is clean" "$base_n" "$base_r"; FAIL=$((FAIL+1)); }

  victim="$CROSS_VICTIM"; cp "$victim" "$SNAP/tq.bak"
  printf "import type * as __probe from '%s';\n%s" "$(rel_spec "$victim" "$IMPORT_TARGET")" "$(cat "$victim")" > "$victim"
  read -r n r <<<"$(dc_violations)"; cp "$SNAP/tq.bak" "$victim"
  if [ "$n" = 1 ] && [ "$r" = "no-module-to-module" ]; then
    printf '  ok    %-52s CAUGHT: %s\n' "cross-module import fires no-module-to-module" "$r"; PASS=$((PASS+1))
  else printf '  FAIL  %-52s expected 1/no-module-to-module, got %s/%s\n' "cross-module import fires no-module-to-module" "$n" "$r"; FAIL=$((FAIL+1)); fi

  victim="$SIM_VICTIM"; cp "$victim" "$SNAP/wiring.bak"
  printf "import '%s';\n%s" "$(rel_spec "$victim" "$SIM_MAIN")" "$(cat "$victim")" > "$victim"
  read -r n r <<<"$(dc_violations)"; cp "$SNAP/wiring.bak" "$victim"
  if [ "$n" = 1 ] && [ "$r" = "no-simulator-in-runtime" ]; then
    printf '  ok    %-52s CAUGHT: %s\n' "simulator import fires no-simulator-in-runtime" "$r"; PASS=$((PASS+1))
  else printf '  FAIL  %-52s expected 1/no-simulator-in-runtime, got %s/%s\n' "simulator import fires no-simulator-in-runtime" "$n" "$r"; FAIL=$((FAIL+1)); fi
fi

# ─── seed reproduces from nothing (its own script; needs a database) ─────────
# Isolated behind its own script and flag so the file-level cases above still run
# with no database present — prove.sh had zero database references before this,
# and that stays true for everything except this one case.
sr_out="$("$GOV/bin/seed-reproduces.sh" 2>&1)"; sr_rc=$?
printf '%s\n' "$sr_out"
if [ "$sr_rc" -eq 0 ]; then
  printf '%s' "$sr_out" | grep -q '^  SKIP' || PASS=$((PASS+1))
else
  FAIL=$((FAIL+1))
fi

# ─── pemo_app's grants are complete and not excessive (needs a database) ─────
# The pre-push gate is installed in this clone. Skips loudly in CI, which has no
# clone to opt in; fails in a developer clone that would push ungated.
oi_out="$("$GOV/bin/hook-opt-in.sh" 2>&1)"; oi_rc=$?
printf '%s\n' "$oi_out"
if [ "$oi_rc" -eq 0 ]; then
  printf '%s' "$oi_out" | grep -q '^  SKIP' || PASS=$((PASS+1))
else
  FAIL=$((FAIL+1))
fi

# Every ADR the repository references has a file in docs/adr/. The README's
# mandatory Target location field could not notice a document that never arrived;
# four wrong reasoning routes later, this can. Needs no database.
ap_out="$("$GOV/bin/adrs-present.sh" 2>&1)"; ap_rc=$?
printf '%s\n' "$ap_out"
if [ "$ap_rc" -eq 0 ]; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi

gc_out="$("$GOV/bin/grants-complete.sh" 2>&1)"; gc_rc=$?
printf '%s\n' "$gc_out"
if [ "$gc_rc" -eq 0 ]; then
  printf '%s' "$gc_out" | grep -q '^  SKIP' || PASS=$((PASS+1))
else
  FAIL=$((FAIL+1))
fi

# AT MOST ONE LIVE GRANT PER (group, role, node) — the whole-table half of what
# 0118 traded scope_grant_no_overlapping_periods for. The write-path advisory
# guard holds the invariant for acts; a bulk load bypasses that guard, and 0112
# chose a constraint over a trigger precisely because of bulk loads. This is the
# part a bulk load cannot bypass. Skips loudly with no database, like its
# neighbours.
lg_out="$("$GOV/bin/live-grant-cardinality.sh" 2>&1)"; lg_rc=$?
printf '%s\n' "$lg_out"
if [ "$lg_rc" -eq 0 ]; then
  printf '%s' "$lg_out" | grep -q '^  SKIP' || PASS=$((PASS+1))
else
  FAIL=$((FAIL+1))
fi

# AT MOST ONE LIVE MEMBERSHIP PER (group, principal) — the whole-table half of
# what 0123 traded group_membership_no_overlapping_periods for. Membership is a
# JOIN MULTIPLIER, so a duplicate returns one grant twice; the write-path guard
# holds it for acts and a bulk load bypasses that, which is what this catches.
lm_out="$("$GOV/bin/live-membership-cardinality.sh" 2>&1)"; lm_rc=$?
printf '%s\n' "$lm_out"
if [ "$lm_rc" -eq 0 ]; then
  printf '%s' "$lm_out" | grep -q '^  SKIP' || PASS=$((PASS+1))
else
  FAIL=$((FAIL+1))
fi

# NO ADMINISTRATOR GRANT WITHOUT A LIVE MEMBER — what the genesis act's four
# assertions exist to guarantee, checked over the whole table because a bulk load
# bypasses the write path that guarantees it for acts.
po_out="$("$GOV/bin/provision-once-only.sh" 2>&1)"; po_rc=$?
printf '%s\n' "$po_out"
if [ "$po_rc" -eq 0 ]; then
  printf '%s' "$po_out" | grep -q '^  SKIP' || PASS=$((PASS+1))
else
  FAIL=$((FAIL+1))
fi

# THE SURFACE ENUMS ARE THE REGISTRY'S PROJECTION — checked, not remembered.
# GEN-027 regenerated them by hand and GEN-033 forgot; the fixture validator
# caught it, but a check whose remedy is "hand-edit a generated block" is a rule
# with a manual membership list. `pnpm gen:enums` is the remedy now, and this is
# what notices when it was not run. Needs no database.
ge_out="$(cd "$REPO" && node packages/api-contracts/generate-enums.mjs --check 2>&1)"; ge_rc=$?
if [ "$ge_rc" -eq 0 ]; then
  printf '  ok    surface enums are the registry projection      %s\n' \
    "$(printf '%s' "$ge_out" | grep -c '^  ok') surface(s)"
  PASS=$((PASS+1))
else
  printf '  FAIL  surface enum drift — run: pnpm gen:enums\n'
  printf '%s\n' "$ge_out" | sed 's/^/          /'
  FAIL=$((FAIL+1))
fi

echo
# ─── R5b: the three derived-membership checks (GEN-036) ──────────────────────
# Each derives its subject rather than carrying a list, so a new call site, seed
# file or validator code is covered the moment it is written.
for r5b in like-escape fixtures-idempotent; do
  if "$HERE/$r5b.sh"; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi
done

# ─── N1: the notice-type vocabulary agrees with its two consumers (GEN-037) ───
# The DDL half is VERIFIED and never rewritten: a migration that has been applied
# is immutable, so a new type means a new migration, and this refuses a
# disagreement rather than editing history to match the present.
nt_out="$(cd "$REPO" && node packages/api-contracts/generate-notice-types.mjs --check 2>&1)"; nt_rc=$?
if [ "$nt_rc" = 0 ]; then
  printf '%s\n' "$nt_out" | tail -1
  PASS=$((PASS+1))
else
  printf '  FAIL  notice types disagree across declaration, module and DDL\n'
  printf '%s\n' "$nt_out" | sed 's/^/        /'
  FAIL=$((FAIL+1))
fi

# ─── A1: the act vocabulary is the contract's POST operationIds (GEN-047) ────
# `permittedActions` names acts by operationId. The TS element type is generated
# from the contract and the contract's own enums are VERIFIED against the same
# derivation — a hand-written enum that drifted would be a permission nobody can
# hold or a refusal nobody can see.
ao_out="$(cd "$REPO" && node packages/api-contracts/generate-act-operations.mjs --check 2>&1)"; ao_rc=$?
if [ "$ao_rc" = 0 ]; then
  printf '%s\n' "$ao_out" | tail -1
  PASS=$((PASS+1))
else
  printf '  FAIL  act vocabulary disagrees between contract and generated type\n'
  printf '%s\n' "$ao_out" | sed 's/^/        /'
  FAIL=$((FAIL+1))
fi

# ─── D3: the notice reason-code vocabulary has one source (GEN-052) ──────────
nr_out="$(cd "$REPO" && node packages/api-contracts/generate-notice-reasons.mjs --check 2>&1)"; nr_rc=$?
if [ "$nr_rc" = 0 ]; then printf '%s\n' "$nr_out" | tail -1; PASS=$((PASS+1))
else printf '  FAIL  notice reason codes disagree across registry, type and contract\n'; printf '%s\n' "$nr_out" | sed 's/^/        /'; FAIL=$((FAIL+1)); fi

# ─── R3: every workspace import is declared, every declaration referenced (GEN-048) ──
if node "$HERE/workspace-deps-declared.mjs"; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi

# ─── R2: `prove.sh --clean` rebuilds with node_modules removed (GEN-048) ─────
# Not the default: it reinstalls the workspace. CI does it on every run; run it
# here before any claim that a rebuild from nothing is green.
if [ "${1:-}" = "--clean" ]; then
  if "$HERE/clean-rebuild.sh" >/dev/null 2>&1; then printf '  ok     rebuild from nothing, node_modules included\n'; PASS=$((PASS+1))
  else printf '  FAIL   rebuild from nothing FAILED — run docs/governance/bin/clean-rebuild.sh to see why\n'; FAIL=$((FAIL+1)); fi
fi

# ─── C1: the Ticket/Case vocabularies agree with their consumers (GEN-038) ────
cv_out="$(cd "$REPO" && node packages/api-contracts/generate-case-vocabularies.mjs --check 2>&1)"; cv_rc=$?
if [ "$cv_rc" = 0 ]; then
  printf '%s\n' "$cv_out" | tail -1
  PASS=$((PASS+1))
else
  printf '  FAIL  case vocabularies disagree across declaration, modules and DDL\n'
  printf '%s\n' "$cv_out" | sed 's/^/        /'
  FAIL=$((FAIL+1))
fi

echo
# ─── every generated file carries its contract's CURRENT version (GEN-046) ────
# GEN-042 bumped severity.json and regenerated no consumer; two apps stamped a
# stale version for three PIDs. The check derives its subjects by walking the
# apps, because a hand-kept list would have been kept by whoever forgot.
if node "$HERE/contract-stamps-current.mjs"; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi

# ─── G2: the app suites are GATED (GEN-046) ──────────────────────────────────
# Both UI suites were red on main for three PIDs and nothing said so. A suite no
# gate runs does not stay green. Apps are derived, and every test script this
# gate does NOT run is named rather than forgotten.
if "$HERE/app-suites.sh"; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi

# ─── pids/ survives an empty state in git (GEN-062) ──────────────────────────
# git drops an empty directory, so closing the LAST open PID left a fresh CI
# checkout with no pids/ — and this battery cp'd against it and reddened for a
# reason unrelated to any guard. A tracked keeper holds the directory; this check
# reds if git tracks nothing under pids/, so the keeper cannot vanish silently.
if node "$HERE/pids-dir-tracked.mjs"; then PASS=$((PASS+1)); else FAIL=$((FAIL+1)); fi

printf '%s passed, %s failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
