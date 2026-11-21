/**
 * Tenancy isolation — SECURITY tests, not future-proofing.
 *
 * ADR-002 is explicit that cross-organization isolation is a security surface
 * because the Organization tier describes how the business already operates. So
 * these are negative tests by design: each one asks for something that must be
 * refused, and a pass means the refusal happened.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';
import { createScopeQueries } from '../../modules/access/dist/index.js';
import { createModuleDb, loadConfig } from '../../modules/platform/dist/index.js';

let harness: Harness;
/**
 * FIXTURE WRITES GO THROUGH THE OWNER HANDLE, never the app credential.
 *
 * `pemo_app` holds SELECT + INSERT and nothing else, so a fixture teardown run
 * through it is refused — and the test then cannot tell "the app is forbidden
 * this" from "my fixture could not run". Worse, a constraint probe issued as the
 * app fails on PERMISSION rather than on the constraint it exists to prove.
 *
 * Fixtures are owner work, exactly as the seeds' DELETEs are. The app handle
 * below stays for the module code under test, which is what actually runs as
 * the application.
 */
let accessDb: ReturnType<typeof createModuleDb>;
let fixtureDb: ReturnType<typeof createModuleDb>;

test.before(async () => {
  harness = await startHarness();
  await harness.applyScenario('mob-08-safety-overview', 'default');
  await harness.applyScenario('mob-09-safety-event-detail', 'default');
  accessDb = createModuleDb({ schema: 'access', database: loadConfig().moduleDatabases.access });
  // Owner credential: fixtures are owner work (see the note above).
  fixtureDb = createModuleDb({ schema: 'access', database: loadConfig().databaseOwner });
});
test.after(async () => {
  await accessDb.close();
  await fixtureDb.close();
  await harness.close();
});

const BASE = '/api/resident-mobile/v0';
const ORG_A_RESIDENT = 'res_wfg_000412';
const ORG_B_RESIDENT = 'res_hbv_000777';
const ORG_B_UNIT = 'unit_hbv_b_05_b2';

test('a resident cannot read a unit in another organization', async () => {
  for (const path of ['home', 'services', 'safety/overview']) {
    const response = await harness.app.inject({
      method: 'GET',
      url: `${BASE}/${path}?unitId=${ORG_B_UNIT}`,
      headers: { authorization: harness.token(ORG_A_RESIDENT) },
    });
    assert.equal(response.statusCode, 403, `${path} leaked across organizations`);
  }
});

test('a resident cannot read another unit inside their own organization', async () => {
  // Same estate, same block, a unit they simply do not hold.
  const response = await harness.app.inject({
    method: 'GET',
    url: `${BASE}/safety/overview?unitId=unit_wfg_a_20_a1`,
    headers: { authorization: harness.token(ORG_A_RESIDENT) },
  });
  assert.equal(response.statusCode, 403);
});

test("a resident cannot read another household's safety event", async () => {
  await harness.applyScenario('mob-09-safety-event-detail', 'resident-not-authorized');

  const response = await harness.app.inject({
    method: 'GET',
    url: `${BASE}/safety/events/evt_20260813_other01`,
    headers: { authorization: harness.token(ORG_A_RESIDENT) },
  });

  // 404, not 403: confirming the event exists would disclose a safety event in
  // another resident's household.
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().type, 'https://pemo.local/problems/event-not-found');
});

test("a resident cannot acknowledge another household's safety event", async () => {
  await harness.applyScenario('mob-09-safety-event-detail', 'resident-not-authorized');

  const response = await harness.app.inject({
    method: 'PUT',
    url: `${BASE}/safety/events/evt_20260813_other01/acknowledgement`,
    headers: { authorization: harness.token(ORG_A_RESIDENT) },
    payload: { acknowledgementKey: 'dd11bb22-0000-4000-8000-000000000001', action: 'i_am_safe' },
  });
  assert.equal(response.statusCode, 404);

  const rows = await harness.admin.query(
    `SELECT 1 FROM home_safety.acknowledgement WHERE event_id = 'evt_20260813_other01'`,
  );
  assert.equal(rows.length, 0, 'a refused acknowledgement must leave no trace');
});

test('an organization B resident sees only organization B', async () => {
  const body = (
    await harness.app.inject({
      method: 'GET',
      url: `${BASE}/account`,
      headers: { authorization: harness.token(ORG_B_RESIDENT) },
    })
  ).json();

  const unitIds = (body.memberships as { unitId: string }[]).map((m) => m.unitId);
  assert.deepEqual(unitIds, [ORG_B_UNIT]);
  // No organization identifier is ever serialized to a resident (ADR-002).
  assert.ok(!JSON.stringify(body).includes('org_harbour_property'));
  assert.ok(!JSON.stringify(body).includes('organizationId'));
});

