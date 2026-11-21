# GEN-006 — Step 1: the pin, the decided shapes, and the proposed migration

**PID:** GEN-006 v1.0 · **Write scope:** a new migration under `database/migrations/`, `modules/access/**` and its tests. Read-only everything else.
**Status:** **HARD STOP.** Nothing built. Three scope conflicts in §5, one of which blocks done-when 4.

---

## 1. The pin, and the number

| | |
|---|---|
| **Pin (analysis)** | `514015e52a57262a549d4eefa70ce1de2a356958` / tree `96fb3040c0bbb22d2e89cb6f6a5726a35828c41b` / 748 files |
| **`main` now** | `be311058e6fbb0bb4781dd0041ef592f8c3bb43c` — the GEN-006 allocation |
| **Number** | **006**, emitted by `pid-index.mjs --next` against `pids/` + `archive/`, not taken from the instruction. Next is now 007 |
| **New migration number** | **0115** — highest existing is `0114`, and `migration-numbering.test.ts` requires a new migration to exceed the pre-existing maximum |

## 2. What the ADRs actually decide — read in full, quoted rather than paraphrased

### ADR-010 D4 (repo, `docs/adr/ADR-010-role-list.md`)

> `GEN-018-ST` built `access.scope_grant` with a `btree_gist` exclusion over `(principal, node_kind, node_id)` and a half-open `tstzrange`. **`role` joins that key.**

It also decides the backfill's character, which changes how Step 2 must word it:

> The backfill value is asserted to have been true **historically**, so it is a claim about the past, not a default.

### ADR-012 D2, D3, D4

> **Groups-only, confirmed 2026-08-20. There are no direct grants to a principal.** A one-off permission for one person means **a group of one**, and the Product Owner accepted that cost explicitly when it was named.

> A grant is `(group, role, node)`, and every member holds that role at that node for as long as they are a member.

> **The exclusion key becomes `(group, role, node_kind, node_id)`** … **It is a substitution, not a widening:** `principal` leaves the key and `group` takes its place, with membership as a separate effective-dated relationship. **No column is polymorphic and no row is ambiguous.**

Two more that constrain the schema and are easy to miss: **D7** — groups are Organization-scoped, *"a group never spans Organizations"*; **D6** — membership is effective-dated, because *"a system that resolves the grant historically and the membership currently is worse than one that does neither."*

**So the final key is `(group_id, role, node_kind, node_id, tstzrange)`** — Gap 1 and Gap 2 landing on one constraint, exactly as the PID says.

## 3. Proposed shape for `0115`

Three tables touched, one new constraint. `0112` is not edited.

**New — `access.user_group`:** `group_id` PK, `organization_id NOT NULL`, `display_name NOT NULL`, `created_at`. Org-scoped per D7; no cross-schema FK, consistent with the existing `no-cross-module-foreign-key` sweep.

**New — `access.group_membership`:** `membership_id` PK, `group_id` → `user_group`, `principal_id` → `staff_principal`, `effective_from`, `effective_to NULL`, with the same half-open `tstzrange` discipline and an exclusion on `(group_id, principal_id, period)` so one person cannot hold two overlapping memberships of one group. Effective-dated per D6.

**Altered — `access.scope_grant`:** add `group_id` (FK → `user_group`) and `role`; **drop `principal_id`**; drop `scope_grant_no_overlapping_periods` and recreate it as

```sql
EXCLUDE USING gist (
  group_id  WITH =,
  role      WITH =,
  node_kind WITH =,
  node_id   WITH =,
  tstzrange(effective_from, effective_to) WITH &&
)
```

**Backfill — the group-of-one, as ADR-012 D2 decides.** One `user_group` per distinct principal currently holding grants, one membership per group, each grant re-pointed to its principal's group. Measured at the pin: **6 grants across 6 distinct principals** in `40-access-staff-and-grants.sql`, so 6 groups and 6 memberships.

**Membership effective_from** is proposed as the earliest `effective_from` of that principal's grants, **not** `now()`. Under D6 a historical question resolves through grant *and* membership together; a membership starting today would make every past grant resolve to nobody, which is precisely the "confident answer that is wrong only for people whose membership changed" D6 warns about.

**The `role` backfill value needs a ruling (§5.3).** ADR-010 D4 requires it to be a claim about the past. ADR-010 D2 names four roles in prose — *Estate staff*, *Approver*, *Integration support*, *Grant administrator* — but no identifier spelling exists anywhere in the schema or code. I propose the enum `estate_staff | approver | integration_support | grant_administrator` and the backfill value `estate_staff`, since D2 calls Estate staff *"the residual — holds scope, performs the 27"* and every seeded grant is a scope-holding staff grant. **Both the spelling and the backfill claim are decisions, not derivations, and I will not take them myself.**

## 4. How the four done-whens will be proven

1. **Gap 1 red.** Two grants differing only by role, same group/node/period. Pre-fix — expressed as two grants for one principal — must raise `scope_grant_no_overlapping_periods`; post-fix both must persist. The pre-fix half runs against `0114` before `0115` applies, so the red is shown on the real constraint rather than argued.
2. **Gap 2 red.** Attempt a principal-held grant post-fix. Because `principal_id` is **dropped**, the failure is `column "principal_id" does not exist` — *unrepresentable* rather than *forbidden*, which is the stronger form. Stated plainly so nobody later reads a bare SQL error as an incidental failure.
3. **Gap 2 positive.** A group of one, one member, one node: exactly that principal resolves the node and a second principal does not.
4. **The differential test.** Re-run, plus a new case. Note on its size: **the "7,302 comparisons" figure is computed, not written** — `git grep` for `7302` and `7,302` across `tests/` and `modules/` returns nothing; the test walks the full cross product of seeded principals × seeded nodes. I will report the number the run actually produces rather than repeat the figure.

