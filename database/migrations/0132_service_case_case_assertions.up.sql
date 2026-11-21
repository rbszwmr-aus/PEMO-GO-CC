-- The Service Case, as an assertion chain (ADR-020 D4, D8).
--
-- ─── pending_verification, AND WHY IT IS NOT AN OPTIMISATION ────────────────
--
-- An external system reporting "job complete" is a CLAIM, not a closure. CAS-04
-- is explicit: external completion may PROPOSE resolution or move a Case to
-- pending verification; it must NEVER automatically close it. Closing is a human
-- act — somebody looked, and says the thing is actually fixed.
--
-- So the state machine has a stop in it: open -> pending_verification -> closed,
-- and reaching `closed` requires a DISTINCT CLOSING ASSERTION that a person
-- recorded. There is deliberately NO encoding in which an external status alone
-- yields a closed Case, and the computed view below never reads
-- case_external_link. A test mutates exactly that and reds.
--
-- The alternative — letting the vendor's status be the Case's status — is how a
-- resident is told their leak is fixed by a system that never checked.

CREATE TABLE service_case.service_case (
  assertion_id    text PRIMARY KEY DEFAULT 'csea_' || gen_random_uuid(),
  case_id         text        NOT NULL,
  version         integer     NOT NULL,
  organization_id text        NOT NULL,

  -- THE STATE THIS ASSERTION PUTS THE CASE IN. Unlike the Ticket, where the act
  -- is recorded, a Case's assertion names the state a person placed it in —
  -- because `pending_verification` is a state somebody is responsible for, and
  -- the act that produced it ("the vendor said so") is not the fact of record.
  state           text        NOT NULL,

  -- Reassignment is a NEW ASSERTION, so "who owned this when" is answerable.
  assigned_owner_ref text,

  -- ─── complaint classification (ADR-020 D8) ────────────────────────────────
  is_complaint    boolean     NOT NULL DEFAULT false,
  complaint_class text,
  respond_by      timestamptz,

  -- Reason rides on the assertion that closes or reopens, never on the instance.
  closure_reason  text,
  reopen_reason   text,

  recorded_at     timestamptz NOT NULL DEFAULT now(),
  recorded_by     text        NOT NULL,

  CONSTRAINT service_case_version_unique UNIQUE (case_id, version),
  CONSTRAINT service_case_version_positive CHECK (version >= 1),
  CONSTRAINT service_case_state_check
    CHECK (state IN ('open', 'in_progress', 'pending_verification', 'closed', 'reopened')),
  CONSTRAINT service_case_complaint_class_requires_complaint
    CHECK (complaint_class IS NULL OR is_complaint),
  CONSTRAINT service_case_closure_reason_placement
    CHECK (closure_reason IS NULL OR state = 'closed'),
  CONSTRAINT service_case_reopen_reason_placement
    CHECK (reopen_reason IS NULL OR state = 'reopened')
);

COMMENT ON TABLE service_case.service_case IS
  'ADR-020 D4/D8 / ADR-013. Append-only assertions about a Case; current = MAX(version). Reassignment, verification, closure and reopening are each a new assertion. NO stored mutable state and no UPDATE path.';
COMMENT ON COLUMN service_case.service_case.state IS
  'Includes pending_verification (ADR-020 D4, CAS-04). An external system''s completion is a CLAIM, not a closure: it may propose resolution or move a Case here, but reaching `closed` requires a DISTINCT closing assertion recorded by a person. No encoding exists in which an external status alone yields closed, and the computed view never reads case_external_link.';
COMMENT ON COLUMN service_case.service_case.assigned_owner_ref IS
  'A staff principal by stable id, no foreign key. An assertion FACT, so reassignment is a new assertion and "who owned this when" stays answerable.';

CREATE INDEX service_case_instance_version_idx ON service_case.service_case (case_id, version DESC);
CREATE INDEX service_case_org_idx ON service_case.service_case (organization_id);

CREATE VIEW service_case.case_current AS
SELECT DISTINCT ON (case_id) *,
       state AS lifecycle_state
  FROM service_case.service_case
 ORDER BY case_id, version DESC;

COMMENT ON VIEW service_case.case_current IS
  'ADR-020 D4. Current assertion, and the state read off it. IT DOES NOT READ case_external_link, and must not: an external status alone must never yield a closed Case (CAS-04).';

