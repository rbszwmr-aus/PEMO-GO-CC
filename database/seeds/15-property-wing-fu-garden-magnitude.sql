-- Wing Fu Garden at the magnitude the CORPUS describes, not a convenience sample.
--
-- WHY THIS FILE EXISTS.
--
-- API-020-ST reconciled the corpus and the seeded world at the level of
-- IDENTIFIERS. Nobody had reconciled them at the level of MAGNITUDE. The corpus
-- describes an estate of 812 units — stated three times, across two operations —
-- and 212 cases, and 268 households in Block A alone. The seed held 9 units in
-- this estate. Every aggregate in the corpus was unreproducible by construction.
--
-- The proof that the figures are COMPUTED rather than product content, since it
-- is the reason this file is 812 rows and not a label:
--
--   tests/fixtures/management-web/mob-s4-cases/empty.json returns `cases: []`
--   with `counts.all: 212`. An empty page reporting a non-zero total is only
--   possible if the count is over the WORLD, not over the returned rows.
--
-- A seed of 9 units was not merely small. It was a world in which "estate-wide"
-- and "one building" are nearly the same set — exactly the distinction the scope
-- model exists to express — so level-spanning, deduplication and aggregation
-- defects had nowhere to occur.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- THE BASIS. Two declared numbers per block; the total is their PRODUCT.
--
-- 812 is not typed anywhere below. It is what 8×35 + 7×22 + 9×42 comes to. A
-- total the seed COMPUTES is a total that cannot be quietly nudged to make a
-- fixture pass, which is the whole reason the corpus disagreed with the world
-- for this long without anyone noticing.
--
--   block   units/floor   floor range   floors kept   units
--     A          8           1–40           35         280
--     B          7           1–26           22         154
--     C          9           1–48           42         378
--                                                    ─────
--                                                      812
--
-- FLOOR NUMBERING omits 4, 13, 14 and every floor ending in 4 — ordinary Hong
-- Kong practice, and load-bearing rather than decorative: it makes floor ORDINAL
-- differ from floor COUNT, so any code conflating "the 20th floor" with "20
-- floors up" is wrong in a way this world can show. A contiguously numbered
-- block cannot expose that defect at all.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- DISTINCTNESS IS A TEST PROPERTY, NOT TIDINESS.
--
-- Every figure differs from every other, including across the basis: units per
-- floor (8/7/9) and floor counts (35/22/42) as well as totals (280/154/378). If
-- two blocks held the same number, A QUERY THAT RETURNED THE WRONG BLOCK WOULD
-- STILL RETURN THE RIGHT NUMBER.
--
-- The same reasoning extended one step further, and it is why the parking and
-- storage figures look arbitrary: no count here equals any UNRELATED figure in
-- the corpus (212 cases, 31 unknown-state, 14 open, 6 events, 3 overdue, 2
-- notices, 24 hours). A coincidence between unrelated quantities hides a wrong
-- JOIN exactly as sameness hides a wrong block.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHICH NUMBERS ARE FACTS AND WHICH ARE INVENTIONS.
--
-- Constrained by the corpus, load-bearing, do not change casually:
--   812 units in the estate; 3 blocks; 268 HOUSEHOLDS in Block A.
--
-- Invented, constrained only by the above and by the distinctness rule. These
-- are fixture-world choices, not facts about a real estate, and they are cheap
-- to revise:
--   the split of 812 into 280/154/378; the B and C household counts; every
--   vacancy figure; the parking and storage counts and their distribution.
--
-- 268 is a FLOOR on Block A's unit count, not its value: households are
-- occupancies, a vacant unit has none, and the two quantities are never aliased.
-- Block A therefore holds 280 units against its 268 households. Vacancy is
-- non-zero at every block, so a test that confuses units with households FAILS
-- somewhere rather than passing everywhere.
--
--   block   units   households   vacant
--     A      280       268         12
--     B      154       138         16
--     C      378       359         19
--   estate   812       765         47
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHERE PARKING AND STORAGE LIVE — a structural answer, not a preference.
--
-- `property.unit.floor_id` is NOT NULL and references `property.floor`. A Unit
-- CANNOT hang off a Location or an Estate. "Under the estate-level car-park
-- Location" is not representable without a migration, so the question is only
-- WHICH floors, and the answer is each block's G/F.
--
-- `loc_wfg_carpark` remains an ESTATE-level Location and is untouched: it names
-- the PLACE. The Units are the SPACES. Those are different objects and the model
-- already separates them.
--
-- Spread across all three blocks with distinct counts, deliberately: an
-- aggregate that forgets to filter by `unit_class` is then wrong at EVERY block
-- rather than only at the one that happens to hold the car park. Concentrating
-- them in Block A would have hidden the missing filter for B and C.
--
--   block   parking   storage   UNFILTERED total (the wrong answer, made distinct)
--     A       118        17            415
--     B        52        11            217
--     C        66        13            457
--   estate    236        41           1089
--
-- 812 IS THE RESIDENTIAL COUNT. Parking and storage are held and counted
-- separately, per the ruling on unit_class: Hong Kong practice counts an estate's
-- units as flats and states parking separately, and the display string is derived
-- from the per-class breakdown rather than from one scalar whose meaning has to
-- be remembered.

