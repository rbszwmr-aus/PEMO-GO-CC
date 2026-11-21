-- The migration ledger itself lives in this schema, so the runner deletes its
-- ledger row inside the same transaction that drops the schema.
DROP SCHEMA IF EXISTS platform CASCADE;
