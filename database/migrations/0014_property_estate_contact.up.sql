-- Estate contacts and directory (PRP-04).
--
-- Assigned to Property Core by GEN-006-ST because the traceability review found
-- it had no named owner, and it is not theoretical: MOB-03 renders the help-desk
-- card with its opening hours and a call-office action. Without an explicit
-- owner, the backend and UI sessions would each invent a home for the same data.
--
-- The privacy-controlled RESIDENT DIRECTORY half of PRP-04 is enabled per estate
-- and is explicitly OUT OF SCOPE here. It is not modelled.
CREATE TABLE property.estate_contact (
  contact_id           text        PRIMARY KEY,
  estate_id            text        NOT NULL REFERENCES property.estate (estate_id),
  contact_kind         text        NOT NULL
                                   CHECK (contact_kind IN ('management_office', 'emergency', 'approved_service')),
  name_en              text        NOT NULL,
  name_zh_hant         text        NOT NULL,
  telephone            text        NULL,
  hours_en             text        NULL,
  hours_zh_hant        text        NULL,
  instructions_en      text        NULL,
  instructions_zh_hant text        NULL,
  opens_at             time        NULL,
  closes_at            time        NULL,
  typical_reply_minutes integer    NULL CHECK (typical_reply_minutes IS NULL OR typical_reply_minutes > 0),
  sort_order           integer     NOT NULL DEFAULT 0
);
CREATE INDEX estate_contact_estate_idx ON property.estate_contact (estate_id, contact_kind);

COMMENT ON COLUMN property.estate_contact.typical_reply_minutes IS
  'Typical reply time during office hours. NULL when no reliable figure exists — the contract omits the field rather than guessing one.';
