-- Organization A — Wing Fu Property Holdings.
--
-- Seeded to cover ALL FOUR optional-tier combinations, because two optional tiers
-- (Portfolio and Phase) means four cases and each needs a passing test:
--
--   1. Portfolio YES, Phase YES  — Wing Fu Garden, Phase 1, Block A
--   2. Portfolio YES, Phase NO   — Wing Fu Garden, Block C, no phase
--   3. Portfolio NO,  Phase YES  — Tsz Wan Court, Phase 1, Block 1
--   4. Portfolio NO,  Phase NO   — Tsz Wan Court, Block 2, no phase

INSERT INTO property.portfolio (portfolio_id, organization_id, name_en, name_zh_hant) VALUES
  ('pf_wingfu_residential', 'org_wingfu_holdings', 'Wing Fu Residential Portfolio', '榮富住宅組合')
ON CONFLICT DO NOTHING;

INSERT INTO property.estate (estate_id, organization_id, portfolio_id, name_en, name_zh_hant, sequence) VALUES
  ('est_wing_fu_garden', 'org_wingfu_holdings', 'pf_wingfu_residential', 'Wing Fu Garden', '榮富花園', 1),
  -- Combination 3 and 4: an estate with NO portfolio is valid and reads exactly as
  -- the hierarchy did before ADR-002.
  ('est_tsz_wan_court',  'org_wingfu_holdings', NULL,                   'Tsz Wan Court', '慈雲閣', 2)
ON CONFLICT DO NOTHING;

INSERT INTO property.phase (phase_id, estate_id, name_en, name_zh_hant) VALUES
  ('ph_wfg_1', 'est_wing_fu_garden', 'Phase 1', '第一期'),
  ('ph_twc_1', 'est_tsz_wan_court',  'Phase 1', '第一期')
ON CONFLICT DO NOTHING;

INSERT INTO property.building (building_id, estate_id, phase_id, name_en, name_zh_hant, sequence) VALUES
  ('blk_wfg_a', 'est_wing_fu_garden', 'ph_wfg_1', 'Block A', 'A座', 1),
  -- A building with NO phase is valid and remains directly under its estate
  -- (GEN-001-ST MAJOR-003). Tested, not assumed.
  ('blk_wfg_b', 'est_wing_fu_garden', 'ph_wfg_1', 'Block B', 'B座', 2),
  ('blk_wfg_c', 'est_wing_fu_garden', NULL,       'Block C', 'C座', 3),
  ('blk_twc_1', 'est_tsz_wan_court',  'ph_twc_1', 'Block 1', '第一座', 1),
  ('blk_twc_2', 'est_tsz_wan_court',  NULL,       'Block 2', '第二座', 2)
ON CONFLICT DO NOTHING;

-- Floors. A sparse set on purpose: 1, 8, 12, 20, 21 and 40 are exactly the floors
-- the lift serving-scope tests need, plus G/F for the car park and store.
INSERT INTO property.floor (floor_id, building_id, label, ordinal, sequence) VALUES
  ('fl_wfg_a_gf', 'blk_wfg_a', 'G/F',  0,  0),
  ('fl_wfg_a_01', 'blk_wfg_a', '1/F',  1,  1),
  ('fl_wfg_a_12', 'blk_wfg_a', '12/F', 12, 12),
  ('fl_wfg_a_20', 'blk_wfg_a', '20/F', 20, 20),
  ('fl_wfg_a_21', 'blk_wfg_a', '21/F', 21, 21),
  ('fl_wfg_a_40', 'blk_wfg_a', '40/F', 40, 40),
  ('fl_wfg_b_03', 'blk_wfg_b', '3/F',  3,  3),
  ('fl_wfg_c_08', 'blk_wfg_c', '8/F',  8,  8),
  ('fl_twc_1_05', 'blk_twc_1', '5/F',  5,  5),
  ('fl_twc_2_05', 'blk_twc_2', '5/F',  5,  5)
ON CONFLICT DO NOTHING;

-- Units. All three unit classes sit at the SAME level and reuse the same
-- assignment, occupancy and effective-date machinery (ADR-003 Q2).
INSERT INTO property.unit (unit_id, floor_id, unit_class, label, external_ref, sequence) VALUES
  ('unit_wfg_a_12_a1', 'fl_wfg_a_12', 'residential', 'A1', NULL, 1),
  ('unit_wfg_a_01_a1', 'fl_wfg_a_01', 'residential', 'A1', NULL, 1),
  ('unit_wfg_a_20_a1', 'fl_wfg_a_20', 'residential', 'A1', NULL, 1),
  ('unit_wfg_a_21_a1', 'fl_wfg_a_21', 'residential', 'A1', NULL, 1),
  ('unit_wfg_a_40_a1', 'fl_wfg_a_40', 'residential', 'A1', NULL, 1),
  -- The flat a caregiver relationship points at. Seeded because a lapsed
  -- caregiver scope must still resolve to a real home on the account screen.
  ('unit_wfg_b_03_b2', 'fl_wfg_b_03', 'residential', 'B2', NULL, 2),
  ('unit_wfg_c_08_c3', 'fl_wfg_c_08', 'residential', 'C3', NULL, 3),
  ('unit_twc_1_05_a',  'fl_twc_1_05', 'residential', 'A',  NULL, 0),
  ('unit_twc_2_05_a',  'fl_twc_2_05', 'residential', 'A',  NULL, 0),
  -- A parking space and a store. In Hong Kong a parking space commonly carries its
  -- own title and is bought and sold separately from the flat, so modelling it only
  -- as part of a facility would lose a real property relationship.
  --
  -- PEMO owns the space as a property object and who holds it. It owns no access
  -- control, gate operation, plate recognition, tariff, payment, transaction,
  -- real-time occupancy or enforcement — those belong to the existing car-park
  -- system reached through 2IoThub. The external_ref is the whole of the link.
  ('unit_wfg_cp_p101', 'fl_wfg_a_gf', 'parking', 'P101', 'carpark:WFG/P101', 101),
  ('unit_wfg_st_s021', 'fl_wfg_a_gf', 'storage', 'S21',  'store:WFG/S21', 21)
ON CONFLICT DO NOTHING;
