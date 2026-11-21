# GEN-009 — Step 2: the first scope-only write, proven whole

**Status:** built, proven, **NOT COMMITTED. HARD STOP.**
**Headline:** the gate and all four `D1` properties hold, each with its red fired. `0116`'s down-migration refusal — written at Step 2 and never proven — **now fires**, with its own message, and the table survives the attempt.

---

## 1. Pin and re-read

| | |
|---|---|
| **Pin** | `8632baa5a437033d09275e24f5f000b5f1686c50`, `origin/main` re-read from the remote and equal |
| **Tree / files** | `a703f36d7a6061f2dded457fd2d37305058da694` / 787 |
| **Green** | integration+contract **295** (105 + 190), 0 failures · boundaries `PASS` · battery **21/21** · `validate.mjs` PASS (2 pre-existing declared gaps) · index `--check` OK |

**ADR-010 D1 re-read from `docs/adr/ADR-010-role-list.md`, not through a quotation.** It says what the PID said it says, and one thing the quotes did not carry: D1 lists the four properties and then adds *"Without all four, record rather than restrict records nothing. **This is a requirement on the write path, not a logging preference.**"* That sentence is why the audit here is a transaction participant and not a log line. The stale `(principal, scope node)` key language is present as recorded on the owed list; the substance — actor and authority as two facts — is what the record implements.

`0116` is now GEN-009's and is staged for this commit. It was **applied but untracked** for the whole of GEN-011, which is how GEN-011 found that the migration runner reads the directory rather than the index.

## 2. What was built

**The vehicle** is `home_safety.management_update` — staff-authored, node-scoped, non-escalating, already existing. This PID does not originate a module's schema as a side effect of proving an audit pattern.

- `modules/home-safety/.../management-update-commands.ts` — the act, and the scoped lookup. `publish` takes the **transaction handle**, never its own: a version that opened its own transaction would put the act and the audit back in two of them.
- `apps/api/src/management/authorizing-grant.ts` — which `(group, role, node)` grant authorized the act.
- `apps/api/src/server.ts` — `POST /api/management-web/v0/safety/events/{eventId}/updates`.
- The contract: the operation, `0.1.5 → 0.2.0`, lock regenerated, 22 declarations restamped by `stamp-version.mjs`.

**The management contract said "No write operations."** That was true while *"may this principal do this"* was undecided. `ADR-010` D1 decided it, so the package's own description now says so and states that the other 26 stay deferred — a write appears here when its authorization is decided, never before.

**`403` is deliberately absent from the operation's responses.** Out of scope answers `404`, identically to an event that does not exist. A distinct refusal would confirm the event's existence to a principal with no scope over it. The absence is the decision, recorded in the contract as such.

**The role-separation decision note the Step-1 ruling asked for already exists** — `docs/governance/reports/DECISION-least-privilege-db-roles.md`, filed by GEN-010 when that decision moved there. Not re-filed; a second home for one decision is how they diverge.

## 3. The proofs — each red fired

Ten tests in `tests/integration/audited-scope-write.test.ts`, all green, then made to fail by mutating the thing they claim to check.

**The gate.** `estate_staff` grants are expanded to estate ids and applied **in the query**; an event outside them does not resolve.
- In scope → `201`, the update persists.
- Same organization, real `estate_staff` grant at a Location that does not expand to the estate → `404`, nothing written, **nothing audited**.
- **The truest form:** one principal, one act, and the grant is the only thing that changes — end-date `grp_of_one_stf_wfg_manager`'s grant and the identical request goes `201 → 404`.

**D1.1 same transaction.** Act and audit land together. Red: a CHECK added to `access.audit_event` that this action violates makes the audit insert fail **after** the act is written — the request fails and `updateCount() === 0`. Removing the injection makes the identical request succeed, so the red was caused by the injection and not by something incidental.

**D1.2 attributable.** `principal_id` is the actor, `group_id`/`role`/`node` the authority, asserted to be different columns and different values. Red: an audit row for `'a-session-not-a-person'` is refused by the foreign key — attribution a bare text column could satisfy is not attribution.

