#!/usr/bin/env bash
#
# The pre-push hook is INSTALLED in this clone.
#
# `core.hooksPath` is per-clone git config and git does not version it, so a
# repository cannot install its own hook. The opt-in is one line; this is what
# notices when it has not been run — otherwise the hook is a file nobody executes
# and the gate is a habit nobody has.
#
# IT DOES NOT ASSERT IN CI, AND THAT IS DELIBERATE. A fresh CI checkout has no
# opt-in and correctly should not: CI is the post-push backstop, not a pusher, and
# bare-asserting there would red every run — and a check that is expected to be
# red is a check that stops being read.
#
# ITS OWN LIMITATION, NAMED RATHER THAN HIDDEN: the discriminator is an
# environment variable, so a developer who exports CI skips this check silently.
# That is the same shape as `git push --no-verify` skipping the hook itself —
# both are deliberate acts, and neither is what this defends against. It defends
# against the clone where nobody ran the opt-in and nobody noticed.

set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
EXPECTED='.githooks'

if [ -n "${GITHUB_ACTIONS:-}" ] || [ -n "${CI:-}" ]; then
  printf '  SKIP  hook-opt-in: not asserted in CI\n'
  printf '        ^ LOUD SKIP, not a pass. CI is the backstop, not a pusher — it has no clone to\n'
  printf '          opt in. A developer clone IS asserted; see docs/governance/bin/hook-opt-in.sh.\n'
  exit 0
fi

[ -x "$REPO/$EXPECTED/pre-push" ] || {
  printf '  FAIL  hook-opt-in: %s/pre-push is missing or not executable.\n' "$EXPECTED"
  printf '        ^ The opt-in below would point at a hook that is not there.\n'; exit 1; }

actual="$(git -C "$REPO" config --get core.hooksPath 2>/dev/null || true)"
if [ "$actual" != "$EXPECTED" ]; then
  printf '  FAIL  hook-opt-in: core.hooksPath is %s, expected %s\n' \
    "$([ -n "$actual" ] && printf "'%s'" "$actual" || printf 'unset')" "$EXPECTED"
  printf '        ^ This clone will not run the pre-push gate. One line fixes it:\n\n'
  printf '              git config core.hooksPath %s\n\n' "$EXPECTED"
  printf '          It is repository-wide config, so it covers every linked worktree too.\n'
  exit 1
fi

printf '  ok    %-52s %s\n' "pre-push gate installed in this clone" "core.hooksPath=$EXPECTED"
