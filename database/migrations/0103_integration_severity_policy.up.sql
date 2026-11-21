-- LAYER 2 — approved severity policy (ADR-006 D3, C1).
--
--   normalised event type + ADR-003 location class  →  PEMO severity + resident copy
--
-- Owned by ESTATE MANAGEMENT WITH THE FIRE CONSULTANT. This is the artifact the
-- fire consultant signs.
--
-- ============================================================================
-- THIS TABLE SHIPS EMPTY. THAT IS THE CORRECT STATE, NOT A PENDING TASK.
-- ============================================================================
--
-- Which source event types map to which of the seven resident-facing levels is a
-- SAFETY decision requiring the fire consultant and estate management. It is not
-- an engineering decision and ADR-006 says so explicitly. A table pre-filled with
-- engineering guesses is exactly what C1 forbids: "classification is a versioned,
-- APPROVED policy artifact ... not a developer's opinion about how serious smoke
-- is."
--
-- An empty approved-policy table with a working quarantine path is the honest and
-- safe state: input that no approved policy covers quarantines (0044) rather than
-- being classified by guesswork.
--
-- If filling this table ever appears necessary to make something pass, that is a
-- stop condition, not a task.
--
-- C1 IS ENCODED AS A CONSTRAINT, NOT A CONVENTION. The approval columns are
-- NOT NULL and CHECKed non-empty, so a row cannot exist without an approval
-- record behind it. Someone in a hurry cannot insert a policy row and mean to
-- fill in the approval later.
--
-- PEMO applies an approved policy. PEMO does not exercise judgement. That
-- distinction is what keeps "PEMO classifies severity" compatible with the
-- retired FEAT-001 v3 §3.7 rule that PEMO must not independently reinterpret raw
-- fire or BMS signals as a certified life-safety decision.
CREATE TABLE integration.severity_policy (
  policy_id             text        PRIMARY KEY,

  -- The version an event's provenance cites. Recorded on the event as a VALUE,
  -- so provenance survives this row being superseded.
  policy_version        text        NOT NULL CHECK (length(trim(policy_version)) > 0),

  normalised_event_type text        NOT NULL,

  -- ADR-003's location classes are the second key: smoke in a resident's own
  -- unit, in a common area, and in a building-service room are not the same
  -- resident-facing severity.
  --
  -- WHETHER A RESIDENT SEES THE EVENT AT ALL is a different question, governed by
  -- serving_scope in property.*, and must not be conflated with how severe it is.
  location_class        text        NOT NULL
                                    CHECK (location_class IN ('unit', 'common_area', 'public_area',
                                                              'public_facility', 'clubhouse',
                                                              'building_service')),

  -- The canonical seven. Constrained here so a policy row cannot introduce a
  -- level the resident vocabulary does not have.
  pemo_severity         text        NOT NULL
                                    CHECK (pemo_severity IN ('normal', 'information', 'advisory',
                                                             'warning', 'critical', 'offline', 'unknown')),

  -- A reference to approved resident copy, not the copy itself: wording is a
  -- compliance surface owned by the contract, and duplicating it here would let
  -- the two drift.
  resident_copy_ref     text        NOT NULL CHECK (length(trim(resident_copy_ref)) > 0),

  -- The approval record. C1 as a constraint.
  approved_by           text        NOT NULL CHECK (length(trim(approved_by)) > 0),
  approved_on           date        NOT NULL,
  approval_reference    text        NOT NULL CHECK (length(trim(approval_reference)) > 0),

  effective_from        timestamptz NOT NULL,
  effective_to          timestamptz NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT policy_period_ordered CHECK (effective_to IS NULL OR effective_to > effective_from),

  CONSTRAINT policy_no_overlapping_periods
    EXCLUDE USING gist (
      normalised_event_type WITH =,
      location_class        WITH =,
      tstzrange(effective_from, effective_to) WITH &&
    )
);

CREATE INDEX severity_policy_lookup_idx
  ON integration.severity_policy (normalised_event_type, location_class);

COMMENT ON TABLE integration.severity_policy IS
  'ADR-006 D3 Layer 2, C1. SHIPS EMPTY BY DESIGN — its contents are a safety decision requiring the fire consultant and estate management, and engineering guesses are what C1 forbids. Zero rows plus a working quarantine path is the correct state. The approval columns are NOT NULL so a row cannot exist without an approval behind it.';