-- ─── case_note (ADR-020 D5, D7) ─────────────────────────────────────────────
--
-- NO VISIBILITY COLUMN, AND THAT IS THE STRONGER STATEMENT. A column defaulting
-- to `internal` could be set the other way by a careless writer; an ABSENT column
-- means a resident-visible Case note is not a value anyone can write — it is a
-- migration somebody would have to propose. Nothing on a Case is ever
-- resident-visible, by construction rather than by filter.
CREATE TABLE service_case.case_note (
  note_id      text PRIMARY KEY DEFAULT 'cnot_' || gen_random_uuid(),
  case_id      text        NOT NULL,
  -- A staff principal, by stable id. There is no author_kind, because a resident
  -- cannot write on a Case at all — they write on their Ticket.
  author_ref   text        NOT NULL,
  body         text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE service_case.case_note IS
  'ADR-020 D5/D7. Append-only, and ALWAYS INTERNAL — enforced by the ABSENCE of a visibility column, which is stronger than a default: a resident-visible case note is not a value anyone can write, it is a migration someone would have to propose. No author_kind either: a resident cannot write on a Case, only on their Ticket.';

CREATE INDEX case_note_case_idx ON service_case.case_note (case_id, created_at);

-- ─── the external work order (ADR-020 D1, D8) ───────────────────────────────
--
-- A REFERENCE AND A CACHED SUMMARY, never the work. PEMO records THAT a job
-- exists in somebody else's system and what that system last said; it holds no
-- technician, no part, no labour line, no cost and no schedule. The
-- forbidden-terms scan over this schema is what keeps that true as the model
-- grows, because the pressure to add "just the cost" arrives with the first
-- report anybody asks for.
CREATE TABLE service_case.case_external_link (
  link_id         text PRIMARY KEY DEFAULT 'cxl_' || gen_random_uuid(),
  case_id         text        NOT NULL,
  external_system text        NOT NULL,
  external_ref    text        NOT NULL,
  deep_link       text,
  -- What the other system last SAID. Cached for display; it is not this Case's
  -- state and nothing computes state from it (CAS-04).
  last_status     text,
  last_summary    text,
  synced_at       timestamptz,

  CONSTRAINT case_external_link_unique UNIQUE (case_id, external_system, external_ref)
);

COMMENT ON TABLE service_case.case_external_link IS
  'ADR-020 D1. A REFERENCE to work that lives elsewhere, plus what that system last said. PEMO is a CONSUMER of the work order, never a model of it: no technician, parts, labour, cost or schedule — enforced by a forbidden-terms scan over this schema.';
COMMENT ON COLUMN service_case.case_external_link.last_status IS
  'The external system''s own word, cached for display. IT IS NOT THIS CASE''S STATE: nothing computes lifecycle from it, because an external completion is a claim and closing is a human act (CAS-04).';

CREATE INDEX case_external_link_case_idx ON service_case.case_external_link (case_id);

-- ─── satisfaction (ADR-020 D8) ──────────────────────────────────────────────
--
-- PER-TICKET, not per-Case, and that is the whole reason the table exists now
-- rather than later: three neighbours on one Case each have their own view of
-- whether it was handled well, and a per-Case rating would have to average them
-- or pick one. The surface that collects it is out of scope; the SHAPE is not,
-- because getting the grain wrong here is expensive to undo.
CREATE TABLE service_case.case_satisfaction (
  satisfaction_id text PRIMARY KEY DEFAULT 'csat_' || gen_random_uuid(),
  case_id         text        NOT NULL,
  -- The TICKET this rating came through, by stable id. Grain: one per reporter.
  ticket_ref      text        NOT NULL,
  respondent_ref  text        NOT NULL,
  rating          integer     NOT NULL,
  comment         text,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT case_satisfaction_rating_range CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT case_satisfaction_one_per_ticket UNIQUE (case_id, ticket_ref, respondent_ref)
);

COMMENT ON TABLE service_case.case_satisfaction IS
  'ADR-020 D8. Append-only, and PER-TICKET rather than per-Case: three neighbours on one Case each have their own view of whether it was handled well, and a per-Case rating would have to average them or pick one. The collecting surface is out of scope; the GRAIN is not, because it is expensive to change later.';
