/**
 * The SECOND scope-only write — and what it proves is GENERALISATION.
 *
 * GEN-009 established the audited scope-only path on `home_safety.management_update`.
 * This lands the same path in a different module, on a different scope-node kind,
 * with no new mechanism: the platform audited write, the (group, role, node) gate
 * with out-of-scope ABSENT, the narrowest authorizing grant, property 4 inherited.
 *
 * THE GATE IS AT THE UNIT, where GEN-009's was at the estate — the second rung of
 * the narrowest-grant ladder, and the reason this vehicle is a better test than a
 * second estate-level act would have been.
 *
 * AUDIT ROWS ARE CLEARED BEFORE THE GROUPS THEY REFERENCE. `access.audit_event`
 * pins `access.user_group`, which the seeds replace; it has bitten three times, so
 * here it is a stated teardown obligation rather than a surprise.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

const BASE = '/api/management-web/v0';

/** estate_staff at ESTATE est_wing_fu_garden — covers every WFG unit. */
const MANAGER = 'stf_wfg_manager';
/** estate_staff at LOCATION loc_wfg_clubhouse — expands to no units at all. */
const COUNTER = 'stf_wfg_counter';

const ORG = 'org_wingfu_holdings';
const IN_SCOPE = 'unit_wfg_a_12_a1';        // est_wing_fu_garden, block A
/** Same ORGANIZATION, different estate — the sharpest negative. */
const OUT_OF_SCOPE = 'unit_twc_1_05_a';     // est_tsz_wan_court
const RESIDENT = 'res_wfg_000001';

let harness: Harness;

const staffAuth = (principalId: string) => ({
  authorization: `Bearer ${harness.modules.staffAuth.issue(principalId)}`,
});

const record = (
  principalId: string,
  unitId: string = IN_SCOPE,
  body: Record<string, unknown> = { residentId: RESIDENT, role: 'tenant' },
) =>
  harness.app.inject({
    method: 'POST',
    url: `${BASE}/units/${unitId}/occupancies`,
    headers: staffAuth(principalId),
    payload: body,
  });

const auditRows = async (): Promise<
  { audit_id: string; principal_id: string; group_id: string; role: string; node_kind: string; node_id: string; target_id: string; occurred_at: Date }[]
> =>
  harness.admin.query(
    `SELECT audit_id, principal_id, group_id, role, node_kind, node_id, target_id, occurred_at
       FROM access.audit_event WHERE action = 'record_occupancy' ORDER BY recorded_at`,
  );

const written = async (): Promise<number> => {
  const [r] = await harness.admin.query<{ n: string }>(
    `SELECT count(*) AS n FROM resident.occupancy WHERE source = 'management_web'`,
  );
  return Number(r?.n ?? -1);
};

const clearWrites = async (): Promise<void> => {
  await harness.admin.query(`DELETE FROM access.audit_event WHERE action = 'record_occupancy'`);
  await harness.admin.query(`DELETE FROM resident.occupancy WHERE source = 'management_web'`);
};

const addGrant = async (group: string, grantId: string, kind: string, node: string): Promise<void> => {
  await harness.admin.query(
    `INSERT INTO access.user_group (group_id, organization_id, display_name)
     VALUES ($1, $2, $3) ON CONFLICT (group_id) DO NOTHING`, [group, ORG, `GEN-013 ${group}`]);
  await harness.admin.query(
    `INSERT INTO access.group_membership (membership_id, group_id, principal_id, effective_from)
     VALUES ($1, $2, $3, '2024-01-01T00:00:00Z') ON CONFLICT DO NOTHING`,
    [`mem_gen013_${group}`, group, MANAGER]);
  await harness.admin.query(
    `INSERT INTO access.scope_grant (grant_id, group_id, role, node_kind, node_id, effective_from)
     VALUES ($1, $2, 'estate_staff', $3, $4, '2024-01-01T00:00:00Z')`, [grantId, group, kind, node]);
};

