# GEN-027 — W2 Step 1: the grant write surface. Proposal only, no build.

**Status:** read-only. **HARD STOP.** Two findings block parts of the dispatch as written, and I have
not proceeded on an assumption about either.

---

## 0. FIRST — the pin you named does not exist yet

**`origin/main` is `0310b97861418d8c9c3c37e80d82716be3ed8217`, which is `GEN-025`. W1d has not
merged.** `GEN-026` was built, proven and reported, and it **hard-stopped before commit** awaiting a
close ruling that has not come. Its eleven files are still uncommitted in this worktree.

I have designed against the **worktree** state, which includes W1d, because W2 depends on it. But the
`principal` rename is not on `main`, and **`GEN-026` needs its close before W2 Step 2 begins** — or
Step 2 would build on an unmerged base, which is the condition the two-commit split at `GEN-023`
existed to avoid.

`GEN-027` is allocated (`--next` → `027`). The register now holds two open PIDs pending close.

---

## (a) `act_id` stability — your expectation holds, and it needs one schema addition

**Confirmed: the two halves cannot both rest on `act_id`.** `replayOrConflict` currently compares
`act_kind`/`act_id`. Derive the id from `(operation, key)` and a retry produces the same id — which is
the point — but then **two genuinely different requests sharing a key also produce the same id, and
D5's detection goes silent.** Both cannot rest on the same field.

### Proposed, and it is stronger than a derivation alone

**1. The act's own primary key IS the derived id.** Not "the primitive derives an id and stores it
alongside" — the grant's `grant_id` *is* `gr_` + a stable digest of `(operation, idempotency_key)`.

That buys a second line of defence for free: **even if the idempotency record were missing entirely,
a retry would collide on the act's own primary key.** The mechanism and the act agree by
construction rather than by bookkeeping. Structural, as you asked, not conventional.

For `revoke` the act is an appended assertion, so the derived id is the `assertion_id`; the instance
(`grant_id`) is supplied by the caller and is not derived.

**2. D5 moves to a request fingerprint.** A new nullable-free column
`request_fingerprint text NOT NULL` on `platform.idempotency_record`, holding a digest of the
**semantically significant** request fields — for `confer`: `(groupId, role, nodeKind, nodeId,
effectiveFrom, reasonCode)`. On a hit, compare fingerprints:

| case | key | derived act id | fingerprint | outcome |
|---|---|---|---|---|
| honest retry | same | same | same | **REPLAYED** |
| same key, different request | same | same | **differs** | **REFUSED** (D5) |
| different key | differs | differs | — | performed |

**Both hold together, and the middle row is the one that was unreachable before.**

### The trade, stated

- **A migration for a table `GEN-025` just created.** `0122` adds one column. Cheap now — the table
  holds no rows outside tests — and the same "cheapest moment" argument as W1d.
- **Ids stop being opaque.** `grant_id` becomes a function of a client-supplied key. The client
  already knows its own key, so it learns nothing new; a *different* client would need the key to
  compute the id. I judge this acceptable and name it rather than leave it implicit.
- **The digest must be pure** — no clock, no randomness, no process state — or "stable across
  retries" fails exactly when a retry crosses a restart. I would assert that in a test, not a comment.
- **`request_fingerprint` must be `NOT NULL`**, so an operation cannot opt out by omission — the same
  reason `source` is required.

**Alternative I considered and rejected:** require callers to pass a derived id. That is conventional,
not structural — the thirteenth caller passes a random one and nothing notices.

---

## (b) THE PROVISIONING ACT — your predicate is right in shape and **wrong in tense**, and it has no host

### Finding 1 — "zero grants" must mean EVER, not LIVE. Measured, not reasoned.

The two candidates already disagree on the shipped seed:

```
org org_wingfu_holdings | grants EVER: 7 | LIVE now: 6
```

