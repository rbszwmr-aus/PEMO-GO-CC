-- The accepted hierarchy (ADR-002):
--
--   Organization (required, tenancy root)
--   └── Portfolio (optional)
--       └── Estate
--           └── Phase (optional)
--               └── Building / Block
--                   └── Floor
--                       └── Unit
--
-- TWO optional tiers means FOUR combinations, and all four must work:
-- with/without Portfolio × with/without Phase. All four are seeded and tested.
--
-- organization_id is a stable identifier column with NO foreign key. Organization
-- lives in the platform schema and cross-module foreign keys are forbidden by the
-- committed architecture. It is indexed because every scoped query filters on it.

CREATE TABLE property.portfolio (
  portfolio_id     text        PRIMARY KEY,
  organization_id  text        NOT NULL,   -- stable id, platform.organization, NO FK
  name_en          text        NOT NULL,
  name_zh_hant     text        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portfolio_organization_idx ON property.portfolio (organization_id);

CREATE TABLE property.estate (
  estate_id        text        PRIMARY KEY,
  organization_id  text        NOT NULL,   -- stable id, NO FK
  portfolio_id     text        NULL REFERENCES property.portfolio (portfolio_id),
  name_en          text        NOT NULL,
  name_zh_hant     text        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX estate_organization_idx ON property.estate (organization_id);
COMMENT ON COLUMN property.estate.portfolio_id IS
  'NULL is valid and is tested. An estate with no portfolio reads exactly as the hierarchy did before ADR-002.';

CREATE TABLE property.phase (
  phase_id      text        PRIMARY KEY,
  estate_id     text        NOT NULL REFERENCES property.estate (estate_id),
  name_en       text        NOT NULL,
  name_zh_hant  text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- Composite key so a Building can be constrained to a Phase of its OWN Estate.
CREATE UNIQUE INDEX phase_id_estate_uk ON property.phase (phase_id, estate_id);

-- GEN-001-ST MAJOR-003: a Building belongs to an Estate and MAY belong to one
-- Phase. Buildings without phases are valid and must be tested.
--
-- The composite foreign key below is what stops the subtle version of this bug:
-- a building in Estate A pointing at a phase of Estate B. Without it that is a
-- perfectly valid row that produces a wrong notification audience.
CREATE TABLE property.building (
  building_id   text        PRIMARY KEY,
  estate_id     text        NOT NULL REFERENCES property.estate (estate_id),
  phase_id      text        NULL,
  name_en       text        NOT NULL,
  name_zh_hant  text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT building_phase_belongs_to_same_estate
    FOREIGN KEY (phase_id, estate_id) REFERENCES property.phase (phase_id, estate_id)
);
CREATE INDEX building_estate_idx ON property.building (estate_id);
CREATE INDEX building_phase_idx ON property.building (phase_id);

CREATE TABLE property.floor (
  floor_id      text        PRIMARY KEY,
  building_id   text        NOT NULL REFERENCES property.building (building_id),
  label         text        NOT NULL,          -- resident-readable, e.g. '12/F'. Not a numeric index.
  ordinal       integer     NOT NULL,          -- ordering only; never displayed
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, label)
);

-- Unit. THE UNIT LEVEL IS TERMINAL (ADR-003 Q5). Subdivided units, co-living and
-- hostel arrangements are explicitly out of scope, so no authorization or
-- audience rule needs a sub-unit hop and no sub-unit scaffolding exists here.
--
-- unit_class (ADR-003 Q2): residential, parking and storage sit at the SAME level
-- and reuse the same assignment, occupancy and effective-date machinery. Only
-- residential units constitute a resident's home. A resident holding a parking
-- space must never see it presented as a second home — enforced in the read
-- paths and tested.
CREATE TABLE property.unit (
  unit_id       text        PRIMARY KEY,
  floor_id      text        NOT NULL REFERENCES property.floor (floor_id),
  unit_class    text        NOT NULL CHECK (unit_class IN ('residential', 'parking', 'storage')),
  label         text        NOT NULL,          -- resident-readable, e.g. 'A1'
  external_ref  text        NULL,              -- namespaced external reference, optional
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (floor_id, label)
);
CREATE INDEX unit_class_idx ON property.unit (unit_class);

COMMENT ON COLUMN property.unit.unit_class IS
  'residential | parking | storage. PEMO owns the space as a property object and who holds it. It does NOT own access control, gate operation, plate recognition, tariffs, payment, transactions, real-time occupancy, visitor allocation or enforcement — all of that belongs to the existing car-park system reached through 2IoThub. The test: if a field would need to know whether a car is currently parked, or whether a barrier should lift, it does not belong in PEMO.';
