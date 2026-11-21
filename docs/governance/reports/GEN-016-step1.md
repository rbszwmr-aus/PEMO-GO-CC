# GEN-016 — Step 1: the occupancy END write and the (resident, unit) mechanism

**Status:** assessed. **HARD STOP.** Nothing built beyond the allocation.
**Headline:** I recommend the **per-key advisory transaction lock**, and the finding that settles it is that **it needs NO widening of `auditedWrite` or `ModuleDb` at all** — because the real defect is not the isolation level, it is that the check runs in the route and the append runs in the transaction. Move the check inside the act and the primitive already provides everything required. Proven against the real code, both directions.

---

## 1. Pin and allocation

| | |
|---|---|
| **Pin** | `913b47d1347cbb2a01935eff3530f812dba51135` — `origin/main` after Slice A's merge, re-read from the remote, tree `79eb3828…`, 830 files |
| **Number** | **016**; next is 017. Push gated on `--check`. |
| **`main` now** | `8cbdf8786a196d780ebe88384de0d9e8ae1a9b97` — the allocation |

## 2. The race is real, and I reproduced it before proposing a fix for it

Two independent `createModuleDb` handles — two pools, two real connections — each running the current shape inside `db.transaction`:

```
advisory lock OFF -> [INSERTED, INSERTED]   live rows written: 2
advisory lock ON  -> [INSERTED, refused]    live rows written: 1
```

**Without the lock both transactions insert.** That is `GEN-013`'s `(resident, unit)` invariant failing through the real primitive, not a thought experiment. With a per-key advisory lock, one wins and the other sees the committed row and refuses.

**Availability measured against the least-privilege floor**, because a mechanism the runtime role cannot use is not a mechanism: `pemo_app` — non-superuser, owns nothing, `SELECT`+`INSERT` — can take `pg_advisory_xact_lock`, can call `hashtextextended`, and can also open `SERIALIZABLE`. Default isolation is `read committed`.

## 3. The mechanism — recommended: per-key advisory transaction lock

### The finding that decides it

**The current shape does not serialize anything, because check and append are in different transactions.** `GEN-013`'s route calls `findLiveOccupancy` (outside any transaction), then `auditedWrite` opens the transaction and appends. No isolation level can fix that: `SERIALIZABLE` protects a transaction, and the check is not in one.

So the first move is the same under every option: **the conflict check moves inside the act callback**, where it runs on `tx` and is therefore in the same transaction as the append. Once it is there:

- the advisory lock is one statement on `tx`, needing **nothing** from the primitive;
- `SERIALIZABLE` still needs the primitive to change, because isolation is set at `BEGIN` and only the primitive issues it.

### The three options, weighed

| | blast radius | shared-code cost | failure mode |
|---|---|---|---|
| **`SERIALIZABLE` + `40001` retry** | **the whole transaction**, including the audit insert and the act — every statement becomes serializable to hold one invariant | `ModuleDb.transaction` and `auditedWrite` must accept an isolation level **and** own a retry loop; the act callback must become **re-runnable**, which is a new contract on every caller | aborts under contention; needs retry; false positives possible under unrelated load |
| **per-key advisory xact lock** ⟵ **recommended** | **one key** — contends only with another writer for the same `(resident, unit)` | **none** | blocks briefly, then the loser sees the committed row and refuses cleanly |
| **idempotency request-token** | n/a | n/a | **does not apply** — see below |

**Why the advisory lock is the smallest thing that holds the invariant:** it changes no isolation level, adds no retry machinery, imposes no re-runnability contract on act callbacks, and contends only on the exact key the invariant is about. Two staff members ending occupancies on different units never touch each other. It is released automatically at commit or rollback, so there is no lock to leak.

**Why it works, stated precisely because it is a silent dependency:** it relies on `READ COMMITTED`, where each statement takes a **fresh snapshot**. The blocked transaction, once granted the lock, re-reads and sees the winner's committed row. **Under `REPEATABLE READ` this mechanism would silently stop working** — the loser's snapshot would predate the winner's commit and it would insert anyway. The default is `read committed` (measured), and Step 2 should assert that rather than assume it.

### The idempotency token does not reduce this

A double-SUBMIT of one intent is a **retry**, and a request token resolves it to the original response. **Two genuinely distinct acts that happen to conflict are not a retry** — two different staff members recording the same resident into the same unit are two intents, and no request identity relates them. The token is therefore necessary for retries and insufficient for cardinality; ADR-013 D6 says the same, splitting request-identity from state-identity. **This PID owns only the state-identity half.**

## 4. The widening — none, and that is the proposal

