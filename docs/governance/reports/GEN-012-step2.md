# GEN-012 — Step 2: the principle carry and the role-model premise

**Status:** built, proven, **NOT COMMITTED. HARD STOP before the deliverable commit.**
**Headline:** the five carried principles each appear exactly once, proven by dropping one *and* by duplicating one. `grants-complete.sh` now asserts the role model it had been assuming since GEN-010 — six reds fired, one per declared attribute plus ownership plus the derivation itself.

---

## 1. Pin

| | |
|---|---|
| **Allocation commit** | `08ef92584b28add666bb2a027b132d0e2c7b3ff5`, pushed and re-read from the remote — `origin/main`, tree `e9216242…` |
| **Deliverable** | uncommitted; nothing beyond the allocation has been pushed |
| **Green** | battery **21/21** · integration+contract **299** (105 + 194), 0 failures · boundaries `PASS` · validator PASS · index `--check` OK |

## 2. Part 1 — the carry

Five carried, one of them an **amendment** rather than a new line:

1. **Principle 43's ordering clause**, appended to the existing destructive-target principle: the confirmation must be a pure-configuration check running **before anything reaches the network**, because a guard downstream of a reachability probe is bypassable — a wrong target that happens to be unreachable short-circuits into a skip and the guard never executes. Carries GEN-008's tell: both reds "fired" green and neither refusal message ever appeared.
2. **Fixtures are owner work** — a test performing setup or teardown through the application credential cannot distinguish *"the app is forbidden this"* from *"my fixture could not run"*.
3. **Its corollary** — a negative probe on the app credential passes on the **permission wall**, not on the constraint it means to prove, so the constraint is untested and the assertion passes for the wrong reason.
4. **A record written in a different transaction from the act it attests can assert a falsehood** — not absence but confident wrongness, which is worse, because an audit that is merely missing is visibly missing.
5. **A green suite is worthless if reintroducing the defect keeps it green, and the reintroduced failure must land in the actual hazard window** — a mutation test in the wrong window is an empty oracle with extra steps.
6. **Git tracking is not existence** — carried at the general level as ruled, with **both** directions it has bitten: an *ignored* file is visible to `readdir` and invisible to `git status` (GEN-001), and an *untracked* migration is invisible in a diff and fully visible to the migration runner, which reads the directory (GEN-011's `0116`, found through a table count that came out one short).

### Proven by making it fail

The reconciliation ran over **21** marked principles — the 15 already carried plus the 6 above — asserting each appears **exactly once**, count rather than presence, so a duplicated carry is a fault too.

```
RECONCILED — all 21 present exactly once            exit 0

RED 1  drop `Fixture setup and teardown are owner work`
       17 fixtures are owner work        *** 0 — expected exactly 1 ***      exit 1
RED 2  duplicate `Git tracking is not existence`
       21 git tracking is not existence  *** 2 — expected exactly 1 ***      exit 1

restored — identical to snapshot, RECONCILED again
```

**The instrument is deliberately not committed.** You ruled that a standing reconciliation keyed on wording would make every future reword a false "missing" — the cry-wolf class — so this is a one-time instrument run here, and its output above is the evidence. Nothing in the repository now depends on report wording.

## 3. Part 2 — the premise arm

`grants-complete.sh` gained a **PREMISE** arm that runs before both grant arms and reports separately, so a breach reads as *"the role model is breached — every grant assertion below is void"* rather than as a grant anomaly.

**The expected attributes are derived from `database/roles/000-roles.sql`**, never a hand list: the `ALTER ROLE pemo_app …` line is parsed, every `NO<ATTR>` token becomes an attribute asserted false, and each is mapped to its `pg_roles` column. Ownership is asserted separately because it is not a role attribute — an owner can grant itself anything regardless of `rolsuper`.

Three ways the derivation refuses to pass vacuously, each a real failure mode rather than defensive noise: a missing `000-roles.sql`, a missing or unparseable `ALTER ROLE` line, and a declared token this check has no column mapping for. The last matters most — an unmapped attribute would otherwise be *unchecked, silently*.

The success line now names what was derived, so the posture is visible in output rather than implied:

```
ok  grants complete and not excessive   role model holds (BYPASSRLS,CREATEDB,CREATEROLE,SUPERUSER), 43 tables, SELECT+INSERT only
```

### Six reds, each fired against a planted audit row

| breach | result |
|---|---|
| `SUPERUSER` | ✖ `pemo_app has rolsuper=true but 000-roles.sql declares NOSUPERUSER` |
| `CREATEROLE` | ✖ `…rolcreaterole=true but … declares NOCREATEROLE` |
| `CREATEDB` | ✖ `…rolcreatedb=true but … declares NOCREATEDB` |
| `BYPASSRLS` | ✖ `…rolbypassrls=true but … declares NOBYPASSRLS` |
| ownership of `access.audit_event` | ✖ `pemo_app OWNS 1 table(s): access.audit_event` |
| the declaration removed from `000-roles.sql` | ✖ `no ALTER ROLE declaration … an empty expectation would pass vacuously` |

Each names its own attribute, so the message identifies the breach rather than announcing that something is wrong. Restored after each; `000-roles.sql` verified byte-identical to its snapshot.

**What this closes.** Before this, with `pemo_app` made superuser the app role rewrote an audit row and then erased it while this script printed `ok`. That hole existed from GEN-010's creation of the role until now — not a live breach, since `pemo_app` is non-superuser, but a guard blind to the one drift that defeats ADR-010 D1's fourth property.

## 4. Two things found while proving

**Transferring ownership away and back does not restore grants.** Moving `access.audit_event` to `pemo_app` dropped pemo_app's explicit grants — an owner does not need them — and moving it back left the table with **no** grants for the app. The MISSING arm caught it immediately (`access.audit_event missing INSERT / missing SELECT`), which is both arms shown live in one accident. Restored by re-applying `010-grants.sql` by rule. Worth knowing: an ownership change is not a reversible experiment on a real database.

**The audit-pins-reference-data property bit a third time — on me.** My planted proof row made the battery's seed case and 8 suite tests fail: `update or delete on table "user_group" violates foreign key constraint "audit_event_group_id_fkey"`. I diagnosed it rather than assuming, confirmed by running the seed and reading the error, cleared the row, and everything went green. The property is correct — you do not delete a group with audit history — but it has now caught GEN-011, GEN-009 and GEN-012 in turn, always as a failing *setup* rather than a failing assertion, which is why it reads as unrelated breakage each time.

## 5. Gaps — this list is complete

1. **The enumeration's recall is still marker-bound.** Every *marked* principle is carried; completeness is not claimed, as accepted at Step 1.
2. **The reconciliation is not repeatable from the repository** — deliberately, per your ruling. If the corpus drifts again, the enumeration is manual work again. The durable fix is stable principle ids, which you ruled owed and out of scope.
3. **"principle 43" / "principle 11" still do not resolve** against an unnumbered file. Content-matched, as ruled; owed.
4. **`prove.sh` counts a SKIP as neither pass nor fail**, and the premise arm inherits it: with no database the role model is unchecked, loudly. Correct, but this is the floor, so it is worth stating that the floor is only checked where a database exists — CI sets `REQUIRE_DB=1`, a developer's machine may not.
5. **The premise checks `PEMO_DB_USER` only.** `pemo_owner`'s posture is unasserted — it is meant to be powerful, so there is little to assert, but "the owner is not a superuser either" is a question I did not open.
6. **The derivation trusts the first matching `ALTER ROLE` line.** A second, later line re-granting an attribute would be missed. `000-roles.sql` has one; a check that reads only the first is a latent frozen-axis of a different shape.
7. **No test asserts the premise arm exists.** Its reds were fired by hand here; if someone deletes the arm, the battery still passes 21/21. That is the *principle-is-not-a-control* problem applied to this very PID — and closing it needs a battery case that mutates the role and expects a red, which requires the battery to be allowed to alter roles on the dev database.

## 6. Rulings sought

1. **§5.7** — should the battery gain a case that flips a role attribute and expects the red, making the premise arm self-guarding? It is the honest closure of this PID's own gap, and it makes the battery mutate cluster-level state.
2. **§5.5** — assert anything about `pemo_owner`?
3. **§5.6** — parse all `ALTER ROLE` lines rather than the first?
4. **Commit** — nothing beyond the allocation is committed.

**HARD STOP.**
