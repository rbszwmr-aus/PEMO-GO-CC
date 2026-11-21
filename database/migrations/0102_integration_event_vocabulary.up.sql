-- LAYER 1 — vocabulary (ADR-006 D3).
--
--   source system event code  →  normalised PEMO event type
--
-- Owned by ENGINEERING. Changes when a panel is replaced or firmware changes.
--
-- Kept separate from the severity policy in 0042 deliberately. The DRAFT of
-- ADR-006 treated them as one table, which would mean every firmware change
-- needs estate-management approval and every policy change needs an engineering
-- review — two artifacts whose change rates differ by an order of magnitude,
-- chained to each other's slowest approver.
CREATE TABLE integration.event_vocabulary (
  vocabulary_id          text        PRIMARY KEY,

  -- Keyed by source system type AND version: the same code can mean different
  -- things across firmware revisions, which is the whole reason this layer is
  -- versioned rather than global.
  source_system_type     text        NOT NULL,
  source_system_version  text        NOT NULL,
  source_event_code      text        NOT NULL,

  normalised_event_type  text        NOT NULL,

  -- The source's own severity ordering within its own scale, where the source
  -- publishes one. Stored so that C3 — severity may not be lowered below the
  -- source — becomes checkable when a classifier exists. It is NOT enforced
  -- here: enforcement happens at classification time, and classification is
  -- ingestion, which this PID does not build. Recorded as a carried constraint
  -- rather than implied to be satisfied.
  source_severity_rank   integer     NULL,

  effective_from         timestamptz NOT NULL,
  effective_to           timestamptz NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT vocabulary_period_ordered CHECK (effective_to IS NULL OR effective_to > effective_from),

  -- The point of effective dating is that a historical event resolves EXACTLY
  -- ONE WAY. A key with two overlapping periods permits precisely the ambiguity
  -- the design exists to prevent, so it is refused declaratively.
  --
  -- Declarative and not a trigger, on purpose: a trigger is bypassable by a bulk
  -- load, which is exactly how bad history arrives.
  CONSTRAINT vocabulary_no_overlapping_periods
    EXCLUDE USING gist (
      source_system_type    WITH =,
      source_system_version WITH =,
      source_event_code     WITH =,
      tstzrange(effective_from, effective_to) WITH &&
    )
);

CREATE INDEX event_vocabulary_lookup_idx
  ON integration.event_vocabulary (source_system_type, source_system_version, source_event_code);

COMMENT ON TABLE integration.event_vocabulary IS
  'ADR-006 D3 Layer 1. Engineering-owned. Effective-dated: re-resolving a historical event must reproduce the answer given at the time, not the answer today''s configuration would give.';
