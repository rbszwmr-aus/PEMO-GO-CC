-- Households, and the VACANCY that keeps them from being an alias for units.
--
-- A household is an OCCUPANCY of a unit. A vacant unit has none. The corpus uses
-- both words and never relates them — an estate summary counts UNITS, a
-- notification scope counts HOUSEHOLDS, and both are correct because you notify
-- occupancies rather than addresses.
--
-- SO THE SEED MUST MAKE THE TWO NUMBERS DIFFER. If every unit held a household,
-- every test that confused the two would pass, and the distinction would be
-- carried by nothing in the world. Vacancy is non-zero at EVERY block for that
-- reason, and the three figures differ from each other so a wrong block cannot
-- return a right number:
--
--   block   units   households   vacant
--     A      280       268         12      ← 268 is corpus-stated; 280 follows
--     B      154       138         16
--     C      378       359         19
--   estate   812       765         47
--
-- Only 268 is a fact taken from the corpus. Every other figure here is an
-- invention constrained by it, and cheap to revise.
--
-- WHICH units are vacant is deterministic rather than arbitrary: the LAST units
-- by floor and label — the top floors' highest-lettered flats. Realistic for a
-- Hong Kong estate, and it keeps the vacancy away from the low-floor units the
-- corpus names, so no fixture depends on a unit that quietly emptied.

BEGIN;

CREATE TEMPORARY TABLE household_basis (
  code       text PRIMARY KEY,
  households int  NOT NULL
) ON COMMIT DROP;

INSERT INTO household_basis VALUES ('a', 268), ('b', 138), ('c', 359);

-- Occupied units are the FIRST n by (floor ordinal, label). The complement is the
-- vacancy, so the two are defined once and cannot drift apart.
WITH ranked AS (
  SELECT u.unit_id,
         substring(f.floor_id from 'fl_wfg_(.)_') AS code,
         f.ordinal,
         u.label,
         row_number() OVER (
           PARTITION BY substring(f.floor_id from 'fl_wfg_(.)_')
           ORDER BY f.ordinal, u.label
         ) AS rn
  FROM property.unit u
  JOIN property.floor f ON f.floor_id = u.floor_id
  WHERE u.unit_class = 'residential'
    AND f.building_id LIKE 'blk_wfg_%'
)
INSERT INTO resident.household (household_id, organization_id, unit_id)
SELECT format('hh_wfg_%s_%s_%s', r.code, lpad(r.ordinal::text, 2, '0'), lower(r.label)),
       'org_wingfu_holdings',
       r.unit_id
FROM ranked r
JOIN household_basis h ON h.code = r.code
WHERE r.rn <= h.households
-- The two households seeded by 30-residents-households.sql carry memberships,
-- occupancies and notification preferences. Their generated identifiers are
-- byte-identical to the ones already there — hh_wfg_a_12_a1, hh_wfg_c_08_c3 —
-- so they are absorbed rather than duplicated, and every membership pointing at
-- them survives untouched.
ON CONFLICT (household_id) DO NOTHING;

-- Finance fixture contacts (management-web ChargeRow.contactEmail). Generated
-- ids for B2 / A4 match the bulk format; A4's UI fixture uses a `_ended`
-- suffix that is not a DB id.
UPDATE resident.household AS h
SET contact_email = v.contact_email
FROM (VALUES
  ('hh_wfg_a_12_a1', 'ho.meiyi@wingfu.example'),
  ('hh_wfg_b_03_b2', 'tam.siufong@wingfu.example'),
  ('hh_wfg_c_08_c3', 'chan.kaming@wingfu.example'),
  ('hh_wfg_a_05_a4', 'cheung.takwah@wingfu.example')
) AS v(household_id, contact_email)
WHERE h.household_id = v.household_id;

COMMIT;
