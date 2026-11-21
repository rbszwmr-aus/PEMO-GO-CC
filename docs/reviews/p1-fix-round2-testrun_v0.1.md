# P1 fix round 2 — test run note

**Version:** v0.1  
**Date:** 19 November 2026 (Australia/Sydney, AEDT, UTC+11)  
**Branch:** `fix/p1-review-r1-r3`  
**Base recorded before this round:** `5e35fb2ab206d1e2363b6f9ad2c196e0106c3569` (clean tree)

This note records how an independent tester can reproduce the isolated PostgreSQL / HTTP / migration checks for the remaining F1 and F3 gaps and the original R1/R2/F2 gates. It does not authorize migration or restart of any shared database or live listener.

## Safety

- Use a **disposable** database cloned from `pemo_grok`. Never run `migrateUp` against the shared `pemo_grok` database.
- Unset `SMTP_HOST`, `SMTP_URL`, `SMTP_USER`, and `SMTP_PASS` in the shell. Tests that exercise the default mailer install a fake nodemailer transport and point `SMTP_HOST` at `smtp.test.invalid` only inside those tests.
- Do not bind or restart ports `3200`, `5185`, `5186`, or reserved `3100` / `5173`–`5176`. The harness uses Fastify `inject()` and does not listen.
- Do not push. Local commits only.

## Commands

From a checkout of this branch (worktree or a fresh clone of the same commits), with `database/dev/.env` available for `PEMO_ENV`, owner/app roles, and `PEMO_DEV_TOKEN_SECRET` (the `--env-file` path below is the one used on amd128; adjust if your clone keeps the env file next to the repo).

```bash
# record identity
git rev-parse HEAD
git status --porcelain

MAIN=pemo_grok_rt_20261119
F2=pemo_grok_rt_20261119_f2
sudo -n -u postgres createdb -T pemo_grok -O pemo_grok "$MAIN"
sudo -n -u postgres createdb -T pemo_grok -O pemo_grok "$F2"

R1ROLE=pemo_app_rt_20261119
R1PASS=$(openssl rand -hex 16)
sudo -n -u postgres psql -v ON_ERROR_STOP=1 -c "DROP ROLE IF EXISTS ${R1ROLE};"
sudo -n -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE ${R1ROLE} LOGIN PASSWORD '${R1PASS}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;"
sudo -n -u postgres psql -v ON_ERROR_STOP=1 -d "$MAIN" -c "
DO \$\$
DECLARE s text;
BEGIN
  FOR s IN SELECT nspname FROM pg_namespace
            WHERE nspname NOT IN ('pg_catalog','information_schema','pg_toast')
              AND nspname NOT LIKE 'pg_toast%'
              AND nspname NOT LIKE 'pg_temp%'
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO ${R1ROLE}', s);
    EXECUTE format('GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA %I TO ${R1ROLE}', s);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO ${R1ROLE}', s);
  END LOOP;
END
\$\$;
"

export PEMO_DB_NAME="$MAIN"
export PEMO_F2_DB_NAME="$F2"
export PEMO_R1_USER="$R1ROLE"
export PEMO_R1_PASSWORD="$R1PASS"
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
  ../../tests/integration/strata-live-reads.test.ts

# always drop the clones (including on failure)
sudo -n -u postgres dropdb --if-exists "$MAIN"
sudo -n -u postgres dropdb --if-exists "$F2"
sudo -n -u postgres psql -c "DROP ROLE IF EXISTS pemo_app_rt_20261119;"
```

`--env-file` does not override variables already set in the shell, so `PEMO_DB_NAME` / `PEMO_F2_DB_NAME` win over the env file.

## What the new tests cover

- F1c: real default mailer + fake nodemailer that accepts DATA then throws → persisted `unknown`, next request makes 0 transport calls.
- F1d: proven pre-DATA error → `failed`, retry makes one more transport call.
- F1a / F1b: overlapping same-key sends, and SMTP accept then `markResult` failure, still pass (row stays `sending`, no auto-resend).
- F1e: stale `sending` past 15 minutes is reported `unknown` and is not re-claimed.
- F3 / F3h: GET delivery returns only in-scope recipients; after a **draft** retarget from floor 2 to floor 1, floor-1 staff can read the notice but not the floor-2 or legacy null-scope addresses; estate-wide staff see both; no-grant / resident / wrong-estate get 403/401/404 with no addresses.
- F2: historical duplicate rows survive 0145 (renamed in place, not deleted); down refuses while `queued`/`sending`/`unknown` rows exist; ledger checksum matches the file.
- R1: `pemo_app` runtime role; injected failure before/after writes, during audit, and at final commit leaves no partial case/ticket/audit; two concurrent open-case calls yield one case.
- R2: invoice send/preview and SMTP test (and notice send denials) for estate, other-floor, no-grant, resident, and wrong-estate principals.

## Runtime role on this cluster

The catalogue and design docs name the restricted API role `pemo_app` (SELECT+INSERT, no UPDATE/DELETE). This amd128 cluster has no `pemo_app` login, and the env file uses `pemo_grok` for both `PEMO_DB_USER` and `PEMO_DB_OWNER_USER`. That login can UPDATE/DELETE, so it is not a valid stand-in. R1 therefore uses a **throwaway** login role, created only for the disposable database, with SELECT+INSERT (no UPDATE/DELETE), passed as `PEMO_R1_USER` / `PEMO_R1_PASSWORD`. Do not change passwords or privileges of existing roles, and drop the throwaway role after the run.

## SMTP administration

The access catalogue has no narrower email-admin role. The SMTP test remains gated by `grant_administrator`. That is an MVP decision for PT, documented in `docs/contracts/management-web-v0-strata-notices-live.md`.
