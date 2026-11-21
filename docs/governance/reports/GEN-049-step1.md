# GEN-049 step 1 — the publish race replaced by the constraint it was fronting

**Date:** 2026-09-03  **Pin:** `fcd1621`.  **Battery:** green. **Manifest:** 27 proven, 0 failed, **0 unreliable**.

## What the lock actually guarded — decided, as ruled

Not what option (i) assumed. `correct` appends another `publication_released` assertion, so
"at most one publish assertion per notice" is **not** an `ADR-019` invariant and a partial unique
index on it would be wrong. The invariant that a concurrent loser really hits is older and already
there: **`notice_version_unique UNIQUE (notice_id, version)`** (migration 0126). Every act appends
`version + 1`; two acts that both read N cannot both write N+1 — the second INSERT blocks on the index
until the first commits, then fails with 23505 and its whole transaction (snapshot, event, audit) rolls
back. The advisory lock guarded nothing that constraint did not. What it did was smaller: it made the
loser READ the winner's version first, so the loser got a tidy `stale-state` instead of an exception.

**Mechanism:** the lock is removed from `transition`; a 23505 on that constraint is mapped to the same
`stale-state` refusal a late caller gets. **No new migration** — the constraint exists — and no
contract change.

**A defect the runner's baseline control caught in my first build.** `deriveActId` gives both
concurrent publishes the *same* assertion id for N+1, so a genuinely overlapping loser hits
`notice_pkey`, not `notice_version_unique`, and my mapping rethrew it: case 12 went nondeterministically
red *unmutated*. Both constraints express one invariant and both are mapped now; the test holds the
derived id so it collides on the key a real race does.

## The bite is forced, not hoped for

`tests/integration/notice-publish-serialisation.test.ts`: connection A inserts version 2 inside an
open transaction and HOLDS it; connection B (a second pool) runs the real `publish` naming version 1,
must BLOCK on the index, and after A commits must be refused `stale-state` with nothing of B's left —
one version 2, zero snapshot rows, zero events. The elapsed-time assertion proves B actually waited.

| how measured | result |
|---|---|
| mutation admits the loser as `ok`, whole file, ×6 | **6/6 red** |
| four-condition runner, GEN-040 entries, ×3 | **3/3 proven, no collateral** |
| baseline `notice-acts` ×6 unmutated | 6/6 green |

Manifest entry `publish-advisory-lock` → `publish-loser-is-refused-not-admitted`, `unreliable` removed.
Principle **`[a-race-is-not-a-bite]`** added (75 → 76 resolvable principle citations, per `adrs-present`).

## A harness defect found on the way, and fixed

A runner killed by a timeout mid-bite leaves the mutant in the source — `undo()` is a `finally`, and a
`finally` does not run on SIGKILL. Three baseline runs were red on `covering-conjunction` before I read
that the file still said `uncovered.length < addressed.length`. `run-mutations.mjs` now **refuses to
start while any manifest mutation's `to` text is present in its file** (proven: plant one → exit 2,
naming it) and restores on SIGINT/SIGTERM.

## Not done here
CI (GEN-048); the ~36 prose bites' harness classes; exact projection type; multi-node ticket case.
**No filed `-RULINGS-` exists for GEN-049, so Rule 7 cannot close it yet** — merged, HARD STOP for the ruling.
