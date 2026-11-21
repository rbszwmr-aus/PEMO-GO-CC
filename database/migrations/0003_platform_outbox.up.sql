-- Database outbox.
--
-- Broker versus outbox is Unresolved in the committed architecture baseline, and
-- this PID is instructed to use an outbox and keep the publish interface
-- abstract. The columns are the committed event envelope from
-- docs/architecture/integration-contract-rules.md, one column per envelope field.
--
-- occurred_at and received_at are separate columns and neither is defaulted from
-- the other. A consumer must never substitute one for the other, and a schema
-- that allowed it would make the rule unenforceable.
CREATE TABLE platform.outbox_message (
  message_id        uuid        PRIMARY KEY,
  contract_name     text        NOT NULL,
  contract_version  text        NOT NULL,
  occurred_at       timestamptz NOT NULL,
  received_at       timestamptz NOT NULL,
  source            text        NOT NULL,
  correlation_id    uuid        NOT NULL,
  causation_id      uuid        NULL,
  scope             jsonb       NOT NULL,
  payload           jsonb       NOT NULL,
  published_at      timestamptz NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outbox_receipt_not_before_occurrence CHECK (received_at >= occurred_at)
);

CREATE INDEX outbox_message_unpublished_idx
  ON platform.outbox_message (created_at)
  WHERE published_at IS NULL;

CREATE INDEX outbox_message_correlation_idx ON platform.outbox_message (correlation_id);

-- Integration exceptions. "An integration failure is silently discarded rather
-- than surfaced" is one of the biting tests; this table is what makes the
-- failure visible instead.
CREATE TABLE platform.integration_exception (
  exception_id    bigserial   PRIMARY KEY,
  source          text        NOT NULL,
  reason          text        NOT NULL,
  correlation_id  uuid        NOT NULL,
  detail          jsonb       NOT NULL,
  resolved_at     timestamptz NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