**`auditedWrite` and `ModuleDb` are unchanged.** The measurement in §2 ran entirely through the existing `db.transaction(...)` with only `tx.query(...)`; the advisory lock is a statement, not a transaction property.

This matters beyond convenience. It would be the **second** touch on a shared primitive in the occupancy work, and `GEN-014` established that a write costing the shared layer nothing is the evidence the path is finished. Choosing `SERIALIZABLE` would spend that, and would additionally impose a **re-runnability contract on every act callback** in the system — a far larger change than the invariant justifies.

**What does change is inside the module**: `findLiveOccupancy` moves from the route into the act, and the command takes the lock before it. The route keeps its scope gate exactly as `GEN-013` left it.

## 5. Yes — it retro-fixes `GEN-013`'s create race, and that is the same proof

The create path and the end path share one guard: take the key lock, resolve the current assertion, then append. §2's measurement **is** the create-path race — `[INSERTED, INSERTED]` is precisely `GEN-013`'s defect reproduced.

**How Step 2 proves it:** the racing-connections harness from §2 becomes a test, run against **both** paths — two concurrent creates for one `(resident, unit)`, and two concurrent ends of one instance — and the guard is then removed and the same tests must red. That gives the mechanism a real oracle rather than a green that could not fail. The concurrent-end case is additionally covered by `UNIQUE (occupancy_id, version)`, which needs no lock at all: both ends target `version + 1` and one takes a unique violation.

## 6. The END write's contract shape

`POST /api/management-web/v0/occupancies/{occupancyId}/end` — the instance is the target, which is what an end acts on.

Request: `{ effectiveTo?: RFC3339, reason?: string }`, defaulting to the request instant. Response `200` with the ended instance's current assertion.

- **The gate**, unchanged in shape: expand `estate_staff` grants to units, and — as `GEN-013` — the **authoritative** layer is the authorizing-grant lookup, because the scope node is a unit and units are Property Core's fact. The contract names it, per `GEN-014`'s standard.
- **Resolving the instance uses Slice A's resolver**, not a re-derivation: the current assertion is read through `latestAssertionSql`, and its `unit_id` is what the scope filter is applied to.
- **The act** appends `version + 1` copying the current assertion's stable fields, with `effective_to` set and `status = 'ended'` — `status` as *description of how it concluded*, never as the liveness source (Slice A's ruling).
- **Audit**: unchanged — principal, narrowest authorizing grant, effective instant, `action: 'end_occupancy'`, `targetKind: 'occupancy'`, `targetId` the **instance** id.
- **Problem types** (management surface, registered): `occupancy-not-found` (404, out of scope and non-existent are one answer) and `occupancy-already-ended` (409, the D6-mapped response for a lost supersession race).

## 7. Weight and gaps

**Estimate: comparable to `GEN-013`, lighter than feared** — no shared-primitive change, one module command, one route, one contract operation plus bump, two problem types, one test file plus a racing harness. The novel work is the harness, not the mechanism.

**Gaps — this list is complete:**

1. **The racing harness does not exist.** Node's test runner is single-threaded per file; §2 used two pools and `Promise.all`, which works, but it is a pattern the repository has never carried and it will need care to be deterministic rather than timing-dependent.
2. **`hashtextextended` can collide.** Two different `(resident, unit)` pairs could hash to one key, causing **spurious blocking**, never incorrectness. Acceptable, and stated.
3. **The lock is a convention.** Every writer to this invariant must take it; a future path that appends without it bypasses the guard. Mitigation is that the lock lives inside the module's own command, so any caller going through the command is covered — but nothing enforces that a *new* command does.
4. **`READ COMMITTED` is a silent dependency** (§3). Step 2 should assert the isolation level rather than rely on the default.
5. **I have not designed what "end an already-ended occupancy" returns.** D6 says map to the winner's response; whether a *deliberate* second end is a 409 or an idempotent 200 is a real question I have not answered.
6. **`reason` is proposed with no home.** `occupancy` has no column for it; either it is dropped from the request or it lives only in the audit record, and I have not chosen.
7. **The other three state-change tables are untouched**, as scoped — but if the advisory-lock shape is right, it is the pattern they inherit, and Step 2 should say so explicitly rather than leave it implied.

## 8. Rulings sought

1. **§3** — the per-key advisory transaction lock, on the ground that it is the smallest blast radius and costs the shared layer nothing.
2. **§4** — confirm that **no** `auditedWrite`/`ModuleDb` widening is taken, and that the check moves into the act instead.
3. **§7.5** — a repeated deliberate end: 409, or idempotent 200?
4. **§7.6** — `reason`: drop it, or carry it in the audit record only?
5. **§6** — the endpoint shape, keyed on the instance id.

**HARD STOP.**
