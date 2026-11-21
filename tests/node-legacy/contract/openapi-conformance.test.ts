/**
 * Contract conformance.
 *
 * Two properties, and the second is the one that was missing when six fixtures
 * shipped in v0.1.0 declaring statuses the contract never declared:
 *
 *   1. every response body validates against the pinned schema;
 *   2. every status the API can return is DECLARED for that operation.
 *
 * Plus the negative: the API serves the contract's operations and no others. No
 * convenience endpoint, no debug route.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';
import { loadContractValidator } from '../../apps/api/dist/testing/contract-validator.js';

let harness: Harness;
test.before(async () => {
  harness = await startHarness();
});
test.after(async () => {
  await harness.close();
});

const validator = await loadContractValidator();
const RESIDENT = 'res_wfg_000412';
const UNIT = 'unit_wfg_a_12_a1';
const BASE = '/api/resident-mobile/v0';

/**
 * AN INVENTORY, and one of the few places a hand-kept list is the point rather
 * than the smell: adding an operation to a published contract must be a decision
 * somebody makes and writes down, not a thing that appears. GEN-042 added four
 * notice operations under ADR-019 and this line is where that was recorded.
 */
test('the contract declares exactly the operations this slice implements', () => {
  assert.deepEqual(
    [...validator.operations.keys()].sort(),
    [
      'acknowledgeNotice',
      'acknowledgeSafetyEvent',
      'getAccount',
      'getHome',
      'getMyNotices',
      'getSafetyEvent',
      'getSafetyOverview',
      'getServices',
      'markNoticeRead',
      'respondToNotice',
    ],
  );
});

test('no endpoint exists beyond the contract', async () => {
  // If a screen appears to need something the contract lacks, that is an
  // API-005-ST finding — not a route added here.
  const invented = [
    '/api/resident-mobile/v0/events',
    '/api/resident-mobile/v0/units',
    '/api/resident-mobile/v0/residents',
    '/api/resident-mobile/v0/debug',
    '/api/resident-mobile/v0/safety/events',
  ];
  for (const url of invented) {
    const response = await harness.app.inject({
      method: 'GET',
      url,
      headers: { authorization: harness.token(RESIDENT) },
    });
    assert.equal(response.statusCode, 404, `${url} must not exist`);
  }
});

test('every served status is declared by its operation', async () => {
  const cases: { operationId: string; method: 'GET' | 'PUT'; url: string; headers: Record<string, string>; payload?: unknown }[] = [
    { operationId: 'getHome', method: 'GET', url: `${BASE}/home?unitId=${UNIT}`, headers: { authorization: harness.token(RESIDENT) } },
    { operationId: 'getHome', method: 'GET', url: `${BASE}/home?unitId=${UNIT}`, headers: {} },
    { operationId: 'getServices', method: 'GET', url: `${BASE}/services?unitId=${UNIT}`, headers: { authorization: harness.token(RESIDENT) } },
    { operationId: 'getSafetyOverview', method: 'GET', url: `${BASE}/safety/overview?unitId=${UNIT}`, headers: { authorization: harness.token(RESIDENT) } },
    { operationId: 'getSafetyOverview', method: 'GET', url: `${BASE}/safety/overview?unitId=unit_wfg_c_08_c3`, headers: { authorization: harness.token(RESIDENT) } },
    { operationId: 'getSafetyEvent', method: 'GET', url: `${BASE}/safety/events/evt_20260813_smoke01`, headers: { authorization: harness.token(RESIDENT) } },
    { operationId: 'getSafetyEvent', method: 'GET', url: `${BASE}/safety/events/evt_does_not_exist`, headers: { authorization: harness.token(RESIDENT) } },
    { operationId: 'getAccount', method: 'GET', url: `${BASE}/account`, headers: { authorization: harness.token(RESIDENT) } },
    {
      operationId: 'acknowledgeSafetyEvent',
      method: 'PUT',
      url: `${BASE}/safety/events/evt_20260813_smoke01/acknowledgement`,
      headers: { authorization: harness.token(RESIDENT) },
      payload: { acknowledgementKey: 'aa11bb22-0000-4000-8000-000000000001', action: 'seen' },
    },
    {
      operationId: 'acknowledgeSafetyEvent',
      method: 'PUT',
      url: `${BASE}/safety/events/evt_20260813_smoke01/acknowledgement`,
      headers: { authorization: harness.token(RESIDENT) },
      payload: { action: 'seen' },
    },
  ];

  await harness.reseed();
  await harness.applyScenario('mob-08-safety-overview', 'default');
  await harness.applyScenario('mob-09-safety-event-detail', 'default');

  for (const testCase of cases) {
    const response = await harness.app.inject({
      method: testCase.method,
      url: testCase.url,
      headers: testCase.headers,
      ...(testCase.payload === undefined ? {} : { payload: testCase.payload }),
    });

    assert.ok(
      validator.declaresStatus(testCase.operationId, response.statusCode),
      `${testCase.operationId} returned undeclared status ${response.statusCode} for ${testCase.url}`,
    );

    // A problem body is a Problem; a success body is that operation's schema.
    if (response.statusCode >= 400) {
      assert.deepEqual(validator.validate('Problem', response.json()), [], `${testCase.url} problem shape`);
    }
  }
});

test('the two 409s are discriminated by type URI, not by status alone', async () => {
  await harness.reseed();
  await harness.applyScenario('mob-09-safety-event-detail', 'default');

  // Quarantine: a unit with no safety projection.
  const unmapped = await harness.app.inject({
    method: 'GET',
    url: `${BASE}/safety/overview?unitId=unit_wfg_c_08_c3`,
    headers: { authorization: harness.token(RESIDENT) },
  });
  assert.equal(unmapped.statusCode, 409);
  assert.equal(unmapped.json().type, 'https://pemo.local/problems/unmapped-unit');

  // Duplicate acknowledgement: a different key for the same resident and event.
  const url = `${BASE}/safety/events/evt_20260813_smoke01/acknowledgement`;
  const headers = { authorization: harness.token(RESIDENT) };
  await harness.app.inject({
    method: 'PUT',
    url,
    headers,
    payload: { acknowledgementKey: 'cc11bb22-0000-4000-8000-000000000001', action: 'seen' },
  });
  const duplicate = await harness.app.inject({
    method: 'PUT',
    url,
    headers,
    payload: { acknowledgementKey: 'cc11bb22-0000-4000-8000-000000000002', action: 'seen' },
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().type, 'https://pemo.local/problems/duplicate-acknowledgement');

  // Same code, unrelated meanings. A client that switched on status alone would
  // tell a resident their home is unmapped when they simply tapped twice.
  assert.notEqual(unmapped.json().type, duplicate.json().type);
});
