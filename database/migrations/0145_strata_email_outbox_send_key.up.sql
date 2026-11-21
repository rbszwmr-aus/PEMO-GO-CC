-- Add a nullable send_key for new sends, claim columns, and a nullable
-- recipient scope snapshot. Historical rows keep send_key NULL and are not
-- deleted. Uniqueness applies only where send_key is present.
-- Status vocabulary is renamed in place (logged → log-only, sent → accepted,
-- pending → queued). No rows are removed.

ALTER TABLE strata.email_outbox
  ADD COLUMN subject_version integer NOT NULL DEFAULT 0,
  ADD COLUMN generation integer NOT NULL DEFAULT 1,
  ADD COLUMN send_key text,
  ADD COLUMN claimed_at timestamptz,
  ADD COLUMN attempt integer NOT NULL DEFAULT 0,
  ADD COLUMN recipient_scope_node_kind text,
  ADD COLUMN recipient_scope_node_id text;

CREATE UNIQUE INDEX email_outbox_send_key_uidx
  ON strata.email_outbox (send_key)
  WHERE send_key IS NOT NULL;

ALTER TABLE strata.email_outbox
  DROP CONSTRAINT email_outbox_status_check;

UPDATE strata.email_outbox SET status = 'log-only' WHERE status = 'logged';
UPDATE strata.email_outbox SET status = 'accepted' WHERE status = 'sent';
UPDATE strata.email_outbox SET status = 'queued'   WHERE status = 'pending';

ALTER TABLE strata.email_outbox
  ADD CONSTRAINT email_outbox_status_check
  CHECK (status IN ('queued', 'sending', 'accepted', 'failed', 'unknown', 'log-only'));

-- Deliberate exception to the SELECT+INSERT runtime-role rule: claim,
-- requeue and markResult must UPDATE the admitted outbox row. The grant
-- is column-level (status, claimed_at, attempt, transport, transport_detail,
-- send_key) so to_address and body stay immutable. 010-grants reasserts
-- the same columns. Down revokes it. The role may be absent on a cluster
-- that has not run 000-roles.sql.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pemo_app') THEN
    GRANT UPDATE (status, claimed_at, attempt, transport, transport_detail, send_key)
      ON strata.email_outbox TO pemo_app;
  END IF;
END $$;
