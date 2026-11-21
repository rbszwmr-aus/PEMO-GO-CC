-- RT5-F6: named SECURITY DEFINER commands that write service_case.
-- open_from_ticket and append_assertion (used by resolveTicketFromCase and
-- the other case acts that append an assertion). Role names are parameterised
-- (pemo.definer_role, default pemo_definer_commands).
-- Table grants and EXECUTE are applied by database/roles/010-grants.sql after migrate.
-- This file only installs the service_case-schema commands. No row data is rewritten.

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
BEGIN
  INSERT INTO service_case.service_case (
    assertion_id, case_id, version, organization_id, state, disposition,
    originating_ticket_ref, recorded_by
  ) VALUES (
    p_assertion_id, p_case_id, 1, p_organization_id, 'open', 'case_opened',
    p_originating_ticket_ref, p_recorded_by
  );
END;
$$;

CREATE OR REPLACE FUNCTION service_case.append_assertion(
  p_assertion_id text,
  p_case_id text,
  p_version integer,
  p_organization_id text,
  p_state text,
  p_disposition text,
  p_assigned_owner_ref text,
  p_is_complaint boolean,
  p_complaint_class text,
  p_respond_by timestamptz,
  p_closure_reason text,
  p_reopen_reason text,
  p_originating_ticket_ref text,
  p_recorded_by text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, service_case
AS $$
BEGIN
  INSERT INTO service_case.service_case (
    assertion_id, case_id, version, organization_id, state, disposition,
    assigned_owner_ref, is_complaint, complaint_class, respond_by,
    closure_reason, reopen_reason, originating_ticket_ref, recorded_by
  ) VALUES (
    p_assertion_id, p_case_id, p_version, p_organization_id, p_state, p_disposition,
    p_assigned_owner_ref, p_is_complaint, p_complaint_class, p_respond_by,
    p_closure_reason, p_reopen_reason, p_originating_ticket_ref, p_recorded_by
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
  EXECUTE format('ALTER FUNCTION service_case.open_from_ticket(text,text,text,text,text) OWNER TO %I', definer);
  EXECUTE format(
    'ALTER FUNCTION service_case.append_assertion(text,text,integer,text,text,text,text,boolean,text,timestamptz,text,text,text,text) OWNER TO %I',
    definer);
END $$;

REVOKE ALL ON FUNCTION service_case.open_from_ticket(text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION service_case.append_assertion(text,text,integer,text,text,text,text,boolean,text,timestamptz,text,text,text,text) FROM PUBLIC;
