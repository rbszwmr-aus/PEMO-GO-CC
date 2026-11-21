-- Staff principals and scope grants (ADR-007 D4, A2).
--
-- Seeded to make every scope rule TESTABLE, including the ones that are only
-- interesting when they differ:
--
--   estate manager   grant at estate  → the whole estate, all levels beneath
--   block supervisor grant at building → one block, and nothing in another
--   counter staff    grant at LOCATION → a place with no floor and no unit, and
--                    explicitly NOT the building the counter sits in
--   former manager   a grant that ENDED → invisible now, visible as at then
--   organization B   a principal in another Organization → reaches nothing here
--
-- The former manager is the one that makes the audit question answerable: what
-- was this person permitted to see THEN is a different query from what may they
-- see NOW, and a seed with only current grants cannot tell the two apart.

-- Teardown runs in DEPENDENCY ORDER: grants, then memberships, then groups,
-- then principals. 0115 put two new foreign keys between them, and deleting a
-- principal first now fails on group_membership_principal_id_fkey — which is
-- the FK doing its job, not an obstacle. The grant pattern widens to
-- 'grant_seed_%' plus 'grant_dual_%' because the two-roles-at-one-node pair is
-- part of the seeded world.
DELETE FROM access.scope_grant WHERE grant_id LIKE 'grant_seed_%' OR grant_id LIKE 'grant_dual_%';
DELETE FROM access.group_membership WHERE membership_id LIKE 'mem_%';
DELETE FROM access.user_group WHERE group_id LIKE 'grp_%';
DELETE FROM access.staff_principal WHERE principal_id LIKE 'stf_%';

-- `recorded_seed` (0124): these are FIXTURES that predate the identity boundary
-- and carry no external identity. Stated, not defaulted -- a default would let a
-- real registration silently record a person as a fixture.
INSERT INTO access.staff_principal (principal_id, organization_id, display_name, identity_source) VALUES
  ('stf_wfg_manager',    'org_wingfu_holdings',  'Chan Mei-ling 陳美玲', 'recorded_seed'),
  ('stf_wfg_block_a',    'org_wingfu_holdings',  'Lau Chi-wai 劉志偉', 'recorded_seed'),
  ('stf_wfg_counter',    'org_wingfu_holdings',  'Ng Siu-fong 吳小芳', 'recorded_seed'),
  ('stf_wfg_former',     'org_wingfu_holdings',  'Tsang Ho-yin 曾浩然', 'recorded_seed'),
  ('stf_hbv_manager',    'org_harbour_property', 'Yeung Ka-wai 楊嘉維', 'recorded_seed'),
  -- A PORTFOLIO-scoped principal. Added when the reconciled corpus arrived
  -- carrying scope/portfolio-grant.json, so the tier ADR-002 made optional is
  -- exercised by a real grant rather than only by the CHECK constraint that
  -- permits its name.
  ('stf_wfg_portfolio',  'org_wingfu_holdings',  'Poon Wai-lam 潘慧琳', 'recorded_seed'),

  -- TWO ROLES AT ONE NODE, via two groups. This is ADR-010 D4's own worked
  -- example — Ng Ka-ho appears as supervisor, as duty officer AND as a case
  -- assignee — and it is the ONLY staffing example the project has. Under the
  -- pre-0115 key (principal, node) his two grants at one node COLLIDE, so the
  -- project's sole real assignment was unrepresentable. He is seeded here so the
  -- differential property test walks a principal who reaches one node through
  -- two roles, which is the case that fails under the old key and passes under
  -- the new one.
  ('stf_wfg_dual_role',  'org_wingfu_holdings',  'Ng Ka-ho 吳家豪', 'recorded_seed')
ON CONFLICT (principal_id) DO NOTHING;

-- ─── groups (ADR-012 D2) ────────────────────────────────────────────────────
-- A grant is held by a GROUP, always. A one-off permission for one person is a
-- GROUP OF ONE — the normal way to express it, not a workaround (D2, confirmed
-- by the Product Owner when the cost was named). Organization-scoped (D7): a
-- group never spans Organizations.
INSERT INTO access.user_group (group_id, organization_id, display_name) VALUES
  ('grp_of_one_stf_wfg_manager',   'org_wingfu_holdings',  'Chan Mei-ling 陳美玲 (group of one)'),
  ('grp_of_one_stf_wfg_block_a',   'org_wingfu_holdings',  'Lau Chi-wai 劉志偉 (group of one)'),
  ('grp_of_one_stf_wfg_counter',   'org_wingfu_holdings',  'Ng Siu-fong 吳小芳 (group of one)'),
  ('grp_of_one_stf_wfg_former',    'org_wingfu_holdings',  'Tsang Ho-yin 曾浩然 (group of one)'),
  ('grp_of_one_stf_hbv_manager',   'org_harbour_property', 'Yeung Ka-wai 楊嘉維 (group of one)'),
  ('grp_of_one_stf_wfg_portfolio', 'org_wingfu_holdings',  'Poon Wai-lam 潘慧琳 (group of one)'),

  -- The two groups that carry Ng Ka-ho's two roles at Block A. Two GROUPS, not
  -- one group with two roles: D3 puts the role on the grant the group holds, so
  -- a second role at the same node is a second group holding a second grant.
  ('grp_wfg_block_a_staff',     'org_wingfu_holdings', 'Block A estate staff'),
  ('grp_wfg_block_a_approvers', 'org_wingfu_holdings', 'Block A approvers')
ON CONFLICT (group_id) DO NOTHING;

