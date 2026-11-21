-- Platform Foundation schema.
--
-- GEN-006-ST creates schemas for exactly four modules: platform, property,
-- resident and home_safety. The other candidate schemas are deliberately absent.
-- An empty schema is not free: it invites premature coupling and implies an
-- ownership claim this PID has not earned.
CREATE SCHEMA IF NOT EXISTS platform;
COMMENT ON SCHEMA platform IS
  'Platform Foundation: configuration, errors, logging, health, migrations, envelope and idempotency primitives. Owns no business workflow.';
