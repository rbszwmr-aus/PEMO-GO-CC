-- Household membership and occupancy, both effective-dated.
--
-- Authorization requires an ACTIVE, NON-EXPIRED relationship evaluated at the
-- time of the operation — not at login, and not cached. A caregiver scope that
-- expired yesterday is not authorization today, which is exactly the
-- caregiver-permission-expired fixture.
CREATE TABLE resident.household_membership (
  membership_id   text        PRIMARY KEY,
  household_id    text        NOT NULL REFERENCES resident.household (household_id),
  resident_id     text        NOT NULL REFERENCES resident.resident (resident_id),
  role            text        NOT NULL
                              CHECK (role IN ('owner_occupier', 'tenant', 'household_member', 'caregiver')),
  effective_from  timestamptz NOT NULL,
  effective_to    timestamptz NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT membership_period_ordered CHECK (effective_to IS NULL OR effective_to > effective_from)
);
CREATE INDEX household_membership_resident_idx ON resident.household_membership (resident_id);
CREATE INDEX household_membership_household_idx ON resident.household_membership (household_id);

-- Occupancy is the resident-to-unit relationship. It carries unit_class so the
-- read paths can exclude parking and storage WITHOUT reaching into Property
-- Core's tables — the value is copied at assignment time as a stable projection
-- of the unit's class, and the integration test asserts the two agree.
CREATE TABLE resident.occupancy (
  occupancy_id    text        PRIMARY KEY,
  resident_id     text        NOT NULL REFERENCES resident.resident (resident_id),
  household_id    text        NULL REFERENCES resident.household (household_id),
  unit_id         text        NOT NULL,   -- stable id, NO FK
  unit_class      text        NOT NULL CHECK (unit_class IN ('residential', 'parking', 'storage')),
  role            text        NOT NULL
                              CHECK (role IN ('owner_occupier', 'tenant', 'household_member', 'caregiver')),
  status          text        NOT NULL CHECK (status IN ('active', 'ended')),
  source          text        NOT NULL,
  effective_from  timestamptz NOT NULL,
  effective_to    timestamptz NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT occupancy_period_ordered CHECK (effective_to IS NULL OR effective_to > effective_from)
);
CREATE INDEX occupancy_resident_idx ON resident.occupancy (resident_id);
CREATE INDEX occupancy_unit_idx ON resident.occupancy (unit_id);

COMMENT ON COLUMN resident.occupancy.unit_class IS
  'Only residential units constitute a home. Parking and storage occupancy exists to support the unit profile and entitlement view; it is a property record and nothing more. It must never appear in unit context, the unit switcher or safety audience resolution.';
