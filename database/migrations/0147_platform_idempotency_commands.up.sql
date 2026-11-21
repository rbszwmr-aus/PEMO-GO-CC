-- RT5-F6: named SECURITY DEFINER commands for idempotency lookup and record.
-- Role names are parameterised (pemo.definer_role, default pemo_definer_commands).
-- Table grants and EXECUTE are applied by database/roles/010-grants.sql after migrate.
-- This file only installs the platform-schema commands. No row data is rewritten.

CREATE OR REPLACE FUNCTION platform.lookup_idempotency(
  p_principal_id text,
  p_operation text,
  p_idempotency_key text
) RETURNS TABLE (
  act_kind text,
  act_id text,
  audit_id text,
  first_seen_at timestamptz,
  request_fingerprint text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform
AS $$
BEGIN
  RETURN QUERY
    SELECT r.act_kind, r.act_id, r.audit_id, r.first_seen_at, r.request_fingerprint
      FROM platform.idempotency_record r
     WHERE r.principal_id IS NOT DISTINCT FROM p_principal_id
       AND r.operation = p_operation
       AND r.idempotency_key = p_idempotency_key;
END;
$$;

CREATE OR REPLACE FUNCTION platform.record_idempotency(
  p_principal_id text,
  p_operation text,
  p_idempotency_key text,
  p_act_kind text,
  p_act_id text,
  p_audit_id text,
  p_request_fingerprint text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform
AS $$
BEGIN
  INSERT INTO platform.idempotency_record
    (principal_id, operation, idempotency_key, act_kind, act_id, audit_id, request_fingerprint)
  VALUES
    (p_principal_id, p_operation, p_idempotency_key, p_act_kind, p_act_id, p_audit_id, p_request_fingerprint);
END;
$$;

DO $$
DECLARE
  definer text := coalesce(nullif(current_setting('pemo.definer_role', true), ''), 'pemo_definer_commands');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = definer) THEN
    RAISE EXCEPTION 'RT5-F6: role % is missing; run database/roles/000-roles.sql first', definer;
  END IF;
  EXECUTE format('ALTER FUNCTION platform.lookup_idempotency(text,text,text) OWNER TO %I', definer);
  EXECUTE format('ALTER FUNCTION platform.record_idempotency(text,text,text,text,text,text,text) OWNER TO %I', definer);
END $$;

REVOKE ALL ON FUNCTION platform.lookup_idempotency(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION platform.record_idempotency(text,text,text,text,text,text,text) FROM PUBLIC;
