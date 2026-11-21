/**
 * 052: GET /scope and GET /properties/tree against Postgres.
 *
 * Proves the two management reads exist, authenticate as staff, filter in the
 * query, and that the other eight management operations stay unregistered (getOverview left at GEN-064).
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

let harness: Harness;
test.before(async () => {
  harness = await startHarness();
});
test.after(async () => {
  await harness.close();
});

const BASE = '/api/management-web/v0';

/**
 * The version is read from the CONTRACT LOCK, not restated here.
 *
 * A literal broke twice for the same reason — a version-only bump is a change to
 * every file that restates it, and a restatement someone forgets is a silent
 * divergence between what the API claims to speak and what it was built against.
 * GEN-009's bump to 0.2.0 broke this assertion for exactly that reason.
 *
 * The LOCK rather than openapi.yaml deliberately: the server reads openapi.yaml,
 * so asserting against it would compare a value with itself. The lock is a
 * separate artifact that `validate.mjs` verifies against the contract, so this
 * stays a real cross-check — the response must agree with the pinned lock.
 */
const LOCKED_MANAGEMENT_VERSION = JSON.parse(
  readFileSync(
    path.join(REPO_ROOT, 'packages/api-contracts/management-web/contract-lock.json'),
    'utf8',
  ),
).contractVersion as string;


const MANAGER = 'stf_wfg_manager';
const BLOCK = 'stf_wfg_block_a';
const RESIDENT = 'res_wfg_000412';

const staffAuth = (principalId: string): { authorization: string } => ({
  authorization: `Bearer ${harness.modules.staffAuth.issue(principalId)}`,
});

test('staff credential: GET /scope is 200, nodes from the database, management contract version', async () => {
  const response = await harness.app.inject({
    method: 'GET',
    url: `${BASE}/scope`,
    headers: staffAuth(MANAGER),
  });
  assert.equal(response.statusCode, 200, response.body);
  const body = response.json() as {
    meta: { contractVersion: string };
    grants: readonly { kind: string; id: string }[];
    nodes: readonly { node: { kind: string; id: string } }[];
  };
  assert.equal(body.meta.contractVersion, LOCKED_MANAGEMENT_VERSION);
  assert.ok(
    body.nodes.some((n) => n.node.kind === 'estate' && n.node.id === 'est_wing_fu_garden'),
    'Wing Fu Garden estate node comes from Postgres',
  );
  assert.ok(
    body.nodes.some((n) => n.node.kind === 'location'),
    'ADR-003 locations are present on /scope',
  );
  assert.ok(body.grants.some((g) => g.kind === 'estate' && g.id === 'est_wing_fu_garden'));
});

test('staff credential: GET /properties/tree is 200, hierarchy nodes from the database', async () => {
  const response = await harness.app.inject({
    method: 'GET',
    url: `${BASE}/properties/tree`,
    headers: staffAuth(MANAGER),
  });
  assert.equal(response.statusCode, 200, response.body);
  const body = response.json() as {
    meta: { contractVersion: string };
    nodes: readonly { node: { kind: string; id: string } }[];
  };
  assert.equal(body.meta.contractVersion, LOCKED_MANAGEMENT_VERSION);
  assert.ok(body.nodes.some((n) => n.node.kind === 'estate' && n.node.id === 'est_wing_fu_garden'));
  assert.ok(body.nodes.some((n) => n.node.kind === 'building'));
  assert.ok(
    !body.nodes.some((n) => n.node.kind === 'location'),
    'property tree is the hierarchy, not locations',
  );
});

test('no credential: GET /scope is 401, not 200', async () => {
  const response = await harness.app.inject({ method: 'GET', url: `${BASE}/scope` });
  assert.equal(response.statusCode, 401, 'required fail: unauthenticated is 401');
  assert.notEqual(response.statusCode, 200);
  assert.equal(response.json().type, 'https://pemo.local/problems/invalid-credential');
});

test('no credential: GET /properties/tree is 401, not 200', async () => {
  const response = await harness.app.inject({ method: 'GET', url: `${BASE}/properties/tree` });
  assert.equal(response.statusCode, 401);
  assert.notEqual(response.statusCode, 200);
  assert.equal(response.json().type, 'https://pemo.local/problems/invalid-credential');
});

test('a resident token is not a staff principal on these routes', async () => {
  for (const path of [`${BASE}/scope`, `${BASE}/properties/tree`]) {
    const response = await harness.app.inject({
      method: 'GET',
      url: path,
      headers: { authorization: harness.token(RESIDENT) },
    });
    assert.equal(response.statusCode, 401, path);
    assert.equal(response.json().type, 'https://pemo.local/problems/invalid-credential', path);
  }
});

test('unknown scope on /properties/tree is 404 scope-not-found, not an empty 200', async () => {
  const response = await harness.app.inject({
    method: 'GET',
    url: `${BASE}/properties/tree?scope[kind]=estate&scope[id]=est_does_not_exist`,
    headers: staffAuth(MANAGER),
  });
  assert.equal(response.statusCode, 404, response.body);
  assert.notEqual(response.statusCode, 200);
  assert.equal(response.json().type, 'https://pemo.local/problems/scope-not-found');
});

