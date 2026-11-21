-- Reverse of 0138. REFUSES once any Case records its origin: that provenance
-- cannot be reconstructed from this schema, because the Ticket that carries the
-- other half lives in helpdesk and a migration may not read it.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM service_case.service_case WHERE originating_ticket_ref IS NOT NULL;
  IF n > 0 THEN
    RAISE EXCEPTION
      'REFUSING to reverse 0138: % assertion(s) record which Ticket caused the Case. Dropping the '
      'column discards provenance this schema cannot rebuild — the other half lives in helpdesk, '
      'which a migration may not read. Remove them deliberately first, or do not reverse.', n;
  END IF;
END $$;

DROP INDEX IF EXISTS service_case.service_case_originating_ticket_idx;

-- The view depends on the column, so it goes first and comes back without it --
-- the mirror of the up migration, and the asymmetry only a full migrate-down
-- exercises (GEN-041 found the same omission that way).
DROP VIEW service_case.case_current;
ALTER TABLE service_case.service_case DROP COLUMN originating_ticket_ref;
CREATE VIEW service_case.case_current AS
SELECT DISTINCT ON (case_id) *,
       state AS lifecycle_state
  FROM service_case.service_case
 ORDER BY case_id, version DESC;
