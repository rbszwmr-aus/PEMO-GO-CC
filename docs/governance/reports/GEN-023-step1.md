# GEN-023 — WEB-15 / grant administration. Step 1: carry-in + inventory

**Status:** Half A carried, Half B inventoried, **no build. HARD STOP.**
**Pin:** `bc0d924e2f1fd3529e1a0d20734dc4101fa7d843`, re-read from the remote at Step 1 — identical to
our HEAD. **Allocated `GEN-023` from the directory** (`pid-index.mjs --next` → `023`), not from prose.

**Headline:** the assertion-shape question (3) is not close. **`access.scope_grant` cannot express
the end of a grant at all today** — `pemo_app` has no `UPDATE`, and the append route is blocked by
the exclusion constraint. I proved the second half by firing it. And the provisioning act (5) is
worse than "undesigned": `audit_event` makes honest absence **structurally unrepresentable**.

---

## HALF A — carried

| file | status line now |
|---|---|
| `docs/adr/ADR-014-audit-act-reason.md` | `Accepted` — `v1.0`, accepted as written 2026-08-31 |
| `docs/adr/ADR-015-idempotency-request-token.md` | `Accepted` — `v1.1`, `D1` **amended**, `D2`–`D6` as proposed |
| `docs/adr/ADR-014-015-ACCEPTANCE-and-amendment.md` | the acceptance/amendment record |

**ADR-015's body carries D1 in its amended form**, not the superseded wording: the three stances
(`client-key` / `derived-key` / `exempt` with a stated reason), and *an operation that declares
nothing is refused by a check*. An amendment banner names what was replaced, and the **Decision
record keeps the superseded line bracketed and dated** rather than deleting it — a v1.1 whose v1.0
is unreadable is the thing the corpus keeps catching.

**Proved the carry-in, rather than assuming it.** `adrs-present` went 13 → **15 ADR / 6 amendment /
60 principle**, all resolving. Then I moved `ADR-014-audit-act-reason.md` out and re-ran: it went
**red** — so the acceptance record does **not** answer for the ADR proper, and `GEN-017`'s
filename-glob hole stays closed under files that are new since. Restored, green again.

**Write scope held**: `docs/adr/` and the allocation. Nothing else touched. Battery **23/23**.

---

## HALF B — inventory

### 1. What exists

**`access.scope_grant`** — `grant_id` PK · `group_id` NOT NULL → `user_group` · `role` NOT NULL ·
`node_kind` NOT NULL · `node_id` NOT NULL (no FK, by rule) · `effective_from` NOT NULL ·
`effective_to` NULL · `created_at`. Constraints: `role` CHECK over the five values, `node_kind`
CHECK over the eight, `period_ordered`, and the gist **`EXCLUDE (group_id, role, node_kind, node_id,
tstzrange(effective_from, effective_to) WITH &&)`**.

**`access.user_group`** — `group_id` PK, `organization_id`, `display_name`, `created_at`. **No
parent column** (verified against the live schema, not the migration text).

**`access.group_membership`** — `membership_id` PK, `group_id` FK, `principal_id` FK,
effective-dated, with its own overlap exclusion.

**Every read surface is one query.** `modules/access/src/repository/access-repository.ts`
`findGrantsAsAt` — the only SQL over `scope_grant` in the codebase — joins `group_membership` and
evaluates **both** as-at the same instant (ADR-012 D6). It reaches the API through
`createScopeQueries` → `staff-context` → six management routes (`/scope`, `/properties/tree`, and
the four writes). `apps/api/src/management/authorizing-grant.ts` consumes the result and is the only
place `role` decides anything: `grant.role === 'estate_staff'`.

**Finding — a stale banner.** `modules/access/src/index.ts` still reads *"Nothing imports this
package yet."* Five modules import it. It is the recurring shape (an artifact stale relative to
code it does not name); **read-only PID, so I report it and have not touched it.**

### 2. ADR-010 D4 — `role` in the exclusion key: **DONE**

Delivered by `0115_access_group_and_role_key.up.sql`, which did D4 and ADR-012 D4's
group-for-principal substitution in one migration because the second re-keys the constraint the
first modifies. Verified **from the live schema**, not the migration source:

```
scope_grant_no_overlapping_periods :: EXCLUDE USING gist
  (group_id WITH =, role WITH =, node_kind WITH =, node_id WITH =, tstzrange(...) WITH &&)
```

`principal_id` is gone — dropped, not deprecated. The owed item's condition was *"before the first
production deployment"*: **the repository defines it and the dev database has it. I have not looked
at any production or staging database and cannot say what one runs.**

### 3. IS `scope_grant` ASSERTION-SHAPED? **No — and it is worse off than occupancy was**

**It cannot express an end at all.** Two routes, both closed:

- **Shorten `effective_to`** — an `UPDATE`. `has_table_privilege('pemo_app', …, 'UPDATE')` is
  **false** (INSERT true, DELETE false). This is the `GEN-013` wall exactly.
