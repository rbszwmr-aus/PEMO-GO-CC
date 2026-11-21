# GEN-007 — Step 1: the exact omission, and one value that cannot be derived

**PID:** GEN-007 v1.0 · **Write scope:** the management-scenario seed file(s) omitting `serving_scope_label_*`. Read-only elsewhere.
**Status:** **HARD STOP.** Nothing changed. One decision in §4 is a product-content call and is not mine.

---

## 1. Pin

| | |
|---|---|
| **Pin (analysis)** | `3d879d9b52fef6d3e3dd5f92626678a74be6428b` / tree `2e6551342b00518ed378c4bf4db60332fbdc7959` / 751 files |
| **`main` now** | `d94cc4cccd42073d6f9375b69e164761abfdb992` — the GEN-007 allocation |
| **Number** | **007**, from `--next` over `pids/` + `archive/`. Next is 008 |

## 2. The exact path — and there are **two** files, not one

The PID says *"the file your GEN-006 run aborted on"*. That file is real, but it is not alone. Scanning every scenario for a row that sets `audience_source = 'serving_scope'` while never mentioning `serving_scope_label_en`:

| file | affected rows |
|---|---:|
| `database/seeds/scenarios/management__mob-s1-safety__default.sql` | **3** |
| `database/seeds/scenarios/management__mob-s1-safety__partial.sql` | **3** |

**Six rows across two files.** `pnpm run seed` aborts on the first row of the first file, which is why only one was visible. `__partial.sql` is not applied by `pnpm run seed` at all — only `__default.sql` files are — so it fails nowhere today and would fail the moment anything applied it.

I have written the PID's `write_scope` to cover *the file(s)*, and flag the discrepancy rather than silently widening or silently fixing only one. **Fixing only `__default.sql` would make `pnpm run seed` pass while leaving the F1 defect live in the file next to it** — the shape DOC-002 F2 already recorded, where a check passes because the broken thing is never executed.

## 3. The constraint, and why it is right

`database/migrations/0032_home_safety_events.up.sql:60-62`:

```sql
CONSTRAINT serving_scope_audience_is_explained
  CHECK (audience_source <> 'serving_scope'
         OR (serving_scope_label_en IS NOT NULL AND serving_scope_label_zh_hant IS NOT NULL))
```

Paired with `non_unit_location_uses_serving_scope` (`location_class = 'unit' OR audience_source = 'serving_scope'`), the two say: anything that is not a unit resolves its audience through serving scope, **and must state what that scope is**. The database is enforcing a rule the fixture validator enforces on fixtures, so the two cannot drift. **The seed is wrong; the constraint is not.**

## 4. What the six values should be — derived, not invented

The convention is visible in the scenarios that already do this correctly, e.g. `mob-09-safety-event-detail__common-area-event.sql:27-28`: a Block A lobby event carries `'All residents of Block A', 'A座全體住戶'`. The label names **the audience the location serves**, in the resident's own words.

The six rows fall into three groups, and only the first two can be derived:

**(a) Two rows whose location has a declared serving scope.** `database/seeds/11-property-locations.sql:66-68` states it, with the comment *"The clubhouse sits in Block C and serves the WHOLE ESTATE"*:

```
('loc_wfg_clubhouse',     'estate', 'est_wing_fu_garden'),
('loc_wfg_function_room', 'estate', 'est_wing_fu_garden'),
```

| row | location | declared serving scope | proposed label |
|---|---|---|---|
| `__default` Wing Fu Clubhouse | `loc_wfg_clubhouse` | estate | `All residents of Wing Fu Garden` / `榮富花園全體住戶` |
| `__partial` Function room | `loc_wfg_function_room` | estate | `All residents of Wing Fu Garden` / `榮富花園全體住戶` |

Derived from the property model, which is the authority for what a Location serves.

**(b) Three rows with `source_location_id = NULL`.** These are common-area events carrying no Location id at all, so the property model has nothing to say; the audience follows the event's own `location_label`:

| row | location label | proposed label |
|---|---|---|
| `__default` Block A | `Block A` / `A座` | `All residents of Block A` / `A座全體住戶` |
| `__partial` Block A | `Block A` / `A座` | `All residents of Block A` / `A座全體住戶` |
| `__partial` Wing Fu Garden | `Wing Fu Garden` / `榮富花園` | `All residents of Wing Fu Garden` / `榮富花園全體住戶` |

The Block A wording is taken verbatim from the existing correct scenario rather than composed afresh.

**(c) One row that cannot be derived, and this is the decision I am not taking.** `__default.sql`, event labelled `Location being confirmed` / `位置確認中`, `source_location_id = 'loc_unmapped'`. That id **is not in the property model at all** — verified, zero occurrences in `11-property-locations.sql` — which is deliberate: it is ADR-006's unmapped-node case, an event that arrived before anyone could say where it happened.

So there is no serving scope to name, and the constraint still requires a label. The options are not equivalent:

- It cannot drop to `audience_source = 'unit'` — `non_unit_location_uses_serving_scope` forbids that for a `common_area`.
- A label naming a **real** audience (`All residents of Wing Fu Garden`) would assert an audience nobody has established, on a safety event, from an unmapped source. That is the shape ADR-006 and the resident-mobile rule both refuse: *a sensor that is not reporting is shown as unknown, never as normal.*
- A label naming the **unknown** — e.g. `Audience being confirmed` / `受影響範圍確認中`, matching the row's own `Location being confirmed` / `位置確認中` — states the honest position and mirrors wording already in the row.

**I propose the third and will not take it myself:** it is resident-facing product copy on a safety surface, and inventing it is a product decision, not a derivation. If the Brain prefers different wording, or prefers that this event should not be in the management fixture in this state at all, that is the ruling I need.

## 5. Blast radius: none outside Home Safety

`serving_scope_label_*` is read in exactly one place — `modules/home-safety/src/events/event-queries.ts:29-31`, which maps it to `servingScopeLabel` and yields `undefined` when either side is null. **No management projection reads it.** The management fixture for the affected event carries keys `communication, eventId, needsAction, occurredAt, reference, scope, scopeSummary, severity, source, title` — **no audience or serving-scope field at all** — so adding the columns changes nothing the management surface renders, and fixture parity for `mob-s1-safety` is unaffected.

## 6. Gaps — this list is complete

1. **Nothing changed.** No seed file touched.
2. **Done-when 2 is not yet demonstrable.** The suite currently reaches 166/0 only with `mob-*__default.sql` applied by hand. Whether removing the abort is *sufficient* — whether the defaults then apply cleanly in `seed`'s own ordering — is unproven until Step 2 runs it.
3. **`__partial.sql` is applied by nothing today.** Fixing it is correct but its correctness will not be exercised by `pnpm run seed`; it is proven only by applying the file directly. I will do that and say so, rather than let a fixed-but-unexercised file read as verified.
4. **§4(c) is unresolved** and blocks Step 2's edit of that one row.
5. **I did not verify the `zh-Hant` wording with a native reader.** `榮富花園全體住戶` follows the existing `A座全體住戶` pattern by substitution. It is resident-facing copy; if the register wants it checked, that is a separate gate.

## 7. What the Brain is asked to rule

1. **§2** — confirm both files are in scope. Fixing one leaves the defect live in the other.
2. **§4(c)** — the label for the unmapped-location event: `Audience being confirmed` / `受影響範圍確認中`, other wording, or a different treatment of that row.
3. **§4(a)/(b)** — confirm the derived labels, particularly reusing `All residents of Block A` / `A座全體住戶` verbatim.

**HARD STOP.**
