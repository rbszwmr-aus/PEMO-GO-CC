-- Party and interest — ADR-011. Who stands in what relation to a unit.
--
-- Every module in PEMO resolves at a unit; none of them could say WHO THE UNIT
-- BELONGS TO. GEN-006-ST built resident, household, membership and occupancy;
-- nothing held "B4's owner is Mr Chan". This migration lands that fact.
--
-- ── SEQUENCING (GEN-029-ST alongside GEN-018-ST, one worktree) ────────────────
-- This number, 0114, was read from the live migrations directory at the moment
-- of writing — max 0113 (GEN-018-ST's uncommitted access + resident-text block).
-- NOT carried from any plan. GEN-018-ST's 0110-0113 merge before this. See
-- tests/integration/migration-numbering.test.ts, which now also asserts the
-- working-tree numbers are unique — the collision this session could produce and
-- the merge-base guard cannot see (GEN-005-SG's defect class).
--
-- ── NO WRITE SURFACE (ADR-011 D10) ────────────────────────────────────────────
-- These tables may be created, migrated, seeded and read. NO write operation on
-- an interest is contracted or built until ADR-011 Open question 1 answers who
-- may write one. Creating, ending or correcting an interest are the most
-- consequential writes in the product; an interest written by the wrong hand
-- mis-routes a management fee and grants a login to the wrong party. Reads need
-- scope only, exactly as GEN-018-ST proved.
--
-- ── NO CROSS-MODULE FOREIGN KEY (ADR-011 D9, modules/access precedent) ─────────
-- interest.party_id -> resident.party is an INTRA-schema FK and is correct.
-- interest.unit_id -> property.unit and *.recorded_by -> access.staff_principal
-- are CROSS-module and carry NO foreign key: stable identifiers only. The
-- pg_constraint cross-schema sweep stays zero, counted at Task 2.

BEGIN;

-- ── resident.party — one entity, two kinds (ADR-011 D3) ───────────────────────
--
-- A PARTY IS NEVER AN ADR-002 ORGANIZATION. Organization is the tenancy root and
-- the absolute security boundary ("cross-organization isolation is absolute and
-- is not a role"). A party is a COUNTERPARTY living inside one Organization's
-- world — never a root, never a boundary, never a tenant of the platform.
--
--   organization_id BELOW IS TENANCY SCOPE, NOT IDENTITY. A party is scoped BY an
--   Organization; a party is not AN Organization. Any later change that reads
--   this column as the party's identity is wrong and must stop (D3 stop
--   condition).
--
-- `legal_person` is the schema term; "Company" is the Product Owner's label
-- (chosen 2026-08-18 precisely to avoid the Organization collision).
--
-- A party is NOT a resident. A resident occupies (and may hold no interest); a
-- party holds an interest (and may never occupy). One human can be both — the
-- owner-occupier — as TWO ROWS WITH NO FK between them, preserving GEN-006-ST's
-- locked Person != Principal separation. Consequence, chosen not defaulted:
-- "is this owner also the occupant?" is an aggregate/identity-match, not a
-- lookup — the party-side analogue of D4's "who owns Block C is an aggregate".
CREATE TABLE resident.party (
  party_id         text        PRIMARY KEY,
  organization_id  text        NOT NULL,   -- TENANCY SCOPE, never identity. Stable id, NO FK.
  kind             text        NOT NULL CHECK (kind IN ('natural_person', 'legal_person')),
  display_name     text        NOT NULL,   -- 'Mr Chan' / 'Novatek Ltd'

  -- Provenance (D6 / R7): how PEMO learned this party exists. Never blank, no
  -- default, no fallback to 'pemo'. An unmarked source is a claim, not an absence.
  source              text     NOT NULL
                               CHECK (source IN ('human_entry', 'bulk_import', 'external_reconciliation')),
  external_system     text     NULL,
  external_reference  text     NULL,

  -- Audit (D6 / ADR-010 D1). recorded_by is a PRINCIPAL id (stable id into
  -- access.*, NO FK), NEVER a job or session id, and NEVER a placeholder.
  --
  -- THE BOOTSTRAP IS AN EVENT, NOT A ROLE (ADR-010 Open question 1). A row learned
  -- by bulk import at estate onboarding, or reconciled from an external system,
  -- had NO acting principal — there was a provisioning act, not a person. So
  -- recorded_by is honestly NULL for those, gated all-or-nothing against source:
  -- a fiction in this column would be worse than a null, because a null is
  -- legible and a fiction is not. recorded_by is present IFF a human entered it.
  recorded_by      text        NULL,
  recorded_at      timestamptz NOT NULL,   -- when the ACT happened; NO default (R7: an act's time is stated, not now())
  created_at       timestamptz NOT NULL DEFAULT now(),

  -- Provenance gate (ADR-006 pattern): a reconciled fact names its source and
  -- reference; every other source names neither. Half-claimed provenance cannot
  -- be written.
  CONSTRAINT party_reconciliation_ref
    CHECK ((source = 'external_reconciliation')
           = (external_system IS NOT NULL AND external_reference IS NOT NULL)),
  -- Attribution gate: a human entry names its principal; a bootstrap event
  -- (bulk_import) and a job (external_reconciliation) name none. No placeholder.
  CONSTRAINT party_actor_only_when_human
    CHECK ((source = 'human_entry') = (recorded_by IS NOT NULL))
);

CREATE INDEX party_organization_idx ON resident.party (organization_id);

COMMENT ON TABLE resident.party IS
  'ADR-011 D3. A party — natural_person or legal_person — is a counterparty inside one Organization''s world, scoped BY organization_id and never identified by it. Not a resident, not an Organization. Carries D6 provenance and audit; recorded_by is null for non-human provenance (the bootstrap is an event, not a role — ADR-010 Open question 1).';

-- ── resident.interest — party x unit x kind, effective-dated ───────────────────
--
-- AUTHORITATIVE FOR OWNERSHIP AND TENANCY (GEN-029-ST ruling, F1).
--
--   resident.interest is the system of record for every ownership and tenancy
--   question. resident.occupancy.role's 'owner_occupier' and 'tenant' values are
--   NOT to be read as an answer about title or tenancy BY ANYTHING, EVER. That
--   enum describes how a person OCCUPIES; it cannot represent a non-occupying
--   owner (the landlord, the Novatek corporate-tenant case) and must not be used
--   as if it could. One business datum, one owner (ADR-009). PEMO is the system
--   of record (D1), and a system of record with two answers is not one.
--   Reconciling the occupancy.role enum is named debt with an owner, out of
--   scope here.
--
-- KIND, NOT ROLE (D2). `role` belongs to ADR-010 (what a principal may do). Three
-- mechanisms, three words — interest.kind, scope_grant.role, ADR-007 tier — none
-- reading either of the others. A schema that put `role` here would let someone
-- join access.scope_grant.role to resident.interest.role and get correct-looking
-- SQL that answers no question.
--
-- ONE UNIT, FLOOR AND CEILING (D4). An interest is held at exactly one unit — no
-- Floor, Building, Estate, Phase, Portfolio or ADR-003 Location. A company owning
-- Block C entire holds 378 interests, because Hong Kong title is per-unit; "who
-- owns Block C" is therefore an AGGREGATE, NOT A LOOKUP, and a reader who does not
-- know this will report the model as broken. Widening path, if a node-level
-- interest is ever needed: add (node_kind, node_id) and backfill 'unit' — the one
-- shape whose general case degenerates cleanly to the specific one.
--
-- NO INSTRUMENT (D5). The interest carries party, unit, kind, effective range,
-- provenance and audit — and NOTHING ELSE. No rent, deposit, premium, service
-- charge, lease reference, break clause, renewal, rent review, agent, commission,
-- stamp duty, assignment or any monetary amount. Those are what PEMO does NOT hold
-- (D1); a column named for any of them is a defect, enforced by D5's denylist.
CREATE TABLE resident.interest (
  interest_id      text        PRIMARY KEY,
  party_id         text        NOT NULL REFERENCES resident.party (party_id),  -- intra-schema FK
  unit_id          text        NOT NULL,   -- stable id into property.unit, NO FK (D4, D9)
  kind             text        NOT NULL CHECK (kind IN ('ownership', 'tenancy')),

  -- Effective-dated, half-open [from, to). Two questions, two answers: who holds
  -- this unit NOW, and who held it THEN (D1 makes PEMO the system of record, which
  -- is a promise to answer the second).
  effective_from   timestamptz NOT NULL,
  effective_to     timestamptz NULL,

  -- Provenance + audit — identical shape and gates to resident.party (D6).
  source              text     NOT NULL
                               CHECK (source IN ('human_entry', 'bulk_import', 'external_reconciliation')),
  external_system     text     NULL,
  external_reference  text     NULL,
  recorded_by      text        NULL,
  recorded_at      timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT interest_period_ordered
    CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT interest_reconciliation_ref
    CHECK ((source = 'external_reconciliation')
           = (external_system IS NOT NULL AND external_reference IS NOT NULL)),
  CONSTRAINT interest_actor_only_when_human
    CHECK ((source = 'human_entry') = (recorded_by IS NOT NULL)),

  -- THE EXCLUSION KEY IS (party, unit, kind) — NOT (unit, kind).
  --
  -- (unit, kind) would forbid legitimate states in the wrong direction, the same
  -- failure ADR-010 D4 corrected when it added `role` to scope_grant's key:
  --   - joint ownership (two parties, one unit, both ownership) — 夫妻聯名, ordinary;
  --   - a unit carrying ownership AND tenancy at once — the landlord/tenant case,
  --     the reason this ADR exists (handled by `kind` being in the key);
  --   - joint tenants (two parties, one unit, both tenancy).
  -- `party` is the axis whose omission makes joint ownership unrepresentable. With
  -- it in the key, the ONLY thing forbidden is the genuine duplicate: one party
  -- holding the same kind in the same unit over overlapping time. Non-overlapping
  -- same-key ranges (sold, then bought back) are permitted — the && is false.
  --
  -- Declarative gist, not a trigger: a trigger is bypassable by a bulk load, which
  -- is exactly how bad history arrives. btree_gist installed by 0101.
  CONSTRAINT interest_no_duplicate
    EXCLUDE USING gist (
      party_id WITH =,
      unit_id  WITH =,
      kind     WITH =,
      tstzrange(effective_from, effective_to) WITH &&
    )
);

CREATE INDEX interest_unit_idx ON resident.interest (unit_id, kind);
CREATE INDEX interest_party_idx ON resident.interest (party_id);

COMMENT ON TABLE resident.interest IS
  'ADR-011. A party''s standing (ownership|tenancy) in respect of exactly one unit, effective-dated. AUTHORITATIVE for ownership and tenancy; occupancy.role''s owner_occupier/tenant are never to be read as a title/tenancy answer (GEN-029-ST F1). No instrument (D5). Exclusion key (party, unit, kind) over a tstzrange forbids only a genuine duplicate, permitting joint ownership and the landlord/tenant case.';

COMMENT ON COLUMN resident.interest.unit_id IS
  'Stable identifier into property.unit, NO foreign key (cross-module). One interest, one unit (D4): "who owns Block C" is an aggregate over 378 rows, not a lookup.';

COMMIT;
