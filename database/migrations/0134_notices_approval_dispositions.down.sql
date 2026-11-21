-- Reverse of 0134. REFUSES once any assertion uses a disposition the narrower
-- constraint cannot hold: reversing would leave a table whose own rows break its
-- declared invariant, which is worse than not reversing.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM notices.notice WHERE disposition IN ('pending', 'approved');
  IF n > 0 THEN
    RAISE EXCEPTION
      'REFUSING to reverse 0134: % assertion(s) use the gated-path dispositions. Reversing would '
      'leave rows the restored constraint forbids. Resolve those notices first, or do not reverse.', n;
  END IF;
END $$;

ALTER TABLE notices.notice DROP CONSTRAINT notice_disposition_check;
ALTER TABLE notices.notice ADD CONSTRAINT notice_disposition_check
  CHECK (disposition IN ('drafted', 'published', 'withdrawn'));

CREATE OR REPLACE VIEW notices.notice_current AS
WITH latest AS (
  SELECT DISTINCT ON (notice_id) * FROM notices.notice ORDER BY notice_id, version DESC
)
SELECT l.*,
  CASE
    WHEN l.disposition = 'withdrawn' THEN 'withdrawn'
    WHEN l.disposition = 'drafted'   THEN 'draft'
    WHEN l.publish_at IS NOT NULL AND l.publish_at > now() THEN 'scheduled'
    WHEN l.expire_at  IS NOT NULL AND l.expire_at <= now() THEN 'expired'
    ELSE 'live'
  END AS lifecycle_state
FROM latest l;