test('another tenant estate on /properties/tree is 404, not an empty 200', async () => {
  const response = await harness.app.inject({
    method: 'GET',
    url: `${BASE}/properties/tree?scope[kind]=estate&scope[id]=est_harbour_view`,
    headers: staffAuth(MANAGER),
  });
  assert.equal(response.statusCode, 404, response.body);
  assert.equal(response.json().type, 'https://pemo.local/problems/scope-not-found');
});

test('a building-scoped principal does not receive the estate as a tree node', async () => {
  const response = await harness.app.inject({
    method: 'GET',
    url: `${BASE}/properties/tree`,
    headers: staffAuth(BLOCK),
  });
  assert.equal(response.statusCode, 200, response.body);
  const body = response.json() as { nodes: readonly { node: { kind: string; id: string } }[] };
  assert.ok(
    body.nodes.some((n) => n.node.kind === 'building' && n.node.id === 'blk_wfg_a'),
    'Block A is in scope',
  );
  assert.ok(
    !body.nodes.some((n) => n.node.kind === 'estate'),
    'a building grant does not expand upward to the estate',
  );
});

/**
 * AN INVENTORY OF WHAT IS NOT YET BUILT, and it shrinks by decision. `/notices`
 * left this list at GEN-043, when the notices read surface was implemented and
 * management-web went 2.0.0 — the entry is REMOVED rather than the assertion
 * loosened, so the list keeps meaning "contracted and deliberately unserved".
 */
test('the other management reads stay unregistered', async () => {
  const absent = [
    // `${BASE}/overview` LEFT this list at GEN-064 — getOverview is now implemented.
    `${BASE}/safety/events`,
    `${BASE}/safety/events/evt_does_not_exist`,
    `${BASE}/safety/events/evt_does_not_exist/delivery`,
    `${BASE}/safety/events/evt_does_not_exist/source`,
    `${BASE}/properties/units/unt_does_not_exist`,
    `${BASE}/visitors`,
    `${BASE}/bookings`,
  ];
  for (const url of absent) {
    const response = await harness.app.inject({
      method: 'GET',
      url,
      headers: staffAuth(MANAGER),
    });
    assert.equal(response.statusCode, 404, `${url} must stay unregistered`);
  }
});

test('GET /properties/tree nodes are nested preorder, not kind-grouped', async () => {
  const response = await harness.app.inject({
    method: 'GET',
    url: `${BASE}/properties/tree`,
    headers: staffAuth(MANAGER),
  });
  assert.equal(response.statusCode, 200, response.body);
  const body = response.json() as {
    nodes: readonly {
      node: { kind: string; id: string };
      parent: { kind: string; id: string } | null;
    }[];
  };
  const ids = body.nodes.map((n) => n.node.id);
  const estate = ids.indexOf('est_wing_fu_garden');
  const blockA = ids.indexOf('blk_wfg_a');
  const blockB = ids.indexOf('blk_wfg_b');
  const floorOfA = body.nodes.findIndex(
    (n) => n.node.kind === 'floor' && n.parent !== null && n.parent.id === 'blk_wfg_a',
  );
  assert.ok(estate >= 0, 'estate present');
  assert.ok(blockA > estate, 'Block A follows the estate');
  assert.ok(floorOfA > blockA, 'a Block A floor follows Block A');
  assert.ok(
    blockB > floorOfA,
    'kind-grouped (A, B, C, then every floor) is a fail: Block B must come after a Block A floor',
  );
});

test('GET /properties/tree sibling order is sequence then id: A before B before C', async () => {
  const response = await harness.app.inject({
    method: 'GET',
    url: `${BASE}/properties/tree`,
    headers: staffAuth(MANAGER),
  });
  assert.equal(response.statusCode, 200, response.body);
  const body = response.json() as {
    nodes: readonly {
      node: { kind: string; id: string };
      parent: { kind: string; id: string } | null;
      sequence?: number;
      label: { en: string };
    }[];
  };
  const wfgBuildings = body.nodes.filter(
    (n) => n.node.kind === 'building' && n.parent !== null && n.parent.id === 'est_wing_fu_garden',
  );
  assert.deepEqual(
    wfgBuildings.map((n) => n.node.id),
    ['blk_wfg_a', 'blk_wfg_b', 'blk_wfg_c'],
  );
  assert.deepEqual(
    wfgBuildings.map((n) => n.sequence),
    [1, 2, 3],
  );
  const bFloors = body.nodes.filter(
    (n) => n.node.kind === 'floor' && n.parent !== null && n.parent.id === 'blk_wfg_b',
  );
  assert.ok(bFloors.length > 0, 'Block B has floors in the live tree');
  const ordinals = bFloors.map((n) => n.sequence ?? -1);
  for (let i = 1; i < ordinals.length; i++) {
    assert.ok(ordinals[i]! >= ordinals[i - 1]!, 'floors ordered by sequence');
  }
  assert.equal(bFloors.some((n) => n.label.en === '4/F' || n.label.en === '13/F'), false);
});
