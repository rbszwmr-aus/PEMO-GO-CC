-- Reverse of 0139: the words go back, the state column and the two tables go away.
DROP VIEW service_case.case_current;
ALTER TABLE service_case.service_case DROP CONSTRAINT service_case_reopen_reason_when_reopened;
ALTER TABLE service_case.service_case DROP CONSTRAINT service_case_closure_reason_when_closed;
ALTER TABLE service_case.service_case DROP CONSTRAINT service_case_reopen_reason_check;
ALTER TABLE service_case.service_case DROP CONSTRAINT service_case_closure_reason_check;
ALTER TABLE service_case.service_case DROP CONSTRAINT service_case_disposition_check;
ALTER TABLE service_case.service_case DROP CONSTRAINT service_case_state_check;
ALTER TABLE service_case.service_case ADD CONSTRAINT service_case_state_check
  CHECK (state IN ('open', 'in_progress', 'pending_verification', 'closed', 'reopened'));
ALTER TABLE service_case.service_case DROP COLUMN disposition;
CREATE VIEW service_case.case_current AS
SELECT DISTINCT ON (case_id) *, state AS lifecycle_state FROM service_case.service_case ORDER BY case_id, version DESC;

