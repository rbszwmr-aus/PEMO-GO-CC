#!/usr/bin/env bash
# PROVE THE PRE-PUSH HOOK REFUSES A TREE MID-REBASE, AND PROCEEDS ONCE IT IS FINISHED (GEN-053 D1).
# In a throwaway clone: two branches edit the same line, a rebase conflicts, the hook is invoked
# exactly as git would invoke it (cwd inside the worktree) and must refuse naming the state; the
# rebase is aborted and the hook must pass the finished-tree gate. Exit 0 when the hook behaves;
# exit 1 naming the failure when it does not — which is what the runner's `guard` kind expects a
# MUTATED hook to do. (The first version had this backwards and the runner said so.)
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; REPO="$(cd "$HERE/../../.." && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
git -c init.defaultBranch=main init -q "$T"; cd "$T"
git config user.email probe@pemo.local; git config user.name probe
printf 'one\n' > f; git add f; git commit -qm base
git checkout -qb side; printf 'side\n' > f; git commit -qam side
git checkout -q main; printf 'main\n' > f; git commit -qam main
git checkout -q side; git rebase main >/dev/null 2>&1 || true
[ -d "$(git rev-parse --git-path rebase-merge)" ] || [ -d "$(git rev-parse --git-path rebase-apply)" ] || { echo "probe could not create an in-progress rebase"; exit 3; }
out="$(bash "$REPO/.githooks/pre-push" origin git@example 2>&1)"; rc=$?
if [ "$rc" = 0 ] || ! printf '%s' "$out" | grep -q 'an operation is in progress'; then
  echo "HOOK DID NOT REFUSE THE MID-REBASE TREE"; exit 1
fi
git rebase --abort
out2="$(bash "$REPO/.githooks/pre-push" origin git@example 2>&1)"
if printf '%s' "$out2" | grep -q 'an operation is in progress'; then echo "HOOK STILL REFUSES AFTER ABORT"; exit 1; fi
# GREEN: the probe is a check, and a check that passes exits 0. Under the runner's
# `guard` kind the MUTATION must make it fail naming why — the line above.
echo "refused mid-rebase, proceeds after: $(printf '%s' "$out" | grep -o 'in progress in this worktree —[^.]*')"; exit 0
