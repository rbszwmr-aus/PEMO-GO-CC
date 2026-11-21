-- Reverses 0114. Both tables are new to this migration, so the down path drops
-- them entirely; there are no pre-existing rows to restore and no backfill to
-- undo. resident.interest first — it references resident.party.
BEGIN;
DROP TABLE IF EXISTS resident.interest;
DROP TABLE IF EXISTS resident.party;
COMMIT;
