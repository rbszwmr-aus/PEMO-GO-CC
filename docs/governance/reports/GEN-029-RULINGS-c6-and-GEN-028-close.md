# GEN-029 (W3 batch 2 — group_membership) — C6 assessment rulings, + GEN-028's close

Date: 2026-08-31
Report: rewrite/reports/GEN-029-step1-c6.md — read-only, HARD STOP. origin/main 1a8af560 (GEN-027); GEN-028 built, unmerged.

## R0 — GEN-028's close, and my process failure, owned squarely.

I bundled GEN-028's close box with batch-2's box **one turn after ruling I would not do exactly that**
(GEN-027, "I will not bundle a close box with a next box whose pin depends on it"). Stating a
discipline and breaking it the next turn is worse than never stating it — and I am the one holding the
others to it. **This turn: GEN-028's close goes out ALONE. GEN-029's Step 2 box goes out only after
the close lands and its hash is reported.** The rule is now actually in force, not just written.

(The duplicate dispatch was a relay artifact; read once, harmless.)

## R1 — C6 assessment ACCEPTED. This constraint is NOT scope_grant's, and the gate is vindicated.

`0115`'s rationale — *one person cannot hold the same membership twice over overlapping periods* — is
**accurate**: it describes exactly what `(group_id, principal_id, range)` enforces, unlike `0112`'s,
which described a principal/node invariant the schema no longer had after its own re-key. The
staleness was a fact about `0112`, not a licence — checked, not inherited, which is the whole point of
C6.

Measured, not argued: constraint dropped, the reader returns **3 rows / 2 distinct grants** — a
duplicate membership multiplies on the join side, where `scope_grant`'s exclusion (dropped) could only
ever yield distinct grants. Still hygiene-not-safety on the union argument (`admits` first-matches,
`admitsUnassigned` monotonic, `findAuthorizingGrant` reduces the same, `/scope` dedupes by node key).
So **A′ reapplies** — with R2's extra item.

The alternative (range-on-instance, version-on-assertions) is correctly closed: it fails as at
GEN-024, an instance's history overlapping itself and a re-join's first assertion being version 1
again. Do not revisit it.

## R2 — (ruling 2) The dedup restore RIDES THIS BATCH. And it is a principle.

The finding is the sharp one: `findGrantsAsAt`'s `SELECT DISTINCT`, removed at GEN-024 on the premise
*"grant_id is the row identity, so rows are already distinct,"* was true **only because this exclusion
made a duplicate membership unwritable.** Dropping the exclusion invalidates that premise
**retroactively** — the dedup was deleted a PID ago on reasoning this very migration silently supplied.

**It rides this batch, not a separate change** — for the same reason batch 3 keeps `removeMembership`
with its guard: splitting them opens a window, across a PID boundary, where the exclusion is gone AND
the dedup is absent, i.e. `scope.grants` is silently no longer a set. The exclusion-drop and the
dedup-restore are two halves of one invariant (scope.grants is a set); they land in one diff. The
restored `DISTINCT`'s comment must state **why it is there now** — the exclusion that used to
guarantee it is gone — so it is not removed a second time on the same vanished premise.

**The principle (prose — I will not mint a bracketed id for something unconfirmed):** *a change's
correctness can silently rest on an invariant maintained elsewhere; remove that invariant later and
the change becomes wrong with no edit to it. When dropping a constraint, find what elsewhere was
justified by its existence.* During batch 2, check the 59 for an owner (candidates to READ, not infer
from names: `[reference-do-not-absorb]`, `[redundant-check-is-a-witness]`); if none owns it, add it
and report the id you chose, with distinguishing notes.

## R3 — (ruling 3) The rest of A′ reapplies as described. Confirmed.
Assertion model (version, instance identity, `UNIQUE(instance, version)`, shared resolver reused);
exclusion dropped with a **stated** rationale (no `0115` omission); seed `ON CONFLICT` re-keyed to
`(…, version)` — the **third** table, anticipate it. Plus R2's dedup restore. `0118` is the template.

## Sequence from here (NOT bundled — the close goes alone first)
1. **Now:** GEN-028 close, alone.
2. **After its hash is reported:** GEN-029 Step 2 build box (drafted below, held until then).

## GEN-029 Step 2 — build instructions (to send after GEN-028 closes)
- Assertion model on `group_membership`; reuse the shared resolver; existing rows → version 1.
- Drop the exclusion; NEW migration carries a stated rationale for what replaces it.
- **Restore `findGrantsAsAt`'s dedup in this same diff**, comment corrected to say why it is there now.
- Re-key the seed `ON CONFLICT` to `(…, version)`.
- Prove, each by making it fail: existing suite green; end-membership → resolver not-current, history
  still answers; re-add after removal (new instance, v1); **`scope.grants` is a set** — construct the
  duplicate-membership case that returned 3 rows / 2 grants and prove the reader now returns 2 / 2,
  and that **removing the restored DISTINCT reds it** (the dedup has a live oracle, not a comment);
  the write-path cardinality the exclusion protected is held where A′ holds it, with a detector that
  bites.
- NOT the guard, bootstrap, or addMembership — batch 3.

## Owed ledger — additions
- The "premise supplied by a since-removed constraint" principle (R2) — add during batch 2 if unowned.
