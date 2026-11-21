-- Disposition and lifecycle vocabularies made DISJOINT (GEN-042 H2).
--
-- ─── WHAT THE OVERLAP COST ──────────────────────────────────────────────────
--
-- A `disposition` is WHAT AN ACTOR DID. A `lifecycle_state` is WHAT THE NOTICE IS.
-- They shared two literals, `approved` and `withdrawn`, and at GEN-040 a state
-- check written against a disposition literal — `current.state !== 'pending'` —
-- TYPE-CHECKED AND SILENTLY NEVER MATCHED. Every approval refused as wrong-state,
-- and the condition read correctly on the page.
--
-- Renaming the events so no literal appears in both vocabularies turns that
-- mistake into a TS2367 "no overlap" comparison error. The wrong comparison stops
-- being expressible rather than being caught later — ADR-018's instinct applied to
-- a vocabulary instead of a value.
--
-- ─── THIS REWRITES STORED VALUES, AND THAT IS A RENAME, NOT A REVISION ──────
--
-- The assertions are append-only for the application (SELECT+INSERT by rule), and
-- this migration runs as the owner. It changes the WORD, not the fact: an
-- assertion that said `approved` said an approver granted approval, and it still
-- says exactly that under the name `approval_granted`. No assertion is added,
-- removed or reordered, and no chain's meaning moves.
UPDATE notices.notice SET disposition = CASE disposition
  WHEN 'drafted'   THEN 'draft_saved'
  WHEN 'pending'   THEN 'approval_requested'
  WHEN 'approved'  THEN 'approval_granted'
  WHEN 'published' THEN 'publication_released'
  WHEN 'withdrawn' THEN 'withdrawal_recorded'
  ELSE disposition END;

ALTER TABLE notices.notice DROP CONSTRAINT notice_disposition_check;
ALTER TABLE notices.notice ADD CONSTRAINT notice_disposition_check
  CHECK (disposition IN ('draft_saved', 'approval_requested', 'approval_granted',
                         'publication_released', 'withdrawal_recorded'));

COMMENT ON COLUMN notices.notice.disposition IS
  'The ACT this assertion records, in a vocabulary DISJOINT from the lifecycle states (GEN-042 H2). No literal appears in both, so comparing a state against a disposition is a TS2367 "no overlap" error rather than a condition that silently never matches — which is what it was at GEN-040, where every approval refused as wrong-state.';

-- The view translates events to states, and every branch must be renamed with them.
DROP VIEW notices.notice_current;
CREATE VIEW notices.notice_current AS
WITH latest AS (
  SELECT DISTINCT ON (notice_id) *
    FROM notices.notice
   ORDER BY notice_id, version DESC
)
SELECT
  l.*,
  CASE
    WHEN l.disposition = 'withdrawal_recorded'  THEN 'withdrawn'
    WHEN l.disposition = 'draft_saved'          THEN 'draft'
    WHEN l.disposition = 'approval_requested'   THEN 'pending_approval'
    WHEN l.disposition = 'approval_granted'     THEN 'approved'
    -- publication_released, and the schedule decides which side of live it is on
    WHEN l.publish_at IS NOT NULL AND l.publish_at > now() THEN 'scheduled'
    WHEN l.expire_at  IS NOT NULL AND l.expire_at <= now() THEN 'expired'
    ELSE 'live'
  END AS lifecycle_state
FROM latest l;

COMMENT ON VIEW notices.notice_current IS
  'ADR-019 D4. The current assertion and its computed lifecycle state. The two vocabularies are disjoint by construction (GEN-042 H2): dispositions name what an actor did, states name what the notice is.';
