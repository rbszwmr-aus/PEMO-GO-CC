# P1 fix round 3 — test run note

**Version:** v0.6  
**Date:** 20 November 2026 (Australia/Sydney, AEDT, UTC+11)  
**Branch:** `fix/p1-review-r1-r3`  
**Base recorded before Round 4b:** `d49e99dcc0c50804837e944907398d02028b29b2` (clean tree)  
**Base recorded before A2:** `76b13ff8a8c6f603c435a9349b61b910506b8542` (clean tree)

**Changelog**
- v0.6 — A2 (RT5-F4, RT5-F11/F14, run-note corrections). Admin/migration connections use `PEMO_DB_ADMIN_STATEMENT_TIMEOUT_MS` (default 0, off), independent of the runtime 5 s cap. The R6 test accepts a configured `PEMO_APP_ROLE` such as `pemo_app`, and the 0-row privilege test title no longer overclaims. The isolated server is PostgreSQL 16, not 17. `PEMO_DB_REPLICA_COUNT` is advisory only; two replicas at defaults are 90 connections on a `max_connections=100` cluster. Repro is private-cluster only. Per-module DB privileges (RT5-F6) are deferred to the architect and are not implemented here.
- v0.5 — Role, ownership and privilege setup (R6, grants-complete, premise-arm-guard) runs only on a private initdb cluster under `/tmp/<name>`, unix socket only (`listen_addresses=''`, `PGHOST=/tmp/<name>`), then stopped and deleted. Never on the shared `127.0.0.1:5432` cluster.
- v0.4 — Round 4b (ranked P2 Batch A): stop reading auth tokens from the URL in normal builds (R8); runtime role boundary tests plus parameterised governance role names (R6); pool and statement deadlines, email batch cap, and `/health` pool stats (R7).
- v0.3 — Round 4a (sign-off items after the independent re-test of `0ff2af8`): management-web `tsc` (RT3-P2-A); `EXPECTED_EXTRA` is read and the 0145 outbox UPDATE is column-level (RT3-P2-B); manual resend uses the same post-accept `markResult` guard as a normal send (RT3-P2-C); F1d refused-connect is a stale unix socket. P2-3 and P2-5 stay deferred.
- v0.2 — Round 3: flip the default mailer classifier against real nodemailer 6.10.1; grant `pemo_app` UPDATE on `strata.email_outbox` in 0145; carry the status rename into OpenAPI and the management SPA; make manual resend claim-idempotent; record deferred P2/P3 items.
- v0.1 — Round 2 disposable-DB commands for F1/F3/R1/R2/F2 (see `p1-fix-round2-testrun_v0.1.md`).

This note records how an independent tester can reproduce the isolated PostgreSQL / HTTP / migration / contract checks from a fresh clone of these commits.

## Commits in this round

| SHA | Item |
|-----|------|
| `3c7007aa69c96601b4c56cce0c3a958ea57c77b2` | R8: stop reading auth tokens from the URL; `token=demo` only behind `VITE_PEMO_ALLOW_URL_DEMO_TOKEN=1`; credentials only to the configured API base |
| `480e9ec6f7d0bf4afcf7d58ae565d06e2e6ec91e` | R6: runtime role cannot escalate or write outside grants; `grants-complete.sh` / `premise-arm-guard.sh` take `PEMO_APP_ROLE` / `PEMO_OWNER_ROLE` / `PEMO_APP_ROLE_MODEL` |
| `52e85a2eae50dd9aca8b712f48b74c1cbca0f806` | R7: env pool max, connect timeout, `statement_timeout`, email batch cap, `/health` pool stats, budget note |
| `9983c547be7578fecd95f2423a98e548bc4ae269` | docs: run note v0.5 (private-cluster guard) |
| `76b13ff8a8c6f603c435a9349b61b910506b8542` | R8 follow-up: keep the session token across a StrictMode remount |
| `225da8d895c132aa04c9639e3b72c9f3019c99e8` | A2 / RT5-F4: `PEMO_DB_ADMIN_STATEMENT_TIMEOUT_MS` (default 0, off) for admin/migration, independent of the runtime cap |
| `62b78709d62a2d550000cf506898209ece67c990` | A2 / RT5-F11+F14: R6 accepts a configured `PEMO_APP_ROLE` such as `pemo_app`; 0-row privilege test title no longer overclaims |
| (this file) | docs: run note v0.6; budget note: replica count is advisory, two replicas = 90/100, admin timeout knob |

