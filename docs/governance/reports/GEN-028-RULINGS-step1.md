# GEN-028 (W3) — Step 1 rulings: all seven

Date: 2026-08-31
Report: rewrite/reports/GEN-028-step1.md — read-only, HARD STOP. Pin 1a8af560.

## The headline is yours, and it is worse than what I raised: the guard measures the wrong thing.

```
only grant_administrator grant held by an EMPTY group
guard counts (grants only):                        1
effective administrators (grant AND membership):   0
```

So it **refuses a revocation to protect an administrator who is not there** *and* **an organization can
already be unrecoverable while the guard reports it protected**. A guard that measures a proxy instead
of the invariant fails in **both** directions at once — over-protecting and under-protecting from the
same defect. My membership route was the second defect stacked on that one, and **one predicate over
effective administrators (grant ∧ membership) dissolves both** — with nothing to keep in step, because
both routes ask the same question. Accepted entirely; this is better than what I asked for.

**Report before batch 2 begins:** is any organization **currently** in the falsely-protected state
(an administrator grant held by an empty group)? Cheap check; it changes the urgency, not the design.

## R1 — (a) `committed` REQUIRED: approved, and the trade you named is the honest ceiling.

Delta is 2 production + 6 test sites; the two remaining acts return `PublishedUpdate` and `void` and
cannot refuse by value — which is *why* they were safe, and worth stating rather than leaving as luck.

Your trade is exactly right and must be written down: **required makes forgetting impossible, not
being wrong** — `committed: () => true` is an assertion the compiler cannot check. And **rejecting the
heuristic default that inspects the result for `kind` was correct**: a default that guesses from shape
is a control no one can reason about, and when it guesses wrong it writes a false audit **silently**.

**One addition that converts "being wrong" from invisible to caught:** every command that *can* refuse
by value carries a standing test that **a refusal writes zero audit rows** — the generalisation of the
regression test you already built for occupancy. The compiler cannot check the assertion; a per-command
oracle can.

## R2 — (b) Bootstrap as one act: CONFIRMED, and write down why it is safe.

All three tables in `access`, no cross-module FK on `user_group`, the zero-ever predicate and its lock
already proven, and `A1`'s *"its first scope grant is created as part of that act"* fits without
stretching. It **completes** W2 rather than redesigning it.

**Write your own sentence into the code and the contract:** *this is the only place a group is created
without a `G-2` gate, and it is safe **only** because the predicate makes it once-only.* Unstated, it
is an ungated group creation that a later reader either copies or "fixes" elsewhere. Stated, it is a
deliberate exception with its reason attached.

## R3 — (c) `addMembership`: the rule is approved, the floor is RULED IN, and the residual is named.

Evaluated inside the act's transaction as an in-query filter, refusing on **any** unreachable grant and
never a subset — correct; a partial membership would be an authority you did not intend to confer.

**The empty-group hole is real and you were right not to assume past it.** A group holding no grants
admits anyone, so membership becomes pre-positioning: A joins an empty group today, B confers authority
to that group tomorrow without inspecting its members, and A holds what B never meant to give.

**Ruled: adopt your floor** — the actor must hold `grant_administrator` somewhere in that organization.
It confines pre-positioning to people already trusted to grant authority in that organization.

**And name the residual rather than pretending the floor closes it:** an administrator at one node can
still pre-position into an empty group later granted authority at a node they could not reach. That is
the same **reachability** family as the subtree question already owed — record it there, do not build a
bigger mechanism for it now.

**Suggestion, not a requirement:** have `confer`'s response state the group's **current member count**,
so a conferrer is not blind to whom they just granted. If it does not fit the contract cleanly, skip it
and say so.

## R4 — (e) `group_membership`: A′ reapplies — but establish its OWN rationale first.

Measured and identical in shape: no `UPDATE`, no `DELETE`, the append route blocked by
`EXCLUDE (group_id, principal_id, tstzrange)`. `0118` is the right template.

**But `ADR-013` C6 requires establishing what *this* constraint protects — by measurement and by its
own stated rationale — not inheriting `scope_grant`'s answer.** `0112`'s rationale turned out stale;
that is a fact about `0112`, not a licence to assume the next one is too. Quote this constraint's
rationale, test what it actually stops, and only then reapply A′. If it protects something
`scope_grant`'s did not, the shape bends around it.

## R5 — Batching: APPROVED as proposed, including the fallback rule.

1. **`committed` alone** — a primitive change must not share a diff with a surface. Right.
2. **membership assertion-shaped** — **must precede** the guard, because *"current membership" is only
   well-defined once it is*. That ordering argument is the strongest thing in the batching.
3. **bootstrap + `addMembership` + the unified guard together** — and your reason is the ruling:
   *shipping `removeMembership` before the guard would open the lockout door and close it in a later
   PID.* **Never membership without the guard**; if batch 3 proves too large, split **bootstrap** out
   first, exactly as you said.

## R6 — The principles pass: four items now, and the fourth is deliberate.

- **The fingerprint rule → `[identity-by-self-declaration]`. Your judgement is right; I rule it.** They
  are one claim at two scales: **an identity is taken from what the subject itself declared, never from
  what something else supplied around it.** The artifact declares its id, not the filename; the client
  declares the request, not the server's fill-ins. Append it as a worked note **and let it generalise
  the principle beyond files** — that is a strengthening, not a stretch.
- **Mutation realism → `[probe-must-bite]`** as a worked note. Confirmed.
- **`[no-coincidental-collision]`** — clarifying clause, **no rename**. Confirmed.
- **The fourth: the older-callers lesson has no owner, so add it.** You checked and
  `[specific-assertion-catches-decay]` is not the same claim — I agree. The claim is: *when a class
  defect is fixed, the regression test goes against the **older** callers; the ones written alongside
  the rule are correct by construction and are the weaker half of the evidence.* It has bitten once and
  that once **found a false audit that had been on `main` since GEN-013** — it earns its entry.
  **You name it** (you have the file's conventions in view; I will not invent an id I cannot see), with
  distinguishing notes against `[specific-assertion-catches-decay]` and `[prove-by-making-it-fail]`.
  **Report the name you chose.**

## R7 — Sequencing.
Batch 1 → batch 2 (+ the falsely-protected-state check) → batch 3. Each its own PID and close; the
principles pass rides whichever batch you judge least disturbed by it — say which, and why.

## Owed ledger — additions
- Cross-node pre-positioning into an empty group (R3 residual) — filed with subtree administrability;
  same reachability family.
- The live guard defect stands until batch 3, which is acceptable only because no production exists —
  confirm no organization is currently in the falsely-protected state.
