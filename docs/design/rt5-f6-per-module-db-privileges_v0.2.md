# RT5-F6 — per-module database privileges

**Version:** v0.2  
**Date:** 20 November 2026 (Australia/Sydney, AEDT, UTC+11)  
**Status:** design only — no code in this note; for PT’s decision  
**Sources:** fix plan §7 rank 2 (R6); independent R&T `rt-independent-36340fd_v1.0.md` (RT5-F6); repo at `3fbae39` (`database/roles/000-roles.sql`, `010-grants.sql`, migration 0145, `apps/api/src/wiring.ts`, `modules/platform/src/db/module-db.ts`, `modules/platform/src/audit/audited-write.ts`, `apps/api/src/management/case-acts.ts`, `docs/governance/bin/grants-complete.sh` / `premise-arm-guard.sh`); run note v0.6

**Changelog**
- v0.2 — Today’s grant matrix from the repo; per-module roles versus `SECURITY DEFINER` functions; exact open-case connection, commit and proposed role-switch points; migration and rollback; how R&T will prove unauthorised reads and writes are denied, the coordinator path stays atomic, and pool release resets the role. The five open questions are kept.
- v0.1 — First draft: the gap, four options, a lean MVP recommendation, and open questions for PT.

## Problem

The runtime login is one role, `pemo_app`: `SELECT`+`INSERT` on every table in every schema `pemo_owner` owns (72 tables, reasserted by `010-grants.sql`), plus a column-level `UPDATE` on `strata.email_outbox` (`status`, `claimed_at`, `attempt`, `transport`, `transport_detail`, `send_key`) from migration 0145, also reasserted by `010-grants.sql`. `grants-complete.sh` checks that model; `premise-arm-guard.sh` checks the role is not superuser and cannot create roles or databases or bypass RLS. That stops escalation and whole-row `UPDATE`/`DELETE`. It does not isolate modules.

Independent R&T showed a session with `search_path=property` could `INSERT INTO access.audit_event` and `SELECT` from `helpdesk.ticket`. `search_path` is not an access control list. `createModuleDb` sets `search_path` per pool; `txOnSchema` and `auditedWrite` switch path or use a qualified name on the **same** client — they do not change the role. Fix plan §7 asked for restricted module privileges and named coordinator exceptions, without rebuilding the repository layer or breaking the single-transaction open-case path. A privilege boundary must not ship as “only P2”. This note does not implement the split. Two constraints bind every option: open-case must stay one connection and one commit; and the pool budget is already tight — nine module pools, default `PEMO_DB_POOL_MAX=5`, two replicas = 90 connections on a `max_connections=100` cluster (`PEMO_DB_REPLICA_COUNT` is advisory only).

## What each module can read and write today

Derived from the grant scripts, 0145, `ALL_SCHEMAS` / `wiring.ts`, and `auditedWrite` — not from a live query of the shared `127.0.0.1:5432` cluster. At the database there is no per-module difference: every API pool logs in as `pemo_app`, so every module session can `SELECT` and `INSERT` every catalogue table. `USAGE` is granted on every such schema, and `USAGE, SELECT` on their sequences.

| Schema | Own pool today | `pemo_app` SELECT | `pemo_app` INSERT | `pemo_app` UPDATE / DELETE |
|---|---|---|---|---|
| `platform`, `property`, `resident`, `home_safety`, `access`, `notices`, `helpdesk`, `strata` | Yes — one pool each, `search_path` set to that schema | Yes | Yes | No, except column `UPDATE` on `strata.email_outbox` |
| `dev_scaffold` | Yes (development-only; not a business module) | Yes | Yes | No |
| `integration`, `service_case` | No own pool. Reached on another module’s client via `txOnSchema` or a qualified name | Yes | Yes | No |

Application code usually uses unqualified SQL in its own schema, and already crosses schemas for `openCaseFromTicket` (helpdesk + `service_case` + `access.audit_event`), other `auditedWrite` callers (act schema + `access.audit_event`), and some notice / home-safety reads of `property` and `resident`. Those crossings are conventions, not a grant boundary. That is the F6 gap.

## Options

**1. Status quo.** Keep `pemo_app` as in the table. Blast radius is the full catalogue. Pool budget and governance stay unchanged; tests already pass. This does not meet the plan’s unauthorized-read/write gate.