Round 4a commits (`422f92e` … `d49e99d`) remain on the branch; they are not redone here.

## Safety

- All isolated DB tests use a **private `initdb` cluster** under `/tmp/<name>`, `listen_addresses=''` (unix socket only), stopped and deleted afterwards. Never run `migrateUp`, 0145, role, or grant work against the shared `pemo_grok` database or the shared `127.0.0.1:5432` cluster. Do not clone with `createdb -T pemo_grok` on that cluster.
- Fake SMTP only, on a **unix socket**, with no TCP listeners. Unset `SMTP_HOST`, `SMTP_URL`, `SMTP_USER`, and `SMTP_PASS` in the shell. Tests that drive the real nodemailer client install `setCreateTransport` + `getSocket` pointing at that socket, and set `SMTP_HOST=smtp.test.invalid` only inside those tests. F1d's refused-connect case binds an AF_UNIX socket and abandons the inode so `connect()` is `ECONNREFUSED` (errno -111); it does not open `127.0.0.1:1` or any other TCP port.
- Do not bind or restart ports `3200`, `5185`, `5186`, or reserved `3100` / `5173`–`5176`. The harness uses Fastify `inject()` and does not listen.
- Do not push. Local commits only.
- **Never run `REASSIGN OWNED`, `DROP OWNED`, or `ALTER DATABASE`.** On this cluster (PostgreSQL 16, previously mis-stated as 17), `REASSIGN OWNED BY pemo_grok` also reassigns ownership of the `pemo_grok` *database* (a cluster-wide object). To make `grants-complete.sh` see the catalogue, `ALTER SCHEMA … OWNER TO` a throwaway owner on the clone only, then drop the clone (which drops those schema ownerships with it).
- Do not create, alter or drop databases or roles on the shared `127.0.0.1:5432` cluster, and do not use `createdb -T pemo_grok` there. All isolated DB tests use a private `initdb` cluster.
- **Role setup is on a private cluster only** (see below). Do not create, alter or drop any role on the shared `127.0.0.1:5432` cluster, not even `rt_*` names.
- **Never create roles named like the real ones (`pemo_app`, `pemo_owner`) on the shared cluster.** `CREATE ROLE` is cluster-global. Use `rt`-prefixed throwaway names (this run: `rt_pemo_app_4b`, `rt_pemo_owner_4b`) and drop them afterwards. If a governance script or test hard-codes the catalogue names, parameterise it via `PEMO_APP_ROLE`, `PEMO_OWNER_ROLE`, and `PEMO_APP_ROLE_MODEL` (the last stays `pemo_app`, the name in `database/roles/000-roles.sql`).
- Do not record shared-cluster state with writes. Catalogue names `pemo_app` / `pemo_owner` may be created **only** inside a private `initdb` cluster that is then stopped and deleted.

## Private cluster for role setup

All role, ownership and privilege setup (R6, `grants-complete.sh`, `premise-arm-guard.sh`) runs **only** on a private cluster: `initdb` under `/tmp/<name>`, `listen_addresses=''` (unix socket only), stopped and deleted afterwards. Never on the shared `127.0.0.1:5432` cluster. Point those commands at that private socket (`PGHOST=/tmp/<name>`). Do not create, alter or drop roles, change ownership, run `REASSIGN`/`DROP OWNED`, or use `SUPERUSER` test accounts on the shared cluster, not even for throwaway databases.

## Runtime role

The catalogue names the restricted API role `pemo_app` (SELECT+INSERT, plus the 0145 exception: column-level UPDATE on `strata.email_outbox` for `status`, `claimed_at`, `attempt`, `transport`, `transport_detail`, `send_key`). This amd128 cluster has no `pemo_app` and no `pemo_owner` login; schemas in `pemo_grok` are owned by `pemo_grok`.

Round 4b used throwaway `rt_pemo_app_4b` / `rt_pemo_owner_4b` on a clone and did not create the catalogue names on the shared cluster. **A2 creates `pemo_app` and `pemo_owner` only on the private `initdb` cluster**, points `PEMO_DB_USER` / `PEMO_APP_ROLE` / `PEMO_R1_USER` at `pemo_app`, migrates and seeds there, then stops and deletes that cluster. Those names must never be created on `127.0.0.1:5432`.

