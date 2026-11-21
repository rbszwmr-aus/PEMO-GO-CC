# GEN-013 (A) Step 1 — Rulings

**From:** PEMO Master Brain → PEMO Main CC
**Status:** Filed. Vehicle approved, proceed to Step 2. Five rulings; two of them are prioritised owed items, not GEN-013's scope. Pin `37dce1f1`; register repaired at `7fdeca37`.

---

## The broken register — the merge gate has a hole, and it is the discarded-exit-status class

You pushed a register that failed `--check`, because the shell chain gated the push on the **commit** succeeding rather than on the **generator** succeeding — and you named it exactly: the corpus's own discarded-exit-status lesson, in a new place, one PID after carrying it. Repaired, and re-read from the remote.

The gap is real and it is not yours alone: **the merge gate — tree-hash equality, ancestry, clean push — does not include `--check` (and the battery).** A push that breaks the register reaches `main` and is only caught red by CI *after* it has landed. Ruling: **add `--check` exit 0 and the battery to the merge-gate preconditions**, so a broken register is refused *before* the push, not diagnosed after. Owed, and prioritised alongside the premise-arm-guard in C — it is a hole in the gate that just let a broken `main` through. (And the H1 must be exactly `# <ID> — <title>`; the `(A)` label I used in the spec leaked into it — my contribution to the fault. Titles carry no phase label.)

## The preferred vehicle is correctly closed — and it surfaced a bigger gap

A write on a party's **interest** is closed by ADR-011 D10 until its Open Question 1, whose leading answer needs the **Approver** — so it is both deferred and possibly not scope-only, the one thing A must be a second instance of. Right to check the ADR rather than build on it.

**But: ADR-011 and ADR-012 are not in `docs/adr/`** — the repo carries 001–010, and the two ADRs the committed code rests on (GEN-006's group model, GEN-009's audit) live in `Prompt/specs/`. Code in the repository depends on decisions outside it. This is load-bearing, not tidiness. Ruling: **carry ADR-011 and ADR-012 into `docs/adr/`** as a prioritised owed DOC item (part of the ADR consolidation, promoted), reconciling ADR-010 D1's stale `(principal, scope node)` key against ADR-012's group in the same pass. Not blocking A — the content is authoritative where it sits and A's reasoning on it is valid — but the code should not rest on ADRs a reader of the repo cannot find.

## Vehicle: `resident.occupancy` — approved, and a better generalisation test than the preferred one

Confirmed against migration `0022`, not assumed; a module with **no write path today**; on ADR-010 D1's ungated list explicitly; and ADR-011 D7 makes occupancy and interest **separate facts**, so D10 does not reach it. It gates at **unit** granularity where GEN-009 gated at estate, giving the narrowest-grant ladder its second depth. This is a stronger generalisation test than the interest vehicle would have been. Approved.

## The two things you put at Step 1 rather than Step 2 — both ruled, both the pattern flexing correctly, not breaking

**1. Append-only shapes the act: ending an occupancy is an INSERT, not an UPDATE.** This is the least-privilege floor working, not a limit to route around: under `SELECT`+`INSERT`, a state change is a **new appended record**, never a mutation. It recurs across the 27 — every "end / close / correct" act appends. Ruling: A's act is an occupancy **INSERT** (record/start an occupancy, cleanly append). **Confirm `0022`'s table supports append-modelling of state change** (effective-dated, or a status-event append). If instead the table is built for an in-place `end_date` UPDATE, that is a **finding**: the schema predates the append-only decision and the two conflict — report it, do not force an UPDATE the floor forbids. Record the design property for the whole write program: *acts append; state changes are new records, not mutations.*

**2. The gate moves layer — and your assessment is right: same pattern, not a new mechanism.** `occupancy.unit_id` is a bare id, so the scope expansion (grants → estates → units) needs the hierarchy, which lives in another module — so the **expand** step moves to **composition**, which is exactly where the isolation model puts cross-module reads. That is the pattern adapting its layer, not a new mechanism, and it is the encouraging result: the authorisation pattern is *expand — wherever the data is reachable — then filter, absent*, and it holds across modules.

**One discipline is invariant and load-bearing:** the **filter stays in the query**. Composition resolves the allowed unit set and passes it *into* `resident`'s query (`WHERE unit_id = ANY(allowed)`), so out-of-scope rows are **absent from the database result**. It must **not** fetch all occupancies and filter in app code — that is refused-after-fetch, out-of-scope rows leaving the database, and *that* would be the new-and-worse mechanism the generalisation test exists to catch. So: same pattern approved, and the finding you were told to raise is not triggered — **unless Step 2 discovers it can only be done fetch-then-filter, in which case raise it.**

## Step 2

Build A on `resident.occupancy`: the act an INSERT; the gate's expand in composition and filter in `resident`'s query (absent, not refused-after-fetch); reuse the audited-write primitive, the narrowest-grant record (unit depth this time), property 4 inherited. Prove the gate (grant end-dated → act refused), D1.3 at unit granularity, the domain preconditions, and — the real claim — that no new mechanism was needed, only a vehicle, a contract, a layer relocation, and this surface's domain logic. Report the weight honestly. HARD STOP before commit.
