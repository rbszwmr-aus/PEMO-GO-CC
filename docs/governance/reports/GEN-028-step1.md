# GEN-028 — W3 Step 1: assessment and proposals. No build.

**Pin:** `1a8af560f8a7e29a8cdc809d6d1605cf5d6e370c`, re-read from the remote — identical to HEAD, clean
worktree. **`GEN-028` allocated from the directory scan.**

**Headline: the last-administrator guard I shipped in W2 is worse than you thought.** It does not
merely miss the membership route — **it counts administrators that do not exist.** Measured below.

---

## (a) `committed` made required — the delta is SMALL, and I recommend it

| | |
|---|---|
| production call sites | **7** (4 `auditedWrite`, 3 `idempotentAuditedWrite`) |
| already passing `committed` | **5** (3 grant ops, 2 occupancy) |
| production sites to touch | **2** — `publishManagementUpdate`, `addEstateContact` |
| test call sites to touch | **6**, all in `audited-write.test.ts` |

**Not materially larger than it looks.** The two remaining production acts return
`Promise<PublishedUpdate>` and `Promise<void>` — **they cannot refuse by value at all**, which is why
they were safe. They would declare `committed: () => true`.

**The trade, stated because `() => true` is not free.** It is an assertion about the command's shape
that the compiler cannot check: if `publish` later starts returning a refusal, the `() => true` keeps
committing it, and the false-audit path reopens silently at a site that looks correct. Required makes
*forgetting* impossible, which is the W1b `source` argument, but it does not make *being wrong*
impossible.

**A stronger shape I considered and do not recommend:** default `committed` to inspecting the result
for a `kind` field and refusing to commit an unrecognised one. Structural, but it is magic — a command
whose success value happens to carry `kind` would be mis-read, and the rule would live in a heuristic
rather than in each act's own contract.

**Recommendation: required, with `() => true` spelled out at the two safe sites and the reason
written there.** It belongs with the primitive, not with W3's surface — see the batching.

## (b) THE BOOTSTRAP IS ONE ACT — confirmed, and it completes rather than redesigns

`createGroup` has exactly the provisioning grant's problem: in an empty organization there is no prior
principal, so no G-2 gate can authorize it. Two acts each needing the other is the circularity `A1`
already resolved once.

**Confirmed expressible, and cheaply:**
- all three tables (`user_group`, `scope_grant`, `group_membership`) are in **`access`**, so one
  transaction on one connection covers them with no boundary question;
- `user_group` carries **no foreign key to `platform.organization`** (stable id, cross-module FK
  forbidden), so the act needs no cross-schema reach to name its organization;
- **the admissibility predicate already exists and is already proven** — zero grants ever, with its
  per-organization advisory lock.

**A1's own words fit without stretching:** *"its first scope grant is created as part of that act"*.
W2 built the act with the group as a preconditionn; W3 folds the group and the first membership into
it. **The predicate does not change, the audit shape does not change, the key does not change** (the
`organizationId`). What changes is what the act creates.

**One consequence to note:** the act becomes the only place a group is created without a G-2 gate, and
it is safe **only** because the zero-ever predicate makes it once-only. That coupling should be stated
in the code, not just true.

## (c) `addMembership` must confer nothing you could not confer directly — expressible

**Rule:** for **every live grant the group holds**, the actor must satisfy G-2 for that grant's node.
Then `addMembership` is exactly as powerful as `confer`, never more.

**Expressible inside `access` alone:** resolve the group's live grants (latest assertion, then
liveness — in that order), project their `(node_kind, node_id)`, and require every one to be in the
actor's expanded administrator set. That set is already computed at the composition layer and passed
down as an in-query filter, exactly as `confer` and `revoke` now do — so **the evaluation happens
inside the act's transaction**, where a concurrent revocation of the actor's own authority cannot race
it.

**Refusal on ANY grant the actor cannot reach**, not on a subset: partial admission would confer
authority the actor does not hold, which is the whole hazard.

**A HOLE I want ruled rather than assumed.** A group holding **no** grants confers nothing today, so
the rule above admits anyone to it — and if that group is later granted something, the member acquires
it without any check at the moment of joining. The confer is gated, so authority never appears
ungated; but membership becomes a way to *pre-position*. **I propose additionally requiring the actor
to hold `grant_administrator` somewhere in the group's organization**, so joining is never a
zero-authority act. I have not assumed it.

## (d) THE GUARD IS BYPASSABLE — and it also counts administrators that do not exist

**You are right about the second route, and the measurement found a first defect underneath it.**

```
-- an organization whose only grant_administrator grant is held by an EMPTY group
guard counts (grants only):                        1
effective administrators (grant AND membership):   0
```

**The guard I shipped counts a grant held by a group with no members.** So it will happily refuse a
revocation to protect an administrator **who does not exist**, and — worse — an organization can
already be in the unrecoverable state while the guard reports it as protected. That is not a missing
case; it is the guard measuring the wrong thing.

**And your route:** dropping the last administrator out of the admin group reaches the identical
lockout with **no grant revoked at all**, and the current guard never runs.

**ONE PREDICATE, as you propose — over EFFECTIVE administrators:**

```sql
-- principals who can actually administer: a live grant_administrator grant,
-- AND live membership of the group that holds it. Latest-then-evaluate on both.
SELECT count(DISTINCT m.principal_id)
  FROM current_grant_assertion c
  JOIN group_membership m ON m.group_id = c.group_id
 WHERE c.role = 'grant_administrator'
   AND <c live at now()> AND <m live at now()>
```

Both routes ask the same question — *would this act leave zero effective administrators?* — so there
is nothing to keep in step. `revokeGrant` and `removeMembership` call one function.

