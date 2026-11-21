# GEN-023 — Step 1b: the exclusion constraint, and the shipped idempotency store

**Status:** read-only. No migrations, no code, no build. **HARD STOP.**
**Pin:** `bc0d924e…`, unchanged. Every live check ran against the local dev database. **No
production or staging database was contacted.**

**Headline:** the exclusion constraint is **hygiene, not safety** — and the evidence is stronger than
the union argument alone. Its stated rationale describes an invariant it **no longer enforces**, and
I proved a principal can already hold two fully overlapping identical grants at one node today. And
the shipped idempotency store **fails the exact case its own comment claims to handle** — measured,
twice, not read off the source.

---

## 1. `0112`'s own stated rationale, quoted

```sql
  -- One principal cannot hold the same node over two overlapping periods, or
  -- "what was in force then" would have two answers — the ambiguity effective
  -- dating exists to remove.
  --
  -- Declarative, not a trigger: a trigger is bypassable by a bulk load, which is
  -- exactly how bad history arrives. btree_gist is already installed by 0101.
  CONSTRAINT scope_grant_no_overlapping_periods
    EXCLUDE USING gist (
      principal_id WITH =,
      node_kind    WITH =,
      node_id      WITH =,
      tstzrange(effective_from, effective_to) WITH &&
    )
```

**Invariant claimed:** *one principal cannot hold the same node over two overlapping periods*, so
that *"what was in force then"* has one answer.
**Form chosen:** declarative rather than a trigger, because *a trigger is bypassable by a bulk load*.

**That rationale is now stale, and this matters more than a stale comment usually does.** `0115`
re-keyed the constraint to `(group_id, role, node_kind, node_id, range)` and **re-added it with no
restated rationale** — I read the whole re-key block; it explains the substitution and the backfill
and says nothing about what the constraint now protects. So the only stated rationale in the
repository is about a **`principal` column that no longer exists**.

The test carries the same stale claim forward: `access-scope-model.test.ts:298` says *"Two periods
for one principal and node would give 'what was in force then' two answers"* — while the case it
actually exercises is same **group**, same role, same node.

## 2. Does any reader depend on at-most-one grant per key per instant? **No — and one already sees two**

**Measured first, then read.** I inserted a second group granting the **same role at the same node
to the same principal**, fully overlapping, in a rolled-back transaction:

```
INSERT 0 1     -- accepted; the exclusion is keyed on group_id, and this is a different group

grant_id            | group_id                  | role         | node_kind | node_id
grant_dual_approver | grp_wfg_block_a_approvers | approver     | building  | blk_wfg_a
grant_dual_staff    | grp_wfg_block_a_staff     | estate_staff | building  | blk_wfg_a
gr_probe_dup        | grp_probe_dup             | approver     | building  | blk_wfg_a
```

**Two `approver` grants, same node, same instant, one principal.** So *"one principal, one node, one
period"* is **already false today, by design** — ADR-012 D5's union makes it legal, and the exclusion
was never the thing preventing it.

**Every reader, with evidence:**

| reader | behaviour with duplicates | depends on at-most-one? |
|---|---|---|
| `admits()` (`scope-resolution.ts:87`) | loops grants, **returns on first match**; union, no deny, no exclusion | **No** — monotonic; extra rows cannot remove an admission |
| `admitsUnassigned()` (`:135`) | `scope.grants.length > 0` | **No** — monotonic in the same direction |
| `findAuthorizingGrant` (`authorizing-grant.ts:88`) | collects **all** authorizing grants, reduces to narrowest by `DEPTH`, **ties broken on `grantId` ascending** | **No** — the tie-break exists *because* multiplicity is expected, and it is deterministic |
| `findGrantsAsAt` (`access-repository.ts:71`) | see below | **No** |

**A sub-finding inside that last row.** `findGrantsAsAt` uses `SELECT DISTINCT` with this comment:
*"Two groups may grant the same role at the same node — legal … and a principal in both would
otherwise see the node twice."* **The `DISTINCT` cannot do that.** `g.grant_id` is in the select
list and is the primary key, so every row is already distinct and the clause collapses nothing — my
probe returned the node twice, through the same predicate. **Behaviourally harmless today** (`admits`
short-circuits; `findAuthorizingGrant` reduces), but it is a defensive measure that does not do what
it says. Reported, not fixed — read-only PID.

