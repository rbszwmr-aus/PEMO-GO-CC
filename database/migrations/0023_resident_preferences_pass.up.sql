-- Notification preferences and the resident pass.
--
-- A locked preference is RETURNED with its reason, never hidden. The design
-- requires the control to be shown locked with a server-supplied reason, so the
-- reason is stored rather than invented by a client.
CREATE TABLE resident.notification_preference (
  resident_id          text        NOT NULL REFERENCES resident.resident (resident_id),
  preference_key       text        NOT NULL
                                   CHECK (preference_key IN ('critical_safety', 'notices_and_advisories', 'case_replies')),
  label_en             text        NOT NULL,
  label_zh_hant        text        NOT NULL,
  description_en       text        NULL,
  description_zh_hant  text        NULL,
  enabled              boolean     NOT NULL,
  locked               boolean     NOT NULL DEFAULT false,
  lock_reason_en       text        NULL,
  lock_reason_zh_hant  text        NULL,
  channels             text[]      NOT NULL DEFAULT ARRAY['in_app']::text[],
  sort_order           integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (resident_id, preference_key),
  -- A lock without a reason is a control the resident cannot change and cannot
  -- understand. The schema refuses it.
  CONSTRAINT locked_preference_has_reason
    CHECK (NOT locked OR (lock_reason_en IS NOT NULL AND lock_reason_zh_hant IS NOT NULL)),
  -- Critical safety alerts are always locked on.
  CONSTRAINT critical_safety_locked_on
    CHECK (preference_key <> 'critical_safety' OR (locked AND enabled))
);

-- Counter-identification pass. It carries NO door access: access cards remain
-- with the existing access-control system, and the contract states this rather
-- than leaving a client to imply otherwise.
CREATE TABLE resident.resident_pass (
  resident_id      text        PRIMARY KEY REFERENCES resident.resident (resident_id),
  pass_reference   text        NOT NULL UNIQUE,
  carries_access   boolean     NOT NULL DEFAULT false CHECK (NOT carries_access),
  note_en          text        NOT NULL,
  note_zh_hant     text        NOT NULL
);

COMMENT ON COLUMN resident.resident_pass.carries_access IS
  'Fixed false by CHECK constraint, matching the contract''s const: false. A pass reference is not a credential and not a secret.';
