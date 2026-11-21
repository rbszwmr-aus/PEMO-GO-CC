-- CLUSTER BOOTSTRAP, part two — RT5-F6 per-module grants, DERIVED BY RULE.
--
-- Runs AFTER migrate, because it grants on tables and functions that must exist.
--
-- Role names are parameterised through custom GUCs (defaults in parentheses):
--   pemo.owner_role    (pemo_owner)
--   pemo.login_prefix  (pemo_app_)
--   pemo.priv_prefix   (pemo_priv_)
--   pemo.definer_role  (pemo_definer_commands)
--
-- THE RULE. Each production module schema has one NOLOGIN privilege role that
-- receives USAGE on that schema and SELECT+INSERT on its tables and USAGE,SELECT
-- on its sequences. The matching LOGIN role (one per existing pool) is a member
-- of ONLY that privilege role. It cannot SET ROLE to a peer or to the command
-- definer. dev_scaffold stays out of production identities. service_case has no
-- login; helpdesk may SELECT it (case-command reads) and only the named
-- commands may write it.
--
-- Callers of the named commands need USAGE on the command's schema so
-- PostgreSQL can resolve the function name. That is not a table grant:
-- peer logins still cannot SELECT or INSERT access.audit_event,
-- platform.idempotency_record, or platform.outbox_message.
--
-- The six-column UPDATE on strata.email_outbox is granted to the Strata
-- privilege role only.
--
-- The legacy shared login pemo_app is reconciled to hold no table grants, so a
-- forgotten connection fails closed.
--
-- Revocation is gated the same way as before: pemo.env in (development, test,
-- ci) or pemo.reconcile_revoke = on. Otherwise excess is reported and left.

DO $$
DECLARE
  owner        text := coalesce(nullif(current_setting('pemo.owner_role', true), ''), 'pemo_owner');
  login_prefix text := coalesce(nullif(current_setting('pemo.login_prefix', true), ''), 'pemo_app_');
  priv_prefix  text := coalesce(nullif(current_setting('pemo.priv_prefix', true), ''), 'pemo_priv_');
  definer      text := coalesce(nullif(current_setting('pemo.definer_role', true), ''), 'pemo_definer_commands');
  env          text := coalesce(current_setting('pemo.env', true), '');
  prod_schemas text[] := ARRAY[
    'platform', 'property', 'resident', 'home_safety',
    'access', 'notices', 'helpdesk', 'strata'
  ];
  s text;
  priv text;
  login text;
  may_dev boolean;
