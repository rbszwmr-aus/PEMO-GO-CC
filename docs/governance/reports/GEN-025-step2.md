# GEN-025 — W1b + W1c: the platform spine

**Status:** both built, all green. **NOT COMMITTED. HARD STOP.**
**Pin:** `75443c0dcf76e0745e883ad0e056325508be1663`, re-read from the remote at build start — identical
to HEAD. **`GEN-025` allocated from the directory scan.**

**The two oracles are reported separately below and share nothing.** `audit-provenance.test.ts`
touches no idempotency; `idempotency-adr015.test.ts` asserts nothing about the attribution
constraint.

| gate | result |
|---|---|
| contract | **105 / 105** |
| integration | **274 / 274** (was 252 — **+22**) |
| battery | **24 / 24**, zero skips |
| boundaries | PASS · validator PASS · index OK |

---

# W1b — the audit's provisioning shape and `reason_code`

## What was broken

`0116` made `principal_id`, `group_id` and `role` all `NOT NULL`. A provisioning act has none of the
three — no principal, no group, and no grant, because the grant is what it creates. So ADR-010 A1's
required shape was not merely unimplemented, it was **unrepresentable**: the only ways to record a
provisioning act were a fabricated principal (forbidden by name) or no audit at all (forbidden by D1).

## Built — `0119_access_audit_event_source_and_reason`

`source` NOT NULL (`provisioning` / `staff` / `integration`), the three authority columns nullable,
`reason_code` nullable, and one biconditional. **The shape is copied from `resident.party`, not
invented** — A1 requires *one representation, not two*.

**`staff` is the only authority-bearing source, and that is a decision I made and want confirmed.**
D1 attributes to "a principal, not a session, a service or a job". A provisioning act has no actor by
definition; an **integration** act is a job — an inbound 2iothub message processed by no person — so
naming one would be the same fiction in different clothes. The constraint says so rather than leaving
it to convention. **If integration acts should carry an operator, this is the line to change.**

### The constraint is written with `num_nonnulls`, and the mutation proves why

The obvious spelling has a hole:

```sql
CHECK ((source = 'staff') = (principal_id IS NOT NULL AND group_id IS NOT NULL AND role IS NOT NULL))
```

For a non-staff source that reads *"NOT (all three present)"* — which **permits one or two**, a
half-attributed provisioning act. I built the obvious spelling into the live schema and ran the
suite:

```
probe landed: MUTATED to the obvious spelling
✖ PARTIAL authority is refused in both directions — the hole the obvious spelling leaves
272 pass, 1 fail
```

Exactly one test caught it, and it is the one written for it. The shipped form counts instead:
`num_nonnulls(...) = CASE WHEN source = 'staff' THEN 3 ELSE 0 END` — three or zero, no third state.

### `reason_code` carries no vocabulary in the schema

ADR-014 D3 + ADR-006 D3: a `CHECK` here would freeze every act's codes into one list only a
migration could change, so **one act's new code would become a schema change for all of them**. The
rule lives in `modules/platform/src/audit/reason-codes.ts` and the vocabulary arrives as an argument.
`auditedWrite` validates **before the transaction opens**, so a bad code costs no database work.

**Proven with a test-declared vocabulary**, as directed — a mechanism proven only against the
vocabulary it ships with is proven against itself. Four refusals: an undeclared act type carrying a
code; a code outside the act's vocabulary (the typo case); a missing code where the contract requires
one (D4); and the empty string, which reads as absence and is neither. Plus the acceptances, because
negative cases are worthless if everything throws.

## W1b oracle — each by making it fail