**Tests that count grants** (`grants.length` 0 or 1 at `:241`, `:266`, `:271`, `:294`, `:314`) are
per-principal totals over a single-grant fixture. None asserts an at-most-one *invariant*; they
assert that dating works. **And `:236` ends a grant with `UPDATE scope_grant SET effective_to = …`
run as the owner role** — the only ending in the codebase is a DBA act, which is the whole problem.

### The verdict you framed

**Rights are union and monotonic, so two overlapping identical grants add nothing. The exclusion is
HYGIENE, not SAFETY.**

**And the "bulk load" argument does not survive contact either.** I tested what the constraint
actually stops: a bulk load inserting a **brand-new live grant at an arbitrary node, with
`grant_administrator`, at an organization id that does not exist** — **accepted**. The exclusion
constrains only *duplicates within one key*. It has never stood between a bulk load and unauthorized
access; it stands between a bulk load and **ambiguous history**. That is worth something, but it is
not the thing its rationale implies, and losing it does not open an authorization hole.

## 3. Re-proposed shapes

**Your candidate is defective and I reached the same conclusion independently** before reading your
framing of it: an append-only end-record leaves the original grant's **asserted** range at `[t0, ∞)`,
and a legitimate re-grant at `[t2, ∞)` overlaps it. Confirmed by §2's first experiment, which is the
same collision from the other direction.

**And the obvious relaxation fails the same way.** Adding `version` to the exclusion key looks like
it works — instance `v1 [t0,∞)` and `v2 [t0,t1)` no longer collide. But a re-grant is a **new
instance whose first assertion is also version 1**, so `[t2,∞)` collides with the old instance's
`v1 [t0,∞)`. **Same root: the constraint sees asserted periods, not effective ones.**

**No declarative form survives the assertion model.** Every candidate needs "is this the latest
assertion" as a *stored* predicate, and storing it means a flag something must flip — an `UPDATE`,
which is what ADR-013 D2 abolished and what `pemo_app` cannot do. I looked for a narrower one and did
not find it; I record that as a search that failed, not as a proof that none exists.

### Shape A — assertion model, exclusion dropped, cardinality in the write path

`grant_id` becomes instance identity; `assertion_id` PK; `version`; `UNIQUE(grant_id, version)`;
`recorded_at`. The reader resolves latest-per-instance with **`latestAssertionSql()` — the shared
`GEN-015` resolver, already built for exactly this** — then applies the existing as-at predicate to
the surviving row's effective dates. Ending appends version 2 with `effective_to` set. Cross-instance
cardinality moves to the write path under **ADR-013 D5/C3**, whose framework says the mechanism is
ruled per invariant at each write PID — `GEN-016`'s advisory lock is the precedent.

**Re-grant after end:** a **new `grant_id`**, version 1, `effective_from = t2`. Nothing collides,
because nothing declarative is comparing ranges any more. **This is the case that kills every other
shape, and it is free here.**

**Cost, stated plainly:** the declarative guarantee is gone, and a bulk load can write an ambiguous
duplicate. Per §2 that is a hygiene loss, not an access one.

### Shape A′ — Shape A, plus a detector instead of a preventer

Shape A with a battery/CI case that queries for two live assertions sharing
`(group, role, node)` and reds. Not prevention, and it cannot stop a bad row from existing — but a
bulk load's ambiguity is **found** rather than sitting unread, which is the property `0112` actually
wanted. It is also the corpus's own pattern: `adrs-present` is a check, not a header field.

**I favour A′**, and the argument is §2: what the constraint protects is legibility of history, and
a detector protects legibility. What it never protected is authorization.

### Shape B — do not convert `scope_grant` at all

Keep the table and the exclusion exactly as they are, and accept that **ending a grant is not a
runtime operation** — `createGrant` ships, `endGrant` does not. Honest, small, and it retires *part*
of the DBA. **I do not recommend it**: a grant administration surface that can confer authority and
cannot withdraw it is worse than none, because the failure is silent and points the wrong way.