BEGIN;

-- The basis, declared ONCE. Everything below is derived from this table; nothing
-- downstream repeats a magnitude.
CREATE TEMPORARY TABLE block_basis (
  building_id     text PRIMARY KEY,
  code            text NOT NULL,
  units_per_floor int  NOT NULL,
  top_floor       int  NOT NULL,
  parking         int  NOT NULL,
  storage         int  NOT NULL
) ON COMMIT DROP;

INSERT INTO block_basis VALUES
  ('blk_wfg_a', 'a', 8, 40, 118, 17),
  ('blk_wfg_b', 'b', 7, 26,  52, 11),
  ('blk_wfg_c', 'c', 9, 48,  66, 13);

-- Hong Kong floor omission, expressed once as a predicate rather than as a list,
-- so the rule is auditable and a changed top floor cannot desynchronise it.
CREATE TEMPORARY VIEW residential_floor AS
SELECT b.building_id, b.code, b.units_per_floor, n AS ordinal
FROM block_basis b
CROSS JOIN LATERAL generate_series(1, b.top_floor) AS n
WHERE n % 10 <> 4 AND n NOT IN (13, 14);

-- Floors. G/F already exists for Block A and is added for B and C: it carries the
-- non-residential classes and is NOT a residential floor, so it never enters the
-- per-floor product above.
INSERT INTO property.floor (floor_id, building_id, label, ordinal, sequence)
SELECT format('fl_wfg_%s_gf', code), building_id, 'G/F', 0, 0 FROM block_basis
ON CONFLICT DO NOTHING;

INSERT INTO property.floor (floor_id, building_id, label, ordinal, sequence)
SELECT format('fl_wfg_%s_%s', code, lpad(ordinal::text, 2, '0')),
       building_id,
       ordinal || '/F',
       ordinal,
       ordinal
FROM residential_floor
ON CONFLICT DO NOTHING;

-- Residential units. `ON CONFLICT DO NOTHING` against (floor_id, label) is what
-- preserves the fixture-named units already seeded — unit_wfg_a_12_a1,
-- unit_wfg_b_03_b2 and unit_wfg_c_08_c3 keep their exact identifiers rather than
-- being replaced by a generated twin with the same address.
INSERT INTO property.unit (unit_id, floor_id, unit_class, label, sequence)
-- Identifiers are LOWER CASE, matching the pinned units (unit_wfg_a_12_a1).
-- Labels stay upper case, matching theirs (A1). The generator got this wrong
-- first time and produced unit_wfg_a_01_A2 — a scheme that differs from the
-- pinned units in a way nothing would have failed on until somebody compared two
-- identifiers by string.
SELECT format('unit_wfg_%s_%s_%s%s', f.code, lpad(f.ordinal::text, 2, '0'), f.code, u),
       format('fl_wfg_%s_%s', f.code, lpad(f.ordinal::text, 2, '0')),
       'residential',
       format('%s%s', upper(f.code), u),
       u
