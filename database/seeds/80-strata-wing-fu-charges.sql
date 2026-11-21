-- Wing Fu Garden demo management fees. Idempotent replacement of the
-- chg_wfg_ / pay_wfg_ / alloc_wfg_ rows. Household ids match the resident seed
-- (A4 is hh_wfg_a_05_a4, the generated id — the UI fixture's `_ended` suffix
-- is not a database id). contact_email matches resident.household.

DELETE FROM strata.payment_allocation WHERE allocation_id LIKE 'alloc\_wfg\_%' ESCAPE '\';
DELETE FROM strata.payment WHERE payment_id LIKE 'pay\_wfg\_%' ESCAPE '\';
DELETE FROM strata.charge WHERE charge_id LIKE 'chg\_wfg\_%' ESCAPE '\';

INSERT INTO strata.charge (
  charge_id, organization_id, household_id, resident_id, payer_name,
  unit_id, floor_id, building_id, estate_id,
  unit_label_en, unit_label_zh_hant, scope_json,
  period, kind_en, kind_zh_hant, issued_on, due_on, amount_hkd, status, tone,
  staff_notes_en, staff_notes_zh_hant, invoice_number, scheduled_send_at, contact_email,
  line_kind_en, line_kind_zh_hant
)
SELECT
  v.charge_id, 'org_wingfu_holdings', v.household_id, v.resident_id, v.payer_name,
  v.unit_id, v.floor_id, v.building_id, 'est_wing_fu_garden',
  v.unit_en, v.unit_zh,
  json_build_object(
    'node', json_build_object(
      'kind', 'unit', 'id', v.unit_id,
      'label', json_build_object('en', v.unit_en, 'zh-Hant', v.unit_zh)
    ),
    'ancestry', json_build_array(
      json_build_object('kind', 'organization', 'id', 'org_wingfu_holdings',
        'label', json_build_object('en', 'Wing Fu Property Management', 'zh-Hant', '榮富物業管理')),
      json_build_object('kind', 'estate', 'id', 'est_wing_fu_garden',
        'label', json_build_object('en', 'Wing Fu Garden', 'zh-Hant', '榮富花園')),
      json_build_object('kind', 'building', 'id', v.building_id,
        'label', json_build_object('en', v.building_en, 'zh-Hant', v.building_zh)),
      json_build_object('kind', 'floor', 'id', v.floor_id,
        'label', json_build_object('en', v.floor_en, 'zh-Hant', v.floor_zh))
    )
  )::jsonb,
  v.period, 'Monthly management fee', '每月管理費',
  v.issued_on::date, v.due_on::date, v.amount_hkd, v.status, v.tone,
  v.notes_en, v.notes_zh,
  v.invoice_number, v.scheduled_send_at::timestamptz, v.contact_email,
  'Monthly management fee', '每月管理費'