-- ─── membership (ADR-012 D6) ────────────────────────────────────────────────
-- Effective-dated, and starting when the grant did rather than today. A
-- membership starting now would make every past grant resolve to nobody, which
-- is the exact failure D6 names: an answer that is confident and wrong only for
-- the people an incident review is about.
INSERT INTO access.group_membership (membership_id, group_id, principal_id, effective_from, effective_to) VALUES
  ('mem_of_one_stf_wfg_manager',   'grp_of_one_stf_wfg_manager',   'stf_wfg_manager',   '2024-01-01T00:00:00+08:00', NULL),
  ('mem_of_one_stf_wfg_block_a',   'grp_of_one_stf_wfg_block_a',   'stf_wfg_block_a',   '2024-01-01T00:00:00+08:00', NULL),
  ('mem_of_one_stf_wfg_counter',   'grp_of_one_stf_wfg_counter',   'stf_wfg_counter',   '2024-01-01T00:00:00+08:00', NULL),
  ('mem_of_one_stf_wfg_former',    'grp_of_one_stf_wfg_former',    'stf_wfg_former',    '2025-01-01T00:00:00+08:00', NULL),
  ('mem_of_one_stf_hbv_manager',   'grp_of_one_stf_hbv_manager',   'stf_hbv_manager',   '2024-01-01T00:00:00+08:00', NULL),
  ('mem_of_one_stf_wfg_portfolio', 'grp_of_one_stf_wfg_portfolio', 'stf_wfg_portfolio', '2024-01-01T00:00:00+08:00', NULL),

  -- One principal, two groups. His rights are the UNION (D5).
  ('mem_dual_staff',     'grp_wfg_block_a_staff',     'stf_wfg_dual_role', '2024-01-01T00:00:00+08:00', NULL),
  ('mem_dual_approver',  'grp_wfg_block_a_approvers', 'stf_wfg_dual_role', '2024-01-01T00:00:00+08:00', NULL)
-- (membership_id, version), not (membership_id): since 0123 a membership is an
-- assertion series and membership_id alone is no longer unique. This targets
-- group_membership_version_unique, and the seed's rows are all version 1 by
-- default, so the idempotency it expresses is unchanged. THE THIRD TABLE to need
-- this re-key after occupancy (0117) and scope_grant (0118) -- anticipated here
-- rather than rediscovered as a seed failure.
ON CONFLICT (membership_id, version) DO NOTHING;

INSERT INTO access.scope_grant
  (grant_id, group_id, role, node_kind, node_id, effective_from, effective_to)
VALUES
  -- The estate manager: everything in Wing Fu Garden, at every level beneath it.
  ('grant_seed_mgr_estate', 'grp_of_one_stf_wfg_manager', 'estate_staff', 'estate', 'est_wing_fu_garden',
   '2024-01-01T00:00:00+08:00', NULL),

  -- A block supervisor: Block A only. Block C's plant room must be invisible to
  -- this principal, which is what proves inheritance is bounded rather than
  -- decorative.
  ('grant_seed_blocka', 'grp_of_one_stf_wfg_block_a', 'estate_staff', 'building', 'blk_wfg_a',
   '2024-01-01T00:00:00+08:00', NULL),

  -- Counter staff: an ADR-003 LOCATION. A place with no floor and no unit, which
  -- a hierarchy-only model could not express at all. Deliberately NOT accompanied
  -- by a building grant: this principal is scoped to the counter, not to the
  -- block the counter sits in.
  ('grant_seed_counter', 'grp_of_one_stf_wfg_counter', 'estate_staff', 'location', 'loc_wfg_clubhouse',
   '2024-01-01T00:00:00+08:00', NULL),

  -- A grant that ENDED. Nothing today; the estate as at 1 March 2026.
  ('grant_seed_former', 'grp_of_one_stf_wfg_former', 'estate_staff', 'estate', 'est_wing_fu_garden',
   '2025-01-01T00:00:00+08:00', '2026-06-01T00:00:00+08:00'),

  -- A PORTFOLIO grant. The interesting case is not that it reaches Wing Fu
  -- Garden, but that it must reach ONLY the estates in that portfolio: Tsz Wan
  -- Court belongs to the same Organization and to NO portfolio, so a portfolio
  -- grant that leaked upward through the organization would pick it up. That is
  -- the one asymmetry a portfolio tier can get wrong, and the seed now contains
  -- both sides of it.
  ('grant_seed_portfolio', 'grp_of_one_stf_wfg_portfolio', 'estate_staff', 'portfolio', 'pf_wingfu_residential',
   '2024-01-01T00:00:00+08:00', NULL),

  -- Another Organization. No grant at any level reaches across.
  ('grant_seed_hbv', 'grp_of_one_stf_hbv_manager', 'estate_staff', 'estate', 'est_harbour_view',
   '2024-01-01T00:00:00+08:00', NULL),

  -- TWO GRANTS, ONE NODE, TWO ROLES. Under 0112's key these two rows are one
  -- (principal, node) pair over overlapping periods and the second is REJECTED.
  -- Under 0115's key they differ in `role` and both stand. This pair is the
  -- Gap 1 red made permanent: it lives in the seed, so any future migration that
  -- narrows the key back cannot build a world at all.
  ('grant_dual_staff',    'grp_wfg_block_a_staff',     'estate_staff', 'building', 'blk_wfg_a',
   '2024-01-01T00:00:00+08:00', NULL),
  ('grant_dual_approver', 'grp_wfg_block_a_approvers', 'approver',     'building', 'blk_wfg_a',
   '2024-01-01T00:00:00+08:00', NULL)
-- (grant_id, version), not (grant_id): since 0118 a grant is an assertion series
-- and grant_id alone is no longer unique. scope_grant_version_unique is the
-- constraint this targets, and the seed's rows are all version 1 by default, so
-- the idempotency this expresses is unchanged — re-seeding still skips a row it
-- already wrote.
ON CONFLICT (grant_id, version) DO NOTHING;
