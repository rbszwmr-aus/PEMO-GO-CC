# GEN-016 Step 2 — the occupancy END write and the advisory-lock guard

**Status:** built, proven, **NOT COMMITTED. HARD STOP.**
**Headline:** the guard holds, and **no shared code was widened** — the lock is one statement on `tx`, exactly as proposed. **The stop condition on `reason` fired**: `access.audit_event` has no payload column, so `reason` is not built and no column was added anywhere. And the mutation work found one thing I had not designed: `UNIQUE (occupancy_id, version)` bites on its own, but its violation reached the client **unmapped** — now mapped, per D6.

---

## 1. Pin and state

| | |
|---|---|
| **Pin** | `913b47d1347cbb2a01935eff3530f812dba51135` (Step 1) |
| **`main`** | `8cbdf8786a196d780ebe88384de0d9e8ae1a9b97` — the allocation only. **Nothing since.** |
| **Green** | integration+contract **343** (105 + 238), 0 failures · boundaries `PASS`, still **exactly two** sanctioned crossings · battery **21/21** · validator PASS · index OK |

## 2. FINDING — the `reason` stop condition fired

`access.audit_event` carries `audit_id, principal_id, group_id, role, node_kind, node_id, action, target_kind, target_id, occurred_at, recorded_at, correlation_id` — and **no payload, detail or note column of any kind**. `AuditRecord` in platform mirrors it exactly. GEN-009 built the table to `ADR-010` `D1`'s four properties with nothing free-form, deliberately.

So a `reason` has nowhere to live that is not a **new column** on either `occupancy` or the shared audit table. I was instructed not to add one to `occupancy`; adding one to `access.audit_event` would be schema origination on the shared audit spine, outside this PID and a decision rather than an implementation.

**`reason` is not built.** It is removed from the request, and the contract says why in the schema itself rather than leaving a reader to wonder where the field went. **No column was added anywhere.**

## 3. The END write

`POST /api/management-web/v0/occupancies/{occupancyId}/end`, keyed on the **instance**.

An end appends `version + 1` with `effective_to` set and `status = 'ended'` — the *ended-by-act* path, distinct from a lapse. **The prior assertion is not touched**, and a test asserts that directly: after an end the chain holds two rows, `version 1` still has `effective_to = null`. Slice A's resolver then answers `expired`.

The current assertion is resolved through **Slice A's `latestAssertionSql`**, not re-derived, and the unit on that assertion is what the scope filter applies to. The authoritative gate is the **authorizing-grant lookup** — the scope node is a unit, Property Core's fact — and the contract names it, as `GEN-014` established. The audit targets the **instance**, not the new assertion, because the audit is about the fact.

## 4. The guard, and the create-path retro-fix

**The check moved inside the act**, on `tx`, behind `pg_advisory_xact_lock(hashtextextended(resident || 0x1f || unit, 0))`. That is the actual fix: `GEN-013` checked in the route and appended in the transaction, so nothing was ever serialised and no isolation level could have helped.

**I touched the create path deliberately**, as instructed. `record()` no longer returns `row | undefined` but a discriminated result — `recorded` / `out-of-scope` / `conflict` — because the conflict is now decided inside the transaction rather than guessed beforehand. `GEN-013`'s route and its decision-level test were updated with it. **That is a behavioural change to a shipped write**, and it is the point: the race it had is gone.

**`READ COMMITTED` is asserted, not assumed.** The guard reads `SHOW transaction_isolation` and refuses with a named reason if it is anything else, because the lock serialises only while each statement takes a fresh snapshot — under `REPEATABLE READ` the blocked writer would not see the winner's row and would append anyway, and the guard would look identical while guarding nothing.

## 5. Proof — raced on real connections, each red fired

The racing harness is two independent `createModuleDb` handles: two pools, two connections, `Promise.all`. Not a simulation.

| | result |
|---|---|
| **The END** appends v2, prior assertion untouched, resolver answers ended | ✔ |
| **The gate**, grant end-dated as the only change → refused, nothing appended | ✔ |
| **Precondition**: ending a non-live occupancy → **409, and zero rows appended** | ✔ |
| **Two concurrent CREATES** for one `(resident, unit)` → one `recorded`, one `conflict`, **one** live row | ✔ |
| **Two concurrent ENDS** of one instance → one wins, chain holds exactly 2 assertions, versions contiguous | ✔ |
| **`READ COMMITTED`** asserted and load-bearing | ✔ |

