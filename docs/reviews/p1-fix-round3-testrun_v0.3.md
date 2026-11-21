# P1 fix round 3 — test run note

**Version:** v0.3  
**Date:** 19 November 2026 (Australia/Sydney, AEDT, UTC+11)  
**Branch:** `fix/p1-review-r1-r3`  
**Base recorded before this round:** `0ff2af845d2386576f374dd49cf2345ef29f1efc` (clean tree)

**Changelog**
- v0.3 — Round 4a (sign-off items after the independent re-test of `0ff2af8`): management-web `tsc` (RT3-P2-A); `EXPECTED_EXTRA` is read and the 0145 outbox UPDATE is column-level (RT3-P2-B); manual resend uses the same post-accept `markResult` guard as a normal send (RT3-P2-C); F1d refused-connect is a stale unix socket. P2-3 and P2-5 stay deferred.
- v0.2 — Round 3: flip the default mailer classifier against real nodemailer 6.10.1; grant `pemo_app` UPDATE on `strata.email_outbox` in 0145; carry the status rename into OpenAPI and the management SPA; make manual resend claim-idempotent; record deferred P2/P3 items.
- v0.1 — Round 2 disposable-DB commands for F1/F3/R1/R2/F2 (see `p1-fix-round2-testrun_v0.1.md`).

This note records how an independent tester can reproduce the isolated PostgreSQL / HTTP / migration / contract checks from a fresh clone of these commits.

## Commits in this round

| SHA | Item |
|-----|------|
| `422f92eb847020a4dcafe48da2ff72ada7880d1a` | RT3-P2-A: revert the dead `accepted` comparison in `AdminEmail.tsx` so `tsc` passes |
| `aaa6278b53f4411801d1ac798e012b2a133d844c` | RT3-P2-B: read `EXPECTED_EXTRA`; column-level UPDATE on `strata.email_outbox` in 0145 and 010-grants |
| `2c4fd4336cd482c3de4cdf6e0b81f32437039f6d` | RT3-P2-C: resend `transportReturned` guard plus one test |
| `474af511f9fdf820ced66f8dff5bed5e48a1e11a` | F1d: refused-connect uses a stale unix socket (ECONNREFUSED), no TCP |
| (this file) | docs: run note v0.3 |

## Safety

- Use a **disposable** database cloned from `pemo_grok`. Never run `migrateUp` or 0145 against the shared `pemo_grok` database.
- Fake SMTP only, on a **unix socket**, with no TCP listeners. Unset `SMTP_HOST`, `SMTP_URL`, `SMTP_USER`, and `SMTP_PASS` in the shell. Tests that drive the real nodemailer client install `setCreateTransport` + `getSocket` pointing at that socket, and set `SMTP_HOST=smtp.test.invalid` only inside those tests. F1d's refused-connect case binds an AF_UNIX socket and abandons the inode so `connect()` is `ECONNREFUSED` (errno -111); it does not open `127.0.0.1:1` or any other TCP port.
- Do not bind or restart ports `3200`, `5185`, `5186`, or reserved `3100` / `5173`–`5176`. The harness uses Fastify `inject()` and does not listen.
- Do not push. Local commits only.
- If this cluster has no `pemo_app` or `pemo_owner` login, create throwaways for the disposable database only and drop them afterwards. Do not change passwords or privileges of existing roles.
- **Do not use `REASSIGN OWNED BY pemo_grok`**. On this PostgreSQL 17 cluster that also reassigns ownership of the `pemo_grok` *database* (a cluster-wide object). To make `grants-complete.sh` see the catalogue, `ALTER SCHEMA … OWNER TO pemo_owner` on the clone only.

## Runtime role

The catalogue names the restricted API role `pemo_app` (SELECT+INSERT, plus the 0145 exception: column-level UPDATE on `strata.email_outbox` for `status`, `claimed_at`, `attempt`, `transport`, `transport_detail`, `send_key`). This amd128 cluster has no `pemo_app` and no `pemo_owner` login; schemas in `pemo_grok` are owned by `pemo_grok`. The commands below create throwaway `pemo_app` / `pemo_owner`, grant SELECT+INSERT on the clones, and let 0145 (applied to the clone only) add the column-level outbox UPDATE. F1 and F3 therefore run as that restricted role, not the owner.

