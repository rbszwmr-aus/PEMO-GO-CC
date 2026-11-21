/**
 * The MANAGEMENT boundary scan (ADR-007 D3, tier 2), and the second G4 closed
 * before it exists.
 *
 * PRE-REGISTERED, NOT DISCOVERED. `tests/contract/PARITY-STEP-CRITERIA.md` records
 * this as an acceptance criterion written during B6: `hk-mobile-number` sits in
 * the management denylist at the same measured 1.483% against a canonical UUID,
 * and the management surface mints `meta.correlationId` for every response
 * exactly as the resident surface does. A management scanner without identifier
 * redaction inherits G4 verbatim — a suite that reddens at random, often enough
 * to recur and rarely enough that green re-runs look like proof.
 *
 * G4 cost a full investigation to close once: four patterns enumerated against
 * 20,000 UUIDs, 2,000 in-process scans, 45 targeted runs to reproduce it twice.
 * This is the same defect costing one test.
 *
 * TWO SCANS, NOT ONE SCAN WITH A ROLE PARAMETER. ADR-007 D2 chose separate
 * packages so each surface's scan is unconditional within it. The management
 * boundary does not RELAX the resident one, it INVERTS parts of it: estate staff
 * MUST see device and zone references, because dispatching somebody to a fault
 * requires naming the faulty thing. What is forbidden here is the next tier
 * down — raw payloads and correlation traces, which are integration support's.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { loadBoundaryScanner } from '../../apps/api/dist/testing/boundary-scanner.js';
import { readSurfaceContractFile } from '../../apps/api/dist/testing/contract-validator.js';

const managementScanner = () => loadBoundaryScanner([], 'management');

test('the management denylist is a different list from the resident one', async () => {
  const management = (await readSurfaceContractFile('management', 'forbidden-terms.json')) as {
    surface: string;
    forbiddenPropertyNames: Record<string, { terms: string[] }>;
  };
  const resident = (await readSurfaceContractFile('resident', 'forbidden-terms.json')) as {
    forbiddenPropertyNames: Record<string, { terms: string[] }>;
  };

  assert.equal(management.surface, 'management');

  // The inversion, asserted rather than assumed: a device reference is forbidden
  // to a resident and permitted to staff.
  const residentTerms = new Set(
    Object.values(resident.forbiddenPropertyNames).flatMap((g) => g.terms),
  );
  const managementTerms = new Set(
    Object.values(management.forbiddenPropertyNames).flatMap((g) => g.terms),
  );

  assert.ok(residentTerms.has('deviceid'), 'a resident may never see a device identifier');
  assert.ok(!managementTerms.has('deviceid'), 'estate staff must be able to see one');

  // And the tier below is forbidden here.
  assert.ok(
    [...managementTerms].some((t) => t.includes('correlation') || t.includes('payload')),
    'correlation traces and raw payloads belong to integration support',
  );
});

test('G4 pre-registered — the management scanner redacts identifiers', async () => {
  const scanner = await managementScanner();

  // The same real correlation id that reproduced G4 on the resident surface.
  // `43701916` is eight digits beginning with 4, so it matches hk-mobile-number.
  const TRIPPING_UUID = '43701916-7913-4168-ac6e-7ea97ad151e6';
  assert.match(TRIPPING_UUID, /\b[456789]\d{7}\b/, 'the probe value must actually trip the pattern');

  const body = { meta: { correlationId: TRIPPING_UUID, contractVersion: '0.1.0' } };
  assert.deepEqual(
    scanner.scan(body, 'management-g4'),
    [],
    'a UUID is an identifier and must not be scanned as prose on this surface either',
  );

  // The class, not the shape: a UUID carried inside a larger identifier.
  for (const carrier of [`req-${TRIPPING_UUID}`, `${TRIPPING_UUID}-retry`]) {
    assert.deepEqual(scanner.scan({ meta: { requestId: carrier } }, 'management-carrier'), []);
  }

  // Redaction, not a skip: a genuine leak sharing a field with an identifier is
  // still caught, so the exclusion cannot become a hiding place.
  assert.ok(
    scanner.scan({ note: `ref ${TRIPPING_UUID} call 91234567` }, 'management-hiding-place').length > 0,
    'a real phone number alongside an identifier must still be caught',
  );
});

test('G4 pre-registered — RED: without redaction the management scan fires', async () => {
  /**
   * The red condition on the management surface, so the criterion is proven here
   * and not inherited on trust from the resident test.
   *
   * The mutant applies the management denylist's own value patterns directly,
   * without redaction — which is what a scanner written from scratch for this
   * surface would have done.
   */
  const denylist = (await readSurfaceContractFile('management', 'forbidden-terms.json')) as {
    forbiddenValuePatterns: { name: string; pattern: string }[];
  };

  const TRIPPING_UUID = '43701916-7913-4168-ac6e-7ea97ad151e6';
  const withoutRedaction = denylist.forbiddenValuePatterns.filter((p) =>
    new RegExp(p.pattern).test(TRIPPING_UUID),
  );

  assert.ok(
    withoutRedaction.length > 0,
    'MUTANT: unredacted, this correlation id trips a management value pattern',
  );
  assert.equal(withoutRedaction[0]?.name, 'hk-mobile-number');

  // And the real scanner does not.
  const scanner = await managementScanner();
  assert.deepEqual(scanner.scan({ meta: { correlationId: TRIPPING_UUID } }, 'control'), []);
});

test('the measured rate is what makes this worth pre-registering', async () => {
  // Recorded as an executable figure rather than a sentence in a report: if the
  // rate ever changes — a new pattern, a different identifier shape — this fails
  // and someone re-reads the reasoning.
  const denylist = (await readSurfaceContractFile('management', 'forbidden-terms.json')) as {
    forbiddenValuePatterns: { name: string; pattern: string }[];
  };
  const hk = denylist.forbiddenValuePatterns.find((p) => p.name === 'hk-mobile-number');
  assert.ok(hk, 'the management denylist carries hk-mobile-number');

  const rx = new RegExp(hk.pattern);
  const { randomUUID } = await import('node:crypto');
  const N = 20_000;
  let hits = 0;
  for (let i = 0; i < N; i++) if (rx.test(randomUUID())) hits += 1;

  const rate = (hits / N) * 100;
  assert.ok(rate > 0.5 && rate < 3, `expected ~1.5%, measured ${rate.toFixed(2)}%`);
  console.log(`      management hk-mobile-number × UUID: ${rate.toFixed(2)}% — redaction is load-bearing`);
});
