# P1 fix round 3 — test run note

**Version:** v0.4  
**Date:** 20 November 2026 (Australia/Sydney, AEDT, UTC+11)  
**Branch:** `fix/p1-review-r1-r3`  
**Base recorded before this round:** `d49e99dcc0c50804837e944907398d02028b29b2` (clean tree)

**Changelog**
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
| (this file) | docs: run note v0.4 |

Round 4a commits (`422f92e` … `d49e99d`) remain on the branch; they are not redone here.

## Safety

- Use a **disposable** database cloned from `pemo_grok`. Never run `migrateUp` or 0145 against the shared `pemo_grok` database.
- Fake SMTP only, on a **unix socket**, with no TCP listeners. Unset `SMTP_HOST`, `SMTP_URL`, `SMTP_USER`, and `SMTP_PASS` in the shell. Tests that drive the real nodemailer client install `setCreateTransport` + `getSocket` pointing at that socket, and set `SMTP_HOST=smtp.test.invalid` only inside those tests. F1d's refused-connect case binds an AF_UNIX socket and abandons the inode so `connect()` is `ECONNREFUSED` (errno -111); it does not open `127.0.0.1:1` or any other TCP port.
- Do not bind or restart ports `3200`, `5185`, `5186`, or reserved `3100` / `5173`–`5176`. The harness uses Fastify `inject()` and does not listen.
- Do not push. Local commits only.
- **Never run `REASSIGN OWNED`, `DROP OWNED`, or `ALTER DATABASE`.** On this PostgreSQL 17 cluster, `REASSIGN OWNED BY pemo_grok` also reassigns ownership of the `pemo_grok` *database* (a cluster-wide object). To make `grants-complete.sh` see the catalogue, `ALTER SCHEMA … OWNER TO` a throwaway owner on the clone only, then drop the clone (which drops those schema ownerships with it).
- Never make any role or ownership change outside a throwaway database you created yourself. The only permitted use of shared `pemo_grok` is as a **read-only template** (`createdb -T pemo_grok`).
- **Never create roles named like the real ones (`pemo_app`, `pemo_owner`) on the shared cluster.** `CREATE ROLE` is cluster-global. Use `rt`-prefixed throwaway names (this run: `rt_pemo_app_4b`, `rt_pemo_owner_4b`) and drop them afterwards. If a governance script or test hard-codes the catalogue names, parameterise it via `PEMO_APP_ROLE`, `PEMO_OWNER_ROLE`, and `PEMO_APP_ROLE_MODEL` (the last stays `pemo_app`, the name in `database/roles/000-roles.sql`).
- Before and after the run, record `\l pemo_grok` ownership and confirm `send_key` is absent in the shared database. Confirm that no `pemo_app` or `pemo_owner` role exists on the cluster at the end.

## Runtime role

The catalogue names the restricted API role `pemo_app` (SELECT+INSERT, plus the 0145 exception: column-level UPDATE on `strata.email_outbox` for `status`, `claimed_at`, `attempt`, `transport`, `transport_detail`, `send_key`). This amd128 cluster has no `pemo_app` and no `pemo_owner` login; schemas in `pemo_grok` are owned by `pemo_grok`.

This round does **not** create those catalogue names. The commands below create throwaway `rt_pemo_app_4b` / `rt_pemo_owner_4b`, grant SELECT+INSERT (and the column-level outbox UPDATE) on the clones, and point `PEMO_DB_USER` / `PEMO_APP_ROLE` / `PEMO_R1_USER` at the throwaway app role. 0145 is applied to the MAIN clone only, through `migrateUp` (so it is recorded in `schema_migrations`). The `GRANT … TO pemo_app` statements inside 0145 are a no-op while that role does not exist; the repro grants the same columns to `rt_pemo_app_4b` afterwards.

`grants-complete.sh` *reads* `EXPECTED_EXTRA` and lists that column-level UPDATE. A whole-row UPDATE, or UPDATE on `to_address` / `body_text`, is still EXCESS. `010-grants.sql` reasserts the same columns. `premise-arm-guard.sh` requires a database name matching `^pemo_dev` and a connecting owner that can `ALTER ROLE` the throwaway app role (including `BYPASSRLS` and `SUPERUSER`). Point both scripts at the clone with `PEMO_GOVERNANCE_ENV`, and set `PEMO_APP_ROLE` / `PEMO_OWNER_ROLE` to the `rt_*` names. `PEMO_APP_ROLE_MODEL` stays `pemo_app`. Do not set `PEMO_DB_USER` to `pemo_grok` in that file.