BEGIN
  may_dev := env IN ('development', 'test', 'ci');

  FOREACH s IN ARRAY prod_schemas LOOP
    priv := priv_prefix || s;
    login := login_prefix || s;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = priv) THEN
      RAISE EXCEPTION 'RT5-F6: privilege role % is missing; run database/roles/000-roles.sql first', priv;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = login) THEN
      RAISE EXCEPTION 'RT5-F6: login role % is missing; run database/roles/000-roles.sql first', login;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = s) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', s, priv);
      EXECUTE format('GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA %I TO %I', s, priv);
      EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO %I', s, priv);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT SELECT, INSERT ON TABLES TO %I', owner, s, priv);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO %I', owner, s, priv);
    END IF;
    EXECUTE format('GRANT %I TO %I', priv, login);
    BEGIN
      EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), login);
    EXCEPTION WHEN insufficient_privilege OR invalid_grant_operation THEN
      NULL;
    END;
  END LOOP;

  -- Development fixture schema: never on a production identity.
  IF may_dev AND EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'dev_scaffold') THEN
    priv := priv_prefix || 'dev_scaffold';
    login := login_prefix || 'dev_scaffold';
    EXECUTE format('GRANT USAGE ON SCHEMA dev_scaffold TO %I', priv);
    EXECUTE format('GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA dev_scaffold TO %I', priv);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA dev_scaffold TO %I', priv);
    EXECUTE format('GRANT %I TO %I', priv, login);
    BEGIN
      EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), login);
    EXCEPTION WHEN insufficient_privilege OR invalid_grant_operation THEN
      NULL;
    END;
  END IF;

  -- Command definer: only the tables the named commands actually write/read.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'access' AND table_name = 'audit_event') THEN
    EXECUTE format('GRANT USAGE ON SCHEMA access TO %I', definer);
    EXECUTE format('GRANT INSERT ON access.audit_event TO %I', definer);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'platform' AND table_name = 'idempotency_record') THEN
    EXECUTE format('GRANT USAGE ON SCHEMA platform TO %I', definer);
    EXECUTE format('GRANT SELECT, INSERT ON platform.idempotency_record TO %I', definer);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'platform' AND table_name = 'outbox_message') THEN
    EXECUTE format('GRANT USAGE ON SCHEMA platform TO %I', definer);
    EXECUTE format('GRANT SELECT, INSERT ON platform.outbox_message TO %I', definer);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'service_case' AND table_name = 'service_case') THEN
    EXECUTE format('GRANT USAGE ON SCHEMA service_case TO %I', definer);
    EXECUTE format('GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA service_case TO %I', definer);
    -- Restricted read projection for the helpdesk case commands (same transaction).
    EXECUTE format('GRANT USAGE ON SCHEMA service_case TO %I', priv_prefix || 'helpdesk');
    EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA service_case TO %I', priv_prefix || 'helpdesk');
  END IF;

  -- EXECUTE: audit/idempotency to every production login; case commands to helpdesk only.
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'access' AND p.proname = 'append_audit_event') THEN
    FOREACH s IN ARRAY prod_schemas LOOP
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION access.append_audit_event(text,text,text,text,text,text,text,text,text,text,timestamptz,text,text) TO %I',
        login_prefix || s);
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION platform.lookup_idempotency(text,text,text) TO %I',
        login_prefix || s);
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION platform.record_idempotency(text,text,text,text,text,text,text) TO %I',
        login_prefix || s);
    END LOOP;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'platform' AND p.proname = 'enqueue_outbox_message') THEN
    FOREACH s IN ARRAY prod_schemas LOOP
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION platform.enqueue_outbox_message(uuid,text,text,timestamptz,timestamptz,text,uuid,uuid,jsonb,jsonb) TO %I',
        login_prefix || s);
    END LOOP;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'service_case' AND p.proname = 'open_from_ticket') THEN
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION service_case.open_from_ticket(text,text,text,text,text) TO %I',
      login_prefix || 'helpdesk');
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION service_case.append_assertion(text,text,integer,text,text,text,text,boolean,text,timestamptz,text,text,text,text) TO %I',
      login_prefix || 'helpdesk');
  END IF;

  -- Name resolution for the named commands. Table rights stay withheld.
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'access') THEN
    FOREACH s IN ARRAY prod_schemas LOOP
      EXECUTE format('GRANT USAGE ON SCHEMA access TO %I', login_prefix || s);
    END LOOP;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'platform') THEN
    FOREACH s IN ARRAY prod_schemas LOOP
      EXECUTE format('GRANT USAGE ON SCHEMA platform TO %I', login_prefix || s);
    END LOOP;
  END IF;

  -- Audit append and idempotency are named commands. The owning module's
  -- privilege role keeps SELECT (and, for other tables, INSERT) but must not
  -- write these two tables directly.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'access' AND table_name = 'audit_event') THEN
    EXECUTE format('REVOKE INSERT ON access.audit_event FROM %I', priv_prefix || 'access');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'platform' AND table_name = 'idempotency_record') THEN
    EXECUTE format('REVOKE SELECT, INSERT ON platform.idempotency_record FROM %I', priv_prefix || 'platform');
  END IF;

  -- Six outbox UPDATE columns: Strata privilege role only.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'strata' AND table_name = 'email_outbox' AND column_name = 'send_key'
  ) THEN
    EXECUTE format('REVOKE UPDATE ON strata.email_outbox FROM %I', priv_prefix || 'strata');
    EXECUTE format(
      'GRANT UPDATE (status, claimed_at, attempt, transport, transport_detail, send_key) ON strata.email_outbox TO %I',
      priv_prefix || 'strata');
  END IF;
END $$;

-- P3-5: definer SELECT on helpdesk.ticket so open_from_ticket can constrain
-- organization_id against the originating ticket. Tight: this table only.
DO $$
DECLARE
  definer text := coalesce(nullif(current_setting('pemo.definer_role', true), ''), 'pemo_definer_commands');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = definer) THEN
    RAISE EXCEPTION 'RT5-F6: role % is missing; run database/roles/000-roles.sql first', definer;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'helpdesk' AND table_name = 'ticket'
  ) THEN
    EXECUTE format('GRANT USAGE ON SCHEMA helpdesk TO %I', definer);
    EXECUTE format('GRANT SELECT ON helpdesk.ticket TO %I', definer);
  END IF;
