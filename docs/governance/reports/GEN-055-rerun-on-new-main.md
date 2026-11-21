# GEN-055 — re-run on the new main (post GEN-048/057/059)

**PID:** GEN-055 (C3 cases handling), branch `codex/gen-055`, worktree.
**Date (UTC):** 2026-09-04
**Status:** author-complete, re-run green on the rebased base — HARD STOP for the landing/close ruling. No merge.

Held under R13 while GEN-048 (CI), GEN-057 (frozen clock), and GEN-059 (scanner) landed.
Per the ruling: a rebase and re-run, NOT a rebuild.

## Rebase (not rebuild)

- `codex/gen-055`'s single WIP commit replayed `--onto 799e821` (from its prior base `39bb069`).
- The ONLY conflict was `docs/governance/mutations/manifest.json` — both sides append entries.
  Resolved by union: main's 67 entries (through GEN-059) + GEN-055's 9 = 76. No id collisions.
- Verified the rebase moved nothing else: the rebased commit's file set is identical to the
  original, and every non-manifest file is byte-identical between the original and rebased commit.

## Re-run (the paused DB reset resumed, untouched otherwise)

- Workspace rebuilt from the rebased source (`pnpm -r build` clean — includes the GEN-059 scanner
  fix and GEN-055's changes).
- DB brought current via the repo entrypoint (`database/bootstrap.sh --with-seed`, target derived
  from `database/dev/.env`, schemas dropped by enumeration not by name): **57 migrations applied,
  including GEN-055's 0139/0140**, seeded.
- Integration tests (`case-acts`, `cases-origination`, `case-handling`): **35 tests, 35 pass, 0 fail.**
- Mutation bites (`run-mutations.mjs GEN-055`): **9 proven, 0 failed** — C3-2 … C3-11, each firing
  for its own reason, baseline green, instrument control satisfied.

## State

No source change from the original author-complete work beyond the manifest union (a rebase
artifact, not a rebuild). The branch tip is still a `wip(GEN-055)` placeholder commit; on the
landing ruling I reword it to the final message and merge by refspec push.

HARD STOP for the landing/close ruling.