| claim | evidence |
|---|---|
| staff act with **no authority** → refused | ✔ `audit_event_authority_only_when_staff` |
| provisioning act with a **fabricated principal** → refused | ✔ same constraint — there is no way to attach an actor to an act that had none |
| provisioning act with honest absence → **accepted**, `principal_id` reads `null` | ✔ |
| **partial** authority refused in both directions | ✔ and it is the only test the obvious-spelling mutation catches |
| integration act carries no authority | ✔ both directions |
| existing rows survive, constraint holds over them | ✔ no staff row lacks authority; no row lacks a source |
| **drop the constraint** → four reds | ✔ `268 pass, 5 fail` |
| reason validator refuses an undeclared code | ✔ and the other three refusals, and the acceptances |
| the schema enumerates no vocabulary | ✔ an arbitrary code stores; a future `CHECK` would red this |
| down migration | refuses with a non-staff row present (restoring `NOT NULL` would require inventing a principal); clean reversal succeeds |

---

# W1c — request identity, and the shared-primitive touch

## The shared-primitive touch, in full

**This is the second since `GEN-011`, and I followed the primitive's own doctrine rather than quoting
it.** That file says a second cross-cutting concern "earns its own narrow, named primitive; it does
not widen this one". So `auditedWrite` **keeps its signature and its return type `T`**, and
`idempotentAuditedWrite` is a separate export.

**The return type is the real reason, not tidiness.** On a repeat the act must not run, and D4
forbids storing the response — a repeat **re-derives** by reading the act. So there is no `T` to
return and the caller must be told. Threading a union through `auditedWrite` would force its four
existing callers to discriminate a case that cannot arise for them.

**Boundary accounting, stated because no exemption entry will carry it.** The new function makes a
**second qualified cross-schema reach** from that file — `platform.idempotency_record` beside
`access.audit_event`. **The static scan does not flag it**, and that is a gap worth naming rather
than a silence: the scan asks which schema a *file's module* owns, this file's module is `platform`,
so a platform-qualified name is not a crossing by its rule. **At runtime it is one** — the reach
happens on the calling module's connection. The scan's per-file model cannot see that shape. I have
recorded it in the primitive's own comment; **I have not changed the scan** (out of scope).

**Size of the primitive change:** `+236 / -0` in `audited-write.ts`, of which the shared
`auditedWrite` itself gains **four lines** (an options parameter, the reason validation, and hoisting
`auditId`). The rest is the new function and its types. **More than "one row's worth" in total** —
that is the number, and I am reporting it rather than deciding it was fine. Everything beyond those
four lines is additive and reachable only through the new export.

## Built — `0120_platform_idempotency_adr015`

Keyed `(principal_id, operation, idempotency_key)`, `principal_id` **nullable and no foreign key**,
storing `act_kind` / `act_id` / `audit_id` — **the act's identity, never a response blob**. The old
table is **dropped, not adapted**: every column changed meaning, it was used by nobody and tested by
nothing, and a wired-but-broken mechanism is a landmine — the first caller to reach for it would
inherit both defects believing they were solved.

**The named trap.** `NULLS NOT DISTINCT` (PG 17 here), because a provisioning act's NULL principal
would otherwise be *distinct from itself* and two provisioning acts could share a key. A sentinel
principal would fix the index and reintroduce the fabricated principal A1 forbids, through a
different door.

## THE FINDING — two probes that were not probing

**Both were caught by mutation, and neither would have been caught any other way.**

**(1) The sequential NULL-trap test could not tell a correct index from a broken one.** With the
index rebuilt *without* `NULLS NOT DISTINCT`, it still passed: the pre-check's `IS NOT DISTINCT FROM`
matched the earlier row and returned a replay before the index was ever consulted. Only the
declaration test reddened. So I added **the concurrent provisioning race**, where the pre-check
cannot help because both transactions read before either commits — and the index is the only thing
left.

**(2) That new test then also passed under the broken index — because the act was serialising
itself.** Both racers inserted the **same** `update_id`, so the loser was rejected by
`management_update`'s own primary key, not by the mechanism. **The racing writes must not collide on
anything except the mechanism under test.** With per-attempt row ids:

```
MUTATION: index without NULLS NOT DISTINCT
✖ THE NULL TRAP, CONCURRENTLY — two provisioning acts racing one key: one wins
✖ RED — the index really is NULLS NOT DISTINCT, and a default one would not be
272 pass, 2 fail
```

This is `GEN-024`'s lesson recurring one layer down, which is why the principle note covers both
halves.