END $$;

-- P3-5: open_from_ticket body with originating-ticket org check. Installed here
-- because a service_case migration may not name the helpdesk schema.
-- Guarded: do nothing if the service_case schema or function is absent
-- (for example after 0148 has been rolled back and 010-grants is reapplied alone).
DO $p35$
DECLARE
  definer text := coalesce(nullif(current_setting('pemo.definer_role', true), ''), 'pemo_definer_commands');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = definer) THEN
    RAISE EXCEPTION 'RT5-F6: role % is missing; run database/roles/000-roles.sql first', definer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'service_case') THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'service_case'
       AND p.proname = 'open_from_ticket'
  ) THEN
    RETURN;
  END IF;

  EXECUTE $of$
CREATE OR REPLACE FUNCTION service_case.open_from_ticket(
  p_assertion_id text,
  p_case_id text,
  p_organization_id text,
  p_originating_ticket_ref text,
  p_recorded_by text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, service_case
AS $$
DECLARE
  ticket_org text;
BEGIN
  SELECT t.organization_id INTO ticket_org
    FROM helpdesk.ticket t
   WHERE t.ticket_id = p_originating_ticket_ref
   ORDER BY t.version DESC
   LIMIT 1;
  IF ticket_org IS NULL THEN
    RAISE EXCEPTION 'RT5-F6: originating ticket does not exist'
      USING ERRCODE = 'P0002';
  END IF;
  IF ticket_org IS DISTINCT FROM p_organization_id THEN
    RAISE EXCEPTION 'RT5-F6: organization_id does not match the originating ticket'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO service_case.service_case (
    assertion_id, case_id, version, organization_id, state, disposition,
    originating_ticket_ref, recorded_by
  ) VALUES (
    p_assertion_id, p_case_id, 1, p_organization_id, 'open', 'case_opened',
    p_originating_ticket_ref, p_recorded_by
  );
END;
$$;
$of$;
  EXECUTE format('ALTER FUNCTION service_case.open_from_ticket(text,text,text,text,text) OWNER TO %I', definer);
  EXECUTE 'REVOKE ALL ON FUNCTION service_case.open_from_ticket(text,text,text,text,text) FROM PUBLIC';
END
$p35$;



-- ─── revoke the legacy shared login and any excess ──────────────────────────
DO $$
DECLARE
  r record;
  env  text := coalesce(current_setting('pemo.env', true), '');
  ask  text := coalesce(current_setting('pemo.reconcile_revoke', true), '');
  may_revoke boolean;
  legacy text := 'pemo_app';
  owner text := coalesce(nullif(current_setting('pemo.owner_role', true), ''), 'pemo_owner');
  n int := 0;
  s text;
BEGIN
  may_revoke := (env IN ('development', 'test', 'ci')) OR (ask = 'on');

  -- Take catalogue-wide grants off the legacy shared login.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = legacy) THEN
    FOR s IN
      SELECT n.nspname
        FROM pg_namespace n
        JOIN pg_roles o ON o.oid = n.nspowner
       WHERE o.rolname = owner
         AND n.nspname NOT LIKE 'pg\_%'
         AND n.nspname NOT IN ('information_schema', 'public')
    LOOP
      n := n + 1;
      IF may_revoke THEN
        EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA %I FROM %I', s, legacy);
        EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM %I', s, legacy);
        EXECUTE format('REVOKE ALL ON SCHEMA %I FROM %I', s, legacy);
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I REVOKE SELECT, INSERT ON TABLES FROM %I', owner, s, legacy);
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I REVOKE USAGE, SELECT ON SEQUENCES FROM %I', owner, s, legacy);
      ELSE
        RAISE WARNING 'LEGACY SHARED LOGIN % still holds grants on schema % — set pemo.reconcile_revoke = on to remove them', legacy, s;
      END IF;
    END LOOP;
    IF may_revoke AND EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'strata' AND table_name = 'email_outbox' AND column_name = 'send_key'
    ) THEN
      EXECUTE format('REVOKE UPDATE ON strata.email_outbox FROM %I', legacy);
    END IF;
  END IF;

  IF n > 0 AND may_revoke THEN
    RAISE NOTICE 'RT5-F6: reconciled legacy shared login on % schema(s)', n;
  END IF;
END $$;