const dropTestGroups = async (): Promise<void> => {
  await clearWrites(); // audit rows pin user_group — see the header.
  await harness.admin.query(`DELETE FROM access.scope_grant WHERE grant_id LIKE 'gnt\\_gen013\\_%' ESCAPE '\\'`);
  await harness.admin.query(`DELETE FROM access.group_membership WHERE membership_id LIKE 'mem\\_gen013\\_%' ESCAPE '\\'`);
  await harness.admin.query(`DELETE FROM access.user_group WHERE group_id LIKE 'grp\\_gen013\\_%' ESCAPE '\\'`);
};

test.before(async () => { harness = await startHarness(); await clearWrites(); });
test.after(async () => { await dropTestGroups(); await harness.close(); });
test.beforeEach(clearWrites);

// ───────────────────────────────────────────────────────── the gate, at the UNIT
test('THE GATE — a principal whose grant covers the unit records the occupancy', async () => {
  const response = await record(MANAGER);
  assert.equal(response.statusCode, 201, response.body);
  const payload = JSON.parse(response.body) as { unitId: string; occupancy: { occupancyId: string; role: string } };
  assert.equal(payload.unitId, IN_SCOPE);
  assert.match(payload.occupancy.occupancyId, /^occ_/);
  assert.equal(payload.occupancy.role, 'tenant');
  assert.equal(await written(), 1);
});

test('THE GATE, RED — a unit in the SAME organization but outside the grant is ABSENT', async () => {
  // est_tsz_wan_court, not est_wing_fu_garden. Same tenant, real unit, and the
  // answer is 404 — identical to a unit that does not exist. A distinct refusal
  // would confirm the unit to a principal with no scope over it.
  const response = await record(MANAGER, OUT_OF_SCOPE);
  assert.equal(response.statusCode, 404, response.body);
  assert.equal(await written(), 0, 'an out-of-scope act persisted');
  assert.equal((await auditRows()).length, 0, 'an out-of-scope act was audited');
});

test('THE GATE, RED — a principal whose grants expand to NO units cannot act', async () => {
  // A Location grant expands through parent_location_id and never contains a unit,
  // so this principal holds a real estate_staff grant and an empty unit set.
  const response = await record(COUNTER);
  assert.equal(response.statusCode, 404, response.body);
  assert.equal(await written(), 0);
});

test('THE GATE, RED — REMOVE the grant and the same principal loses the same unit', async () => {
  const before = await record(MANAGER);
  assert.equal(before.statusCode, 201, 'precondition: the write works with the grant');
  await clearWrites();

  await harness.admin.query(
    `UPDATE access.scope_grant SET effective_to = now() - interval '1 day'
      WHERE group_id = 'grp_of_one_stf_wfg_manager'`);
  try {
    const after = await record(MANAGER);
    assert.equal(after.statusCode, 404, 'the grant was removed and the act still resolved');
    assert.equal(await written(), 0);
  } finally {
    await harness.admin.query(
      `UPDATE access.scope_grant SET effective_to = NULL WHERE group_id = 'grp_of_one_stf_wfg_manager'`);
  }
});

/**
 * THE IN-QUERY FILTER, TESTED WHERE IT LIVES.
 *
 * Every route-level test above passed with the INSERT's `WHERE unit_id =
 * ANY($allowed)` DELETED — because the route answers 404 at the authorizing-grant
 * lookup before the act is ever attempted, so out of scope the INSERT is never
 * reached. The filter is real and it is defence in depth, but the route can no
 * more prove it than a guard behind another guard can be seen to fire.
 *
 * That is the empty oracle again: a test suite green over the deletion of the
 * thing it was written to check. So the filter is exercised at the module,
 * directly, with an allowed set that excludes the unit — the same fix GEN-012's
 * tie-break needed, for the same reason.
 */
