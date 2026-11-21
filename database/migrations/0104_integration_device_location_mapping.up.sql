-- Device-and-zone → PEMO location mapping (ADR-006 D2).
--
-- 2IoThub delivers its own device or zone reference; PEMO resolves it to an
-- Estate, Building, Floor, Unit or Location per ADR-002 and ADR-003.
--
-- The target is a STABLE IDENTIFIER WITH NO FOREIGN KEY. property.* is another
-- module, cross-module foreign keys are forbidden, and the zero-row
-- pg_constraint sweep enforces it. A dangling target is therefore possible by
-- construction, which is deliberate: an unresolvable mapping must quarantine
-- (0044) rather than be prevented at write time by a constraint that would also
-- couple two modules.
CREATE TABLE integration.device_location_mapping (
  mapping_id            text        PRIMARY KEY,

  source_system_type    text        NOT NULL,
  source_system_version text        NOT NULL,
  source_device_ref     text        NOT NULL,
  -- A panel zone, where the source addresses zones rather than devices. Empty
  -- string rather than NULL so the exclusion constraint treats "no zone" as one
  -- value rather than as unknown — NULL is not equal to NULL, which would let two
  -- device-level mappings overlap undetected.
  source_zone_ref       text        NOT NULL DEFAULT '',

  organization_id       text        NOT NULL,   -- tenancy root, stable id, NO FK
  target_type           text        NOT NULL
                                    CHECK (target_type IN ('estate', 'building', 'floor', 'unit', 'location')),
  target_id             text        NOT NULL,   -- stable id into property.*, NO FK

  effective_from        timestamptz NOT NULL,
  effective_to          timestamptz NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT mapping_period_ordered CHECK (effective_to IS NULL OR effective_to > effective_from),

  -- A device is replaced, a zone is re-wired — and an event received last month
  -- must still resolve the way it did then. Two overlapping periods for one
  -- device would make that answer ambiguous, so it is refused.
  CONSTRAINT mapping_no_overlapping_periods
    EXCLUDE USING gist (
      source_system_type    WITH =,
      source_system_version WITH =,
      source_device_ref     WITH =,
      source_zone_ref       WITH =,
      tstzrange(effective_from, effective_to) WITH &&
    )
);

CREATE INDEX device_location_mapping_lookup_idx
  ON integration.device_location_mapping
     (source_system_type, source_system_version, source_device_ref, source_zone_ref);

COMMENT ON TABLE integration.device_location_mapping IS
  'ADR-006 D2. Holds source device and zone references. These are internal: they may be persisted and must never be rendered to a resident, which an explicit test proves. Targets are stable identifiers with no foreign key — property.* is another module.';