test('an expired caregiver scope is refused, and says when it ended', async () => {
  const response = await harness.app.inject({
    method: 'GET',
    url: `${BASE}/safety/overview?unitId=unit_wfg_a_12_a1`,
    headers: {
      authorization: harness.token('res_wfg_000733'),
      'x-pemo-dev-now': '2026-08-13T10:00:00+08:00',
    },
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().type, 'https://pemo.local/problems/caregiver-scope-expired');
  assert.match(response.json().residentMessage.en, /ended on 12 August/);
});

test('the same caregiver was authorized the day before it expired', async () => {
  // Proves the refusal is time-evaluated rather than a permanent denial — the
  // committed baseline requires the OPERATION TIME to be applied on every read.
  const response = await harness.app.inject({
    method: 'GET',
    url: `${BASE}/safety/overview?unitId=unit_wfg_a_12_a1`,
    headers: {
      authorization: harness.token('res_wfg_000733'),
      'x-pemo-dev-now': '2026-08-11T10:00:00+08:00',
    },
  });
  assert.equal(response.statusCode, 200);
});

test('no valid session is 401, and a forged token is not a session', async () => {
  const missing = await harness.app.inject({ method: 'GET', url: `${BASE}/account` });
  assert.equal(missing.statusCode, 401);

  const forged = await harness.app.inject({
    method: 'GET',
    url: `${BASE}/account`,
    headers: { authorization: 'Bearer eyJmYWtlIjoidG9rZW4ifQ.notasignature' },
  });
  assert.equal(forged.statusCode, 401);
});

// ─────────────────────────────────────────────────────────────────────────────
// STAFF SCOPE — GEN-018-ST
//
// ADR-007 D4: "Cross-organization isolation is absolute and is not a role.
// GEN-006-ST already tests this for residents; the same test extends here."
//
// EXTENDED RATHER THAN DUPLICATED, deliberately. A second file asserting the same
// property would drift from this one, and the first divergence would look like a
// disagreement about what isolation means rather than a bug. One property, one
// place — and the fact that the staff cases slot in unchanged is itself evidence
// the module boundary was drawn in the right place.

test('staff — no grant at any level reaches another organization', async () => {
  const scope = createScopeQueries(accessDb);

  const wingFu = await scope.getPrincipal('stf_wfg_manager');
  const harbour = await scope.getPrincipal('stf_hbv_manager');
  assert.ok(wingFu && harbour);

  const ORG_A = { kind: 'organization' as const, id: 'org_wingfu_holdings' };
  const ORG_B = { kind: 'organization' as const, id: 'org_harbour_property' };
  const ESTATE_B = { kind: 'estate' as const, id: 'est_harbour_view' };
  const UNIT_B = { kind: 'unit' as const, id: 'unit_hbv_b_05_b2' };

  // An estate-level grant in Organization A reaches nothing in Organization B —
  // not the organization, not its estate, not a unit inside it.
  assert.equal(scope.admits(wingFu, ORG_B, []).admitted, false);
  assert.equal(scope.admits(wingFu, ESTATE_B, [ORG_B]).admitted, false);
  assert.equal(scope.admits(wingFu, UNIT_B, [ORG_B, ESTATE_B]).admitted, false);

  // And symmetrically, which is the half that catches a one-directional check.
  assert.equal(scope.admits(harbour, ORG_A, []).admitted, false);
  assert.equal(
    scope.admits(harbour, { kind: 'unit', id: 'unit_wfg_a_12_a1' }, [ORG_A]).admitted,
    false,
  );

  // The control: each principal does reach its own organization, so the
  // assertions above are refusals rather than a resolver that refuses everything.
  assert.equal(scope.admits(harbour, ESTATE_B, [ORG_B]).admitted, true);
  assert.equal(
    scope.admits(wingFu, { kind: 'estate', id: 'est_wing_fu_garden' }, [ORG_A]).admitted,
    true,
  );
});

test('staff — RED: a grant forged across organizations still resolves to nothing', async () => {
  // The mutant is not a code change but a DATA one, because that is how this
  // would actually go wrong: somebody assigns a scope node belonging to another
  // organization. The grant stores fine — node_id has no foreign key, by design —
  // and it must still admit nothing, because isolation is enforced on the
  // principal's organization rather than on the grant's plausibility.
  await fixtureDb.query(
    `INSERT INTO scope_grant (grant_id, group_id, role, node_kind, node_id, effective_from)
     VALUES ('grant_cross_org_probe', 'grp_of_one_stf_wfg_manager', 'estate_staff', 'estate', 'est_harbour_view', '2024-01-01T00:00:00+08:00')`,
  );
  try {
    const scope = createScopeQueries(accessDb);
    const wingFu = await scope.getPrincipal('stf_wfg_manager');
    assert.ok(wingFu);

    // The grant exists...
    assert.equal(wingFu.grants.length, 2, 'the forged grant is stored');

    // ...and an unassigned row in the other organization is still refused, which
    // is the check that does not depend on the hierarchy at all.
    assert.equal(scope.admitsUnassigned(wingFu, 'org_harbour_property').admitted, false);
  } finally {
    await fixtureDb.query(`DELETE FROM scope_grant WHERE grant_id = 'grant_cross_org_probe'`);
  }

  // Control after the mutation.
  const scope = createScopeQueries(accessDb);
  const restored = await scope.getPrincipal('stf_wfg_manager');
  assert.equal(restored?.grants.length, 1, 'the probe left nothing behind');
});
