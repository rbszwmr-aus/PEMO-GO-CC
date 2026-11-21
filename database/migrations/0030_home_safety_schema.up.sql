CREATE SCHEMA IF NOT EXISTS home_safety;
COMMENT ON SCHEMA home_safety IS
  'Home Safety: resident-readable safety presentation, audience resolution, response state, management communication and all-clear publication. Owns NO device, NO telemetry and NO alarm lifecycle. There is deliberately no device, sensor, gateway, protocol, alarm-acknowledgement or escalation table in this schema, and no column that could hold one.';