- **Append a superseding row** — I tried it against a real seeded grant inside a rolled-back
  transaction:

```
ERROR:  conflicting key value violates exclusion constraint "scope_grant_no_overlapping_periods"
DETAIL: Key (grp_wfg_block_a_approvers, approver, building, blk_wfg_a,
        ["2023-12-31 16:00+00","2026-08-31 03:33+00")) conflicts with existing key
        (…, ["2023-12-31 16:00+00",))
```

**So the `tstzrange` does not express supersession. It expresses a period, and closing a period is
an `UPDATE`.** Of 8 seeded grants, exactly 1 has `effective_to` set — and it was *born* closed;
nothing has ever ended one.

**The extra difficulty occupancy did not have.** `0022` gave occupancy only `period_ordered`, so
`0117` could add `version` + `UNIQUE(occupancy_id, version)` without fighting anything.
`scope_grant` carries a **gist exclusion over all rows**, and under an assertion model version 1
(open) and version 2 (closed) of the *same* grant are two rows with the same
`(group, role, node)` and overlapping ranges — **the constraint fires against the instance's own
history.** It cannot survive naively.

**And it is the constraint that carries the guarantee.** `0112` chose it declaratively on the record
that *"a trigger is bypassable by a bulk load, which is exactly how bad history arrives."* Its job —
*"what was in force then has one answer"* — is precisely what an authority table must not lose.

**Three shapes, none of which I am taking:**
- **(a) Drop the exclusion; guard cardinality in the write path** with `GEN-016`'s advisory-lock
  mechanism (ADR-013 C3). This is the precedent — occupancy's D5 invariant went this way for exactly
  this reason. **Cost: the declarative guarantee `0112` picked it for is gone**, and a bulk load
  bypasses the guard.
- **(b) Keep an exclusion scoped to current assertions.** `EXCLUDE` accepts a `WHERE`, but
  "is the latest version" is not a stored predicate — making it one needs a flag that something must
  flip, which is an `UPDATE` and is exactly what ADR-013 D2 abolished.
- **(c) Something narrower I have not found.** I record the possibility rather than close it.

**This is the ruling I most need**, and (a) versus (b) is a real trade: the authority table is the
one place "a bulk load wrote bad history" is least tolerable.

### 4. G-2 enforcement (ADR-010 D3)

*A principal may create a grant only within a node they already hold.*

