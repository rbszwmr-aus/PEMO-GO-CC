-- The party/interest demonstration seed — ADR-011, GEN-029-ST Task 3.
--
-- THIS SEED IS THE ACCEPTANCE TEST FOR D7. Interest and occupancy are separate
-- facts, and the seed is where that either holds or is quietly false. It seeds the
-- four ownership shapes the product has never been able to represent, plus the
-- joint-ownership case that proves the exclusion key, plus the vacant-unit case
-- that is the cleanest possible proof interest does not depend on occupancy.
--
-- ── DECLARED BASIS (computed totals, not chosen ones) ─────────────────────────
--
-- One instance of each shape, EXCEPT two counts that are not free choices:
--   Novatek's FIVE units — mandated by D7 ("five flats for staff");
--   joint ownership's TWO parties — structural (a joint pair is two).
--
--   shape                       parties   interests
--   1 owner-occupier                 1         1 (ownership)
--   2 landlord (no occupancy)        1         1 (ownership)
--   3 individual tenant              1         1 (tenancy)   -- shares unit with 2
--   4 corporate tenant (Novatek)     1         5 (tenancy)
--   5 corporate owner                1         1 (ownership)
--   6 joint ownership                2         2 (ownership)
--   * vacant-unit owner (discrim.)   1         1 (ownership)
--                                 ─────      ────────
--   TOTAL                            8        12
--
-- 8 parties and 12 interests are the DECLARED totals; both were checked against
-- the corpus and collide with nothing. The per-kind split (6 ownership, 6 tenancy)
-- falls out of the shapes and is not an independent choice — a query returning 6
-- ownership interests is counting ownership interests, which is what it should.
-- The mandated 5 (Novatek) and structural 2 (joint) coincide with corpus figures
-- but are required by the shape, not invented.
--
-- ── MAGNITUDES ARE NOT PERTURBED ──────────────────────────────────────────────
-- Interests and parties are ADDITIVE rows against units and households that
-- already exist. NO household is added. 812 residential + 236 parking + 41 storage
-- units, 765 households, 47 vacant — unchanged, asserted by the test.
--
-- ── EVERY ROW IS A BOOTSTRAP EVENT, NOT A PRINCIPAL'S ACT ──────────────────────
-- These facts are learned at estate onboarding by BULK IMPORT. There was no acting
-- principal — there was a provisioning act (ADR-010 Open question 1: the bootstrap
-- is an event, not a role). So source = 'bulk_import' and recorded_by is honestly
-- NULL on every row. NO placeholder principal, ever — a fiction is worse than a
-- null, because a null is legible and a fiction is not. recorded_at is the
-- onboarding date, stated (R7), not now().
--
-- ── THE occupancy.role QUESTION (GEN-029-ST carried item) ─────────────────────
-- The Novatek employees occupy 5 units their EMPLOYER holds the tenancy on. This
-- seed does NOT add occupancy rows for them, and the reason is the finding: the
-- shipped occupancy.role enum is NOT NULL over {owner_occupier, tenant,
-- household_member, caregiver}, and NONE of the four expresses "occupies because
-- their employer holds the corporate tenancy". They are not owner_occupier; not
-- tenant (the COMPANY is the tenant); not caregiver; and household_member
-- describes their relation to a household, not their BASIS for being in the unit.
-- Forcing one would seed a defect wearing a valid value, which the ruling forbids.
-- The households already exist on the units (occupancy at the household level, per
-- D7: "a household belongs to a unit"); Novatek holds the tenancy; the households
-- hold no interest. That is D7, without mis-attributing a role.

BEGIN;

-- Idempotent: clear this seed's own rows first (demonstration prefix).
DELETE FROM resident.interest WHERE interest_id LIKE 'int_demo_%';
DELETE FROM resident.party    WHERE party_id    LIKE 'pty_demo_%';

-- Parties. bulk_import, recorded_by NULL (bootstrap event), recorded_at stated.
INSERT INTO resident.party
  (party_id, organization_id, kind, display_name, source, external_system, external_reference, recorded_by, recorded_at)
VALUES
  ('pty_demo_owner_occ',  'org_wingfu_holdings', 'natural_person', 'Chan Tai-man 陳大文',        'bulk_import', NULL, NULL, NULL, '2024-01-01T00:00:00+08:00'),
  ('pty_demo_landlord',   'org_wingfu_holdings', 'natural_person', 'Lee Ka-fai 李家輝',          'bulk_import', NULL, NULL, NULL, '2024-01-01T00:00:00+08:00'),
  ('pty_demo_tenant',     'org_wingfu_holdings', 'natural_person', 'Wong Mei-ling 黃美玲',        'bulk_import', NULL, NULL, NULL, '2024-01-01T00:00:00+08:00'),
  ('pty_demo_novatek',    'org_wingfu_holdings', 'legal_person',   'Novatek Ltd 諾域科技有限公司', 'bulk_import', NULL, NULL, NULL, '2024-01-01T00:00:00+08:00'),
  ('pty_demo_corp_owner', 'org_wingfu_holdings', 'legal_person',   'Harbour Estates Ltd 海港置業有限公司', 'bulk_import', NULL, NULL, NULL, '2024-01-01T00:00:00+08:00'),
  ('pty_demo_joint_a',    'org_wingfu_holdings', 'natural_person', 'Cheung Wai 張偉',             'bulk_import', NULL, NULL, NULL, '2024-01-01T00:00:00+08:00'),
  ('pty_demo_joint_b',    'org_wingfu_holdings', 'natural_person', 'Cheung Ka-yan 張嘉欣',        'bulk_import', NULL, NULL, NULL, '2024-01-01T00:00:00+08:00'),
  ('pty_demo_vacant_own', 'org_wingfu_holdings', 'natural_person', 'Ng Chi-keung 吳志強',         'bulk_import', NULL, NULL, NULL, '2024-01-01T00:00:00+08:00');

