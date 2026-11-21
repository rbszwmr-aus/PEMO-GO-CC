# GEN-010 — Step 1: assessment and proposal

**PID:** GEN-010 v1.0 · **Status:** **HARD STOP.** Nothing built.
**Headline:** the measurement changes the model. The runtime issues **zero `UPDATE` and zero `DELETE`**, so `pemo_app` needs `SELECT` + `INSERT` and nothing else — every table is append-only to the runtime, not just audit tables. That is stricter than the decision assumed, and it makes GEN-009's property 4 nearly free.

---

## 1. Pin

| | |
|---|---|
| **Pin (analysis)** | `213d848071e485886b2a8247830ee1f8802f03a7` / tree `0d5725c…` / 767 files |
| **`main` now** | `fab3c54a492a5f129b1dafa1541e7fcabd7eb9dd` — the GEN-010 allocation |
| **Number** | **010** from `--next`; next is 011 |

## 2. Role naming, confirmed against what the repository actually uses

| thing | value | pattern |
|---|---|---|
| database | `pemo_dev` | `pemo_` + purpose |
| db user | `pemo_dev` | same |
| compose project / container | `pemo-dev` / `pemo-dev-db` | `pemo-` + purpose (hyphens for docker) |
| volume | `pemo-dev-db-data` | hyphens |
| schemas | `platform`, `property`, `resident`, `home_safety`, `integration`, `access`, `dev_scaffold` | bare module names, **no prefix** |

`pemo_owner` and `pemo_app` fit the SQL-identifier convention (`pemo_` + purpose, snake_case). **Confirmed, no change proposed.**

One naming collision to note: today `pemo_dev` is *both* the database name and the role. Under the proposal the **database stays `pemo_dev`** and the roles become `pemo_owner` / `pemo_app`, so the name `pemo_dev` survives only as the database. That is a deliberate narrowing, not an accident.

## 3. The measurement that changes the model

The decision doc anticipated *"`UPDATE`/`DELETE` on the ordinary tables a module legitimately mutates."* Measured across `modules/*/src` and `apps/api/src`:

| verb | runtime sites |
|---|---:|
| `SELECT` | 76 |
| `INSERT` | 10 (9 tables) |
| **`UPDATE`** | **0** |
| **`DELETE`** | **0** outside the migration runner |
| `TRUNCATE` | 0 anywhere in the repository |

Every `ON CONFLICT` in runtime code is **`DO NOTHING`** (`idempotency-store.ts:62`, `publisher.ts:27`, `home-safety-repository.ts:131`) — none is `DO UPDATE`, so none needs the `UPDATE` privilege.

The only `DELETE` in runtime code is `DELETE FROM platform.schema_migration` inside the **migration runner**, which is `pemo_owner`'s path, not the app's.

**So the runtime's true need is `SELECT` + `INSERT`.** Not as a target to aspire to — as what the code does today.

**Consequence worth stating plainly:** every table becomes append-only to the application, so property 4's guarantee holds for *all* 42 tables, not only for the audit table GEN-009 will add. GEN-009 then inherits the property rather than building it. The decision doc's "append-only for audit-bearing tables" is a subset of what falls out.

## 4. The seam already exists in the code

`createAdminDb` appears in exactly four files — `cli/migrate.ts`, `cli/seed.ts`, `cli/verify-boundaries.ts`, `testing/harness.ts`. **Never in `server.ts` or `wiring.ts`.** The runtime uses `createModuleDb` exclusively.

That is already the boundary the two roles need:

| constructor | becomes | why |
|---|---|---|
| `createModuleDb` | **`pemo_app`** | the API runtime — `SELECT` + `INSERT` |
| `createAdminDb` | **`pemo_owner`** | migrations, seeds, boundary verification, the test harness — full DML + DDL |

Today the two differ only by `search_path`; giving them different credentials makes an existing distinction meaningful rather than inventing one. **The seeds' 192 `DELETE` statements and the harness's reseed are `pemo_owner`'s work**, which is correct — fixture management is an owner concern, like migrations.

This is the reuse-not-rewrite shape, and it is why I would not put the split anywhere else.

## 5. Proposed model

**Roles.** `pemo_owner` — owns the seven schemas and all tables, runs migrations. `pemo_app` — `LOGIN`, **not superuser**, owns nothing, granted `SELECT, INSERT` on every table in the seven schemas plus `USAGE` on schemas and on the one sequence (`platform.integration_exception` is `bigserial` and the runtime inserts into it — the only sequence the runtime touches).

