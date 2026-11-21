# GEN-013 (A) — Step 1: the vehicle, and a blocked preferred one

**Status:** assessed. **HARD STOP.** Nothing built beyond the allocation.
**Headline:** the **preferred vehicle is closed by `ADR-011` `D10`** — no write on an *interest* may be contracted or built until its Open Question 1 is answered, and that ADR's own author's view is that it needs the **Approver**, i.e. it may not be scope-only at all. I propose `resident.occupancy` instead: same module, same domain, explicitly released by `ADR-010` `D1`, and it exercises a **different scope-node kind**, which is a better generalisation test than the preferred vehicle would have been.

---

## 1. Pin, allocation, and a self-inflicted breakage

| | |
|---|---|
| **Pin** | `37dce1f1cda9c3c26c87a82f1805b39fb0dac4cc`, `origin/main` re-read from the remote and equal to HEAD, tree `f29085f2…`, 805 files |
| **Number** | **013** from the generator's directory scan |
| **`main` now** | `7fdeca37856e1df7abc7e1a7f8549e3a11f9ce36` — the allocation plus its repair |

**I pushed a broken register and had to repair it.** The allocation's H1 read `# GEN-013 (A) — …`; the generator requires `# <ID> — <title>` exactly, because the H1 id is cross-checked against the front-matter id and is the only source for the index's title column. `--check` went to exit 2 plus exit 3 drift.

It reached `main` because my shell chain gated the **push** on the **commit** succeeding and not on the generator — I ran the generator, it failed, and nothing stopped what followed. **A check whose exit status is not gated on is not a gate**, which is the corpus's own lesson about discarding a build's exit status, in a new place and committed by me one PID after carrying the principle. Repaired in the next commit; `--check` is exit 0 on the remote now, verified by re-reading it.

## 2. The preferred vehicle is closed — and `ADR-011` is not in the repository

The spec's preferred domain is *a staff act on a party's relation to a unit (`ADR-011`)*. That relation is the **interest**, and:

> **`D10` — The model lands. The write surface stays closed.** … **No write operation on an interest may be contracted or built** until *Open question 1* is answered.

> **Open question 1 — Which `ADR-010` role may write an interest, and does it require the Approver? Blocks: the entire write surface.** … **[my view] (b)** — estate staff to compose, **Approver** to confirm … *"rewriting who owns a flat"* is not an ordinary operation.

So the interest write is doubly wrong for A: it is explicitly deferred, and the open question's leading answer would make it **not a scope-only write** — the one thing this PID is supposed to be a second instance of.

**Separately, and worth a ruling of its own: `ADR-011` and `ADR-012` are NOT in `docs/adr/`.** The repository carries ADR-001…ADR-010 only. Both live at `Prompt/specs/`. `GEN-006` built the group model on ADR-012 D2/D6/D7 and `GEN-009`'s audit record rests on ADR-012 D2 — so **two ADRs the committed code depends on are outside the repository**, and I read ADR-011 from `Prompt/specs/` because that is the only copy. `GEN-006`'s Step 1 §101 already recorded that it had not read ADR-011. This is a decision-has-one-home question, not mine to settle.

## 3. Proposed vehicle: `resident.occupancy`, recording an occupancy

Confirmed against the migration, not assumed — `database/migrations/0022_resident_membership_occupancy.up.sql:25`:

```
resident.occupancy(occupancy_id PK, resident_id FK, household_id FK NULL,
                   unit_id text NOT NULL /* stable id, NO FK */,
                   unit_class CHECK(residential|parking|storage),
                   role CHECK(owner_occupier|tenant|household_member|caregiver),
                   status CHECK(active|ended), source, effective_from, effective_to,
                   CONSTRAINT occupancy_period_ordered)
```

Why it qualifies on every constraint the spec sets:

- **A different module** — `resident`, not `home_safety`. It has **no write path at all today**, so this is that module's first, which is the strongest possible test of "shared, not home_safety-specific".
- **The table already exists.** No schema originated.
- **Released, explicitly.** `ADR-010` `D1`'s ungated list names *"household and resident administration"* among the 27 (`ADR-010-role-list.md:103`).
- **Not an interest.** `ADR-011` `D7` makes interest and occupancy **separate facts, neither implying the other** — the Novatek and hostel cases are why the separation is structural. `D10` closes writes on the *interest*; occupancy is untouched by it.
- **Node-scoped**, at the **unit**.

### The act is an INSERT, and that is forced by the floor

