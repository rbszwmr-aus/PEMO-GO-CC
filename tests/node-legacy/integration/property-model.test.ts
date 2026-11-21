/**
 * The property model (ADR-002 and ADR-003).
 *
 * Every item here is an automated check rather than a review item, because each
 * one is a case where getting it wrong is invisible until a resident is either
 * notified about somewhere they do not live, or not notified about somewhere they
 * do.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

let harness: Harness;
test.before(async () => {
  harness = await startHarness();
});
test.after(async () => {
  await harness.close();
});

test('all four optional-tier combinations resolve', async () => {
  // Two optional tiers — Portfolio and Phase — means four combinations, and all
  // four are real: a single-customer deployment uses the bottom-right one and the
  // hierarchy reads exactly as it did before ADR-002.
  const rows = await harness.admin.query<{
    unit_id: string;
    portfolio_id: string | null;
    phase_id: string | null;
  }>(
    `SELECT u.unit_id, e.portfolio_id, b.phase_id
       FROM property.unit u
       JOIN property.floor f    ON f.floor_id = u.floor_id
       JOIN property.building b ON b.building_id = f.building_id
       JOIN property.estate e   ON e.estate_id = b.estate_id
      WHERE u.unit_id IN ('unit_wfg_a_12_a1', 'unit_wfg_c_08_c3', 'unit_twc_1_05_a', 'unit_twc_2_05_a')`,
  );

  const shape = (unitId: string): string => {
    const row = rows.find((r) => r.unit_id === unitId);
    assert.ok(row, `${unitId} missing`);
    return `${row.portfolio_id === null ? 'no-portfolio' : 'portfolio'}/${row.phase_id === null ? 'no-phase' : 'phase'}`;
  };

  assert.equal(shape('unit_wfg_a_12_a1'), 'portfolio/phase');
  assert.equal(shape('unit_wfg_c_08_c3'), 'portfolio/no-phase');
  assert.equal(shape('unit_twc_1_05_a'), 'no-portfolio/phase');
  assert.equal(shape('unit_twc_2_05_a'), 'no-portfolio/no-phase');

  // And all four are readable through the API, not merely present in the database.
  for (const unitId of ['unit_wfg_a_12_a1', 'unit_wfg_c_08_c3']) {
    const unit = await harness.modules.units.getResidentialUnit(
      { organizationId: 'org_wingfu_holdings' },
      unitId,
    );
    assert.ok(unit, `${unitId} is not readable`);
  }
});

test('a building cannot belong to a phase of a different estate', async () => {
  // The subtle version of the MAJOR-003 rule: not "does the building have a
  // phase?" but "is that phase even in this building's estate?". A composite
  // foreign key makes the wrong answer impossible rather than unlikely.
  await assert.rejects(
    harness.admin.query(
      `INSERT INTO property.building (building_id, estate_id, phase_id, name_en, name_zh_hant)
       VALUES ('blk_wrong_phase', 'est_tsz_wan_court', 'ph_wfg_1', 'Wrong', '錯誤')`,
    ),
    /building_phase_belongs_to_same_estate/,
  );
});

test('a location created without a serving scope is rejected', async () => {
  // Not defaulted to the physical parent. An implicit default is exactly how a
  // clubhouse ends up notifying only the block it happens to sit in.
  await assert.rejects(
    harness.modules.locations.createLocation({
      locationId: 'loc_no_scope',
      organizationId: 'org_wingfu_holdings',
      estateId: 'est_wing_fu_garden',
      locationClass: 'common_area',
      physicalParentType: 'building',
      physicalParentId: 'blk_wfg_a',
      name: { en: 'No scope', 'zh-Hant': '沒有服務範圍' },
      servingScope: [],
    }),
    /serving scope/i,
  );

  // And the database refuses it too, for a writer that bypasses the command.
  await assert.rejects(
    harness.admin.query(
      `INSERT INTO property.location
         (location_id, organization_id, estate_id, location_class, physical_parent_type,
          physical_parent_id, name_en, name_zh_hant)
       VALUES ('loc_no_scope_raw', 'org_wingfu_holdings', 'est_wing_fu_garden', 'common_area',
               'building', 'blk_wfg_a', 'No scope', '沒有服務範圍')`,
    ),
    /has no serving scope/,
  );
});

test('a serving scope wider than the physical parent resolves the wider audience', async () => {
  // The clubhouse: physically in Block C, serving the whole estate. If serving
  // scope defaulted to the parent, Phase 1 residents who never enter Block C would
  // silently not be told.
  const scope = { organizationId: 'org_wingfu_holdings' };

  const clubhouse = await harness.modules.servingScope.getLocation(scope, 'loc_wfg_clubhouse');
  assert.equal(clubhouse?.physicalParentId, 'blk_wfg_c');

  const served = await harness.modules.servingScope.resolveServedUnits(scope, 'loc_wfg_clubhouse');
  assert.ok(served.includes('unit_wfg_a_12_a1'), 'a Block A resident must be in the clubhouse audience');
  assert.ok(served.includes('unit_wfg_c_08_c3'), 'a Block C resident must be in the clubhouse audience');

  // The lobby, by contrast, serves its own block only.
  const lobby = await harness.modules.servingScope.resolveServedUnits(scope, 'loc_wfg_block_a_lobby');
  assert.ok(lobby.includes('unit_wfg_a_12_a1'));
  assert.ok(!lobby.includes('unit_wfg_c_08_c3'), 'a Block C resident is not in Block A lobby audience');
});

test('a lift serving a partial set of floors reaches exactly those floors', async () => {
  // "Lift 3 is out of service" must reach the residents whose floors it serves and
  // nobody else. Notifying a whole block about a lift they never use is how
  // residents learn to ignore PEMO notifications — which then degrades the safety
  // channel sharing the same inbox.
  const scope = { organizationId: 'org_wingfu_holdings' };

  /**
   * THE EXPECTATION IS DERIVED, NOT TRANSCRIBED — and it was transcribed until
   * the estate was seeded at the magnitude the corpus describes.
   *
   * This test used to assert three literal unit identifiers, which was correct in
   * a world where each floor held one flat and silently wrong the moment a floor
   * held eight. A list cannot grow when the world grows: the same defect as an
   * input axis that stayed at four principals while the world gained two.
   *
   * The SERVED FLOORS are the seeded fact under test and stay written here. The
   * units on them are now derived, so widening the estate again changes nothing
   * in this file. The derivation deliberately goes floors → units directly,
   * skipping the location_serving_scope join that the implementation uses, so the
   * two do not agree by construction on the part actually being tested.
   */
  const LOW_FLOORS = ['fl_wfg_a_01', 'fl_wfg_a_12', 'fl_wfg_a_20'];
  const SHUTTLE_FLOORS = ['fl_wfg_a_gf', 'fl_wfg_a_21', 'fl_wfg_a_40'];

  const residentialOn = async (floorIds: readonly string[]): Promise<string[]> => {
    const rows = await harness.admin.query<{ unit_id: string }>(
      `SELECT unit_id FROM property.unit
       WHERE floor_id = ANY($1::text[]) AND unit_class = 'residential' ORDER BY unit_id`,
      [floorIds],
    );
    return rows.map((r) => r.unit_id);
  };

  const low = await harness.modules.servingScope.resolveServedUnits(scope, 'loc_wfg_lift_bank_low');
  assert.deepEqual(low.slice().sort(), await residentialOn(LOW_FLOORS));

  const shuttle = await harness.modules.servingScope.resolveServedUnits(scope, 'loc_wfg_lift_shuttle');
  assert.deepEqual(shuttle.slice().sort(), await residentialOn(SHUTTLE_FLOORS));

  // NOT VACUOUS: a derived expectation that came back empty would agree with a
  // resolver that returns nothing at all.
  assert.ok(low.length > 3, `the low bank must serve a populated floor set, got ${low.length}`);
  assert.ok(shuttle.length > 3, `the shuttle must serve a populated floor set, got ${shuttle.length}`);

  // The two sets do not overlap, which is the property that makes the model useful.
  assert.equal(low.filter((u) => shuttle.includes(u)).length, 0);

  // G/F is IN the shuttle's serving scope and holds 135 parking and storage units,
  // and contributes none of them. In the old world G/F held two units and this was
  // nearly unobservable; the widened estate turns it into a real assertion.
  const groundFloorAll = await harness.admin.query<{ n: string }>(
    `SELECT count(*) AS n FROM property.unit WHERE floor_id = 'fl_wfg_a_gf'`,
  );
  assert.ok(Number(groundFloorAll[0]!.n) > 100, 'G/F must actually hold the non-residential stock');
  const groundFloorServed = shuttle.filter((u) => u.includes('_cp_') || u.includes('_st_'));
  assert.deepEqual(groundFloorServed, [], 'a lift notification must never address a parking bay or a locker');
});

