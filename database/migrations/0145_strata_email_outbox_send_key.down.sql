-- Revoke the 0145 outbox UPDATE exception (table-level or column-level)
-- before restoring the old shape.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pemo_app') THEN
    REVOKE UPDATE ON strata.email_outbox FROM pemo_app;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM strata.email_outbox
     WHERE status IN ('queued', 'pending', 'sending', 'unknown')
  ) THEN
    RAISE EXCEPTION '0145 down refuses while queued, pending, sending or unknown outbox rows exist';
  END IF;
END $$;

ALTER TABLE strata.email_outbox
  DROP CONSTRAINT email_outbox_status_check;

UPDATE strata.email_outbox SET status = 'logged' WHERE status = 'log-only';
UPDATE strata.email_outbox SET status = 'sent'   WHERE status = 'accepted';

ALTER TABLE strata.email_outbox
  ADD CONSTRAINT email_outbox_status_check
  CHECK (status IN ('logged', 'sent', 'failed'));

DROP INDEX IF EXISTS strata.email_outbox_send_key_uidx;

ALTER TABLE strata.email_outbox
  DROP COLUMN send_key,
  DROP COLUMN generation,
  DROP COLUMN subject_version,
  DROP COLUMN claimed_at,
  DROP COLUMN attempt,
  DROP COLUMN recipient_scope_node_kind,
  DROP COLUMN recipient_scope_node_id;