## Commands

From a checkout of this branch, with `database/dev/.env` available (the `--env-file` path below is the one used on amd128). `--env-file` does not override variables already set in the shell, so the `PEMO_*` exports win.

```bash
git rev-parse HEAD
git status --porcelain

# Before: shared database owner and send_key must be unchanged; no catalogue roles.
sudo -n -u postgres psql -c '\l pemo_grok'
sudo -n -u postgres psql -At -c "SELECT r.rolname FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE d.datname='pemo_grok';"
sudo -n -u postgres psql -d pemo_grok -At -c "SELECT count(*) FROM information_schema.columns WHERE table_schema='strata' AND table_name='email_outbox' AND column_name='send_key';"
sudo -n -u postgres psql -At -c "SELECT rolname FROM pg_roles WHERE rolname IN ('pemo_app','pemo_owner');"

MAIN=pemo_dev_r4b
F2=pemo_dev_r4b_f2
APP=rt_pemo_app_4b
OWNER=rt_pemo_owner_4b
APP_PASS=$(openssl rand -hex 16)
OWNER_PASS=$(openssl rand -hex 16)

sudo -n -u postgres createdb -T pemo_grok -O pemo_grok "$MAIN"
sudo -n -u postgres createdb -T pemo_grok -O pemo_grok "$F2"
sudo -n -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE $APP LOGIN PASSWORD '${APP_PASS}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;"
sudo -n -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE $OWNER LOGIN PASSWORD '${OWNER_PASS}' SUPERUSER CREATEDB CREATEROLE BYPASSRLS;"
sudo -n -u postgres psql -v ON_ERROR_STOP=1 -c "GRANT $APP TO $OWNER WITH ADMIN OPTION;"
sudo -n -u postgres psql -v ON_ERROR_STOP=1 -c "GRANT CONNECT ON DATABASE $MAIN TO $APP, $OWNER;"
sudo -n -u postgres psql -v ON_ERROR_STOP=1 -c "GRANT CONNECT ON DATABASE $F2 TO $APP, $OWNER;"

grant_app() {
  local db="$1"
  sudo -n -u postgres psql -v ON_ERROR_STOP=1 -d "$db" -c "
DO \$\$
DECLARE s text;
BEGIN
  FOR s IN SELECT nspname FROM pg_namespace
            WHERE nspname NOT IN ('pg_catalog','information_schema','pg_toast')
              AND nspname NOT LIKE 'pg_toast%'
              AND nspname NOT LIKE 'pg_temp%'
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO ${APP}', s);
    EXECUTE format('GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA %I TO ${APP}', s);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO ${APP}', s);
  END LOOP;
END
\$\$;"
}
grant_app "$MAIN"
grant_app "$F2"

export PEMO_DB_NAME="$MAIN"
export PEMO_F2_DB_NAME="$F2"
export PEMO_DB_USER="$APP"
export PEMO_DB_PASSWORD="$APP_PASS"
export PEMO_R1_USER="$APP"
export PEMO_R1_PASSWORD="$APP_PASS"
export PEMO_APP_ROLE="$APP"
export PEMO_OWNER_ROLE="$OWNER"
export PEMO_APP_ROLE_MODEL=pemo_app
unset SMTP_HOST SMTP_URL SMTP_USER SMTP_PASS

cd apps/api
pnpm exec tsc -b
cd ../management-web
pnpm exec tsc --noEmit

# Apply 0145 to MAIN through migrateUp (recorded). Never psql -f the up.sql:
# that leaves migrateUp trying to add columns that already exist.
# Refuse if PEMO_DB_NAME is pemo_grok or is not ^pemo_dev.
cd ../api
PEMO_DB_STATEMENT_TIMEOUT_MS=60000 node --env-file=/home/luipt/code/PEMO-grok/database/dev/.env --input-type=module -e '
import { createAdminDb, loadConfig, migrateUp } from "../../modules/platform/dist/index.js";
import path from "node:path";
const config = loadConfig();
const name = config.database.database;
if (name !== process.env.PEMO_DB_NAME) throw new Error("unexpected database: "+name);
if (name === "pemo_grok" || !/^pemo_dev/.test(name)) throw new Error("refusing to migrate "+name);
const admin = createAdminDb(config.databaseOwner, { statementTimeoutMillis: 60000 });
try { console.log(await migrateUp(admin, path.resolve("../../database/migrations"))); }
finally { await admin.close(); }
'
sudo -n -u postgres psql -v ON_ERROR_STOP=1 -d "$MAIN" -c \
  "GRANT UPDATE (status, claimed_at, attempt, transport, transport_detail, send_key) ON strata.email_outbox TO $APP;"

# R8 unit tests + the inventory gate (artefact tests still need a production build
# and are not part of this isolated run).
cd ../management-web
node --test --experimental-strip-types \
  test/live/url-credentials.test.ts \
  test/live/live-client.test.ts \
  test/inventory/inventory-complete.test.ts
cd ../api

node --env-file=/home/luipt/code/PEMO-grok/database/dev/.env --test --test-concurrency=1 \
  ../../tests/integration/case-handling.test.ts \
  ../../tests/integration/case-acts.test.ts \
  ../../tests/integration/p1-r1-runtime-role.test.ts \
  ../../tests/integration/p1-r2-send-authority.test.ts \
  ../../tests/integration/p1-r2-operation-matrix.test.ts \
  ../../tests/integration/p1-r3-outbox-before-send.test.ts \
  ../../tests/integration/p1-f1-outbox-claim.test.ts \
  ../../tests/integration/p1-f2-send-key-migration.test.ts \
  ../../tests/integration/p1-f3-delivery-coverage.test.ts \
  ../../tests/integration/p1-f3-historical-delivery.test.ts \
  ../../tests/integration/strata-live-reads.test.ts \
  ../../tests/contract/strata-mailer.test.ts \
  ../../tests/integration/p2-r6-db-boundaries.test.ts \
  ../../tests/integration/p2-r7-resource-bounds.test.ts
```

