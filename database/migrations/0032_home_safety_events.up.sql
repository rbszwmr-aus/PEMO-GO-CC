-- Safety events, their resolved audience, and management updates.
--
-- audience_source is the field that makes ADR-003 serving scope real:
--   'unit'          — an in-unit event
--   'serving_scope' — an event in a common area, public facility, clubhouse or
--                     building service, whose audience derives from that
--                     location's serving scope rather than from any unit
--
-- A fire in a car park attaches to the car-park LOCATION and resolves through its
-- serving scope — never through the set of space-holders. A fire concerns
-- everyone present, not only the people who own bays.
CREATE TABLE home_safety.safety_event (
  event_id                 text        PRIMARY KEY,
  organization_id          text        NOT NULL,   -- stable id, tenancy root, NO FK
  estate_id                text        NOT NULL,   -- stable id, NO FK
  severity                 text        NOT NULL
                                       CHECK (severity IN ('normal', 'information', 'advisory',
                                                           'warning', 'critical', 'offline', 'unknown')),
  title_en                 text        NOT NULL,
  title_zh_hant            text        NOT NULL,
  instruction_en           text        NOT NULL,
  instruction_zh_hant      text        NOT NULL,
  location_label_en        text        NOT NULL,
  location_label_zh_hant   text        NOT NULL,
  location_class           text        NOT NULL
                                       CHECK (location_class IN ('unit', 'common_area', 'public_area',
                                                                 'public_facility', 'clubhouse', 'building_service')),
  audience_source          text        NOT NULL CHECK (audience_source IN ('unit', 'serving_scope')),
  serving_scope_label_en   text        NULL,
  serving_scope_label_zh_hant text     NULL,
  source_unit_id           text        NULL,       -- stable id, NO FK. Set for in-unit events.
  source_location_id       text        NULL,       -- stable id into property.location, NO FK.
  occurred_at              timestamptz NOT NULL,
  received_at              timestamptz NOT NULL,
  reported_by_en           text        NOT NULL,   -- 'Building fire panel'. A KIND of source, never a device.
  reported_by_zh_hant      text        NOT NULL,
  -- Short plain-language status line shown against an event in a list, for
  -- example "Resolved" or "Update published". Optional.
  status_note_en           text        NULL,
  status_note_zh_hant      text        NULL,
  acknowledgement_required boolean     NOT NULL DEFAULT false,
  management_update_pending boolean    NOT NULL DEFAULT false,
  disclaimer_en            text        NOT NULL,
  disclaimer_zh_hant       text        NOT NULL,
  revision_number          integer     NOT NULL DEFAULT 1 CHECK (revision_number >= 1),
  is_correction            boolean     NOT NULL DEFAULT false,
  supersedes_event_id      text        NULL REFERENCES home_safety.safety_event (event_id),
  correction_note_en       text        NULL,
  correction_note_zh_hant  text        NULL,
  retracted                boolean     NOT NULL DEFAULT false,
  superseded_by_event_id   text        NULL REFERENCES home_safety.safety_event (event_id),
  created_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT event_receipt_not_before_occurrence CHECK (received_at >= occurred_at),
  -- ADR-003: anything that is not a unit resolves its audience through serving
  -- scope. The validator enforces this on fixtures; the database enforces it on
  -- rows, so the two cannot drift.
  CONSTRAINT non_unit_location_uses_serving_scope
    CHECK (location_class = 'unit' OR audience_source = 'serving_scope'),
  CONSTRAINT serving_scope_audience_is_explained
    CHECK (audience_source <> 'serving_scope'
           OR (serving_scope_label_en IS NOT NULL AND serving_scope_label_zh_hant IS NOT NULL))
);
CREATE INDEX safety_event_organization_idx ON home_safety.safety_event (organization_id);
CREATE INDEX safety_event_estate_idx ON home_safety.safety_event (estate_id);

COMMENT ON COLUMN home_safety.safety_event.reported_by_en IS
  'Resident-readable reporting source, for example "Installed smoke detector" or "Building fire panel". A description of the KIND of source, never a device identifier, serial or address.';

-- The resolved audience, stored rather than recomputed at read time.
--
-- Storing it is deliberate: the audience for an event that has already been
-- communicated must not silently change when someone edits a serving scope
-- afterwards. Who was told is a historical fact.
CREATE TABLE home_safety.safety_event_audience (
  event_id  text NOT NULL REFERENCES home_safety.safety_event (event_id) ON DELETE CASCADE,
  unit_id   text NOT NULL,   -- stable id, NO FK
  PRIMARY KEY (event_id, unit_id)
);
CREATE INDEX safety_event_audience_unit_idx ON home_safety.safety_event_audience (unit_id);

-- Deliberately published, resident-visible updates from management. Never
-- automatic. The all-clear stays LINKED to the original event.
CREATE TABLE home_safety.management_update (
  update_id      text        PRIMARY KEY,
  event_id       text        NOT NULL REFERENCES home_safety.safety_event (event_id) ON DELETE CASCADE,
  published_at   timestamptz NOT NULL,
  body_en        text        NOT NULL,
  body_zh_hant   text        NOT NULL,
  is_all_clear   boolean     NOT NULL DEFAULT false
);
CREATE INDEX management_update_event_idx ON home_safety.management_update (event_id, published_at);

-- Response actions offered for an event. Labels are server-supplied so they stay
-- within the design system rule forbidding a safety response labelled merely
-- "OK" or "Confirm".
CREATE TABLE home_safety.event_action (
  event_id     text    NOT NULL REFERENCES home_safety.safety_event (event_id) ON DELETE CASCADE,
  action_key   text    NOT NULL
                       CHECK (action_key IN ('call_emergency_services', 'call_management_office',
                                             'acknowledge_safe', 'view_latest_update', 'contact_management')),
  label_en     text    NOT NULL,
  label_zh_hant text   NOT NULL,
  kind         text    NOT NULL CHECK (kind IN ('primary', 'secondary')),
  telephone    text    NULL,
  sort_order   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, action_key)
);

COMMENT ON COLUMN home_safety.event_action.telephone IS
  'Emergency services or the management office only. Never a resident''s number.';
