-- Reverse of 0128. Refuses once references exist: the rows point at stored objects
-- this table is the only index of, so dropping it orphans the files themselves.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM platform.attachment_ref;
  IF n > 0 THEN
    RAISE EXCEPTION
      'REFUSING to reverse 0128: % attachment reference(s) exist. This table is the only index of '
      'the stored objects they name, so dropping it orphans them in whatever store holds them. '
      'Remove them deliberately first, or do not reverse.', n;
  END IF;
END $$;

DROP TABLE IF EXISTS platform.attachment_ref;
