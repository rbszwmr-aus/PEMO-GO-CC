# GEN-031 — W3 batch 3b Step 1: carry-in and assessment. No build. HARD STOP.

**Pin:** `6f87b264d9bb7cd070b40ece39dcfef20d8e7b78`, re-read from the remote — identical to HEAD, clean
worktree. **`GEN-031` allocated from the directory scan.**

**One correction up front, and it changes question 3:** `confer`, `revoke` **and** `provision` all
**already have routes** from W2. Only the membership commands are unreachable. So 3b's route work is
smaller than the box assumes — and one of it is a **breaking change to an operation that already
ships**.

---

## HALF A — `ADR-016` carried

`docs/adr/ADR-016-identity-boundary.md`, `Accepted` `v1.0`, with **Carried in by: `GEN-031`** added.
Nothing else in `docs/adr/` touched.

**Proven, not assumed:** `adrs-present` went **15 → 16 ADR** and stays green; moving the file out
turns it **red** on `ADR-016`, so the citation in this PID's own header is genuinely resolved by the
document rather than by a neighbour.

---

## 1. `registerPrincipal` — the shape, and a backfill that is a real decision

**Today:** `staff_principal(principal_id, organization_id, display_name, created_at)`. **No
`external_id`, and no seeded row carries anything usable as one** — the seed writes
`('stf_wfg_manager', 'org_wingfu_holdings', 'Chan Mei-ling 陳美玲')` and nothing more.

**Proposed shape:** add `external_id text`, with

```sql
UNIQUE (organization_id, external_id)
```

**Per organization, not global, and that is a decision worth stating.** One person may work for two
Organizations; under ADR-007 those are two separate worlds and two `staff_principal` rows. A global
unique would forbid that and would also leak the existence of a person across a tenancy boundary that
ADR-007 makes absolute.

### The backfill is the sharp part, and I want it ruled

Six seeded principals have **no external identity, because there is no external system** — they are
fixtures. Two honest options, and they differ in exactly the way this corpus cares about:

**(a) `NOT NULL`, backfilled to `seed:<principal_id>`.** Simple, keeps every read total, and the
`seed:` prefix is a *true statement about provenance* rather than a fabricated IdP subject. The
migration states it as a claim about the past, per ADR-010 D4. **Risk:** it is still an
`external_id` no authenticator will ever produce, sitting in a column whose meaning is *the person's
id in the external authenticator*.

**(b) Nullable, with a `source`-style discriminator and a biconditional** — the `resident.party` /
`audit_event` shape: absence is *required* exactly where there is no external identity. Honest
absence, no fiction, and it is the pattern A1 already forced on the audit spine. **Cost:** a second
column and a constraint for six fixture rows.

**I lean (b)** on the corpus's own precedent — *a fiction is worse than a null because a null is
legible* — but (a) is defensible and cheaper, and this is a schema decision on the identity table.
**Ruling sought.**

**Where the act lives:** `modules/access/src/repository/principal-commands.ts`, beside grant and
membership commands. **No credential column, ever** — D3 — and that belongs in the migration's
comment and the table comment, not only in the ADR.

## 2. The atomic bootstrap — it composes, with one thing to watch

**Confirmed:** all four writes (`staff_principal`, `user_group`, `scope_grant`,
`group_membership`) are in **`access`**, so `idempotentAuditedWrite` covers them in one transaction on
one connection, with `source='provisioning'` and null authority as the biconditional requires. The
derived key stays the `organizationId`.

**The once-only predicate still holds, and its ordering matters more now.** *Zero grants ever* reads
`scope_grant` joined through `user_group`. The act now creates the group **and** the principal before
conferring, so the predicate must be evaluated **before any of those writes**, not merely before the
grant insert — otherwise a second attempt would leave an orphan group and principal behind before
refusing. **That is a real sequencing constraint** and I would write it as: lock the organization,
evaluate the predicate, then create.

**And `committed` interacts with it correctly:** a refusal rolls the whole transaction back, so a
refused second bootstrap leaves no principal, no group, nothing. That property is already proven for
the grant-only version and extends unchanged.

## 3. The routes — and the correction

