-- Sibling order for the property hierarchy. Labels are not a sort key:
-- floor ordinal and unit index diverge from display text (12/F vs 十二樓,
-- A1 vs Flat A1), and Hong Kong floor omission means "20th floor" is not
-- "20 floors up". sequence then id is the only stable sibling order.
--
-- Floors already had ordinal (never displayed). sequence on floor copies it
-- so every hierarchy table answers the same question the same way.

ALTER TABLE property.estate
  ADD COLUMN sequence integer NOT NULL DEFAULT 0;
ALTER TABLE property.building
  ADD COLUMN sequence integer NOT NULL DEFAULT 0;
ALTER TABLE property.floor
  ADD COLUMN sequence integer NOT NULL DEFAULT 0;
ALTER TABLE property.unit
  ADD COLUMN sequence integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN property.estate.sequence IS
  'Sibling order among estates of the same organization. Not a display value.';
COMMENT ON COLUMN property.building.sequence IS
  'Sibling order among buildings of the same estate (Wing Fu Garden A=1, B=2, C=3).';
COMMENT ON COLUMN property.floor.sequence IS
  'Sibling order among floors of the same building. Copied from ordinal.';
COMMENT ON COLUMN property.unit.sequence IS
  'Sibling order among units of the same floor (flat index; parking/storage from the numeric label).';

UPDATE property.floor SET sequence = ordinal;

UPDATE property.estate SET sequence = CASE estate_id
  WHEN 'est_wing_fu_garden' THEN 1
  WHEN 'est_tsz_wan_court'  THEN 2
  ELSE sequence END;

UPDATE property.building SET sequence = CASE building_id
  WHEN 'blk_wfg_a' THEN 1
  WHEN 'blk_wfg_b' THEN 2
  WHEN 'blk_wfg_c' THEN 3
  WHEN 'blk_twc_1' THEN 1
  WHEN 'blk_twc_2' THEN 2
  ELSE sequence END;

UPDATE property.unit
   SET sequence = COALESCE((regexp_match(label, '([0-9]+)$'))[1]::integer, 0);