**And the substance of (4)(b) needs saying.** The differential test compares Property Core's recursive SQL expansion against Identity and Access's in-memory ancestry predicate. **Neither side reads `role` or `group`.** A role-collision case therefore does not naturally belong to it: it is a constraint-shape property, not a filtering property. Two honest options: (i) add the role-collision case to the *access-scope-model* suite, which owns constraint behaviour, and re-run the differential unchanged as a no-regression check on filtering; or (ii) extend the differential's fixture so the cross product includes a principal reaching one node through **two roles via two groups**, which does exercise the new key through the resolution path. **(ii) is the one that discharges the PID's wording** — "gain the role-collision case … which would have passed under the old key and must fail-then-pass across the fix" — and it is more work. I propose (ii) and flag that (i) alone would not meet the wording.

## 5. Three scope conflicts — two blocking

### 5.1 The seed is outside the write scope, and done-when 4 cannot be reached without it

`database/seeds/40-access-staff-and-grants.sql:33` inserts `(grant_id, principal_id, node_kind, node_id, …)`. After the re-key that column does not exist, so **the seed fails**, no world can be built, and every DB-backed test — including the differential test — cannot run. The declared write scope covers the migration, `modules/access/**` and its tests; **it does not cover `database/seeds/`.**

This is not a widening for convenience: **done-when 4 is unreachable without it.** It also touches DOC-002 F1 directly — a repo whose seed does not reproduce from nothing is the defect that audit recorded.

### 5.2 "its tests" are not under `modules/access/`

`modules/access` contains no tests; the suites that exercise it live in `tests/integration/` — `access-scope-model.test.ts`, `scope-differential-property.test.ts`, `scope-list-filtering.test.ts`, `tenancy-negative.test.ts`. Two of them write `scope_grant` with `principal_id` directly (`access-scope-model.test.ts:289,353`; `tenancy-negative.test.ts`), so they must change. I read "modules/access/** and its tests" as including those four files, but they are literally outside the glob. Confirm the reading.

### 5.3 `ADR-012` is `Proposed`, and it is not in the register

The only copy on this machine is `/home/luipt/gdrive/PEMO/Prompt/specs/ADR-012-user-groups-and-the-delegated-scope-tree.md` — the **first build's** spec area. It is **not** in `docs/adr/` at the pin, and `rewrite/adr/` is empty. Enumerated roots: the repo at the pin (all paths), `rewrite/` to depth 3, the whole `gdrive/PEMO` tree to depth 4, and `git log --all --diff-filter=A` for `docs/adr/*011*`/`*012*` — no ADR-012 has ever been added on any branch.

Its own header reads **`Status: Proposed — v1.1`** with **one open question remaining: group nesting**, and its *Target location* is `docs/adr/ADR-012-…md` — a destination it has not reached. `ADR-010` is also `Proposed`.

I am not treating this as a blocker on my own authority, because the PID states these decisions as settled and the Brain owns that call. But it should be explicit: **this migration implements a `Proposed` ADR that is not in the register, and the schema will outlive the ambiguity.** The group-nesting question in particular could add a parent column to `user_group` later; nothing in this proposal forecloses it.

## 6. Gaps — this list is complete

1. **Nothing built.** No migration file exists; `modules/access/` and the tests are untouched.
2. **§5.1 blocks done-when 4** and §5.2 blocks the test edits.
3. **The role identifier spelling and the backfill value are unruled** (§3).
4. **The differential-test approach is a proposal** (§4), and option (i) would not meet the PID's wording.
5. **Down-migration reversibility is not yet designed.** `0115.down.sql` must restore `principal_id` and the old constraint. That is only safe while every group is a group of one — the moment a group has two members, the down migration cannot reconstruct one `principal_id` per grant. Proposed: the down migration **refuses** if any group has more than one concurrent member, rather than silently picking one. Flagged now because it is a decision, not an implementation detail.
6. **`ADR-011` was not read.** It is referenced by `0114` and by ADR-012 D7 for the party shape, but this PID cites only ADR-010 and ADR-012. Named because I did not read it, not because I judged it irrelevant.
7. **The PID's own file was outside its declared write scope.** Rule 1 makes allocation the act of creating `pids/GEN-006.md`; the scope line omits `docs/governance/`. I created and committed it because allocation was explicitly instructed, and record the omission here rather than widening silently. GEN-003 v1.1 solved this by naming "this PID's own front-matter" in scope.

## 7. What the Brain is asked to rule

1. **§5.1** — widen scope to `database/seeds/40-access-staff-and-grants.sql`, or done-when 4 is unreachable.
2. **§5.2** — confirm the four `tests/integration/` files are "its tests".
3. **§5.3** — proceed against a `Proposed`, unregistered ADR-012, and does it get carried into `docs/adr/` (by this PID or another)?
4. **§3** — the role enum spelling, and `estate_staff` as the historical backfill claim.
5. **§4** — option (ii) for the differential test.
6. **Gap 5** — the down migration refusing on a multi-member group.

**HARD STOP.**
