-- Reverse of 0127. These tables are append-only records of what was told to whom
-- and what came back; dropping them is dropping that record, so the reversal is
-- refused once any of it exists rather than quietly discarding it.
DO $$
DECLARE n bigint;
BEGIN
  SELECT (SELECT count(*) FROM notices.notice_audience)
       + (SELECT count(*) FROM notices.notice_acknowledgement) INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION
      'REFUSING to reverse 0127: % audience/acknowledgement row(s) exist. These record who was '
      'told and who responded; dropping them destroys the only copy. Remove them deliberately '
      'first, or do not reverse.', n;
  END IF;
END $$;

DROP TABLE IF EXISTS notices.notice_acknowledgement;
DROP TABLE IF EXISTS notices.notice_audience;
DROP TABLE IF EXISTS notices.notice_target;