-- Interests. Same provenance shape. effective_from = onboarding; open-ended.
INSERT INTO resident.interest
  (interest_id, party_id, unit_id, kind, effective_from, effective_to, source, external_system, external_reference, recorded_by, recorded_at)
VALUES
  -- 1) Owner-occupier: ownership on an OCCUPIED unit, no tenancy. The owner occupies.
  ('int_demo_owner_occ', 'pty_demo_owner_occ', 'unit_wfg_a_01_a1', 'ownership', '2024-01-01T00:00:00+08:00', NULL, 'bulk_import', NULL, NULL, NULL, '2024-01-01T00:00:00+08:00'),

  -- 2 + 3) Landlord (owns, does not occupy) AND individual tenant (rents, occupies),
  -- on ONE unit. Ownership and tenancy coexisting is the landlord/tenant case.
  ('int_demo_landlord',  'pty_demo_landlord',  'unit_wfg_a_01_a2', 'ownership', '2024-01-01T00:00:00+08:00', NULL, 'bulk_import', NULL, NULL, NULL, '2024-01-01T00:00:00+08:00'),
  ('int_demo_tenant',    'pty_demo_tenant',    'unit_wfg_a_01_a2', 'tenancy',   '2024-01-01T00:00:00+08:00', NULL, 'bulk_import', NULL, NULL, NULL, '2024-01-01T00:00:00+08:00'),

  -- 4) Corporate tenant: ONE legal person, FIVE tenancy interests on five OCCUPIED
  -- units. The households (employees) occupy and hold NO interest — occupancy
  -- without interest, at scale. The Novatek case.
  ('int_demo_novatek_1', 'pty_demo_novatek', 'unit_wfg_a_01_a3', 'tenancy', '2024-01-01T00:00:00+08:00', NULL, 'bulk_import', NULL, NULL, NULL, '2024-01-01T00:00:00+08:00'),
  ('int_demo_novatek_2', 'pty_demo_novatek', 'unit_wfg_a_01_a4', 'tenancy', '2024-01-01T00:00:00+08:00', NULL, 'bulk_import', NULL, NULL, NULL, '2024-01-01T00:00:00+08:00'),
  ('int_demo_novatek_3', 'pty_demo_novatek', 'unit_wfg_a_01_a5', 'tenancy', '2024-01-01T00:00:00+08:00', NULL, 'bulk_import', NULL, NULL, NULL, '2024-01-01T00:00:00+08:00'),
  ('int_demo_novatek_4', 'pty_demo_novatek', 'unit_wfg_a_01_a6', 'tenancy', '2024-01-01T00:00:00+08:00', NULL, 'bulk_import', NULL, NULL, NULL, '2024-01-01T00:00:00+08:00'),
  ('int_demo_novatek_5', 'pty_demo_novatek', 'unit_wfg_a_01_a7', 'tenancy', '2024-01-01T00:00:00+08:00', NULL, 'bulk_import', NULL, NULL, NULL, '2024-01-01T00:00:00+08:00'),

  -- 5) Corporate owner: a legal person on the ownership side.
  ('int_demo_corp_owner', 'pty_demo_corp_owner', 'unit_wfg_a_01_a8', 'ownership', '2024-01-01T00:00:00+08:00', NULL, 'bulk_import', NULL, NULL, NULL, '2024-01-01T00:00:00+08:00'),

  -- 6) Joint ownership: two parties, ONE unit, overlapping ranges. Proves the
  -- exclusion key is (party, unit, kind), not (unit, kind).
  ('int_demo_joint_a', 'pty_demo_joint_a', 'unit_wfg_b_03_b2', 'ownership', '2024-01-01T00:00:00+08:00', NULL, 'bulk_import', NULL, NULL, NULL, '2024-01-01T00:00:00+08:00'),
  ('int_demo_joint_b', 'pty_demo_joint_b', 'unit_wfg_b_03_b2', 'ownership', '2024-01-01T00:00:00+08:00', NULL, 'bulk_import', NULL, NULL, NULL, '2024-01-01T00:00:00+08:00'),

  -- *) THE DISCRIMINATOR: ownership on a VACANT unit — no household at all. A
  -- vacant unit still has an owner. Interest without occupancy, in its cleanest
  -- form, the way an empty page with a non-zero total was for facet counts.
  ('int_demo_vacant', 'pty_demo_vacant_own', 'unit_wfg_a_39_a5', 'ownership', '2024-01-01T00:00:00+08:00', NULL, 'bulk_import', NULL, NULL, NULL, '2024-01-01T00:00:00+08:00');

COMMIT;
