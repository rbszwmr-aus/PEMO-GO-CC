/**
 * The resident boundary.
 *
 * Every response the API can produce is scanned against `forbidden-terms.json`
 * FROM THE PINNED CONTRACT — the same file API-005-ST and UI-007-ST read.
 *
 * `2IoThub` is a gateway that will carry any shape PEMO asks for, which makes it
 * materially EASIER to pass raw upstream data straight to a screen than a rigid
 * external schema would. This scan is the mechanical defence against that, and the
 * car-park terms are added on top because a parking space is a property object and
 * nothing about gates, plates, tariffs or occupancy belongs in PEMO.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readManifest, readFixture, startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';
import { loadBoundaryScanner } from '../../apps/api/dist/testing/boundary-scanner.js';
import { readContractFile } from '../../apps/api/dist/testing/contract-validator.js';

let harness: Harness;
test.before(async () => {
  harness = await startHarness();
});
test.after(async () => {
  await harness.close();
});

const scanner = await loadBoundaryScanner();
const RESIDENT = 'res_wfg_000412';
const UNIT = 'unit_wfg_a_12_a1';
const BASE = '/api/resident-mobile/v0';

test('no live response carries a denied term', async () => {
  await harness.reseed();
  await harness.applyScenario('mob-08-safety-overview', 'default');
  await harness.applyScenario('mob-09-safety-event-detail', 'default');

  const headers = { authorization: harness.token(RESIDENT) };
  const urls = [
    `${BASE}/home?unitId=${UNIT}`,
    `${BASE}/services?unitId=${UNIT}`,
    `${BASE}/safety/overview?unitId=${UNIT}`,
    `${BASE}/safety/events/evt_20260813_smoke01`,
    `${BASE}/account`,
  ];

  for (const url of urls) {
    const response = await harness.app.inject({ method: 'GET', url, headers });
    const findings = scanner.scan(response.json(), url);
    assert.deepEqual(
      findings,
      [],
      `${url} leaked: ${findings.map((f) => `${f.path} (${f.group})`).join(', ')}`,
    );
  }
});

test('the car-park boundary holds in the schema as well as the response', async () => {
  // The test from ADR-003: if a field would need to know whether a car is parked,
  // or whether a barrier should lift, it does not belong in PEMO.
  const columns = await harness.admin.query<{ table_schema: string; table_name: string; column_name: string }>(
    `SELECT table_schema, table_name, column_name
       FROM information_schema.columns
      WHERE table_schema IN ('platform', 'property', 'resident', 'home_safety')`,
  );

  const normalise = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');
  /**
   * The terms come FROM THE PINNED DENYLIST, not from a local copy.
   *
   * GEN-006-ST carried them locally because the pinned file did not contain them
   * yet; API-016-ST confirmed they have been folded in, so the carry is removed
   * and this test reads the same file the response scan reads. Two sources of
   * truth for one set is the condition the denylist exists to remove — and the
   * local copy would have been the one that silently stopped matching.
   *
   * Note what this test does that the response scan cannot: it looks at COLUMN
   * NAMES. A car-park operational concept could exist in the schema for a long
   * time before any response carried it, and the scan over responses would see
   * nothing.
   */
  const forbidden = (await readContractFile('forbidden-terms.json')) as {
    forbiddenPropertyNames: Record<string, { terms: string[] }>;
  };
  const carParkTerms = forbidden.forbiddenPropertyNames['carParkOperations']?.terms ?? [];
  assert.ok(carParkTerms.length > 0, 'the pinned denylist must carry the car-park group');

  const denied = new Set(carParkTerms.map(normalise));

  const offenders = columns.filter((c) => denied.has(normalise(c.column_name)));
  assert.deepEqual(
    offenders.map((c) => `${c.table_schema}.${c.table_name}.${c.column_name}`),
    [],
    'a car-park operational concept reached the schema',
  );
});

test('the fixture corpus still passes the same scan', async () => {
  // If a future contract version leaks a term, this fails here rather than in a
  // screen. The denylist is not edited to make a build pass: a term that genuinely
  // needs to reach a resident is an API-005-ST change and a recorded decision.
  const manifest = await readManifest();
  for (const entry of manifest.fixtures) {
    if (entry.file === null) continue;
    const body = await readFixture(entry.file);
    assert.deepEqual(scanner.scan(body, entry.file), [], `${entry.file} carries a denied term`);
  }
});

/**
 * G4 REGRESSION — the mechanism that reddened a suite at random, and the fix.
 *
 * `hk-mobile-number` is `\b[456789]\d{7}\b`. A canonically formatted UUID
 * contains a matching run of eight digits about 1.4% of the time, and every
 * response carries a minted `meta.correlationId`, so any run scanning live
 * responses had a per-run chance of one test going red with nothing wrong.
 *
 * Measured in the tree where it was live (669d2ae): 6.81% per suite-equivalent
 * run over 2,000 scanned responses, and reproduced as an actual red suite twice
 * in 45 runs of this very test file.
 *
 * The fix is that a canonical UUID is an identifier, not prose, and is not
 * scanned as prose. This test fails without it.
 */
test('G4 — a UUID that matches the phone-number pattern produces no finding', async () => {
  const scanner = await loadBoundaryScanner();

  // A real correlation id captured from the reproduction. `43701916` is eight
  // digits beginning with 4, so it matches the pattern exactly.
  const TRIPPING_UUID = '43701916-7913-4168-ac6e-7ea97ad151e6';
  assert.match(TRIPPING_UUID, /\b[456789]\d{7}\b/, 'the probe value must actually trip the pattern');

  const body = { meta: { correlationId: TRIPPING_UUID, contractVersion: '0.3.0' } };
  assert.deepEqual(
    scanner.scan(body, 'g4-regression'),
    [],
    'a UUID is an identifier and must not be scanned as prose',
  );

  // The decision is a CLASS — prose patterns do not apply to machine-minted
  // identifiers — so a UUID carried INSIDE a larger identifier is covered too.
  // `ack_<uuid>` is already immune because `_` is a word character; a
  // hyphen-separated carrier is not, and nothing stops somebody minting one.
  for (const carrier of [
    `req-${TRIPPING_UUID}`,
    `${TRIPPING_UUID}-retry`,
    `ack_${TRIPPING_UUID}`,
  ]) {
    assert.deepEqual(
      scanner.scan({ meta: { requestId: carrier } }, 'g4-carrier'),
      [],
      `an identifier carrying a UUID must not be scanned as prose: ${carrier}`,
    );
  }

  // And redaction rather than skipping: a genuine leak in the SAME string as an
  // identifier is still caught, so the exclusion cannot be used as a hiding place.
  assert.ok(
    scanner.scan({ note: `ref ${TRIPPING_UUID} call 91234567` }, 'g4-hiding-place').length > 0,
    'a real phone number alongside an identifier must still be caught',
  );

  // And the guard is narrow: a string that really does look like a Hong Kong
  // mobile number is still caught, so the fix did not disable the pattern.
  const realLooking = { resident: { phone: '91234567' } };
  assert.ok(
    scanner.scan(realLooking, 'g4-control').length > 0,
    'the pattern must still catch a genuine phone-shaped value',
  );
});