**Ruling sought: A′ versus A versus something in (c) I did not find.**

---

## 4. `platform.idempotency_record` — the mechanism that already existed

### Shape and key

```sql
CREATE TABLE platform.idempotency_record (
  scope            text        NOT NULL,
  idempotency_key  text        NOT NULL,
  outcome          jsonb       NOT NULL,
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, idempotency_key)
);
```

Migration **`0004`** — one of the earliest in the repository. It stores **the response body as
`jsonb`**, on the stated reasoning that *"'we have seen this key' is not enough information to answer
the second request correctly."*

**Against ADR-015 as accepted:** the key is `(scope, key)` where **D3 requires `(principal,
operation, key)`** — no principal at all, so one client's key can collide with another's. And it
stores a response blob where **D4 states none is stored and the response is re-derived by reading the
act.** The two are not variants of one design; they are opposite answers to the same question.

### Who uses it

**Nobody.** `createIdempotencyStore` is exported from `@pemo/platform`, constructed in
`wiring.ts:181`, and held on the modules object. **`server.ts` contains zero references** — no route
calls `once()`. There is also **no test**: nothing in `tests/` calls `once()` or
`createIdempotencyStore`, despite `platform-and-operations.test.ts` opening with *"Platform
Foundation behaviour: idempotency, …"*. The occupancy end test states the opposite in its own name:
*"a repeated end is NOT idempotent, and the contract says so."*

### Does it work today?

**Sequentially yes. Concurrently no — and concurrency is the case it was written for.** I drove the
compiled store against the dev database with a `compute` that takes 60ms, as a real act does:

```
--- SEQUENTIAL: the case the store was written for ---
  compute ran 1x  replayed=false/true  -> CORRECT
--- CONCURRENT: two simultaneous taps, the case the comment claims ---
  compute ran 2x  replayed=false/true
  the comment claims "two simultaneous taps still produce one effect": FALSE — 2 effects
```

**The defect is the order of operations.** `once()` checks for an existing row, then runs
`compute()`, then inserts `ON CONFLICT DO NOTHING`. Two concurrent callers both find nothing, **both
run the act**, and only then does one lose the insert race and read the winner's row. Both callers
receive one response; the world received two effects. The loser's own act is unrecorded and
unreturned — the worst of the three possible outcomes, because it is invisible.

**A second window, not exercised above:** `compute()` and the `INSERT` are in **different
transactions**. A crash between them leaves the act done and the key unwritten, so a retry runs it
again. That is precisely what **ADR-015 D2** requires the audited-write primitive to prevent by
putting act, audit and key in one transaction.

**So the shipped mechanism does not implement ADR-015, and it does not implement its own comment
either.** Its safe case is the sequential retry — a client timing out and retrying later — which is
real and common, but it is the easy half.

### For your reconciliation ruling

Three notes, no recommendation — this is yours:
- The table is **unused and untested**, so migrating or replacing it breaks no caller. The cost of
  change is close to zero, and it will not stay that way once a write is built against it.
- The **response-blob question is a genuine design disagreement**, not an oversight in `0004`:
  re-deriving a response by reading the act (D4) requires every operation's response to be derivable
  from its act, which is a real constraint on every future write.
- Whatever is decided, **one representation, not two** — the same rule A1 applies to attribution.
  Two idempotency mechanisms in one system is how the same question gets two answers.

**No write will be built against ADR-015 until you rule.**

---

## Housekeeping

The probe rows were removed (`probe rows left: 0`); the schema experiments ran inside transactions
that were rolled back; the probe script was written outside the repository and the worktree carries
only Step 1's four files. Battery unaffected.

## Rulings sought

1. **§3** — Shape A′ (my preference), A, or B.
2. **§4** — the ADR-015 reconciliation: amend the ADR, migrate the shipped shape, or hybrid.
3. **Noted for whoever fixes them** (not this PID): `0112`'s stale rationale and the test that
   repeats it; the no-op `DISTINCT`; the `index.ts` "nothing imports this package yet" banner.

**HARD STOP.**