**Where the grants live.** In each migration, beside the `CREATE TABLE`. The runner enforces *"a migration file may name its own schema and no other"* (`runner.ts:61-85`), and a `GRANT … TO pemo_app` on the file's own table satisfies that check — verified against the rule's regex, which only forbids *other* schemas' qualified identifiers.

**Role creation — the chicken-and-egg, and I have not solved it cleanly.** The roles must exist before any migration grants to them. Three options, and this is a ruling I need:

1. **Compose init script** (`/docker-entrypoint-initdb.d/`) creates `pemo_app`; `POSTGRES_USER=pemo_owner`. Clean for dev — **but CI's `services: postgres` block cannot mount an init script**, so CI would need a different path and the two environments diverge, which the CI-and-a-developer-are-one-world discipline argues against.
2. **The `migrate` CLI ensures the roles exist** before running migrations, from an idempotent `database/roles/000-roles.sql`. One path for dev, CI and any future environment. Cost: `CREATE ROLE` is a *cluster-level* object appearing in a database-scoped tool.
3. **A migration `0000`** creating the roles. Cost: the same cluster-level concern, plus it sits inside the numbered sequence that `migration-numbering.test.ts` governs, and roles are not schema objects.

**I propose (2)** — one path, no environment divergence — and flag that it puts cluster-level DDL in the migrate CLI, which is a genuine boundary smudge.

## 6. The grant-completeness check

**Expected grants are derived, not listed.** The table set comes from `information_schema`; the expected set is a rule: *every table in the seven schemas grants `SELECT, INSERT` to `pemo_app`*. No hand-written table list, so it cannot go stale as tables are added — the frozen-axis discipline.

**It checks both directions**, and the second half matters more than the first:

- **under-granting** — a table missing `SELECT` or `INSERT`: the migration forgot, and the app breaks on deploy. Fails loudly, naming the table.
- **over-granting** — a table granting `pemo_app` `UPDATE` or `DELETE`: **this is how property 4 erodes silently.** Nobody would notice a stray `GRANT ALL`; the audit table would quietly become mutable. Fails loudly too.

**Exceptions are declared, empty today**, using the `TAG_EXEMPT` pattern already established: a table needing `UPDATE`/`DELETE` is an entry with a reason, and a visible diff. Today the correct exception set is empty, because §3 measured that nothing needs them.

**Where it runs:** in `pid-index.mjs --check` as ruled — but it needs a database, so it takes the `REQUIRE_DB` shape: loud skip without one, fatal under the flag, exactly as `seed-reproduces.sh` does. I propose it as a sibling script (`docs/governance/bin/grants-complete.sh`) invoked by `--check`'s battery case, rather than putting SQL inside the generator, which has no database dependency today and should keep none.

## 7. Gaps — this list is complete

1. **Nothing built.**
2. **§5's role-creation path is unresolved** and blocks the build.
3. **`REVOKE`-then-restore in done-when 2 must not leave the tree dirty** — the destructive-guard lesson: I will restore from a snapshot and verify, not assume.
4. **I have not verified that `pemo_app` can run the full suite** — done-when 3 is exactly that, and §3 predicts it passes, but a prediction from grepping SQL strings is not a run. If the suite needs a privilege §3 did not find (a driver-issued statement, a `SET`, an advisory lock), it surfaces there.
5. **Sequence ownership for future tables** — the rule "grant `USAGE` on sequences" is not automatic; a future `serial` column needs its own grant, and the check must cover sequences as well as tables or it will pass while the app cannot insert.
6. **`dev_scaffold` is in the seven schemas** and is excised by the D01 scaffold-removal migration whenever that lands. The check derives its schema list from `information_schema`, so it follows automatically; noted so nobody hard-codes seven.
7. **The decision doc says `SELECT`+`INSERT` broadly plus `UPDATE`/`DELETE` on ordinary tables.** §3 says no `UPDATE`/`DELETE` are needed at all. I am proposing the stricter model the measurement supports; if the Brain intends headroom for imminent writes, that is a ruling, not a measurement.

## 8. What the Brain is asked to rule

1. **§5 — role creation.** Option 2 (migrate CLI + idempotent `database/roles/000-roles.sql`), accepting cluster-level DDL in a database-scoped tool? Or 1 or 3?
2. **§3/§7.6 — the stricter model.** `pemo_app` gets `SELECT`+`INSERT` only, no `UPDATE`/`DELETE` anywhere, exceptions empty. Confirm, since it is stricter than the decision doc.
3. **§6 — the check's shape**: sibling script under `REQUIRE_DB`, checking both under- and over-granting, sequences included.
4. **§2 — role names** `pemo_owner` / `pemo_app` confirmed, database stays `pemo_dev`.

**HARD STOP.**
