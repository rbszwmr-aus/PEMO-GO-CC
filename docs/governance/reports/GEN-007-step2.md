# GEN-007 — Step 2: the seed reproduces from nothing

**PID:** GEN-007 v1.0 · **Pin:** `d94cc4cc` · **Write scope:** the two management-scenario seed files. Read-only elsewhere.
**Status:** **HARD STOP before commit.** Nothing staged. Two files changed, both in scope.

---

## 1. Done-when 1 — proven by running, both halves

**Pre-fix, from nothing:**

```
migrate "applied":32
seed exit=1
  "message":"base seeds applied"
  error: new row for relation "safety_event" violates check constraint
         "serving_scope_audience_is_explained"
```

And the cost, measured rather than described — after the abort:

```
dev_scaffold rows:      0
home_safety.safety_event rows: 0
```

**The entire scenario layer never ran.** All ten base seeds applied, then the first management scenario killed the process, and every `mob-*__default.sql` after it — every screen's content, every safety event — was never reached. That is the partial world that produced GEN-006's `163/7` false alarm, reproduced here on purpose.

**Post-fix, from nothing:**

```
migrate "applied":32
seed exit=0
  "message":"base seeds applied"
  "message":"default scenarios applied"
dev_scaffold rows:      5
home_safety.safety_event rows: 7
```

## 2. Done-when 2 — the suite from `pnpm run seed` alone

No manual `mob-*__default.sql` application anywhere in the sequence: `migrate`, `seed`, run.

```
integration  exit=0   166 pass / 0 fail
contract     exit=0   105 pass / 0 fail
differential: 7 principals × 1217 nodes = 8519 comparisons, zero disagreements
```

The 166/0 world is now reachable by the documented commands. The condition that made a passing change look like a failing one is gone at the source.

## 3. The six values as written

Both files, three rows each.

| file | event | location | label | basis |
|---|---|---|---|---|
| `__default` | Wing Fu Clubhouse | `loc_wfg_clubhouse` | `All residents of Wing Fu Garden` / `榮富花園全體住戶` | declared serving scope |
| `__default` | Block A | `NULL` | `All residents of Block A` / `A座全體住戶` | verbatim carry |
| `__default` | Location being confirmed | `loc_unmapped` | `Audience being confirmed` / `受影響範圍確認中` | **shape locked, wording flagged to the PO** |
| `__partial` | Block A | `NULL` | `All residents of Block A` / `A座全體住戶` | verbatim carry |
| `__partial` | Wing Fu Garden | `NULL` | `All residents of Wing Fu Garden` / `榮富花園全體住戶` | estate-labelled common area |
| `__partial` | Function room | `loc_wfg_function_room` | `All residents of Wing Fu Garden` / `榮富花園全體住戶` | declared serving scope |

Each row carries a one-line comment naming **why that value**, so the next reader sees a derivation rather than a string. The Group-3 row's comment says what it is:

```sql
'serving_scope',
-- ADR-006 unmapped source: NO real audience may be named — shape locked, wording flagged to the PO
'Audience being confirmed', '受影響範圍確認中',
NULL, 'loc_unmapped',
```

## 4. `__partial` applied directly — and what runs it: **nothing**

Applied by hand, since no path does it: **exit 0**, its three events present with their labels. The fix works.

**And the orphan status, as ruled.** Traced through every candidate:

- **The seed CLI** (`apps/api/src/cli/seed.ts:58`) globs `*__default.sql`. `__partial`, `__empty` and `__resolved` are never touched.
- **The test harness** `applyScenario(screen, state)` is called in seven suites and **never once with a `management*` screen** — every call is `mob-02`, `mob-03`, `mob-08`, `mob-09`, `mob-11`. `fixture-parity.test.ts:95` looks general, but its screen table (`:28-41`) is resident-mobile operations only.
- **The manifest declares the binding.** `tests/fixtures/management-web/index.json:46`:
  `{"screen": "mob-s1-safety", "state": "partial", "file": "mob-s1-safety/partial.json", "scenario": "scenarios/management__mob-s1-safety__partial.sql"}`

So: **not dead — latent.** The binding is declared and nothing consumes it. All four management scenario files are in this state, and `__default` runs only because the seed CLI matches it **by filename pattern**, not because anything reads the manifest that names it.

**This is DOC-002 F2 restated one layer out.** F2 found that `scenario-inventory.test.ts` checks these files are *present*, never that they *apply* — which is how F1 survived. The wider fact is that the management fixture manifest declares scenario bindings that **no runner executes**, so a management scenario can be wrong in any way at all and nothing will say so. F1 was the instance that happened to also break `seed`.

**Not mine to resolve here** — removal or wiring is a separate decision, and the write scope is these two files. Named so a fixed-but-unexercised file does not sit reading as verified.

## 5. Gaps — this list is complete

1. **Nothing committed.** Two files changed: `management__mob-s1-safety__default.sql`, `__partial.sql`.
2. **`__empty.sql` and `__resolved.sql` were not inspected for this defect class.** They carry no `serving_scope` row lacking a label — that was the scan's criterion and they did not match — but I did not apply them, so their correctness in any other respect is unverified. They are latent by the same mechanism as `__partial`.
3. **The Group-3 wording is a placeholder.** Shape locked; `Audience being confirmed` / `受影響範圍確認中` awaits the PO. It is a fixture value, changeable without a migration.
4. **`zh-Hant` copy is unreviewed by a native reader.** `榮富花園全體住戶` follows `A座全體住戶` by substitution; `受影響範圍確認中` is composed to mirror `位置確認中`.
5. **No test asserts the seed reproduces from nothing.** Done-when 1 was proven by running it here, and nothing in the suite would catch a regression — the next PID to break a scenario seed learns about it the same way GEN-003 and GEN-006 did. A guard belongs in the battery; that is outside this write scope.
6. **§4's finding is unowned.** The management manifest declares bindings nothing executes.

## 6. What the Brain is asked to rule

1. **Release the commit.**
2. **§4** — the management scenario files are latent, not dead: wire a runner, or remove the declared bindings. A new PID.
3. **Gap 5** — a battery case asserting `migrate` + `seed` from nothing completes, so this class cannot recur silently.
4. **Gap 3** — the PO's wording for the Group-3 row.

**HARD STOP.**
