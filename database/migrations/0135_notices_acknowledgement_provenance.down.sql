-- Reverse of 0135. REFUSES once a resident has answered more than once: restoring
-- the blanket uniqueness would require discarding every superseded answer, and
-- what a resident said before they changed their mind is exactly the record this
-- table exists to hold.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT notice_id, resident_id FROM notices.notice_acknowledgement
     WHERE kind = 'responded' GROUP BY notice_id, resident_id HAVING count(*) > 1) s;
  IF n > 0 THEN
    RAISE EXCEPTION
      'REFUSING to reverse 0135: % recipient(s) have answered more than once. Restoring the blanket '
      'uniqueness would discard the superseded answers — the record of what they said before they '
      'changed their mind. Resolve those deliberately first, or do not reverse.', n;
  END IF;
END $$;

DROP INDEX IF EXISTS notices.notice_ack_resident_idx;
DROP INDEX IF EXISTS notices.notice_ack_response_key_idx;
DROP INDEX IF EXISTS notices.notice_ack_once_only_idx;
ALTER TABLE notices.notice_acknowledgement
  ADD CONSTRAINT notice_ack_unique UNIQUE (notice_id, resident_id, kind);
ALTER TABLE notices.notice_acknowledgement
  DROP COLUMN response_key, DROP COLUMN correlation_id, DROP COLUMN received_at;

-- THE VIEW DEPENDS ON THE COLUMN, so it goes first and comes back without it —
-- the mirror of what the up migration does. Dropping the column with the view in
-- place fails with "other objects depend on it", which is how the round-trip test
-- found this: the up was correct and the down was not, and only a full
-- migrate-down exercises that asymmetry.
DROP VIEW notices.notice_current;
ALTER TABLE notices.notice DROP COLUMN response_options;
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
