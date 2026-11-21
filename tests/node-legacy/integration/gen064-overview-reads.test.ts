/**
 * GEN-064 Overview reads, proven against the seed with props the SUITE constructs
 * for itself and tears down (`the-seed-is-the-world-…-the-test-builds-its-own-props`).
 * The seed is too quiet — 0 == [] proves nothing — so each teeth-bearing condition
 * is exercised by constructed data:
 *   1. DISTINCT event_id (a multi-unit-audience event)
 *   2. retracted = false (a retracted event in the window)
 *   3. residential-only (a non-residential unit in an unknown state)
 *   4. per-node occupancy (occupancies under two buildings)
 */
import { strict as assert } from 'node:assert';
import test, { before, after } from 'node:test';

const { startHarness } = await import('../../apps/api/dist/testing/harness.js');
const { createOverviewSafetyReads } = await import('../../modules/home-safety/dist/index.js');
const { createOverviewCountReads } = await import('../../modules/property/dist/index.js');
const { computeTreeNodeStats } = await import('../../apps/api/dist/management/compose-overview.js');

let harness: Awaited<ReturnType<typeof startHarness>>;
const q = (sql: string, params: unknown[] = []) => harness.admin.query(sql, params);

const EV = 'unknown_pre_adr_006';
const evCols = 'event_id,organization_id,estate_id,severity,title_en,title_zh_hant,location_label_en,location_label_zh_hant,location_class,source_unit_id,audience_source,occurred_at,received_at,acknowledgement_required,management_update_pending,disclaimer_en,disclaimer_zh_hant,revision_number,is_correction,retracted,provenance_state';
const mkEvent = (id: string, srcUnit: string, hoursAgo: number, retracted: boolean) =>
  q(`INSERT INTO home_safety.safety_event (${evCols}) VALUES ($1,'org_wingfu_holdings',$2,'warning',$1,'x','L','L','unit',$3,'unit',now()-make_interval(hours=>$4),now()-make_interval(hours=>$4),false,false,'d','免',1,false,$5,'${EV}') ON CONFLICT (event_id) DO NOTHING`,
    [id, 'est_wing_fu_garden', srcUnit, hoursAgo, retracted]);

let resA: string, resB: string, bldA: string, bldB: string, park: string, extra: string;

before(async () => {
  harness = await startHarness();
  // Two residential units in two DIFFERENT buildings of one estate.
  const two = await q<{ unit_id: string; building_id: string }>(
    `SELECT DISTINCT ON (f.building_id) u.unit_id, f.building_id
       FROM property.unit u JOIN property.floor f ON f.floor_id=u.floor_id
       JOIN property.building b ON b.building_id=f.building_id
      WHERE b.estate_id='est_wing_fu_garden' AND u.unit_class='residential'
      ORDER BY f.building_id, u.unit_id LIMIT 2`);
  resA = two[0]!.unit_id; bldA = two[0]!.building_id;
  resB = two[1]!.unit_id; bldB = two[1]!.building_id;
  // A third residential unit for the unknown-severity assertion.
  extra = (await q<{ unit_id: string }>(
    `SELECT u.unit_id FROM property.unit u JOIN property.floor f ON f.floor_id=u.floor_id
      JOIN property.building b ON b.building_id=f.building_id
     WHERE b.estate_id='est_wing_fu_garden' AND u.unit_class='residential'
       AND u.unit_id NOT IN ($1,$2) ORDER BY u.unit_id LIMIT 1`, [resA, resB]))[0]!.unit_id;
  // A NON-residential (parking) unit for the residential-only assertion.
  park = (await q<{ unit_id: string }>(
    `SELECT unit_id FROM property.unit WHERE unit_class='parking' ORDER BY unit_id LIMIT 1`))[0]!.unit_id;
});

after(async () => {
  await q(`DELETE FROM home_safety.safety_event_audience WHERE event_id IN ('ev_multi_g64','ev_retr_g64')`);
  await q(`DELETE FROM home_safety.safety_event WHERE event_id IN ('ev_multi_g64','ev_retr_g64')`);
  await q(`DELETE FROM home_safety.unit_safety_state WHERE unit_id IN ($1,$2)`, [park, extra]);
  await q(`DELETE FROM resident.occupancy WHERE occupancy_id IN ('occ_g64_a','occ_g64_b')`);
  await harness.close();
});

test('control 1 & 2 — safety events: DISTINCT per event, retracted excluded', async () => {
  const safety = createOverviewSafetyReads(harness.modules.homeSafetyDb);
  await mkEvent('ev_multi_g64', resA, 2, false);
  for (const u of [resA, resB, extra]) await q(`INSERT INTO home_safety.safety_event_audience(event_id,unit_id) VALUES ('ev_multi_g64',$1) ON CONFLICT DO NOTHING`, [u]);
  await mkEvent('ev_retr_g64', resA, 1, true);
  await q(`INSERT INTO home_safety.safety_event_audience(event_id,unit_id) VALUES ('ev_retr_g64',$1) ON CONFLICT DO NOTHING`, [resA]);

  const events = await safety.safetyEventsInWindow([resA, resB, extra], 24);
  const ids = events.map((e) => e.eventId);
  assert.equal(ids.filter((i) => i === 'ev_multi_g64').length, 1, 'DISTINCT: the 3-audience event appears ONCE, not thrice');
  assert.ok(!ids.includes('ev_retr_g64'), 'retracted event is excluded from the window');
  assert.equal(events.length, 1, 'exactly the one live in-window event');
});

