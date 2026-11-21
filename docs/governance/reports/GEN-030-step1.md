# GEN-030 — W3 batch 3 Step 1: proposals. No build. HARD STOP.

**Pin:** `797167d3ba600525356927a2c04ce19a4716ae0a`, re-read from the remote — identical to HEAD,
clean worktree. **`GEN-030` allocated from the directory scan.**

**Headline: the bootstrap is still not self-contained, and it is not the group this time.** The first
member must be an existing `staff_principal`, and **nothing in the system creates one.** That is a
stop-and-ask, and it changes the split you proposed.

---

## 1. THE BOOTSTRAP — expressible as one act, but it does not reach the ground

**What IS confirmed.** Group, grant and membership all live in **`access`**, so one transaction on
one connection covers them with no boundary question; `idempotentAuditedWrite` already provides that
transaction; the zero-grants-**ever** predicate and its per-organization advisory lock are built and
proven; `source='provisioning'` with null authority is exactly what W1b's biconditional requires and
`GEN-027` already writes. **Adding two INSERTs to the existing act is small.**

**What is NOT.** `group_membership.principal_id` carries a hard foreign key:

```
group_membership_principal_id_fkey :: FOREIGN KEY (principal_id) REFERENCES access.staff_principal(principal_id)
```

and I searched for a writer:

```
INSERT INTO staff_principal  →  database/seeds/40-access-staff-and-grants.sql   (the seed, and only the seed)
```

**No surface creates a `staff_principal`.** `access-repository.ts` only reads one. So a genuinely
empty organization has no person to seat in the group it just created, and the bootstrap stops one
step short — **the same shape as `GEN-027`'s group gap, one level down.**

**Consequence, stated plainly: W3 as scoped does not remove the DBA either.** Somebody must still
create the principal outside the system.

**Three shapes, and I will not choose one:**

1. **The bootstrap creates the `staff_principal` too.** Self-contained at last. But a principal is
   PEMO's record of a *person an identity provider knows*, and minting one from a request body is an
   identity decision, not an access-control one.
2. **The bootstrap takes an existing `principalId`;** principal provisioning is its own surface (a
   W4). Smallest, honest, and the archive note has to say the DBA remains for a third time.
3. **The bootstrap records a principal for an externally-authenticated identity** — the identity
   exists in the IdP, PEMO records that it exists. My instinct is that this is right long-term, and
   it is still a decision about where identity comes from.

**Ruling needed before any bootstrap build.**

## 2. `addMembership` — the concrete query

Refusal on **any** unreachable grant, never a subset. Evaluated inside the act's transaction, as an
in-query filter, exactly as `confer` and `revoke` are:

```sql
WITH current_grant AS (
  SELECT DISTINCT ON (grant_id) grant_id, group_id, role, node_kind, node_id,
         effective_from, effective_to, version
    FROM scope_grant WHERE group_id = $1 ORDER BY grant_id, version DESC
), live AS (
  SELECT * FROM current_grant
   WHERE effective_from <= now() AND (effective_to IS NULL OR effective_to > now())
)
SELECT count(*) FILTER (WHERE (node_kind || ':' || node_id) <> ALL($2::text[])) AS unreachable,
       count(*)                                                                 AS live_grants
  FROM live
```

`unreachable > 0` → refuse. **Counting rather than existence-testing is deliberate**: the same query
returns `live_grants`, which is what §6's member/grant disclosure needs and what tells an empty group
from a fully-reachable one.

**The floor (ruled at `GEN-028`):** `$2` is the actor's expanded `grant_administrator` set, so
`live_grants = 0 AND $2 = '{}'` is the pre-positioning case — the actor holds no administrator grant
anywhere and the group confers nothing yet. Refused by requiring `$2` to be non-empty **and** the
group's `organization_id` to equal the actor's, so cross-organization is unrepresentable rather than
merely unreachable.

**Residual, named not guarded (owed):** an actor who *is* an administrator somewhere may still add
someone to an empty group in their organization that is granted something later. The confer is gated,
so authority never appears ungated — but the pre-positioning is real. Same reachability family as
subtree administrability.

## 3. THE UNIFIED GUARD — one predicate, both routes

**Replaces `liveAdministrators`, does not extend it.** `GEN-028` measured the shipped one reporting
**1** administrator for an organization where **0** people can administer anything — the grant was
held by an empty group. It over-protects and under-protects from the same defect.

```sql
WITH current_grant AS (
  SELECT DISTINCT ON (g.grant_id) g.*, ug.organization_id
    FROM scope_grant g JOIN user_group ug ON ug.group_id = g.group_id
   WHERE ug.organization_id = $1 ORDER BY g.grant_id, g.version DESC
), live_admin_grant AS (
  SELECT * FROM current_grant
   WHERE role = 'grant_administrator'
     AND effective_from <= now() AND (effective_to IS NULL OR effective_to > now())
), current_membership AS (
  SELECT DISTINCT ON (membership_id) *
    FROM group_membership
   WHERE group_id IN (SELECT group_id FROM live_admin_grant)
   ORDER BY membership_id, version DESC
), live_membership AS (
  SELECT * FROM current_membership
   WHERE effective_from <= now() AND (effective_to IS NULL OR effective_to > now())
)
SELECT m.principal_id, g.grant_id, m.membership_id
  FROM live_admin_grant g JOIN live_membership m ON m.group_id = g.group_id
```

