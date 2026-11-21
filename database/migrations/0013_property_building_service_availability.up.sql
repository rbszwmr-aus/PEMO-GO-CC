-- Resident-facing availability for building services (ADR-003 Q4).
--
-- The staleness rule is enforced from day one and is not a nicety: a state with
-- no recent update renders as UNKNOWN, never as in-service. A lift shown as
-- working when it is not is the same class of failure as a green "all safe" over
-- stale sensor data — the interface asserts something it does not know.
--
-- Hence there is no `is_in_service` boolean anywhere: every record carries the
-- time of its last update and the identity of its source, and the read path reads
-- the AGE, not just the value.
CREATE TABLE property.building_service_availability (
  location_id               text        PRIMARY KEY REFERENCES property.location (location_id) ON DELETE CASCADE,
  state                     text        NOT NULL CHECK (state IN ('in_service', 'out_of_service', 'unknown')),
  source                    text        NOT NULL CHECK (source IN ('2iothub', 'management')),
  last_updated_at           timestamptz NOT NULL,
  freshness_window_seconds  integer     NOT NULL CHECK (freshness_window_seconds > 0),
  note_en                   text        NULL,
  note_zh_hant              text        NULL
);

COMMENT ON COLUMN property.building_service_availability.source IS
  'Where the state came from: monitored through 2IoThub, or entered manually by management. Both paths produce the same PEMO-side projection. PEMO does not own lift telemetry, controller state or fault codes and must never display them to residents.';