`grants-complete.sh` *reads* `EXPECTED_EXTRA` and lists that column-level UPDATE. A whole-row UPDATE, or UPDATE on `to_address` / `body_text`, is still EXCESS. `010-grants.sql` reasserts the same columns. `premise-arm-guard.sh` requires a database name matching `^pemo_dev` and a connecting owner that can `ALTER ROLE` the throwaway app role (including `BYPASSRLS` and `SUPERUSER`). Point both scripts at the clone with `PEMO_GOVERNANCE_ENV`, and set `PEMO_APP_ROLE` / `PEMO_OWNER_ROLE` to the `rt_*` names. `PEMO_APP_ROLE_MODEL` stays `pemo_app`. Do not set `PEMO_DB_USER` to `pemo_grok` in that file.

## Commands

All of this isolated run uses a **private PostgreSQL 16 cluster**. Do not run these commands against `127.0.0.1:5432`.

```bash
git rev-parse HEAD
git status --porcelain

PG_BIN=/usr/lib/postgresql/16/bin
DATA=/tmp/pemo-a2pg
SOCK=/tmp/pemo-a2pg-sock   # keep the socket dir *outside* DATADIR; initdb needs an empty directory
PORT=5499
rm -rf "$DATA" "$SOCK"
mkdir -p "$DATA" "$SOCK"
"$PG_BIN/initdb" -D "$DATA" --auth-local=trust --auth-host=reject
cat >> "$DATA/postgresql.conf" <<CONF
listen_addresses = ''
unix_socket_directories = '$SOCK'
port = $PORT
max_connections = 100
CONF
"$PG_BIN/pg_ctl" -D "$DATA" -l "$DATA/pg.log" -w start

# Catalogue roles and a development database on THIS private socket only.
# Do not clone the shared pemo_grok. Do not source database/dev/.env or run
# database/bootstrap.sh / `pnpm run migrate` unless PEMO_DB_HOST/PORT are
# already exported *and* will not be overwritten: bootstrap.sh does
# `set -a; . database/dev/.env`, which would retarget the shared cluster.
# After `pnpm exec tsc -b`, call `node dist/cli/migrate.js` and
# `node dist/cli/seed.js` with the private env already exported, then apply
# database/roles/010-grants.sql as the private owner.

export PEMO_DB_HOST="$SOCK"
export PEMO_DB_PORT="$PORT"
# ... PEMO_DB_NAME, PEMO_DB_USER=pemo_app, PEMO_DB_OWNER_USER, passwords,
#     PEMO_APP_ROLE=pemo_app, PEMO_ENV=development, PEMO_DEV_TOKEN_SECRET ...
unset SMTP_HOST SMTP_URL SMTP_USER SMTP_PASS
# Refuse if PEMO_DB_HOST is 127.0.0.1/localhost and PEMO_DB_PORT is 5432.

cd apps/api
pnpm exec tsc -b

node --test --test-concurrency=1 \
  ../../tests/integration/p2-r7-admin-timeout.test.ts \
  ../../tests/integration/p2-r6-db-boundaries.test.ts

# Stop and delete the private cluster. Never leave it running.
"$PG_BIN/pg_ctl" -D "$DATA" -m fast stop
rm -rf "$DATA" "$SOCK"
```

`PEMO_DB_REPLICA_COUNT` is advisory only (read for the budget note, not checked at startup). Two replicas at the default `PEMO_DB_POOL_MAX=5` are 90 connections; on a cluster with `max_connections=100` that leaves a thin remainder after `superuser_reserved_connections`.

Admin and migration connections use `PEMO_DB_ADMIN_STATEMENT_TIMEOUT_MS` (default 0, off), which is independent of `PEMO_DB_STATEMENT_TIMEOUT_MS` (default 5000).

## What this run showed

Recorded 20 November 2026, 00:03:42–00:04:28 AEDT (Australia/Sydney, UTC+11), from clean `d49e99d`. Live listeners were left untouched: `:3200` pid 121988, `:5185` pid 3035582, `:5186` pid 3035711, and existing MainThread holders of `:5173`–`:5176`.

**Roles used:** `rt_pemo_app_4b` (restricted runtime) and `rt_pemo_owner_4b` (throwaway governance owner, SUPERUSER/CREATEROLE/BYPASSRLS only for `premise-arm-guard.sh`, then dropped). On the shared cluster, catalogue names `pemo_app` and `pemo_owner` were not created in 4b. A2 created them only on the private `initdb` cluster, which was then deleted.

