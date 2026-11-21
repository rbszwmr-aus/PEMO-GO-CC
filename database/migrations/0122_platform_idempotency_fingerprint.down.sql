-- Reverse of 0122.
--
-- REFUSES IF ANY KEY EXISTS. Dropping the fingerprint returns D5 detection to the
-- act id -- which, since GEN-027 made the id derived, is IDENTICAL for two
-- different requests sharing a key. So the reversal does not merely lose a
-- column: it silently converts a REFUSAL into a REPLAY, and a client that reused
-- a key for a different request would be handed the first act's result as if it
-- were their own.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM platform.idempotency_record;
  IF n > 0 THEN
    RAISE EXCEPTION
      'REFUSING to reverse 0122: % idempotency record(s) exist. Without request_fingerprint, D5 '
      'falls back to the act id -- which is DERIVED from (operation, key) and therefore identical '
      'for two different requests sharing a key. The reversal would turn a refusal into a silent '
      'replay of somebody else''s act. Remove them deliberately first, or do not reverse.', n;
  END IF;
END $$;

ALTER TABLE platform.idempotency_record DROP COLUMN request_fingerprint;
