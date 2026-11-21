# GEN-024 — W1a: the authority table takes the assertion model

**Status:** built, everything green. **NOT COMMITTED. HARD STOP.**
**Pin:** `bc0d924e2f1fd3529e1a0d20734dc4101fa7d843`, re-read from the remote at build start — identical
to our HEAD. **`GEN-024` allocated from the directory scan** (`--next` → `024`).

**Headline:** revocation works. And the finding worth more than the feature: **my concurrency test
passed with the advisory lock deleted.** It was measuring sequential execution, not a race. Caught
only because I mutated the lock away and looked — the test now bites, and the reason it did not is
recorded in the test itself.

---

## 1. Green

| gate | result |
|---|---|
| contract suite | **105 / 105** |
| integration suite | **252 / 252** (was 242 — **+10 new**) |
| battery | **24 / 24**, zero skips (was 23; the detector is the 24th) |
| boundaries | PASS, all four layers |
| validator | PASS |
| index | OK, next allocation 025 |

## 2. THE FINDING — a race that was not racing

The dispatch asked for the guard to be proven by removing the lock. I removed it, and the test
**still passed**:

```
=== MUTATION — lock removed ===
probe on disk: lock calls left = 0 (want 0)
✔ CONCURRENT creates for one key: exactly one wins        ← WRONG. It should have failed.
```

`Promise.all` over two pools is **not** enough. Each `confer` is a few milliseconds, so the first
transaction **commits before the second one reads**, and the second then correctly sees the winner's
row and refuses — with or without a lock. The test was asserting that sequential execution produces
one row, which is true of anything.

`GEN-016` had already solved this and I did not carry it over: it holds the transaction open with a
`setTimeout` **inside** the callback, forcing the interleaving. With that line added, both directions
are real:

```
A) lock present:   ✔ CONCURRENT creates for one key: exactly one wins        252 pass, 0 fail
B) lock removed:   ✖ CONCURRENT creates for one key: exactly one wins        251 pass, 1 fail
     got [{"kind":"conferred","grantId":"gr_w1a_race_a","version":1},
          {"kind":"conferred","grantId":"gr_w1a_race_b","version":1}]
```

Both conferred — two live grants for one key, which is exactly the state 0118 made writable and the
guard exists to prevent. The comment on that line now says it is load-bearing and why, because the
next person to tidy a `setTimeout` out of a test will otherwise silently disarm this.

**This is `[probe-must-bite]` turned on my own test rather than on a check.** The mutation was the
only thing that could distinguish "the guard works" from "the test cannot tell".

## 3. What was built

### The migration — `0118_access_scope_grant_assertions`

`grant_id` becomes the **instance** identity; `assertion_id` is the new primary key; `version`,
`recorded_at`; `UNIQUE (grant_id, version)`; `CHECK (version >= 1)`; a `(grant_id, version DESC)`
index. Backfill is explicit and **derived** (`'sgra_' || grant_id`), so a re-run produces identical
rows. Defaults exist so the seeds keep working, per `0117`. Verified against the live catalog: 8 rows,
all version 1, all with the derived id.

**The dropped constraint carries the full statement, and `0115`'s omission is not repeated.** The
migration quotes `0112`'s rationale verbatim, then records what `GEN-023` measured against it: the
claimed invariant (*one principal, one node, one period*) **has been false since `0115` re-keyed to
`(group, role, node)`**; the constraint never constrained a brand-new grant at an arbitrary node, so
it never stood between a bulk load and unauthorized access; and no reader depends on at-most-one. It
states why no declarative form survives — including that adding `version` to the key fails, because a
re-grant's first assertion is also version 1 — and then states the trade plainly:

> **GIVEN UP** write-time prevention of ambiguous history, declaratively.
> **REPLACED BY** write-path prevention (advisory lock) **+ whole-table detection** (the battery).
> **BOUGHT** the ability to revoke authority at all.
>
> (a) is bypassable by a bulk load in the way `0112` warned about. (b) is not. Prevention becomes
> detection for the bulk-load case — the ambiguity is **found** rather than forbidden. That is a real
> reduction and it is stated rather than glossed.

**The down migration refuses once a revocation exists**, and both branches are proven:

```
A) clean data:            down applied; exclusion restored: 1
B) one revocation present: ERROR: REFUSING to reverse 0118: 1 grant instance(s) hold more than
                           one assertion ... on this table a superseding assertion is a REVOCATION,
                           so the reversal would silently restore authority that was withdrawn.
```

### The reader — `findGrantsAsAt`

Resolves through **`latestAssertionSql`**, `GEN-015`'s shared resolver, not a re-derivation. The
resolver runs **before** the as-at predicate, because `effective_to` changes between assertions and
filtering on it first would discard the very revocation that supersedes. The group restriction is
pushed into the resolver's filter because `group_id` is stable across an instance's assertions.

**The `DISTINCT` is gone, not reworded.** It claimed to stop a principal "seeing the node twice" and
could not: `grant_id` is in the select list and is the row identity, so it collapsed nothing. The
comment now distinguishes the two deduplications — across instances is **not** deduplicated
(ADR-012 D5, both grants authorize) and within an instance **is** (ADR-013 D4).

### The guard — `modules/access/src/repository/grant-commands.ts`

`confer` (first assertion) and `revoke` (append version+1), both taking the caller's `tx`. The guard
asserts `SHOW transaction_isolation = 'read committed'` and then takes
`pg_advisory_xact_lock` on `(group, role, node)`, **with the conflict check inside the act** — the
`GEN-016` relocation, not the `GEN-013` shape.

