# GEN-015 Slice A — occupancy becomes assertion-shaped

**Status:** built, proven, **NOT COMMITTED. HARD STOP.**
**Headline:** the silent refactor is behaviour-preserving — **334 tests green** — and GEN-013's red is now green **for the right reason**: appending an `ended` assertion ends the occupancy, and re-opening it with a third assertion authorises it again, which row-independent evaluation could never do. **The resolver added no new boundary exemption**, which was the design constraint that shaped it.

---

## 1. Pin and state

| | |
|---|---|
| **Pin** | `c4d6a016bdd45c845855e0ceb2c3198689e65943` (Step 1) |
| **`main`** | `55a5c472c40d2c43a67c37cea0ad9544c56d9cd2` — the allocation only. **Nothing since.** |
| **Green** | integration+contract **334** (105 + 229), 0 failures · boundaries `PASS`, still **exactly two** sanctioned crossings · battery **21/21** · validator PASS · index OK |

## 2. The migration — `0117_resident_occupancy_assertions`, and `0022` untouched

`occupancy_id` stops being the row identity and becomes the **instance** identity; `assertion_id` becomes the primary key; `version`, `recorded_at` are added; `UNIQUE (occupancy_id, version)` is the whole of supersession safety. `effective_from`/`effective_to` are **kept** — valid-time was not absent, only differently named, and the mapping is recorded in the migration rather than churned through every reader, seed and fixture.

**The backfill is explicit**, not a side effect of a default: the seven existing rows are each their instance's first assertion, `version = 1`, `recorded_at = created_at`, with `assertion_id` **derived** (`'occa_' || occupancy_id`) rather than generated so a re-run produces identical rows and the seed stays diffable.

**Its down migration refuses once a real supersession exists, and I fired it** rather than shipping a written-but-unproven guard:

```
instances with >1 assertion: 1
ATTEMPT 1 — reverse with a supersession present
  REFUSED: REFUSING to reverse 0117: 1 occupancy instance(s) hold more than one assertion.
           Reversing would collapse each instance to a single row and discard the
           assertions that superseded it — the history IS the table under ADR-013 D3.
  version column still present: true
ATTEMPT 2 — remove the superseding assertion deliberately, then reverse
  rolled back cleanly; version column gone; re-applied; version back
```

### One consequence I had to act on outside the declared scope

Making `occupancy_id` non-unique **broke the seed**: `database/seeds/30-residents-households.sql` carried `ON CONFLICT (occupancy_id) DO NOTHING`, which no longer matches any constraint. Re-keyed to `ON CONFLICT (occupancy_id, version)`, which preserves the clause's idempotency intent exactly — seed rows are first assertions, so `version` is 1. **Seeds were not in the declared write-scope; the migration made the change unavoidable, so I am calling it out rather than folding it in silently.** One line plus its reason.

## 3. `status` reconciled — it was a redundant liveness cache, and it is now subordinate

**Evidence, not judgement.** `status` had exactly **one** behavioural use in the codebase — `unit-authorization.ts:23`'s `if (relationship.status !== 'active') return false` — and **no row has ever carried `'ended'`** (checked against the live table). It expressed nothing that the effective dating did not.

So: **liveness is computed** from the `MAX(version)` assertion's effective dating, and `status` is no longer consulted. It survives as data describing how a tenure concluded.

**The seed disagreement is not a data bug and I did not "fix" it.** `occ_733_a12a1` is `status='active'` with an `effective_to` in the past — the expired-caregiver fixture, and it is *correct*: a tenure that lapsed by its own dating and was never explicitly ended. The disagreement was a **model** bug — two sources for one fact — and computing liveness resolves it without touching the data. Both directions are now asserted: a closed interval is expired even when `status='active'`, and an open interval is live even when `status='ended'`.

## 4. The shared resolver (D4) — and why it builds SQL rather than running it

`modules/platform/src/assertions/latest-assertion.ts`, exported from platform's single entry.

**The constraint that shaped it:** a resolver that *executed* queries would have platform reading `resident.occupancy`, then `property.building_service_availability`, and so on — a cross-schema read from the shared layer needing a named exemption per table. This codebase has exactly one sanctioned crossing, and GEN-011 established that a sanctioned crossing is granted for one purpose and never widened into a facility. So **platform owns the shape, the module owns the reach**: `latestAssertionSql` returns unqualified SQL the module runs on its own connection.

**Proof it worked:** `verify-boundaries` still reports **exactly two** sanctioned crossings. Slice A added none.

It is reusable by construction — table, instance key, columns and predicate are all supplied, and a test builds a resolver over `safety_event` to show nothing is occupancy-shaped. It refuses a qualified or non-identifier name, so a module cannot reach another schema through it.

**Two design details worth stating.** `version` is projected even when the caller omits it — the ordering column must survive the projection or `DISTINCT ON` has nothing to resolve on. And the filter is documented as restricted to columns **stable across an instance's assertions**: filtering on `status` or `effective_to` would discard the very assertion that supersedes, which is the defect the whole shape exists to prevent.

