-- Targeting rule, audience snapshot and acknowledgement (ADR-019 D5, D6).
--
-- THE RULE AND THE SNAPSHOT ARE TWO DIFFERENT FACTS, and conflating them is the
-- defect this shape exists to prevent. The RULE is what management chose to
-- target — "Block A, floors 3-5". The SNAPSHOT is who that resolved to AT THE
-- MOMENT OF PUBLICATION. They diverge the instant somebody moves in or out, and
-- both are needed: the rule to re-resolve for a later republication, the snapshot
-- to answer "who was this sent to?" a year afterwards, when the tenancy has ended.
--
-- Recomputing the audience from the rule at read time would answer the second
-- question with today's residents, which is not who was told.

-- ─── D3: the targeting rule, part of the assertion ──────────────────────────
--
-- A ROW PER TARGET, not a JSON blob: each target is a fact the resolver joins on,
-- and a blob would push that structure into application code where no constraint
-- can reach it. The rule belongs to the ASSERTION, not the instance — retargeting
-- a notice is a revision of what was said, exactly like retitling it.
CREATE TABLE notices.notice_target (
  target_id     text PRIMARY KEY DEFAULT 'ntgt_' || gen_random_uuid(),
  assertion_id  text NOT NULL REFERENCES notices.notice (assertion_id) ON DELETE CASCADE,

  -- An ADR-002 hierarchy node, by stable id. No foreign key: Property Core owns it.
  --
  -- NULLABLE, and that is load-bearing. A target may name a Location INSTEAD of a
  -- node — "whoever the low-zone lift serves" is not "whoever is in Block A", and
  -- a partial-floor lift is exactly the case where those differ. Declaring these
  -- NOT NULL would make a Location-only target unrepresentable and force every
  -- such rule to name a containing node it does not mean, which is the physical-
  -- parent answer ADR-003's serving scope exists to replace.
  node_kind     text,
  node_id       text,

  -- An ADR-003 Location, by stable id, when the target is "whoever this Location
  -- serves" rather than a hierarchy subtree. This is the serving_scope case, and
  -- it is the reason a partial-floor lift reaches its floors and not its block.
  location_id   text,

  -- ─── ADR-019 OQ1: THE SLOT THAT IS DELIBERATELY EMPTY ─────────────────────
  --
  -- COM-01 names "resident group" targeting once and defines it nowhere. OQ1's
  -- disposition is that the ENTITY IS NOT INVENTED HERE — a cohort model guessed
  -- from a single unexplained mention would be wrong in a way that is expensive to
  -- undo once notices reference it.
  --
  -- The column exists so that adding the entity later is an addition rather than a
  -- reshaping of every targeting row. It is NULLABLE, UNUSED, and has NO foreign
  -- key to anything. It is EMPHATICALLY NOT access.group: those are STAFF
  -- authorization groups holding scope grants (ADR-012 D2), and pointing resident
  -- targeting at them would hand a delivery decision to the authorization model.
  resident_group_id text,

  CONSTRAINT notice_target_node_kind_check
    CHECK (node_kind IN ('organization', 'estate', 'building', 'floor', 'unit')),
  -- A node target is half-declared or not declared: a kind without an id names
  -- nothing, and an id without a kind is ambiguous across the hierarchy.
  CONSTRAINT notice_target_node_complete
    CHECK ((node_kind IS NULL) = (node_id IS NULL)),
  -- A target names a hierarchy node, or a Location, or both — never neither.
  CONSTRAINT notice_target_names_something
    CHECK (node_id IS NOT NULL OR location_id IS NOT NULL)
);

COMMENT ON TABLE notices.notice_target IS
  'ADR-019 D5. The targeting RULE, attached to the assertion that declared it. Retargeting is a revision, so it versions with the notice. Distinct from notices.notice_audience, which is who the rule resolved to at publish time.';
COMMENT ON COLUMN notices.notice_target.resident_group_id IS
  'ADR-019 OQ1 — DELIBERATELY UNUSED. "Resident group" is named once in COM-01 and defined nowhere, so the entity is NOT invented here; the slot exists only so that adding it later is an addition rather than a reshaping. Nullable, no foreign key, written by nothing. It is NOT access.group: those are STAFF authorization groups holding scope grants (ADR-012 D2), and resident targeting must never be resolved through the authorization model.';
