# GEN-013 (A) — Step 2: the second scope-only write, and what generalised

**Status:** built, proven, **NOT COMMITTED, NOT PUSHED. HARD STOP.**
**Headline:** the path generalised — **no new mechanism**, one shared helper widened along a ladder it already declared. Two findings that are not footnotes: **`0022` cannot express an occupancy ending as an appended row**, and **my first gate test was an empty oracle** — deleting the in-query filter left all 13 tests green.

---

## 1. Pin and state

| | |
|---|---|
| **Pin** | `37dce1f1cda9c3c26c87a82f1805b39fb0dac4cc` (Step 1) |
| **`main`** | `7fdeca37856e1df7abc7e1a7f8549e3a11f9ce36` — allocation + its repair. **Nothing since. Nothing pushed.** |
| **Green** | integration+contract **314** (105 + 209), 0 failures · boundaries `PASS` · battery **21/21** · validator PASS · index `--check` OK |

## 2. FINDING — `0022` was built for in-place UPDATE, and I did not work around it

You asked me to confirm first, and the answer is **no**. Proven against the real reader rather than argued:

```
BEFORE — one active row
  occ_908_a12a1   status=active  to=NULL          authorizeUnit -> authorized
AFTER — an 'ended' row APPENDED, as append-modelling would express it
  occ_908_a12a1   status=active  to=NULL
  occ_gen013_end  status=ended   to=NULL          authorizeUnit -> authorized
```

`unit-authorization`'s `isActiveAt` evaluates **each row independently** and `authorizeUnit` admits **any** row active at the instant. `0022` carries no supersession key, no exclusion constraint and no "latest row wins" rule, so **current state is not derivable from appended rows**. An appended `ended` row ends nothing; the resident stays authorised.

So ending an occupancy would require an in-place `UPDATE` — which `pemo_app` cannot issue. **I did not build an end path and did not route around it with an UPDATE.** The contract states the omission as deferred with its reason rather than leaving it silently absent. Closing it needs a decision about `0022`'s shape (a supersession key, or an exclusion constraint over `(resident, unit, period)`), which is a migration and not this PID's.

The act built is **record a new occupancy** — a genuinely new fact, append by nature, needing no state-change modelling.

## 3. FINDING — the first gate suite was an empty oracle

You wrote: *"a passing test must go RED if the filter is deleted. No empty oracle."* It did not. I deleted `WHERE $4 = ANY($9::text[])` from the INSERT and **all 13 tests stayed green** (build status checked, mutation confirmed in `dist`).

**Why.** The route resolves the authorizing grant before the act, and answers 404 when no grant covers the unit. Out of scope, the INSERT is therefore never reached — the in-query filter is real, and unreachable, so no route-level test can distinguish it from its own deletion. A guard standing behind another guard cannot be seen to fire.

**Fixed by testing the decision where it lives**, as GEN-012's tie-break needed: two module-level tests calling `record()` and `findLiveOccupancy()` with an allowed set that excludes the unit, an empty set, and then the same call with the unit present so the refusals are attributable to the filter. Re-run under the same mutation:

```
M1  filter deleted from the INSERT   ✖ the act returned a row for a unit outside the allowed set
M2  conflict filter made always-true ✖ a live occupancy was reported for a unit outside the allowed set
M3  findAuthorizingGrant re-pinned to estates  ✖ 7 tests
```

**Stated plainly: the in-query filter is defence in depth, not the primary gate.** The primary gate is the authorizing-grant lookup — the same mechanism GEN-009 used. Nothing is fetched-then-rejected: the grant lookup is a scope computation and the target row is never read out of scope. But your instruction's filter, while present and now proven, is not the layer doing the work, and you should know that rather than infer it.

## 4. Generalisation — the actual claim

**No new mechanism.** What was reused **unchanged**: `auditedWrite`, `estateStaffGrants` → `scopeExpansion.expand` → filter, `findAuthorizingGrant`'s narrowest-with-tie-break, the audit record shape, property 4 inherited, `403`-absent-by-decision.

**What was this surface's own:** the vehicle and `resident`'s first write command; the contract operation, bump and stamp; two problem types; the domain preconditions (unit exists and is residential, resident exists and is in the organization, no conflicting live occupancy, `effectiveFrom` well-formed).

**One shared helper widened, and I am calling it out rather than burying it.** `findAuthorizingGrant` took a bare `estateId` and checked `expanded.estateIds`. It now takes `{ kind, id }` and checks the matching id set. **This is not a new mechanism** — its `DEPTH` ladder already ran the whole hierarchy and only the *lookup* was pinned to estates — but it is a change to shared code, so "only the vehicle, contract and domain preconditions changed" is very nearly true and not exactly true. GEN-009's three call sites in its own test were updated with it.

**The expand relocated to composition, as you ruled**: `occupancy.unit_id` has no FK, so the allowed-unit set cannot be derived inside `resident` without a cross-module read the boundary forbids. Composition expands; the module filters. Layer relocation, not a new mechanism.