**The machinery already exists and needs no new mechanism.** `findAuthorizingGrant(scopeExpansion,
organizationId, grants, target)` answers "does this principal hold a grant covering this node?",
expanding each grant through the hierarchy and returning the narrowest. G-2 is that call with two
substitutions: the target is **the node the new grant names** (not the act's own node), and the
role filter is `grant_administrator` rather than `estate_staff`.

**What it must read:** the actor's grants as-at now (`findGrantsAsAt`, through membership), and
`property`'s scope expansion to decide containment. Both are existing reads.

**Its subject is the authority system itself**, and that changes two things:
- **The gate reads the table the act writes.** Occupancy's checks read `resident` and wrote
  `resident`, but nothing there could *widen the reader's own authority*. Here a grant created
  inside a held node can grant `grant_administrator` at that node — **authority is delegable
  downward by design** (D3 is explicit), so this is the decision working, not a leak. It should be
  named in the contract rather than discovered later.
- **The check must be inside the act's transaction**, on the same `tx`, or a concurrent revocation
  of the actor's own grant races it. `auditedWrite` already gives that shape; `GEN-016` proved the
  relocation-into-the-act pattern.

### 5. The provisioning act (ADR-010 A1) — **structurally unrepresentable today**

A1 requires `GEN-029-ST`'s shape: **honest absence with the source recorded, never a fabricated
principal id, never `'system'`.** The template is `resident.party`:

```sql
source      text NOT NULL CHECK (source IN ('human_entry','bulk_import','external_reconciliation')),
recorded_by text NULL,
CONSTRAINT party_actor_only_when_human
  CHECK ((source = 'human_entry') = (recorded_by IS NOT NULL))
```

Source NOT NULL, actor nullable, and a **biconditional** binding them — absence is not merely
allowed, it is *required* exactly when there is no actor.

**`access.audit_event` cannot express it.** `principal_id` is `NOT NULL REFERENCES
staff_principal`; `group_id` is `NOT NULL REFERENCES user_group`; `role` is `NOT NULL`. A
provisioning act has **none of the three** — no principal, no group, and no grant, because the grant
is what it is creating. So the first grant at Organization creation **cannot be audited at all**
without a migration, and every shortcut around that is a fabricated principal, which A1 forbids by
name.

**Shape I would propose (not taking it):** `audit_event` gains `source` NOT NULL with a small
vocabulary (`principal_act` | `provisioning`), the three authority columns become nullable, and one
biconditional CHECK ties them all-or-nothing to `source` — `party`'s shape, applied to the spine.
**One representation, not two**, as A1 requires. It touches the audit spine every write already
uses, so it wants a ruling before a build.

### 6. `grant_administrator` — **a named value that authorizes nothing**

It exists in exactly four places: `scope_grant`'s `role` CHECK, `audit_event`'s `role` CHECK, the
`ScopeRole` TS union, and `SCOPE_ROLES`. **No code reads it** — the only role comparison in the
codebase is `grant.role === 'estate_staff'`. **No row holds it**: the 8 seeded grants use
`approver` and `estate_staff` only. It was named at `GEN-006` on the Product Owner's spelling
ruling, deliberately ahead of use, so that granting one later needs a row and not a migration. **It
is ready to mean something and currently means nothing** — this PID is what would give it force.

### 7. ADR-012 group nesting stays open — **confirmed, nothing forecloses it**

`user_group` has **no parent column** (checked against the live catalog: 0 columns matching
`%parent%`). A future nullable self-reference is additive and touches nothing else, because **the
grant key names `group_id` and says nothing about how groups relate** — `0115` recorded that
intention and the schema keeps it true. Nothing in the operation set below reads or writes group
structure, so nothing here forecloses it either. The one thing that *would*: any resolver that
flattened membership into a stored closure. There is none, and `findGrantsAsAt` joins membership
directly.

### 8. Proposed operation set

Ruling sought on all of it. `create` and `end` are the minimum that retires the DBA; `delegate` I
argue **against** as a separate operation.

| operation | act | ADR-015 D1 stance | ADR-014 reason_code |
|---|---|---|---|
| **`createGrant`** | INSERT a grant at a node the actor holds | **`client-key`** — user-facing, retry-prone, and a double-submit creating two grants is the failure this exists to stop | **required** — why authority was conferred is the first question an incident review asks |
| **`endGrant`** | end a grant (mechanism blocked on §3) | **`client-key`** | **required** — revocation without a recorded reason is the audit gap ADR-014 was written for |
| **`provisionFirstGrant`** | the Organization-creation act (A1) | **`derived-key`** — derived from the Organization-creation event; ADR-015 D1 names this case | **required**, a fixed code — its `source` already says it is provisioning |
| **`createGroup` / `addMembership`** | (probably needed; §below) | `client-key` | ruling |
| ~~`delegate`~~ | — | — | — |

**Why no `delegate`.** Delegation is not a distinct act: G-2 *is* the rule that a `createGrant`
inside a held node may confer `grant_administrator`. A separate operation would be a second path to
the same write with its own gate to keep in step — and two gates over one authority table is how
they drift. **One write, one gate.**

**The set may be incomplete, and I would rather say so than round it off.** A grant is held by a
*group* (ADR-012 D2), so granting a new person anything requires a group and a membership — the
`group of one` is ADR-012's own idiom for a single person. If `createGroup` and `addMembership` are
out of scope, **WEB-15 can re-scope existing groups but cannot onboard a new staff member**, and the
DBA is still needed. Both tables allow `pemo_app` INSERT, so nothing blocks them. **I have not
assumed either into the set.**

---

## Two findings outside the eight, disclosed rather than folded in

**1. ADR-015 D3/D4 conflict with a built, wired mechanism.** `platform.idempotency_record` has
existed since **migration `0004`**: keyed `(scope, idempotency_key)` and storing `outcome jsonb` —
**a response blob**. ADR-015 D3 keys on `(principal, operation, key)` and **D4 states no response
blob is stored, the response is re-derived by reading the act.** The ADR names neither `0004` nor
the table. `createIdempotencyStore` is constructed in `wiring.ts` and **called by no route** — I
checked `server.ts` and found zero uses. So it is unused, but it is present, migrated and exported,
and ADR-015 cannot be built without deciding its fate. **Not folded in; reported.**

**2. `reason_code` does not exist yet.** `audit_event` has no such column, so ADR-014 needs a
migration before any operation here can carry a reason. It composes with §5's migration — both alter
the same table, and doing them as one avoids two migrations fighting over one spine — but that is a
build decision and I am not taking it.

## What I did NOT do

No build, no schema, no code. No production or staging database was contacted — every live check ran
against the local dev database, which I rebuilt at `GEN-022`. Nothing in the 27-write path, the owed
guards, or UI was touched.

## Rulings sought

1. **§3 — the assertion-shape question**, and (a) vs (b) vs (c) for the exclusion constraint. The
   load-bearing one.
2. **§4 — G-2 placement**, and whether downward delegation of `grant_administrator` should be
   contract-named as intended behaviour.
3. **§5 — provisioning attribution**: is the `source` + nullable-authority + biconditional shape on
   `audit_event` the right carry of `GEN-029-ST`?
4. **§8 — the operation set**, and specifically whether `createGroup` / `addMembership` are in scope.
   Without them WEB-15 does not retire the DBA.
5. **The ADR-015 / `0004` conflict** — supersede, reconcile, or a separate PID.

**HARD STOP.**