FROM (VALUES
  ('chg_wfg_a1_202609', 'hh_wfg_a_12_a1', 'res_wfg_000412', 'Ho Mei-yi 何美儀',
   'unit_wfg_a_12_a1', 'fl_wfg_a_12', 'blk_wfg_a',
   'Flat A1', 'A1室', 'Block A', 'A座', '12/F', '12樓',
   '2026-09', '2026-09-01', '2026-09-30', 3280, 'due', 'information',
   'September statement — not yet paid.', '九月帳單 — 尚未繳付。',
   'INV-WFG-A1-202609', '2026-09-01T09:00:00+08:00', 'ho.meiyi@wingfu.example'),
  ('chg_wfg_b2_202609', 'hh_wfg_b_03_b2', 'res_wfg_000501', 'Tam Siu-fong 譚小芳',
   'unit_wfg_b_03_b2', 'fl_wfg_b_03', 'blk_wfg_b',
   'Flat B2', 'B2室', 'Block B', 'B座', '3/F', '3樓',
   '2026-09', '2026-09-01', '2026-09-30', 3150, 'partial', 'warning',
   'Octopus part-payment recorded on 10 Sep.', '9 月 10 日已錄八達通部分付款。',
   'INV-WFG-B2-202609', '2026-09-01T09:00:00+08:00', 'tam.siufong@wingfu.example'),
  ('chg_wfg_c3_202609', 'hh_wfg_c_08_c3', 'res_wfg_000908', 'Chan Ka-ming 陳家明',
   'unit_wfg_c_08_c3', 'fl_wfg_c_08', 'blk_wfg_c',
   'Flat C3', 'C3室', 'Block C', 'C座', '8/F', '8樓',
   '2026-09', '2026-09-01', '2026-09-30', 2980, 'due', 'information',
   NULL, NULL,
   'INV-WFG-C3-202609', '2026-09-01T09:00:00+08:00', 'chan.kaming@wingfu.example'),
  ('chg_wfg_a1_202608', 'hh_wfg_a_12_a1', 'res_wfg_000412', 'Ho Mei-yi 何美儀',
   'unit_wfg_a_12_a1', 'fl_wfg_a_12', 'blk_wfg_a',
   'Flat A1', 'A1室', 'Block A', 'A座', '12/F', '12樓',
   '2026-08', '2026-08-01', '2026-08-31', 3280, 'paid', 'normal',
   'Settled by FPS on 3 Aug.', '8 月 3 日已以轉數快結清。',
   'INV-WFG-A1-202608', '2026-08-01T09:00:00+08:00', 'ho.meiyi@wingfu.example'),
  ('chg_wfg_c3_202608', 'hh_wfg_c_08_c3', 'res_wfg_000908', 'Chan Ka-ming 陳家明',
   'unit_wfg_c_08_c3', 'fl_wfg_c_08', 'blk_wfg_c',
   'Flat C3', 'C3室', 'Block C', 'C座', '8/F', '8樓',
   '2026-08', '2026-08-01', '2026-08-31', 2980, 'overdue', 'warning',
   'August fee still open.', '八月費用仍未清。',
   'INV-WFG-C3-202608', '2026-08-01T09:00:00+08:00', 'chan.kaming@wingfu.example'),
  ('chg_wfg_a4_202607', 'hh_wfg_a_05_a4', 'res_wfg_a05_a4', 'Cheung Tak-wah 張德華',
   'unit_wfg_a_05_a4', 'fl_wfg_a_05', 'blk_wfg_a',
   'Flat A4', 'A4室', 'Block A', 'A座', '5/F', '5樓',
   '2026-07', '2026-07-01', '2026-07-31', 3100, 'paid', 'normal',
   'Last full month before occupancy ended.', '佔用結束前最後一個完整月份。',
   'INV-WFG-A4-202607', '2026-07-01T09:00:00+08:00', 'cheung.takwah@wingfu.example')
) AS v(
  charge_id, household_id, resident_id, payer_name,
  unit_id, floor_id, building_id,
  unit_en, unit_zh, building_en, building_zh, floor_en, floor_zh,
  period, issued_on, due_on, amount_hkd, status, tone,
  notes_en, notes_zh, invoice_number, scheduled_send_at, contact_email
);

INSERT INTO strata.payment (
  payment_id, organization_id, household_id, resident_id, payer_name,
  unit_id, floor_id, building_id, estate_id,
  unit_label_en, unit_label_zh_hant, scope_json,
  paid_on, method, amount_hkd, reference_en, reference_zh_hant,
  staff_notes_en, staff_notes_zh_hant
)
SELECT
  v.payment_id, 'org_wingfu_holdings', c.household_id, c.resident_id, c.payer_name,
  c.unit_id, c.floor_id, c.building_id, c.estate_id,
  c.unit_label_en, c.unit_label_zh_hant, c.scope_json,
  v.paid_on::date, v.method, v.amount_hkd, v.reference_en, v.reference_zh,
  v.notes_en, v.notes_zh
FROM (VALUES
  ('pay_wfg_r1001', 'chg_wfg_a1_202608', '2026-08-03', 'fps', 3280,
   'FPS stub · WFG-A1-0803', '轉數快 Stub · WFG-A1-0803',
   'Counter confirmed FPS reference. No live PSP.', '櫃檯已核對轉數快參考編號。並無即時付款服務。'),
  ('pay_wfg_r1004', 'chg_wfg_b2_202609', '2026-09-10', 'octopus', 1500,
   'Octopus stub · tap 19:12', '八達通 Stub · 19:12 拍卡',
   'Part-payment only. Balance stays on the September charge.', '僅部分付款。餘額仍掛於九月帳單。'),
  ('pay_wfg_r1003', 'chg_wfg_a4_202607', '2026-07-04', 'cash', 3100,
   'Cash stub · desk 2', '現金 Stub · 2 號櫃檯',
   NULL, NULL)
) AS v(payment_id, charge_id, paid_on, method, amount_hkd, reference_en, reference_zh, notes_en, notes_zh)
JOIN strata.charge c ON c.charge_id = v.charge_id;

INSERT INTO strata.payment_allocation (allocation_id, payment_id, charge_id, amount_hkd) VALUES
  ('alloc_wfg_r1001', 'pay_wfg_r1001', 'chg_wfg_a1_202608', 3280),
  ('alloc_wfg_r1004', 'pay_wfg_r1004', 'chg_wfg_b2_202609', 1500),
  ('alloc_wfg_r1003', 'pay_wfg_r1003', 'chg_wfg_a4_202607', 3100);
