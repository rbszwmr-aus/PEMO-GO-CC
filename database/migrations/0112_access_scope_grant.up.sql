-- The scope grant (ADR-007 D4, A2, A3/D9).
--
--   an assignment is (principal, scope node), effective-dated
--
-- A SCOPE NODE IS AN ADR-002 HIERARCHY NODE *OR* AN ADR-003 LOCATION.
--
-- The hierarchy alone cannot express the surface. `Counter` and the clubhouse
-- facility locations are addressable places with no floor and no unit, and a
-- staff member who works the counter is scoped to one. A model over the hierarchy
-- alone would have no way to say so — and a scope model is the single hardest
-- thing to widen later, because every endpoint and every stored grant assumes its
-- shape.
--
-- node_kind IS THE CONTRACT'S OWN ENUM, COPIED VERBATIM.
--
-- packages/api-contracts/management-web/openapi.yaml, schema ScopeRef, property
-- `kind`. Eight values, including `organization` and `portfolio` from this first
-- version per D9/A3 even though no screen renders a switcher, and `location` per
-- A2.
--
-- Copying it rather than inventing one makes an inconsistency UNREPRESENTABLE
-- rather than merely forbidden: a grant cannot name a kind the contract has no
-- way to express, so the two cannot drift apart by anyone's oversight. Same form
-- as ADR-006's provenance CHECK.
CREATE TABLE access.scope_grant (
  grant_id         text        PRIMARY KEY,
  principal_id     text        NOT NULL REFERENCES access.staff_principal (principal_id),

  node_kind        text        NOT NULL
                               CHECK (node_kind IN ('organization', 'portfolio', 'estate',
                                                    'phase', 'building', 'floor', 'unit',
                                                    'location')),
  -- Stable identifier into property.* (or platform.organization for the root).
  -- NO FOREIGN KEY: those are other modules, cross-module foreign keys are
  -- forbidden, and the pg_constraint sweep proves it. A grant naming a node that
  -- has since been removed is a real state to handle, not one to prevent with a
  -- constraint that would also couple two modules.
  node_id          text        NOT NULL,

  -- Effective-dated, like ADR-006's mapping tables and for the same reason. TWO
  -- DIFFERENT QUESTIONS, TWO DIFFERENT ANSWERS: what may this person see NOW uses
  -- the current grant; what was this person permitted to see THEN — the question
  -- asked after an incident — uses the grant in force at that time. A system that
  -- can only answer the first cannot be audited.
  effective_from   timestamptz NOT NULL,
  effective_to     timestamptz NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT scope_grant_period_ordered
    CHECK (effective_to IS NULL OR effective_to > effective_from),

  -- One principal cannot hold the same node over two overlapping periods, or
  -- "what was in force then" would have two answers — the ambiguity effective
  -- dating exists to remove.
  --
  -- Declarative, not a trigger: a trigger is bypassable by a bulk load, which is
  -- exactly how bad history arrives. btree_gist is already installed by 0101.
  CONSTRAINT scope_grant_no_overlapping_periods
    EXCLUDE USING gist (
      principal_id WITH =,
      node_kind    WITH =,
      node_id      WITH =,
      tstzrange(effective_from, effective_to) WITH &&
    )
);

CREATE INDEX scope_grant_principal_idx ON access.scope_grant (principal_id);
CREATE INDEX scope_grant_node_idx ON access.scope_grant (node_kind, node_id);

COMMENT ON TABLE access.scope_grant IS
  'ADR-007 D4/A2. (principal, scope node) effective-dated, where a scope node is an ADR-002 hierarchy node OR an ADR-003 Location. node_kind is the management contract''s ScopeRef.kind enum copied verbatim so the two cannot drift.';

COMMENT ON COLUMN access.scope_grant.node_id IS
  'Stable identifier with no foreign key. Cross-module references use stable identifiers only; the pg_constraint sweep must keep returning zero.';