## W1c oracle — each by making it fail

| claim | evidence |
|---|---|
| a repeat does not run the act | ✔ `effects === 1`; returns act identity + the **original** act's `audit_id` |
| no response blob | ✔ asserted against the catalog, not the code |
| a replay writes **no second audit event** | ✔ nothing happened, so nothing is recorded |
| **concurrent → the act runs once** | ✔ one performed, **one row in the database**. The shipped mechanism landed two |
| **crash between act and key → no act** | ✔ zero act rows, zero keys — and the **retry then succeeds**, so the operation is not poisoned |
| same key, different act → refused | ✔ `IdempotencyConflictError`, never answered with the earlier result |
| two provisioning acts sharing a key → refused | ✔ sequentially and **concurrently** |
| keys retained | ✔ `pemo_app` holds no DELETE — the floor holds by construction |
| the old mechanism is gone | ✔ `0004`'s `scope` column no longer exists |
| **remove the mechanism** → six reds | ✔ `268 pass, 6 fail`; restored byte-identically (`cmp`) |
| down migration | refuses with records present (no honest translation between the two shapes); clean reversal succeeds |

---

## The one principle item

A **worked note** appended to `[probe-must-bite]` — not a new principle, and the basket was not
reopened. It records the *technique*: hold the transaction open inside the callback and mark the line
load-bearing; and the second half this PID found — the racing writes must not collide on anything but
the mechanism under test. Cites `GEN-016` (first use), `GEN-024` (its absence let a lock-deleted test
pass), `GEN-025` (the self-serialising act). Still 57 principles.

## Out-of-scope touches, disclosed

**`apps/api/src/server.ts`, four sites, +16 lines.** Making `source` required rather than defaulted
means the compiler enumerated every existing caller — which is the mechanism working, not an
accident: a default would have let a future act with no actor inherit a staff attribution by
omission. Each site declares `source: 'staff' as const` with the reason.

**`apps/api/src/wiring.ts`, −3.** The old store was constructed there; removing the store required
unwiring it.

**Three existing test files, +17/−6**, to add `source` to raw audit inserts. One of these matters:
`audited-scope-write.test.ts`'s FK test was failing on the missing `source` rather than on the
foreign key it names — it would have been red for the wrong reason. Fixed so it fails for its own
reason.

## Weight

| | |
|---|---|
| new | 2 migrations up+down (256), `reason-codes.ts` (107), 2 test files (537) |
| changed | `audited-write.ts` +236, `index.ts` +18/−, `server.ts` +16, `wiring.ts` −3, 3 tests +17/−6 |
| deleted | `idempotency-store.ts` (90 lines) |
| net | **≈ 900 new lines, 270 insertions across 8 files, 90 deleted** |

## Gaps — complete

1. **`auditedWrite` does not force a reason registry.** `options.reasons` is opt-in, so an act type
   with a declared vocabulary can still be written with no validation by omitting it. Making it
   mandatory would change all four callers and needs the real registry to exist first (W2).
2. **No reason vocabulary exists** — the mechanism is proven against a test declaration only, as
   directed.
3. **The cross-schema scan cannot see the runtime crossing** this primitive makes (§ above).
   Recorded in a comment; the scan is unchanged.
4. **`act_id` must be stable across retries.** A client retrying with the same key while the server
   generates a fresh act id each attempt would trip D5's conflict rather than replaying. Nothing here
   forces stability, and the first real caller (W2) must supply a derived id, not a random one. **This
   is the sharpest of these and I would rather flag it now than have W2 discover it.**
5. **No route uses `idempotentAuditedWrite` yet** — proven at the module level only.
6. **The pre-check is advisory.** It makes the ordinary repeat cheap; the unique index is the
   mechanism. Stated in the code so the pre-check is never mistaken for the guarantee.

## Housekeeping

Test residue: `idem=0 upd=0 aud=0`. Every schema mutation was restored and re-verified from the
catalog; the source mutation was restored **byte-identically** (`cmp`). No production or staging
database was contacted.

**HARD STOP. Nothing committed.**
