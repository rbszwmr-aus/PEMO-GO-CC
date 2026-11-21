-- C3 (GEN-055) D0: three disjoint vocabularies per module, and the tables handling needs.
--
-- ─── WHY THE TICKET GETS A STATUS COLUMN ───────────────────────────────────
-- `ticket_current` read `disposition AS lifecycle_state`: one column doing two jobs,
-- the act and the state. That is the GEN-040 defect waiting to happen on tickets —
-- a state check written against an act literal type-checks and silently matches.
-- The act vocabulary is RENAMED so no literal appears in both (a rename, not a
-- revision: the assertions are append-only for the app and this runs as the
-- owner; it changes the word, never the fact — same as 0136), and the state the
-- act put the ticket in is carried on each assertion as `status`.
--
-- ─── WHY THE CASE GETS A DISPOSITION COLUMN ─────────────────────────────────
-- Cases had a state and no act vocabulary. Now each assertion says what was DONE.
-- `case_state` is WIDENED (assigned, awaiting_external, resolved), never renamed:
-- GEN-038's values stand, `reopened` included, exactly as case_current computes it.

-- ═══ helpdesk ═══════════════════════════════════════════════════════════════
UPDATE helpdesk.ticket SET disposition = CASE disposition
  WHEN 'opened'    THEN 'report_opened'
  WHEN 'triaged'   THEN 'triage_recorded'
  WHEN 'escalated' THEN 'escalation_recorded'
  WHEN 'closed'    THEN 'closure_recorded'
  WHEN 'reopened'  THEN 'reopening_recorded'
  ELSE disposition END;

ALTER TABLE helpdesk.ticket ADD COLUMN status text;
UPDATE helpdesk.ticket SET status = CASE disposition
  WHEN 'report_opened'       THEN 'open'
  WHEN 'triage_recorded'     THEN 'triaged'
  WHEN 'escalation_recorded' THEN 'in_progress'
  WHEN 'closure_recorded'    THEN 'closed'
  WHEN 'reopening_recorded'  THEN 'open'
  ELSE 'open' END;
ALTER TABLE helpdesk.ticket ALTER COLUMN status SET NOT NULL;
ALTER TABLE helpdesk.ticket ADD COLUMN reopen_reason text;

ALTER TABLE helpdesk.ticket DROP CONSTRAINT ticket_disposition_check;
ALTER TABLE helpdesk.ticket ADD CONSTRAINT ticket_disposition_check
  CHECK (disposition IN ('report_opened', 'triage_recorded', 'escalation_recorded', 'status_set',
                         'resolution_recorded', 'closure_recorded', 'reopening_recorded'));
ALTER TABLE helpdesk.ticket ADD CONSTRAINT ticket_status_check
  CHECK (status IN ('open', 'triaged', 'in_progress', 'awaiting_resident', 'resolved', 'closed'));
ALTER TABLE helpdesk.ticket DROP CONSTRAINT IF EXISTS ticket_closure_reason_check;
ALTER TABLE helpdesk.ticket ADD CONSTRAINT ticket_closure_reason_check
  CHECK (closure_reason IS NULL OR closure_reason IN ('fixed', 'resident_withdrew', 'duplicate_report',
                                                      'no_action_required', 'resolved_by_case'));
ALTER TABLE helpdesk.ticket ADD CONSTRAINT ticket_reopen_reason_check
  CHECK (reopen_reason IS NULL OR reopen_reason IN ('not_fixed', 'recurred', 'closed_in_error'));
-- a closure reason belongs to a closed ticket; a reopen reason to a reopening act
ALTER TABLE helpdesk.ticket DROP CONSTRAINT ticket_closure_reason_placement;   -- keyed on the retired disposition 'closed'
ALTER TABLE helpdesk.ticket ADD CONSTRAINT ticket_closure_reason_when_closed
  CHECK (closure_reason IS NULL OR status = 'closed');
ALTER TABLE helpdesk.ticket ADD CONSTRAINT ticket_reopen_reason_when_reopening
  CHECK (reopen_reason IS NULL OR disposition = 'reopening_recorded');

COMMENT ON COLUMN helpdesk.ticket.status IS
  'WHAT THE TICKET IS after this assertion (GEN-055 D0). ticket_current reads lifecycle_state off it. Disjoint from disposition (what was DONE) by construction — the generator refuses a shared literal.';
COMMENT ON COLUMN helpdesk.ticket.disposition IS
  'The ACT this assertion records, in a vocabulary DISJOINT from status (GEN-055 D0). Renamed from opened/triaged/escalated/closed/reopened: the old literals were also the lifecycle.';

DROP VIEW helpdesk.ticket_current;
CREATE VIEW helpdesk.ticket_current AS
SELECT DISTINCT ON (ticket_id) *,
       status AS lifecycle_state
  FROM helpdesk.ticket
 ORDER BY ticket_id, version DESC;
COMMENT ON VIEW helpdesk.ticket_current IS
  'ADR-020 D4. The current assertion and the state read off it — off `status`, not off the act (GEN-055 D0).';

-- A message may carry ONE existing platform.attachment_ref by id (ADR-019 D8 pattern;
-- creating attachments is out of scope). NULL means none.
ALTER TABLE helpdesk.ticket_message ADD COLUMN attachment_ref text;

-- Residents may reopen only where the organization says so, and only within the window.
-- FAIL-CLOSED: no row means residents cannot reopen (the intake_policy pattern).
CREATE TABLE helpdesk.reopen_policy (
  organization_id text PRIMARY KEY,
  resident_reopen_window_days integer NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reopen_policy_window_positive CHECK (resident_reopen_window_days >= 0)
);
COMMENT ON TABLE helpdesk.reopen_policy IS
  'GEN-055: whether and for how long after closure a reporter may reopen their own ticket. Absent row = not permitted.';

-- One satisfaction fact per CLOSURE of a ticket: (ticket, closure version) is the identity,
-- so a reopen and a second closure open a second slot and a retry collapses to one row.
CREATE TABLE helpdesk.ticket_satisfaction (
  satisfaction_id text PRIMARY KEY,
  ticket_id text NOT NULL,
  closure_version integer NOT NULL,
  respondent_ref text NOT NULL,
  rating integer NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_satisfaction_once_per_closure UNIQUE (ticket_id, closure_version),
  CONSTRAINT ticket_satisfaction_rating_range CHECK (rating BETWEEN 1 AND 5)
);
COMMENT ON TABLE helpdesk.ticket_satisfaction IS
  'GEN-055: the reporter''s rating of one closure. Once per closure by constraint; a second closure is a new slot.';

