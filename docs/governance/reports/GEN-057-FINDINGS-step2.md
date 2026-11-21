# GEN-057 — the frozen-clock sweep and the fix (step 2)

**PID:** GEN-057 (branch `codex/gen-057`, worktree)
**Date:** 2026-09-04
**Status:** author-complete, awaiting close ruling. No commit yet (HARD STOP held).

## Scope, as EXPANDED by the step-1 ruling (directive 1)

GEN-057 was dispatched as *deterministic integration suite* (GEN-048 F7). The
determinism proof surfaced a production-reachable zero-administrator lockout, and
the ruling expanded this PID to carry the fix: proof and remedy are inseparable,
so a second PID would have shipped the finding without the guard. **The PID's
scope is now: (a) the declared-order / repeated-run integration harness and the
one leaky teardown it exposed; AND (b) the frozen-clock liveness defect it found
— the sweep of every post-lock liveness predicate, the isolation and
database-backstop assessments, the bites, and the principles.**

## Directive 2 + 3 — the sweep, with post-lock classification and MEASURED isolation

**Isolation, measured (not assumed):** `default_transaction_isolation` = `read
committed`; in-transaction `transaction_isolation` = `read committed` (psql, dev
DB). No `SET TRANSACTION` / `default_transaction_isolation` / isolationLevel
override anywhere in `modules`, `apps`, or `database`. `lockOrganization` asserts
READ COMMITTED at runtime (throws otherwise), so the revoke/remove paths are
doubly confirmed. **Consequence:** every path re-snapshots per statement, so the
loser sees the winner's committed row and `clock_timestamp()` is the correct AND
sufficient remedy everywhere. **No path runs at REPEATABLE READ or SERIALIZABLE**,
so the frozen-snapshot caveat (retry-on-serialization-failure / fresh
transaction) applies to none of them — one mechanism, one remedy.

Every SQL `now()` liveness predicate, and whether it runs post-lock (FIX) or is a
fresh-clock JS read / pre-lock read-only (LEAVE):

| # | Site | Query / role | Reached after | Kind & severity | Verdict |
|---|------|--------------|---------------|-----------------|---------|
| 1 | `effective-administrators.ts` (×4) | `EFFECTIVE_ADMINISTRATORS` — last-administrator guard | `lockOrganization` + per-key lock (revoke, remove) | GUARD — **CRITICAL**, under-protect → zero-admin lockout | **FIX** |
| 2 | `administration-floor.ts` (×2) | `GROUP_LIVE_GRANT_NODES` — delegation floor | per-key lock (add); org + per-key (remove) | GUARD — MEDIUM, wrong floor decision | **FIX** |
| 3 | `grant-commands.ts` (confer) | conflict read | `guardLiveGrant` per-key lock | GUARD — LOW, over-refuse (spurious conflict) | **FIX** |
| 4 | `membership-commands.ts` (add) | conflict read | `guardLiveMembership` per-key lock | GUARD — LOW, over-refuse | **FIX** |
| 5 | `occupancy-commands.ts` (record, `resident`) | conflict read | `guardLiveOccupancy` per-key lock | GUARD — LOW, over-refuse | **FIX** |
| 6 | `membership-commands.ts` (`GROUP_GRANT_REACH`, ×2) | disclosed `unreachable`/`live_grants` counts | per-key lock | DISCLOSURE (returned, not decided-on) | **FIX** (uniform) |
| 7 | `membership-commands.ts` (add member count, ×2) | disclosed `liveMembers` | per-key lock + INSERT | DISCLOSURE | **FIX** (uniform) |

**LEAVE — correct as-is, and why:**
- `grant-commands.ts:405`, `membership-commands.ts:370`, `occupancy-commands.ts:330` — `locked.effective_to.getTime() > Date.now()`: JS wall clock, re-evaluated fresh each call. Already correct.
- `latestAssertionSql` — no `now()`; pure `MAX(version)` resolution. The `seen`/`locked` reads select the latest assertion regardless of liveness; liveness is applied by the caller (the sites above) or in JS. Correct.
- `access-repository.ts` (scope-expansion read side) — no `now()` liveness reads.
- `occupancy-audience.ts:28` — `now()` appears only in a comment arguing AGAINST a default of `now()` for an as-at read; no predicate.