**The gate reached a new rung.** GEN-009 could only ever choose among organization/portfolio/estate. A unit-level act reaches deeper, and a test proves a **building** grant beats the **estate** grant covering the same unit — the ladder exercised at a depth GEN-009 could not.

## 5. Weight — honestly

**Lighter than GEN-009, and the difference is where the work went.**

- **9 files hand-edited** (4 in `apps/api`, 2 in `modules/resident`, 2 contract, 1 test), plus 21 restamped by `stamp-version.mjs`.
- **New module surface:** one file, `occupancy-commands.ts`, ~150 lines including its reasoning. `resident`'s first write.
- **No new primitive, no new migration, no new boundary work, no precursor.** GEN-009 needed two precursors; this needed none.
- **Where the append-only shape forced a design choice:** (a) the act is an INSERT, not an UPDATE — §2; (b) `unitClass` is copied from Property Core rather than accepted from the body, so the denormalised column cannot disagree with the unit; (c) the conflict lookup is scope-filtered and ordered *before* the insert, so out-of-scope answers 404 and never 409.
- **Where the time actually went:** §2 and §3 — proving the append question and discovering my own empty oracle. The write itself was mechanical, which is the generalisation claim proven by absence of work.

## 6. A defect this PID surfaced in GEN-009's shipped contract

`GEN-009` emits two management problem types that are **not registered for that surface**: `event-not-found` is declared `surfaces: ["resident"]` only, and `invalid-request` is **not in the registry at all**. `ADR-009`'s registry is normative and the openapi enum is generated from it, so both are outside the contract they are emitted against. Nothing caught it because no fixture or probe exercises those emissions on the management surface.

I registered **my** two types correctly (`occupancy-target-not-found`, `occupancy-already-exists`, `surfaces: ["management"]`, with `emittedOnlyBy`) and regenerated the enum from the registry. **I did not touch GEN-009's** — it is closed, and reusing the resident `event-not-found` URI on management may violate the registry's own `sharedMeaning` rule, which is a decision, not a repair. My own design avoided the trap by using a management-specific URI.

## 7. Gaps — this list is complete

1. **§2's end path is unbuilt** and `0022` cannot express it. Owed as a migration decision.
2. **§3: the in-query filter is unreachable in the route's out-of-scope path.** Proven at the module, dead at the route. Whether to remove one of the two layers is a design call I did not make alone.
3. **§6: GEN-009's unregistered problem types** — reported, not fixed.
4. **`householdId` is always `null`.** The household is a separate effective-dated fact (`ADR-011` `D7`); requiring or accepting one is undecided, so the write does not set it.
5. **`source` is hard-coded `'management_web'`** with no CHECK behind it. A provenance vocabulary is undecided.
6. **No idempotency** — a retry writes a second occupancy and a second audit row. Owed, as ruled at GEN-009, and it lands here again.
7. **No fixture for the new operation** — the contract is exercised by integration tests, not fixture parity. Same as GEN-009.
8. **A new occupancy changes what a resident may see** (`unit-authorization` reads it). Correct behaviour, and a live coupling: this write can grant a resident access to a unit. No test asserts that consequence.
9. **`effectiveFrom` accepts any instant, past or future.** A future-dated occupancy is not live until then; a back-dated one is immediately live. Neither is bounded.

## 8. Rulings sought

1. **§2** — is the `0022` supersession decision a follow-on PID, or does A's contract stand with the end path deferred?
2. **§3** — keep both gate layers, or collapse to one?
3. **§6** — GEN-009's unregistered types: a repair PID, or fold into the next contract change?
4. **§7.9** — should `effectiveFrom` be bounded?
5. **Commit** — nothing is committed beyond the allocation and its repair.

**HARD STOP.**

---

# Addendum — the one change made before merge

Ruled: *"the contract must NAME the grant lookup as the authoritative gate (do not leave it inferred)."*

`recordOccupancy`'s description now says so in the contract itself, not only in this report:

> **THE AUTHORITATIVE GATE IS THE AUTHORIZING-GRANT LOOKUP.** … that lookup is what refuses, and it refuses before any write is attempted. It is named here rather than left to be inferred, because the request also carries the allowed unit set **into the query** … and that second filter is **defence in depth, not the deciding layer**. A reader who assumed the query filter was the gate would be reasoning about the wrong control.

It also states plainly that nothing out of scope is fetched and then rejected — the grant lookup is a scope computation and the target row is never read.

Re-verified after the change: **314** tests (105 + 209), 0 failures · boundaries `PASS` · battery **21/21** · validator PASS · index `--check` OK. Contract surface hash re-generated (`6f636c380deaa84`, v0.3.0).

Unchanged as ruled: the `findAuthorizingGrant` widening and its disclosure, the module-level oracle that makes the in-query filter bite, and the end-path omission stated in the contract as deferred with its reason. Not touched: GEN-009's cross-surface error URIs, and `0022` — the supersession decision is owed and general to every state-change write among the 27.
