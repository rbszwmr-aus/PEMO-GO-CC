-- CLUSTER BOOTSTRAP — not a migration.
--
-- This file creates ROLES. Roles are cluster-scoped objects; migrations are
-- database-scoped. They are deliberately kept apart and separately named, so
-- that nobody reading `migrate` later has to wonder why it creates roles. The
-- entrypoint (database/bootstrap.sh) runs this step under its own label,
-- BEFORE migrate, because a migration cannot GRANT to a role that does not
-- exist yet.
--
-- WHY TWO ROLES.
--
--   pemo_owner  owns the schemas and every table; migrations, seeds, boundary
--               verification and the test harness run as it.
--   pemo_app    is what the API runtime connects as. NOT a superuser, owns
--               nothing, and holds SELECT + INSERT and nothing more.
--
-- The whole point is that pemo_app cannot UPDATE or DELETE anything. A
-- superuser bypasses every table permission, and an owner can re-grant itself,
-- so immutability is only a real guarantee for a role that is neither. That is
-- what makes ADR-010 D1's fourth audit property a permission rather than a
-- convention — measured: with this shape the app cannot even re-grant itself
-- ("WARNING: no privileges were granted").
--
-- SELECT + INSERT IS MEASURED, NOT ASPIRED. The runtime issues 76 SELECTs, 10
-- INSERTs, zero UPDATEs and zero DELETEs; every ON CONFLICT is DO NOTHING. So
-- the whole runtime is append-only, and audit immutability is a case of that
-- rather than a special mechanism. When a future feature legitimately needs to
-- UPDATE one table, that is a MINIMAL PER-TABLE grant on that table — never a
-- widening, and never reaching an audit table.
--
-- IDEMPOTENT, and it has to be: this may run against a cluster that already
-- holds the roles (a re-run, a shared cluster, a developer's second project).
-- CREATE ROLE has no IF NOT EXISTS, hence the DO blocks.
--
-- RESIDUAL, recorded honestly: these roles are CLUSTER-GLOBAL. On the isolated
-- dev and CI clusters that is exactly right. On a shared cluster they would be
-- visible to other databases, which is why idempotency matters and why any
-- future real deployment (there is none today) must decide this deliberately.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pemo_app') THEN
    -- No password here. The bootstrap sets it from the environment, so a
    -- credential never lives in a tracked file.
    CREATE ROLE pemo_app LOGIN;
  END IF;
END $$;

-- Never a superuser, never able to create roles or databases. Stated
-- explicitly rather than relied upon as a default, because the guarantee
-- depends on it: a superuser bypasses the permissions below entirely.
ALTER ROLE pemo_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;


-- ─── RT5-F6: per-module privilege and login roles ────────────────────────────
--
-- Names are parameterised through custom GUCs (defaults shown):
--   pemo.owner_role     (pemo_owner)
--   pemo.login_prefix   (pemo_app_)
--   pemo.priv_prefix    (pemo_priv_)
--   pemo.definer_role   (pemo_definer_commands)
--
-- One NOLOGIN privilege role per production module schema holds that schema's
-- table grants. One LOGIN role per existing module pool is a member of ONLY
-- its own privilege role (INHERIT), so it cannot SET ROLE to a peer or to the
-- command-definer. service_case has no login and no pool; it is reached through
-- named SECURITY DEFINER commands. dev_scaffold is created only so a
-- development pool can exist; production identities never receive its grants.

DO $$
DECLARE
  login_prefix text := coalesce(nullif(current_setting('pemo.login_prefix', true), ''), 'pemo_app_');
  priv_prefix  text := coalesce(nullif(current_setting('pemo.priv_prefix', true), ''), 'pemo_priv_');
  definer      text := coalesce(nullif(current_setting('pemo.definer_role', true), ''), 'pemo_definer_commands');
  schemas text[] := ARRAY[
    'platform', 'property', 'resident', 'home_safety',
    'access', 'notices', 'helpdesk', 'strata',
    'dev_scaffold'
  ];
  s text;
  r text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = definer) THEN
    EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT', definer);
  ELSE
    EXECUTE format('ALTER ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT', definer);
  END IF;

  FOREACH s IN ARRAY schemas LOOP
    r := priv_prefix || s;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT', r);
    ELSE
      EXECUTE format('ALTER ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT', r);
    END IF;

    r := login_prefix || s;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT', r);
    ELSE
      EXECUTE format('ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT', r);
    END IF;
  END LOOP;
END $$;
