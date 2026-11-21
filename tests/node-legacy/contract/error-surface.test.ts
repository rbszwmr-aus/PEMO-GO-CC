/**
 * The error surface (B4 part 3, G5, A2).
 *
 * Fixtures hold responses somebody designed. Error bodies come from a framework
 * and a driver, and nobody authored them — which is why they were the surface
 * the boundary scan did not cover, and why a raw Postgres error reached a
 * resident-facing endpoint.
 *
 * Every case here is GENERATED from the endpoint surface rather than remembered.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';
import {
  loadContractValidator,
  readProblemTypeRegistry,
} from '../../apps/api/dist/testing/contract-validator.js';
import { loadBoundaryScanner } from '../../apps/api/dist/testing/boundary-scanner.js';
import { generateProvocations, type Provocation } from '../../apps/api/dist/testing/provocations.js';

let harness: Harness;
test.before(async () => {
  harness = await startHarness();
  await harness.applyScenario('mob-09-safety-event-detail', 'default');
  await harness.applyScenario('mob-08-safety-overview', 'default');
});
test.after(async () => {
  await harness.close();
});

const validator = await loadContractValidator();
const scanner = await loadBoundaryScanner();
const provocations = generateProvocations();

const RESIDENT = 'res_wfg_000412';

/**
 * Text that must never appear in a response body.
 *
 * Each entry is drawn from a leak that was actually reproduced, not imagined:
 * SQLSTATEs from the four probes, `relation`/`constraint` from the CHECK
 * violation that named a table, and the driver and stack markers from Fastify's
 * default error shape.
 */
const FORBIDDEN_IN_ERRORS: readonly { readonly pattern: RegExp; readonly what: string }[] = [
  { pattern: /\b22P02\b|\b22007\b|\b23514\b|\b23505\b|\b42P01\b/, what: 'a PostgreSQL SQLSTATE' },
  { pattern: /invalid input syntax/i, what: 'a driver parse message' },
  { pattern: /\brelation\b|\bconstraint\b|\bcolumn\b/i, what: 'a schema object kind' },
  { pattern: /home_safety|integration\.|property\.|resident\.|platform\./, what: 'a schema or table name' },
  { pattern: /\bat .+\(.+:\d+:\d+\)/, what: 'a stack frame' },
  { pattern: /node_modules|\/pg-pool\/|\bpg\b\/lib/, what: 'a driver path' },
  { pattern: /"statusCode":|"error":"Internal Server Error"/, what: "Fastify's default error shape" },
];

const credentialHeader = (provocation: Provocation): string | undefined => {
  switch (provocation.credential) {
    case 'valid':
      return harness.token(RESIDENT);
    case 'absent':
      return undefined;
    case 'malformed':
      return 'Bearer not-a-token';
    case 'tampered': {
      const real = harness.token(RESIDENT);
      return `${real.slice(0, -4)}AAAA`;
    }
    case 'expired':
      return harness.expiredToken(RESIDENT);
    case 'unknown-resident':
      return harness.token('res_does_not_exist_000');
  }
};

const inject = async (provocation: Provocation) => {
  const authorization = credentialHeader(provocation);
  return harness.app.inject({
    method: provocation.method,
    url: provocation.url,
    headers: authorization === undefined ? {} : { authorization },
    ...(provocation.payload === undefined ? {} : { payload: provocation.payload as never }),
  });
};

test(`the generated provocation list covers the endpoint surface`, () => {
  // If this number falls, something stopped being provoked.
  assert.ok(provocations.length >= 80, `only ${provocations.length} provocations generated`);
});

test('no provoked response leaks driver, SQL, schema or stack detail', async () => {
  const leaks: string[] = [];
  for (const provocation of provocations) {
    const response = await inject(provocation);
    for (const forbidden of FORBIDDEN_IN_ERRORS) {
      if (forbidden.pattern.test(response.body)) {
        leaks.push(`${provocation.label} → ${forbidden.what}`);
      }
    }
  }
  assert.deepEqual(leaks, [], `provoked responses leaked internals:\n${leaks.join('\n')}`);
});

test('every provoked error body is problem+json and validates as a Problem', async () => {
  const wrong: string[] = [];
  for (const provocation of provocations) {
    const response = await inject(provocation);
    if (response.statusCode < 400) continue;

    const contentType = (response.headers['content-type'] ?? '').toString().split(';')[0];
    if (contentType !== 'application/problem+json') {
      wrong.push(`${provocation.label} → ${response.statusCode} ${contentType}`);
      continue;
    }
    const errors = validator.validate('Problem', response.json());
    if (errors.length > 0) wrong.push(`${provocation.label} → ${errors.join('; ')}`);
  }
  assert.deepEqual(wrong, [], `non-conforming error bodies:\n${wrong.join('\n')}`);
});

