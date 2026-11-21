-- Which Ticket caused this Case (GEN-044 D1).
--
-- ─── THIS IS PROVENANCE, NOT THE LINK ───────────────────────────────────────
--
-- ADR-020 D3 puts the Ticket->Case association on the TICKET, and D9 forbids this
-- module a join table: "which Tickets belong to this Case now" is asked through
-- the helpdesk interface and has exactly one home.
--
-- `originating_ticket_ref` answers a DIFFERENT question — WHICH REPORT CAUSED THIS
-- CASE TO EXIST — and the answer never changes. Three neighbours may attach to one
-- Case, and Tickets may be relinked, but only one report was the reason somebody
-- opened it. Deriving that from the current links would give the wrong answer the
-- moment a Ticket is relinked, and no answer at all if the originating Ticket is.
--
-- ─── WHY NULLABLE, WHEN THE ACT REQUIRES IT ─────────────────────────────────
--
-- `createCase` refuses without one, so every Case this surface opens has it. The
-- COLUMN is nullable because rows predating this migration cannot be backfilled:
-- the value lives in `helpdesk`, and a migration may only touch its own schema —
-- the ownership check in the runner enforces exactly that. Making it NOT NULL
-- would require either a cross-schema read this repository forbids in migrations,
-- or inventing a value, and inventing provenance is worse than admitting its
-- absence for the rows that predate the rule.
ALTER TABLE service_case.service_case ADD COLUMN originating_ticket_ref text;

COMMENT ON COLUMN service_case.service_case.originating_ticket_ref IS
  'The stable id of the Ticket whose report caused this Case to be opened. PROVENANCE, not the association: ADR-020 D3 keeps the Ticket->Case link on the Ticket, and this answers the different, permanent question of which report started it. No foreign key (ADR-020 D2). Nullable only because rows predating GEN-044 cannot be backfilled — the value lives in helpdesk, and a migration may touch only its own schema; createCase refuses without one.';

CREATE INDEX service_case_originating_ticket_idx
  ON service_case.service_case (originating_ticket_ref);

-- AND THE VIEW MUST BE RECREATED, for the reason 0135 already recorded and this
-- migration still had to relearn: `case_current` is defined as `SELECT *`, and a
-- view's column list is FIXED AT CREATION. Adding a column to the table does not
-- add it to the view, so every reader of `case_current` would fail with a bare
-- `column "originating_ticket_ref" does not exist` from a query that names the
-- view rather than the table. `CREATE OR REPLACE` cannot change a column list
-- either; the view is dropped and recreated.
DROP VIEW service_case.case_current;
CREATE VIEW service_case.case_current AS
SELECT DISTINCT ON (case_id) *,
       state AS lifecycle_state
  FROM service_case.service_case
 ORDER BY case_id, version DESC;

COMMENT ON VIEW service_case.case_current IS
  'ADR-020 D4. Current assertion, and the state read off it. IT DOES NOT READ case_external_link, and must not: an external status alone must never yield a closed Case (CAS-04).';
