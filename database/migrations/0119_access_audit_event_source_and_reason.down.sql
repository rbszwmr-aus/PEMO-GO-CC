-- Reverse of 0119.
--
-- REFUSES ONCE AN UNATTRIBUTABLE ACT EXISTS. Restoring NOT NULL on the three
-- authority columns requires every row to carry them, and a provisioning or
-- integration act carries none by design. The only way to satisfy the old schema
-- would be to INVENT a principal for those rows — which is precisely the fiction
-- ADR-010 A1 forbids by name — or to delete them, which is destroying audit
-- records. Both are worse than refusing.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM access.audit_event WHERE source <> 'staff';
  IF n > 0 THEN
    RAISE EXCEPTION
      'REFUSING to reverse 0119: % audit event(s) have a non-staff source and therefore carry no '
      'principal. Restoring NOT NULL would require inventing one — the fabricated principal ADR-010 '
      'A1 forbids by name — or deleting audit records. Neither is a reversal. Remove those events '
      'deliberately first, or do not reverse.', n;
  END IF;
END $$;

ALTER TABLE access.audit_event DROP CONSTRAINT audit_event_authority_only_when_staff;
ALTER TABLE access.audit_event DROP CONSTRAINT audit_event_source_check;
ALTER TABLE access.audit_event
  ALTER COLUMN principal_id SET NOT NULL,
  ALTER COLUMN group_id     SET NOT NULL,
  ALTER COLUMN role         SET NOT NULL;
ALTER TABLE access.audit_event DROP COLUMN reason_code, DROP COLUMN source;