**2. Per-module roles, `SET ROLE` on the existing login and pools (recommended).** Non-login roles, one per module schema, hold that schema’s grants (outbox exception on the strata role). `pemo_app` stays the only login, `NOINHERIT`, membership only, no table grants. Each request or transaction does `SET LOCAL ROLE` to the module role, or to a named coordinator role for approved cross-module writes. Pool count and the 90/100 budget do not change. Cost is the connection wrapper (set the role inside the transaction; `RESET ROLE` or `DISCARD` before pool reuse) plus grant-script and R6-test changes. A forgotten `SET ROLE` fails closed; a missed reset on pool release would leak the previous role.

**3. Per-module roles and separate pools.** The same split, but each module pool logs in as its own role. Isolation does not depend on `SET ROLE`. Extra logins and pools on top of nine × 5 × replicas will not fit 90/100 without cutting pool size or replica headroom. Open-case cannot span two pools in one transaction, so a coordinator pool — or a return to `SET ROLE` — is still required. Heavier than option 2, and hostile to the budget, for little extra safety.

**4. `SECURITY DEFINER` functions only.** See below. Use for a particular coordinator write if that is cleaner than a coordinator-role grant — not as the only isolation for every table.

## Per-module roles versus narrowly granted commands / `SECURITY DEFINER` functions

Both can close F6. They differ in where the privilege lives.

Per-module roles keep ordinary SQL and the repositories unchanged. The login has no table grants, so a missed `SET ROLE` fails closed. The coordinator role is the named exception for the few multi-schema acts. The risk is operational: `SET LOCAL` must run inside the transaction, and pool release must `RESET ROLE` or `DISCARD` so a non-local leftover cannot follow the connection. Governance extends `010-grants.sql`, `grants-complete.sh` and `premise-arm-guard.sh` to the new roles, still parameterised through `PEMO_APP_ROLE` / `PEMO_OWNER_ROLE` / `PEMO_APP_ROLE_MODEL`.

Narrowly granted commands / `SECURITY DEFINER` functions revoke direct `INSERT` (and, if required, `SELECT`) on foreign-module tables. Approved cross-module writes go through functions owned by a privileged role, with `EXECUTE` granted to `pemo_app` or a module role. Open-case stays one transaction if it calls those functions on the same connection. Pool budget is unchanged, and there is no role to forget on release. Cost is writing, locking down (`search_path` fixed inside each function, definer rights as narrow as possible) and testing each function; a bug runs with the owner’s rights. A good fit for a few named exceptions (the qualified `INSERT INTO access.audit_event` inside `auditedWrite` is the obvious candidate). A poor fit as the only isolation for every table — that would wrap the repository layer, which the plan said not to rebuild.

Recommend **option 2**. Use option 4 only for a particular coordinator write if a function is cleaner than a coordinator-role grant. Do not multiply pools. Do not stay on option 1.

## How open-case stays one connection and one commit

**Today (already true, and must be preserved).** `openCaseFromTicket` calls `auditedWrite(helpdeskDb, …)`. `auditedWrite` refuses a handle already in a transaction, then opens one `db.transaction` on a helpdesk-pool client (`search_path=helpdesk`). Inside the act: an advisory transaction lock, `readTicket(tx)` on helpdesk, `txOnSchema(tx, 'service_case')` (`SET LOCAL search_path TO service_case, pg_catalog` on the same client, then restore), `INSERT INTO service_case …`, then `INSERT INTO ticket …` on `tx`. If the act is commit-worthy, `auditedWrite` runs `INSERT INTO access.audit_event (…) VALUES (…)` on the same `tx`. The transaction commits, or rolls back on refusal or error. No second pool, no two-phase commit. The role throughout is still `pemo_app`, which is why a helpdesk session can insert the audit row today.

**Under option 2 — switch points and grants.** Do not open a second connection. Keep `auditedWrite` as the transaction owner and `txOnSchema` as a search-path switch only.

1. Checkout a helpdesk-pool client as `pemo_app` (`NOINHERIT`, no table grants). `session_user` stays `pemo_app`.
2. `auditedWrite` issues `BEGIN`.
3. Immediately: `SET LOCAL ROLE pemo_coordinator` (name to be chosen). This runtime role alone holds `SELECT`+`INSERT` on the tables this act already touches: `helpdesk.ticket` (and any other helpdesk table the act reads or inserts, such as `ticket_message` on related acts), `service_case.service_case`, and `access.audit_event`. It does not hold `SELECT`+`INSERT` on the rest of the catalogue.
4. The existing act and the audit `INSERT` run as today, still on this client. `txOnSchema` does not change role.
5. `COMMIT` ends `SET LOCAL`; `current_user` returns to `pemo_app`.
6. On pool release, `RESET ROLE` or `DISCARD ALL` so a non-local leftover cannot leak into the next checkout.