**The lock question, and it is the sharp edge.** W2's guard runs behind a `(group, role, node)` lock,
which does **not** serialise two revocations of *different* administrator grants — a gap I named at
W2. The unified predicate spans grants *and* memberships, so the natural key is **the organization**,
as provisioning already uses. That makes every administrator-affecting act contend on one lock per
organization. **Correct, and I want it ruled rather than chosen quietly**, because it is a
serialisation point on a hot-ish path.

## (e) `group_membership` IS `scope_grant` AGAIN — measured, both routes closed

```
app UPDATE on group_membership: false     app DELETE: false     app INSERT: true

ERROR: conflicting key value violates exclusion constraint "group_membership_no_overlapping_periods"
DETAIL: Key (grp_wfg_block_a_approvers, stf_wfg_dual_role, ["2023-12-31 16:00+00","2026-08-31 12:40+00"))
        conflicts with existing key (…, ["2023-12-31 16:00+00",))
```

**Ending a membership is not expressible by the runtime today**, and for exactly the two reasons
`scope_grant` had before `0118`: shortening `effective_to` is an `UPDATE` the runtime does not hold,
and appending a closing row collides with the **asserted** period of the row it supersedes.

**And the declarative constraint versioning would break is present and identical in shape:**
`EXCLUDE (group_id, principal_id, tstzrange)`. Under an assertion model an instance collides with its
own history, and adding `version` to the key fails on re-join for the same reason it failed on
re-grant — a re-join's first assertion is also version 1.

**So `A′` applies unchanged**: assertion-shape it, drop the exclusion with a stated rationale, hold
cardinality in the write path, and add a whole-table detector beside the existing
`live-grant-cardinality.sh`. **This is the second application of a solved pattern, not a new problem** —
and `0118` is the template down to the down-migration's refusal.

**One difference worth naming:** for `scope_grant` the exclusion was *hygiene* because rights are a
monotonic union. For membership the same argument holds — two overlapping identical memberships confer
exactly what one does — so the reasoning carries. I would still re-measure rather than inherit it.

---

## Proposed batching

Four different failure modes. **Three batches, in sequence:**

| | batch | why |
|---|---|---|
| **1** | **(a) `committed` required** | A *primitive* change touching 7 production + 6 test sites and nothing else. It must not share a diff with a surface: if a test reds, the cause must be unambiguous. Small, mechanical, and it lands first so W3's new acts are born required. |
| **2** | **(e) membership takes the assertion model** + its detector | Pure schema and reader work, the `0118` pattern reapplied. **Must precede (d)**: the unified predicate reads *current* memberships, and "current" is only well-defined once membership is assertion-shaped. |
| **3** | **(b) bootstrap + (c) addMembership + (d) the unified guard** | These three cannot be usefully separated. The bootstrap creates the first membership, so it needs the membership write; `addMembership` needs the G-2-per-grant rule; and **removing the guard's bypass requires both routes to exist at once** — shipping `removeMembership` before the unified guard would open the lockout door and close it in a later PID, which is a window I will not create. |

**Batch 3 is large and I would rather say so now than discover it.** If it proves too big at build
time I would split it as bootstrap first, then membership+guard together — **never** membership
without the guard.

---

## The principles pass — checked before proposing, and two of three have no owner

**1. The fingerprint rule.** Neither named candidate owns it. `[seed-from-declared-basis]` is about
computing a total from a declared basis so a fixture cannot be nudged; `[frozen-axis]` is about a
hand-written list that cannot grow. **The closest real owner is `[identity-by-self-declaration]`** —
*a thing is identified by what it declares itself to be* — which is the same principle in a different
domain: a **request** is identified by what the **client sent**, never by what the server filled in.
Its "ask what an impostor would also match" framing does not map cleanly, so this is a judgement.
**I propose a worked note there rather than a new entry, and I want it ruled.**

**2. Mutation realism.** `[probe-must-bite]` owns it — its subject is exactly *a probe that failed to
change what the check reads*, and an unrepresentative mutation is that failure one level up: the probe
ran, but it did not express the defect it stood for. **A worked note, not a new principle.** GEN-027's
instance: weakening zero-ever to zero-live left 298 green because the weakened SQL still matched an
open version-1 row — the mutation was wrong, not the test, and only asking why the green appeared
separated the two.

**3. `[no-coincidental-collision]`.** Confirmed misleading: its body is entirely about **numeric**
coincidence — *a generated magnitude must not accidentally equal an unrelated corpus figure* — while
its name reads like a concurrency or key-collision rule. It cost you a wrong routing at W2 and cost me
a read. **One clarifying clause at the front of the body, no rename.**

**REPORT ONLY, as instructed — and it has no owner.** *When a class defect is fixed, the regression
test goes against the OLDER callers; the ones written alongside the rule are correct by construction
and are the weaker half of the evidence.* Nothing in the 58 covers it: `[probe-must-bite]` is about
the probe, `[shadowed-layer-empty-oracle]` about what answers first, `[inherited-green-not-earned]`
about a green that was never earned. **Closest is `[specific-assertion-catches-decay]`, and it is not
the same claim.** Reported, not added.

---

## Rulings sought

1. **(a)** required, and whether it lands in batch 1 as proposed.
2. **(b)** the bootstrap as one act — confirmed expressible; confirm the framing.
3. **(c)** the G-2-per-live-grant rule, **and the empty-group hole** — do I add the
   "administrator somewhere in the organization" floor?
4. **(d)** the unified effective-administrator predicate, **and the organization-scoped lock**.
5. **(e)** `A′` reapplied to `group_membership` — confirm, given it is the same shape twice.
6. **The batching**, and whether batch 3 should be split pre-emptively.
7. **The principles pass** — three placements, one of them (the fingerprint rule) a judgement call.

**HARD STOP. No build.**
