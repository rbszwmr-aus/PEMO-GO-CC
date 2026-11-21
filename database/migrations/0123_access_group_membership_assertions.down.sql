-- Reverse of 0123.
--
-- REFUSES ONCE A REAL SUPERSESSION EXISTS, per 0117 and 0118. Collapsing the
-- table to one row per instance means choosing a row to keep, and on THIS table a
-- superseding assertion is a REMOVAL -- so a lossy reversal would silently
-- restore a person to a group they were taken out of, and with it every grant
-- that group holds. That is the membership half of the same hazard 0118 refuses.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n
    FROM (SELECT membership_id FROM access.group_membership
           GROUP BY membership_id HAVING max(version) > 1) s;
  IF n > 0 THEN
    RAISE EXCEPTION
      'REFUSING to reverse 0123: % membership instance(s) hold more than one assertion. Reversing '
      'would collapse each to a single row and discard the assertions that superseded it -- and on '
      'this table a superseding assertion is a REMOVAL, so the reversal would silently restore a '
      'person to a group they were taken out of, and every grant that group holds with them. Remove '
      'the superseding assertions deliberately first, or do not reverse.', n;
  END IF;
END $$;

DROP INDEX IF EXISTS access.group_membership_instance_version_idx;
ALTER TABLE access.group_membership DROP CONSTRAINT group_membership_version_positive;
ALTER TABLE access.group_membership DROP CONSTRAINT group_membership_version_unique;
ALTER TABLE access.group_membership DROP CONSTRAINT group_membership_pkey;
ALTER TABLE access.group_membership
  DROP COLUMN recorded_at, DROP COLUMN version, DROP COLUMN assertion_id;
ALTER TABLE access.group_membership ADD CONSTRAINT group_membership_pkey PRIMARY KEY (membership_id);

-- The exclusion comes back, and restoring it is also the check: a reversal onto
-- data that already holds two overlapping memberships for one (group, principal)
-- STOPS, rather than leaving a table whose declared invariant its own rows break.
ALTER TABLE access.group_membership
  ADD CONSTRAINT group_membership_no_overlapping_periods
  EXCLUDE USING gist (
    group_id     WITH =,
    principal_id WITH =,
    tstzrange(effective_from, effective_to) WITH &&
  );
