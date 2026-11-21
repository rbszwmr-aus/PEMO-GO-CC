-- Reverse of 0118.
--
-- REFUSES ONCE A REAL SUPERSESSION EXISTS, per 0117's precedent and for the same
-- reason: collapsing the table back to one row per instance means choosing a row
-- to keep, and the only honest choice — MAX(version) — silently DISCARDS the
-- assertions that superseded it. On this table those assertions are REVOCATIONS,
-- so a lossy reversal would resurrect withdrawn authority. That is the one thing
-- an authority table must never do quietly.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n
    FROM (SELECT grant_id FROM access.scope_grant GROUP BY grant_id HAVING max(version) > 1) s;
  IF n > 0 THEN
    RAISE EXCEPTION
      'REFUSING to reverse 0118: % grant instance(s) hold more than one assertion. Reversing would '
      'collapse each to a single row and discard the assertions that superseded it — and on this '
      'table a superseding assertion is a REVOCATION, so the reversal would silently restore '
      'authority that was withdrawn. Remove the superseding assertions deliberately first, or do '
      'not reverse.', n;
  END IF;
END $$;

DROP INDEX IF EXISTS access.scope_grant_instance_version_idx;
ALTER TABLE access.scope_grant DROP CONSTRAINT scope_grant_version_positive;
ALTER TABLE access.scope_grant DROP CONSTRAINT scope_grant_version_unique;
ALTER TABLE access.scope_grant DROP CONSTRAINT scope_grant_pkey;
ALTER TABLE access.scope_grant DROP COLUMN recorded_at, DROP COLUMN version, DROP COLUMN assertion_id;
ALTER TABLE access.scope_grant ADD CONSTRAINT scope_grant_pkey PRIMARY KEY (grant_id);

-- The exclusion constraint comes back. It can only fail here if the table already
-- holds two overlapping grants for one (group, role, node) — a state 0118 made
-- reachable. Restoring the constraint is therefore also the check: a reversal
-- onto ambiguous data STOPS, rather than leaving a table whose declared invariant
-- its own rows violate.
ALTER TABLE access.scope_grant
  ADD CONSTRAINT scope_grant_no_overlapping_periods
  EXCLUDE USING gist (
    group_id  WITH =,
    role      WITH =,
    node_kind WITH =,
    node_id   WITH =,
    tstzrange(effective_from, effective_to) WITH &&
  );
