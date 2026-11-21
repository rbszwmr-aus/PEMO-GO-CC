-- The "three residents, one Case" shape, and the visibility split (GEN-038 D10).
--
-- WHY THIS FIXTURE AND NOT A SIMPLER ONE. Two facts about this model are easy to
-- state and impossible to test without real data:
--
--   TWO TICKETS, ONE CASE      the shape the Ticket/Case split exists for. With a
--                              single Ticket the model looks like a pointless
--                              indirection, and a resolver that silently returned
--                              only the first reporter would pass.
--   ONE THREAD, TWO AUDIENCES  a resident_visible reply and an internal note on
--                              the SAME Ticket. A fixture with only visible
--                              messages cannot show the filter doing anything.
--
-- IDEMPOTENT BY DELETE-THEN-INSERT (R5b H2), and ordered by dependency.
-- ESCAPED: `_` is a LIKE wildcard (R5b H1).
DELETE FROM service_case.case_satisfaction   WHERE case_id LIKE 'cse\_seed\_%' ESCAPE '\';
DELETE FROM service_case.case_external_link  WHERE case_id LIKE 'cse\_seed\_%' ESCAPE '\';
DELETE FROM service_case.case_note           WHERE case_id LIKE 'cse\_seed\_%' ESCAPE '\';
DELETE FROM service_case.service_case        WHERE case_id LIKE 'cse\_seed\_%' ESCAPE '\';

INSERT INTO service_case.service_case
  (assertion_id, case_id, version, organization_id, state, disposition, assigned_owner_ref,
   is_complaint, recorded_by)
VALUES
  ('csea_seed_1', 'cse_seed_leak', 1, 'org_wingfu_holdings', 'open', 'case_opened',
   'stf_wfg_manager', false, 'stf_wfg_manager'),
  -- The vendor says it is done. That is a CLAIM: the Case moves to
  -- pending_verification and NOT to closed (CAS-04).
  ('csea_seed_2', 'cse_seed_leak', 2, 'org_wingfu_holdings', 'pending_verification', 'external_completion_recorded',
   'stf_wfg_manager', false, 'stf_wfg_manager');

INSERT INTO service_case.case_note (note_id, case_id, author_ref, body) VALUES
  ('cnot_seed_1', 'cse_seed_leak', 'stf_wfg_manager',
   'Contractor attended; riser valve replaced. Awaiting verification before closing.');

INSERT INTO service_case.case_external_link
  (link_id, case_id, external_system, external_ref, deep_link, last_status, last_summary, synced_at)
VALUES
  ('cxl_seed_1', 'cse_seed_leak', 'acme_workorders', 'WO-88421',
   'https://example.invalid/wo/WO-88421', 'completed',
   'Riser valve replaced.', now() - interval '2 hours');

-- ── the Tickets, in helpdesk, linked by STABLE ID with no foreign key ────────
DELETE FROM helpdesk.ticket_message   WHERE ticket_id LIKE 'tkt\_seed\_%' ESCAPE '\';
DELETE FROM helpdesk.ticket_reference WHERE ticket_id LIKE 'tkt\_seed\_%' ESCAPE '\';
DELETE FROM helpdesk.ticket           WHERE ticket_id LIKE 'tkt\_seed\_%' ESCAPE '\';

INSERT INTO helpdesk.ticket
  (assertion_id, ticket_id, version, organization_id, disposition, status, channel,
   reporter_ref, reporter_kind, category, description, node_kind, node_id,
   ticket_type, priority, queue, primary_case_ref, recorded_by)
VALUES
  ('tkta_seed_1a', 'tkt_seed_a', 1, 'org_wingfu_holdings', 'report_opened', 'open', 'resident_app',
   'res_wfg_chan', 'resident', 'water', 'Water coming through the ceiling in the bathroom.',
   'unit', 'unit_wfg_a_12_a1', NULL, NULL, NULL, NULL, 'res_wfg_chan'),
  ('tkta_seed_1b', 'tkt_seed_a', 2, 'org_wingfu_holdings', 'triage_recorded', 'triaged', 'resident_app',
   'res_wfg_chan', 'resident', 'water', 'Water coming through the ceiling in the bathroom.',
   'unit', 'unit_wfg_a_12_a1', 'leak', 'high', 'q_maintenance', 'cse_seed_leak', 'stf_wfg_manager'),
  -- The SECOND reporter. Same Case, their own Ticket and their own thread.
  ('tkta_seed_2a', 'tkt_seed_b', 1, 'org_wingfu_holdings', 'triage_recorded', 'triaged', 'phone',
   'res_wfg_lam', 'resident', 'water', 'Damp patch on the corridor ceiling, 12/F.',
   'floor', 'fl_wfg_a_12', 'leak', 'normal', 'q_maintenance', 'cse_seed_leak', 'stf_wfg_manager');

INSERT INTO helpdesk.ticket_reference (ticket_id, organization_id, display_ref) VALUES
  ('tkt_seed_a', 'org_wingfu_holdings', 'WFG-2026-0001'),
  ('tkt_seed_b', 'org_wingfu_holdings', 'WFG-2026-0002');

-- ONE THREAD, TWO AUDIENCES. The internal note must never reach the resident.
INSERT INTO helpdesk.ticket_message
  (message_id, ticket_id, author_ref, author_kind, body, visibility)
VALUES
  ('tmsg_seed_1', 'tkt_seed_a', 'res_wfg_chan', 'resident',
   'Water coming through the ceiling in the bathroom.', 'resident_visible'),
  ('tmsg_seed_2', 'tkt_seed_a', 'stf_wfg_manager', 'staff_principal',
   'Contractor booked for tomorrow morning. Sorry for the disruption.', 'resident_visible'),
  -- INTERNAL. The fixture that makes the visibility filter provable.
  ('tmsg_seed_3', 'tkt_seed_a', 'stf_wfg_manager', 'staff_principal',
   'Third leak on this riser in six months — flag for the capital works review.', 'internal');

-- ── intake policy: anonymity is a decision, per organization (GEN-044 D3) ────
--
-- TWO ORGANIZATIONS, AND THE SECOND ONE IS THE POINT. Wing Fu accepts anonymous
-- reports; Harbour Property has NO ROW, so it does not — not because anyone forbade
-- it, but because nobody has decided, which is the fail-closed default doing its
-- job. A seed that configured every organization would hide that behaviour behind
-- data and leave the default untested.
DELETE FROM helpdesk.intake_policy WHERE organization_id IN ('org_wingfu_holdings','org_harbour_property');
INSERT INTO helpdesk.intake_policy (organization_id, allow_anonymous) VALUES
  ('org_wingfu_holdings', true);
