-- ============================================================================
-- The exclusion key becomes (group, role, node_kind, node_id, period).
-- ============================================================================
--
-- Two gaps, one migration, because the second re-keys the exact constraint the
-- first modifies. Split, they would be two migrations fighting over one key.
--
--   GAP 1 — ADR-010 D4: `role` joins the exclusion key. As built in 0112 two
--   grants differing only by role collide, which makes the project's ONLY
--   worked staffing example unrepresentable: Ng Ka-ho appears as supervisor, as
--   duty officer AND as a case assignee. That is `prefer unrepresentable over
--   forbidden` firing in the wrong direction — forbidding a legitimate state.
--
--   GAP 2 — ADR-012 D2/D3/D4: a grant is held by a GROUP, never by a principal.
--   D4 is explicit that this is a SUBSTITUTION, not a widening: principal leaves
--   the key and group takes its place, with membership as a separate
--   effective-dated relationship. No column is polymorphic and no row ambiguous.
--
-- 0112 IS IMMUTABLE. It is not edited; this migration alters what it built.
--
-- ROLE IS text + CHECK, not an enum type, matching 0112's own `node_kind`. A
-- Postgres enum cannot have a value removed and reorders awkwardly; the CHECK
-- reads in a diff and changes in a migration like everything else here.
--
-- ALL FIVE VALUES ARE VALID FROM TODAY, including `resident`, which no row yet
-- uses. ADR-010 D4's own logic: naming a value costs nothing, and adding one
-- later is another immutable migration. A resident grant must need a row, never
-- a schema change. `resident` is not one of ADR-010 D2's four management roles —
-- it is the resident-portal population under ADR-007's audience boundary, and it
-- shares this column because the column is the authorization mechanism, not the
-- audience gate (ADR-010 D5: the two mechanisms never read each other).
-- ============================================================================

