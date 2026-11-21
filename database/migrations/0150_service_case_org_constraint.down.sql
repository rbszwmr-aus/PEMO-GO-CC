-- Restore the 0148 append_assertion body (no organization_id constraint in SQL).

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