**D1.3 effective-dated.** The audit retains the instant its authority is answerable at, and `resolveAsAt` at that instant returns the recorded grant. Red: move the membership's `effective_from` forward and re-derivation returns **nothing** for the past act — GEN-006's silent-empty, biting on a real audited act. The retained record still answers. That is the entire argument for recording authority instead of recomputing it.

**D1.4 immutable to the actor.** The runtime role is refused `UPDATE` and `DELETE` at the permission level, on both handles, and the row is unchanged.

### The mutations

| mutation | expected | result |
|---|---|---|
| **M1** scope filter removed from the query | the gate reds fire | ✖ both — `the grant was removed and the act still resolved` |
| **M2** the audit silently skipped for this action | every audit test fires, the gate tests do not | ✖ 6 — `the act was written without its audit`; gate ✔ |
| **M3** the audit records the wrong authorizing group | D1.2 and D1.3 fire | ✖ 3 — `the authority is not the authorizing group`, `the recorded authority is not in force at the recorded instant` |

Restores verified by `cmp`. Build exit status checked on every mutation, so no result is stale output.

**M1 revealed a property worth naming.** With the query filter gone, the first gate red failed with a `500`, not a `201`: the authorizing-grant lookup found no grant expanding to the event's estate and **refused to fabricate authority**. The gate is broken by that mutation, and the audit path independently declines to invent a record — a second line of defence I did not design deliberately and would not have noticed without the mutation.

## 4. `0116`'s down-migration refusal — fired, both ways

Flagged since the blocker ruling as written-but-never-proven. Through the real `migrateDown`:

```
audit rows before: 1
ATTEMPT 1 — roll back with the audit table NON-EMPTY
  REFUSED: REFUSING to reverse 0116: access.audit_event holds 1 row(s). Dropping it
  destroys the record of who did what under whose authority — the evidence ADR-010 D1
  released 27 writes on. Empty it deliberately first, or do not reverse.
  table still exists: true   rows: 1
ATTEMPT 2 — empty it deliberately, then roll back
  rolled back: 0116_access_audit_event.down.sql   table exists after: false
```

Refuses for its own stated reason, leaves the table and its row intact, and reverses cleanly when the operator has emptied it deliberately.

## 5. One thing I broke, and the fix

The version bump broke two existing management tests, which asserted `'0.1.5'` as a literal. That is precisely the failure `contract-version.ts` documents in its own header — *"it was a literal until v0.2.0, and the bump that changed nothing else broke fixture parity in three files."*

Fixed by reading the version from `contract-lock.json` rather than restating it — **and from the lock, not from `openapi.yaml`**, because the server reads the latter and asserting against it would compare a value with itself. The lock is a separate artifact `validate.mjs` verifies against the contract, so the assertion stays a real cross-check.

## 6. Gaps — this list is complete

1. **When several grants admit the same estate, the audit records the FIRST in the resolver's stable order, not the narrowest.** Deterministic and reproducible, but *which* of several ought to be named is a modelling question — broadest, narrowest, or all — and I declined to fix it by implementation. **Ruling sought.**
2. **No idempotency on the write.** The resident acknowledgement carries a client-supplied key; this does not, so a retried request publishes a second update and a second audit row. Thin was the instruction; this is the first thing the 26 will need.
3. **`occurredAt` is `scope.asAt`, the instant scope was resolved at** — deliberately, so the record is internally consistent. But `staff-context.ts` records a known tension: `getPrincipal` resolves at the server's real now while `context.now` may be dev-pinned. In the seeded world every grant is open-ended from 2024, so no test distinguishes them, and **a mutation swapping one for the other would not be caught.**
4. **`event.retracted` is loaded and not acted on.** The resident path refuses acknowledgement on a retracted event; this write does not, and I did not add a rule the PID did not ask for. Publishing an update on a retracted event is currently allowed.
5. **No fixture for the new operation.** The management corpus has 26 fixtures and none for `publishManagementUpdate`; `validate.mjs` passes because it validates what exists. The contract is exercised by the integration tests, not by fixture parity.
6. **The 500 branch in §3 is untested as itself.** It is reachable only when the query filter and the grant expansion disagree, which no test constructs deliberately — M1 reached it by accident.
7. **`403` removed from this operation only.** The other eleven management operations still declare it. Whether scope-absence should be `404` across the whole surface is a larger consistency question this PID did not open.

