# GEN-055 landing — a blocking finding: seed-reproduces.sh drops 7 of 10 schemas

**Date (UTC):** 2026-09-04. Surfaced while trying to merge GEN-055 (MERGE ruling in hand).
**Status:** HARD STOP. GEN-055 cannot merge until this is ruled — the pre-push hook refuses and CI would red too. No `--no-verify`.

## What blocked the push

The pre-push battery (`prove.sh` → `seed-reproduces.sh`) failed:

```
error: update or delete on table "user_group" violates foreign key constraint
       "audit_event_group_id_fkey" on table "audit_event"
FAIL  seed did not complete — the world is partial …
```

## Root cause — a stale hand-kept schema list, NOT a GEN-055 seed bug

`docs/governance/bin/seed-reproduces.sh:100-101` says *"drop every schema the migrations create"*
and then hardcodes seven:

```
DROP SCHEMA IF EXISTS platform, property, resident, home_safety, integration, access, dev_scaffold CASCADE;
```

The database has **ten** non-system schemas: the seven above plus **`helpdesk`, `notices`,
`service_case`**. So "from nothing" is not from nothing — those three keep their rows, and the
re-migrate+re-seed then runs against a half-populated world and trips the FK.

**Proof it is the drop list, not the seed:**
- From my `bootstrap --with-seed` state (schemas populated): seed-reproduces **FAILS** (above).
- After I dropped **all ten** schemas by enumeration and re-ran it: seed-reproduces **PASSES**
  (`ok  seed reproduces from nothing  scaffold=5 events=7`). The seed reproduces perfectly from a
  truly empty database; it only fails when the three un-dropped schemas carry data.

## Why GEN-055 exposes it, and why CI is affected (not just local)

`helpdesk` and `service_case` become first-class seeded schemas here (migrations 0139/0140 make the
vocabularies disjoint; the modified `70-cases-ticket-and-case.sql` drives case acts that write
`audit_event` referencing `user_group`). Pre-GEN-055 seeds did not populate these in a way that
tripped the leftover-data FK; GEN-055's do.

**CI hits the same state:** `governance.yml` runs `database bootstrap --with-seed` (line 110) BEFORE
`prove.sh` (line 132), so on CI the three schemas are seeded before seed-reproduces runs, its drop
leaves them, and the FK fails. This is a real CI-blocking finding, not a local artifact. (Earlier
merges passed because their seed data did not trip the FK across the three un-dropped schemas.)

## Proposed fix (for the ruling — not applied)

Complete the reset by DERIVING the schema list rather than hand-keeping it — the
`[correlated-lists-certify-nothing]` remedy. Two candidates:
- drop every non-system, non-`public` schema enumerated from the catalog (`pg_namespace`), which is
  exactly what "from nothing" means and can never fall behind a new module; or
- derive from `MODULE_SCHEMAS` (`@pemo/platform`) plus the disclosed non-module schemas
  (`dev_scaffold`), the same single declaration `cross-schema-scan.ts` already reuses.
The catalog enumeration is the most robust (it cannot miss a schema a migration adds), keeping the
existing loud dev-only / not-production guard above the drop untouched.

Its bite: add an eighth (or Nth) schema’s worth of data and revert the derivation to the hardcoded
seven → seed-reproduces reds naming the un-dropped schema. And the existing "from nothing" assertion
already reds if the reset is incomplete.

## Decision needed

- **Fold into GEN-055** (the fix is in `docs/governance/**`, GEN-055's scope, and GEN-055 is the PID
  that exposes it) — GEN-055 lands with the seed-reproduces fix and its bite; OR
- **Its own id**, run before GEN-055 can merge (GEN-055 then rebases onto it).

Either way GEN-055's own re-run is green (35/35, 9/9 bites); this finding is in the harness, not the
feature. Recommendation: fold into GEN-055 — it is one small derivation in GEN-055's scope, the PID
that surfaced it, and splitting would leave GEN-055 blocked on a one-line dependency.

---

## FIX APPLIED (ruling: fold into GEN-055)

`seed-reproduces.sh` now derives the drop set from the catalog:
`SELECT string_agg(quote_ident(nspname), …) FROM pg_namespace WHERE nspname !~ '^pg_' AND nspname
NOT IN ('information_schema', 'public')` — every schema the database holds, so it can never fall
behind a new module. Two corrections were needed, the second found by the first:

1. **Derive the list** (the finding). The dev-only / not-production guard ABOVE the drop is untouched.
2. **Drop as the OWNER, not `pemo_app`.** A post-condition I added ("no schema may survive the reset")
   revealed that the drop had been running as `pemo_app`, which owns none of the schemas — a single
   atomic `DROP SCHEMA a, b, c …` over schemas it cannot drop aborts and rolls back, leaving
   EVERYTHING. The reset now drops as `pemo_owner` (the role `bootstrap.sh` migrates as). This is why
   "from nothing" had been quietly incomplete in more ways than the missing three names.

Proven by state: from a fully seeded database (previously FAILED) the fixed check PASSES
(`ok  seed reproduces from nothing  scaffold=5 events=7`).

**Bite** (`run-mutations GEN-055`, kind `guard`): `seed-reproduces-drop-set-is-derived-not-hand-kept`
reverts the derived query to the old hardcoded seven; on a seeded database the post-condition reds
naming the survivors — `schemas SURVIVED the reset — 'from nothing' left: helpdesk, notices,
service_case`. Verified red-for-its-own-reason before wiring.

## The class sweep (ruling's ONE ADDITION) — every hand-kept schema/module list

| # | Site | State | Note |
|---|------|-------|------|
| 1 | `database/roles/010-grants.sql` | **DERIVED** | `FOR s IN SELECT nspname FROM pg_namespace WHERE NOT pg_% AND NOT information_schema/public` — GEN-037/039 already fixed this class here. |
| 2 | `docs/governance/bin/grants-complete.sh` | **DERIVED** | `table_schema IN (SELECT nspname FROM pg_namespace …)` — derived from the catalog. |
| 3 | `modules/platform/src/module-registry.ts` `ALL_SCHEMAS` | **hand-authored, BY DESIGN** | The ONE declaration; `MODULE_SCHEMAS`/`NON_MODULE_SCHEMAS` derive from it. `derive-don't-name` keeps exactly one, compared against reality by the inventory test (GEN-039). Correct as-is. |
| 4 | `apps/api/src/cli/verify-boundaries.ts` `only-in-scope-schemas` | **mostly DERIVED** | `[...MODULE_SCHEMAS, 'dev_scaffold']`. The `'dev_scaffold'` literal duplicates `NON_MODULE_SCHEMAS` from the same registry — a trivial one-line improvement (use `NON_MODULE_SCHEMAS`). Not converted here: it is stable and outside the cases work; flagged as an optional tidy. |
| 5 | `docs/governance/bin/run-mutations.mjs` `build()` | **HAND-KEPT** | A literal list of nine module dirs (`modules/platform … modules/service-case`). A new module is not rebuilt by the mutation runner. Conversion is NOT trivial — it needs a schema-name→dir-name map (`home_safety`→`home-safety`, `service_case`→`service-case`) or a workspace glob. **Left as-is per the ruling; recorded as the real remaining instance of the class for a future PID.** |

Net: the two grants checks are derived (the class was already ruled there); the registry is the
sanctioned single declaration; `verify-boundaries` carries one trivial hand-kept literal; and
`run-mutations.build()` is the one genuinely hand-kept, non-trivial list left standing. The list is
recorded; only the trivial/relevant one (seed-reproduces) is converted in this PID.