**It returns the WITNESS, not a count** — the principal, and the grant *and* membership that make them
effective. That is what lets both routes ask one question:

- `revokeGrant`: refuse if every row's `grant_id` is the one being revoked;
- `removeMembership`: refuse if every row's `membership_id` is the one being removed.

**Nothing to keep in step**, because there is one query and one meaning. Latest-then-evaluate on
**both** sides — filtering on `effective_to` before resolving would count a revoked grant or a removed
member as live, and this query decides whether a removal is allowed, so that error would permit the
lockout it exists to prevent.

**Scope, confirmed and stated:** the unrecoverable state is **no live effective administrator anywhere
in the organization** — not "at the organization node". An administrator granted at an estate is still
an administrator, and refusing on node would over-reach. **Subtree lockout stays out of scope and
named.**

**The lock.** The predicate spans grants *and* memberships, so the natural key is the **organization**,
which provisioning already uses. Every administrator-affecting act then contends on one lock per
organization. `GEN-028` flagged this; **I would like it ruled rather than chosen quietly**, because it
is a serialisation point.

## 4. `removeMembership` never ships before the guard — confirmed

Not negotiable and not a preference: shipping the second route into the lockout before the guard that
spans both would open a door and close it in a later PID. **Any split runs around that pairing, never
across it.**

## 5. THE SPLIT — I propose the INVERSE of yours, and the reason is §1

You proposed: bootstrap first (self-contained, unblocks `confer`), then membership + guard.

**Bootstrap is NOT self-contained** — §1 — and is **blocked on a ruling** about where a
`staff_principal` comes from. Membership and the guard are blocked on nothing.

**Proposed:**

| | batch | contents | why |
|---|---|---|---|
| **3a** | **membership + the unified guard** | `addMembership`, `removeMembership`, the guard replacing `liveAdministrators`, both routes converted | Unblocked. Keeps `removeMembership` and the guard in one diff, as §4 requires. Also **retires a live defect**: the shipped guard is wrong today, and it stays wrong for as long as this waits. |
| **3b** | **the bootstrap** | group + principal(?) + grant + membership as one act | **Gated on the §1 ruling.** Its value is completing the bootstrap; completing it halfway buys nothing that is not already true. |

**If you prefer one diff, 3a is the half I would not defer** — the guard is the thing standing between
an organization and an unrecoverable state, and it is currently measuring the wrong quantity.

## 6. Member count in the response — it fits, and I recommend it

§2's query already returns `live_grants`; a sibling count over live memberships is one more scalar in
the same transaction. `confer` would state **how many people the grant just empowered**, and
`addMembership` **what the person just acquired**. Cheap, and it closes the gap between "I granted a
group" and "I know who that is".

## The principles pass — and the corpus already answers this one

**Neither named candidate owns it.** `[all-preconditions-before-mutation]` is about a *mutating
operation* half-applying — its subject is the mutation's own integrity, not the ability to undo it.
`[diff-against-clean-baseline]` is about detecting drift after the fact.

**But a third principle does, and it says NOT to add another.** `[principle-is-not-a-control]` records:

> *Evidence: a recorded restore-to-HEAD failure was repeated by its own recorder within the hour, and
> the **battery** caught it while the principle did not.*

**So the restore-to-HEAD class is already in the corpus — as that principle's own evidence — and its
rule is: when a class recurs after being written down, build the CHECK, do not write it down more
emphatically.** My `GEN-029` near-miss is that recurrence, a third time.

**So I propose a control, not an entry:** a small `docs/governance/bin/with-mutation.sh` that takes a
file and a command, writes a snapshot **and verifies it exists before touching anything**, runs the
command, restores, and asserts `cmp` byte-identity — refusing to start if the snapshot cannot be
written. That is the failure I hit (the scratchpad was wiped at a day boundary, so the backup silently
never wrote) turned into something that fires.

**I have not built it** — it is tooling, not this batch's subject, and I would rather it be ruled in
than smuggled. **Ruling: control instead of principle, and which batch it rides — or neither.**

## Rulings sought

1. **§1 — the blocker.** Where does a `staff_principal` come from? Bootstrap mints it, a separate
   surface owns it, or it records an externally-authenticated identity.
2. **§3 — the organization-scoped lock**, confirmed or reconsidered.
3. **§5 — the inverted split** (3a membership+guard first, 3b bootstrap when ruled), or one diff.
4. **§6 — the member/grant counts** in the response.
5. **The principles pass** — a control rather than a 61st entry, and where it lands.

**HARD STOP. No build.**
