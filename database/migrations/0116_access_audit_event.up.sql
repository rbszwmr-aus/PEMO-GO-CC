-- The audit record ADR-010 D1 requires of every scope-only write.
--
-- D1 releases 27 writes on scope alone ON CONDITION that the audit record
-- carries the weight the gate would have: "without all four, record rather than
-- restrict records nothing. This is a requirement on the write path, not a
-- logging preference." The four:
--
--   1. written in the same transaction as the act
--   2. attributable to a PRINCIPAL, not a session, service or job
--   3. effective-dated, so "what was this person permitted to do THEN" is answerable
--   4. not deletable or amendable by the actor
--
-- PROPERTY 4 IS INHERITED, NOT BUILT HERE. GEN-010 made pemo_app a non-superuser
-- that owns nothing and holds SELECT + INSERT on every table. So this table is
-- append-only to the application by construction, exactly like every other
-- table — there is no trigger, no rule, no special mechanism. The floor does it.
-- What this migration must not do is grant more: 010-grants.sql applies
-- SELECT+INSERT by rule and grants-complete.sql fails on EXCESS, so an
-- accidental GRANT UPDATE here would be caught rather than silently mutable.
--
-- ACTOR AND AUTHORITY ARE TWO COLUMNS, NEVER RECONCILED INTO ONE.
--
-- ADR-010 D1 says "attributable to a principal". ADR-012 D2 says a grant is held
-- by a GROUP, never a principal. Both are true and they are different facts:
-- the PERSON who acted is a principal; the AUTHORITY they acted under is a
-- group-held grant at a node, with a role. D1's own "(principal, scope node)"
-- key language predates ADR-012 and is stale — the substance is that the audit
-- keeps both, because "who did it" and "what let them" answer different
-- questions and an incident review needs both.
--
-- EFFECTIVE-DATED means the record retains the instant the grant must be read
-- at. GEN-006 proved why re-derivation is not enough: with membership dated
-- now(), resolveAsAt at a past instant returns NOBODY — silently, confidently,
-- for exactly the population an incident review is about. So occurred_at is
-- stored and the grant is answerable against it.

CREATE TABLE access.audit_event (
  audit_id        text        PRIMARY KEY,

  -- THE ACTOR. A principal, by foreign key — not a session, a service or a job,
  -- and not a bare string. D1's second property is that this cannot be anything
  -- other than a person the register knows.
  principal_id    text        NOT NULL REFERENCES access.staff_principal (principal_id),

  -- THE AUTHORITY the act was performed under, as resolved AT THE ACT. Retained
  -- rather than re-derived: a later reader must be able to answer "what let them
  -- do this" without replaying a resolution whose inputs may have moved.
  group_id        text        NOT NULL REFERENCES access.user_group (group_id),
  role            text        NOT NULL
                              CHECK (role IN ('estate_staff', 'approver', 'integration_support',
                                              'grant_administrator', 'resident')),
  node_kind       text        NOT NULL
                              CHECK (node_kind IN ('organization', 'portfolio', 'estate',
                                                   'phase', 'building', 'floor', 'unit',
                                                   'location')),
  node_id         text        NOT NULL,

  -- WHAT WAS DONE, and to what. target_id carries no foreign key: the act may
  -- be in another module's schema, and cross-module foreign keys are forbidden.
  action          text        NOT NULL,
  target_kind     text        NOT NULL,
  target_id       text        NOT NULL,

  -- THE EFFECTIVE INSTANT. The grant in force at occurred_at is the authority
  -- this record is read against.
  occurred_at     timestamptz NOT NULL,
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  correlation_id  uuid        NOT NULL,

  CONSTRAINT audit_event_recorded_not_before_occurrence CHECK (recorded_at >= occurred_at)
);

CREATE INDEX audit_event_principal_idx ON access.audit_event (principal_id, occurred_at);
CREATE INDEX audit_event_target_idx    ON access.audit_event (target_kind, target_id);

COMMENT ON TABLE access.audit_event IS
  'ADR-010 D1. The audit record that lets a scope-only write be released on scope alone. Append-only to the application by construction (GEN-010: pemo_app is a non-superuser holding SELECT+INSERT), written in the same transaction as the act, attributable to a principal, and carrying the authorising grant so authority can be reconstructed rather than re-derived.';

COMMENT ON COLUMN access.audit_event.principal_id IS
  'THE ACTOR — the person. Distinct from group_id, which is the AUTHORITY. ADR-010 D1 requires attribution to a principal; ADR-012 D2 holds the grant on a group. Both are kept; neither substitutes for the other.';

COMMENT ON COLUMN access.audit_event.occurred_at IS
  'The instant the grant must be read at. GEN-006 showed that re-deriving authority later returns nobody, silently, when the underlying dating has moved — so the instant is stored, not inferred.';