## 7. Rulings sought

1. **§6.1** — which grant to name when several authorize.
2. **§6.4** — should a retracted event refuse an update?
3. **§6.2** — is idempotency this PID's or the next's?
4. **Commit** — nothing is committed. `0116` is included this time, as ruled.

**HARD STOP before commit.**

---

# Addendum — §1, the narrowest authorizing grant

Ruled before commit. This supersedes §6.1, and §6.2 (idempotency) and §6.4 (retraction) are deferred as owed items rather than gaps in this build.

## What changed

`findAuthorizingGrant` now collects **every** grant whose expansion covers the act's estate and returns the **narrowest** — ranked by node-kind depth, `organization … unit`, with `location` at the bottom — breaking ties on **ascending `grantId`**.

The semantics are written into the code, not just the report: **the narrowest grant in force that authorized this act, not the sole one.** The gate authorizes by the union, so several may have authorized it, and naming one as *the* authority would be the same confident falsehood the audit exists to prevent. What else the principal could do at that instant is not lost — it is reconstructable from the effective-dated grant table queried as-at `occurred_at`, which is why that instant is retained.

The depth ladder is written out past the depths this act uses. A Location grant expands downward through `parent_location_id` and can never contain an Estate, so this PID's estate-level act only ever chooses among organization, portfolio and estate. The rest is there because the 26 will act at other depths and reuse this function rather than re-derive the ordering.

## Proven

Four tests, three end-to-end and one at the decision:

- Manager holds `estate` **and** a `portfolio` grant covering the same estate → the **estate** grant is recorded.
- The record names the narrowest and **not the sole**: both grants are still resolvable as-at the retained instant, and the recorded one is among them.
- Two groups granting `estate_staff` at the same estate → the winner is the lowest grant id, identically across three runs.
- The tie-break exercised directly, with candidates ordered so the lowest id is **last**, plus the reversed input, plus a case where a narrower grant with a higher id must beat a broader one with a lower id.

| mutation | result |
|---|---|
| **M4** broadest wins instead of narrowest | ✖ `the BROADER portfolio grant was recorded` |
| **M5** tie-break removed, first candidate wins | ✖ `the tie-break did not pick the lowest grant id` |

## The finding: my first tie-break test was an empty oracle

**M5 originally left every test green.** The end-to-end tie test asserted the record was *stable across three runs* — and stability is not the rule. The resolver already returns rows under `ORDER BY node_kind, node_id`, so "keep the first candidate" is stable too. The test could not distinguish the rule from its absence.

This is the class GEN-011 found in its own suite, recurring in a different shape: there the injection was in the wrong window, here the assertion was of the wrong property. Both are a test that passes when the thing it checks is deleted.

Fixed by testing the **decision** rather than the route: `findAuthorizingGrant` called directly with candidates ordered so the lowest id is last. Only a real tie-break gets that right, and M5 now fires on it. The end-to-end stability test is kept — it proves the rule survives the real resolver — but it is no longer the only evidence.

## Also recorded

**M1's second gate is now written into the route**, per the ruling: the authorizing-grant lookup refusing to fabricate authority means *an act whose authority cannot be honestly recorded is not performed*. Defence in depth that emerged from the audit being a transaction participant.

**The audit-pins-`user_group` property bit again**, in the new teardown: deleting a test group with audit history fails on the foreign key. Correct in production — you do not delete a group that has authorised acts on record — so the teardown clears audit rows first and says why. Found the same way both times: a failing teardown, not a failing assertion.

## Final state

299 tests (105 contract + 194 integration), 0 failures · boundaries `PASS` · battery 21/21 · validator PASS · index `--check` OK.