**Under "zero LIVE grants", an organization that revokes its last grant becomes provisionable again —
by anyone**, because the provisioning act has no prior principal to check. That is the standing
break-glass A1 forbids, reachable through an ordinary revocation rather than a back door anyone
would notice. **The predicate must be "no grant assertion has ever existed for any group in this
organization".**

**It is expressible inside `access` alone**, which matters for the module boundary:
`user_group.organization_id` exists (`0115`), `scope_grant` joins to it by `group_id`, and no
cross-schema reach is needed. Roughly:

```sql
NOT EXISTS (SELECT 1 FROM scope_grant g JOIN user_group ug ON ug.group_id = g.group_id
             WHERE ug.organization_id = $1)
```

Concurrency: two simultaneous provisioning acts must not both pass. Same shape as `GEN-024` — a
per-organization advisory transaction lock with the check inside the act. **And the derived
idempotency key gives a second, structural guard** (see below), so this one is belt-and-braces rather
than sole.

### Finding 2 — THE BLOCKER. There is no Organization-creation act to be part of.

ADR-010 A1 says the first grant "is created **as part of that act**", and ADR-015 D1 names the
`derived-key` source as "the Organization-creation provisioning event".

**Neither exists.** Organizations arrive only through `database/seeds/00-organizations.sql`, run as
the owner role. There is no operation, no event, and therefore nothing to derive a key from. **I will
not invent one on an assumption.**

**What I propose instead, for your ruling:** the provisioning grant is a **standalone operation**
whose derived key **is the `organizationId` itself**. The organization's existence is the originating
fact; the key is stable, unique per organization, and needs no event to carry it. Combined with the
zero-ever predicate the operation is doubly once-only: the predicate refuses a second attempt, and
the idempotency key *replays* rather than performs it.

**Three options, and I recommend the first:**
1. **Derived key = `organizationId`.** No new surface, honest about where the fact comes from.
2. Build an Organization-creation operation in W2. Real scope growth, and a platform concern rather
   than an access one.
3. Defer provisioning to W2b, ship `confer`/`revoke` first — **but see below: that leaves both
   unreachable.**

### Finding 3 — the sequencing consequence, and a lockout

**`grant_administrator` grants in the database: 0.** No one can confer anything today, so **`confer`
is unreachable until a provisioning act runs.** Provisioning is not an optional extra in W2; it is
what makes the rest reachable.

And because the seeded organizations already hold grants, **they can never be provisioned** under the
zero-ever predicate. A test must create a *fresh* organization to exercise it. That is workable and I
would rather do it than weaken the predicate — **but it means the seeded world has no grant
administrator, so `confer` cannot be exercised end-to-end there either.** Options: seed a
`grant_administrator` grant (a claim about the seeded world, and a seed change), or have the
integration test provision a fresh organization and work inside it. **I lean to the second** — it
exercises the real path instead of asserting around it — and it is a ruling, not my call.

**The lockout, stated because it is permanent:** an organization that revokes its last
`grant_administrator` grant becomes unadministrable **forever** — the zero-ever predicate will not
let provisioning back in. That is the correct trade against a break-glass, but it is a sharp edge and
the contract should say so. A "cannot revoke the last `grant_administrator` in an organization" guard
is the obvious mitigation; **I have not proposed it as in-scope** because it needs its own ruling.

---

## (c) The three contracts

`POST /grants` · `POST /grants/{grantId}/revoke` · `POST /organizations/{organizationId}/provision`

| | request | ADR-015 D1 stance | ADR-014 reason |
|---|---|---|---|
| **`conferGrant`** | `groupId`, `role`, `nodeKind`, `nodeId`, `effectiveFrom`, `reasonCode`, header key | **`client-key`** | **required** |
| **`revokeGrant`** | `effectiveTo`, `reasonCode`, header key | **`client-key`** | **required** |
| **`provisionOrganization`** | `groupId`, `displayName`?, `reasonCode` | **`derived-key`** (= `organizationId`, per (b)) | **required**, one fixed code |

Confirming your ruling: **both require a reason** — these change who holds authority, which is the
first question an incident review asks.

