# GEN-025 (W1b + W1c) — rulings + close

Date: 2026-08-31
Report: rewrite/reports/GEN-025-step2.md — HARD STOP, nothing committed. Pin 75443c0d.
Contract 105/105 · integration 274/274 (+22) · battery 24/24 · boundaries PASS · validator PASS.

## Verdict: both halves MERGE. Two confirmations given, two items routed to W2, one owed item that matters more than it looks.

---

## R1 — W1b APPROVED. The `num_nonnulls` proof is the highlight.

The obvious spelling of the biconditional — *"NOT (all three present)"* for a non-staff source —
**permits one or two**, i.e. a **half-attributed act**, which is fabrication wearing a different coat.
You did not reason about it; you **built the wrong version into the live schema and measured**. And
note what the oracle granularity says: **exactly one test caught the subtle break, four catch total
removal.** The subtle case needed its own dedicated test — a reminder that "the constraint is covered"
is not the same as "each way it can be wrong is covered."

Copying `resident.party`'s shape rather than inventing one is right: `A1` requires **one**
representation of honest absence, not a second dialect of it.

## R2 — CONFIRMED: `staff` is the only authority-bearing source. And record *why*, because the reason is the guard.

An integration act is a **job**, and `ADR-010` `D1` excludes a session, a service or a job from
attribution — so naming an operator would be the same fiction in different clothes. Confirmed.

**Record this distinction in the constraint's comment, because it is what stops the rule being
misread:** `source` is **what originated the act, not the channel it arrived through.** An act
genuinely performed by a person that *arrives via* an integration is a person's act carrying that
person's authority — it is not an `integration` act. `integration` means **the integrating system
itself acted**, and a job is never a principal.

**One flag, small and cheap now:** the authority-bearing value is named `staff`, but **residents are
principals too** (the resident-route's acknowledgements). Check whether any shipped write produces an
audit row for a **non-staff principal**; if it does, those rows are now mislabelled `staff` and the
value needs splitting (`resident`) or renaming for what it means (a person acting with authority).
Report it — if nothing produces such rows today, `staff` is accurate for now and the enum is revisited
when the resident-route's writes land. Do **not** fold a rename into the close.

## R3 — W1c APPROVED, and the two non-probing probes are `[shadowed-layer-empty-oracle]` in a form we had not seen.

Both tests were blind, and only mutation showed it:
1. the sequential NULL-trap test passed with `NULLS NOT DISTINCT` removed, because the **pre-check's
   `IS NOT DISTINCT FROM` matched before the index was ever consulted** — it was proving the
   pre-check;
2. the concurrent race *also* passed under the broken index, because both racers wrote the same
   `update_id` and the loser was rejected by **`management_update`'s own primary key**, not by the
   mechanism under test.

Your sentence is the principle: **"the racing writes must not collide on anything except the mechanism
under test."** This is `[shadowed-layer-empty-oracle]` — something answered first, so the thing under
test was never consulted — but in a new form: the shadowing layer here is **incidental** (a pre-check,
a primary key), not a designed gate.

**Routed to W2 as one scoped item:** append a worked note to `[shadowed-layer-empty-oracle]` —
*the shadowing layer need not be a designed gate; an incidental constraint (a pre-check, a primary
key) can answer first and hide the mechanism under test. Construct the probe so the mechanism under
test is the only thing that can produce the observed outcome — e.g. per-attempt row ids, so racers
collide on nothing else.* Cite GEN-025.

## R4 — The primitive separation is exactly right, and the return type is the reason.

`auditedWrite` keeps its signature and return type; `idempotentAuditedWrite` is a **separate export**
— because a repeat must not run the act and `D4` forbids storing the response, so **there is no `T`
to return**. The type forced the separation; that is the best kind of design argument. The shared
function gains **four lines** — that *is* one row's worth; the `+236` is a new, separately-reachable
export. **Reporting the number instead of deciding it was fine** is precisely what I asked for.

## R5 — The boundary-scan blind spot: OWED, and it matters more than it looks.

The new function makes a second qualified cross-schema reach that **the static scan does not flag**,
because the scan asks which schema a *file's module* owns and this file's module is `platform` —
while at runtime it is a crossing on the **calling** module's connection. Recording it in the
primitive's comment was right.

**Why this matters beyond this PID:** we have been treating **"the sanctioned-crossing count did not
move"** as evidence (GEN-015 R1 rested on it). That measure has a blind spot for platform-owned files,
so it proves less than we have been claiming. **Owed:** extend the scan to catch cross-schema reaches
from platform-owned files, or state its limit where the count is used as evidence. Not this PID.

## R6 — Gap 4 (`act_id` stability): a REQUIREMENT, and it must be structural — ruled into W2.

Sharp catch, and it would have broken idempotency outright: if the server generates a fresh act id per
attempt, a retry with the same key trips `D5`'s *same key, different act* and is **refused instead of
replayed**.

**Ruling: act-id stability is not a caller convention.** W2 must make it **structural** — preferably
by having `idempotentAuditedWrite` **derive the act id deterministically from `(operation, key)`**, so
a retry cannot produce a different one. And then `D5`'s same-key-different-act detection must rest on
a **request fingerprint**, not on the act id (which would by then be identical for both). W2's Step 1
proposes the concrete shape; I rule it. **If it is left as "the caller must remember to derive one",
that is a convention, and we know how those end.**

## R7 — Out-of-scope touches: accepted, and one is a good catch.
Four `server.ts` sites (making `source` **required** rather than defaulted meant the **compiler**
enumerated them — the mechanism working), `wiring.ts` unwiring the removed store, three test files.
And the FK test in `audited-scope-write.test.ts` was failing on the **missing `source`** rather than
the foreign key it names — **red for the wrong reason is as bad as green for the wrong reason.**

## Close instruction
Merge through the hook, no `--no-verify`; tag `[GEN-025]`. Rule 7 close → archive/ with row,
`status: merged`, `closed: <today, from `date`>`, artifacts carried (spec, step2 report + this ruling).

## Next: W2 — the grant write surface
Carries: `confer` / revoke with `G-2`, the provisioning act, reason codes (its own declared
vocabulary), an `ADR-015` stance per operation, **the act-id stability design (R6)**, and **the one
scoped `[shadowed-layer-empty-oracle]` worked note (R3)**. Then **W3** — group + membership.

## Owed ledger — additions
- Boundary scan blind to platform-owned cross-schema reaches (R5) — and the crossing-count-as-evidence
  caveat that follows from it.
- The `staff` / non-staff-principal enum question (R2), pending the check.
