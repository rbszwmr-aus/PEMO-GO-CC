-- Reverse of 0121: `principal` -> `staff`.
--
-- LOSSY IF A NON-STAFF PRINCIPAL HAS ACTED, AND IT REFUSES IN THAT CASE. The
-- whole reason for the rename is that `principal` covers actors `staff` does not
-- — a resident acting as themselves, most immediately. Reversing relabels those
-- rows with an audience they do not belong to, in the one table whose purpose is
-- to be a truthful record. A row whose role is not one of the management roles is
-- exactly such a case.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM access.audit_event
   WHERE source = 'principal' AND role NOT IN ('estate_staff', 'approver', 'integration_support', 'grant_administrator');
  IF n > 0 THEN
    RAISE EXCEPTION
      'REFUSING to reverse 0121: % audit event(s) record a principal who is not staff (role not one '
      'of the four management roles). Reversing would relabel them `staff`, which is an audience '
      'they do not belong to, in the record that exists to be truthful. Remove them deliberately '
      'first, or do not reverse.', n;
  END IF;
END $$;

UPDATE access.audit_event SET source = 'staff' WHERE source = 'principal';

ALTER TABLE access.audit_event DROP CONSTRAINT audit_event_authority_only_when_principal;
ALTER TABLE access.audit_event DROP CONSTRAINT audit_event_source_check;

ALTER TABLE access.audit_event
  ADD CONSTRAINT audit_event_source_check
  CHECK (source IN ('provisioning', 'staff', 'integration'));

ALTER TABLE access.audit_event
  ADD CONSTRAINT audit_event_authority_only_when_staff
  CHECK (num_nonnulls(principal_id, group_id, role) = CASE WHEN source = 'staff' THEN 3 ELSE 0 END);
