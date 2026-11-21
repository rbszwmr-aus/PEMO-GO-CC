#!/usr/bin/env bash
#
# APPLY A MUTATION, RUN A CHECK, PUT THE FILE BACK — WITHOUT EVER RISKING
# UNCOMMITTED WORK.
#
#   with-mutation.sh <file> <from> <to> [--expect-red|--expect N] -- <command...>
#
# ─── THE NEAR-MISS THIS EXISTS FOR ───────────────────────────────────────────
#
# Proving a guard means breaking something on purpose and watching the guard
# fire. The obvious way to undo the break is `git checkout -- <file>` — and that
# is a LOADED GUN, because `git checkout` restores to HEAD, not to what the file
# held a moment ago. Every uncommitted change in that file dies with the
# mutation, silently, and the tree looks clean afterwards.
#
# `GEN-029` came one command away from exactly that: the scratchpad holding a
# manual backup had been wiped at a day boundary, so the backup silently did not
# exist, and `git checkout` would have destroyed hours of uncommitted work. It
# was caught by luck — noticing the missing file — not by a rule.
#
# So: the mutation is applied to the LIVE file (the check must see a real tree),
# but the restore is from a BYTE SNAPSHOT taken here, seconds earlier. Never from
# HEAD. Uncommitted work in the mutated file survives, because what comes back is
# exactly what was there, not what was committed.
#
# ─── WHY THE RESTORE IS TRAPPED AND VERIFIED ─────────────────────────────────
#
# TRAPPED, because a sequential restore is fine until the run dies between the
# mutation and the restore — Ctrl-C, an OOM kill, a check that exits early. What
# is then left in the tree is a DELIBERATELY BROKEN FILE waiting for whoever runs
# `git add` next. The battery that exists to prove the guards work would have
# been the thing that broke one.
#
# VERIFIED, because a restore that silently fails is worse than no restore: it
# leaves the mutation in place while reporting success. The bytes are compared
# after, and a mismatch is a LOUD failure, not a warning.
#
# ─── WHY THE BUILD OUTPUT IS INVALIDATED, NOT JUST THE SOURCE ────────────────
#
# THE HARNESS LIED IN BOTH DIRECTIONS BEFORE THIS EXISTED, twice, on real PIDs:
#
#   GEN-037  FALSE PASS. A bite mutated a `.ts` file; the source was restored and
#            the mutated `dist/` was not. `tsc -b` is incremental and `cp -p`
#            restores the ORIGINAL mtime — which is OLDER than the build output —
#            so the compiler concluded dist was current and rebuilt nothing. The
#            next run measured the mutation and reported 9/10 as a baseline.
#   GEN-038  FALSE FAIL. The same stale build survived out of the bite entirely
#            and into `pnpm test:integration`, which reported 383/384 with a
#            failure inside a mutated module the source no longer contained.
#
# A harness that can silently substitute a mutant for the tree is worse than no
# harness, because every result it produces afterwards is unfalsifiable. So the
# restore is not complete until the ARTIFACT built from the mutated source is gone
# too, and the ruling at GEN-038 made that this script's job rather than a note
# every caller has to remember.
#
# WHAT IT DOES: finds the workspace package owning the mutated file, deletes its
# incremental state and `dist/`, and rebuilds — after applying the mutation, so
# the check sees a real build of the mutant, and again after restoring, so nothing
# downstream can pick up the mutant. Deleting the tsbuildinfo is the load-bearing
# part: without it the compiler's own timestamp logic is what defeats the restore.
#
# A package with no build script is left alone, and that is correct: `.sql`,
# `.json` and `.mjs` mutations have no compiled artifact to invalidate.
#
# ─── WHY A MUTATION THAT CHANGES NOTHING IS AN ERROR ─────────────────────────
#
# If <from> is not present, the file is untouched, the check passes, and the run
# reports a green "the guard bites" that proves nothing whatsoever. That is the
# single most dangerous outcome this script can produce, so it is refused with a
# distinct exit code before the command ever runs. A guard is proven by a
# mutation that LANDED.

set -uo pipefail

die(){ printf '  with-mutation: %s\n' "$1" >&2; exit "${2:-2}"; }

[ $# -ge 5 ] || die "usage: with-mutation.sh <file> <from> <to> [--expect-red|--expect N] -- <command...>" 2

FILE="$1"; FROM="$2"; TO="$3"; shift 3
EXPECT="any"
case "${1:-}" in
  --expect-red) EXPECT="red"; shift ;;
  --expect)     EXPECT="$2";  shift 2 ;;
