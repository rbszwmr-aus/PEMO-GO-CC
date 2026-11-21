# GEN-033 — W3 batch iii: the three write-surface routes

**Status:** built, all green. **NOT COMMITTED. HARD STOP.**
**Pin:** `d11154f85ebb12340bba3aeb965428107fa45947`, re-read at build start — identical to HEAD.

| gate | result |
|---|---|
| contract | **105 / 105** |
| integration | **351 / 351** (was 342 — **+9**) |
| battery | **26 / 26** · boundaries PASS · validator PASS · stamp PASS · index OK |

on a from-nothing rebuild. **Contract `1.0.0` → `1.1.0`** (MINOR: three new operations, five new
problem types — additive, so not breaking).

**W3 IS COMPLETE. The three acts built at `GEN-030`/`GEN-031` are reachable, behind `ADR-017`'s
floors.**

---

## The floors

**`ADR-017` carried in** with its acceptance; `adrs-present` 16 → 17, and moving the ADR out still
reds, so the acceptance record does not answer for the decision.

**`mayAdministerGroup` is `G-2` lifted to a set.** Membership is conferral by proxy — one act hands
over the union of a group's live grants — so the floor is effective `grant_administrator` covering
**every** node the group confers at. **A conjunction, never a subset**, because there is no partial
membership to admit.

**The empty-group fallback is the part that is easy to get wrong**, and the migration comment says
why: a conjunction over no nodes is *vacuously true*, so a grantless group would admit anybody — and
that is **pre-staging**, not a harmless no-op, because the caller inherits whatever a legitimate
administrator later confers and the conferrer's own `G-2` looks at the node and never enumerates
members. A grantless group therefore takes the **strongest** floor: the organization node.

**Effective, not merely granted** throughout: the `GEN-030` witness (live grant AND live membership),
so a grant held by an empty group authorizes nothing.

## D5 — the witness gained the authority group, and that was a real gap

`audit_event.group_id` means *the group that holds the authority* (`ADR-012` D2), and the witness did
not carry it — it named the principal, the grant and the membership. **Extended, because an
authority-bearing act cannot satisfy `GEN-025`'s biconditional without it.** All three routes record
`principal_id` + `groupIdOfGrant` + `role`, which the biconditional then requires to be present
together.

## Proof — the eight required cases, and every guard mutated

| case | evidence |
|---|---|
| **1** building admin → group holding org authority → **refused**; org admin → passes | ✔ |
| **2** group at A **and** B; admin at A only → refused; both → passes | ✔ |
| **3** empty group, non-org-admin → refused | ✔ |
| **4** removal leaving no effective administrator → refused | ✔ |
| **5** caller who cannot administer the group → refused | ✔ |
| **6** standalone `registerPrincipal` floor; no seed row | ✔ |
| **7** every refusal a **domain** error — status, declared type, `retryable: false` | ✔ |
| **8** client-key retry replays; **remove → re-add with a new key re-instates**; derived-key retry replays and the index is not violated | ✔ |

**Each guard shown to bite, by the *plausible wrong rule* rather than a syntactic weakening:**

| mutation | result |
|---|---|
| conjunction → **any** node covered | CASE 2 reds (347/5) |
| empty-group fallback → vacuous pass | CASE 3 reds (350/1) |
| drop the `GEN-030` consult from `remove` | CASE 4 **and** batch-3a's route-2 guard red (343/9) |
| drop the administration floor from `remove` | CASE 5 reds (350/1) |
| `registerPrincipal` floor → **any** administrator rather than at the org node | CASES 6 and 7 red (349/2) |

Backups verified to exist **before** mutating; every restore `cmp`-checked.

**One mutation had to be re-aimed.** Removing D3's floor wholesale did not compile: the witness
requirement and the org-node coverage are one statement. Cutting only the coverage — *any*
administrator instead of one at the org node — is the realistic wrong rule and is what reds.

## The idempotency stances, and why they differ

- **`registerPrincipal`: derived-key** on `(organizationId, externalId)`. An identity is never ended
  and re-asserted, so there is no legitimate repeat a derived key could wrongly collapse; the per-org
  unique index is the backstop.
- **`addMembership` / `removeMembership`: client-key.** A derived `(group, principal)` key **would be
  wrong** — the assertion model permits remove-then-re-add, and a re-instatement is a NEW instance
  that a derived key would collapse against the prior membership. CASE 8 proves the re-instatement
  works.

## THE FINDING — the fixture validator caught what I forgot

Adding five problem types without regenerating the surface enum left
the validator code `problem-type-enum-agreement` red. **The registry is the source of truth and the enum is
generated from it — and nothing regenerates it automatically.** I had done this by hand at `GEN-027`
and did not this time. Caught by the validator, not by review. **A generation step performed by
memory is a step that will be skipped**; worth the R5 cluster's attention alongside the other
pattern-enforced conventions.

## Weight

**878 insertions / 48 deletions across 33 files.** 20 are the contract restamp (generated). Substance:
the floor module (128), three routes (~330), five problem types, three contract operations and five
schemas, the `[delegation-floor]` entry, and a 300-line proof file.

## Gaps — complete

1. **`removeMembership`'s response carries empty `groupId`/`principalId`** — the command returns the
   instance and version, not the pair, and I did not widen it for cosmetics. The contract declares the
   fields; they are returned empty rather than omitted.
2. **The floor trusts the caller's node set**, as every G-2 site does: only the composition layer can
   guarantee it was filtered to `grant_administrator`.
3. **Subtree/cross-node "covering"** inherits current `G-2` semantics, as scoped out.
4. **No fixtures** for the three operations — `emittedOnlyBy`, as every management write.

**HARD STOP. Nothing committed.**
