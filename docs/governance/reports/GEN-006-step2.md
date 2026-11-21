# GEN-006 — Step 2: built and proven

**PID:** GEN-006 v1.0 · **Pin:** `514015e5` (analysis) / register at `be311058`
**Status:** **HARD STOP before commit.** Nothing staged, nothing pushed. The commit additionally waits on the PO confirming ADR-012's core (ruling §7).

---

## 1. The §3 homogeneity check — done before any backfill

The ruling required me to stop if any of the 6 grants explicitly represents a distinguished capability. **They do not.** Each of the six comments describes *scope reach* — estate manager over everything beneath Wing Fu Garden; a block supervisor bounded to Block A; counter staff at a Location with no floor and no unit; a grant that ended; a portfolio grant that must not leak upward; another Organization nothing reaches. **None names an approval, a granting act, or an integration disposition.**

**One near-miss, reported rather than resolved silently.** `grant_seed_blocka`'s comment reads *"A block supervisor"*, and `supervisor` is precisely ADR-010 D2's evidence keyword for **Approver**. I checked rather than assumed: `stf_wfg_block_a` appears in the seed and in four scope tests, and **in no management fixture at all** — no approval step, no `approvalSteps`, nothing. The grant expresses scope, and the word is a job description. So `estate_staff` holds for all six, and the near-miss is on the record in case the Brain reads it differently.

## 2. What was built — exact files under the extended scope

| file | change |
|---|---|
| `database/migrations/0115_access_group_and_role_key.up.sql` | **new** — the two tables, the re-key, the backfill |
| `database/migrations/0115_access_group_and_role_key.down.sql` | **new** — refuses on two conditions (§5) |
| `database/seeds/40-access-staff-and-grants.sql` | groups, memberships, grants re-keyed, dual-role fixture, teardown reordered |
| `modules/access/src/types.ts` | `ScopeRole` + `SCOPE_ROLES`; `ScopeGrant.principalId` → `groupId` + `role` |
| `modules/access/src/repository/access-repository.ts` | `findGrantsAsAt` resolves through membership, both sides as-at |
| `modules/access/src/index.ts` | exports `ScopeRole`, `SCOPE_ROLES` |
| `tests/integration/access-scope-model.test.ts` | 2 inserts re-keyed; **3 tests added** |
| `tests/integration/tenancy-negative.test.ts` | cross-org probe re-keyed |

**Nothing outside the extended scope.** `0112` is untouched. The module's **public API is unchanged** — `getPrincipal(principalId)` and `resolveAsAt(principalId, asAt)` keep their signatures; only the SQL beneath them changed, which is why no caller outside `modules/access` needed editing.

**`role` is `text` + `CHECK`, not a Postgres enum**, matching `0112`'s own `node_kind`: an enum cannot have a value removed and reorders awkwardly, while a CHECK reads in a diff. **All five values are valid from today** — `estate_staff`, `approver`, `integration_support`, `grant_administrator`, `resident` — so a resident grant later needs a row, never a migration.

## 3. Nesting stays open — confirmed

`access.user_group` has **no `parent_group_id`** and nothing in this shape forecloses one. The grant key names a *group*; it says nothing about how groups relate to each other. A later migration adds a nullable self-reference without touching the key, the constraint, or `findGrantsAsAt`. Stated in the migration's own comment so the next reader sees the deliberate omission rather than an oversight.

## 4. The four done-whens, proven by making them fail

**1 — Gap 1 red.** On a database migrated to **0114 only**, two grants for one principal at one node:

```
ERROR:  conflicting key value violates exclusion constraint "scope_grant_no_overlapping_periods"
DETAIL: Key (principal_id, node_kind, node_id, tstzrange(...))=(stf_probe, building, blk_probe, [...])
        conflicts with existing key ...
```

Post-0115, the same shape with two roles stands — and the key still bites when role does not differ:

```
grant_dual_approver  group=grp_wfg_block_a_approvers  role=approver
grant_dual_staff     group=grp_wfg_block_a_staff      role=estate_staff     ← both persist
ERROR: conflicting key value ... Key (group_id, role, node_kind, node_id, tstzrange(...))  ← same role, still rejected
```

Role **widened** the key; it did not loosen it.

**2 — Gap 2 red.**

