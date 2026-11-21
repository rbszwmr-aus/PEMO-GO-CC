-- Residents, households, occupancy and the development login stub.
--
-- Resident business identity is SEPARATE from login identity. The login subject
-- lives in platform.dev_login_identity — another module's schema, referenced by a
-- stable identifier with no foreign key — so the separation is structural rather
-- than a convention someone could quietly drop.

-- Scenario overlays (database/seeds/scenarios/) replace occupancy rows for the
-- account screen and mark them source = 'scenario'. Clearing them here keeps the
-- base seed idempotent, so re-seeding returns the world to a known state rather
-- than layering one scenario on top of another.
DELETE FROM resident.occupancy WHERE source = 'scenario';

INSERT INTO resident.resident (resident_id, organization_id, display_name, preferred_language) VALUES
  ('res_wfg_000412', 'org_wingfu_holdings',  'Ho Mei-yi 何美儀', 'en'),
  ('res_wfg_000908', 'org_wingfu_holdings',  'Chan Ka-ming 陳家明', 'en'),
  -- A caregiver whose scope has ENDED. Seeded expired on purpose: the
  -- caregiver-permission-expired case is a real authorization outcome, not a
  -- fault to inject.
  ('res_wfg_000733', 'org_wingfu_holdings',  'Lam Siu-fung 林小鳳', 'en'),
  -- Organization B. Same shape, different tenancy root.
  ('res_hbv_000777', 'org_harbour_property', 'Wong Chi-hang 黃志恆', 'en'),
  -- A resident with NO active residential relationship. Seeded because
  -- "not authorized" is an authorization outcome that must be reachable through
  -- real behaviour: the 403 fixtures are served by asking as this resident, not
  -- by injecting a fault.
  ('res_wfg_000001', 'org_wingfu_holdings',  'Test No-Access Resident', 'en')
ON CONFLICT (resident_id) DO NOTHING;

INSERT INTO resident.household (household_id, organization_id, unit_id, contact_email) VALUES
  ('hh_wfg_a_12_a1', 'org_wingfu_holdings',  'unit_wfg_a_12_a1', 'ho.meiyi@wingfu.example'),
  ('hh_wfg_c_08_c3', 'org_wingfu_holdings',  'unit_wfg_c_08_c3', 'chan.kaming@wingfu.example'),
  ('hh_hbv_b_05_b2', 'org_harbour_property', 'unit_hbv_b_05_b2', NULL)
ON CONFLICT (household_id) DO NOTHING;

-- Re-seed after 0142: named Wing Fu households match finance fixture contactEmail.
UPDATE resident.household SET contact_email = 'ho.meiyi@wingfu.example'
  WHERE household_id = 'hh_wfg_a_12_a1';
UPDATE resident.household SET contact_email = 'chan.kaming@wingfu.example'
  WHERE household_id = 'hh_wfg_c_08_c3';

INSERT INTO resident.household_membership
  (membership_id, household_id, resident_id, role, effective_from, effective_to)
VALUES
  ('mem_412_a12a1', 'hh_wfg_a_12_a1', 'res_wfg_000412', 'owner_occupier',   '2020-01-01T00:00:00+08:00', NULL),
  ('mem_412_c08c3', 'hh_wfg_c_08_c3', 'res_wfg_000412', 'household_member', '2023-06-01T00:00:00+08:00', NULL),
  ('mem_908_a12a1', 'hh_wfg_a_12_a1', 'res_wfg_000908', 'household_member', '2021-03-01T00:00:00+08:00', NULL),
  ('mem_733_a12a1', 'hh_wfg_a_12_a1', 'res_wfg_000733', 'caregiver',        '2026-01-01T00:00:00+08:00', '2026-08-12T00:00:00+08:00'),
  ('mem_777_b05b2', 'hh_hbv_b_05_b2', 'res_hbv_000777', 'owner_occupier',   '2022-05-01T00:00:00+08:00', NULL)
ON CONFLICT (membership_id) DO NOTHING;

-- Occupancy. Effective-dated, and evaluated at the OPERATION TIME on every read.
INSERT INTO resident.occupancy
  (occupancy_id, resident_id, household_id, unit_id, unit_class, role, status, source, effective_from, effective_to)
