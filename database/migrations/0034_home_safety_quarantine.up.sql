-- Quarantine for events whose unit cannot be resolved.
--
-- This is the case the PID calls out as mattering most and being easiest to get
-- wrong. An event whose unit cannot be resolved must be HELD, VISIBLE and
-- UNASSIGNED. Guessing the nearest match is worse than dropping it, because it
-- sends a stranger's safety alert to the wrong household.
--
-- The committed property-and-identity-model.md says the same thing from the other
-- direction: unresolved or ambiguous mappings are rejected or held for staff
-- review rather than guessed.
--
-- Note what this table does NOT have: any column that would let a later reader
-- record a "best guess" unit. resolved_unit_id is only ever written by an
-- explicit staff resolution, and unresolved rows carry no unit at all.
CREATE TABLE home_safety.event_quarantine (
  quarantine_id      text        PRIMARY KEY,
  organization_id    text        NOT NULL,   -- stable id, NO FK
  source_reference   text        NOT NULL,   -- the PEMO-side reference that could not be resolved
  reason             text        NOT NULL
                                 CHECK (reason IN ('unmapped_unit', 'ambiguous_audience', 'unknown_location')),
  severity           text        NOT NULL
                                 CHECK (severity IN ('normal', 'information', 'advisory',
                                                     'warning', 'critical', 'offline', 'unknown')),
  detail             jsonb       NOT NULL,
  occurred_at        timestamptz NOT NULL,
  received_at        timestamptz NOT NULL,
  correlation_id     uuid        NOT NULL,
  status             text        NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'resolved', 'discarded')),
  resolved_unit_id   text        NULL,       -- written ONLY by an explicit staff resolution
  resolved_at        timestamptz NULL,
  resolved_by        text        NULL,
  CONSTRAINT quarantine_resolution_is_explicit
    CHECK ((status = 'resolved') = (resolved_unit_id IS NOT NULL AND resolved_by IS NOT NULL))
);
CREATE INDEX event_quarantine_status_idx ON home_safety.event_quarantine (status, received_at);

COMMENT ON TABLE home_safety.event_quarantine IS
  'Held, visible and unassigned. A quarantined event has no audience and reaches no resident. It is never silently attached to the nearest household.';