**Shared `pemo_grok` before and after:** owner `pemo_grok`; `strata.email_outbox.send_key` count `0`; no `pemo_app` / `pemo_owner`; no leftover `pemo_dev_*` or `rt_pemo_*_4b`.

| Check | Result |
|-------|--------|
| `apps/api` `pnpm exec tsc -b` | pass |
| `apps/management-web` `pnpm exec tsc --noEmit` | pass |
| migrateUp on `pemo_dev_r4b` only (0145 recorded) | pass |
| management-web R8 unit tests (11) | pass |
| management-web live-client unit tests | pass (3 live-API cases skipped, as before: they need a running API) |
| inventory-complete (new R8 assertions classified) | pass |
| contract `strata-mailer` (2) | pass |
| case-handling + case-acts (C3 included) | pass |
| F1a–F1g + F1 resend guard (13) | pass |
| F2 send_key migration | pass |
| F3 + F3h delivery coverage | pass |
| R1 runtime-role atomicity + concurrent open | pass (as `rt_pemo_app_4b`) |
| R2 operation matrix + authority | pass |
| R3 outbox-before-send | pass |
| R6 not superuser / no escalate / no ungranted writes / atomic open-case | pass |
| R7 email batch bound, pool wait timeout, statement cancel + recovery, `/health` pools | pass |
| isolated integration+contract suite | **61 / 61 pass** |
| `grants-complete.sh` | pass — role model holds, 72 tables, SELECT+INSERT, plus documented extra: `strata.email_outbox` UPDATE (columns) |
| `premise-arm-guard.sh` | pass — bites on BYPASSRLS, CREATEDB, CREATEROLE, SUPERUSER |

### A2 (20 November 2026, 00:48:07–00:48:10 AEDT, Australia/Sydney, UTC+11)

From `76b13ff`. Private PostgreSQL 16 cluster at `/tmp/pemo-a2pg`, unix socket `/tmp/pemo-a2pg-sock`, port 5499, `listen_addresses=''`. Roles `pemo_owner` and `pemo_app`, and database `pemo_dev_a2`, existed only on that cluster. `migrate.js` applied 61 files; `010-grants.sql` and `seed.js` ran against the same socket. The cluster was stopped and deleted after the tests. No writes to `127.0.0.1:5432`.

| Check | Result |
|-------|--------|
| `apps/api` `pnpm exec tsc -b` | pass |
| `node --test --test-concurrency=1 tests/integration/p2-r7-admin-timeout.test.ts` | pass (1/1) — runtime 400 ms timeout is independent of admin 0 / off |
| private `node dist/cli/migrate.js` (61 applied) | pass |
| private `node dist/cli/seed.js` | pass |
| `node --test --test-concurrency=1 tests/integration/p2-r6-db-boundaries.test.ts` with `PEMO_APP_ROLE=pemo_app` | pass (3/3) |

The 4b isolated 61/61 suite, management-web tsc, and governance scripts were not re-run in A2.

## What this round covers

