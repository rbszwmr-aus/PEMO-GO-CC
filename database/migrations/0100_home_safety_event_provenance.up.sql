-- Provenance on safety_event (ADR-006 C5).
--
-- WHY 0100 AND NOT 0035, WHICH IS WHERE IT BELONGS BY SUBJECT.
--
-- The runner rolls back in reverse sequence order down to a floor, so a
-- migration numbered inside the home_safety block could only be reversed by also
-- reversing everything above it — including 0090, which predates this PID and
-- belongs to someone else's decision.
--
-- Found by RUNNING the down path rather than by writing it: rolling back to 34
-- dropped the dev_scaffold schema as well, and the schema comparison against the
-- pin failed for a reason that had nothing to do with this migration. Numbering
-- above 0090 makes this PID's migrations independently reversible, which is what
-- "the down path must be run" is actually asking for.
--
-- WHAT CHANGES, AND WHAT DOES NOT.
--
-- `severity` keeps the same values and is served to residents exactly as before.
-- What is new is the RECORD OF HOW IT WAS DERIVED. Before this migration the
-- column held a value that arrived already classified, with nothing saying who
-- classified it or against what vocabulary — a schema shaped by an unmade
-- decision. ADR-006 made the decision; this records it.
--
-- Nothing here is read by any resident-facing projection. The read path selects
-- explicit fields, so these columns are structurally invisible to every response.
--
-- WHY THE POLICY VERSION IS A VALUE AND NOT A FOREIGN KEY.
--
-- Two independent reasons, either sufficient:
--
--   1. The policy tables live in integration.*, and a foreign key from
--      home_safety.* to integration.* is a cross-module foreign key. The
--      architecture forbids it and a zero-row pg_constraint sweep enforces it.
--   2. Even if it were permitted it would be wrong. An event's provenance must
--      stay readable after the policy row it cites has been superseded or
--      removed — which is exactly when someone is reading it, because the
--      question "why did a resident see this?" is asked after an incident. A
--      foreign key would either block the policy from ever changing or take the
--      provenance with it.
--
-- WHY FABRICATION IS UNREPRESENTABLE RATHER THAN FORBIDDEN.
--
-- Existing rows were classified before ADR-006 existed and their provenance is
-- genuinely unknown. A row that CLAIMS a provenance it does not have is worse
-- than one that admits it has none, because only the first lies to the incident
-- review. A comment saying "do not fabricate" relies on everyone reading it, so
-- the CHECK below makes the fabricated shape impossible to store instead:
--
--   provenance_state = 'recorded'             → all three provenance fields NOT NULL
--   provenance_state = 'unknown_pre_adr_006'  → all three NULL
--
-- There is no third state, no default policy version, and no empty string that
-- could later read as "version zero". Half-claimed provenance cannot be written.

ALTER TABLE home_safety.safety_event
  -- Which vocabulary keyed the translation (ADR-006 D3, Layer 1). A panel
  -- replacement or firmware change moves these, which is why they are recorded
  -- per event rather than inferred from the device later.
  ADD COLUMN source_system_type      text        NULL,
  ADD COLUMN source_system_version   text        NULL,
  ADD COLUMN source_event_code       text        NULL,

  -- The source classification AS RECEIVED (C2). PEMO maps from it; PEMO never
  -- replaces it. Kept verbatim so that a later reader can see what the certified
  -- system actually said, not only what PEMO decided to show.
  ADD COLUMN source_classification   text        NULL,

  -- Layer 1 output: the normalised PEMO event type the vocabulary produced.
  ADD COLUMN normalised_event_type   text        NULL,

  -- Layer 2 input: the approved policy version applied (C1). A VALUE, not a
  -- reference — see above.
  ADD COLUMN policy_version          text        NULL,

  -- When classification happened (C5). Distinct from occurred_at, which is when
  -- the condition occurred, and from received_at, which is when PEMO heard about
  -- it. Three different instants; substituting any for another loses the meaning
  -- of all three.
  ADD COLUMN classified_at           timestamptz NULL,

  -- The honest-state column. The default is deliberately the UNKNOWN state:
  -- a row nobody supplied provenance for has no provenance, and defaulting to
  -- anything else would invent one. Backfill therefore needs no UPDATE — the
  -- default IS the backfill, and it cannot lie.
  ADD COLUMN provenance_state        text        NOT NULL DEFAULT 'unknown_pre_adr_006';

ALTER TABLE home_safety.safety_event
  ADD CONSTRAINT provenance_state_is_known
    CHECK (provenance_state IN ('recorded', 'unknown_pre_adr_006')),

  ADD CONSTRAINT provenance_is_complete_or_absent
    CHECK (
      (provenance_state = 'recorded'
        AND source_classification IS NOT NULL
        AND policy_version        IS NOT NULL
        AND classified_at         IS NOT NULL)
      OR
      (provenance_state = 'unknown_pre_adr_006'
        AND source_classification IS NULL
        AND policy_version        IS NULL
        AND classified_at         IS NULL)
    );

-- Backfilled rows are distinguishable by query, not by inference:
--
--   SELECT provenance_state, count(*) FROM home_safety.safety_event
--    GROUP BY provenance_state ORDER BY 1;
CREATE INDEX safety_event_provenance_state_idx
  ON home_safety.safety_event (provenance_state);

COMMENT ON COLUMN home_safety.safety_event.provenance_state IS
  'recorded = classified under ADR-006 with a policy version behind it. unknown_pre_adr_006 = classified before ADR-006 existed; provenance is genuinely unknown and is recorded as unknown rather than invented. The CHECK constraint makes any third possibility unstorable.';

COMMENT ON COLUMN home_safety.safety_event.policy_version IS
  'The approved severity policy version applied, stored AS A VALUE. Not a foreign key into integration.severity_policy: cross-module foreign keys are forbidden, and provenance must remain readable after the cited policy row is superseded.';