FROM residential_floor f
CROSS JOIN LATERAL generate_series(1, f.units_per_floor) AS u
ON CONFLICT DO NOTHING;

-- Parking and storage.
--
-- ABSORBING THE TWO UNITS THAT WERE ALREADY HERE, rather than adding to them.
-- `unit_wfg_cp_p101` and `unit_wfg_st_s021` are load-bearing: a seeded resident
-- HOLDS them as occupancies, and property-model.test.ts asserts by identifier
-- that a parking unit is excluded from residential lookups and from the unit
-- switcher. Those assertions are worth more than tidy numbering, so both units
-- keep their identifiers, labels and external references untouched.
--
-- Naive generation would have got this wrong in two OPPOSITE directions, which is
-- why it is done by picking free numbers rather than by counting:
--
--   P101 falls INSIDE a 1..118 series, so it would collide and be skipped —
--        generating 118 and landing on 118 only by luck.
--   S21  falls OUTSIDE a 1..17 series AND is written to a different width, so it
--        would never collide — generating 17 and landing on 18.
--
-- So: enumerate candidate labels, exclude any already present on that G/F, and
-- take the first (target − existing). Self-correcting whatever is already there,
-- and the count assertions in tests/integration/seed-basis.test.ts fail loudly if
-- it ever is not.
WITH wanted AS (
  SELECT building_id, code, 'parking'::text AS unit_class, parking AS target, 'P' AS prefix, 'cp' AS slug
  FROM block_basis
  UNION ALL
  SELECT building_id, code, 'storage', storage, 'S', 'st' FROM block_basis
),
already AS (
  SELECT w.code, w.unit_class, count(u.unit_id) AS n
  FROM wanted w
  LEFT JOIN property.unit u
    ON u.floor_id = format('fl_wfg_%s_gf', w.code) AND u.unit_class = w.unit_class
  GROUP BY 1, 2
),
free AS (
  SELECT w.*,
         format('%s%s', w.prefix, lpad(n::text, 3, '0')) AS label,
         row_number() OVER (PARTITION BY w.code, w.unit_class ORDER BY n) AS rn
  FROM wanted w
  CROSS JOIN LATERAL generate_series(1, w.target + 64) AS n
  WHERE NOT EXISTS (
    SELECT 1 FROM property.unit u
    WHERE u.floor_id = format('fl_wfg_%s_gf', w.code)
      AND u.label = format('%s%s', w.prefix, lpad(n::text, 3, '0'))
  )
)
INSERT INTO property.unit (unit_id, floor_id, unit_class, label, sequence)
SELECT format('unit_wfg_%s_%s_%s', f.code, f.slug, lower(f.label)),
       format('fl_wfg_%s_gf', f.code),
       f.unit_class,
       f.label,
       (regexp_match(f.label, '([0-9]+)$'))[1]::integer
FROM free f
JOIN already a ON a.code = f.code AND a.unit_class = f.unit_class
WHERE f.rn <= f.target - a.n
ON CONFLICT DO NOTHING;

-- sequence is load-bearing for tree order. Re-state it from the basis so a
-- row that arrived via ON CONFLICT DO NOTHING (the pinned identifiers) is not
-- left at the column default.
UPDATE property.floor SET sequence = ordinal
 WHERE building_id IN (SELECT building_id FROM block_basis);
UPDATE property.building SET sequence = CASE building_id
  WHEN 'blk_wfg_a' THEN 1
  WHEN 'blk_wfg_b' THEN 2
  WHEN 'blk_wfg_c' THEN 3
  ELSE sequence END
 WHERE building_id IN (SELECT building_id FROM block_basis);
UPDATE property.estate SET sequence = 1 WHERE estate_id = 'est_wing_fu_garden';
UPDATE property.unit u
   SET sequence = COALESCE((regexp_match(u.label, '([0-9]+)$'))[1]::integer, u.sequence)
  FROM property.floor f
 WHERE u.floor_id = f.floor_id
   AND f.building_id IN (SELECT building_id FROM block_basis);

COMMIT;
