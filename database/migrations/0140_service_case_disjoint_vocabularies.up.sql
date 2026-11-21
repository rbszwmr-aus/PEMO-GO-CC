-- C3 (GEN-055) D0, service_case half — see 0139 for the reasoning; one module per migration is the runner's rule.

-- ═══ service_case ═══════════════════════════════════════════════════════════
ALTER TABLE service_case.service_case ADD COLUMN disposition text;
UPDATE service_case.service_case SET disposition = CASE state
  WHEN 'open'     THEN 'case_opened'
  WHEN 'closed'   THEN 'closure_recorded'
  WHEN 'reopened' THEN 'reopening_recorded'
  ELSE 'status_changed' END;
ALTER TABLE service_case.service_case ALTER COLUMN disposition SET NOT NULL;

ALTER TABLE service_case.service_case DROP CONSTRAINT service_case_state_check;
ALTER TABLE service_case.service_case ADD CONSTRAINT service_case_state_check
  CHECK (state IN ('open', 'assigned', 'in_progress', 'awaiting_external', 'pending_verification',
                   'resolved', 'closed', 'reopened'));
ALTER TABLE service_case.service_case ADD CONSTRAINT service_case_disposition_check
  CHECK (disposition IN ('case_opened', 'owner_assigned', 'status_changed', 'external_completion_recorded',
                         'closure_recorded', 'reopening_recorded'));
ALTER TABLE service_case.service_case DROP CONSTRAINT IF EXISTS service_case_closure_reason_check;
ALTER TABLE service_case.service_case ADD CONSTRAINT service_case_closure_reason_check
  CHECK (closure_reason IS NULL OR closure_reason IN ('work_completed', 'no_fault_found', 'resident_withdrew',
                                                      'duplicate_case', 'transferred_out'));
ALTER TABLE service_case.service_case DROP CONSTRAINT IF EXISTS service_case_reopen_reason_check;
ALTER TABLE service_case.service_case ADD CONSTRAINT service_case_reopen_reason_check
  CHECK (reopen_reason IS NULL OR reopen_reason IN ('work_not_completed', 'issue_recurred', 'closed_in_error'));
ALTER TABLE service_case.service_case ADD CONSTRAINT service_case_closure_reason_when_closed
  CHECK (closure_reason IS NULL OR state = 'closed');
ALTER TABLE service_case.service_case ADD CONSTRAINT service_case_reopen_reason_when_reopened
  CHECK (reopen_reason IS NULL OR state = 'reopened');
COMMENT ON COLUMN service_case.service_case.disposition IS
  'The ACT this assertion records (GEN-055 D0), disjoint from state.';

DROP VIEW service_case.case_current;
CREATE VIEW service_case.case_current AS
SELECT DISTINCT ON (case_id) *,
       state AS lifecycle_state
  FROM service_case.service_case
 ORDER BY case_id, version DESC;
COMMENT ON VIEW service_case.case_current IS
  'ADR-020 D4. Current assertion, and the state read off it. IT DOES NOT READ case_external_link, and must not: an external status alone must never yield a closed Case (CAS-04).';
