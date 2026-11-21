-- The whole point: this comes out cleanly, in one migration, leaving nothing.
DROP TABLE IF EXISTS dev_scaffold.screen_content;
DROP SCHEMA IF EXISTS dev_scaffold CASCADE;
