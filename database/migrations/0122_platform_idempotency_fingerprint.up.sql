-- ADR-015 D5's discriminator moves to a request fingerprint.
--
-- 0120 IS NOT EDITED. It is merged.
--
-- WHY. 0120 detected "the same key offered for a DIFFERENT act" by comparing the
-- stored act identity against the offered one. That worked only while act ids
-- were opaque per attempt -- and GEN-025 recorded the consequence: an honest
-- RETRY generated a fresh act id, presented a "different act" for the same key,
-- and was REFUSED. The opposite of idempotency, in the mechanism built to
-- provide it.
--
-- GEN-027 fixes it by making the act id a PURE FUNCTION of (operation, key), so
-- a retry cannot produce a different one. That closes the retry hole and OPENS a
-- detection hole: two genuinely different requests sharing a key now derive the
-- SAME act id, so the id can no longer tell them apart. This column is what
-- tells them apart.
--
-- NOT NULL, WITH NO DEFAULT. An operation cannot opt out by omission -- the same
-- reason audit_event.source is required rather than defaulted. There are no rows
-- to backfill: the table is written only by the audited-write primitive and no
-- route uses it yet, so the column is added NOT NULL directly and any future
-- writer must supply one or fail loudly.

ALTER TABLE platform.idempotency_record
  ADD COLUMN request_fingerprint text NOT NULL;

COMMENT ON COLUMN platform.idempotency_record.request_fingerprint IS
  'ADR-015 D5. A digest of the fields that decide WHAT THE ACT DOES. Since GEN-027 the act id is DERIVED from (operation, key) so that a retry cannot present a different act -- which means the act id can no longer discriminate two different requests sharing a key. This column does: on a hit the fingerprints are compared, equal is a replay and different is refused. What goes into it is each operation''s own declaration, stated in the contract beside its idempotency stance -- a field that varies innocently between retries would refuse honest ones, and an omitted field that changes the act''s meaning would let a different act replay as the first.';