-- ─── the group ──────────────────────────────────────────────────────────────
-- ORGANIZATION-SCOPED (ADR-012 D7): a group never spans Organizations, and the
-- same real-world team operating two Organizations is two groups.
--
-- NO parent_group_id. Group nesting is ADR-012's ONE OPEN QUESTION and is
-- deliberately not decided here. Nothing in this shape forecloses it: a later
-- migration adds a nullable self-reference without touching the grant key,
-- because the key names a group and says nothing about how groups relate.
CREATE TABLE access.user_group (
  group_id         text        PRIMARY KEY,
  organization_id  text        NOT NULL,
  display_name     text        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_group_organization_idx ON access.user_group (organization_id);

COMMENT ON TABLE access.user_group IS
  'ADR-012 D2. The holder of a scope grant. Groups are core, not an optimisation: grant once to a group and change membership without re-granting. A one-off permission for one person is a GROUP OF ONE — the normal way to express it, not a workaround. Organization-scoped per D7.';

-- ─── membership ─────────────────────────────────────────────────────────────
-- EFFECTIVE-DATED (ADR-012 D6). ADR-007 D4 asks what a person was permitted to
-- see THEN, and with groups that answer depends on the grant AND the membership
-- as each stood at that instant. A system that resolves the grant historically
-- and the membership currently is worse than one that does neither, because it
-- produces a confident answer wrong only for people whose membership changed —
-- the exact population an incident review is about.
CREATE TABLE access.group_membership (
  membership_id    text        PRIMARY KEY,
  group_id         text        NOT NULL REFERENCES access.user_group (group_id),
  principal_id     text        NOT NULL REFERENCES access.staff_principal (principal_id),
  effective_from   timestamptz NOT NULL,
  effective_to     timestamptz NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT group_membership_period_ordered
    CHECK (effective_to IS NULL OR effective_to > effective_from),

  -- One person cannot hold the same membership twice over overlapping periods.
  -- Declarative, not a trigger: a trigger is bypassable by a bulk load, which is
  -- exactly how bad history arrives.
  CONSTRAINT group_membership_no_overlapping_periods
    EXCLUDE USING gist (
      group_id     WITH =,
      principal_id WITH =,
      tstzrange(effective_from, effective_to) WITH &&
    )
);

CREATE INDEX group_membership_principal_idx ON access.group_membership (principal_id);
CREATE INDEX group_membership_group_idx ON access.group_membership (group_id);

COMMENT ON TABLE access.group_membership IS
  'ADR-012 D6. Effective-dated membership. A principal''s rights are the UNION over their memberships (D5) — monotonic, no deny and no exclusion. Losing one membership loses exactly that group''s grants; another group granting the same role at the same node keeps it, which is the union working as specified rather than a leak.';

-- ─── the re-key ─────────────────────────────────────────────────────────────
ALTER TABLE access.scope_grant ADD COLUMN group_id text REFERENCES access.user_group (group_id);
ALTER TABLE access.scope_grant ADD COLUMN role     text;

-- BACKFILL: one group-of-one per principal currently holding grants.
--
-- The membership starts at the EARLIEST of that principal's grants, not now().
-- A membership starting today would make every past grant resolve to nobody —
-- precisely the D6 failure above. This is a claim about the past and is written
-- as one.
INSERT INTO access.user_group (group_id, organization_id, display_name)
SELECT 'grp_of_one_' || p.principal_id, p.organization_id, p.display_name || ' (group of one)'
  FROM access.staff_principal p
 WHERE EXISTS (SELECT 1 FROM access.scope_grant g WHERE g.principal_id = p.principal_id);

INSERT INTO access.group_membership (membership_id, group_id, principal_id, effective_from, effective_to)
SELECT 'mem_of_one_' || g.principal_id,
       'grp_of_one_' || g.principal_id,
       g.principal_id,
       MIN(g.effective_from),
       NULL
  FROM access.scope_grant g
 GROUP BY g.principal_id;

UPDATE access.scope_grant SET group_id = 'grp_of_one_' || principal_id;

-- ROLE BACKFILL — an assertion about the past, made by the Master Brain and
-- recorded here with its basis, per ADR-010 D4 ("a claim about the past, not a
-- default"). The seeded grants are scope-holding staff grants that enabled the
-- 27 scope-only actions; `estate_staff` is ADR-010 D2's residual scope-holding
-- role. The old one-grant-per-principal-per-node model could not have carried a
-- distinguished capability (Approver, Grant administrator, Integration support)
-- on the same row — under the new key those are separate grants.
UPDATE access.scope_grant SET role = 'estate_staff' WHERE role IS NULL;

ALTER TABLE access.scope_grant ALTER COLUMN group_id SET NOT NULL;
ALTER TABLE access.scope_grant ALTER COLUMN role     SET NOT NULL;

ALTER TABLE access.scope_grant
  ADD CONSTRAINT scope_grant_role_check
  CHECK (role IN ('estate_staff', 'approver', 'integration_support',
                  'grant_administrator', 'resident'));

-- PRINCIPAL LEAVES. Not deprecated, not nullable — dropped. ADR-012 D2: "There
-- are no direct grants to a principal." A column that still exists is a column
-- someone writes to; making the state unrepresentable is stronger than
-- forbidding it, and it is why done-when 2's failure is `column does not exist`
-- rather than a constraint violation.
ALTER TABLE access.scope_grant DROP CONSTRAINT scope_grant_no_overlapping_periods;
DROP INDEX IF EXISTS access.scope_grant_principal_idx;
ALTER TABLE access.scope_grant DROP COLUMN principal_id;

ALTER TABLE access.scope_grant
  ADD CONSTRAINT scope_grant_no_overlapping_periods
  EXCLUDE USING gist (
    group_id  WITH =,
    role      WITH =,
    node_kind WITH =,
    node_id   WITH =,
    tstzrange(effective_from, effective_to) WITH &&
  );

CREATE INDEX scope_grant_group_idx ON access.scope_grant (group_id);

COMMENT ON TABLE access.scope_grant IS
  'ADR-010 D4 + ADR-012 D4. (group, role, scope node) effective-dated, where a scope node is an ADR-002 hierarchy node OR an ADR-003 Location. The key is a substitution of ADR-007 D4''s original: principal left it and group took its place. Two roles at one node are two grants, which is what makes the project''s only worked staffing example representable.';

COMMENT ON COLUMN access.scope_grant.role IS
  'ADR-010 D2''s four management roles plus `resident` (resident-route). Roles are orthogonal to ADR-007 D3''s tiers (ADR-010 D5): tiers decide what a surface may show, roles and scope decide what a principal may do, and neither mechanism reads the other.';