**Proposed vocabularies, deliberately small** (a forced `other` is the noise D4 warns about):

- `conferGrant`: `new_appointment`, `role_change`, `cover_absence`, `contractor_engagement`
- `revokeGrant`: `staff_departed`, `role_change`, `cover_ended`, `granted_in_error`
- `provisionOrganization`: `organization_provisioned`

`role_change` appears in both **and means the same thing on both** — which is exactly the registry
rule's *shared iff identical semantics*. `granted_in_error` earns its place: revoking a mistake is
not the same act as revoking a departure, and an audit that cannot tell them apart cannot answer why.

**Responses:** `201` with the grant instance for confer; `200` with the appended assertion's version
for revoke; `409` for the cardinality conflict and for a non-live revoke; `404` for out-of-scope, per
the established convention. A **replay returns the original response, re-derived by reading the act**
— so `confer` on a repeat answers `200`, not `201`, and that difference is contractual.

---

## (d) Where G-2 lives — confirmed, no new mechanism

`findAuthorizingGrant(scopeExpansion, organizationId, grants, target)` needs **two substitutions**,
exactly as `GEN-023` found:

- **the target is the node the NEW grant names**, not the act's own node;
- **the role filter is `grant_administrator`**, not `estate_staff`.

The only code addition is a sibling to `estateStaffGrants` — a filter, not a mechanism. `DEPTH`
already runs the whole ladder, and the narrowest-grant tie-break is unchanged.

**The deciding layer, named in the contract as every write since `GEN-014` has:**

> **THE AUTHORITATIVE GATE IS THE AUTHORIZING-GRANT LOOKUP over the node the new grant names**,
> evaluated inside the act's transaction. A caller holding no `grant_administrator` grant covering
> that node gets **404**, identical to a node that does not exist — `403` is absent by that decision.

**Inside the transaction**, not at the route: a concurrent revocation of the actor's own authority
must not race the act. `GEN-016` established the relocation; `GEN-024`'s guard is the precedent.

**One thing to name in the contract rather than discover later:** a `grant_administrator` may confer
`grant_administrator` at or below a node they hold. **That is ADR-010 D3 working** — delegation is by
scope, downward — not a leak. `GEN-023` flagged it; it should be written down.

**Revocation is symmetric:** the revoker must hold `grant_administrator` over the node the *revoked
grant* names.

---

## The two principle notes

Both are **worked notes on existing entries**; the basket stays closed. Drafted, not written — they
land in Step 2:

1. **`[shadowed-layer-empty-oracle]`** — the shadowing layer need not be a designed gate. At
   `GEN-025` an *incidental* constraint answered first twice: a pre-check `IS NOT DISTINCT FROM`
   hid a wrong index, and `management_update`'s primary key hid a missing idempotency mechanism
   because both racers wrote the same row id. Construct the probe so the mechanism under test is the
   **only** thing that can produce the observed outcome.
2. **`[anchor-the-discriminator]`** — a line-based exclusion filter discards the **whole line**, so it
   can hide a genuine match sharing a line with an excluded one. At `GEN-026`,
   `grep "'staff'" | grep -v estate_staff` reported none while a live site carried both strings on
   one line. A search that answers "none" ends the looking; re-run unfiltered and read the matches.

---

## Rulings sought

1. **(a)** the derived-act-id + request-fingerprint pair, and the `0122` column.
2. **(b) Finding 2 — the blocker.** Provisioning has no originating event. Derived key =
   `organizationId` (my recommendation), build the Organization act, or defer?
3. **(b) Finding 1** — confirm "zero grants **ever**", not "zero live".
4. **(b) Finding 3** — how `confer` is exercised: provision a fresh organization in the test, or seed
   a `grant_administrator`? And is the permanent-lockout edge acceptable, or does the
   last-administrator guard belong in W2?
5. **(c)** the vocabularies, and the replay-returns-200-not-201 contract detail.
6. **§0** — `GEN-026`'s close, before Step 2.

**HARD STOP. No build.**
