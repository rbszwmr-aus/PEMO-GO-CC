-- Reverse of 0126.
--
-- REFUSES ONCE A REAL SUPERSESSION EXISTS, per 0117, 0118 and 0123. On THIS table
-- a superseding assertion may be a WITHDRAWAL or a CORRECTION, so collapsing the
-- chain would restore text management had corrected, or republish a notice that
-- was withdrawn — and a notice's whole purpose is being the record of what was
-- said. A lossy reversal here rewrites that record.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n
    FROM (SELECT notice_id FROM notices.notice
           GROUP BY notice_id HAVING max(version) > 1) s;
  IF n > 0 THEN
    RAISE EXCEPTION
      'REFUSING to reverse 0126: % notice instance(s) hold more than one assertion. Reversing '
      'would discard the assertions that superseded them -- restoring text that was corrected, or '
      'republishing a notice that was withdrawn. Remove the superseding assertions deliberately '
      'first, or do not reverse.', n;
  END IF;
END $$;

DROP VIEW IF EXISTS notices.notice_current;
DROP TABLE IF EXISTS notices.notice;
