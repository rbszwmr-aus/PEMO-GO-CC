-- Reverse of 0136: rename the events back and restore the overlapping vocabulary.
-- Safe in the sense that nothing is lost — it is the same rename in reverse — but
-- it reintroduces the overlap that made a wrong comparison silently false.
UPDATE notices.notice SET disposition = CASE disposition
  WHEN 'draft_saved'          THEN 'drafted'
  WHEN 'approval_requested'   THEN 'pending'
  WHEN 'approval_granted'     THEN 'approved'
  WHEN 'publication_released' THEN 'published'
  WHEN 'withdrawal_recorded'  THEN 'withdrawn'
  ELSE disposition END;

ALTER TABLE notices.notice DROP CONSTRAINT notice_disposition_check;
ALTER TABLE notices.notice ADD CONSTRAINT notice_disposition_check
  CHECK (disposition IN ('drafted', 'pending', 'approved', 'published', 'withdrawn'));

DROP VIEW notices.notice_current;
CREATE VIEW notices.notice_current AS
WITH latest AS (
  SELECT DISTINCT ON (notice_id) * FROM notices.notice ORDER BY notice_id, version DESC
)
SELECT l.*,
  CASE
    WHEN l.disposition = 'withdrawn' THEN 'withdrawn'
    WHEN l.disposition = 'drafted'   THEN 'draft'
    WHEN l.disposition = 'pending'   THEN 'pending_approval'
    WHEN l.disposition = 'approved'  THEN 'approved'
    WHEN l.publish_at IS NOT NULL AND l.publish_at > now() THEN 'scheduled'
    WHEN l.expire_at  IS NOT NULL AND l.expire_at <= now() THEN 'expired'
    ELSE 'live'
  END AS lifecycle_state
FROM latest l;
