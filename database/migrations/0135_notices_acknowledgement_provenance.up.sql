-- Resident-authored acknowledgement: provenance, latest-wins responses, options.
--
-- ─── THE AUDIT SHAPE, MEASURED RATHER THAN CHOSEN (GEN-041 D6) ──────────────
--
-- A resident act records NO `access.audit_event` row, and that is not a gap:
--
--   `audit_event.principal_id` has a FOREIGN KEY to `access.staff_principal`, and a
--   resident is not a staff principal (GEN-006, Person != Principal). A
--   resident-authored audit row is STRUCTURALLY IMPOSSIBLE — the key refuses it
--   before GEN-025's authority biconditional is even evaluated.
--
-- `home_safety.acknowledgement` already answers this the only way the schema
-- permits: the domain table carries its own provenance. This migration gives
-- `notice_acknowledgement` the same columns — `received_at` and `correlation_id` —
-- so the two resident-act tables record a resident act identically rather than
-- each inventing a shape.
ALTER TABLE notices.notice_acknowledgement
  ADD COLUMN received_at    timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN correlation_id uuid,
  -- The client key for `respond` ONLY. Null for read/acknowledged, whose identity
  -- is derived from (notice, resident, kind) and needs no client to remember it.
  ADD COLUMN response_key   uuid;

COMMENT ON COLUMN notices.notice_acknowledgement.correlation_id IS
  'GEN-041 D6. Provenance for a RESIDENT-authored act, in the domain table — the same shape home_safety.acknowledgement uses. There is no access.audit_event row for these and there cannot be: audit_event.principal_id references access.staff_principal, and a resident is not one (GEN-006).';
COMMENT ON COLUMN notices.notice_acknowledgement.response_key IS
  'The client-supplied key for `respond` only. A second answer and a retried first answer are indistinguishable to the server without it, and they are different events: a resident is allowed to change their mind.';

-- ─── ONCE-ONLY KINDS vs A CHANGEABLE ANSWER ─────────────────────────────────
--
-- 0127's `UNIQUE (notice_id, resident_id, kind)` made every kind once-only, which
-- is right for `read` and `acknowledged` — you cannot read a thing for the first
-- time twice — and WRONG for `responded`: ADR-019 D6 and GEN-041 D1 let a resident
-- change their answer, and the earlier answer must survive as the record of what
-- they said before. A blanket uniqueness makes the second answer an error instead
-- of a fact.
--
-- So the once-only rule becomes a PARTIAL index over the two kinds it is true of,
-- and `responded` is append-only with CURRENT = LATEST BY occurred_at.
ALTER TABLE notices.notice_acknowledgement DROP CONSTRAINT notice_ack_unique;

CREATE UNIQUE INDEX notice_ack_once_only_idx
  ON notices.notice_acknowledgement (notice_id, resident_id, kind)
  WHERE kind IN ('read', 'acknowledged');

-- A retried `respond` collapses to one row; a genuine second answer carries a new
-- key and appends. The constraint is the mechanism, not a check in application code.
CREATE UNIQUE INDEX notice_ack_response_key_idx
  ON notices.notice_acknowledgement (response_key)
  WHERE response_key IS NOT NULL;

CREATE INDEX notice_ack_resident_idx
  ON notices.notice_acknowledgement (notice_id, resident_id, occurred_at DESC);

COMMENT ON TABLE notices.notice_acknowledgement IS
  'ADR-019 D6. Per-recipient append-only acknowledgement, resident-authored. `read` and `acknowledged` are ONCE-ONLY by a partial unique index — you cannot first-read something twice. `responded` is append-only and CURRENT = LATEST: a resident may change their answer, and the earlier one survives as the record of what they said before.';

-- ─── D3: the controlled response vocabulary, on the ASSERTION ───────────────
--
-- Per notice, and part of the assertion so that changing the options is a revision
-- of what was asked — a resident's stored answer must never be reinterpreted
-- against a question that was edited underneath it.
--
-- NULL means the notice asks nothing, and `respond` is then refused. That is
-- fail-closed in the same sense as GEN-040's approval policy: no declared question
-- means there is no answer to record, not that any answer will do.
--
-- FREE TEXT IS DEFERRED, not forgotten: ADR-019 OQ4 (retention / legal hold) has
-- to be ruled before PEMO stores resident-authored prose, because prose is the
-- part a retention rule is actually about.
ALTER TABLE notices.notice ADD COLUMN response_options text[];

-- AND THE VIEW HAS TO BE RECREATED, which is not obvious and cost a debugging pass.
-- `notice_current` is defined as `SELECT l.*`, and a view's column list is FIXED AT
-- CREATION: adding a column to the base table does not add it to the view. The
-- `*` reads as "whatever the table has" and means "whatever it had that day". So a
-- migration that adds a column a view is expected to expose must recreate the view,
-- or the column is invisible to every reader and the failure is a bare
-- `column "response_options" does not exist` from a query that names the view.
-- DROP then CREATE, not CREATE OR REPLACE: replacing a view may not CHANGE its
-- column list, only its body, so adding a column requires dropping it first.
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
    WHEN l.disposition = 'withdrawn' THEN 'withdrawn'
    WHEN l.disposition = 'drafted'   THEN 'draft'
    WHEN l.disposition = 'pending'   THEN 'pending_approval'
    WHEN l.disposition = 'approved'  THEN 'approved'
    WHEN l.publish_at IS NOT NULL AND l.publish_at > now() THEN 'scheduled'
    WHEN l.expire_at  IS NOT NULL AND l.expire_at <= now() THEN 'expired'
    ELSE 'live'
  END AS lifecycle_state
FROM latest l;

COMMENT ON COLUMN notices.notice.response_options IS
  'GEN-041 D3. A small declared list of option KEYS this notice accepts, or NULL for a notice that asks nothing (respond is then refused). On the ASSERTION, so changing the question is a revision — a stored answer must never be reinterpreted against an edited question. Free text is deferred behind ADR-019 OQ4 (retention).';
