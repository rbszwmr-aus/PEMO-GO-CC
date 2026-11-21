# P1 fix round 3 — test run note

**Version:** v0.2  
**Date:** 19 November 2026 (Australia/Sydney, AEDT, UTC+11)  
**Branch:** `fix/p1-review-r1-r3`  
**Base recorded before this round:** `8c18a564aeef88e8561029b5a38d38e62dbf57b2` (clean tree)

**Changelog**
- v0.2 — Round 3: flip the default mailer classifier against real nodemailer 6.10.1; grant `pemo_app` UPDATE on `strata.email_outbox` in 0145; carry the status rename into OpenAPI and the management SPA; make manual resend claim-idempotent; record deferred P2/P3 items.
- v0.1 — Round 2 disposable-DB commands for F1/F3/R1/R2/F2 (see `p1-fix-round2-testrun_v0.1.md`).

This note records how an independent tester can reproduce the isolated PostgreSQL / HTTP / migration / contract checks from a fresh clone of these commits.

## Safety

- Use a **disposable** database cloned from `pemo_grok`. Never run `migrateUp` against the shared `pemo_grok` database.
- Fake SMTP only, on a **unix socket**, with no TCP listeners. Unset `SMTP_HOST`, `SMTP_URL`, `SMTP_USER`, and `SMTP_PASS` in the shell. Tests that drive the real nodemailer client install `setCreateTransport` + `getSocket` pointing at that socket, and set `SMTP_HOST=smtp.test.invalid` only inside those tests.
- Do not bind or restart ports `3200`, `5185`, `5186`, or reserved `3100` / `5173`–`5176`. The harness uses Fastify `inject()` and does not listen.
- Do not push. Local commits only.
- If this cluster has no `pemo_app` login, create a throwaway `pemo_app` for the disposable databases only and drop it afterwards. Do not change passwords or privileges of existing roles.

## Runtime role

The catalogue names the restricted API role `pemo_app` (SELECT+INSERT, plus the 0145 exception: UPDATE on `strata.email_outbox` only). This amd128 cluster has no `pemo_app` login, and `pemo_grok` is used for both env users and can UPDATE/DELETE generally. The commands below create a throwaway `pemo_app`, grant SELECT+INSERT on the clones, and let 0145 (applied by the harness to the clone only) add the outbox UPDATE. F1 and F3 therefore run as that restricted role, not the owner. `010-grants.sql` is updated so a later reconcile does not revoke the exception.

## Commands

From a checkout of this branch, with `database/dev/.env` available (the `--env-file` path below is the one used on amd128).

```bash
git rev-parse HEAD
git status --porcelain

MAIN=pemo_grok_rt_20261119
F2=pemo_grok_rt_20261119_f2
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

sudo -n -u postgres dropdb --if-exists "$MAIN"
sudo -n -u postgres dropdb --if-exists "$F2"
if [ "$CREATED_APP" -eq 1 ]; then
  sudo -n -u postgres psql -c "DROP ROLE IF EXISTS pemo_app;"
fi
```

`--env-file` does not override variables already set in the shell, so the `PEMO_*` exports win.

## What this round covers

- F1c: real nodemailer client against a unix-socket fake SMTP server. After DATA the server closes, resets, or times out. Notice and invoice persist `unknown`; the next POST makes 0 further DATA receipts.
- F1d: connection refused is `failed` (an outbound connect to `127.0.0.1:1`, which opens no listener); a retry against the live unix-socket fake server sends once. A 5xx reply after DATA is `failed`.
- F1a / F1b / F1e: unchanged, still pass (overlapping claims; accept then `markResult` failure; stale `sending` is not re-claimed).
- F1g: two concurrent `POST .../email/resend` of the same unknown row admit one send; a later retry of the same original id does not send again.
- P2-1: 0145 grants `pemo_app` UPDATE on `strata.email_outbox`. F1/F3 run as that role.
- P2-2: OpenAPI and the management SPA use `accepted` / `log-only` (and the rest of the new vocabulary). The Charges send control stays available for `log-only`, `failed` and `unknown`. `tests/contract/strata-mailer.test.ts` expects `log-only`.
- F2, F3, R1, R2: re-run as before.

## Deferred (not required to close the P1)

- **P2-3:** a stale `sending` row is presented as `unknown` but `POST .../resend` still returns 400 because the stored status is `sending`. There is still no invoice resend path. Needs a small design for which stored states are manually resendable, and whether invoice gets the same route.
- **P2-5:** `log-only` remains terminal, so configuring SMTP later does not automatically send, and a repeat admin test to the same address is a no-op. Needs a design that distinguishes a log-only probe from an intended later delivery without silently double-sending.
- **P3-1 to P3-9:** existence oracle on resend, thin resend authority, unfenced `markResult`, unbounded `failed` retries, `accepted` with zero accepted recipients, raw `25P02` on concurrent resolve, 0145 rename/down caveats, legacy null-scope history hidden from floor staff, and 32-bit advisory lock hygiene. Each needs its own small design; none blocks the F1 classifier fix.

## SMTP administration

The access catalogue has no narrower email-admin role. The SMTP test remains gated by `grant_administrator`. That is an MVP decision for PT, documented in `docs/contracts/management-web-v0-strata-notices-live.md`.
