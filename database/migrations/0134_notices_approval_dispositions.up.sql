-- The approval path's two dispositions (GEN-040 D1).
--
-- 0126 shipped `drafted | published | withdrawn`, which is the whole lifecycle of
-- an UNGATED notice. Cut B adds the gated path — submit, approve, decline — and
-- that needs two more acts on the chain.
--
-- A NEW MIGRATION RATHER THAN AN EDIT, because 0126 is applied and merged. That is
-- not ceremony: the constraint is part of what every existing row was validated
-- against, and rewriting history to match the present is how a database and its
-- migration files stop describing the same thing.
--
-- `declined` is deliberately NOT added. Declining returns the notice to `drafted`
-- — the point of a decline is that the author revises and resubmits, and a
-- terminal `declined` state would be a dead end somebody has to be dug out of.
-- WHO declined and WHY is on the audit row and the assertion's reason code, which
-- is where a question about a decision belongs.
ALTER TABLE notices.notice DROP CONSTRAINT notice_disposition_check;
ALTER TABLE notices.notice ADD CONSTRAINT notice_disposition_check
  CHECK (disposition IN ('drafted', 'pending', 'approved', 'published', 'withdrawn'));

COMMENT ON COLUMN notices.notice.disposition IS
  'The ACT this assertion records — drafted, pending, approved, published or withdrawn — NOT the lifecycle state. State is computed from the latest assertion plus the schedule (notices.notice_current). There is no `declined` disposition: a decline returns the notice to `drafted`, because the point of declining is that the author revises and resubmits; who declined and why is on the audit row.';

-- The computed state must know the two new dispositions, or a pending notice
-- reads as `live` — the view's ELSE branch assumed every non-draft, non-withdrawn
-- assertion was published, which was true until this migration and is not now.
CREATE OR REPLACE VIEW notices.notice_current AS
WITH latest AS (
  SELECT DISTINCT ON (notice_id) *
    FROM notices.notice
   ORDER BY notice_id, version DESC
)
SELECT
  l.*,
  CASE
    WHEN l.disposition = 'withdrawn' THEN 'withdrawn'
    WHEN l.disposition = 'drafted'   THEN 'draft'
    WHEN l.disposition = 'pending'   THEN 'pending_approval'
    WHEN l.disposition = 'approved'  THEN 'approved'
    -- published, and the schedule decides which side of live it is on
    WHEN l.publish_at IS NOT NULL AND l.publish_at > now() THEN 'scheduled'
    WHEN l.expire_at  IS NOT NULL AND l.expire_at <= now() THEN 'expired'
    ELSE 'live'
  END AS lifecycle_state
FROM latest l;

COMMENT ON VIEW notices.notice_current IS
  'ADR-019 D4. The computed lifecycle state: latest assertion by version, then its disposition evaluated against the schedule. Since GEN-040 it also knows the gated path (pending_approval, approved). There is no stored state column anywhere and this view is the single definition.';
