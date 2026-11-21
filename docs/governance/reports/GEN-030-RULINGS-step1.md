# GEN-030 (W3 batch 3) — Step 1 rulings

Date: 2026-09-01
Report: rewrite/reports/GEN-030-step1.md — read-only, HARD STOP. Pin 797167d3.

## Headline: the bootstrap's turtle bottoms out at IDENTITY, which is not ours to decide alone — it goes to the PO. The split inverts, and 3a proceeds now.

---

## R1 — §1 the `staff_principal` gap: a PO-facing IDENTITY decision, not access-control. Split it off.

`group_membership` FKs `staff_principal`, and **nothing in the system creates a `staff_principal`** —
only the seed. So an empty organization has no person to seat in the group it just created: GEN-027's
group gap, one level down. Refusing to choose the shape was **exactly right** — *where an identity
comes from is not an access-control decision*, and this module must not quietly answer it.

The chain has bottomed out where it always would: an authorization system authorizes principals; it
cannot conjure the **first** one, because that identity must enter from **outside** authz. The three
shapes you named are three places that boundary can sit, and the choice has product weight — it is
PO-facing, the same class as the schema-vs-WEB-15 fork, and it warrants its own ADR. **Taken to the
PO this turn.** It blocks **3b only**.

My recommendation, for the PO to weigh: **PEMO authorizes, it does not authenticate.** So the target
shape is *record an externally-authenticated identity* — the bootstrap seats whoever an external
authenticator establishes. Minting an identity invents a person; owning a staff-identity surface makes
PEMO an identity store (a different system). But since no auth integration exists yet, a **one-time
operator seed of the first principal per organization** is a legitimate pragmatic bridge — it removes
the DBA from *ongoing* administration (the actual goal) without pretending to solve authentication now.

## R2 — The split INVERTS. Accepted. 3a = membership + unified guard, now; 3b = bootstrap, after §1.

Your correction is right and I should have seen it: bootstrap was scheduled first on the premise it is
*self-contained and unblocks confer* — it is **neither** (blocked on the identity ruling). Membership
and the guard are blocked on nothing, **and the shipped guard is wrong today** — it reports 1
administrator for an organization where 0 people can administer anything. Fixing an actively-wrong
authority guard is not something to sequence behind a blocked item.

- **3a = `addMembership` + `removeMembership` + the unified guard**, one diff (the door-and-window
  ruling keeps `removeMembership` with the guard). Proceed to Step 2 now.
- **3b = bootstrap**, authored once the PO rules §1.

## R3 — The guard returns the WITNESS, not a count. Blessed — this is the crux and it is right.

Returning the principal **plus the grant and membership that make them effective** is what lets both
routes ask **one** question: `revokeGrant` refuses if every witness row's grant is the one being
revoked; `removeMembership` refuses if every witness row's membership is the one being removed. A
count cannot do this — it cannot tell you *which* grant or membership is load-bearing. One query, one
meaning, nothing to keep in step. Scope confirmed correct: **no live effective administrator anywhere
in the organization**, not at the org node (which would over-reach). This dissolves the GEN-028 defect
at the root rather than patching a second guard on.

## R4 — `addMembership` counting rather than existence-testing: accepted.
Deliberate and justified — the same query yields the live-grant count `§6`'s disclosure needs and that
distinguishes an empty group (admits anyone — the pre-positioning hole) from a fully-reachable one.
Reuse over a second query is right; keep the G-2-per-live-grant refusal exact (any unreachable grant →
refused, never a subset), and the floor (actor holds `grant_administrator` somewhere in the org).

## R5 — The principles pass: DO NOT ADD ONE. Build the control. Both rulings are yours and both are right.

This is the discipline arriving at its own conclusion. You checked, found the class **already written**
(`[principle-is-not-a-control]` records a restore-to-HEAD failure repeated by its own recorder within
the hour, caught by the **battery**, not the principle), and applied that principle's **own meta-rule**
— *when a class recurs, build the check, do not write it down more emphatically* — to your own GEN-029
near-miss as the third recurrence. Adding a fourth restatement would have violated the very principle
it restated. **No new principle.**

**The control is approved as a real owed item:** `with-mutation.sh` that verifies its snapshot exists
**before** touching anything and asserts `cmp` byte-identity after. It is tooling, not this batch's
subject — correct to propose and not fold in. It protects the executor's own workflow from destroying
uncommitted work, so it should land **as its own small governance PID before the next mutation-heavy
build** (the three remaining state-change tables, or schema origination). Owed, prioritised.

## Dispatch now: 3a Step 2 (build), pin 797167d3.
The unified witness-returning guard replacing `liveAdministrators`; `addMembership` (G-2 per live
grant + the org-floor, inside the transaction, counting for the disclosure); `removeMembership` gated
by the same guard. Prove-plan below in the box. 3b waits on the PO's §1 ruling.

## Owed ledger — additions
- **§1 identity provenance** — PO decision this turn; an ADR once chosen; blocks 3b.
- **`with-mutation.sh`** control (R5) — its own small governance PID, before the next mutation-heavy work.
