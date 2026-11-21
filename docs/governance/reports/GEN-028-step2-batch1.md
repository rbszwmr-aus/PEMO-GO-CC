# GEN-028 — W3 batch 1: `committed` made required

**Status:** built, all green. **NOT COMMITTED. HARD STOP.**
**Pin:** `1a8af560f8a7e29a8cdc809d6d1605cf5d6e370c`, re-read from the remote — identical to HEAD.

**Scope reading:** `GEN-028`'s own PID file says *"Step 2 scope follows the ruled batching"*, so
**batch 1 is this PID's Step 2**. Batches 2 and 3 take new numbers. Say the word if you meant a
separate PID for batch 1 too and I will re-allocate before merging.

| gate | result |
|---|---|
| contract | **105 / 105** |
| integration | **304 / 304** (was 299 — **+5**) |
| battery | **24 / 24** · boundaries PASS · validator PASS · index OK |

---

## The delta, exactly as measured at Step 1

**2 production sites** — `publishManagementUpdate` and `addEstateContact`, both returning types that
cannot carry a refusal (`PublishedUpdate`, `void`). **6 test sites**, all in `audited-write.test.ts`,
plus 11 in the two suites that call the primitives directly. The compiler enumerated every one:
`Expected 4 arguments, but got 3`, twice in `server.ts`, exactly the two I predicted.

`AuditedWriteOptions` is now required as a parameter, because it carries a required member. The two
`undefined` guards inside the primitives are gone with it.

## The trade, written where it is read

Stated in `AuditedWriteOptions.committed`'s own doc comment, not only here:

> Required makes **forgetting impossible** — the compiler enumerates every call site, as
> `AuditRecord.source` does. **It does not make being wrong impossible.** An act that cannot refuse
> writes `() => true`, and that is an assertion about the command's shape which the compiler cannot
> check: if that command later starts returning a refusal, the line keeps committing it and the
> false-audit path reopens at a site that still looks correct.

And the heuristic default is recorded as **considered and rejected**: inspecting the result for a
`kind` field is structural but magic — a command whose *success* value carries `kind` would be
misread, and the rule would live in a guess about shapes rather than in each act's declaration.

Both call sites spell the reason out locally rather than pointing at the type.

## The standing oracle — the half a type cannot carry

Five cases, one per command that can refuse by value, **enumerated** so that a command which gains a
refusal and is not listed is exactly the gap this closes:

| command | refusals covered | where |
|---|---|---|
| `recordOccupancy` | conflict, out-of-scope | route |
| `endOccupancy` | not-live / absent | route |
| `conferGrant` | out-of-scope, conflict | route |
| `revokeGrant` | not-live, last-administrator | route |
| `provisionOrganization` | already-provisioned | module — the route's idempotency layer answers first |

**Driven through the routes wherever a route can reach the refusal**, because the defect being
guarded lives in the *call site's declaration* and a module-level test would never see it.

**And aimed at the OLDER callers.** `recordOccupancy` predates the rule and is where the defect was
found; the grant operations were written alongside it and are correct by construction. **Proven by
mutation:** changing that older site's declaration to the wrong-but-plausible `() => true` reds
exactly that case — `303 pass, 1 fail`. Restored byte-identically.

## The principles pass — four items, all on batch 1, and why

**Batch 1 is where they disturb least.** Its diff is *primitive + tests + docs* and touches **no
surface**, so the "a primitive change does not share a diff with a surface" rule is respected;
batches 2 and 3 carry schema and authority changes where an unrelated documentation edit is noise in
exactly the review that most needs signal. Item 4 is also *about* batch 1's own oracle, so it lands
beside the thing it describes.

1. **Fingerprint rule → `[identity-by-self-declaration]`**, as ruled, and the note makes the principle
   generalise: *an identity is whatever the subject itself declared — not its filename, not its
   neighbours, and not the values something else supplied around it.*
2. **Mutation realism → `[probe-must-bite]`**, worked note, with GEN-027's instance and the closing
   question: *is this the defect I meant to inject?*
3. **`[no-coincidental-collision]`** — one clarifying clause, **no rename**: *"No coincidental
   collision — of NUMBERS."* with a parenthetical saying the id has misled twice and is permanent.
4. **NEW ENTRY, and the name I chose: `[regression-tests-the-older-callers]`.**

   Kebab-case, states the rule, matches the file's imperative style. Body: a new call site written by
   someone holding the rule in mind proves the *author* understood it, not that the rule is enforced;
   the sites written before anyone knew the rule existed are where the defect lives. Distinguishing
   notes on both sides — from `[specific-assertion-catches-decay]` by what is chosen (**content** vs
   **subject**: a perfectly specific assertion aimed only at new callers still misses), and from
   `[prove-by-making-it-fail]` by what is established (**can it fail at all** vs **is it watching the
   code that will break**).

**59 principles.**

## The batch-2 question, answered now because it was cheap

> Is any organization currently in the falsely-protected state — an administrator grant held by an
> empty group?

**No — and for a blunter reason than "none is affected": `NONE — no organization holds an
administrator grant at all`.** The seeded world has never been provisioned, and W2's tests clean up
after themselves. **This changes urgency, not design:** the defect is unreachable today only because
the feature is unused, and the first real provisioning makes it reachable. It stays a batch-3 fix.

## Weight

`audited-write.ts` +40/−6 · `server.ts` +30 · `PID-PRINCIPLES.md` +5 entries-worth of prose (1 new,
3 notes) · three test files, +150 net. **No schema, no contract, no new surface.**

## Gaps — complete

1. **`() => true` remains uncheckable** by construction; the standing oracle is the mitigation and it
   only covers commands that refuse *today*.
2. **The enumeration is manual.** Nothing derives "commands that can refuse by value" from the types,
   so a new one must be added to the table by hand. A derived check would need to inspect union
   members across modules — possible, not cheap, and out of scope here.
3. **`endOccupancy`'s case exercises the absent-instance path**, not `not-live` specifically; the
   `not-live` refusal is already covered by `occupancy-end-write.test.ts` for behaviour, but not for
   the audit-row property.

**HARD STOP. Nothing committed.**