Ending an occupancy would be an `UPDATE` of `effective_to`, and `pemo_app` holds `SELECT` + `INSERT` only. So the act is **record a new occupancy**, which is append-only and consistent with `GEN-010`'s measured posture. **Ending an occupancy is not buildable by this runtime** — a real consequence of the least-privilege floor that this PID surfaces rather than works around, and one the 27 will meet again.

## 4. Shared vs this surface's own — the split, proposed before building

**Shared, expected to be used unchanged:**

| | |
|---|---|
| `auditedWrite` | act + audit, one transaction, nesting throws |
| the gate | `estateStaffGrants` → `scopeExpansion.expand` → ids in the query, out-of-scope **absent** |
| `findAuthorizingGrant` | narrowest grant, tie-break on grant id |
| the audit record | principal FK + narrowest grant + `occurredAt` = `scope.asAt` |
| property 4 | inherited; `INSERT`+`SELECT` arrive by default privileges |
| `403` absent | recorded as a decision in the contract |

**This surface's own:**

- the vehicle and its module command (`resident`'s first write)
- the contract operation, `management-web` bump, lock and stamp
- **domain preconditions**: the resident exists and belongs to the caller's organization; the unit exists, is residential, and `unit_class` matches; no active occupancy already exists for that `(resident, unit)`; `effective_from` is ordered.

### The one shape difference I expect, named now rather than discovered

`GEN-009` filtered **inside the writing module's own SQL**, because `safety_event` carries its own `estate_id`. `resident.occupancy.unit_id` is a **stable id with no FK** — the unit's existence is Property Core's fact, not `resident`'s — so the scope filter cannot live inside `resident`'s query without a cross-module read the boundary forbids. It sits in the **composition layer**: expand the caller's grants to `unitIds`, resolve the unit through Property Core filtered by that set, and an out-of-scope unit does not resolve.

**Is that a new mechanism?** My assessment: **no** — it is the same expand → filter → absent pattern at a different layer, and the layer moved because the scope node lives in another module, which is the module boundary working as designed. But the spec is explicit that this call is a finding if I get it wrong, so I am naming it at Step 1 rather than reporting it at Step 2. **If you read it as a new mechanism, say so and I will report it as the generalisation limit it would then be.**

It is also a *better* test than the preferred vehicle: the gate is exercised at **unit** granularity where `GEN-009` exercised it at **estate**, so the node-kind ladder in `findAuthorizingGrant` gets its second depth.

## 5. Weight — the honest estimate

Lighter than `GEN-009`, and I will report the actual weight at Step 2. Expected: one module command (~80 lines), one route, one contract operation plus bump, one test file. **No new primitive, no new migration, no new boundary work.** `GEN-009` needed a precursor twice; this needs none — which, if it holds, is the generalisation claim proven by absence of work rather than by argument.

## 6. Gaps — this list is complete

1. **I have not confirmed the seeded world supports the negative case** — that some unit is out of a chosen principal's scope while another is in it. `GEN-009`'s world did; I have not re-derived it for **unit** granularity.
2. **`unit_class` is denormalised onto `occupancy`** and must agree with Property Core's record. Enforcing that agreement is a cross-module consistency check with no FK behind it, which is a domain precondition with a real hole under it — recorded, since no constraint can hold it.
3. **`household_id` is nullable** and I have not decided whether the write sets it. The household is a separate effective-dated fact (`ADR-011` `D7`); requiring one may be wrong.
4. **`source` is `NOT NULL` with no CHECK.** What a staff-recorded occupancy's provenance value should be is a domain question I have not answered.
5. **No idempotency**, as ruled at `GEN-009` — a retry writes a second occupancy and a second audit row. Owed, and it lands here again.
6. **I have not verified `resident.occupancy` is unread by the resident-mobile surface** in a way a new row would disturb; it is read by `unit-authorization`, so a new row changes what a resident may see. That is correct behaviour but it is a live coupling I should confirm before writing.

## 7. Rulings sought

1. **§2** — vehicle: `resident.occupancy` as proposed, or do you choose otherwise?
2. **§2** — `ADR-011`/`ADR-012` absent from `docs/adr/` while committed code depends on them. Owed item, or something to fix now?
3. **§4** — the composition-layer gate: same pattern at a different layer, or a new mechanism and therefore a finding?
4. **§3** — that ending an occupancy is not buildable under the least-privilege floor: accepted consequence, or does the 27's programme need a ruling on append-only lifecycle?
5. **§6.3 / §6.4** — `household_id` and `source` semantics.

**HARD STOP.**