`grants-complete.sh` now *reads* `EXPECTED_EXTRA` and lists that column-level UPDATE. A whole-row UPDATE, or UPDATE on `to_address` / `body_text`, is still EXCESS. `010-grants.sql` reasserts the same columns. `premise-arm-guard.sh` requires a database name matching `^pemo_dev` and a connecting owner that can `ALTER ROLE pemo_app` (including `BYPASSRLS` and `SUPERUSER`). Point both scripts at the clone with `PEMO_GOVERNANCE_ENV`; do not set `PEMO_DB_USER` to `pemo_grok` in that file.

## Commands

From a checkout of this branch, with `database/dev/.env` available (the `--env-file` path below is the one used on amd128).

```bash
git rev-parse HEAD
git status --porcelain

MAIN=pemo_dev_r4a
F2=pemo_dev_r4a_f2
sudo -n -u postgres createdb -T pemo_grok -O pemo_grok "$MAIN"
sudo -n -u postgres createdb -T pemo_grok -O pemo_grok "$F2"

# Create pemo_app only if it is missing. Remember whether we created it so we
# do not drop a pre-existing role.
CREATED_APP=0
if ! sudo -n -u postgres psql -At -c "SELECT 1 FROM pg_roles WHERE rolname='pemo_app'" | grep -q 1; then
  CREATED_APP=1
  APP_PASS=$(openssl rand -hex 16)
  sudo -n -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE pemo_app LOGIN PASSWORD '${APP_PASS}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;"
else
  # A pre-existing pemo_app must already be able to log in with PEMO_DB_PASSWORD
  # from the env file, or export PEMO_DB_PASSWORD yourself. This branch does
  # not change that password.
  APP_PASS=""
fi

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
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO pemo_app', s);
    EXECUTE format('GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA %I TO pemo_app', s);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO pemo_app', s);
  END LOOP;
END
\$\$;"
}
grant_app "$MAIN"
grant_app "$F2"

export PEMO_DB_NAME="$MAIN"
export PEMO_F2_DB_NAME="$F2"
if [ "$CREATED_APP" -eq 1 ]; then
  export PEMO_DB_USER=pemo_app
  export PEMO_DB_PASSWORD="$APP_PASS"
  export PEMO_R1_USER=pemo_app
  export PEMO_R1_PASSWORD="$APP_PASS"
fi
unset SMTP_HOST SMTP_URL SMTP_USER SMTP_PASS

cd apps/api
pnpm exec tsc -b
cd ../management-web
pnpm exec tsc --noEmit
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
  ../../tests/contract/strata-mailer.test.ts
```

`--env-file` does not override variables already set in the shell, so the `PEMO_*` exports win.

After the suite (so 0145 has been applied to the clones), run the grant checks against a migrated clone. On this cluster the scripts derive the table set from schemas owned by `pemo_owner`, and `premise-arm-guard.sh` must `ALTER ROLE pemo_app`. The block below creates a throwaway `pemo_owner` if it is missing, changes **schema** ownership on the clone only, and points the scripts at a temp env file. Drop the throwaway role afterwards. Copy the SQL files to `/tmp` if `postgres` cannot read the worktree.