All seven fixed sites now read liveness with `clock_timestamp()`; each carries a comment stating why. Isolation is READ COMMITTED on all of them.

## Directive 4 — database-held backstop, assessed (answer: FEASIBLE, recommended as its own PID)

`GEN-049`'s lesson is that an invariant the database can hold should not be
defended in application code alone — and this defect is precisely an application
guard defeated by a clock the application did not control. So: **can "at least one
live effective administrator per organization" be held by the database?**

- **A CHECK constraint: no.** The invariant is cross-row (many `scope_grant` +
  `group_membership` rows), cross-table (`scope_grant` ⋈ `user_group` ⋈
  `group_membership`), per-organization, and temporal (`effective_to` vs the
  clock). A `CHECK` sees one row; it cannot express any of this.
- **A deferred constraint TRIGGER: yes, and it would be naturally clock-correct.**
  A trigger on `scope_grant` and `group_membership`, `DEFERRABLE INITIALLY
  DEFERRED`, firing at COMMIT, can recompute `effectiveAdministrators` for each
  affected organization and `RAISE` if the count reaches zero. Because a trigger
  runs its own statements at commit time, its `now()` is the commit-time
  transaction clock of the deferred check — it is immune to the very frozen-clock
  defect this PID fixes, which makes it a genuine second line rather than a copy
  of the guard.

**Recommendation:** adopt the deferred constraint trigger as the PRIMARY defence
(the invariant the database refuses to leave) with the application guard kept as
the FRIENDLY refusal (`last-administrator`, no 500 — per
`[constraint-violation-never-500]`, whose error-mapping already exists for the
per-key `UNIQUE`). **But not folded into GEN-057:** it is a new migration (and
migrations are immutable once applied), it adds a recompute to every grant/
membership mutation (a measured performance surface), and it wants its own bite
(drop the trigger → a crafted concurrent double-removal reaches zero and the
trigger refuses). This is creditor-PID shaped.

**DECISION (the step-2 ruling left this to me, stated): its OWN id, allocated
after GEN-056 — NOT folded into GEN-056.** GEN-056 is resident-mobile
regeneration; the backstop is an `access` deferred-constraint-trigger migration.
Folding a DB-migration change into a codegen PID would mix change classes and put
an immutable migration under a PID whose bite surface is Dart consumers. **Intent
recorded now so it is not reinvented:** the deferred constraint trigger becomes
the PRIMARY defence of the no-zero-administrator invariant; the application guard
(`EFFECTIVE_ADMINISTRATORS` + the organization lock, now clock-correct) becomes
the FRIENDLY refusal (`last-administrator`, mapped truthfully per
`[constraint-violation-never-500]`, never a 500). GEN-057 ships the guard fix that
closes the reachable lockout today; the backstop hardens it in depth next.

## Directive 5 — the bites

**Two deterministic, certified bites** (`docs/governance/mutations/manifest.json`,
run by `run-mutations.mjs GEN-057` → **2 proven, 0 failed**, baseline green, mutual
instrument control):

