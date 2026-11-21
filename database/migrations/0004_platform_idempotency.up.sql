-- Idempotency.
--
-- The stored OUTCOME, not merely a seen-flag. A duplicate request must receive
-- the same answer the first one got, so "we have seen this key" is not enough
-- information to serve the second request correctly.
CREATE TABLE platform.idempotency_record (
  scope            text        NOT NULL,
  idempotency_key  text        NOT NULL,
  outcome          jsonb       NOT NULL,
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, idempotency_key)
);
