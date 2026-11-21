-- ============================================================================
-- DEVELOPMENT-ONLY FIXTURE-PARITY SCAFFOLD.  DELETE, DO NOT MIGRATE.
-- ============================================================================
--
-- Approved as decision D1 of the GEN-006-ST Step 1 plan, under four conditions
-- recorded with the approval and restated here because this is exactly the kind
-- of scaffold that becomes permanent:
--
--   1. It lives in a clearly named DEV-ONLY SCHEMA, excluded from any production
--      build path. That is why it is `dev_scaffold` and not one of the four
--      module schemas.
--   2. This is a fixture-parity scaffold. It is NOT the future Notices and
--      Communication, Help Desk or Resident Services implementation.
--   3. Its existence is NOT evidence that those modules are designed. They are
--      not. No authoring, approval, audience, scheduling, thread, assignment or
--      SLA concept exists here — this table holds seeded JSON and no behaviour.
--   4. When those modules land, this schema is DELETED, not migrated. Someone
--      "migrating" it would import a shape nobody ever designed.
--
-- Why it exists at all: MOB-02 needs notices and an open case, and MOB-03 needs a
-- service catalogue. Fixture parity is the acceptance test that makes the
-- parallel Flutter session safe, and dropping roughly twelve fixtures would
-- weaken exactly the guarantee that protects it. The alternative was considered
-- and rejected with the approver.
--
-- The help-desk half of MOB-03 is NOT here: management-office contacts and
-- opening hours are PRP-04, explicitly assigned to Property Core by this PID, and
-- live in property.estate_contact.
CREATE SCHEMA IF NOT EXISTS dev_scaffold;
COMMENT ON SCHEMA dev_scaffold IS
  'DEVELOPMENT ONLY. Fixture-parity scaffold for screen sections whose owning modules are out of scope for GEN-006-ST. Not a module. Owns nothing. Deleted, not migrated, when Notices and Communication, Help Desk and Resident Services are built.';

CREATE TABLE dev_scaffold.screen_content (
  screen        text  NOT NULL,   -- 'mob-02-home' | 'mob-03-services'
  section       text  NOT NULL,   -- 'notices' | 'openCase' | 'quickServices' | 'services' | 'comingSoonNote'
  scenario      text  NOT NULL,   -- the fixture scenario this content belongs to
  payload       jsonb NOT NULL,
  is_dev_only   boolean NOT NULL DEFAULT true CHECK (is_dev_only),
  PRIMARY KEY (screen, section, scenario)
);

COMMENT ON TABLE dev_scaffold.screen_content IS
  'Seeded projection content only. No ownership claim over any business datum. See the header of migration 0090 for the four conditions this table exists under.';
