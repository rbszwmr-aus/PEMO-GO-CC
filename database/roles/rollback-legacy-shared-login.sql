-- RT5-F6 cluster-level rollback of the grant switch. Restores the legacy
-- shared login's SELECT+INSERT (and the six-column outbox UPDATE) so a
-- process still connecting as pemo_app can read and write. Module roles are
-- left in place (they hold no row data). No row data is rewritten or deleted.
--
-- Invoked after rolling back 0146–0148. Not a migration: GRANT across owner
-- schemas would fail the runner's one-schema ownership check.

DO $$
DECLARE
  owner text := coalesce(nullif(current_setting('pemo.owner_role', true), ''), 'pemo_owner');
  legacy text := 'pemo_app';
  s text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = legacy) THEN
    RAISE NOTICE 'RT5-F6 rollback: % does not exist; nothing to re-grant', legacy;
    RETURN;
  END IF;
  FOR s IN
    SELECT n.nspname
      FROM pg_namespace n
      JOIN pg_roles o ON o.oid = n.nspowner
     WHERE o.rolname = owner
       AND n.nspname NOT LIKE 'pg\_%'
       AND n.nspname NOT IN ('information_schema', 'public')
     ORDER BY n.nspname
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', s, legacy);
    EXECUTE format('GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA %I TO %I', s, legacy);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO %I', s, legacy);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT SELECT, INSERT ON TABLES TO %I', owner, s, legacy);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO %I', owner, s, legacy);
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'strata' AND table_name = 'email_outbox' AND column_name = 'send_key'
  ) THEN
    EXECUTE format('REVOKE UPDATE ON strata.email_outbox FROM %I', legacy);
    EXECUTE format(
      'GRANT UPDATE (status, claimed_at, attempt, transport, transport_detail, send_key) ON strata.email_outbox TO %I',
      legacy);
  END IF;
END $$;