COMMENT ON COLUMN notices.notice_target.location_id IS
  'An ADR-003 Location, by stable id. The serving_scope case: the audience is whoever this Location SERVES, which for a partial-floor lift is its floors and not its whole block. Resolved through Property Core''s interface, never by joining property.*.';

CREATE INDEX notice_target_assertion_idx ON notices.notice_target (assertion_id);

-- ─── D4: the audience snapshot ──────────────────────────────────────────────
--
-- APPEND-ONLY, and written at PUBLISH — which is N2, not this cut. Originated here
-- so the resolver has its destination and the shape is settled before anything
-- writes to it.
CREATE TABLE notices.notice_audience (
  audience_id       text PRIMARY KEY DEFAULT 'naud_' || gen_random_uuid(),
  notice_id         text NOT NULL,
  -- WHICH assertion's rule produced this snapshot. A republication resolves again
  -- and appends a new snapshot; the old one stays, because it is the answer to
  -- "who was told the FIRST time".
  publishing_version integer NOT NULL,

  -- Recipients by stable id, no foreign key (ADR-019 D1). Household may be null
  -- for a resident with no household recorded; resident is the addressable party.
  household_id      text,
  resident_id       text NOT NULL,
  unit_id           text NOT NULL,

  resolved_at       timestamptz NOT NULL DEFAULT now(),

  -- One row per recipient per publication. A re-publication at the same version
  -- resolving twice must not double the audience.
  CONSTRAINT notice_audience_unique UNIQUE (notice_id, publishing_version, resident_id)
);

COMMENT ON TABLE notices.notice_audience IS
  'ADR-019 D5. WHO THE RULE RESOLVED TO, at the moment of publication — append-only, written by the publish act (N2). Kept because the rule and its resolution diverge the instant somebody moves: re-resolving the rule later answers "who lives there now", which is not "who was told".';

CREATE INDEX notice_audience_notice_idx ON notices.notice_audience (notice_id, publishing_version);
CREATE INDEX notice_audience_resident_idx ON notices.notice_audience (resident_id);

-- ─── D5: acknowledgement ────────────────────────────────────────────────────
--
-- APPEND-ONLY, per-recipient (ADR-019 D6).
--
-- A DUPLICATE ACK IS EXACTLY ONE EFFECT, and the mechanism is a UNIQUE KEY rather
-- than a check in application code — the same stance ADR-015 takes for
-- idempotency and the same one home_safety.acknowledgement already takes. The key
-- is (notice_id, recipient, kind): acknowledging twice is one acknowledgement,
-- while READING and then ACKNOWLEDGING are two different facts and both survive.
CREATE TABLE notices.notice_acknowledgement (
  acknowledgement_id text PRIMARY KEY DEFAULT 'nack_' || gen_random_uuid(),
  notice_id          text NOT NULL,
  resident_id        text NOT NULL,
  kind               text NOT NULL,
  -- For kind = 'responded'. NULL otherwise; a response is not always sought.
  response           text,
  occurred_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT notice_ack_kind_check CHECK (kind IN ('read', 'acknowledged', 'responded')),
  -- THE IDEMPOTENCY KEY. Two identical acks collapse to one row; the second INSERT
  -- loses here rather than being filtered somewhere a future caller can forget.
  CONSTRAINT notice_ack_unique UNIQUE (notice_id, resident_id, kind)
);

COMMENT ON TABLE notices.notice_acknowledgement IS
  'ADR-019 D6. Per-recipient append-only acknowledgement. UNIQUE (notice_id, resident_id, kind) makes a duplicate ack EXACTLY ONE EFFECT by constraint rather than by application discipline — consistent with ADR-015 and with home_safety.acknowledgement. read/acknowledged/responded are separate facts and all three may coexist for one recipient.';

CREATE INDEX notice_ack_notice_idx ON notices.notice_acknowledgement (notice_id);
