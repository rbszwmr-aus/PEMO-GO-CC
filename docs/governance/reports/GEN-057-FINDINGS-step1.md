# GEN-057 — deterministic integration suite: findings (step 1)

**PID:** GEN-057 (allocated `56462a9`, branch `codex/gen-057`, worktree)
**Date:** 2026-09-04
**Status:** HARD STOP — the determinism proof surfaced a genuine product concurrency bug (zero-administrator lockout reachable), which is outside GEN-057's stated suite-determinism scope and needs a ruling.

---

## D1 — diagnosis (concurrency / isolation)

- **61** integration test files under `tests/integration/*.test.ts`.
- **32** of them touch the database.
- **ONE** shared database (`database/dev/.env`, port 55478). No per-file schema isolation.
- Runner already serial: `--test-concurrency=1`. So within a run there is no cross-file *concurrency*; the only cross-file coupling is **shared DB state** plus **glob file order** (the filesystem's, machine-dependent — the F7 "green once / red once on the same commit").

## Deliverables built

- `docs/governance/bin/run-integration.mjs` — lists the suite in a **declared** order: sorted by default (deterministic), or `--shuffle <seed>` to prove order-independence. Always `--test-concurrency=1`, `--test-reporter=tap`, parses `# pass`/`# fail`/`not ok`, exits non-zero on any failure. (Per-file schema isolation is a 32-file refactor, owed separately.)
- `tests/integration/membership-assertions.test.ts` teardown fix (D3): setup created the `_w3r` **and** `_w3g` families; the old teardown deleted only the `_w3g` half of grant/estate/org, so the `_w3r` grant survived and its FK choked the broad `grp_w3%` group-delete. Broadened every delete to the `_w3%` family it actually creates. **This was one leaky teardown, and it is fixed.**

## D3 — sweep result

Teardowns reaching outside what they created, found and fixed: **1** (membership-assertions' `_w3g`-only delete-set). The crude prefix-regex sweep flagged ~12 files, but the rest are false positives (their setup ids are built dynamically, e.g. `res_c2_${tag}`, so a static prefix scan over-reports). The empirical repeated-run proof below is the real instrument.

## D4 — determinism proof, and what it found

Ran the whole suite repeatedly on one un-reset DB (sorted + shuffled seeds). **NOT N/N.** One test failed intermittently (~2–3 of 10):

```
THE CROSS-ROUTE RACE -- concurrent revoke + removeMembership: exactly one is refused
  error: exactly one route must be refused, got revoked, removed   (0 !== 1)
```

**`got revoked, removed`** = both routes SUCCEEDED, neither refused → **zero effective administrators**: the exact GEN-030 unrecoverable-lockout state the organization lock was built to prevent.

### It is NOT file order, and NOT (only) a leaky teardown

- 20/20 green running the file **alone**; 15/15 green alone under 32-core CPU load; 5/5 green in the exact **seed-21 file order** run directly. The flake needs the **full suite repeated on one DB** — i.e. it is a wall-clock **race**, surfaced (not caused) by the repeated-run determinism harness.

### Root cause (proven by instrumentation + mutation control)

Instrumented `lockOrganization` and `effectiveAdministrators` (backend pid, lock timing, snapshot clock, witnesses). On a failing run:

```
pid=9325 (winner)  acquires org lock immediately; witness read snap=55.840  n=2  -> proceeds
pid=9326 (loser)   BLOCKS ~213ms on the org lock (55.841 -> 56.054);
                   witness read at t=56.057 but snap=55.840  n=2  -> proceeds
```

- The **advisory organization lock works**: the loser genuinely blocked ~213ms and acquired the lock only after the winner committed. Coarse-to-fine order and READ COMMITTED row-visibility are all correct.
- The defect: `EFFECTIVE_ADMINISTRATORS` evaluates liveness with **`now()`**, which in PostgreSQL is `transaction_timestamp()` — **frozen at the loser's transaction start** (`snap=55.840`), *before* it waited on the lock. The winner's revoke stamped `effective_to ≈ 55.84x`. The loser's predicate `effective_to > now()` compares against `55.840`, so the **just-revoked grant still counts as live** → loser reads `n=2` → concludes "not the last" → both commit.

The lock's own docstring — *"the loser must SEE the winner's committed row"* — is satisfied for MVCC row visibility but **silently defeated by the frozen clock in the temporal predicate**. The lock removes the staleness; `now()` reintroduces it.

### Mutation control (the fix, proven)

Changing **only** the four `now()` liveness predicates in `EFFECTIVE_ADMINISTRATORS` to `clock_timestamp()` (dist-only, throwaway) → **14/14 green** full-suite repeated runs (was ~2–3/10 red). One change, failure gone. Dist then rebuilt to pristine; **source untouched**, pending ruling.

### Production reachability — this is not a test artifact

The 200 ms `HOLD` in the test only *widens* the window. The window exists whenever the loser's transaction **starts** before the winner's `effective_to` instant — entirely ordinary under real concurrency: two requests to remove the last two distinct administrators arrive together, the loser's tx opens first and then blocks on the org lock, the winner stamps `effective_to` a hair later, and the loser's frozen `now()` predates it. Result: **zero effective administrators, an unrecoverable organization.**

---

## Why HARD STOP

1. GEN-057's stated scope is *suite determinism* (file order / isolation). The determinism proof did its job and exposed a **product-correctness invariant violation** — a reachable zero-administrator lockout — which is a different and larger thing.
2. The fix touches an ADR-017/GEN-030 guard predicate. Whether it is (a) `now()`→`clock_timestamp()` in `EFFECTIVE_ADMINISTRATORS` only, and (b) whether the same frozen-clock defect must be swept across the other `now()` liveness predicates (`GROUP_LIVE_GRANT_NODES` in `administration-floor.ts`, `guardLiveGrant`/`guardLiveMembership`, and any other guard that reads liveness **after** taking a lock) is a design ruling, not an executor call.
3. It wants a mutation bite of its own (`run-mutations.mjs`): the `clock_timestamp()` guard shown firing — revert to `now()`, the cross-route race goes red for its own reason.

## Numbers the ruling asked for

- Diagnosed concurrency/isolation: 61 files / 32 DB / **1** database / `--test-concurrency=1` (already serial).
- Sweep file count: ~12 flagged by crude scan; **1** real leaky teardown (membership `_w3g`-only), fixed.
- N/N result: **NOT N/N** before the guard fix (~2–3/10 red on `THE CROSS-ROUTE RACE`); **14/14** green with the `clock_timestamp()` fix applied.
- Teardowns reaching outside their own fixtures: **1**. That is the real size of *that* class — but the determinism harness's larger yield was the concurrency bug, not the teardown.

## Proposed principle

`a-lock-that-serialises-visibility-is-defeated-by-a-clock-frozen-before-the-wait` — an advisory lock makes the loser read after the winner commits, but a liveness predicate on `now()` (transaction_timestamp) evaluates "is it live now" as of the loser's transaction start, before it waited, so the guard decides against a clock the lock was supposed to move past. Read liveness with `clock_timestamp()` in any guard that reads after taking a lock.

(Companion to the F7 principle `a-suite-whose-verdict-depends-on-file-order-certifies-nothing`: here the suite's verdict depended not on file order but on **wall-clock timing across repeated runs**, and that nondeterminism was a true bug, not flake.)
