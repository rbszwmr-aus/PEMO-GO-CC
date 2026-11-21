/**
 * Severity, freshness and the response envelope.
 *
 * The rule that matters most here is one sentence long and is the reason the
 * whole Home Safety boundary exists: **offline and stale never serialize as
 * normal.** Everything else in this file supports it.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';
import { readContractFile } from '../../apps/api/dist/testing/contract-validator.js';

let harness: Harness;
test.before(async () => {
  harness = await startHarness();
});
test.after(async () => {
  await harness.close();
});

const severity = (await readContractFile('severity.json')) as {
  levelOrder: string[];
  levels: Record<string, unknown>;
};

const RESIDENT = 'res_wfg_000412';
const UNIT = 'unit_wfg_a_12_a1';
const BASE = '/api/resident-mobile/v0';

const everySeverityValue = (node: unknown, out: string[] = []): string[] => {
  if (Array.isArray(node)) node.forEach((item) => everySeverityValue(item, out));
  else if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'severity' && typeof value === 'string') out.push(value);
      everySeverityValue(value, out);
    }
  }
  return out;
};

test('every emitted severity is in the canonical seven', async () => {
  await harness.reseed();
  const headers = { authorization: harness.token(RESIDENT) };

  for (const scenario of ['default', 'stale', 'sensor-offline', 'no-installed-sensors', 'all-clear']) {
    await harness.applyScenario('mob-08-safety-overview', scenario);
    const response = await harness.app.inject({
      method: 'GET',
      url: `${BASE}/safety/overview?unitId=${UNIT}`,
      headers,
    });
    for (const value of everySeverityValue(response.json())) {
      assert.ok(severity.levelOrder.includes(value), `"${value}" is not a canonical severity (${scenario})`);
    }
  }
});

test('a stale projection never serializes as normal', async () => {
  await harness.reseed();
  await harness.applyScenario('mob-08-safety-overview', 'stale');

  const response = await harness.app.inject({
    method: 'GET',
    url: `${BASE}/safety/overview?unitId=${UNIT}`,
    headers: { authorization: harness.token(RESIDENT), 'x-pemo-dev-now': '2026-08-13T10:00:00+08:00' },
  });

  const body = response.json();
  assert.equal(body.safety.freshness.status, 'stale');
  assert.notEqual(body.safety.severity, 'normal');
  assert.equal(body.safety.severity, 'unknown');

  // The stored value really was `normal`: the downgrade is the API's doing, not a
  // seeded convenience.
  const stored = await harness.admin.query<{ severity: string }>(
    'SELECT severity FROM home_safety.unit_safety_state WHERE unit_id = $1',
    [UNIT],
  );
  assert.equal(stored[0]?.severity, 'normal');
});

test('an offline sensor stays offline rather than being flattened to unknown', async () => {
  // Downgrading it would LOSE information: "this sensor stopped reporting" is a
  // more useful and more honest statement than "unknown".
  await harness.reseed();
  await harness.applyScenario('mob-08-safety-overview', 'sensor-offline');

  const response = await harness.app.inject({
    method: 'GET',
    url: `${BASE}/safety/overview?unitId=${UNIT}`,
    headers: { authorization: harness.token(RESIDENT), 'x-pemo-dev-now': '2026-08-13T10:00:00+08:00' },
  });

  const body = response.json();
  assert.equal(body.safety.severity, 'offline');
  assert.ok(
    body.installedServices.some((s: { severity: string }) => s.severity === 'offline'),
    'the sensor that stopped reporting must say so',
  );
  // And the summary is not green while one sensor is dark.
  assert.notEqual(body.safety.severity, 'normal');
});

test('no monitoring coverage pairs with information, never with normal', async () => {
  await harness.reseed();
  await harness.applyScenario('mob-08-safety-overview', 'no-installed-sensors');

  const body = (
    await harness.app.inject({
      method: 'GET',
      url: `${BASE}/safety/overview?unitId=${UNIT}`,
      headers: { authorization: harness.token(RESIDENT) },
    })
  ).json();

  assert.equal(body.safety.monitoringCoverage, 'none');
  assert.equal(body.safety.severity, 'information');
  assert.deepEqual(body.installedServices, []);

  // The database refuses the wrong pairing too, so the rule cannot be broken by a
  // future writer that bypasses the API.
  await assert.rejects(
    harness.admin.query(
      `UPDATE home_safety.unit_safety_state SET severity = 'normal' WHERE unit_id = $1`,
      [UNIT],
    ),
    /coverage_none_pairs_with_information/,
  );
});

test('the same safety projection appears on Home and on the safety overview', async () => {
  // One source, one shape. Two screens cannot disagree about whether a home is safe.
  await harness.reseed();
  await harness.applyScenario('mob-08-safety-overview', 'sensor-offline');
  const headers = { authorization: harness.token(RESIDENT), 'x-pemo-dev-now': '2026-08-13T10:00:00+08:00' };

  const home = (await harness.app.inject({ method: 'GET', url: `${BASE}/home?unitId=${UNIT}`, headers })).json();
  const overview = (
    await harness.app.inject({ method: 'GET', url: `${BASE}/safety/overview?unitId=${UNIT}`, headers })
  ).json();

  assert.deepEqual(home.safety, overview.safety);
});

test('the envelope carries correlation, and occurrence is never substituted by receipt', async () => {
  await harness.reseed();
  await harness.applyScenario('mob-08-safety-overview', 'default');

  const correlationId = 'aabbccdd-0000-4000-8000-00000000beef';
  const body = (
    await harness.app.inject({
      method: 'GET',
      url: `${BASE}/safety/overview?unitId=${UNIT}`,
      headers: { authorization: harness.token(RESIDENT), 'x-correlation-id': correlationId },
    })
  ).json();

  assert.equal(body.meta.correlationId, correlationId, 'a client-supplied correlation id must propagate');
  const { CONTRACT_VERSION } = await import('../../apps/api/dist/contract/contract-version.js');
  assert.equal(body.meta.contractVersion, CONTRACT_VERSION);

  // Occurrence and receipt are distinct fields, and receipt is never earlier.
  assert.notEqual(body.safety.observedAt, body.meta.generatedAt);
  assert.ok(new Date(body.safety.receivedAt) >= new Date(body.safety.observedAt));

  // Explicit offset, never a bare local time.
  for (const value of [body.meta.generatedAt, body.safety.observedAt, body.safety.receivedAt]) {
    assert.match(value, /(Z|[+-]\d{2}:\d{2})$/, `${value} has no explicit offset`);
  }
});

test('a malformed correlation identifier is replaced rather than propagated', async () => {
  await harness.reseed();
  const body = (
    await harness.app.inject({
      method: 'GET',
      url: `${BASE}/account`,
      headers: { authorization: harness.token(RESIDENT), 'x-correlation-id': 'not-a-uuid; drop table' },
    })
  ).json();

  assert.notEqual(body.meta.correlationId, 'not-a-uuid; drop table');
  assert.match(body.meta.correlationId, /^[0-9a-f-]{36}$/);
});