After the suite, run the grant checks against the migrated clone. Change **schema** ownership on the clone only. Drop the throwaway database first, then the throwaway roles. Copy SQL files to `/tmp` if `postgres` cannot read the worktree.

```bash
sudo -n -u postgres psql -v ON_ERROR_STOP=1 -d "$MAIN" -c "
DO \$\$
DECLARE s text;
BEGIN
  FOR s IN
    SELECT n.nspname FROM pg_namespace n
     JOIN pg_roles r ON r.oid = n.nspowner
     WHERE r.rolname = 'pemo_grok'
       AND n.nspname NOT LIKE 'pg\_%'
       AND n.nspname NOT IN ('information_schema', 'public')
  LOOP
    EXECUTE format('ALTER SCHEMA %I OWNER TO ${OWNER}', s);
  END LOOP;
END
\$\$;"

GOV=$(mktemp)
cp /home/luipt/code/PEMO-grok/database/dev/.env "$GOV"
{
  echo
  echo "PEMO_DB_NAME=$MAIN"
  echo "PEMO_DB_HOST=127.0.0.1"
  echo "PEMO_DB_USER=$APP"
  echo "PEMO_DB_PASSWORD=$APP_PASS"
  echo "PEMO_APP_ROLE=$APP"
  echo "PEMO_OWNER_ROLE=$OWNER"
  echo "PEMO_APP_ROLE_MODEL=pemo_app"
  echo "PEMO_DB_OWNER_USER=$OWNER"
  echo "PEMO_DB_OWNER_PASSWORD=$OWNER_PASS"
  echo "PEMO_ENV=development"
} >> "$GOV"
export PEMO_GOVERNANCE_ENV="$GOV"
REQUIRE_DB=1 docs/governance/bin/grants-complete.sh
REQUIRE_DB=1 docs/governance/bin/premise-arm-guard.sh
rm -f "$GOV"
unset PEMO_GOVERNANCE_ENV

sudo -n -u postgres dropdb --if-exists "$MAIN"
sudo -n -u postgres dropdb --if-exists "$F2"
sudo -n -u postgres psql -c "DROP ROLE IF EXISTS $APP;"
sudo -n -u postgres psql -c "DROP ROLE IF EXISTS $OWNER;"

# After: owner, send_key, and catalogue roles unchanged.
sudo -n -u postgres psql -c '\l pemo_grok'
sudo -n -u postgres psql -At -c "SELECT r.rolname FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE d.datname='pemo_grok';"
sudo -n -u postgres psql -d pemo_grok -At -c "SELECT count(*) FROM information_schema.columns WHERE table_schema='strata' AND table_name='email_outbox' AND column_name='send_key';"
sudo -n -u postgres psql -At -c "SELECT rolname FROM pg_roles WHERE rolname IN ('pemo_app','pemo_owner') OR rolname LIKE 'rt_pemo_%_4b';"
```

