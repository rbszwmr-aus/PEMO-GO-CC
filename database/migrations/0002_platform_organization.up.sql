-- Organization — the tenancy root (ADR-002, Accepted, Option B).
--
-- Required, always present, and load-bearing from the first migration. The
-- Product Owner was explicit that this describes how the business already
-- operates; it is not future-proofing against a hypothetical second customer.
-- Cross-organization isolation is therefore a SECURITY test, not an optional
-- extra.
--
-- The configurable unit terminology (Unit / Flat / Room) belongs here rather
-- than to Property Core, because ADR-003 Q5 settles it as PLT-01 "configurable
-- terminology by customer" — a naming variant of one level, not a structure.
CREATE TABLE platform.organization (
  organization_id   text        PRIMARY KEY,
  code              text        NOT NULL UNIQUE,
  name_en           text        NOT NULL,
  name_zh_hant      text        NOT NULL,
  unit_label_en     text        NOT NULL DEFAULT 'Flat',
  unit_label_zh_hant text       NOT NULL DEFAULT '室',
  default_language  text        NOT NULL DEFAULT 'en'
                                CHECK (default_language IN ('en', 'zh-Hant')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE platform.organization IS
  'Tenancy root (ADR-002). Never serialized to a resident: no screen exposes Organization or Portfolio. It exists in the authorization scope only.';
