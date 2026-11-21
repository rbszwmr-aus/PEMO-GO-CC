-- Reverse of 0137. Safe: dropping the table returns every organization to the
-- fail-closed default, which refuses more, never less.
DROP TABLE IF EXISTS helpdesk.intake_policy;