- `effective-admins-reads-liveness-at-clock-not-frozen-now` — reverts the
  admin-grant liveness in `EFFECTIVE_ADMINISTRATORS` to `now()`; test
  `[probe-must-bite] EFFECTIVE_ADMINISTRATORS reads liveness at clock_timestamp …`
  reds for its own reason ("a grant that expired ~110 ms before this read must NOT
  count as a live administrator").
- `floor-reads-group-grant-nodes-at-clock-not-frozen-now` — reverts
  `GROUP_LIVE_GRANT_NODES` to `now()`; test `[probe-must-bite] mayAdministerGroup
  floor …` reds ("an expired grant must leave the group grantless and trigger the
  org-node fallback").

Both bites are **deterministic, not races**: one transaction, `now()` frozen at
its start, supersede a grant to expire at `now() + 40 ms`, sleep 150 ms so
`clock_timestamp()` is provably past the expiry, then call the real exported guard
(`effectiveAdministrators(tx,…)` / `mayAdministerGroup(tx,…)`). Under
`clock_timestamp()` the grant is gone; under `now()` it is still "live". Each
bite's control is the OTHER test staying green (reverting site 1 reds test 1 only;
site 2 reds test 2 only — verified both ways). File:
`tests/integration/frozen-clock-liveness.test.ts`.

**The five other fixed sites (conflict reads 3–5, disclosures 6–7): fixed under
the uniform rule, mechanism proven by the two bites above, NOT independently
bitten — and here is the honest reason.** A conflict/disclosure read is reached
only inside its own command's transaction, which has no exported tx-level entry
point and no delay between transaction start and the read. The frozen-clock
divergence only appears when wall-clock time passes between `now()` (tx start) and
the read; with no delay, `now()` and `clock_timestamp()` agree, so a deterministic
bite would require injecting a sleep SEAM into the production command — which I
judged not worth adding to production paths for an over-refuse (transient,
self-correcting) failure. Their fix is the identical one-word change whose
mechanism the two certified bites establish. If the Brain wants per-site
coverage, I can add route-level tests behind a test-only delay hook; flagged.

**The D3 teardown bite (`membership-assertions` `_w3g`→`_w3%`): proven by the
DETERMINISM HARNESS, not `run-mutations`, and deliberately so.** Its failure mode
is a foreign-key violation (`scope_grant_group_id_fkey`) — which `run-mutations`'
criterion correctly classifies as INFRASTRUCTURE, not an assertion, and refuses to
certify. It is also a suite-level, residue-and-order defect: it does not
reproduce in a single-file run (the race test's inline teardown clears `_w3r`
before the file-level `test.after`), only across repeated full-suite runs. The
right instrument for that class is `run-integration.mjs`'s repeated/shuffled run
(directive 8's `[a-suite-whose-verdict-depends-on-file-order-certifies-nothing]`),
where reverting the broadening returns the F7 FK red. Forcing it into
`run-mutations` would be dishonest about what that runner certifies.

## Directive 6 — principles registered (`PID-PRINCIPLES.md`, new "On concurrency and time")

- `[a-suite-whose-verdict-depends-on-file-order-certifies-nothing]` (the F7 principle from step-1's ruling).
- `[a-lock-that-serialises-visibility-is-defeated-by-a-clock-frozen-before-the-wait]` — accepted as worded.
- `[a-guard-that-reads-after-waiting-must-read-at-the-time-it-waited-until]` — the remedy, as worded.

## Directive 7 — lineage

This is a `GEN-030` / `ADR-017` invariant violation found by a harness built for
something else. **No ADR changes: the invariant was always right; its enforcement
had a hole.** The organization lock (GEN-030), the coarse-to-fine order, and the
READ COMMITTED dependency are all correct; only the temporal predicate read
liveness at the wrong clock. The fix serves `ADR-017` (the delegation floor and
the no-last-effective-administrator guard) and `GEN-030` (the residual cross-route
race the lock closes) — cited as the authorities, unchanged.

## Directive 8 — what merges with this PID, sized honestly

- `docs/governance/bin/run-integration.mjs` (declared-order / shuffle / repeated-run harness).
- `tests/integration/membership-assertions.test.ts` teardown fix.
- **The leaky-teardown class was ONE file out of the 32 that touch the database.** The crude prefix sweep flagged ~12, but the rest build ids dynamically and are false positives; the repeated-run proof is the real instrument, and it found exactly one. Not inflated: 1 / 32.
- The frozen-clock fix (7 sites), the two bites + test, the two manifest entries, the three principles.

## D4 — determinism proof (with the SOURCE fix in the tree)

- Before the fix: ~2–3 / 10 repeated runs red on `THE CROSS-ROUTE RACE` (0 !== 1, "got revoked, removed" — zero administrators).
- Mutation control (dist): `now()` → `clock_timestamp()` only → 14 / 14 green.
- With the SOURCE fix + the new bite test, clean repeated run (sorted + 14 shuffled seeds, one un-reset DB, nothing else touching the tree): **15 / 15 identical, `pass=487 fail=0` every run** (487 = the original 485 + the two frozen-clock bites). N/N.

(One earlier repeated-run showed 11 spurious failures; that run was CONTAMINATED — I was rebuilding `@pemo/access` for bite verification while the loop executed tests against the same `dist`. The clean run above has nothing else touching the tree.)

## Still owed by the PO (unchanged)

G7 (recipient name vs unit+resident id); the notice-target portfolio/phase
question; `destructive-target-confirmed` Section 0. And now: whether to allocate
the deferred-constraint-trigger backstop as a creditor PID, and whether to require
per-site bites for the three conflict reads behind a test-only delay seam.
