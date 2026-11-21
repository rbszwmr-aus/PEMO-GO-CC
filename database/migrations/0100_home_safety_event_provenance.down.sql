-- Reverses cleanly: the columns carry no data that existed before this migration.
-- Every row was backfilled to unknown_pre_adr_006, which is the absence of
-- provenance, so dropping the columns loses nothing that was ever recorded.
ALTER TABLE home_safety.safety_event
  DROP CONSTRAINT IF EXISTS provenance_is_complete_or_absent,
  DROP CONSTRAINT IF EXISTS provenance_state_is_known;

DROP INDEX IF EXISTS home_safety.safety_event_provenance_state_idx;

ALTER TABLE home_safety.safety_event
  DROP COLUMN IF EXISTS provenance_state,
  DROP COLUMN IF EXISTS classified_at,
  DROP COLUMN IF EXISTS policy_version,
  DROP COLUMN IF EXISTS normalised_event_type,
  DROP COLUMN IF EXISTS source_classification,
  DROP COLUMN IF EXISTS source_event_code,
  DROP COLUMN IF EXISTS source_system_version,
  DROP COLUMN IF EXISTS source_system_type;