Ordinary helpdesk work does `SET LOCAL ROLE pemo_helpdesk` instead (`SELECT`+`INSERT` on helpdesk only), so `INSERT INTO access.audit_event` from that session must fail. A tighter variant switches `SET LOCAL ROLE` mid-transaction (helpdesk → service_case → helpdesk → a narrow audit role). That is more precise and easier to miss on a new statement; the lean MVP is one coordinator role for the whole `auditedWrite` of each named exception.

## Migration and rollback

Expand, then contract, on a private `initdb` cluster only until accepted. Do not create these roles on the shared `127.0.0.1:5432` cluster. No row-data migration.

**Forward.** (1) Add non-login module roles and one coordinator role; `GRANT` each to `pemo_app`; `ALTER ROLE pemo_app NOINHERIT`. (2) Grant each module role `SELECT`+`INSERT` on its own schema only; keep the outbox column `UPDATE` on the strata role; grant the coordinator only the named-exception tables. Leave today’s `pemo_app` table grants in place for this step so a wrapper deploy cannot strand a process. (3) Set the role once per request or transaction in the existing platform connection helper; `RESET ROLE` or `DISCARD` on pool release. Do not rebuild the repositories. (4) `REVOKE` table grants from `pemo_app` itself, so a session that forgot `SET ROLE` fails closed. (5) Extend `010-grants.sql`, `grants-complete.sh` and `premise-arm-guard.sh` so they check this model, still parameterised as above. (6) Extend the R6 tests as below.

**Rollback.** Re-grant `SELECT`+`INSERT` on all `pemo_owner` schemas to `pemo_app` (today’s `010-grants.sql` rule) and reassert the outbox column `UPDATE`. The wrapper’s `SET LOCAL ROLE` can stay (harmless while `pemo_app` again has the grants) or be reverted in the same change. Module and coordinator roles can be dropped later; they are cluster-scoped, so they are dropped only on the private cluster used for this work. No data rewrite, and no `REASSIGN OWNED` / `DROP OWNED` / `ALTER DATABASE` on the shared cluster.

## How R&T will prove the boundary

All of this on a private `initdb` under `/tmp`, `listen_addresses=''`, unix socket outside DATADIR, stopped and deleted afterwards. Never on `127.0.0.1:5432`.

- **Unauthorised writes.** For each module role, schema-qualified `INSERT` into every *other* schema’s representative tables (including `access.audit_event` and `helpdesk.ticket`) must fail. Own-schema `SELECT`+`INSERT` must still succeed. `UPDATE`/`DELETE` remain denied. The six-column outbox `UPDATE` succeeds only as the strata role; `UPDATE(to_address)` / `UPDATE(body_text)` still fail. A property-scoped session must not `INSERT INTO access.audit_event`.
- **Unauthorised reads.** The same matrix for schema-qualified `SELECT` on foreign schemas, except any cross-module reads PT explicitly leaves allowed (question 1). If PT tightens reads, a property-scoped `SELECT` from `helpdesk.ticket` must fail.
- **Coordinator path still atomic.** `openCaseFromTicket` (and the other named exceptions, once listed) still commits ticket, case and audit in one transaction: a forced failure after the case insert and before the audit insert leaves zero of the three; a success leaves all three. No second connection.
- **Pool release resets the role.** After a coordinator or module transaction, release the client with `RESET ROLE` or `DISCARD`. The next checkout must show `current_user = session_user = pemo_app` and must fail `INSERT INTO access.audit_event` until `SET LOCAL ROLE` runs again. A recycled connection must not carry the previous grants.

## Open questions for PT

1. Must unauthorized **reads** be denied as well as writes? The plan says both. Some legitimate flows (for example notice read-intersection) may still need cross-module `SELECT`. If so, which reads stay allowed?
2. Besides open-case (ticket, case and audit) and the outbox column `UPDATE`, which operations are named coordinator exceptions? (`auditedWrite` is used by other acts; each may need the coordinator, or only the audit insert.)
3. Is a role per existing module schema the right grain, or is a coarser first cut (own-schema vs coordinator) enough for MVP?
4. Confirm `pemo_app` stays the only login, with module and coordinator roles non-login, and that this work stays off the shared `127.0.0.1:5432` cluster until accepted.
5. Given that a privilege boundary cannot ship merely as P2, should this MVP precede Batch C / launch, even though implementation was deferred from Batches A and B?
