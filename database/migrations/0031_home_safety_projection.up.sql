-- The resident-facing safety projection.
--
-- severity and monitoring_coverage are SEPARATE COLUMNS because they answer
-- different questions and neither renders the state alone (ADR-001 section 3b).
-- A unit with no installed service has no safety condition to classify: it is
-- not normal, nothing is failing to report so it is not offline, and nothing is
-- indeterminate so it is not unknown. The pairing rule — coverage none implies
-- severity information — is a CHECK constraint, not a convention.
--
-- observed_at and received_at are both required and both stored. Occurrence time
-- is never replaced by receipt time.
CREATE TABLE home_safety.unit_safety_state (
  unit_id                   text        PRIMARY KEY,   -- stable id, NO FK
  organization_id           text        NOT NULL,      -- stable id, tenancy root, NO FK
  severity                  text        NOT NULL
                                        CHECK (severity IN ('normal', 'information', 'advisory',
                                                            'warning', 'critical', 'offline', 'unknown')),
  monitoring_coverage       text        NOT NULL CHECK (monitoring_coverage IN ('full', 'partial', 'none')),
  headline_en               text        NOT NULL,
  headline_zh_hant          text        NOT NULL,
  detail_en                 text        NULL,
  detail_zh_hant            text        NULL,
  observed_at               timestamptz NOT NULL,
  received_at               timestamptz NOT NULL,
  freshness_window_seconds  integer     NOT NULL CHECK (freshness_window_seconds > 0),
  disclaimer_en             text        NOT NULL,
  disclaimer_zh_hant        text        NOT NULL,
  CONSTRAINT safety_receipt_not_before_observation CHECK (received_at >= observed_at),
  CONSTRAINT coverage_none_pairs_with_information
    CHECK (monitoring_coverage <> 'none' OR severity = 'information')
);
CREATE INDEX unit_safety_state_organization_idx ON home_safety.unit_safety_state (organization_id);

COMMENT ON COLUMN home_safety.unit_safety_state.severity IS
  'Canonical seven-level enumeration from severity.json at the pinned contract commit. offline means the MONITORED SERVICE is not reporting — never the client device. The server cannot know a client''s network state and must never emit one.';

COMMENT ON COLUMN home_safety.unit_safety_state.disclaimer_en IS
  'Statutory supplementary-notification disclaimer, server-supplied in both languages. The client must not hardcode it: the wording is a compliance surface, and the overview and detail wordings deliberately differ.';

-- Installed services as a RESIDENT sees them: a plain-language name, a
-- resident-readable room and a plain-language state. No device identifier, no
-- serial, no model, no telemetry value, no protocol field, no panel zone. The
-- boundary scan enforces that mechanically against every response.
CREATE TABLE home_safety.installed_service (
  installed_service_id  text        PRIMARY KEY,
  unit_id               text        NOT NULL,   -- stable id, NO FK
  service_key           text        NOT NULL
                                    CHECK (service_key IN ('smoke_detector', 'gas_detector',
                                                           'water_leak_sensor', 'help_button')),
  name_en               text        NOT NULL,
  name_zh_hant          text        NOT NULL,
  location_en           text        NOT NULL,   -- 'Kitchen'. A room, not a panel zone.
  location_zh_hant      text        NOT NULL,
  state_en              text        NOT NULL,   -- 'Normal' / 'Not reporting'. Plain language.
  state_zh_hant         text        NOT NULL,
  severity              text        NOT NULL
                                    CHECK (severity IN ('normal', 'information', 'advisory',
                                                        'warning', 'critical', 'offline', 'unknown')),
  observed_at           timestamptz NOT NULL,
  sort_order            integer     NOT NULL DEFAULT 0
);
CREATE INDEX installed_service_unit_idx ON home_safety.installed_service (unit_id);

CREATE TABLE home_safety.installed_services_note (
  unit_id       text PRIMARY KEY,
  note_en       text NOT NULL,
  note_zh_hant  text NOT NULL
);
