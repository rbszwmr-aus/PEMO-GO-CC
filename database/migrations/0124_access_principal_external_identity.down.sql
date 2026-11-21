-- Reverse of 0124.
--
-- REFUSES ONCE A REAL EXTERNAL IDENTITY IS RECORDED. Dropping `external_id`
-- discards the only link between a PEMO principal and the person an external
-- authenticator knows -- so a later re-registration cannot tell that it is the
-- same human, and would create a second principal for them. Losing an identity
-- mapping silently is worse than refusing to.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM access.staff_principal WHERE identity_source = 'external';
  IF n > 0 THEN
    RAISE EXCEPTION
      'REFUSING to reverse 0124: % principal(s) carry a recorded external identity. Dropping '
      'external_id discards the only link between a PEMO principal and the person the external '
      'authenticator knows, so a later registration would create a SECOND principal for the same '
      'human with no way to notice. Remove them deliberately first, or do not reverse.', n;
  END IF;
END $$;

DROP INDEX IF EXISTS access.staff_principal_external_identity;
ALTER TABLE access.staff_principal DROP CONSTRAINT staff_principal_external_id_only_when_external;
ALTER TABLE access.staff_principal DROP CONSTRAINT staff_principal_identity_source_check;
ALTER TABLE access.staff_principal DROP COLUMN external_id, DROP COLUMN identity_source;
