# GEN-026 — W1d: the authority-bearing source becomes `principal`

**Status:** built, all green. **NOT COMMITTED. HARD STOP.**
**Pin:** `0310b97861418d8c9c3c37e80d82716be3ed8217`, re-read from the remote at build start —
identical to HEAD. **`GEN-026` allocated from the directory scan.**

Small and mechanical, as dispatched. One finding, and it is about my own method rather than the code.

---

## THE MEASUREMENT — "the cheapest moment" is observed, not assumed

```
audit_event total rows:  0
of which source=staff:   0
seeds writing the table: none   (nothing under database/seeds/ names audit_event)
```

**Zero.** So `UPDATE access.audit_event SET source = 'principal' WHERE source = 'staff'` changed
nothing today. **The statement is in the migration anyway** — it is correct for any database that
does hold rows, and a rename that only works on an empty table is not a rename.

The window is genuinely narrow: the table exists to be a complete, immutable record, so the first
audited act turns this from a no-op into a data migration over exactly the rows one must never
rewrite carelessly.

## Built — `0121_access_audit_source_principal`

A **new** migration. `0119` is merged and was not touched — `GEN-025` established that the hard way
when a comment-only edit tripped the runner's immutability check, which is the rule working.

Order: **data first**, while the old CHECK still permits it; then the vocabulary. The biconditional
names the value, so it is dropped and re-created — and **renamed with it**, to
`audit_event_authority_only_when_principal`. A constraint called `..._only_when_staff` over a
vocabulary containing no `staff` would be a name contradicting its own contents: the stale-comment
shape this corpus keeps catching, hidden in an identifier where it is harder to notice.

**The spelling is unchanged and the migration says why** — `num_nonnulls(...) = CASE ...` rather than
the conjoined form, because the obvious version reads *"NOT (all three present)"* for a non-principal
source and therefore permits one or two. Proven again below under the new name.

**The down migration refuses when a non-staff principal has acted** — the whole point of the rename
is that `principal` covers actors `staff` does not, so reversing would relabel a resident's act with
an audience it does not belong to, in the record that exists to be truthful.

## The call sites — the compiler enumerated them, as before

Narrowing `AuditSource` reddened exactly four sites in `server.ts`, each updated with its comment
rewritten into the new vocabulary. **No default was introduced**, so an act with no actor still
cannot inherit an attribution by omission.

## THE FINDING — my own search hid a site from me

After updating the four call sites I checked for leftovers with:

```
grep -rn "'staff'" ... | grep -v estate_staff
```

and it reported none. **It was wrong.** `harness-isolation.test.ts:33` contained both `'staff'` (the
source) and `'estate_staff'` (the role) **on one line**, so the exclusion filter discarded the line
along with the match I was looking for. The suite caught it — one red — but my *search* had already
told me the work was finished.

The corpus already carries `[anchor-the-discriminator]` for unanchored substring classifiers. This is
the same defect one step earlier: **a line-based exclusion filter discards the whole line, so an
exclusion can hide a genuine hit that shares a line with an excluded one.** I re-ran without the
filter and read the two remaining matches, which are the migration's own `UPDATE` and the down
migration — both correct.

**I have not added a principle.** The dispatch scopes the principles basket to nothing this PID, and
`[anchor-the-discriminator]` may already cover it. Flagging it for the note that rides `W2`.

## Proof

| claim | evidence |
|---|---|
| a `principal` act with **no authority** → refused | ✔ `audit_event_authority_only_when_principal` |
| a **non-`principal`** act carrying authority → refused | ✔ provisioning-with-fabricated-principal, and integration-with-authority, both |
| partial attribution still caught | ✔ **mutation re-run under the new name**: the obvious spelling reds exactly the one test written for it (`273 pass, 1 fail`) |
| the biconditional is load-bearing | ✔ **dropped entirely → four reds** (`269 pass, 5 fail`) |
| applies on a **database rebuilt from nothing** | ✔ 38 migrations, seeded, then the full gate |
| down migration | refuses with a non-staff principal recorded; clean reversal succeeds |
| suite | contract **105/105**, integration **274/274** |
| battery / boundaries / validator / index | **24/24** zero skips · PASS · PASS · OK |

Test counts are unchanged, which is the right outcome for a rename: no behaviour moved, so no new
case was needed.

## Weight

Two migration files (**82 lines**, of which about half is the rationale), one type literal, four call
sites, five test files touched for the value and the constraint name. **No new tests, no logic
changed.**

## Gaps — complete

1. **`role` is untouched.** A resident act would still need a `resident` role value, which the CHECK
   already declares — but no code path produces one, so the rename is forward-looking, not enabling.
2. **`integration` remains unused** — no integration act is audited yet, so that branch of the
   vocabulary is declared and unexercised except by tests.
3. **The line-filter defect above** is recorded here only.

## Housekeeping

Every schema mutation restored and re-verified from the catalog; the database was rebuilt from
nothing and re-gated afterwards. No production or staging database was contacted.

**HARD STOP. Nothing committed.**
