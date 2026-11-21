-- Service Case schema (ADR-020 D2).
--
-- MANAGEMENT'S UNIT OF WORK, and deliberately not the work itself. PEMO is the
-- system of record for the CASE — that a job exists, who owns it, whether it is
-- verified and closed — and a CONSUMER of the work order that lives in somebody
-- else's system (ADR-020 D1). The moment this schema grows a technician, a part,
-- a labour line or a cost, PEMO has started to model the work, and the forbidden-
-- terms scan over this schema exists to make that a build failure rather than a
-- discovery.
--
-- NOTHING HERE IS EVER RESIDENT-VISIBLE (ADR-020 D5). `case_note` has no
-- visibility column at all, which is stronger than defaulting one to internal: a
-- leak would require adding a column, not flipping a value.
CREATE SCHEMA IF NOT EXISTS service_case;
COMMENT ON SCHEMA service_case IS
  'Service Case: management''s unit of work — state, owner, complaint classification, verification and closure. A CONSUMER of external work orders, never a model of the work (ADR-020 D1): no technician, parts, labour, cost or schedule, enforced by a forbidden-terms scan. Nothing here is resident-visible. No foreign key to helpdesk or any other module.';
