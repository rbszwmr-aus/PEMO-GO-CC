# GEN-020 — C2 batch B: test-harness isolation

**Status:** built, proven, **NOT COMMITTED. HARD STOP.**
**Headline:** the three-times bite is fixed, and **the fix is wider than the brief because the hazard is** — `scope_grant` and `group_membership` reference `user_group` too, and the seeds clear them only by prefix, so a test-created grant pins reseed exactly as an audit row does. Both halves of the blocker set are **derived**, never listed.

---

## 1. Pin and state

| | |
|---|---|
| **Pin** | `2532a4558c07571c8972a569e92b7b87e4d4c20a`, re-read from the remote and equal to HEAD at build start, tree `19e75187…`, 861 files |
| **`main` now** | `a205e76765b7d46382b6f0649facb16a40585f83` — the allocation only. **Deliverable uncommitted.** |
| **Green** | suite **347** (105 + 242, was 343) · battery **22/22** · boundaries PASS · validator PASS · index OK |

**Exact paths touched:** `apps/api/src/testing/harness.ts` and the new `tests/integration/harness-isolation.test.ts`. **No seed file needed changing** — see §2.

## 2. The reseed fix

`reseed()` now clears the rows that would block the seeds' own `DELETE`s, before applying them.

**Both halves are derived, and that is the point.** A hand-written list of "tables to clear first" is correct only for the schema it was written against — the frozen-axis failure — and this is a defect that already bit three times with nobody maintaining a list.

- **The blocked tables** are parsed out of the seed files themselves (`DELETE FROM <schema>.<table>`), so a seed that starts clearing a new table is covered the same day.
- **The blocking tables** come from `pg_constraint`, so a new table with a foreign key into a seeded one is covered the moment it exists.

**The brief named `audit_event`; the catalogue named three.** `access.scope_grant` and `access.group_membership` also reference `access.user_group`, and `40-access-staff-and-grants.sql` clears them only by **prefix** (`grant_seed_%`, `mem_%`) — so a grant a test leaves behind after an aborted run pins the seed exactly as an audit row does. All dependents are cleared in full: each is either re-seeded immediately afterwards, or (the audit) is a test artifact that was never part of the base world. `pg_constraint` confirms none of them references another, so no ordering is required — and the comment says where that would surface if it ever changed.

**No seed file was edited.** The write scope allowed it; the fix belongs in the harness, because the seeds are correct — it is the harness that was leaving rows behind.

**A vacuity guard**: if the seed parse yields no `DELETE` target the harness throws, because an empty parse would clear nothing and silently restore the breakage.

## 3. The prefix guard

`assertTeardownPrefixIsScoped(admin, table, column, prefix)` in the harness, with the convention documented beside it: a teardown prefix must be one no seed can produce — in practice one carrying the owning PID, or a shape the seeds never mint.

**It answers against the real seeded data**, not a remembered list of seed ids, so it cannot go stale when the seeds change. **The twelve existing teardowns are untouched**, as instructed — all were checked at `GEN-018` Step 1 and are already scoped; this is prophylaxis for the thirteenth.

## 4. Proof — each by making it fail

| | |
|---|---|
| an audit row pinning a seeded group, then `reseed()` | ✔ green, **and** the seeded groups survive — the fix clears the blocker, not the seeds |
| a test-created **grant** pinning a seeded group | ✔ green, and the grant is gone — the derived set covers what the brief did not name |
| `ctc_` (GEN-014's actual mistake) | ✔ refused, naming the seeded ids it would have taken |
| `ctc_gen020_`, `grp_gen020_` | ✔ accepted; `grp_` refused, because the seeds mint it |

**Mutations — each red for its own reason, confirmed in `dist`:**

| mutation | result |
|---|---|
| **M1** remove `clearSeedBlockers()` from `reseed` | ✖ 3 tests — **the foreign-key breakage returns**, which is the 3× bite reproduced |
| **M2** make the seed parse match nothing | ✖ all 5 — the vacuity guard throws rather than clearing nothing quietly |
| **M3** make the prefix guard never refuse | ✖ 2 tests — `Missing expected rejection: a colliding prefix was accepted` |

**Each probe was verified to bite** (`[probe-must-bite]`, defined last PID): the pinning probe asserts the row it planted actually exists before calling `reseed`, and the prefix probes assert a seeded id with that prefix is really present before expecting a refusal. Both premises would otherwise have been assumed.

**The blast-radius check:** the full suite went **343 → 347** with no failures. `reseed()` is every integration test's entry point and 13 files delete through it, so an unmoved suite is the assertion that mattered most here.

## 5. Weight

**Two files** — `harness.ts` (+~80 lines, the derived clear and the guard) and one new test file. No seed change, no schema, no contract, no code path outside the harness.

**Lighter than expected, and the reason is worth recording**: the diagnosis had already been done at `GEN-018` Step 1, precisely — down to the seed file and line number and the exact foreign key. Building against a finished diagnosis took a fraction of the time the diagnosis did.

## 6. Gaps — this list is complete

1. **`clearSeedBlockers` deletes whole tables.** That is correct for the four dependents today (three re-seeded, one a test artifact), but it is a blunt instrument: a future dependent holding data the seeds do *not* restore would be silently emptied on every reseed. The derivation would find it; the wholesale delete would then be wrong for it.
2. **The prefix guard is opt-in.** Nothing makes a test call it, so the thirteenth teardown is protected only if its author remembers — the same shape as the ADR header field that could not notice a missing file. A standing check would need to parse teardown SQL out of test files, which is a larger and less certain thing than this PID should attempt.
3. **`[teardown-isolation]` is not cited by the new test file** in the `` `[slug]` `` form — I referred to it in prose. Citing it would have been the natural thing; I avoided it only because a citation inside a test file is a new location for the citation checker and I did not want to widen that surface in a batch that lands alone.
4. **I did not re-verify the twelve existing teardowns** — I relied on `GEN-018` Step 1's check of them, which was thorough but is now two PIDs old and predates GEN-019's and GEN-020's own new test files.
5. **The seed parse is a regex over SQL.** A `DELETE FROM` inside a comment or a string literal would be picked up as a target; none exists today, and the consequence would be an extra harmless table in the dependent lookup rather than a missed one.

## 7. Rulings sought

1. **§6.2** — is the opt-in guard enough, or is a standing teardown check owed?
2. **§6.4** — re-verify the twelve, or accept `GEN-018`'s check?
3. **Commit** — nothing beyond the allocation is committed.

**HARD STOP.**
