-- RT5-F6: named SECURITY DEFINER command for enqueueing a platform outbox
-- message on the caller's existing transaction. Notice publish (and any other
-- act that must record the event in the same transaction as the assertion)
-- cannot use the platform pool for this write: that would be a second
-- connection, and an event without its snapshot is a lie either way.
-- Role names are parameterised (pemo.definer_role, default pemo_definer_commands).
-- Table grants and EXECUTE are applied by database/roles/010-grants.sql after migrate.
-- This file only installs the command. No row data is rewritten.

CREATE OR REPLACE FUNCTION platform.enqueue_outbox_message(
  p_message_id uuid,
  p_contract_name text,
  p_contract_version text,
  p_occurred_at timestamptz,
  p_received_at timestamptz,
  p_source text,
  p_correlation_id uuid,
  p_causation_id uuid,
  p_scope jsonb,
  p_payload jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, platform
AS $$
BEGIN
  INSERT INTO platform.outbox_message
    (message_id, contract_name, contract_version, occurred_at, received_at,
     source, correlation_id, causation_id, scope, payload)
  VALUES
    (p_message_id, p_contract_name, p_contract_version, p_occurred_at, p_received_at,
     p_source, p_correlation_id, p_causation_id, p_scope, p_payload)
  ON CONFLICT (message_id) DO NOTHING;
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
    'ALTER FUNCTION platform.enqueue_outbox_message(uuid,text,text,timestamptz,timestamptz,text,uuid,uuid,jsonb,jsonb) OWNER TO %I',
    definer);
END $$;

REVOKE ALL ON FUNCTION platform.enqueue_outbox_message(uuid,text,text,timestamptz,timestamptz,text,uuid,uuid,jsonb,jsonb) FROM PUBLIC;