test('a building service with no recent update is unknown, never in service', async () => {
  // The same class of failure as a green "all safe" over stale sensor data: the
  // interface asserting something it does not know.
  const fresh = await harness.modules.availability.getAvailability(
    'loc_wfg_lift_bank_low',
    new Date('2026-08-13T10:00:00+08:00'),
  );
  assert.equal(fresh?.storedState, 'in_service');
  assert.equal(fresh?.state, 'in_service');

  const stale = await harness.modules.availability.getAvailability(
    'loc_wfg_lift_shuttle',
    new Date('2026-08-13T10:00:00+08:00'),
  );
  assert.equal(stale?.storedState, 'in_service', 'the stored value really does say in service');
  assert.equal(stale?.state, 'unknown', 'but a stale record must never be served as in service');
  assert.equal(stale?.stale, true);
});

test('a public area resolves no resident audience', async () => {
  // PEMO has no channel to the public. Collapsing public_area into common_area
  // would fail silently — nobody notified, nothing errored — which is why they are
  // separate classes.
  const served = await harness.modules.servingScope.resolveServedUnits(
    { organizationId: 'org_wingfu_holdings' },
    'loc_wfg_public_passage',
  );
  assert.deepEqual(served, []);
});

test('parking and storage never appear as a home', async () => {
  const scope = { organizationId: 'org_wingfu_holdings' };

  // They exist as property objects with an external reference...
  const parking = await harness.admin.query<{ unit_class: string; external_ref: string }>(
    `SELECT unit_class, external_ref FROM property.unit WHERE unit_id = 'unit_wfg_cp_p101'`,
  );
  assert.equal(parking[0]?.unit_class, 'parking');

  // ...and the resident really does hold them...
  const all = await harness.modules.authorization.listAllRelationships('res_wfg_000412');
  assert.ok(all.some((r) => r.unitId === 'unit_wfg_cp_p101' && r.unitClass === 'parking'));
  assert.ok(all.some((r) => r.unitId === 'unit_wfg_st_s021' && r.unitClass === 'storage'));

  // ...but they are not a home, by any route.
  assert.equal(await harness.modules.units.getResidentialUnit(scope, 'unit_wfg_cp_p101'), undefined);

  const authorized = await harness.modules.authorization.listAuthorizedUnits('res_wfg_000412');
  assert.ok(!authorized.some((r) => r.unitClass !== 'residential'));

  const switcher = (
    await harness.app.inject({
      method: 'GET',
      url: '/api/resident-mobile/v0/home?unitId=unit_wfg_a_12_a1',
      headers: { authorization: harness.token('res_wfg_000412') },
    })
  ).json().unitSwitcher as { unitId: string }[];
  assert.ok(!switcher.some((u) => u.unitId === 'unit_wfg_cp_p101'));
  assert.ok(!switcher.some((u) => u.unitId === 'unit_wfg_st_s021'));

  // And a car-park event's audience comes from serving scope, not from the set of
  // space-holders: a fire concerns everyone present, not only the people who own bays.
  const carParkAudience = await harness.modules.servingScope.resolveServedUnits(scope, 'loc_wfg_carpark');
  assert.ok(carParkAudience.includes('unit_wfg_c_08_c3'), 'a resident with no bay is still in the audience');
  assert.ok(!carParkAudience.includes('unit_wfg_cp_p101'), 'a bay is not an audience member');
});

test('the unit level is terminal', async () => {
  // Subdivided units, co-living and hostels are out of scope, so no authorization
  // or audience rule needs a sub-unit hop — and no scaffolding for one exists.
  const columns = await harness.admin.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'property' AND table_name = 'unit'`,
  );
  const names = columns.map((c) => c.column_name);
  assert.ok(!names.includes('parent_unit_id'), 'a sub-unit pointer would change who receives a safety alert');
  assert.ok(!names.some((n) => n.startsWith('sub_')));
});