**Current state, measured:**

| operation | route today |
|---|---|
| `conferGrant` | ✔ `POST /grants` |
| `revokeGrant` | ✔ `POST /grants/{grantId}/revoke` |
| `provisionOrganization` | ✔ `POST /organizations/{organizationId}/provision` |
| `addMembership` | ✘ **module-only** |
| `removeMembership` | ✘ **module-only** |
| `registerPrincipal` | ✘ does not exist |

*(My first enumeration of this missed three routes: the character class in my grep excluded uppercase,
so `:grantId` and `:organizationId` truncated the match. Re-run widened; the table above is the widened
result. `[anchor-the-discriminator]`, third time — it is worth the owed check.)*

**So 3b's route work is three new routes and one changed contract:**

| route | stance (ADR-015 D1) | reason vocabulary (ADR-014) |
|---|---|---|
| `POST /principals` — `registerPrincipal` | **`client-key`** | **none** — recording an identity is not a change of authority; D4 makes the requirement the act's own, and this act has nothing to explain |
| `POST /groups/{groupId}/members` — `addMembership` | **`client-key`** | **required**: `new_appointment`, `role_change`, `cover_absence`, `contractor_engagement` — the same set as `conferGrant`, because it is the same event seen from the other side |
| `POST /memberships/{membershipId}/remove` | **`client-key`** | **required**: `staff_departed`, `role_change`, `cover_ended`, `added_in_error` |
| `POST /organizations/{id}/provision` — **changed** | `derived-key` (unchanged) | unchanged |

**`role_change` is shared across four operations now** and still means the same thing on each, which
is the registry rule holding rather than being stretched. `added_in_error` mirrors
`granted_in_error` for the same reason it earned its place there.

### The breaking change, named

`ProvisionRequest` currently requires `groupId` — *"an EXISTING group in this organization"*. Under D4
the act **creates** the group, so `groupId` goes and `externalId` / `displayName` / a group name
arrive. **Required fields change on an operation that already ships.**

By ADR-008's table a **new required field is minor**; *removing* one is not listed. **No client calls
this operation** (`management-web` does not), so nothing breaks in practice. **I am not deciding the
bump** — I read the table, it does not name this case, and inventing a rule for the contract's own
versioning is not mine to do. **Ruling sought: minor, or does removing a required field want its own
row in ADR-008's table?**

## 4. The split — I propose three, and it differs from your prior

Your prior: bootstrap + `registerPrincipal` together, routes separate.

**I agree on the pairing and want to split the routes differently**, because they are not one kind of
thing:

| | batch | contents | why |
|---|---|---|---|
| **3b-i** | **the schema + `registerPrincipal`** | the migration (`external_id` + uniqueness + backfill), the command, its route | Schema and identity. **Isolated because the backfill is a decision** (§1) and a migration that reds should not be tangled with a surface. It ships a usable act on its own. |
| **3b-ii** | **the atomic bootstrap** | the extended provisioning act + the changed contract | Depends on 3b-i's column existing. Carries the **breaking contract change**, which deserves to be visible in its own diff rather than buried among new routes. |
| **3b-iii** | **the membership routes** | `addMembership` + `removeMembership` routes and contracts | 3a's commands are already built, proven and guarded. This is surface only — no new decision — and it is **the diff that actually removes the DBA**, so it should not be gated behind the identity backfill ruling. |

**If you want fewer:** merge 3b-ii and 3b-iii — both are surface work over landed commands. **Do not
merge 3b-i into either**: the backfill decision and a contract break in one diff would make a red
ambiguous.

**Sequence: i → ii → iii**, and iii could run in parallel with ii if you prefer, since it touches no
shared file.

## Rulings sought

1. **§1 — the backfill**: `seed:<id>` under `NOT NULL`, or nullable with honest absence (my lean).
2. **§1 — uniqueness per organization**, confirmed.
3. **§2 — the predicate before any write**, confirmed as the sequencing rule.
4. **§3 — the version bump** for a removed required field, and the reason vocabularies.
5. **§4 — the three-way split**, or a merge of ii and iii.

**HARD STOP. No build.**
