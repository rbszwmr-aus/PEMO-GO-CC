-- Restores NOT NULL on the resident-facing text.
--
-- THIS SUCCEEDS ONLY WHILE NO ROW HAS EXERCISED THE PERMISSION 0113 GRANTED.
-- A permissive migration's rollback is a claim about the DATA, not the schema.
-- Check before running:
--
--   SELECT count(*) FROM home_safety.safety_event
--    WHERE instruction_en IS NULL OR instruction_zh_hant IS NULL
--       OR reported_by_en IS NULL OR reported_by_zh_hant IS NULL;
--
-- Non-zero means this rollback would require destroying or fabricating
-- resident-facing safety text. Do neither. Decide what those events should say.

ALTER TABLE home_safety.safety_event
  ALTER COLUMN instruction_en      SET NOT NULL,
  ALTER COLUMN instruction_zh_hant SET NOT NULL,
  ALTER COLUMN reported_by_en      SET NOT NULL,
  ALTER COLUMN reported_by_zh_hant SET NOT NULL;

-- disclaimer_* is NOT listed: 0113 never relaxed it. A statutory life-safety
-- statement stays structurally impossible to omit.