test('every provoked status is declared by its operation', async () => {
  // The conformance assertion, driven by the GENERATED list. It runs in addition
  // to openapi-conformance.test.ts's hand-written cases, which are retained: the
  // generator produces cases nobody thought of, and the hand-written set holds
  // cases the generator does not produce.
  const undeclared: string[] = [];
  for (const provocation of provocations) {
    const response = await inject(provocation);
    if (!validator.declaresStatus(provocation.operationId, response.statusCode)) {
      undeclared.push(`${provocation.label} → ${response.statusCode} on ${provocation.operationId}`);
    }
  }
  assert.deepEqual(undeclared, [], `undeclared statuses:\n${undeclared.join('\n')}`);
});

test('the boundary scan covers runtime error responses', async () => {
  let scanned = 0;
  const findings: string[] = [];
  for (const provocation of provocations) {
    const response = await inject(provocation);
    if (response.statusCode < 400) continue;
    scanned += 1;
    const hits = scanner.scan(response.json(), provocation.label);
    for (const hit of hits) findings.push(`${provocation.label} ${hit.path} (${hit.group})`);
  }
  assert.deepEqual(findings, [], findings.join('\n'));
  assert.ok(scanned >= 70, `only ${scanned} error responses reached the scan`);
  console.log(`      boundary scan now covers ${scanned} distinct runtime error responses`);
});

test('RED — the error scan catches a leak that is put in front of it', async () => {
  // The check is only worth having if it would fail. Each pattern is exercised
  // against the exact text the four reproduced leaks produced.
  const realLeaks = [
    '{"statusCode":500,"code":"22P02","error":"Internal Server Error","message":"invalid input syntax for type uuid: \\"x\\""}',
    'new row for relation "acknowledgement" violates check constraint "acknowledgement_action_check"',
    '    at Object.query (/app/node_modules/pg-pool/index.js:45:11)',
  ];
  for (const leak of realLeaks) {
    const caught = FORBIDDEN_IN_ERRORS.some((forbidden) => forbidden.pattern.test(leak));
    assert.ok(caught, `the scan would not have caught: ${leak.slice(0, 60)}`);
  }
});

test('the two credential outcomes are exactly two, and the causes are indistinguishable', async () => {
  // B5. Four causes, one body. Telling a caller which one tells an attacker how
  // far their forgery got.
  const bodies = new Map<string, string>();
  for (const credential of ['absent', 'malformed', 'tampered', 'unknown-resident'] as const) {
    const response = await inject({
      operationId: 'getAccount',
      label: `account: ${credential}`,
      method: 'GET',
      url: '/api/resident-mobile/v0/account',
      credential,
    });
    assert.equal(response.statusCode, 401, `${credential} must be 401`);
    const body = response.json();
    assert.equal(body.type, 'https://pemo.local/problems/invalid-credential');
    bodies.set(credential, JSON.stringify({ ...body, correlationId: 'normalised' }));
  }
  assert.equal(new Set(bodies.values()).size, 1, 'the four causes must be indistinguishable in the response');

  // And the one distinction the client can act on IS distinguished.
  const expired = await inject({
    operationId: 'getAccount',
    label: 'account: expired',
    method: 'GET',
    url: '/api/resident-mobile/v0/account',
    credential: 'expired',
  });
  assert.equal(expired.statusCode, 401);
  assert.equal(expired.json().type, 'https://pemo.local/problems/session-expired');
});

test('A2 — every emitted Problem type URI is in the registry, for this surface', async () => {
  /**
   * REPOINTED at packages/api-contracts/problem-types.json, NOT deleted.
   *
   * ADR-009 created the registry and says this session-local assertion is
   * superseded by it. Superseded is not the same as redundant: the registry's
   * forward assertion scans FIXTURES, and `bad-request` and `invalid-credential`
   * have no fixture on any surface — they are emitted only by a running server.
   * Delete this and those two are checked by nothing at all: the contract-side
   * check cannot see them and the validator has no server to ask.
   *
   * So the expected set is now READ FROM THE REGISTRY rather than written here —
   * one source of truth, which is the condition the registry exists to create —
   * and this test remains the only thing that observes what the service actually
   * emits.
   */
  const registry = await readProblemTypeRegistry();

  const registeredForResident = new Set(
    Object.values(registry.types)
      .filter((entry) => entry.status === 'active' && entry.surfaces.includes('resident'))
      .map((entry) => entry.uri),
  );

  assert.ok(registeredForResident.size > 0, 'the registry must list resident types');

  const emitted = new Set<string>();
  for (const provocation of provocations) {
    const response = await inject(provocation);
    if (response.statusCode < 400) continue;
    const type = response.json().type;
    if (typeof type === 'string') emitted.add(type);
  }

  // FORWARD: everything the service emits is registered for this surface. A typo
  // fails here rather than in a client.
  const unregistered = [...emitted].filter((type) => !registeredForResident.has(type));
  assert.deepEqual(unregistered, [], `emitted but not registered for resident: ${unregistered.join(', ')}`);

  // And the two the registry's fixture-based check structurally cannot see: they
  // have no fixture, so this is the only place their emission is observed.
  for (const uri of [
    'https://pemo.local/problems/bad-request',
    'https://pemo.local/problems/invalid-credential',
  ]) {
    assert.ok(emitted.has(uri), `${uri} has no fixture, so this test is its only coverage`);
    assert.ok(registeredForResident.has(uri), `${uri} must be registered for the resident surface`);
  }
});
