# GEN-029 — W3 batch 2, the ADR-013 C6 assessment. **HARD STOP before building.**

**The dispatch's own condition fired: this constraint protects something `scope_grant`'s did not.**
Reporting before building, as instructed. Nothing has been built.

---

## 0. FIRST — the pin does not exist, and batch 1 is still unmerged

The dispatch names *"origin/main after batch 1's close"*. **`origin/main` is `1a8af560` — `GEN-027`.**
Batch 1 (`GEN-028`) was built, proven and reported, then hard-stopped before commit; its 8 files are
still uncommitted here. **`GEN-028` needs its close before batch 2 can be built**, and I have not
built on the unmerged base.

(The batch-2 dispatch also arrived twice, identically. I read it once.)

`GEN-029` is allocated (`--next` → `029`).

---

## 1. Its own stated rationale, verbatim (`0115`)

```sql
  -- One person cannot hold the same membership twice over overlapping periods.
  -- Declarative, not a trigger: a trigger is bypassable by a bulk load, which is
  -- exactly how bad history arrives.
  CONSTRAINT group_membership_no_overlapping_periods
    EXCLUDE USING gist (
      group_id     WITH =,
      principal_id WITH =,
      tstzrange(effective_from, effective_to) WITH &&
    )
```

**AND IT IS ACCURATE — which is the first place this differs from `scope_grant`.** `0112`'s rationale
spoke of *"one principal … the same node"* while `0115` had re-keyed the constraint to the group, so
it described an invariant the schema no longer had. Here the stated claim — *one person cannot hold
the same membership twice over overlapping periods* — is **exactly** what
`(group_id, principal_id, range)` enforces. **The staleness finding does not transfer, and I checked
rather than assumed.**

## 2. What it actually stops — measured

**E1 — the constraint's own claim, fired:**
```
ERROR: conflicting key value violates exclusion constraint "group_membership_no_overlapping_periods"
```

**E2 — the same insert with the constraint dropped, then the reader's exact query:**
```
reader returns: 3 rows, 2 distinct grants
```

**One duplicate membership turned two grants into three rows.** That is the difference, and it is
structural: **membership sits on the JOIN side of the grant resolution, so it is a MULTIPLIER.**
`scope_grant`'s exclusion, dropped at `0118`, could only ever produce two *distinct* grants; this one,
dropped, produces the *same grant twice*.

## 3. Is it safety or hygiene? — hygiene for DECISIONS, but it carries a coupling

**No authorization decision changes.** All three readers are idempotent under row duplication:

| reader | behaviour with a duplicated row |
|---|---|
| `admits()` | returns on FIRST match — unaffected |
| `admitsUnassigned()` | `grants.length > 0` — monotonic |
| `findAuthorizingGrant` | collects all, reduces to narrowest with a `grantId` tie-break; the same grant compared with itself yields itself |

And the `/scope` response de-duplicates downstream: `nestedPreorder` builds a `Set` of node keys, so
a node cannot appear twice in the tree.

**So on the union-and-monotonic argument it is the same shape as `scope_grant`'s.** But:

### THE COUPLING — and it is with a decision I made at GEN-024

`GEN-024` **removed** `findGrantsAsAt`'s `SELECT DISTINCT`, on this reasoning, written into the file:

> *`g.grant_id` is in the select list and is the row identity, so every row was already distinct.*

**That was true only because this exclusion made a duplicate membership unwritable.** Drop the
exclusion and the premise is gone: two live membership instances for one `(group, principal)` become
writable for the first time, and the deduplication that would have collapsed them was deleted a PID
ago — on reasoning that this migration silently supplied.

**This is not a reason to keep the exclusion.** It is a reason the reapplication must carry one thing
`scope_grant`'s did not: **restore deduplication in `findGrantsAsAt`** — `DISTINCT ON (grant_id)`
after the join, or resolve membership to one row per `(group, principal)` before joining — with the
comment corrected to say why it is there *now*, rather than left carrying the reasoning that made it
removable *then*.

**The cost of not doing it:** one grant appearing twice in a principal's resolved scope; a duplicate
expansion round-trip per duplicated grant in `findAuthorizingGrant` (a performance effect, not a
correctness one); and — the part I care about — `scope.grants` ceasing to be a set, which is a
property later code will assume without checking.

## 4. My reading, for your ruling

**`A′` reapplies, but NOT cleanly** — it needs one addition:

1. assertion-shape `group_membership` on `0118`'s template (instance identity, `version`,
   `UNIQUE(instance, version)`, shared resolver, existing rows → version 1);
2. drop the exclusion **with a stated rationale**, and the rationale must say that this table is a
   join multiplier, which `scope_grant` was not;
3. **restore deduplication in `findGrantsAsAt`**, because the reason it was removed no longer holds;
4. hold the cardinality in the write path, plus a whole-table detector beside
   `live-grant-cardinality.sh`;
5. re-key the seed's `ON CONFLICT` to `(membership_id, version)` — **the third table**, anticipated
   rather than rediscovered.

**Item 3 is the one outside the ruled shape and the reason I stopped.**

**An alternative I considered and do not recommend:** keep the exclusion by making the *instance*
carry the range and the *assertions* carry only the version. It fails the same way every variant
failed at `GEN-024` — an instance's own history overlaps itself, and a re-join's first assertion is
version 1 again. I mention it so it is visibly closed rather than unexamined.

## 5. Rulings sought

1. **`GEN-028`'s close** — batch 2 cannot be built until it lands (§0).
2. **Item 3**: restore deduplication in `findGrantsAsAt` as part of this batch — confirm, or rule it
   into its own change.
3. Confirm the rest of `A′` reapplies as described.

**HARD STOP. Nothing built.**
