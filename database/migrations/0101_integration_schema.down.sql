DROP SCHEMA IF EXISTS integration CASCADE;
-- Dropped because it was absent at the pin. Restoring the pinned schema means
-- restoring its absence too, otherwise "the down migration returns the database
-- to the pin" would be true only approximately.
DROP EXTENSION IF EXISTS btree_gist;