VALUES
  ('occ_412_a12a1', 'res_wfg_000412', 'hh_wfg_a_12_a1', 'unit_wfg_a_12_a1', 'residential', 'owner_occupier',   'active', 'seed', '2020-01-01T00:00:00+08:00', NULL),
  ('occ_412_c08c3', 'res_wfg_000412', 'hh_wfg_c_08_c3', 'unit_wfg_c_08_c3', 'residential', 'household_member', 'active', 'seed', '2023-06-01T00:00:00+08:00', NULL),

  -- A parking space and a store held by the same resident. These are property
  -- records. They must NEVER appear as a second home: not in unit context, not in
  -- the unit switcher, and not in safety audience resolution.
  ('occ_412_p101',  'res_wfg_000412', 'hh_wfg_a_12_a1', 'unit_wfg_cp_p101', 'parking',     'owner_occupier',   'active', 'seed', '2020-01-01T00:00:00+08:00', NULL),
  ('occ_412_s021',  'res_wfg_000412', 'hh_wfg_a_12_a1', 'unit_wfg_st_s021', 'storage',     'owner_occupier',   'active', 'seed', '2020-01-01T00:00:00+08:00', NULL),

  ('occ_908_a12a1', 'res_wfg_000908', 'hh_wfg_a_12_a1', 'unit_wfg_a_12_a1', 'residential', 'household_member', 'active', 'seed', '2021-03-01T00:00:00+08:00', NULL),

  -- EXPIRED caregiver scope. Ends 12 August 2026; every read after that instant
  -- must refuse, and the resident is told when it ended rather than merely refused.
  ('occ_733_a12a1', 'res_wfg_000733', 'hh_wfg_a_12_a1', 'unit_wfg_a_12_a1', 'residential', 'caregiver',        'active', 'seed', '2026-01-01T00:00:00+08:00', '2026-08-12T00:00:00+08:00'),

  ('occ_777_b05b2', 'res_hbv_000777', 'hh_hbv_b_05_b2', 'unit_hbv_b_05_b2', 'residential', 'owner_occupier',   'active', 'seed', '2022-05-01T00:00:00+08:00', NULL)
-- (occupancy_id, version), not (occupancy_id): ADR-013 made occupancy_id the
-- INSTANCE identity, so it is no longer unique on its own — many assertions share
-- it. These seed rows are each an instance's FIRST assertion, so version defaults
-- to 1 and the idempotency this clause provides is unchanged.
ON CONFLICT (occupancy_id, version) DO NOTHING;

-- Notification preferences. Critical safety is locked ON, with a server-supplied
-- reason: the design requires the control to be SHOWN locked rather than hidden,
-- and the database refuses a locked row with no reason.
INSERT INTO resident.notification_preference
  (resident_id, preference_key, label_en, label_zh_hant, description_en, description_zh_hant,
   enabled, locked, lock_reason_en, lock_reason_zh_hant, channels, sort_order)
VALUES
  ('res_wfg_000412', 'critical_safety', 'Critical safety alerts', '緊急安全警報',
   'Fire, gas and other life-safety alerts for your home.', '您居所的火警、氣體及其他生命安全警報。',
   true, true, 'Critical safety alerts cannot be turned off.', '緊急安全警報不能關閉。',
   ARRAY['in_app','push']::text[], 0),
  ('res_wfg_000412', 'notices_and_advisories', 'Notices and advisories', '通告及提示',
   'Estate notices, water and lift interruptions.', '屋苑通告、食水及升降機服務中斷。',
   true, false, NULL, NULL, ARRAY['in_app','push']::text[], 1),
  ('res_wfg_000412', 'case_replies', 'Replies to your enquiries', '查詢回覆',
   'Replies from the management office to your enquiries.', '管理處對您查詢的回覆。',
   true, false, NULL, NULL, ARRAY['in_app']::text[], 2)
ON CONFLICT DO NOTHING;

INSERT INTO resident.resident_pass (resident_id, pass_reference, carries_access, note_en, note_zh_hant) VALUES
  ('res_wfg_000412', 'RP-000412', false,
   'Show this at the management counter for identification. It does not open any door.',
   '請於管理處櫃檯出示以作身份識別。此通行證不能開啟任何門禁。'),
  ('res_hbv_000777', 'RP-000777', false,
   'Show this at the management counter for identification. It does not open any door.',
   '請於管理處櫃檯出示以作身份識別。此通行證不能開啟任何門禁。')
ON CONFLICT (resident_id) DO NOTHING;

-- DEVELOPMENT-ONLY login subjects. Not credentials: the stub signs a token over a
-- local secret and performs no OIDC, no JWKS, no refresh and no revocation.
INSERT INTO platform.dev_login_identity (subject, resident_id) VALUES
  ('dev|ho.mei.yi',     'res_wfg_000412'),
  ('dev|no.access',     'res_wfg_000001'),
  ('dev|chan.ka.ming',  'res_wfg_000908'),
  ('dev|lam.siu.fung',  'res_wfg_000733'),
  ('dev|wong.chi.hang', 'res_hbv_000777')
ON CONFLICT (subject) DO NOTHING;
