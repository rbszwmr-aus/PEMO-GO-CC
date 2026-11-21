-- Resident acknowledgement.
--
-- THIS IS NOT ALARM ACKNOWLEDGEMENT. It records that a resident has seen a
-- notification, and it is a PEMO communication record. Alarm detection,
-- acknowledgement, suppression, clearing, reclassification, lifecycle and
-- technical escalation belong to 2IoThub, and PEMO performs none of them. The
-- two share a word and nothing else.
--
-- Two constraints carry the contract's idempotency rules:
--   * UNIQUE (acknowledgement_key)      — the same key REPLAYS the original
--                                          outcome and creates nothing new.
--   * UNIQUE (event_id, resident_id)    — a DIFFERENT key for the same event and
--                                          resident is a duplicate submission and
--                                          is rejected with 409, rather than
--                                          silently recording a second one.
CREATE TABLE home_safety.acknowledgement (
  acknowledgement_id   text        PRIMARY KEY,
  acknowledgement_key  uuid        NOT NULL UNIQUE,
  event_id             text        NOT NULL REFERENCES home_safety.safety_event (event_id) ON DELETE CASCADE,
  resident_id          text        NOT NULL,   -- stable id, NO FK
  action               text        NOT NULL CHECK (action IN ('seen', 'i_am_safe')),
  occurred_at          timestamptz NOT NULL,   -- when the RESIDENT acted, supplied by the client
  received_at          timestamptz NOT NULL,   -- when PEMO recorded it
  correlation_id       uuid        NOT NULL,
  UNIQUE (event_id, resident_id),
  CONSTRAINT acknowledgement_receipt_not_before_action CHECK (received_at >= occurred_at)
);

COMMENT ON COLUMN home_safety.acknowledgement.occurred_at IS
  'When the resident performed the action on their device, supplied by the client so that an acknowledgement made offline and replayed later records the TRUE time. The server records its own receipt time separately and never substitutes one for the other.';