test('control 3 — units-unknown counts residential only', async () => {
  const safety = createOverviewSafetyReads(harness.modules.homeSafetyDb);
  const counts = createOverviewCountReads(harness.modules.propertyDb);
  const ssCols = `unit_id,organization_id,severity,monitoring_coverage,headline_en,headline_zh_hant,observed_at,received_at,freshness_window_seconds,disclaimer_en,disclaimer_zh_hant`;
  const ssVals = `'org_wingfu_holdings','unknown','partial','h','h',now(),now(),3600,'d','免'`;
  await q(`INSERT INTO home_safety.unit_safety_state (${ssCols}) VALUES ($1,${ssVals}) ON CONFLICT (unit_id) DO UPDATE SET severity='unknown'`, [park]);
  await q(`INSERT INTO home_safety.unit_safety_state (${ssCols}) VALUES ($1,${ssVals}) ON CONFLICT (unit_id) DO UPDATE SET severity='unknown'`, [extra]);

  const scope = [park, extra];
  const residential = await counts.residentialUnitsInScope(scope);
  const resIds = residential.map((u) => u.unitId);
  const unknown = await safety.unitsInUnknownState(resIds);
  assert.ok(resIds.includes(extra) && !resIds.includes(park), 'residential filter keeps the flat, drops the parking bay');
  assert.deepEqual(unknown.map((u) => u.unitId), [extra], 'the parking bay in unknown state is NOT counted; the flat is');
});

const MGMT = '/api/management-web/v0';
const staffGet = (url: string) => harness.app.inject({
  method: 'GET', url, headers: { authorization: `Bearer ${harness.modules.staffAuth.issue('stf_wfg_manager')}` },
});

test('route wiring — getScope attaches per-node counts (server-owned, optional in schema)', async () => {
  const res = await staffGet(`${MGMT}/scope`);
  assert.equal(res.statusCode, 200, res.body);
  const body = JSON.parse(res.body) as { nodes: Array<{ node: { kind: string; id: string }; counts?: { units: number; occupied: number; vacant: number } }> };
  const est = body.nodes.find((n) => n.node.kind === 'estate' && n.node.id === 'est_wing_fu_garden');
  assert.ok(est?.counts, 'the estate node carries server-computed counts');
  assert.ok(est!.counts!.units > 0, 'the estate has a non-zero residential unit count');
  assert.equal(est!.counts!.units, est!.counts!.occupied + est!.counts!.vacant, 'occupied + vacant = units');
});

test('route wiring — getOverview returns three counters + recentNotices, omits attention/integrationHealth', async () => {
  const res = await staffGet(`${MGMT}/overview`);
  assert.equal(res.statusCode, 200, res.body);
  const body = JSON.parse(res.body) as { counters: Array<{ key: string }>; recentNotices: unknown[]; attention?: unknown; integrationHealth?: unknown };
  assert.deepEqual(body.counters.map((c) => c.key).sort(),
    ['notices-active', 'safety-events-window', 'units-unknown-state'], 'the three sourced counters; open-cases ABSENT');
  assert.ok(Array.isArray(body.recentNotices), 'recentNotices present, sourced from staff-notices.list');
  assert.equal(body.attention, undefined, 'attention OMITTED (no source), not fabricated');
  assert.equal(body.integrationHealth, undefined, 'integrationHealth OMITTED (no source), not fabricated');
});

test('control 4 — tree occupied is PER NODE, not per estate', async () => {
  const occCols = `occupancy_id,assertion_id,version,resident_id,household_id,unit_id,unit_class,role,status,source,effective_from`;
  const resident = (await q<{ resident_id: string }>(`SELECT resident_id FROM resident.resident LIMIT 1`))[0]!.resident_id;
  const hh = (await q<{ household_id: string }>(`SELECT household_id FROM resident.household LIMIT 1`))[0]!.household_id;
  await q(`INSERT INTO resident.occupancy (${occCols}) VALUES ('occ_g64_a','occa_g64_a',1,$1,$2,$3,'residential','tenant','active','seed',now()-interval '1 day') ON CONFLICT (assertion_id) DO NOTHING`, [resident, hh, resA]);
  await q(`INSERT INTO resident.occupancy (${occCols}) VALUES ('occ_g64_b','occa_g64_b',1,$1,$2,$3,'residential','tenant','active','seed',now()-interval '1 day') ON CONFLICT (assertion_id) DO NOTHING`, [resident, hh, resB]);

  const stats = await computeTreeNodeStats(harness.modules, [resA, resB], new Date());
  // A missing node reads as zero, not a throw — so a per-estate bug (a building's
  // own bucket vanishing) reds THIS assertion for its own reason, not as a crash.
  const ZERO = { units: 0, occupied: 0, vacant: 0 };
  const a = stats.get(`building:${bldA}`) ?? ZERO;
  const b = stats.get(`building:${bldB}`) ?? ZERO;
  const est = stats.get(`estate:est_wing_fu_garden`) ?? ZERO;
  assert.equal(a.occupied, 1, 'building A occupied is its OWN (1)');
  assert.equal(b.occupied, 1, 'building B occupied is its OWN (1)');
  assert.equal(est.occupied, 2, 'estate occupied is the sum (2)');
  assert.notEqual(a.occupied, est.occupied, 'a building count is NOT the estate count — per node, not per estate');
});
