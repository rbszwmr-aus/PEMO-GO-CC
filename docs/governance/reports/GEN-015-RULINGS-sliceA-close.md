# GEN-015 (Slice A) — rulings + close

Date: 2026-08-29
Report: rewrite/reports/GEN-015-step2-sliceA.md — HARD STOP, nothing committed beyond allocation, main 55a5c472.
334 tests green (327 pre-existing untouched), boundaries PASS (exactly two sanctioned crossings — unchanged).

## Verdict: Slice A MERGES and closes as GEN-015. The occupancy END write + the (resident,unit) mechanism spin to a NEW PID (Slice B).

---

## R1 — Slice A APPROVED. The behaviour-preserving proof holds, by measurement.

327 pre-existing tests untouched among 334; boundaries PASS with the **crossing count unmoved** —
which is the proof that "platform owns the shape, the module owns the reach" actually held (a
platform-executed resolver would have added crossings; it added none). The discriminating case is
**re-open at version 3**: ending at v2 then re-opening at v3 authorizes again, which row-independent
evaluation could not do — this proves **supersession, not luck**, the exact property GEN-013 could
not show. Close as GEN-015 per Rule 7.

## R2 — `status` resolution ACCEPTED. The lapse-vs-end distinction is a keeper (ADR-013 corollary).

`status` was a redundant liveness cache (one behavioural use, no row ever `'ended'`); liveness is
now **computed**, `status` survives as data, the data untouched. The seed "disagreement"
(`occ_733_a12a1`: `active` + past `effective_to`) was correctly diagnosed as **not a bug** — an
expired tenure that **lapsed** (the effective interval elapsing) rather than being **ended** (a
superseding assertion). Record this as an **ADR-013 corollary**:

> **A fact can leave its live state two ways: it LAPSES when its effective interval elapses, or it
> is ENDED by a superseding assertion. Liveness is computed from both; neither is a stored flag.**

This generalises to the other state-change tables (some facts lapse by date, some end by act) and
must be carried into ADR-013 at consolidation.

**Should `status` come off `UnitRelationship` entirely?** Not in Slice A — dropping a column is a
schema change with its own blast radius (readers, contracts, fixtures) and A is a behaviour-preserving
refactor. Keep it, now demoted to data with **no liveness role** (the resolver is the sole liveness
source, so the drift cannot return through code that respects the model). Whether it carries a
genuine domain meaning or is dead weight is a **C cleanup**, not now — do not let the refactor grow
a column-drop.

## R3 — The concurrent-create collision proof is Slice B's, NOT owed here.

Correct. Slice A built no cardinality guard, so there is nothing to prove. The (resident,unit)
concurrent-create collision exercises the **same mechanism** as the concurrent-end collision and
lands with Slice B's racing pattern. Do not owe it to A.

## R4 — The seed re-key (`ON CONFLICT (occupancy_id)` → `(occupancy_id, version)`): ACCEPTED, correctly flagged.

The instance id going non-unique is the whole point of versioned assertions, so a seed `ON CONFLICT`
that assumed uniqueness had to be re-keyed to `(occupancy_id, version)`. Unavoidable and correct;
flagging it (seeds being outside declared write-scope) rather than silently folding it is the
GEN-014 call-out-adjacent-touches discipline. **General consequence:** every state-change table's
seed `ON CONFLICT` needs the same re-key when it becomes assertion-shaped — the next table's PID
must anticipate it.

## R5 — Patch script printed `ok` and wrote nothing: THIRD instance → the principle is codified NOW.

Same class as GEN-014's stale-summary. Three times is the mandate. Into PID-PRINCIPLES this sweep,
not later: **never trust a patch/edit tool's own success report; verify every edit on disk by
re-read.** If a shared patch helper exists, it must re-read-and-assert by construction. Elevated
alongside teardown-isolation in the C-sweep's first tranche.

## Close instruction
Merge Slice A (standard gate; `[GEN-015]` tag; push gated on `--check` + battery). Rule 7 close:
GEN-015 → archive/ with its row, `status: merged`, `closed: 2026-08-29`, artifacts carried (spec,
step1 report + ruling, sliceA report + this ruling). The archive note records that the occupancy
**end write** spun to a new PID (Slice B) — GEN-015's delivered scope is the migration + resolver +
reader rewrite.

## Slice B — a NEW PID (allocate at dispatch)
The occupancy END write + the (resident,unit) cardinality mechanism + D6 binding. Its Step 1
proposes the mechanism (SERIALIZABLE vs advisory-lock) and the `auditedWrite` widening against the
real code; I rule there. It also retro-fixes GEN-013's disclosed create-path race.

## Owed ledger — additions this slice
- ADR-013 **lapse-vs-end corollary** → fold at consolidation.
- Seed `ON CONFLICT` re-key is a **general** consequence for every state-change table.
- Patch-verify-on-disk principle → PID-PRINCIPLES **now** (3×).
(Everything else as STATE-2026-08-29b.)
