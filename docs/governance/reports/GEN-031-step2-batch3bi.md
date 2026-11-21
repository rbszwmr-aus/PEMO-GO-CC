# GEN-031 — W3 batch 3b-i: the identity boundary in the schema

**Status:** built, all green. **NOT COMMITTED. HARD STOP.**
**Pin:** `6f87b264d9bb7cd070b40ece39dcfef20d8e7b78`, re-read at build start — identical to HEAD.

| gate | result |
|---|---|
| contract | **105 / 105** |
| integration | **334 / 334** (was 324 — **+10**) |
| battery | **25 / 25** · boundaries PASS · validator PASS · index OK |

on a database rebuilt from nothing (41 migrations).

---

## The stop condition did not fire

**`staff_principal.organization_id` is `NOT NULL`**, verified against the live catalog before writing
anything, so per-organization uniqueness is expressible directly and there was nothing to stop for.

## 1. The schema — `0124`

`identity_source` (`external` | `recorded_seed`), `external_id` nullable, one biconditional, and
`UNIQUE (organization_id, external_id)`. **No credential column, and a test asserts the whole column
list** so that adding a secret-shaped one needs ADR-016 reopened rather than a code review noticing.

**Three choices the migration argues for rather than assumes:**

**Nullable, not backfilled with a fiction.** The six seeded principals have no external identity
because there is no external system. `seed:stf_wfg_manager` would put a value no authenticator will
ever produce into a column that *means* the person's id in the external authenticator. `resident.party`
(`0114`) solved the same problem with source + nullable subject + biconditional, and `ADR-010 A1`'s
rule applies one table over: **a fiction is worse than a null, because a null is legible.**

**The simple biconditional, not `num_nonnulls` — and the difference is stated.** `0119` needed
counting because it gated *three* columns and the conjoined form reads "NOT (all three present)" on
the other branch, permitting one or two. **Here exactly one column is gated, so
`(source = 'external') = (external_id IS NOT NULL)` is exact in both directions.** Considered, and
simpler is correct rather than merely shorter.

**NULLs are DISTINCT — the opposite call from `0120`, with the reason written down.** There, NULL meant
*the one provisioning act* and two had to collide. Here NULL means *no external identity recorded*,
which is not an identity: many may coexist. `NULLS NOT DISTINCT` would allow exactly one seeded
principal per Organization.

### NO DEFAULT on `identity_source`, and this is the opposite of `0117`/`0118`

Those added defaults so seeds would keep working, and were right: `version = 1` is what a first
assertion *is*. **Here a default would be a lie with a fallback** — defaulting to `recorded_seed`
would let any writer that forgets the column record a real person as a fixture, and the biconditional
would then force their `external_id` to NULL, **discarding the one thing this act exists to record**,
at a call site that still looks correct. Every writer states what it is, as `audit_event.source` does.
Cost: five call sites; failure when one is missed is a NOT NULL violation at write time.

## 2. `registerPrincipal`

Records `(external_id, display_name)`; writes `identity_source = 'external'` explicitly; **no
credential parameter exists**. Registering the same identity twice **refuses** rather than throwing —
an onboarding step run again, or an IdP re-notifying on a second sign-in, is an ordinary attempt and
must be a no-op the caller can *see*. The unique index is the mechanism; the refusal is the readable
answer.

### REPORTED, NOT ASSUMED: what authority standalone registration requires

**I did not bake a guess into the primitive**, and the file says so where a route author will read it.

- **Inside the bootstrap** it cannot be gated by G-2 — there is no prior principal by construction
  (A1) — and its safety is the once-only zero-grants-ever predicate around the whole transaction.
- **Standalone** the question is open. Recording an identity **confers nothing on its own**: a
  principal with no membership holds no grant and can do nothing. **But it is not nothing either** —
  it creates the subject `addMembership` can later seat, and consumes a name in the organization's
  identity space.

**My reading, for your ruling when the route is wired (batch iii):** require `grant_administrator`
somewhere in the organization — the same floor `addMembership` carries — because the two acts are
halves of one onboarding and a different bar on each is a seam. **Not implemented.**

## Proof — each by making it fail

| claim | evidence |
|---|---|
| biconditional, **both ways** | external without id → refused; non-external with id → refused; **both honest shapes accepted** (a negative set that refuses everything proves nothing) |
| **drop the biconditional** | ✔ **both reds** (330 pass, 4 fail) |
| per-org uniqueness bites | same identity twice in one org → refused |
| same identity in **two** orgs → allowed | ✔ and **making the index global reds it** (333/1) |
| many NULL external_ids coexist | ✔ — the `0120`-opposite call, asserted |
| **no credential column** | ✔ the full column list is asserted, plus a secret-shaped-name scan |
| `registerPrincipal` records | ✔ source `external`, id and name round-trip |
| repeat refuses, writes nothing | ✔ |
| **seed principals survived** | ✔ all `recorded_seed`, **zero violating the biconditional** |
| down migration | refuses with a recorded external identity (it would orphan the mapping and a later registration would create a second principal for the same human); clean reversal succeeds |

## THREE FINDINGS FROM MY OWN WORK

**1. The migration-immutability check fired again.** I added the no-default rationale to `0124` after
applying it. `0124` has never left this machine, so the fix was to rebuild from nothing — the
`GEN-025` precedent. **The rule stands: once merged, a comment is a new migration.**

**2. My regex edited two `user_group` inserts it should not have.** Adding `identity_source` to the
fixtures, a `VALUES ($1, $3, '...')` pattern matched group inserts too, and the failure surfaced as
`INSERT has more expressions than target columns`. I found it by **diffing against the baseline**
rather than guessing — `[diff-against-clean-baseline]` — and reverted exactly those two lines.

**3. And one site my pattern missed entirely** (`VALUES ('stf_w2_e', $1, …)` — a literal first
argument), fixed directly. **That is the third PID running where an under-matching pattern of mine
has cost a cycle.** The owed grep-cluster item is not a nicety.

## Weight

**New:** migration up/down (163), `principal-commands.ts` (146), tests (183).
**Changed:** the seed, four test fixtures, `index.ts`, `wiring.ts` — 8 files, small edits.
**No contract, no route, no new surface** — this batch ships a schema and a recording command.

## Gaps — complete

1. **No route for `registerPrincipal`** — batch iii, and it carries the authority question above.
2. **`recorded_seed` is reachable only by direct SQL.** No command writes it, deliberately: it
   describes rows that predate the boundary. A future importer would need its own decision.
3. **`external_id` has no format constraint** — an IdP subject is opaque and PEMO should not
   pattern-match one, but that also means a typo is recordable.
4. **The bootstrap does not use this yet** — batch ii.

**HARD STOP. Nothing committed.**
