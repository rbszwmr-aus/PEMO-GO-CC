-- Resident business identity.
--
-- There is no credential, password, hash, token or login subject in this schema.
-- That separation is locked, and the PID requires it to be VISIBLE IN THE SCHEMA
-- rather than merely intended: the development auth stub's subject lookup lives
-- in platform.dev_login_identity, in another module's schema, referencing
-- resident_id as a stable identifier with no foreign key.
CREATE TABLE resident.resident (
  resident_id      text        PRIMARY KEY,
  organization_id  text        NOT NULL,   -- stable id, tenancy root, NO FK
  display_name     text        NOT NULL,
  preferred_language text      NOT NULL DEFAULT 'en'
                               CHECK (preferred_language IN ('en', 'zh-Hant')),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resident_organization_idx ON resident.resident (organization_id);

COMMENT ON COLUMN resident.resident.display_name IS
  'The resident''s own name as they have given it. A resident never sees another resident''s name through this contract.';

CREATE TABLE resident.household (
  household_id     text        PRIMARY KEY,
  organization_id  text        NOT NULL,   -- stable id, NO FK
  unit_id          text        NOT NULL,   -- stable id, property.unit, NO FK
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX household_unit_idx ON resident.household (unit_id);
CREATE INDEX household_organization_idx ON resident.household (organization_id);

COMMENT ON COLUMN resident.household.unit_id IS
  'Stable identifier into Property Core. No foreign key: cross-module references use stable identifiers only, and this is the constraint most likely to be violated under time pressure.';
