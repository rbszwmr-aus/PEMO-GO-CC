# RT5-F6 call-site table

- Version: 0.1
- Date: 2026-11-20 (AEDT, Australia/Sydney)
- Status: the enumerated crossings for the per-module privilege split
- Changelog:
  - 0.1: initial table, taken from the running call sites at 26c5c52 and the
    named commands introduced with this change.

This is the versioned call-site table required by the RT5-F6 architect
decision. Each row names a call site, the reads and writes it performs, and
the login that is permitted to run it. A crossing that is not in this table
is not authorised.

Role names are parameterised (`pemo.login_prefix`, default `pemo_app_`). The
login column uses the default names.

## Named SECURITY DEFINER commands

These run on the **caller module's connection**, in the **same transaction** as
the act. They are `SECURITY DEFINER` with a fixed `search_path`, owned by
`pemo_definer_commands` (NOLOGIN, not a member of any module login). `EXECUTE`
is granted only to the intended caller. Module logins cannot `SET ROLE` to the
definer or to a peer.

| Command | Reads | Writes | Permitted callers |
|---|---|---|---|
| `access.append_audit_event` | — | `access.audit_event` INSERT | the eight production module logins (`pemo_app_platform`, `pemo_app_property`, `pemo_app_resident`, `pemo_app_home_safety`, `pemo_app_access`, `pemo_app_notices`, `pemo_app_helpdesk`, `pemo_app_strata`) |
| `platform.lookup_idempotency` | `platform.idempotency_record` | — | the eight production module logins |
| `platform.record_idempotency` | — | `platform.idempotency_record` INSERT | the eight production module logins |
| `service_case.open_from_ticket` | — | `service_case.service_case` INSERT (open / case_opened) | `pemo_app_helpdesk` only |
| `service_case.append_assertion` | — | `service_case.service_case` INSERT | `pemo_app_helpdesk` only |

`dev_scaffold` is not a permitted caller of any of these commands.
`service_case` has no login and no pool.

`auditedWrite` / `idempotentAuditedWrite` always invoke the audit and
idempotency commands on the **act's own module connection**, never on a second
pool.

## Composition-layer call sites

Cross-module **reads** that the decision names (hierarchy / serving-scope
lookups; resident / household audience resolution for Notices and Home Safety)
already go through the owning module's query port in TypeScript. No new SQL
projection is introduced. The caller login does not `SELECT` the foreign
schema.

| Call site | Reads | Writes | Permitted callers |
|---|---|---|---|
| `modules/platform/src/audit/audited-write.ts` (`auditedWrite`) | — | `access.append_audit_event` (same transaction as the act) | any production module login performing an audited act, on its own pool |
| `modules/platform/src/audit/audited-write.ts` (`idempotentAuditedWrite`) | `platform.lookup_idempotency` | act writes on the caller schema; `access.append_audit_event`; `platform.record_idempotency` (all in one transaction) | any production module login performing an idempotent audited act, on its own pool |
| `apps/api/src/server.ts` — occupancy, grant, membership, and related staff/resident write routes | the route's own module handle | own-schema INSERT plus `auditedWrite` / `idempotentAuditedWrite` as above | the module login of the handle the route already uses (`pemo_app_resident`, `pemo_app_access`, …) |
| `apps/api/src/management/compose-mail.ts` — mark an outbox send | `strata.email_outbox` (Strata handle) | column UPDATE of `status, claimed_at, attempt, transport, transport_detail, send_key` on `strata.email_outbox`; `auditedWrite` on `modules.accessDb` | `pemo_app_strata` for the outbox; audit append is invoked from the access handle (`pemo_app_access`) |
| `apps/api/src/management/notice-acts.ts` — revise, correct, submit, approve, decline, publish, withdraw | `notices.*` on the notices handle; resident/household audience resolution via the **resident** query port (no SQL into `resident.*` or `property.*` from the notices login) | `notices.*` INSERT; `auditedWrite` / `idempotentAuditedWrite` on `auditDb` | `pemo_app_notices` for notice rows; audit/idempotency via the named commands; audience reads on `pemo_app_resident` through the owning port |
| `apps/api/src/management/notice-acts.ts` / Home Safety audience and hierarchy | serving-scope and hierarchy via the **property** query port; resident/household via the **resident** query port | own-schema writes of the calling module | `pemo_app_property` and `pemo_app_resident` for those ports; `pemo_app_home_safety` / `pemo_app_notices` do not read the foreign schemas directly |
| `apps/api/src/management/case-acts.ts` — ticket triage, link, message, status, reopen; ticket intake | `helpdesk.*` | `helpdesk.ticket` / `ticket_message` / `ticket_reference` / `ticket_satisfaction` INSERT; `auditedWrite` on `auditDb` (except where noted) | `pemo_app_helpdesk` |
| `apps/api/src/management/case-acts.ts` — assign, note, status, external-completion, close, reopen case | `service_case.*` SELECT (restricted read); `helpdesk.*` as needed | `service_case.append_assertion`; `auditedWrite` on `auditDb` | `pemo_app_helpdesk` (no `service_case` login) |
| `apps/api/src/management/case-acts.ts` — `openCaseFromTicket` | `helpdesk.ticket` SELECT; `service_case.*` SELECT | `service_case.open_from_ticket`; `helpdesk.ticket` INSERT (link the primary case); `access.append_audit_event` — **one connection, one transaction** on the helpdesk pool | `pemo_app_helpdesk` only |
| `apps/api/src/management/case-acts.ts` — `resolveTicketFromCase` | `service_case.*` SELECT; `helpdesk.ticket` SELECT | `service_case.append_assertion` (closure); `helpdesk.ticket` / `ticket_message` INSERT; `access.append_audit_event` — **one connection, one transaction** on the helpdesk pool | `pemo_app_helpdesk` only |


## Schema USAGE for named commands

PostgreSQL will not resolve `platform.lookup_idempotency` or
`access.append_audit_event` unless the caller has `USAGE` on that schema.
`010-grants.sql` grants schema `USAGE` on `access` and `platform` to every
production module login for this reason. It is not a table grant: a Property
connection still cannot `SELECT` or `INSERT` `access.audit_event` or
`platform.idempotency_record`.

## What is not a call site

- There is no coordinator login and no `SET ROLE` in the application.
- There is no `service_case` or `integration` pool. `integration` stays
  owner-only. `service_case` is reached only through the named commands
  (and the restricted helpdesk SELECT used by `readCase` in the same
  transaction).
- Direct `INSERT INTO access.audit_event`, `INSERT INTO platform.idempotency_record`,
  and `INSERT INTO service_case.service_case` from a module login are denied.
- The legacy shared login `pemo_app` holds no table grants.
