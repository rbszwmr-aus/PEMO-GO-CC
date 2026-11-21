-- Classification quarantine (ADR-006 C4).
--
-- ============================================================================
-- THIS TABLE STORES. IT DOES NOT ESCALATE. THAT IS BLOCKED ON GOVERNANCE.
-- ============================================================================
--
-- C4 requires quarantine to have A NAMED RESPONSIBLE ROLE and A DEFINED RESPONSE
-- TIME, and states that without both the rule is decorative — "a quarantine queue
-- nobody reads is a silent drop with extra steps."
--
-- Neither exists yet. Nobody has been named and no response time has been set. So
-- this migration builds the STATE and not the escalation, and the omission is
-- deliberate rather than unfinished:
--
--   storing without escalating loses nothing;
--   escalating to nobody would LOOK implemented and BEHAVE like a drop.
--
-- Two absences in this table are the design. A later reader meeting the schema
-- rather than the report should be able to see both from here:
--
--   * THERE IS NO severity COLUMN. C4 says quarantined input "never defaults to a
--     severity". The strongest way to guarantee that is to leave nowhere to put
--     one. A quarantined item has no severity because a severity is what the
--     approved policy produces, and by definition no approved policy covered it.
--
--   * THERE IS NO assigned_to, escalated_at OR notified_at COLUMN. Not an
--     oversight. Columns for escalation would invite the next reader to conclude
--     escalation exists, and the first person to see an empty escalated_at would
--     reasonably assume the feature works and nothing had triggered it. Their
--     absence states the truth: this is blocked, and it is blocked on a decision
--     nobody has taken rather than on work nobody has done.
--
-- When the role and the response time exist, the PID that adds them adds these
-- columns with the escalation path, and this comment comes out.
CREATE TABLE integration.classification_quarantine (
  quarantine_id         text        PRIMARY KEY,

  organization_id       text        NOT NULL,   -- tenancy root, stable id, NO FK

  -- What arrived, kept verbatim so a human can see the real input rather than a
  -- summary of it. Internal only: nothing here is rendered to a resident.
  source_system_type    text        NOT NULL,
  source_system_version text        NOT NULL,
  source_event_code     text        NULL,
  source_classification text        NULL,
  source_device_ref     text        NULL,
  source_zone_ref       text        NULL,
  source_payload        jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Why it could not be classified. Each value corresponds to a step of ADR-006
  -- that did not complete.
  reason                text        NOT NULL
                                    CHECK (reason IN ('unknown_event_code',        -- Layer 1 had no entry
                                                      'no_source_classification',  -- C2: nothing to map FROM
                                                      'no_policy_entry',           -- Layer 2 had no approved row
                                                      'unmapped_device')),         -- D2 mapping did not resolve

  occurred_at           timestamptz NULL,       -- occurrence at source, where the source supplied one
  received_at           timestamptz NOT NULL,   -- when PEMO received it. Never substituted for the above.
  correlation_id        uuid        NOT NULL,

  -- Held, visible, unassigned. `resolved` and `discarded` both require a human
  -- decision to be recorded; neither happens automatically.
  status                text        NOT NULL DEFAULT 'held'
                                    CHECK (status IN ('held', 'resolved', 'discarded')),
  resolution_note       text        NULL,
  resolved_at           timestamptz NULL,
  resolved_by           text        NULL,

  CONSTRAINT quarantine_resolution_is_explicit
    CHECK ((status = 'held') = (resolved_by IS NULL AND resolved_at IS NULL)),

  CONSTRAINT quarantine_receipt_not_before_occurrence
    CHECK (occurred_at IS NULL OR received_at >= occurred_at)
);

CREATE INDEX classification_quarantine_held_idx
  ON integration.classification_quarantine (status, received_at)
  WHERE status = 'held';

COMMENT ON TABLE integration.classification_quarantine IS
  'ADR-006 C4, PARTIAL: stores but does not escalate. Blocked on governance — C4 requires a named responsible role and a defined response time and neither exists. Deliberately has no severity column (so it cannot default to one) and no assignment or escalation columns (so nobody concludes escalation is implemented). Distinct from home_safety.event_quarantine, which holds events whose AUDIENCE could not be resolved; this holds input that could not be CLASSIFIED.';
