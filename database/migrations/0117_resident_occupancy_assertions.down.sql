-- Reverse of 0117.
--
-- REFUSES ONCE A REAL SUPERSESSION EXISTS. Collapsing the table back to one row
-- per instance means choosing a row to keep, and the only honest choice —
-- MAX(version) — silently DISCARDS the assertions that superseded it while
-- leaving no trace that it did. Worse, restoring the primary key on occupancy_id
-- would fail outright with two assertions present, so the reversal is either
-- lossy or broken. Before any second assertion exists the reversal is clean.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n
    FROM (SELECT occupancy_id FROM resident.occupancy GROUP BY occupancy_id HAVING max(version) > 1) s;
  IF n > 0 THEN
    RAISE EXCEPTION
      'REFUSING to reverse 0117: % occupancy instance(s) hold more than one assertion. Reversing '
      'would collapse each instance to a single row and discard the assertions that superseded it — '
      'the history IS the table under ADR-013 D3. Remove the superseding assertions deliberately '
      'first, or do not reverse.', n;
  END IF;
END $$;

DROP INDEX IF EXISTS resident.occupancy_instance_version_idx;
ALTER TABLE resident.occupancy DROP CONSTRAINT occupancy_version_positive;
ALTER TABLE resident.occupancy DROP CONSTRAINT occupancy_version_unique;
ALTER TABLE resident.occupancy DROP CONSTRAINT occupancy_pkey;
ALTER TABLE resident.occupancy DROP COLUMN recorded_at, DROP COLUMN version, DROP COLUMN assertion_id;
ALTER TABLE resident.occupancy ADD CONSTRAINT occupancy_pkey PRIMARY KEY (occupancy_id);
