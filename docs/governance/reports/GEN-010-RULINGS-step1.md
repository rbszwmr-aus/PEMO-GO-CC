# GEN-010 (least-privilege role model) Step 1 — Rulings

**From:** PEMO Master Brain → PEMO Main CC
**Status:** Filed. Proceed to Step 2 with the role-bootstrap ruling below. Pin `fab3c54a`.

---

## The measurement is accepted, and it makes the model stronger than the decision doc

Runtime does `SELECT` 76, `INSERT` 10, `UPDATE` 0, `DELETE` 0 (the only `DELETE` is `platform.schema_migration` in the migration runner, `pemo_owner`'s path), every `ON CONFLICT` is `DO NOTHING`. So **`pemo_app` is `SELECT` + `INSERT` and nothing else — measured, not aspired.** The consequence is the good one: the whole runtime is append-only, not just audit tables, so **GEN-009 inherits property 4 rather than building it**, and the decision doc's "append-only for audit-bearing tables" is a subset of what falls out. Amend the model to say so: the runtime is append-only by measurement; audit immutability is the case of it that D1 named, not a special mechanism.

One durability note to record so nobody later misreads it: `SELECT`+`INSERT` is *what the code does today*, and it is the correct baseline. When a future feature legitimately needs to `UPDATE` a specific table (mark-as-read, edit a draft), that is a **minimal per-table grant on that table**, and it never touches the audit table's append-only guarantee. The baseline is measured, not permanent; the discipline is that widening is always per-table and never reaches the audit tables.

## The seam already exists — reuse it, don't invent

`createAdminDb` in exactly four files (three CLIs, the test harness), never in `server.ts`/`wiring.ts`; runtime is `createModuleDb` exclusively. So `createModuleDb → pemo_app`, `createAdminDb → pemo_owner`, and different credentials make an **existing** distinction meaningful rather than inventing one — today they differ only by `search_path`. The seeds' 192 `DELETE`s and the harness reseed become owner work, which is correct: fixture management is an owner concern, exactly like migrations. Approved. Naming `pemo_owner`/`pemo_app` with the database staying `pemo_dev` fits the `pemo_+purpose` convention and is confirmed against actual usage. Approved.

## The grant check — both directions, and the over-grant half is the load-bearing one

Approved, and your framing is the right one. Under-granting breaks the app on deploy — loud, self-correcting. **Over-granting is how property 4 erodes silently**: a stray `GRANT ALL` and the audit table is quietly mutable and nothing says so. So the check must fail on *excess* as well as absence. Deriving the expected grants from `information_schema` **by rule** rather than a hand-written table list is exactly right — a maintained list is the thing that goes stale, and a check that can go stale is worse than none. `TAG_EXEMPT` for exceptions, empty today, is the honest shape. Keep it.

## Ruling — the role-bootstrap path: one entrypoint, two named concerns

You raised the real boundary honestly: roles must exist before any migration grants to them; a compose init script is clean for dev but CI's `services:` block can't mount one, so the environments would diverge — against the one-world discipline. And putting `CREATE ROLE` (cluster-scoped) into the migration runner (database-scoped) is a genuine smudge, not a detail. You are right on both counts, so the ruling keeps the one-world property without the smudge:

- **`ensure-roles` is a distinct, explicitly-named, idempotent step**, reading `database/roles/000-roles.sql` (`CREATE ROLE ... IF NOT EXISTS` / `DO` block, because a shared cluster may already hold the roles), run as its own labeled operation — **not** as an entry in the migration list. Roles are not database migrations and must not masquerade as them.
- **One entrypoint both dev and CI invoke** runs `ensure-roles` then `migrate` (then `seed`), so the two environments do the identical thing — one world — and the cluster DDL is honestly labeled as cluster bootstrap rather than disguised. Whether the orchestrator is the migrate CLI calling `ensure-roles` first or a thin wrapper script is yours to propose; the constraints are: one entrypoint, and the two concerns stay named-distinct so a later reader is never puzzled why "migrate" creates roles.
- Record the honest residual: `CREATE ROLE` is cluster-scoped, so on a shared cluster `pemo_owner`/`pemo_app` become cluster-global. That is fine for the isolated dev and CI clusters and is a note for any future real deployment (which does not exist); idempotency is what keeps re-runs and a pre-existing cluster safe.

## §3 is a prediction; done-when 3 is the proof — and a surprise is a minimal grant, never a widening

Accepted, and it matters. The verb counts are a grep over SQL strings — a prediction. **Done-when 3 (the full suite running as `pemo_app`) is what actually proves the role can do the app's work**, and a privilege the grep could not see — a sequence `USAGE` for an identity `INSERT`, an advisory lock, a `SET`, a temp table — surfaces there. When it does: **grant that specific privilege minimally and fold it into the information_schema-derived rule.** A privilege the run proves necessary is least-privilege, not over-grant. What a surprise must never become is an excuse to widen to `UPDATE`/`DELETE` or `GRANT ALL` — the fix is the smallest grant that makes the suite green, named, and added to the rule so the check knows it is expected.

## Step 2

Build the two roles via `ensure-roles` from `000-roles.sql`, the one-entrypoint orchestration, `createModuleDb`/`createAdminDb` bound to the two credentials, the grants derived by rule, and the two-way grant check. Prove: `pemo_app` `rolsuper=false` and not owner; a revoked privilege binds where the old superuser bypassed it; **the full suite greens as `pemo_app`** (done-when 3, the real proof — surface any missing privilege here and grant it minimally); the grant check fires on both a missing and an excess grant, and stays quiet when complete. HARD STOP before commit.