test('THE FILTER IS IN THE QUERY — the act writes ZERO ROWS when the unit is not in the allowed set', async () => {
  const input = {
    occupancyId: 'occ_gen013_filter',
    residentId: RESIDENT,
    householdId: null,
    unitId: IN_SCOPE,
    unitClass: 'residential' as const,
    role: 'tenant' as const,
    source: 'management_web',
    effectiveFrom: new Date(),
  };

  // Not in the allowed set: the row is never a candidate, so nothing is written.
  // GEN-016 changed the return from `row | undefined` to a discriminated result,
  // because the act now decides between out-of-scope and a live-occupancy conflict
  // inside the transaction rather than being pre-checked in the route.
  const refused = await harness.modules.residentDb.transaction((tx) =>
    harness.modules.occupancies.record(tx, input, ['unit_some_other_place']));
  assert.equal(refused.kind, 'out-of-scope', 'the act recorded a unit outside the allowed set');
  assert.equal(await written(), 0, 'a row was written for a unit outside the allowed set');

  // An EMPTY allowed set is not "everything".
  const empty = await harness.modules.residentDb.transaction((tx) =>
    harness.modules.occupancies.record(tx, input, []));
  assert.equal(empty.kind, 'out-of-scope');
  assert.equal(await written(), 0);

  // And with the unit in the set the identical call writes, so the refusals above
  // were caused by the filter and not by something incidental.
  const allowed = await harness.modules.residentDb.transaction((tx) =>
    harness.modules.occupancies.record(tx, input, ['unit_some_other_place', IN_SCOPE]));
  assert.equal(allowed.kind, 'recorded', 'the act did not write when the unit WAS in the allowed set');
  assert.equal(await written(), 1);
});

test('THE CONFLICT LOOKUP IS FILTERED TOO — it reports nothing for a unit outside the set', async () => {
  await record(MANAGER);
  assert.equal(await written(), 1);
  const seen = await harness.modules.occupancies.findLiveOccupancy(
    RESIDENT, IN_SCOPE, [IN_SCOPE], new Date());
  assert.ok(seen, 'the premise is gone: no live occupancy to find');

  const hidden = await harness.modules.occupancies.findLiveOccupancy(
    RESIDENT, IN_SCOPE, ['unit_some_other_place'], new Date());
  assert.equal(hidden, undefined, 'a live occupancy was reported for a unit outside the allowed set');
});

// ─────────────────────────────────────────── the audit, and the narrowest grant
test('the audit records actor, authority and the effective instant', async () => {
  await record(MANAGER);
  const rows = await auditRows();
  assert.equal(rows.length, 1, 'the act was written without its audit');
  const row = rows[0]!;
  assert.equal(row.principal_id, MANAGER);
  assert.equal(row.group_id, 'grp_of_one_stf_wfg_manager');
  assert.equal(row.node_kind, 'estate');
  assert.notEqual(row.principal_id, row.group_id);
  assert.match(row.target_id, /^occ_/);
});

test('NARROWEST at a new depth — a BUILDING grant beats the ESTATE grant covering the same unit', async () => {
  // GEN-009 only ever chose among organization/portfolio/estate. The unit-level
  // act reaches further down the ladder, so this is the rung GEN-009 could not
  // exercise: both grants authorize, and the closer one is recorded.
  await addGrant('grp_gen013_building', 'gnt_gen013_building', 'building', 'blk_wfg_a');
  try {
    const response = await record(MANAGER);
    assert.equal(response.statusCode, 201, response.body);
    const row = (await auditRows())[0]!;
    assert.equal(row.node_kind, 'building', 'the broader estate grant was recorded');
    assert.equal(row.node_id, 'blk_wfg_a');
    assert.equal(row.group_id, 'grp_gen013_building');
  } finally { await dropTestGroups(); }
});

test('D1.3 at UNIT granularity — re-derivation empties, the retained record still answers', async () => {
  await record(MANAGER);
  const row = (await auditRows())[0]!;
  const occurred = new Date(row.occurred_at);

  // In force at the recorded instant...
  const atTime = await harness.modules.historicalScope.resolveAsAt(row.principal_id, occurred);
  assert.ok(atTime?.grants.some((g) => g.groupId === row.group_id && g.node.id === row.node_id),
    'the recorded authority is not in force at the recorded instant');

  // ...and re-deriving it later returns NOTHING, silently.
  await harness.admin.query(
    `UPDATE access.group_membership SET effective_from = now() + interval '1 day'
      WHERE group_id = 'grp_of_one_stf_wfg_manager'`);
  try {
    const rederived = await harness.modules.historicalScope.resolveAsAt(row.principal_id, occurred);
    assert.deepEqual(rederived?.grants ?? [], [],
      'the premise is gone: re-derivation still finds the grant');
    assert.equal(row.group_id, 'grp_of_one_stf_wfg_manager');
  } finally {
    await harness.admin.query(
      `UPDATE access.group_membership SET effective_from = '2024-01-01T00:00:00Z'
        WHERE group_id = 'grp_of_one_stf_wfg_manager'`);
  }
});