```
ERROR:  column "principal_id" of relation "scope_grant" does not exist
```

Unrepresentable, not forbidden. There is no state to reject because there is no state to express.

**3 — group of one.** `grp_of_one_stf_wfg_counter` has exactly 1 member; `stf_wfg_counter` reaches `loc_wfg_clubhouse` through it; no other principal reaches anything through that group.

**4 — the differential test.**

```
differential: 7 principals × 1217 nodes = 8519 comparisons, zero disagreements
list differential: 3716 comparisons, zero disagreements
```

**The 7,302 figure was exact and is now superseded: 6 × 1217 = 7,302.** The seventh principal is `stf_wfg_dual_role` — ADR-010 D4's own worked example, Ng Ka-ho — who reaches `blk_wfg_a` through **two roles via two groups**. He adds 1,217 comparisons and takes the total to 8,519. That is the fixture discharging done-when 4 in the stronger form: the differential now *walks* a principal whose grants could not have coexisted under the old key.

**Suites:** integration **166 pass / 0 fail** (163 before + the 3 new), contract **105 / 0**, `verify:boundaries` PASS on all four layers, all from a database migrated from nothing (32 migrations) and seeded.

## 5. The down migration's guard was incomplete, and running it is what found that

I proposed and the ruling approved: refuse on any multi-member group. **That guard was necessary and not sufficient.** Run against the seeded world it passed its own check, altered the schema, and then died halfway through re-adding the old constraint:

```
ERROR: could not create exclusion constraint "scope_grant_no_overlapping_periods"
DETAIL: Key (principal_id, node_kind, node_id, ...)=(stf_wfg_dual_role, building, blk_wfg_a, ...) conflicts ...
```

**The second irreversibility is one principal holding two roles at one node through two groups-of-one** — no group has more than one member, and the pre-0115 key still cannot express it. It is the exact state 0115 exists to create, so the down was guaranteed to meet it the moment the fixture existed.

**A guard that passes and then fails downstream is worse than no guard**: it half-applies the migration before anyone knows. The guard now checks both conditions up front and refuses with the reason named:

```
ERROR: REFUSING to reverse 0115. Principal/node pair(s) stf_wfg_dual_role @ building:blk_wfg_a
       hold more than one role at one node; the pre-0115 key (principal, node_kind, node_id, period)
       cannot express that at all — it is the exact state this migration was written to make possible.
       Resolve the conflicting rows, or do not reverse.
```

Schema verified untouched after the refusal. With the dual-role pair removed the down succeeds cleanly: 6 grants restored with `principal_id`, zero nulls, both new tables dropped.

A smaller one on the way: the first refusal used `RAISE EXCEPTION '%%%'` with three arguments. `%%` is a **literal percent** in `RAISE`, so that is one placeholder and three arguments — `too many parameters specified for RAISE`, failing at the moment a clear refusal matters most. Now one placeholder over an assembled message.

## 6. A correction to the ruling: this does **not** discharge DOC-002 F1

§1 of the ruling says updating the seed *"also discharges DOC-002 F1 (a seed that does not reproduce from nothing) as a side effect — note that in the report."* **It does not, and I have to say so.**

DOC-002 F1 is `database/seeds/scenarios/management__mob-s1-safety__default.sql` and `__partial.sql` omitting `serving_scope_label_en` / `_zh_hant` where `0032:60-62` requires them. That is Home Safety, not Access. `pnpm run seed` still aborts there today, on this build:

```
error: new row for relation "safety_event" violates check constraint "serving_scope_audience_is_explained"
```

**And it cost me a false alarm worth recording.** My first full run showed **163 pass / 7 fail**, and the seven looked like my change. They were not: `seed` aborts on the management scenario, which sorts *before* every `mob-*__default.sql`, so those defaults never applied and the world was incomplete. Applying them directly took the run to 166/0. **The 7 reds were the DOC-002 F1 defect reaching two PIDs downstream**, and I would have spent the next hour hunting my own migration.

What my change *does* fix is `40-access-staff-and-grants.sql`, which would otherwise have failed after the re-key. F1 remains open and unowned.

## 6b. §D — the backfill proven against populated data

The ruling held the merge on this, and it was right to: the `UPDATE` had passed against nothing.