## 5. Proof

**Behaviour preserved:** the pre-existing suite is **327/327 green** — the oracle Slice A was given.

**The GEN-013 red, now green for the right reason** (`tests/integration/occupancy-assertions.test.ts`, 7 tests):

- appending an `ended` assertion at `version 2` **ends** the occupancy → `expired`;
- **and re-opening at `version 3` authorises it again** — the distinguishing case, because row-independent evaluation would still see the ended row and refuse. This is what makes it supersession rather than luck;
- a reader returns **one row per instance**, and it is the current one, never the superseded one;
- liveness is computed, asserted in **both** directions against `status`;
- the resolver is reusable, and refuses qualified names;
- as-of: an assertion recorded later is invisible to a query asked earlier.

**The resolver's oracle — both halves are load-bearing:**

| mutation | result |
|---|---|
| **M1** `version DESC` → `ASC` | ✖ **5 tests** — the first assertion is returned as current |
| **M2** `DISTINCT ON` dropped | ✖ **5 tests** — every assertion returned, none resolved |

Mutations confirmed in `dist`, restores verified by `cmp`.

## 6. Weight

**9 files: 5 modified, 4 new** (2 migration, 1 resolver, 1 test). No endpoint, no contract change, no version bump, no `auditedWrite` widening, no cardinality guard — all Slice B, as scoped.

**Lighter than GEN-014 in code and heavier in care.** The code is small; the risk was that a silent read-path rewrite regresses resident authorization invisibly, which is exactly why the existing suite was the right oracle and why the split was worth taking.

**One process failure of my own, third instance of the same class.** A patch script printed `ok` for two edits and **wrote neither** — it asserts mid-way, aborts before its single `write()`, and reports the successes it had already printed. I caught it only because I re-read the file. Every edit since is written and **verified on disk individually**. The corpus already carries this lesson from GEN-014; a principle is not a control, and my tooling is the control that was missing.

## 7. Gaps — this list is complete

1. **`recorded_at <= $asOf` is built and has no production caller.** D3 names it and a test exercises it, but nothing in the application asks an as-of question yet.
2. **`DISTINCT ON` performance is unmeasured.** I added `(occupancy_id, version DESC)` to make it an index scan, but did not measure, and the seeded table is seven rows.
3. **The other three state-change tables are untouched**, as scoped — the resolver is built to be reused but has exactly one consumer, so its generality is argued and unit-tested, not yet demonstrated by a second real user.
4. **`UnitRelationship` still exposes `status`** to callers. Nothing reads it for liveness now, but the field is still on the type and a future caller could reintroduce the bug. Removing it is a wider surface change than Slice A should take.
5. **The create write sets `version = 1` explicitly but nothing prevents a future writer from omitting it** and inheriting the default. `UNIQUE` catches it for an existing instance; for a brand-new instance a defaulted `1` is correct anyway, so the failure mode is benign — but it is a default doing work.
6. **No test proves two concurrent creates of one instance collide.** That is D2's safe-first-assertion half, and it needs the racing-connections pattern Slice B must build anyway.
7. **The seed change is outside the declared write-scope** (§2).

## 8. Rulings sought

1. **§2** — the seed `ON CONFLICT` re-key: accepted as unavoidable, or should it be recorded differently?
2. **§7.4** — drop `status` from `UnitRelationship`, or leave it as data?
3. **§7.6** — is the concurrent-create collision proof owed here, or does it land with Slice B's racing pattern?
4. **Commit** — nothing beyond the allocation is committed.

**HARD STOP.**

---

# Addendum — a defect the push gate caught, on a clean database

**Four of my own new tests failed at the merge gate**, on a database bootstrapped from nothing, having passed on my working one.

`bootstrap.sh` runs **`migrate` before `seed`**. On a clean install the table is therefore *empty* when `0117` runs, so its backfill touches nothing and the seed inserts through the column **default** — a random `occa_<uuid>`. My test constructed the id as `'occa_' + occupancy_id`, which is what the **backfill** produces, and that only ever existed on a database seeded *before* the migration was applied. Two worlds, and I had been testing in the wrong one.

Fixed by **deriving** the id from the instance rather than constructing it, with the reason recorded in the test. Suite green again from the clean database: **334** (105 + 229).

**The finding worth keeping:** an assertion id is deterministic on the migration path and random on the seed path, so seeded `assertion_id`s are **not reproducible** between a fresh install and a migrated one. Nothing measured depends on it — the battery's seed-reproduces case is green — but it is a real asymmetry, and setting `assertion_id` explicitly in the seed would remove it. I did not, because the seed is outside the declared write-scope and I have already touched it once out of necessity. **Recorded as a gap, not acted on.**

This is also the fourth time in this programme that a fixture-shaped problem has presented as a code-shaped failure, and the first time the merge gate itself caught one — which is the argument for the owed merge-gate codification, now with a worked instance.