// ─────────────────────────────────────────────── this surface's own preconditions
test('DOMAIN — a conflicting live occupancy is refused 409, and it is a DIFFERENT answer from out-of-scope', async () => {
  const first = await record(MANAGER);
  assert.equal(first.statusCode, 201);
  const again = await record(MANAGER);
  assert.equal(again.statusCode, 409, again.body);
  assert.match(JSON.parse(again.body).type, /occupancy-already-exists/);
  assert.equal(await written(), 1, 'the conflicting act was written anyway');
});

test('DOMAIN — the conflict is SCOPE-FILTERED, so out-of-scope still answers 404, never 409', async () => {
  // The leak this ordering prevents: were the conflict lookup unfiltered, a
  // principal with no scope over the unit would learn from a 409 that an
  // occupancy exists there.
  await record(MANAGER); // a live occupancy now exists on IN_SCOPE
  const response = await harness.app.inject({
    method: 'POST',
    url: `${BASE}/units/${IN_SCOPE}/occupancies`,
    headers: staffAuth(COUNTER),
    payload: { residentId: RESIDENT, role: 'tenant' },
  });
  assert.equal(response.statusCode, 404, 'a conflict leaked to a principal with no scope');
  assert.match(JSON.parse(response.body).type, /occupancy-target-not-found/);
});

test('DOMAIN — an unknown resident, and a resident of another organization, are both 404', async () => {
  const unknown = await record(MANAGER, IN_SCOPE, { residentId: 'res_not_a_person', role: 'tenant' });
  assert.equal(unknown.statusCode, 404, unknown.body);

  const [other] = await harness.admin.query<{ resident_id: string }>(
    `SELECT resident_id FROM resident.resident WHERE organization_id <> $1 ORDER BY 1 LIMIT 1`, [ORG]);
  assert.ok(other, 'the premise is gone: no resident of another organization is seeded');
  const cross = await record(MANAGER, IN_SCOPE, { residentId: other.resident_id, role: 'tenant' });
  assert.equal(cross.statusCode, 404, 'a resident of another organization was accepted');
  assert.equal(await written(), 0);
});

test('DOMAIN — a non-residential unit is not a home and is refused', async () => {
  const [parking] = await harness.admin.query<{ unit_id: string }>(
    `SELECT u.unit_id FROM property.unit u
       JOIN property.floor f ON f.floor_id = u.floor_id
      WHERE u.unit_class <> 'residential' AND f.building_id = 'blk_wfg_a' ORDER BY 1 LIMIT 1`);
  if (parking === undefined) return; // stated rather than silently skipped below
  const response = await record(MANAGER, parking.unit_id);
  assert.equal(response.statusCode, 404, response.body);
  assert.equal(await written(), 0);
});

test('EDGE — the request is validated before anything reaches SQL', async () => {
  for (const body of [
    {},
    { residentId: RESIDENT },
    { residentId: RESIDENT, role: 'landlord' },
    { residentId: RESIDENT, role: 'tenant', effectiveFrom: 'not-a-date' },
  ]) {
    const response = await record(MANAGER, IN_SCOPE, body as Record<string, unknown>);
    assert.equal(response.statusCode, 400, JSON.stringify(body));
  }
  assert.equal(await written(), 0);
});

// ────────────────────────────────────────────────── property 4, still inherited
test('property 4 — the runtime role still cannot amend or delete the audit it writes', async () => {
  await record(MANAGER);
  await assert.rejects(
    harness.modules.residentDb.query(`UPDATE access.audit_event SET action = 'tampered'`),
    /permission denied/);
  await assert.rejects(
    harness.modules.residentDb.query(`DELETE FROM access.audit_event`),
    /permission denied/);
  assert.equal((await auditRows()).length, 1);
});
