-- RT5-F6: named SECURITY DEFINER command for audit-append.
-- Role names are parameterised (pemo.definer_role, default pemo_definer_commands).
-- Table grants and EXECUTE are applied by database/roles/010-grants.sql after migrate.
-- This file only installs the access-schema command. No row data is rewritten.

CREATE OR REPLACE FUNCTION access.append_audit_event(
  p_audit_id text,
  p_source text,
  p_principal_id text,
  p_group_id text,
  p_role text,
  p_node_kind text,
  p_node_id text,
  p_action text,
  p_target_kind text,
  p_target_id text,
  p_occurred_at timestamptz,
  p_correlation_id text,
  p_reason_code text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, access
AS $$
BEGIN
  -- correlation_id is uuid in the table; the command accepts text.
  INSERT INTO access.audit_event (
    audit_id, source, principal_id, group_id, role, node_kind, node_id,
    action, target_kind, target_id, occurred_at, correlation_id, reason_code
  ) VALUES (
    p_audit_id, p_source, p_principal_id, p_group_id, p_role, p_node_kind, p_node_id,
    p_action, p_target_kind, p_target_id, p_occurred_at, p_correlation_id::uuid, p_reason_code
  );
END;
$$;

DO $$
DECLARE
  definer text := coalesce(nullif(current_setting('pemo.definer_role', true), ''), 'pemo_definer_commands');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = definer) THEN
    RAISE EXCEPTION 'RT5-F6: role % is missing; run database/roles/000-roles.sql first', definer;
  END IF;
  EXECUTE format(
    'ALTER FUNCTION access.append_audit_event(text,text,text,text,text,text,text,text,text,text,timestamptz,text,text) OWNER TO %I',
    definer);
END $$;

REVOKE ALL ON FUNCTION access.append_audit_event(text,text,text,text,text,text,text,text,text,text,timestamptz,text,text) FROM PUBLIC;
