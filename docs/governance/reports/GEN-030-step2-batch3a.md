# GEN-030 — W3 batch 3a: membership acts and the unified guard

**Status:** built, all green. **NOT COMMITTED. HARD STOP.**
**Pin:** `797167d3ba600525356927a2c04ce19a4716ae0a`, re-read from the remote — identical to HEAD.

| gate | result |
|---|---|
| contract | **105 / 105** |
| integration | **323 / 323** (was 314 — **+9**) |
| battery | **25 / 25** · boundaries PASS · validator PASS · index OK |

on a database rebuilt from nothing (40 migrations).

---

## THE QUESTION YOU ASKED: does 3a alone leave the guard correct?

**Yes, and it leaves it MORE correct than deferring it would.** The guard is complete on its own
terms: it measures effective administrators, it covers both routes, and neither depends on the
bootstrap. **3a retires a live defect** — until it lands, the shipped guard reports administrators
that do not exist — so the interval between 3a and 3b is strictly safer than the interval before 3a.

**What 3b changes for it: nothing.** The bootstrap creates the first administrator, so it only ever
*adds* a witness. It cannot make this predicate wrong; it can only make it non-empty for an
organization that currently has no way to become administrable at all.

## 1. The unified guard — `effective-administrators.ts`

One query returning the **witness**: the principal, plus the grant **and** the membership that make
them effective. Both routes ask it the same question through one helper:

- `revokeGrant` refuses iff every witness row's `grantId` is the one being revoked;
- `removeMembership` refuses iff every row's `membershipId` is the one being removed.

**Nothing to keep in step**, because there is one query and one meaning. Latest-then-evaluate on
**both** sides, with the reason written down: this query decides whether a removal is *allowed*, so
counting a revoked grant or a removed member as live would permit the very lockout it prevents.

**`liveAdministrators` is gone, not deprecated** — the only references left are the two comments
explaining why it was replaced.

### The defect, made permanent as a test

```
the grants-only predicate sees          1
effective administrators                0
```

The test spells the **old** predicate out inline rather than trusting a memory of the measurement, so
the comparison is made fresh each run.

## 2. `addMembership`

**The floor first, then cross-organization, then the lock, then G-2.** Refusal on **any** unreachable
live grant — proven against the *plausible wrong rule* (refuse only when nothing is reachable), not a
syntactic weakening.

**The disclosure (§6) fits and is in:** `added` carries `liveGrants` and `liveMembers`, counted in the
same transaction so the numbers describe the world the act created. The count comes from the G-2
query itself, which is why it counts rather than existence-tests.

## 3. `removeMembership` — shipped **with** the guard, never before it

## Proof — each by making it fail

| claim | evidence |
|---|---|
| the old guard's defect is gone | ✔ old predicate 1, new 0, measured inline |
| last effective admin via **revoke** → refused | ✔ |
| last effective admin via **removeMembership** → refused | ✔ and nothing appended |
| non-last via **either** route → allowed | ✔ |
| no over-reach elsewhere in the tree | ✔ a non-administrator revocation and removal both succeed |
| **neuter the guard** | ✔ **both routes red** (315 pass, 8 fail) |
| G-2: any unreachable grant refuses | ✔ and zero rows written |
| **the subset error** | ✔ mutating to "refuse only if nothing is reachable" **reds** |
| the floor | ✔ actor with no admin grant → `not-an-administrator`; **removing the floor reds two tests** |
| empty-group case | ✔ admitted with the floor, refused without |
| cross-organization | ✔ refused, indistinguishably from absent |
| multiplicity + `scope.grants` is a set | ✔ batch 2's oracles still green |
| concurrency probes overlap | ✔ the existing race holds the transaction open, distinct ids |

Backups were **verified to exist before mutating**, and every restore was `cmp`-checked.

## TWO FINDINGS FROM MY OWN TEST CODE

**1. `_` IS A WILDCARD IN `LIKE`.** The batch-2 teardown `DELETE ... WHERE group_id LIKE 'grp_w3_%'`
also matched `grp_w3g_admins` — the underscore matched the `g`. So batch 2's cleanup was silently
reaching into batch 3a's world, and the foreign key caught it. Every prefix teardown in the file is
now `LIKE ... ESCAPE`, and the comment names it as the `[anchor-the-discriminator]` shape in SQL: **a
pattern that matches more than it appears to.** I have not swept the other suites — reported, not
folded in, and it is worth a check rather than a memory.

**2. Two file-level `test.before` hooks do not compose** the way two registrations suggest: the second
ran before the first had assigned `owner`. One ordered hook now.

**And one expectation of mine that was wrong, not the code's:** I asserted two witnesses where the
answer is three, because **the witness is per (principal × grant)** and that group holds an
administrator grant with two members. That is the shape the guard needs — *would this act remove the
last REASON anyone can administer* — so the test now asserts more than one **person**, which is what
actually matters.

## Weight

**New:** `effective-administrators.ts` (128 lines).
**Changed:** 429 insertions / 67 deletions across 6 files, of which the test file is +269.
**No migration, no contract, no new surface.**

## Gaps — complete

1. **No routes.** `addMembership`/`removeMembership` are module-level, as `grant-commands` was before
   W2 wired it. **The membership write surface (routes + OpenAPI + problem types) is not in this
   box's scope and is not built** — say the word if you expected it here.
2. **The actor's admin set is trusted from the caller**, as `confer`'s is: the module cannot expand
   grants itself. A caller passing an unfiltered set would defeat G-2, and only the composition layer
   can prevent that.
3. ~~The residual race~~ — **CLOSED before merge, on the ruling.** Both routes now take a shared
   `pg_advisory_xact_lock(hash(organization_id))` **in addition to** their per-key locks, which still
   serve supersession and cardinality. **Coarse-to-fine in both**, stated in the code: the opposite
   order in either route would deadlock the two against each other under exactly the concurrency this
   serialises. Proven by a genuine cross-route race — one `revoke`, one `removeMembership`, on
   different groups so nothing but the organization lock can serialise them, transactions held open:
   **one refused with the lock; `revoked, removed` — both committing to zero administrators — without
   it.**
4. **Subtree administrability and cross-node pre-positioning** remain owed, as ruled.
5. **The `LIKE` wildcard sweep** (§ finding 1) is not done.

**HARD STOP. Nothing committed.**
