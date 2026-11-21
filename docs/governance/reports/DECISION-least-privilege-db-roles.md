# Least-privilege database roles — the greenfield role model

**Author:** Master Brain · **Decision owner:** Master Brain (DB architecture) · **Status:** Decided 2026-08-28
**Why now, and why cheap:** ADR-010 D1 requires every staff write to leave an audit record immutable to the actor. That is impossible while the app connects as a superuser, because a superuser bypasses all table permissions (GEN-009 measured it). The repository provisions no deployment and refuses to run outside `development` (`config.ts:76-86`), so there is no live estate to migrate — the role model is decided greenfield, before any environment exists. This is the cheapest it will ever be: no cutover, no live-data risk.

---

## The decision

Two database roles, separated by what they may do, from the start:

- **`pemo_owner`** (name to confirm against existing conventions) — the DDL / migration role. Owns the schemas and tables; migrations run as it. It is the only role that changes structure.
- **`pemo_app`** — the runtime role the application connects as. **Not a superuser.** Granted exactly the DML it needs and nothing more: `SELECT` + `INSERT` broadly, plus `UPDATE`/`DELETE` on the ordinary tables a module legitimately mutates — and **on an audit-bearing table, `INSERT` + `SELECT` only, never `UPDATE`/`DELETE`.**

Because `pemo_app` is not a superuser and does not own the tables, a revoked privilege actually binds — it cannot re-grant itself (GEN-009 proved this in miniature: `no privileges were granted`, `UPDATE` still refused). That is what makes immutability a permission rather than a convention, and it is why the app must not be a superuser: the whole property rests on it.

## Consequences

- Migrations run as `pemo_owner`; the app runs as `pemo_app`. `modules/platform`'s connection handling, the dev compose, CI's database step and `.env.example` create both roles this way from the start.
- Every table in the seven schemas must carry `pemo_app`'s expected grants. A migration that adds a table and forgets the grant is a **runtime failure on deploy, in a module unrelated to whoever wrote the migration** — the rot this model is most prone to. So the model ships **with** a check (below), never without it: an obligation without its guard is the defect, not a convenience.
- An audit-bearing table is append-only to the app: `INSERT` + `SELECT`, owned by `pemo_owner`. The first such table arrives with the write skeleton (GEN-009), which proves property 4 binds now that `pemo_app` is not a superuser.

## The guard that ships with it

`--check` verifies every table in the seven schemas carries `pemo_app`'s expected grants, and fails loudly, naming the table, if one is missing — so a forgotten grant is caught at `--check`, not at deploy. This is the same battery philosophy: fail where a human reads it, not at 3am in production.

## If a production PEMO turns out to exist

The repository cannot see out-of-repo provisioning, and the Product Owner does not know of a running production. The evidence (no deployment in the repo, a build that refuses to start outside development) says there is none. **The repository work above is unconditional** — the greenfield role model is defined in the repo either way. Only *if* a live PEMO is later found to exist does a separate, higher-risk step follow: applying the same roles to that environment, guided by the read-only query in the deployment-role check note. That live rollout is not part of the greenfield precursor.