- **R8:** Normal builds ignore any URL token and strip `token` from the query on load. `token=demo` is ingested only when `VITE_PEMO_ALLOW_URL_DEMO_TOKEN` is exactly `1` (off by default), and is still stripped so history and shared links stay clean. `writeLiveConfig` never writes a token back onto the URL. `liveBaseUrl` / `maySendCredentials` reject an unapproved `api=` destination. Live clients send a bearer only to the configured same-origin or `VITE_API_BASE` API. The session token is memory-only; nothing is stored in `localStorage`. This does not claim that previously copied URLs or third-party logs have been erased. `VITE_PEMO_AUTO_LIVE` is a separate front-counter switch and is left alone.
- **R6:** Tests prove the runtime role is not a superuser, cannot `CREATE ROLE` or `ALTER ROLE … SUPERUSER`, owns no tables, cannot UPDATE/DELETE audit or case rows, and cannot UPDATE `to_address` / `body_text` on `strata.email_outbox`, while a column-level `status` UPDATE and an atomic open-case (ticket, case, audit) still succeed. `search_path` is not treated as an ACL. The repository layer is unchanged. The R6 test accepts a configured `PEMO_APP_ROLE` such as `pemo_app`; it no longer requires an `rt_*` name. The 0-row privilege test title no longer claims writes outside granted tables. Per-module privileges (RT5-F6) are not implemented. Governance scripts default to the catalogue names but accept `rt_*` names through the environment.
- **R7:** `PEMO_DB_POOL_MAX` (default 5), `PEMO_DB_CONNECT_TIMEOUT_MS` (2000), `PEMO_DB_STATEMENT_TIMEOUT_MS` (5000), `PEMO_DB_REPLICA_COUNT` (1), and `PEMO_EMAIL_BATCH_SIZE` (50). All nine module pools in `wiring.ts` take that budget. `/health` remains backward compatible and adds `pools`. A send request claims at most the batch size and leaves the rest queued; the atomic outbox claim still prevents duplicate dispatch. `docs/ops/db-pool-budget.md` records process capacity (`max × 9 × replicas`) versus `max_connections`. `PEMO_DB_REPLICA_COUNT` is advisory only; two replicas at defaults are 90 connections on a `max_connections=100` cluster. Admin connections use `PEMO_DB_ADMIN_STATEMENT_TIMEOUT_MS` (default 0, off). Tests: a saturated pool wait times out cleanly and recovers; a `pg_sleep` is cancelled by `statement_timeout` and the next query works.
- **RT5-F4:** `createAdminDb` takes `PEMO_DB_ADMIN_STATEMENT_TIMEOUT_MS` (default 0, off), independent of the runtime `PEMO_DB_STATEMENT_TIMEOUT_MS` (default 5000). A focused test proves the two settings and the live `statement_timeout` / `pg_sleep` behaviour are independent.

## Deferred (not required to close the P1)

- **P2-3:** a stale `sending` row is presented as `unknown` but `POST .../resend` still returns 400 because the stored status is `sending`. There is still no invoice resend path. Needs a small design for which stored states are manually resendable, and whether invoice gets the same route.
- **P2-5:** `log-only` remains terminal, so configuring SMTP later does not automatically send, and a repeat admin test to the same address is a no-op. Needs a design that distinguishes a log-only probe from an intended later delivery without silently double-sending.
- **P3-1 to P3-9:** as in v0.2, except the outbox `to_address` / `body_text` writability item is closed by the column-level UPDATE grant. The remaining P3s each need their own small design; none blocks this sign-off.
- **RT5-F6:** per-module DB privileges (a session of the runtime role can still SELECT and INSERT across schemas). Explicitly deferred as an architect design item; not implemented in v0.6.
- Later P2 batches (R4 / R5 / R9 / D1) are not part of this run.

## Deviations

- A first attempt applied 0145 to the MAIN clone with `psql -f`, which left `migrateUp` failing with `column "subject_version" of relation "email_outbox" already exists`. That run was discarded. The successful run uses `migrateUp` so the migration is recorded, then grants the column-level UPDATE to `rt_pemo_app_4b`. Neither attempt created `pemo_app` or `pemo_owner`. After the failed attempt, throwaway databases and `rt_*` roles were dropped; shared `pemo_grok` ownership stayed `pemo_grok` and `send_key` stayed absent.
- The isolated management-web gate is the R8 unit tests plus `inventory-complete`, not `pnpm run test:node`. The full node suite also runs production-artefact tests that require a prior `pnpm run build`; that requirement is unchanged and was not part of this isolated run.
- **RT5-F6 (deferred):** per-module DB privileges are an architect design item and are not implemented in this round.
- A2 first `initdb` failed because the unix-socket directory was created inside DATADIR (initdb requires an empty directory). Failed `psql` attempts targeted the missing private socket, not `127.0.0.1:5432`. The leftover directory was removed. The successful run keeps the socket directory outside DATADIR (`/tmp/pemo-a2pg-sock`).
- A2 does not use `database/bootstrap.sh` or `pnpm run migrate`: those source or `--env-file` `database/dev/.env`, and a shell source would overwrite a private `PEMO_DB_HOST`. Migrations and seeds were run as `node dist/cli/migrate.js` and `node dist/cli/seed.js` with the private env already exported.

## SMTP administration

The access catalogue has no narrower email-admin role. The SMTP test remains gated by `grant_administrator`. That is an MVP decision for PT, documented in `docs/contracts/management-web-v0-strata-notices-live.md`.
