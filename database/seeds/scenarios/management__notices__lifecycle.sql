-- THE WORLD THE NOTICES FIXTURES ARE BOUND TO (GEN-047 D3).
--
-- Hand-written, unlike the mob-s1 scenarios: those are GENERATED from a fixture,
-- because the fixture is the authority for a read surface. These fixtures are
-- RECORDED from real HTTP responses (tests/fixtures/record-notice-fixtures.mjs),
-- so the authority runs the other way — the world comes first and the responses
-- are whatever the routes actually returned against it.
--
-- WORLD INSTANT: 2026-09-03T09:00:00+08:00
--
-- What the notices lifecycle needs beyond the base seed: ONE resident occupying a
-- unit in Block A, so the audience resolver reaches somebody and the snapshot,
-- the acknowledgement acts and the outstanding list are not all trivially empty.
-- Everything else — the estate, the blocks, the staff principals and their grants
-- — is base-seed and is not restated here.

-- REPLACE rather than layer, the convention the other scenarios follow.
DELETE FROM resident.occupancy WHERE occupancy_id = 'occ_fx_notices';
DELETE FROM resident.resident  WHERE resident_id  = 'res_fx_notices';

INSERT INTO resident.resident (resident_id, organization_id, display_name)
VALUES ('res_fx_notices', 'org_wingfu_holdings', 'Fixture resident');

-- The unit is DERIVED, not named: the first residential unit in Block A, which is
-- how the recorder picks it. Naming one here and another there is how a fixture
-- and its world drift apart.
INSERT INTO resident.occupancy (
  assertion_id, version, occupancy_id, resident_id, unit_id,
  unit_class, role, status, source, effective_from
)
SELECT 'occa_fx_notices', 1, 'occ_fx_notices', 'res_fx_notices', u.unit_id,
       'residential', 'tenant', 'active', 'seed',
       TIMESTAMPTZ '2026-09-02T09:00:00+08:00'
  FROM property.unit u
  JOIN property.floor f ON f.floor_id = u.floor_id
 WHERE f.building_id = 'blk_wfg_a' AND u.unit_class = 'residential'
 ORDER BY u.unit_id
 LIMIT 1;
