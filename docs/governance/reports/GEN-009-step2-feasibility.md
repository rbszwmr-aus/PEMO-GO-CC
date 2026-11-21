# GEN-009 — Step 2 (interim): the escape hatch fires

**PID:** GEN-009 v1.0 · **Pin:** `213d848071e485886b2a8247830ee1f8802f03a7` / tree `0d5725c…` / 767 files
**Status:** **STOPPED at the start of Step 2, as the ruling directs.** Nothing built, nothing changed — `git status` is clean.

The ruling required two confirmations before building. The first passed. **The second fires the escape hatch**, so I stopped rather than build property 4 on a foundation I had just measured to be false.

---

## 1. `ADR-010` D1, re-read from the artifact

Read in full from `docs/adr/ADR-010-role-list.md`, not from the PID's quotes. **No divergence** — the four properties are worded as the PID carries them, and the framing is stronger than the summary suggested:

> **The load-bearing half of this decision is what *"audited"* must mean.** If an audit record substitutes for a gate, then it carries the weight the gate would have carried, and a weak audit record makes `D1` empty. … Without all four, *"record rather than restrict"* records nothing. **This is a requirement on the write path, not a logging preference.**

A re-read that finds nothing is still a result, and this one is: the contract can rest on the artifact.

**One thing the artifact says that the summary does not.** D1 releases the 27 on **`(principal, scope node)`** — it predates `ADR-012`, which substituted **group** for principal in the *grant key*. Those are now two different things, and the audit record needs both: the act is attributable to a **principal**, the authority is held by a **group**. D1's own wording would, read literally today, describe a key that no longer exists. The audit shape in Step 1 §6 already separates them; recorded so nobody later reconciles it the wrong way.

## 2. The ownership mechanism — it works, and it is not defeatable

Measured on a throwaway database, not reasoned about:

| test | result |
|---|---|
| audit table owned by `pemo_audit_ddl`, app role `pemo_app` granted `INSERT, SELECT` | owner confirmed `pemo_audit_ddl` |
| `pemo_app` INSERT | **allowed** |
| `pemo_app` SELECT | **allowed** |
| `pemo_app` UPDATE | **`ERROR: permission denied for table audit`** |
| `pemo_app` DELETE | **`ERROR: permission denied for table audit`** |
| `pemo_app` re-granting itself UPDATE | **`WARNING: no privileges were granted`** — and UPDATE still refused |

**That last row is the one that matters.** It is the difference between this and the rejected trigger: the actor cannot restore its own privilege. This is a permission, not a convention.

## 3. Why the escape hatch fires

**The mechanism binds a non-superuser. Today's application role is a superuser.**

```
pemo_dev: superuser=true  createrole=true
UPDATE as pemo_dev on a table it does not own → SUCCEEDED
```

A superuser bypasses permission checks entirely. So property 4 cannot hold while the application connects as `pemo_dev`, and no migration can change that — it is a property of the role, not of the table.

**Switching the app to a non-superuser role is system-wide, measured:**

| | |
|---|---|
| schemas needing `USAGE` | **7** |
| tables needing explicit DML grants | **42** |
| current owner of all 42 | `pemo_dev` |
| sequences, defaults, future tables | every later migration must grant to the app role, or the app breaks on deploy |

Plus, outside SQL: `database/dev/docker-compose.yml` (which creates `pemo_dev` as the superuser), `database/dev/.env.example`, `.github/workflows/governance.yml`'s database-env step, and `modules/platform`'s config and connection handling — which currently has **one** credential (`createAdminDb` and `createModuleDb` share it; "admin" means no `search_path`, not a different role).

That is the ruling's own condition, met: *"a system-wide re-ownership rather than a contained migration."* It is not one migration beside an audit table. It changes how every module reaches the database.

**And it would be irreversible in the wrong direction if rushed.** Every later migration inherits the obligation to grant; a missed grant is a runtime failure on deploy, in a module unrelated to whoever wrote the migration.

## 4. What I did not do

I did not build property 4, did not create the audit table, did not touch `modules/platform`, and did not write a decision note — the role-separation posture the ruling asked me to file is precisely the thing the precursor PID must decide, and filing it now would fix a decision I have just reported as not-yet-takeable.

`git status` is clean; the only commit this PID has made is its own allocation.

## 5. What this splits into

**A precursor PID — least-privilege database roles.** Introduce a non-superuser application role with explicit grants across the 7 schemas and 42 tables; keep migrations running as a DDL role; establish the rule that every later migration grants to the app role; update the dev compose, `.env.example` and CI. Its done-when is the one already proven in §2: the app role's `UPDATE`/`DELETE` on an audit-bearing table refused at the permission level, and unable to re-grant itself. **The role-separation decision note belongs to that PID**, since it is that PID's decision.

**GEN-009 then proves 1–3** on `management_update` — the scope gate via the swapped resolver, property 1 via the existing `transaction()`, and the audit record carrying staff principal + authorizing `(group, role, node)` + effective instant — with property 4 **named as pending** rather than silently absent. That is honest, and it is the shape the ruling anticipated.

## 6. Gaps — this list is complete

1. **Nothing built.**
2. **I have not established whether production/staging even runs the app as a superuser** — I measured the *development* compose, which the repository defines. If deployment already uses a non-superuser role, the precursor is smaller than §3 suggests. Nobody has told me what deployment looks like and I did not assume.
3. **The 42-table count is at this pin**, from a database migrated from nothing. It grows with every migration, which is part of why the obligation needs a rule rather than a one-off sweep.
4. **I did not test whether `pemo_audit_ddl` can be `NOLOGIN`** in the real flow — the test granted it to `pemo_dev` and used `SET ROLE`. Whether migrations should `SET ROLE` per table or run wholly as the DDL role is a precursor-PID design question.
5. **Properties 1–3 are unproven**, pending the ruling in §7.

## 7. What the Brain is asked to rule

1. **Confirm the split.** Property 4 leaves GEN-009 for a precursor PID; GEN-009 proves 1–3 and names 4 pending. I have not assumed this — the ruling anticipated it, but the scope change is yours.
2. **Gap 2** — what does deployment actually run as? It changes the precursor's size materially.
3. **Should GEN-009 proceed to build 1–3 now**, or wait for the precursor so the skeleton is proven whole?

**HARD STOP.**
