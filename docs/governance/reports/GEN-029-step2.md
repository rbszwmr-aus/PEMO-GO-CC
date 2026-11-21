# GEN-029 — W3 batch 2: `group_membership` takes the assertion model

**Status:** built, all green. **NOT COMMITTED. HARD STOP.**
**Pin:** `81453a134a9f195c626e5564ddf12ffa9664c82d`, re-read from the remote — identical to HEAD.

| gate | result |
|---|---|
| contract | **105 / 105** |
| integration | **314 / 314** (was 304 — **+10**) |
| battery | **25 / 25**, zero skips (the membership detector is the 25th) |
| boundaries PASS · validator PASS · index OK | on a database rebuilt from nothing (40 migrations) |

---

## Exact paths (write-scope report)

**New:** `database/migrations/0123_access_group_membership_assertions.{up,down}.sql` ·
`modules/access/src/repository/membership-commands.ts` ·
`docs/governance/bin/live-membership-cardinality.sh` ·
`tests/integration/membership-assertions.test.ts`

**Changed:** `modules/access/src/repository/access-repository.ts` (the dedup restore + membership
resolution) · `modules/access/src/index.ts` · `apps/api/src/wiring.ts` ·
`database/seeds/40-access-staff-and-grants.sql` · `docs/governance/bin/prove.sh` ·
`tests/integration/grant-surface.test.ts` · `docs/governance/PID-PRINCIPLES.md`

**One path beyond the declared scope**, disclosed: `apps/api/src/wiring.ts` and
`modules/access/src/index.ts`, to export and wire the new commands. Without them the module is
unreachable and the proofs cannot run.

## The migration says what `0118` did not have to

`0123` carries the full statement, including the part specific to this table:

> **This table is a JOIN MULTIPLIER, which `scope_grant` was not.** Membership sits on the join side
> of grant resolution, so a duplicate does not add a second grant — it returns the **same grant
> twice**. Measured: **3 rows for 2 distinct grants.**

And the trade: write-time prevention exchanged for the write-path lock, the whole-table detector,
**and the deduplication restored in the reader**; what it buys is the ability to end a membership at
all. The bulk-load reduction is stated, not glossed — (a) is bypassable, (b) is not.

**It also records that `0115`'s rationale was ACCURATE where `0112`'s was stale**, so the next reader
does not inherit the wrong lesson from the wrong precedent. That is C6 earning its keep.

## The dedup restore, and the live oracle

`findGrantsAsAt`'s `SELECT DISTINCT` is back **in this diff**, and its comment now states the reason
it exists *now* — that the constraint which used to guarantee row-distinctness is gone — rather than
the reason it was removable *then*. Membership is also resolved latest-first through the shared
resolver, so a removed membership cannot be read as current.

**And it has a test, not a comment.** `scope.grants IS A SET` constructs the duplicate GEN-029
measured, then asserts distinct-count equals row-count. **Removing the restored `DISTINCT` reds it:
313 pass, 1 fail.**

## Proof — each by making it fail

| claim | evidence |
|---|---|
| reads behaviour-preserved | 105 + 314, zero failures |
| runtime cannot UPDATE or DELETE membership | asserted, not recited |
| **removal works** | version 2 appended; `versions='1,2'`; version 1 **still open and untouched**; resolver answers not-current |
| **the historical question still answers** | as-at 2025 resolves non-empty after a removal exists |
| **re-join after removal** | new instance, **version 1**, accepted — the case the exclusion made impossible |
| removing twice | refused `not-live`, chain still exactly 2 — no no-op assertion |
| **the duplicate is now writable** | asserted as the *premise* of the next test rather than assumed |
| **`scope.grants` is a set** | distinct == count; **remove the DISTINCT → red** |
| write-path guard refuses | second live membership → `conflict`, zero rows written |
| **guard bites** | **remove the lock → `CONCURRENT adds` reds** (313/1). Distinct membership ids, so the act cannot serialise itself on its own primary key |
| **detector bites** | duplicate → red naming the pair; removed → `ok` |
| down migration | refuses with a removal present (*would silently restore a person to a group they were taken out of*); clean reversal succeeds and restores the exclusion |

Every mutation restored and re-verified.

## THE FINDING — the seed re-key was anticipated; a FOURTH site was not

The dispatch called the seed *"the third table to need this"* and I re-keyed it up front, with a
comment saying so. **It was not enough.** `ON CONFLICT (membership_id)` also appears in a **test
fixture** (`grant-surface.test.ts`), which the battery cannot catch because it is not the seed — the
suite caught it as 30 failures.

**The pattern is one site wider than the pattern's own description.** The next assertion-shaped table
should grep `ON CONFLICT (<instance_id>)` across **seeds and tests**, not seeds alone. Reported
rather than generalised into a check, which would be its own item.

## A near-miss worth recording

The scratchpad directory was wiped at the day boundary, so a mutation backup silently failed to
write and the file was left mutated. **`git checkout` would have taken it to HEAD and destroyed this
batch's uncommitted work** — the `[restore-to-target-not-HEAD]` shape exactly. I reversed the
mutation **textually** instead, verified `markers left: 0` and `DISTINCT restored: 1`, rebuilt, and
re-ran to 314 green before continuing. Backups for the later mutations were verified to exist before
the mutation, not after.

## The principle — checked before adding, and neither candidate owned it

**`[reference-do-not-absorb]`** is about not becoming another system's register — unrelated.
**`[redundant-check-is-a-witness]`** is close and is *not* the same claim: there the **check** is the
subject and the question is what it silently guards; here the check is being removed **for a good
reason**, and the subject is the **dependant** — code elsewhere that cited it as a premise and will
not change when it goes.

**New entry: `[premise-maintained-elsewhere]`.** *A change's correctness can rest on an invariant
maintained somewhere else; removing that invariant later makes the change wrong with no edit to it.*
With the instruction that matters — **when dropping a constraint, look for what elsewhere was
justified by its existence; grep the reasoning, not just the references** — and distinguishing notes
against `[redundant-check-is-a-witness]` (which side is examined) and `[stale-read-travels]` (a
*value* travels there; a *justification* decays here, with no value moving at all).

**60 principles.**

## Weight

**New: 794 lines** (migration up/down 183, commands 248, detector 105, tests 258).
**Changed: 93 insertions / 14 deletions across 7 files**, of which `access-repository.ts` is +65 —
mostly the comment explaining why the dedup is back.

## Gaps — complete

1. **`add` is authorized by nothing** — the G-2-per-live-grant rule is batch 3, and the file header
   says so where a route author cannot miss it: *adding a member confers everything the group holds.*
2. **No route** — module-level only, deliberately.
3. **The `ON CONFLICT` pattern is manual** (§ the finding).
4. **The detector runs at battery time**, so a duplicate written after a run lives until the next.
5. **`liveAdministrators` still counts grants, not effective administrators** — the W2 defect stands
   until batch 3, as ruled.

**HARD STOP. Nothing committed.**
