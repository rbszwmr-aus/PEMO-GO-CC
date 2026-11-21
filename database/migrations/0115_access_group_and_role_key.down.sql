-- Reverse of 0115.
--
-- IT REFUSES ON TWO CONDITIONS, and refusing is a decision rather than an
-- implementation detail. The down can reconstruct one `principal_id` per grant
-- only while every group is a group of one. Once a real group has two concurrent
-- members, one grant maps to two principals and there is no correct answer — a
-- down that silently picks one LIES about the state it restores, and the lie is
-- in the authorization table.
--
-- So it is cleanly reversible in the backfill state and loudly irreversible
-- after. Failing here costs a manual decision; succeeding wrongly costs a
-- silently wrong access model.
DO $$
DECLARE multi_member text; multi_role text;
BEGIN
  -- REASON 1: a group with more than one concurrent member. One grant would map
  -- to two principals and the pre-0115 key holds one.
  SELECT string_agg(group_id, ', ') INTO multi_member
    FROM (
      SELECT group_id
        FROM access.group_membership
       WHERE effective_to IS NULL OR effective_to > now()
       GROUP BY group_id
      HAVING count(DISTINCT principal_id) > 1
    ) AS m;

  -- REASON 2: one principal holding TWO ROLES at one node, through two groups.
  -- This is the state 0115 exists to make possible, and it is unrepresentable
  -- under the pre-0115 key REGARDLESS of group size — two groups of one are
  -- enough. Found by running the down rather than by reasoning about it: the
  -- first version of this guard checked only REASON 1, got past its own check,
  -- and died halfway through re-adding the old exclusion constraint with a raw
  -- conflict message. A guard that passes and then fails downstream is worse
  -- than no guard: it half-applies the migration before anyone knows.
  SELECT string_agg(DISTINCT principal_id || ' @ ' || node_kind || ':' || node_id, ', ')
    INTO multi_role
    FROM (
      SELECT m.principal_id, g.node_kind, g.node_id
        FROM access.scope_grant g
        JOIN access.group_membership m ON m.group_id = g.group_id
       WHERE (g.effective_to IS NULL OR g.effective_to > now())
         AND (m.effective_to IS NULL OR m.effective_to > now())
       GROUP BY m.principal_id, g.node_kind, g.node_id
      HAVING count(*) > 1
    ) AS r;

  IF multi_member IS NOT NULL OR multi_role IS NOT NULL THEN
    -- One placeholder, one assembled message. `%%` is a LITERAL percent in RAISE,
    -- so three of them is one placeholder and three arguments — which fails as
    -- "too many parameters specified for RAISE", at the moment you most want a
    -- clear refusal.
    RAISE EXCEPTION '%',
      'REFUSING to reverse 0115. '
      || coalesce('Group(s) ' || multi_member || ' hold more than one concurrent member; the '
           || 'pre-0115 schema keys a grant on ONE principal, so reversing would pick one member '
           || 'per grant and discard the rest. ', '')
      || coalesce('Principal/node pair(s) ' || multi_role || ' hold more than one role at one '
           || 'node; the pre-0115 key (principal, node_kind, node_id, period) cannot express that '
           || 'at all — it is the exact state this migration was written to make possible. ', '')
      || 'Resolve the conflicting rows, or do not reverse.';
  END IF;
END $$;

ALTER TABLE access.scope_grant DROP CONSTRAINT scope_grant_no_overlapping_periods;
DROP INDEX IF EXISTS access.scope_grant_group_idx;
ALTER TABLE access.scope_grant DROP CONSTRAINT scope_grant_role_check;

ALTER TABLE access.scope_grant ADD COLUMN principal_id text REFERENCES access.staff_principal (principal_id);

UPDATE access.scope_grant g
   SET principal_id = m.principal_id
  FROM access.group_membership m
 WHERE m.group_id = g.group_id;

ALTER TABLE access.scope_grant ALTER COLUMN principal_id SET NOT NULL;
ALTER TABLE access.scope_grant DROP COLUMN role;
ALTER TABLE access.scope_grant DROP COLUMN group_id;

ALTER TABLE access.scope_grant
  ADD CONSTRAINT scope_grant_no_overlapping_periods
  EXCLUDE USING gist (
    principal_id WITH =,
    node_kind    WITH =,
    node_id      WITH =,
    tstzrange(effective_from, effective_to) WITH &&
  );

CREATE INDEX scope_grant_principal_idx ON access.scope_grant (principal_id);

DROP TABLE access.group_membership;
DROP TABLE access.user_group;
