# GEN-013 (A) — Step 2 rulings + close

Date: 2026-08-29
Report: rewrite/reports/GEN-013-step2.md — HARD STOP, nothing committed, main still 7fdeca37.
Predecessor: GEN-013-RULINGS-step1.md (vehicle approval + five Step-1 rulings)

## Verdict: the create/start write MERGES. The end path is deferred-in-contract. Five rulings below.

The `resident.occupancy` create/start write is proven (314 green, boundaries PASS,
battery 21/21, validator PASS, index OK), generalised, and introduces no new mechanism.
Close A per Rule 7. Two findings and one shared-code change are ruled below; two of them
route to C/product as owed debt, none of them blocks the close.

---

## R1 — Shared helper widening (`findAuthorizingGrant` estateId → {kind,id}): APPROVED.

Not a new mechanism. The DEPTH ladder already traversed the full hierarchy; only the
lookup key was pinned to estates. Widening the key to `{kind, id}` is a generalisation,
and GEN-009's estate callers exercise it identically (the 314-green suite is the
behaviour-preserving proof).

The honest "nearly true, not exactly true" disclosure is exactly the standard I want —
widening a shared authorizing helper is itself a scope-touch and must always be called
out, never buried inside "only vehicle + contract + preconditions changed."

The new rung is a genuine strengthening: a building grant now provably beats the estate
grant covering the same unit — a depth of the narrowest-grant tie-break that GEN-009
could not exercise. The invariant holds one rung deeper than it was proven before.

## R2 — 0022 cannot express append-only end: FINDING ACCEPTED. Correct not to work around.

This is precisely what Step-1 ruling item 4 told you to confirm before building, and the
answer is no: `isActiveAt` evaluates each row independently and 0022 carries no
supersession key, so an appended `ended` row leaves `authorizeUnit → authorized`. An
end would therefore require an in-place UPDATE, which `pemo_app` (SELECT+INSERT) cannot
issue — the append-only floor refusing to be bypassed, working as designed.

- Do NOT edit 0022 (migrations immutable).
- Do NOT model an end as an UPDATE.
- The end omission is contract-stated as deferred with its reason — ACCEPTED. The
  create/start write stands without it.
- OWED (schema decision, prioritised, non-blocking): append-only end for occupancy needs
  a supersession key added by a NEW migration (a superseding INSERT that end-stamps the
  prior row, so `isActiveAt` can resolve current state). Route to product/schema. This is
  the general shape for every one of the 27 whose act is a state *change* rather than a
  first assertion — resolve it once, generally.

## R3 — Empty-oracle-at-route: ACCEPTED and codified. Two-gate arrangement is sound.

The arrangement is correct: `findAuthorizingGrant` at the target's `{kind, id}` is the
authoritative gate — it returns absent → 404 for out-of-scope, so nothing is
fetched-then-rejected. The in-query `WHERE unit_id = ANY(allowed)` is defence in depth
behind it. Nothing here violates absence-not-refusal.

The empty oracle was a test-placement defect, not a gate defect: the route's 404
(primary gate) shadows the in-query filter, so a filter mutation survives green at the
route. Main CC's fix — test the decision at the module, where it now bites with the
mutation confirmed in `dist` — is the correct resolution.

New governance principle (owed to C, PID-PRINCIPLES + a battery case):
**A gate layer shadowed by an earlier layer's answer must carry its own layer-local
oracle. A suite that stays green when the shadowed layer's mutation is applied at the
shadowing layer is an empty oracle, regardless of count.**

The contract must STATE which layer is authoritative (the grant lookup), not leave it to
be inferred — Main CC's plain statement is now the standard: name the primary gate.

## R4 — GEN-009's cross-surface error URIs: DECISION, not this write's repair.

Correct not to touch GEN-009's registrations (out of scope; a decision, not a repair).
Main CC registered its own two types correctly and did not reuse a resident URI on the
management surface — right call under uncertainty.

The question: may an error-type URI be shared across surfaces (resident + management)
under the registry's `sharedMeaning` rule? Ruling: `sharedMeaning` permits a shared URI
IFF it denotes identical failure semantics on every surface it appears on. `invalid-request`
(malformed request) and `event-not-found` (a named resource absent) plausibly do — but
"plausibly" is not a ruling.

OWED to C (short registry ruling): enumerate every cross-surface-shared error URI in the
shipped contract, confirm identical semantics case by case, then either bless the share
or split it. Until ruled, do NOT reuse a resident-registered URI on the management surface.

## R5 — Weight and close.

9 files hand-edited + 21 restamped; one new module file (~150 lines); no new primitive,
migration, boundary work, or precursor (GEN-009 needed two). The write was mechanical;
the value was the two findings. This is the shape I expected from the shared path — the
foundation is now doing the work, and each new write is vehicle + contract + preconditions
plus disclosed reuse.

Close A (GEN-013) per Rule 7: file → archive/ with row, `status: merged`, `closed: 2026-08-29`,
artifacts carried. Standard merge gate (refspec push from worktree, main never checked out,
tree-hash equality re-read from remote), `[GEN-013]` commit tag.

---

## Owed ledger (accrued this step → C / product)
1. Occupancy append-only end: supersession-key migration (schema decision, general to the state-change writes among the 27).
2. GEN-009 cross-surface error-URI `sharedMeaning` ruling (registry integrity).
3. Empty-oracle-at-shadowed-layer principle → PID-PRINCIPLES + battery case.
4. (Carried from Step 1, still C) merge-gate `--check`+battery precondition; ADR-011/012 into docs/adr/.

## Next
Per B→A→C: close GEN-013, then the next A scope-only write (write 2 of the remaining set).
Carry the C-ledger above forward; the supersession-key decision (item 1) blocks only
state-change *end* paths, not further first-assertion writes.
