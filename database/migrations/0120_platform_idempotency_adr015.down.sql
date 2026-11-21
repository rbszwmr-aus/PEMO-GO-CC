-- Reverse of 0120: restore 0004's table.
--
-- LOSSY BY NATURE, AND IT SAYS SO. 0004 stored a response blob; this table stores
-- the act's identity. There is no way to reconstruct a response body from an act
-- id without running the read that derives it, which a migration must not do. So
-- the reversal DISCARDS the recorded keys rather than pretending to translate
-- them, and refuses if any exist — losing idempotency records silently would mean
-- a retried request re-running an act that already happened.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM platform.idempotency_record;
  IF n > 0 THEN
    RAISE EXCEPTION
      'REFUSING to reverse 0120: % idempotency record(s) exist. 0004''s shape stores a response '
      'blob and this one stores the act''s identity; there is no honest translation, so reversing '
      'would discard live request-identity records and a retried request would re-run an act that '
      'already happened. Remove them deliberately first, or do not reverse.', n;
  END IF;
END $$;

DROP TABLE platform.idempotency_record;

CREATE TABLE platform.idempotency_record (
  scope            text        NOT NULL,
  idempotency_key  text        NOT NULL,
  outcome          jsonb       NOT NULL,
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, idempotency_key)
);