esac
[ "${1:-}" = "--" ] || die "expected -- before the command" 2
shift
[ $# -ge 1 ] || die "no command given" 2

[ -f "$FILE" ] || die "no such file: $FILE" 2
[ -L "$FILE" ] && die "refusing to mutate a symlink: $FILE" 2
[ -w "$FILE" ] || die "not writable: $FILE" 2

# THE SNAPSHOT. Taken before anything is touched, and it is the ONLY source the
# restore ever reads. `cp -p` so mode and timestamps come back too.
SNAP="$(mktemp -d)" || die "could not create a snapshot directory" 2
cp -p "$FILE" "$SNAP/original" || die "could not snapshot $FILE" 2
BEFORE="$(cksum < "$FILE")"

# ─── build-output invalidation ───────────────────────────────────────────────

# The workspace package that owns the mutated file: the nearest ancestor holding a
# package.json. Empty when the file belongs to no package (a migration, a seed).
owner_package(){
  local dir; dir="$(cd "$(dirname "$1")" && pwd)"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/package.json" ] && [ "$dir" != "$REPO_ROOT" ]; then printf '%s' "$dir"; return 0; fi
    dir="$(dirname "$dir")"
  done
  return 0
}

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PKG="$(owner_package "$FILE")"
REBUILD_NOTE=""
if [ -n "$PKG" ] && grep -q '"build"' "$PKG/package.json" 2>/dev/null; then
  REBUILD_NOTE="$PKG"
fi

# Invalidate THEN rebuild. The delete is what defeats `tsc -b`'s timestamp logic;
# the rebuild is what leaves the tree usable for whatever runs next.
rebuild_owner(){
  [ -z "$REBUILD_NOTE" ] && return 0
  rm -rf "$REBUILD_NOTE/dist" "$REBUILD_NOTE/tsconfig.tsbuildinfo"
  ( cd "$REBUILD_NOTE" && pnpm -s run build ) >/dev/null 2>&1
  return 0
}

RESTORED=0
restore(){
  [ "$RESTORED" = 1 ] && return 0
  cp -p "$SNAP/original" "$FILE" || { printf '  with-mutation: RESTORE FAILED for %s — the snapshot is at %s/original\n' "$FILE" "$SNAP" >&2; return 1; }
  local after; after="$(cksum < "$FILE")"
  if [ "$after" != "$BEFORE" ]; then
    printf '  with-mutation: RESTORE DID NOT MATCH for %s — snapshot kept at %s/original\n' "$FILE" "$SNAP" >&2
    return 1
  fi
  RESTORED=1
  # The artifact built from the mutant must not outlive the mutant.
  rebuild_owner
  rm -rf "$SNAP"
  return 0
}
# The trap covers the paths a sequential restore misses. It runs before the
# snapshot is removed, because the snapshot is the only copy of the truth.
trap 'restore || exit 9' EXIT INT TERM HUP

# ─── apply ───────────────────────────────────────────────────────────────────
# Literal replacement, not a regex: a mutation should say exactly what it changes.
python3 - "$FILE" "$FROM" "$TO" <<'PY'
import io, sys
path, frm, to = sys.argv[1], sys.argv[2], sys.argv[3]
s = io.open(path, encoding='utf-8').read()
if frm not in s:
    sys.exit(3)
io.open(path, 'w', encoding='utf-8').write(s.replace(frm, to))
PY
rc=$?
if [ "$rc" = 3 ]; then
  restore
  die "THE MUTATION DID NOT APPLY — <from> is not present in $FILE. A check that passes over an unchanged file proves nothing." 3
fi
[ "$rc" = 0 ] || { restore; die "the mutation step failed (exit $rc)" 2; }

if [ "$(cksum < "$FILE")" = "$BEFORE" ]; then
  restore
  die "THE MUTATION LEFT THE FILE UNCHANGED — <from> and <to> are identical. Nothing was proven." 3
fi

# ─── run ─────────────────────────────────────────────────────────────────────
# Rebuilt FIRST, so the check sees a real build of the mutated source rather than
# whatever happened to be in dist/ beforehand.
rebuild_owner

# ─── the rebuild must not have UNDONE the mutation ───────────────────────────
# A package's `build` can REGENERATE its own sources: the UI apps' build is
# `pnpm run generate && vite build`, and `generate` rewrites every `*.g.ts` from
# its contract. Mutating a generated file and then rebuilding therefore restores
# it, and the check that follows runs against a CLEAN tree while reporting as
# though it had run against a mutant — a guard that never saw the mutation reads
# exactly like a guard that did not care about it.
#
# GEN-046 hit this proving the contract-stamp check: the stale stamp was put back
# by `generate` before the check looked, and the bite silently did not bite.
# Same family as the dist hazard, one level up: there a stale artifact outlived
# the restore; here the SOURCE is regenerated out from under the mutation.
if [ "$(cksum < "$FILE")" = "$BEFORE" ]; then
  restore
  die "THE REBUILD UNDID THE MUTATION — '$FILE' is generated, and the owning
  package's build regenerated it before the check ran. Nothing was mutated, so
  nothing can be proven. Mutate the SOURCE this file is generated from instead." 3
fi

"$@"; got=$?

# ─── restore, then judge ─────────────────────────────────────────────────────
# In that order: the verdict must never be the reason a mutation stays in the tree.
restore || exit 9

case "$EXPECT" in
  any) exit "$got" ;;
  red)
    if [ "$got" = 0 ]; then
      printf '  with-mutation: THE MUTATION WAS NOT CAUGHT — the check exited 0 on a broken tree.\n' >&2
      printf '                 file: %s\n' "$FILE" >&2
      exit 1
    fi
    exit 0 ;;
  *)
    if [ "$got" != "$EXPECT" ]; then
      printf '  with-mutation: expected exit %s, got %s (file: %s)\n' "$EXPECT" "$got" "$FILE" >&2
      exit 1
    fi
    exit 0 ;;
esac
