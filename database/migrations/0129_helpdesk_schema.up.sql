-- Helpdesk schema (ADR-020 D2).
--
-- TWO MODULES, NOT ONE, and the split is the decision this schema exists to hold.
-- A TICKET is a person's report — one household's account of a leak, with their
-- messages and their expectation of a reply. A CASE is management's unit of work.
-- Three neighbours reporting one leak is THREE Tickets and ONE Case, and folding
-- them together would force a choice between losing two reporters' threads or
-- duplicating the work three times.
--
-- The consequence that matters for privacy: resident-visible text exists ONLY on a
-- Ticket. The Case has no resident-facing surface at all, which is what makes
-- "nothing on a Case leaks" a property of the schema rather than of a query.
--
-- NO FOREIGN KEY to service_case, or to any other module (ADR-020 D2). Stable ids
-- only, and the link is owned by the Ticket (D3).
CREATE SCHEMA IF NOT EXISTS helpdesk;
COMMENT ON SCHEMA helpdesk IS
  'Helpdesk: the TICKET — one reporter''s request, its intake and triage facts, and its message thread. Owns the link to its primary Case (ADR-020 D3). The only resident-readable text in the Ticket/Case group lives here, on a ticket_message whose immutable visibility says so. No foreign key to service_case or any other module.';