## What this run showed

Recorded 20 November 2026, 00:03:42–00:04:28 AEDT (Australia/Sydney, UTC+11), from clean `d49e99d`. Live listeners were left untouched: `:3200` pid 121988, `:5185` pid 3035582, `:5186` pid 3035711, and existing MainThread holders of `:5173`–`:5176`.

**Roles used:** `rt_pemo_app_4b` (restricted runtime) and `rt_pemo_owner_4b` (throwaway governance owner, SUPERUSER/CREATEROLE/BYPASSRLS only for `premise-arm-guard.sh`, then dropped). Catalogue names `pemo_app` and `pemo_owner` were not created and do not exist on the cluster at the end.

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

## What this round covers

- **R8:** Normal builds ignore any URL token and strip `token` from the query on load. `token=demo` is ingested only when `VITE_PEMO_ALLOW_URL_DEMO_TOKEN` is exactly `1` (off by default), and is still stripped so history and shared links stay clean. `writeLiveConfig` never writes a token back onto the URL. `liveBaseUrl` / `maySendCredentials` reject an unapproved `api=` destination. Live clients send a bearer only to the configured same-origin or `VITE_API_BASE` API. The session token is memory-only; nothing is stored in `localStorage`. This does not claim that previously copied URLs or third-party logs have been erased. `VITE_PEMO_AUTO_LIVE` is a separate front-counter switch and is left alone.
- **R6:** Tests prove the runtime role is not a superuser, cannot `CREATE ROLE` or `ALTER ROLE … SUPERUSER`, owns no tables, cannot UPDATE/DELETE audit or case rows, and cannot UPDATE `to_address` / `body_text` on `strata.email_outbox`, while a column-level `status` UPDATE and an atomic open-case (ticket, case, audit) still succeed. `search_path` is not treated as an ACL. The repository layer is unchanged. Governance scripts default to the catalogue names but accept `rt_*` names through the environment.
- **R7:** `PEMO_DB_POOL_MAX` (default 5), `PEMO_DB_CONNECT_TIMEOUT_MS` (2000), `PEMO_DB_STATEMENT_TIMEOUT_MS` (5000), `PEMO_DB_REPLICA_COUNT` (1), and `PEMO_EMAIL_BATCH_SIZE` (50). All nine module pools in `wiring.ts` take that budget. `/health` remains backward compatible and adds `pools`. A send request claims at most the batch size and leaves the rest queued; the atomic outbox claim still prevents duplicate dispatch. `docs/ops/db-pool-budget.md` records process capacity (`max × 9 × replicas`) versus `max_connections`. Tests: a saturated pool wait times out cleanly and recovers; a `pg_sleep` is cancelled by `statement_timeout` and the next query works.

## Deferred (not required to close the P1)

- **P2-3:** a stale `sending` row is presented as `unknown` but `POST .../resend` still returns 400 because the stored status is `sending`. There is still no invoice resend path. Needs a small design for which stored states are manually resendable, and whether invoice gets the same route.
- **P2-5:** `log-only` remains terminal, so configuring SMTP later does not automatically send, and a repeat admin test to the same address is a no-op. Needs a design that distinguishes a log-only probe from an intended later delivery without silently double-sending.
- **P3-1 to P3-9:** as in v0.2, except the outbox `to_address` / `body_text` writability item is closed by the column-level UPDATE grant. The remaining P3s each need their own small design; none blocks this sign-off.
- Later P2 batches (R4 / R5 / R9 / D1) are not part of this run.

## Deviations

- A first attempt applied 0145 to the MAIN clone with `psql -f`, which left `migrateUp` failing with `column "subject_version" of relation "email_outbox" already exists`. That run was discarded. The successful run uses `migrateUp` so the migration is recorded, then grants the column-level UPDATE to `rt_pemo_app_4b`. Neither attempt created `pemo_app` or `pemo_owner`. After the failed attempt, throwaway databases and `rt_*` roles were dropped; shared `pemo_grok` ownership stayed `pemo_grok` and `send_key` stayed absent.
- The isolated management-web gate is the R8 unit tests plus `inventory-complete`, not `pnpm run test:node`. The full node suite also runs production-artefact tests that require a prior `pnpm run build`; that requirement is unchanged and was not part of this isolated run.

## SMTP administration

The access catalogue has no narrower email-admin role. The SMTP test remains gated by `grant_administrator`. That is an MVP decision for PT, documented in `docs/contracts/management-web-v0-strata-notices-live.md`.