```bash
# Skip role creation if pemo_owner already exists; do not change it.
CREATED_OWNER=0
if ! sudo -n -u postgres psql -At -c "SELECT 1 FROM pg_roles WHERE rolname='pemo_owner'" | grep -q 1; then
  CREATED_OWNER=1
  OWNER_PASS=$(openssl rand -hex 16)
  # SUPERUSER is required on this cluster so the guard can flip BYPASSRLS
  # and SUPERUSER on the throwaway pemo_app. Drop the role immediately after.
  sudo -n -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE pemo_owner LOGIN PASSWORD '${OWNER_PASS}' SUPERUSER CREATEDB CREATEROLE BYPASSRLS;"
  sudo -n -u postgres psql -v ON_ERROR_STOP=1 -c "GRANT pemo_app TO pemo_owner WITH ADMIN OPTION;"
  sudo -n -u postgres psql -v ON_ERROR_STOP=1 -c "GRANT CONNECT ON DATABASE ${MAIN} TO pemo_owner;"
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
    EXECUTE format('ALTER SCHEMA %I OWNER TO pemo_owner', s);
  END LOOP;
END
\$\$;"
fi

GOV=$(mktemp)
cp /home/luipt/code/PEMO-grok/database/dev/.env "$GOV"
{
  echo
  echo "PEMO_DB_NAME=$MAIN"
  echo "PEMO_DB_HOST=127.0.0.1"
  echo "PEMO_DB_USER=pemo_app"
  [ -n "$APP_PASS" ] && echo "PEMO_DB_PASSWORD=$APP_PASS"
  echo "PEMO_DB_OWNER_USER=pemo_owner"
  [ -n "${OWNER_PASS:-}" ] && echo "PEMO_DB_OWNER_PASSWORD=$OWNER_PASS"
  echo "PEMO_ENV=development"
} >> "$GOV"
export PEMO_GOVERNANCE_ENV="$GOV"
REQUIRE_DB=1 docs/governance/bin/grants-complete.sh
REQUIRE_DB=1 docs/governance/bin/premise-arm-guard.sh
rm -f "$GOV"
unset PEMO_GOVERNANCE_ENV

sudo -n -u postgres dropdb --if-exists "$MAIN"
sudo -n -u postgres dropdb --if-exists "$F2"
if [ "$CREATED_APP" -eq 1 ]; then
  sudo -n -u postgres psql -c "ALTER ROLE pemo_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;"
  sudo -n -u postgres psql -c "DROP ROLE IF EXISTS pemo_app;"
fi
if [ "${CREATED_OWNER:-0}" -eq 1 ]; then
  sudo -n -u postgres psql -c "ALTER ROLE pemo_owner NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;"
  sudo -n -u postgres psql -c "DROP ROLE IF EXISTS pemo_owner;"
fi
```

## What this round covers

- RT3-P2-A: `apps/management-web` `pnpm exec tsc --noEmit` exits 0. The AdminEmail fixture type is `OutboxStatus` (`outbox` / `sent` / `failed`); the dead `|| entry.status === 'accepted'` comparison is removed.
- RT3-P2-B: `EXPECTED_EXTRA` lists `strata.email_outbox:UPDATE` on the six claim/result/`send_key` columns and is actually subtracted. 0145 and 010-grants grant only those columns. `to_address` / `body_text` cannot be updated by `pemo_app`.
- RT3-P2-C: `resendOutboxEmail` uses the same `transportReturned` guard as a normal send. If the transport accepted and `markResult` throws, the row stays `sending` (presented `unknown` after 15 minutes), never `failed`, and a later resend of the same original id does not send again.
- F1d: connection refused is `failed` via a stale unix socket; a retry against the live unix-socket fake server sends once. A 5xx reply after DATA is `failed`.
- F1a / F1b / F1e / F1c / F1g, and F2, F3, R1, R2, plus the case-handling, live-reads and mailer contract suites: re-run as before.

## Deferred (not required to close the P1)

- **P2-3:** a stale `sending` row is presented as `unknown` but `POST .../resend` still returns 400 because the stored status is `sending`. There is still no invoice resend path. Needs a small design for which stored states are manually resendable, and whether invoice gets the same route.
- **P2-5:** `log-only` remains terminal, so configuring SMTP later does not automatically send, and a repeat admin test to the same address is a no-op. Needs a design that distinguishes a log-only probe from an intended later delivery without silently double-sending.
- **P3-1 to P3-9:** as in v0.2, except the outbox `to_address` / `body_text` writability item is closed by the column-level UPDATE grant. The remaining P3s each need their own small design; none blocks this sign-off.

## SMTP administration

The access catalogue has no narrower email-admin role. The SMTP test remains gated by `grant_administrator`. That is an MVP decision for PT, documented in `docs/contracts/management-web-v0-strata-notices-live.md`.
