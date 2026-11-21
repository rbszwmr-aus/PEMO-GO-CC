-- Which notice types need approval before publication (ADR-019 D4, GEN-040 D3).
--
-- ─── FAIL-CLOSED: NO ROW MEANS APPROVAL IS REQUIRED ─────────────────────────
--
-- The absence of a policy row is not "no policy" — it is "nobody has decided",
-- and the safe reading of an undecided question about who may broadcast to a
-- building is that a second person must look. GEN-039 G4 made the same choice for
-- the grant reconciler's gate: a missing setting must never read as permission.
--
-- The consequence is deliberate and slightly inconvenient: a new notice type, or
-- a new organization, is gated until somebody writes the row. That inconvenience
-- is the feature. The opposite default — unknown means ungated — publishes to
-- residents on the strength of a question nobody answered.
--
-- ─── THE POLICY IS DATA, NOT CODE ───────────────────────────────────────────
--
-- Per organization, because a small estate and a 4,000-unit portfolio do not have
-- the same approval appetite, and neither should have to deploy to change it.
CREATE TABLE notices.approval_policy (
  organization_id   text    NOT NULL,
  notice_type       text    NOT NULL,
  requires_approval boolean NOT NULL,
  recorded_at       timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (organization_id, notice_type),
  -- The same declared vocabulary the assertion uses (ADR-019 D7). A policy row for
  -- a type that cannot exist is a row nothing will ever read.
  CONSTRAINT approval_policy_notice_type_check
    CHECK (notice_type IN ('general', 'planned_interruption', 'emergency', 'event_community'))
);

COMMENT ON TABLE notices.approval_policy IS
  'GEN-040 D3. Which notice types require approval before publication, per organization. FAIL-CLOSED: NO ROW MEANS APPROVAL IS REQUIRED — the absence of a row is "nobody has decided", and the safe reading of an undecided question about broadcasting to residents is that a second person looks. A new type or a new organization is therefore gated until somebody writes the row, deliberately.';
COMMENT ON COLUMN notices.approval_policy.requires_approval IS
  'Explicit, and there is no default: a policy that a schema default could set is a policy nobody chose.';