**Mutations — each red for its own reason, confirmed in `dist`:**

- **M1, the advisory lock removed** → ✖ **both** guard tests. The `[INSERTED, INSERTED]` failure returns for creates.
- **M2, the isolation assertion removed** → ✖ the isolation test: `Missing expected rejection`.

### What M1 taught that I had not designed

With the lock gone, the concurrent-ENDS race did **not** produce two assertions. It produced:

```
error: duplicate key value violates unique constraint "occupancy_version_unique"
```

So `UNIQUE (occupancy_id, version)` is load-bearing **independently of the lock** — within-instance supersession safety, exactly as `ADR-013` `D2` says, while the lock holds the *cross-instance* `(resident, unit)` cardinality. Two different invariants, two different mechanisms, and I had been treating the lock as though it did both.

**But the violation reached the client unmapped** — a correctly-refused act reported as a server fault. `D6` says map it to the winning act's response, so the route now catches `23505` on that constraint and answers the winner's truthful outcome: **the instance is now ended, so it is not live** → 409. The mapping is at the route, outside the transaction, because a statement error aborts the transaction and nothing further can be issued inside it. Nothing is appended.

**Retry-idempotency is deliberately absent and asserted as absent.** A repeated end answers 409, never the original 200, and a test pins that — so building the request-token later is a deliberate change rather than a silent one.

## 6. Generalisation — what the next state-change table inherits

**Shared code widened: none.** `auditedWrite` and `ModuleDb` are untouched, as proposed. The crossing count is unmoved at two.

Reused unchanged from Slice A: `latestAssertionSql`, the audited-write primitive, the gate shape with the deciding layer named per contract, the narrowest-grant record, property 4.

**What the other three tables inherit is a pattern, not code**: assert `READ COMMITTED`, take a per-key advisory lock, resolve the current assertion through the shared resolver, check the precondition, append `version + 1`. It is currently a private helper in the resident module (`guardLiveOccupancy`). **Promoting it to platform would be a shared-primitive touch and I did not take one on speculation** — the second consumer should decide its shape, not the first.

## 7. Weight

**8 files: 7 modified, 1 new.** One module command extended, one route added and one route retro-fixed, two contract operations' worth of schema, one problem type, one test file, plus 21 restamped.

**Comparable to `GEN-013`, and the novel work was the harness, as predicted.** The mechanism itself was three statements. What cost time was proving the race exists, proving the guard removes it, and discovering that the unique constraint was doing a job I had attributed to the lock.

## 8. Gaps — this list is complete

1. **`reason` is not built** (§2). The audit spine cannot carry it; whether it should is a decision about `access.audit_event`, owed.
2. **The lock is a convention.** Any future path that appends to occupancy without taking it bypasses the guard. It lives inside the module's own command, so callers going through the command are covered; nothing enforces that a *new* command does.
3. **`hashtextextended` can collide** — two unrelated `(resident, unit)` pairs sharing a key would block each other. Spurious waiting, never incorrectness.
4. **The racing tests are timing-shaped.** Each holds its transaction open for 150ms to widen the window. They pass reliably here; they are not proof against a machine that schedules very differently, and they will be slower in CI.
5. **Re-ending with a different `effectiveTo` is not distinguished from a plain repeat** — both answer 409. The instruction called that a correction and put it out of scope, so a *correction* act is unbuilt, but the response does not tell the two apart.
6. **`findLiveOccupancy` is now unused by the route** and remains on the interface. It is still exercised by GEN-013's tests; leaving a public method with no production caller is a loose end.
7. **The guard is not applied to `estate_contact`'s one-office race** (GEN-014's disclosed concurrency gap). The same pattern would fix it; it is another table and out of scope.

## 9. Rulings sought

1. **§2** — `reason`: leave unbuilt, or does `access.audit_event` get a payload column in its own PID?
2. **§6** — promote `guardLiveOccupancy` to platform now, or wait for the second consumer?
3. **§8.6** — remove `findLiveOccupancy`, or keep it?
4. **§8.7** — does GEN-014's one-office race get this pattern in a follow-on?
5. **Commit** — nothing beyond the allocation is committed.

**HARD STOP.**
