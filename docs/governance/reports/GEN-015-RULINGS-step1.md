# GEN-015 — Step 1 rulings (apply ADR-013 to occupancy)

Date: 2026-08-29
Report: rewrite/reports/GEN-015-step1.md — HARD STOP, nothing built. main 55a5c472 (allocation, push gated on --check).
Pin: c4d6a016…, tree 3b61a704…

## Headline: SPLIT APPROVED. Slice A (migration + resolver + reader rewrite) is a behaviour-preserving refactor; Slice B (the end write + concurrency mechanism) is additive. They must not land in one diff.

---

## Pre-ruling — ADR-013's stale status line: FIXED (as far as Drive allows) and it stands as evidence.

Correct catch. ADR-013's body still reads "Proposed"; acceptance is recorded and now authoritative
in `adr-013-core-acceptance.md` (Drive patches metadata only, not content). This is the **third**
"artifact stale relative to a document it does not name" (ADR-011/012 missing at GEN-013; the
ADR-010 amendment at GEN-014; this now). ADR-consolidation into `docs/adr/` stays **first C** — it
is the only durable fix, because in-repo the status line is maintainable.

## R1 — D5 for occupancy: NO one-active-occupancy-per-unit. The real invariant is `(resident, unit)`. ACCEPTED.

The seed proves it (`unit_wfg_a_12_a1`: three occupancies, two live) and ADR-011 D7 makes per-unit
**structurally** wrong (Novatek's five flats, the hostel case). 0022 never carried it; imposing it
breaks the seed on the first migration. The real invariant — **one live occupancy per
`(resident, unit)`** — is GEN-013's route-level count-then-insert, the thing D5's own text forbids.
Sharp, and correct.

## R2 — The mechanism: partial-index and exclusion-constraint are BOTH correctly ruled impossible. The choice between SERIALIZABLE / advisory-lock / idempotency-binding is DEFERRED to Slice B.

Confirmed impossible, both:
- Partial unique index can't see "live" (computed from `MAX(version)`).
- Range exclusion would span **superseded** assertions too, so an ended-then-corrected instance
  collides with its own history — the tempting wrong answer, correctly rejected.

So the mechanism is a **serialization** of the check-and-append, which needs a second widening of
`auditedWrite` (the primitive owns the transaction; `ModuleDb.transaction()` issues a bare BEGIN).
**I am not fixing the mechanism now.** It rides with the write machinery, and it deserves a focused
look at Slice B's Step 1, where Main CC proposes concretely against the `auditedWrite`/`ModuleDb`
code. Weigh at least these, with the trade-off:
- **`SERIALIZABLE` + retry** — correct, but makes every write in that transaction serializable
  (blast radius beyond this one invariant) and needs 40001-retry logic.
- **Per-key advisory xact lock** (`pg_advisory_xact_lock(hash(resident, unit))`) — surgical: only
  contends on the same `(resident, unit)`, no isolation change, auto-released at commit. Often the
  smaller-blast-radius answer for "serialize a check-then-insert on a logical key."
- Whether any part reduces to the **idempotency** request-token (a double-submit of the same create
  is a retry, which the token dedups; two genuinely distinct conflicting creates are not).

Guiding rule: **smallest blast radius that holds the invariant at the DB.** Also note: this
mechanism is where **GEN-013's disclosed create-path `(resident, unit)` race gets its real fix** —
so Slice B closes that loose end too, not only the end write's concurrency.

## R3 — Resolver ownership (platform owns the SHAPE, module owns the REACH): ACCEPTED and blessed.

`latestAssertionSql(...)` returns a `DISTINCT ON (instance) … ORDER BY instance, version DESC`
fragment that the **module** executes on its own connection — platform never reads
`resident.occupancy`, so no cross-schema read from the shared layer and **no new boundary
exemption**. This is exactly the GEN-013 shape (composition supplies the shape, the owning module
supplies the reach). Boundary-correct. Build it to be reused, not occupancy-specific.

## R4 — Migration specifics.

- **(a) Keep `effective_from`/`effective_to`.** Valid-time is not absent — they already carry it.
  ADR-013 D3 said "where absent"; it isn't, so **do not rename** (no churn across every reader).
- **(b) The `version` default is a seed-backfill convenience ONLY.** The write path MUST set
  `version` (and the instance identity) **explicitly** on every append — no default may mask a
  missing version in real code. If the default can silently paper over a write-path bug, drop it
  after backfill or guard it. Backfill the existing seed as `version = 1` explicitly.
- **(c) `status` vs `effective_to` disagree in the seed (`occ_733_a12a1`: `active` + past
  `effective_to`) — this is a defect, and the assertion model resolves it.** Liveness is
  **computed** (the `MAX(version)` assertion's effective dating, per D3), **never read from a stored
  `status` flag** — a stored liveness cache that can drift is exactly what D2 forbids. In Slice A,
  determine `status`'s real semantics: if it is a redundant liveness cache, **subordinate it**
  (the reader derives liveness from effective dating/version, not `status`); if it carries a
  genuinely separate domain meaning, keep it as data but it is NOT a liveness source. Reconcile the
  seed disagreement (a corrected seed if it is a bug). The reader rewrite is where this is settled.

## R5 — SPLIT APPROVED. The reasoning is exactly right.

Slice A is a **silent** change whose entire risk is a regression in resident authorization that no
new endpoint would reveal, and whose oracle is the existing 327-test suite. Slice B is additive with
novel concurrency machinery and a second shared-primitive widening. Landing both means those two
failure modes arrive in one diff. Split.

### Slice A (dispatch now) — occupancy becomes assertion-shaped; reads correct; behaviour preserved.
- The NEW migration (assertion columns incl. `version`, instance identity, `UNIQUE(instance_id,
  version)`; keep `effective_from`/`to`; seed → `version = 1`; **0022 untouched**; `status`
  reconciled per R4c).
- Existing occupancy writes (the GEN-013 create) conform: set `version = 1` + instance identity
  **explicitly** (R4b). **No new write, no cardinality guard, no `auditedWrite` widening** — those
  are B.
- The shared resolver (R3) + `isActiveAt` rewritten onto it; liveness computed, not `status`.
- **Oracle:** the existing 327-test suite stays **green** (the behaviour-preserving proof) **plus** a
  new seeded-multiversion test — insert `version 1` active + `version 2` ended → the reader answers
  **ended** (the exact GEN-013 red, now green **for the right reason**: supersession, not
  row-independent evaluation); mutate the resolver's ordering → the suite reds (the resolver has a
  real oracle).
- HARD STOP before commit.

### Slice B (after A lands) — the occupancy END write + the `(resident, unit)` mechanism + D6.
Its Step 1 proposes the R2 mechanism against the real code; I rule it there. Also retro-fixes
GEN-013's create-path race.

## Owed ledger (unchanged except): ADR-consolidation **[first C, reinforced 3×]** · idempotency
request-token half · teardown-isolation · the rest as in STATE-2026-08-29b.