**The fixture.** A database migrated to **0114 only**, populated with the **original principal-keyed seed taken from `origin/main`** (6 grants, 6 principals), plus a principal the seed has never had — `stf_wfg_multi` with **three grants at three different dates**, deliberately inserted out of order so "earliest" cannot be confused with "first written":

| grant | effective_from |
|---|---|
| `g_multi_EARLIEST` | **2022-05-01** |
| `g_multi_middle` | 2024-03-01 |
| `g_multi_late` | 2025-07-01 |

9 grants across 7 principals. Then `0115` applied to that world — exit 0.

**A — groups-of-one.** 7 groups, 7 memberships, **every group exactly one member** (`bool_and(c=1) = t`), and every group's `organization_id` equal to its member's (`t`). No group spans an Organization (D7).

**B — `effective_from` resolves to the earliest grant.** For `stf_wfg_multi`: membership `effective_from = 2022-04-30 16:00+00`, equal to `min(effective_from)` over its group's grants. Checked three ways, because "equals the earliest" is only meaningful if it could have been something else:

- equals **earliest** → `t`
- equals **latest** → `f`
- holds for **every** principal, not just the multi-grant one → `t`

**C — no grant stranded.** 9 grants, 9 with `group_id`, 9 with `role`, **0 orphaned**, every grant reachable by its original principal through membership, role distribution `estate_staff x9`.

**The red — the wrong rule must actually fail.** Resolved through the module's own `resolveAsAt`, as at **2023-01-01** — after the earliest grant, before the other two:

```
(1) correct rule (earliest-of-grants)      -> 1 grant: estate:est_wing_fu_garden/estate_staff
(2) wrong rule  (membership = now())       -> 0 grants
(3) correct rule restored                  -> 1 grant
```

**1 → 0 → 1.** That is the D6 failure made to fire: a membership starting today makes every past-dated resolution return nobody, and it returns nobody *confidently* — no error, just an empty scope for exactly the population an incident review is about. Under earliest-of, the past resolves.

**And the two-roles-at-one-node case on migrated data**, not only on a fresh seed: a second group granting `approver` at `est_wing_fu_garden` to the same principal inserts cleanly, and that principal now holds `approver + estate_staff` at one node — the state 0114 could not express, reached by migrating real rows rather than by seeding them.

## 7. Gaps — this list is complete

1. **Nothing committed.** Two blocks on the commit: this HARD STOP, and the PO's confirmation of ADR-012's core.
2. **DOC-002 F1 is still open** (§6) and now demonstrably blocks a clean `pnpm run seed` for any PID that follows.
3. **`ADR-012` is still `Proposed` and still not in the register.** This build implements it. If the PO's confirmation changes any of D2/D3/D4, `0115` is already immutable and the correction is another migration.
4. **`resident` is a valid role with no row and no code path.** Deliberate per the ruling; it means the CHECK permits a value nothing yet produces, and no test covers a resident grant.
5. **Closed by §6b.** The backfill is now proven against a populated 0114 world, including the multi-grant case the seed's one-grant-per-principal shape could never exercise.
8. **The §D proof is not a committed test.** It ran as a scripted sequence against an isolated database; it is reproducible from §6b but it is not in `prove.sh` and not in the suite. A migration-replay test needs its own database (the suite shares one at head), so wedging it into `tests/integration/` would be the wrong shape. Named as an owed item rather than left implied.
6. **`AS_AT` / `asAtClause` were removed** from the repository file as dead code once the join required qualified column names on both sides. No behaviour change; noted because it is a deletion, not an edit.
7. **Two of my own patch scripts silently no-op'd** before I added assertions — the replacements reported success while changing nothing. Caught by grepping the result rather than trusting the script. Same class as the battery's frozen-axis victim.

## 8. What the Brain is asked to rule

1. **Released and taken** — the PO accepted ADR-012's core (`decisions/adr-012-core-acceptance.md`), and §D is proven, so the commit proceeded under the standard gate.
2. **§1's near-miss** — `grant_seed_blocka` described as "a block supervisor". Confirm `estate_staff`.
3. **§6** — DOC-002 F1 is not discharged; it is now blocking downstream seeds and is unowned.
4. **Gap 8** — a permanent home for the migration-replay proof, which needs its own database.

**HARD STOP.**
