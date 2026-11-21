-- Reverse of 0116.
--
-- Dropping an audit table is a real loss of evidence, so this refuses if the
-- table holds anything. In the backfill/greenfield state it is empty and the
-- reversal is clean; once a real act has been audited, reversing means deleting
-- the record of it and that must be a deliberate act, not a migration step.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM access.audit_event;
  IF n > 0 THEN
    RAISE EXCEPTION
      'REFUSING to reverse 0116: access.audit_event holds % row(s). Dropping it destroys the '
      'record of who did what under whose authority — the evidence ADR-010 D1 released 27 writes '
      'on. Empty it deliberately first, or do not reverse.', n;
  END IF;
END $$;

DROP TABLE access.audit_event;