**The key never mentions a principal**, so the guard cannot grow into forbidding ADR-012 D5. That is
asserted, not just intended (§4).

### The detector — `docs/governance/bin/live-grant-cardinality.sh`, battery case 24

Resolves latest-then-evaluates (in that order, with the reason written down — filtering on
`effective_to` first would count a revoked grant as live, reproducing the bug inside its own
detector), then reds on any `(group, role, node)` with more than one live grant. It carries a
**vacuity refusal**: an empty `scope_grant` fails rather than passing for want of anything to look at.

## 4. Proof — each by making it fail

| claim | evidence |
|---|---|
| **Reads preserved** | 105 + 252, zero failures |
| **Runtime still cannot UPDATE** | asserted as a test, not recited — if it ever becomes true the design rests on a moved premise |
| **REVOCATION works** | version 2 appended; `versions='1,2'`; version 1 **still asserts an open period, untouched**; resolver answers not-live; **and the historical question still answers** — it was in force in 2025 |
| **…and the resolution is what does it** | the pre-0118 raw-table read **does** return the revoked grant as live; the resolver does not. The two disagreeing is the point |
| **RE-GRANT AFTER END** | a new `grant_id` at version 1 for **the same key** — accepted. The case that killed every other shape |
| **Guard refuses** | second live grant for one key → `conflict`, and the refused act wrote **zero** rows |
| **Guard bites** | §2 — lock removed, both conferred |
| **Detector bites** | duplicate created → `FAIL ... grp_of_one_stf_wfg_manager / estate_staff / estate:est_wing_fu_garden -> 2 live grants`; removed → `ok` |
| **Detector does not over-reach** | two **different** groups, same role, same node → stays green (`9 grant assertions scanned`) |
| **Multiplicity by design** | both at the DB level (new test: the reader returns **2** grants from 2 groups) and through the guard (`confer` for a second group is accepted) |
| **Down migration** | both branches, above |
| **Revoke twice** | refused `not-live`, and the chain still holds exactly 2 rows — no no-op assertion |

## 5. Two things I had to touch that the write-scope did not name

Both are consequences of the ruled change, not scope I chose. **Disclosed, not folded in silently.**

1. **`database/seeds/40-access-staff-and-grants.sql`** — the seed's `ON CONFLICT (grant_id)` no longer
   matches any constraint once `grant_id` stops being unique, so `bootstrap --with-seed` failed with
   *"there is no unique or exclusion constraint matching the ON CONFLICT specification"* and the
   battery caught it (`seed did not complete`). Retargeted to `(grant_id, version)` — the seed's rows
   are all version 1, so its idempotency is unchanged. **7 lines.**
2. **A second stale test** at `access-scope-model.test.ts:429`, the ADR-010 D4 case, whose *second
   half* also asserted `scope_grant_no_overlapping_periods`. The dispatch named `:298`; this one has
   the same defect from the same cause. Rewritten to assert what the schema still guarantees (`role`
   is in the key), with a pointer to where live-cardinality is now proven.

I also corrected `modules/access/src/index.ts`'s banner, which read *"Nothing imports this package
yet"* while five modules did — reported in Step 1, fixed here because this PID was editing that file
anyway. Say the word if you would rather it had waited.

## 6. Weight

| | |
|---|---|
| new files | migration up/down (149 + 44), `grant-commands.ts` (278), the detector (117), the test file (283) |
| edited | `access-repository.ts` +51−, `index.ts` +36−, `access-scope-model.test.ts` +107−, `prove.sh` +14, the seed +7 |
| net | **≈ 870 new lines, 184 insertions across 5 existing files** |

Heavy for one table, and I think honestly so: roughly half the migration is the rationale you asked
to be stated rather than omitted, and a third of the test file is the two RED cases.

## 7. Gaps — complete

1. **`confer` is authorized by nothing.** G-2 (ADR-010 D3) is not enforced in this module and is
   stated as absent in the file header, because the next person to wire a route to it must not
   discover that by accident. W2.
2. **The advisory lock is bypassable by a bulk load** — the detector is the answer, and it is
   detection, not prevention. Stated in the migration.
3. **The detector runs at battery time, not continuously.** A duplicate written after a run lives
   until the next one.
4. **`revoke` takes no reason** — `reason_code` does not exist yet (W1b/ADR-014). A revocation of
   authority with no recorded reason is exactly the audit gap ADR-014 was written for, and it lands
   next.
5. **No idempotency stance declared** on `confer`/`revoke` — ADR-015 D1 requires one, and W1c rules
   the reconciliation first. These operations will need declaring when the check exists.
6. **`GEN-023` is still open and its ADR carry-in is uncommitted** (§8).

## 8. A commit-ordering question for you

`GEN-023`'s Step 1 work — the `ADR-014` / `ADR-015` carry-in and its own PID file — **is still
uncommitted in this worktree**, because `GEN-023` hard-stopped before commit and was never closed.
`GEN-024`'s deliverable sits on top of it. So a commit now either carries both, or I split them into
two commits with `GEN-023`'s carry-in first.

**I have not chosen.** My preference is two commits — the carry-in is a clean self-contained unit and
`GEN-023` deserves its own close — but `GEN-023` has no Step 2 and the Rule-7 close for it is yours
to direct.

## 9. Housekeeping

Test residue: `gr_w1a_*` rows remaining = **0** (prefix-scoped teardown, deliberately not a
whole-table clear — the `GEN-014` defect). Schema experiments ran in rolled-back transactions. The
mutation was restored **byte-identically**, verified with `cmp`, both times.

**HARD STOP. Nothing committed.**
