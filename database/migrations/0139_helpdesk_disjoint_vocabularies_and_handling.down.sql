-- Reverse of 0139 (helpdesk half).
ALTER TABLE helpdesk.ticket_message DROP COLUMN attachment_ref;
DROP TABLE helpdesk.ticket_satisfaction;
DROP TABLE helpdesk.reopen_policy;
DROP VIEW helpdesk.ticket_current;
ALTER TABLE helpdesk.ticket DROP CONSTRAINT ticket_reopen_reason_when_reopening;
ALTER TABLE helpdesk.ticket DROP CONSTRAINT ticket_closure_reason_when_closed;
ALTER TABLE helpdesk.ticket ADD CONSTRAINT ticket_closure_reason_placement CHECK (closure_reason IS NULL OR disposition = 'closed');
ALTER TABLE helpdesk.ticket DROP CONSTRAINT ticket_reopen_reason_check;
ALTER TABLE helpdesk.ticket DROP CONSTRAINT ticket_closure_reason_check;
ALTER TABLE helpdesk.ticket DROP CONSTRAINT ticket_status_check;
ALTER TABLE helpdesk.ticket DROP CONSTRAINT ticket_disposition_check;
UPDATE helpdesk.ticket SET disposition = CASE disposition
  WHEN 'report_opened'       THEN 'opened'
  WHEN 'triage_recorded'     THEN 'triaged'
  WHEN 'escalation_recorded' THEN 'escalated'
  WHEN 'closure_recorded'    THEN 'closed'
  WHEN 'reopening_recorded'  THEN 'reopened'
  ELSE disposition END;
ALTER TABLE helpdesk.ticket ADD CONSTRAINT ticket_disposition_check
  CHECK (disposition IN ('opened', 'triaged', 'escalated', 'closed', 'reopened'));
ALTER TABLE helpdesk.ticket DROP COLUMN reopen_reason;
ALTER TABLE helpdesk.ticket DROP COLUMN status;
CREATE VIEW helpdesk.ticket_current AS
SELECT DISTINCT ON (ticket_id) *, disposition AS lifecycle_state FROM helpdesk.ticket ORDER BY ticket_id, version DESC;
