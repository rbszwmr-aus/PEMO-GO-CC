/**
 * Live client: two GETs, staff credential, never a fabricated tree.
 *
 * Mapping tests use an injected fetch, so they do not depend on a server and
 * cannot go green by skipping. Live-against-API tests skip when no server is
 * configured, the same way resident-mobile's live suite does.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { APP_ROOT } from '../../tool/corpus-source.ts';
import { CORPUS } from '../../src/data/corpus.g.ts';
import {
  LIVE_SCOPE_PATH,
  LIVE_TREE_PATH,
  LiveManagementClient,
  type LiveResult,
} from '../../src/data/live-client.ts';
import { readLiveConfig, writeLiveConfig, liveBaseUrl } from '../../src/data/live-config.ts';
import type { Problem, PropertyTreeResponse } from '../../src/data/types.ts';

const problem401: Problem = {
  type: 'https://pemo.local/problems/invalid-credential',
  title: 'Invalid credential',
  status: 401,
  correlationId: '00000000-0000-4000-8000-000000000001',
  staffMessage: { en: 'This credential is not valid. Sign in again.', 'zh-Hant': '此憑證無效，請重新登入。' },
  retryable: false,
};

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('live config is off unless source=live', () => {
  assert.equal(readLiveConfig(new URLSearchParams('screen=s3&state=tree')).live, false);
  assert.equal(readLiveConfig(new URLSearchParams('source=live')).live, true);
});

test('live config round-trips on the URL and does not leak into fixture URLs', () => {
  const live = new URLSearchParams();
  writeLiveConfig(live, { live: true, api: 'http://127.0.0.1:18080', token: 'abc' });
  assert.equal(live.get('source'), 'live');
  assert.equal(live.get('api'), 'http://127.0.0.1:18080');
  assert.equal(live.get('token'), null, 'a credential must not be written back onto the URL');

  const fixture = new URLSearchParams({ screen: 's3', state: 'tree' });
  writeLiveConfig(fixture, { live: false, api: '', token: '' });
  assert.equal(fixture.get('source'), null);
  assert.equal(fixture.get('token'), null);
});

test('liveBaseUrl strips a trailing slash and falls back to the page origin', () => {
  assert.equal(liveBaseUrl({ live: true, api: '', token: '' }, 'http://127.0.0.1:4173'), 'http://127.0.0.1:4173');
  assert.equal(
    liveBaseUrl({ live: true, api: 'http://127.0.0.1:18080/', token: '' }, 'http://127.0.0.1:4173'),
    'http://127.0.0.1:4173',
    'an unconfigured api= on another origin is not a credential destination',
  );
});

test('a 200 tree is loaded, not rewritten from the corpus', async () => {
  const seen: string[] = [];
  const payload: PropertyTreeResponse = {
    meta: { correlationId: 'c', contractVersion: '0.1.5', generatedAt: '2026-08-26T00:00:00+08:00' },
    nodes: [{ node: { kind: 'estate', id: 'est_wing_fu_garden' }, label: { en: 'Wing Fu Garden', 'zh-Hant': '榮富花園' }, depth: 0, permittedActions: [] }],
  };
  const client = new LiveManagementClient({
    baseUrl: 'http://api.test',
    token: 'staff-token',
    fetch: async (input, init) => {
      seen.push(String(input));
      const auth = new Headers(init?.headers).get('Authorization');
      assert.equal(auth, 'Bearer staff-token');
      return jsonResponse(200, payload);
    },
  });
  const result = await client.getPropertyTree();
  assert.equal(result.kind, 'loaded');
  if (result.kind !== 'loaded') return;
  assert.equal(result.data.nodes[0]?.node.id, 'est_wing_fu_garden');
  assert.deepEqual(seen, ['http://api.test' + LIVE_TREE_PATH]);
});

test('no credential still calls the API and a 401 is a problem, not an empty tree', async () => {
  let sawAuth = 'unset';
  const client = new LiveManagementClient({
    baseUrl: 'http://api.test',
    token: '',
    fetch: async (_input, init) => {
      sawAuth = new Headers(init?.headers).get('Authorization') ?? 'absent';
      return jsonResponse(401, problem401);
    },
  });
  const result: LiveResult<PropertyTreeResponse> = await client.getPropertyTree();
  assert.equal(sawAuth, 'absent', 'a missing token must not mint a bearer header');
  assert.equal(result.kind, 'problem');
  if (result.kind !== 'problem') return;
  assert.equal(result.problem.status, 401);
  assert.equal(result.problem.type, 'https://pemo.local/problems/invalid-credential');
  assert.notEqual(result.kind, 'loaded');
});

test('a 401 body is the problem state, never a loaded empty node list', async () => {
  const client = new LiveManagementClient({
    baseUrl: 'http://api.test',
    token: 'resident-token',
    fetch: async () => jsonResponse(401, problem401),
  });
  const result = await client.getPropertyTree();
  assert.equal(result.kind, 'problem');
});

test('network failure is offline, not an empty tree', async () => {
  const client = new LiveManagementClient({
    baseUrl: 'http://api.test',
    token: 'staff-token',
    fetch: async () => {
      throw new TypeError('fetch failed');
    },
  });
  const result = await client.getScope();
  assert.equal(result.kind, 'offline');
});

test('the live client source calls only the operations this client wires', () => {
  // RE-POINTED AT UI-051. Part 1 asserted "the two allowed operations"; 2.1.0
  // added the notices reads and acts to the live seam. The wired set is now
  // ENUMERATED here and every other surface's path is still refused — a count
  // in a comment went stale twice on this file (UI-045 F2), so this lists.
  const src = readFileSync(join(APP_ROOT, 'src/data/live-client.ts'), 'utf8');
  const acts = readFileSync(join(APP_ROOT, 'src/data/notice-client.ts'), 'utf8');
  assert.match(src, /\/api\/management-web\/v0\/scope/);
  assert.match(src, /\/api\/management-web\/v0\/properties\/tree/);
  assert.match(src, /\/api\/management-web\/v0\/notices/);
  assert.match(src, /\/api\/management-web\/v0\/helpdesk\/queue/);
  assert.match(src, /\/api\/management-web\/v0\/helpdesk\/contacts/);
  assert.match(src, /\/api\/management-web\/v0\/strata\/charges/);
  assert.match(src, /\/api\/management-web\/v0\/strata\/payments/);
  assert.match(src, /\/api\/management-web\/v0\/admin\/email\/test/);
  assert.match(acts, /\/api\/management-web\/v0\/notices/);
  const forbidden = [
    '/overview',
    '/safety/events',
    '/properties/units',
    '/cases',
    '/visitors',
    '/bookings',
    '/grants',
    '/memberships',
    '/principals',
    '/organizations',
    '/residents',
    '/households',
  ];
  for (const path of forbidden) {
    assert.equal(src.includes(path), false, `live client must not mention ${path}`);
    assert.equal(acts.includes(path), false, `act client must not mention ${path}`);
  }
});

const liveUrl = process.env['PEMO_LIVE_BASE_URL'];
const staffToken = process.env['PEMO_LIVE_STAFF_TOKEN'] ?? '';
const residentToken = process.env['PEMO_LIVE_RESIDENT_TOKEN'] ?? '';

test('live API staff token: tree is Wing Fu Garden from Postgres, not the corpus file', { skip: !liveUrl || !staffToken }, async () => {
  const client = new LiveManagementClient({ baseUrl: liveUrl as string, token: staffToken });
  const result = await client.getPropertyTree();
  assert.equal(result.kind, 'loaded', JSON.stringify(result));
  if (result.kind !== 'loaded') return;
  const labels = result.data.nodes.map((n) => n.label.en);
  assert.ok(labels.includes('Wing Fu Garden'), 'estate label from the API');
  assert.ok(labels.includes('Block B'), 'Block B is in the seeded estate');
  const corpus = CORPUS['mob-s3-properties/tree.json'] as PropertyTreeResponse;
  const corpusLabels = corpus.nodes.map((n) => n.label.en);
  assert.equal(corpusLabels.includes('Block B'), true, 'control: the corpus tree now includes Block B');
  assert.ok(labels.includes('G/F'), 'live seed carries G/F floors for parking/storage');
  assert.equal(corpusLabels.includes('G/F'), false, 'control: corpus tree is residential-only, no G/F');
  assert.ok(result.data.nodes.some((n) => n.node.kind === 'unit' && n.label.en === 'A1'), 'live unit labels are the seeded A1 form');
  assert.ok(corpus.nodes.some((n) => n.node.kind === 'unit' && n.label.en === 'Flat A1'), 'control: corpus uses Flat A1');
  assert.ok(result.data.nodes.length > corpus.nodes.length, 'live tree is larger than the residential corpus (G/F)');
  assert.equal(result.data.nodes.some((n) => n.summary?.en === '3 blocks · 812 units'), false);
});

test('live API no credential: 401 problem, not a 200 empty tree', { skip: !liveUrl }, async () => {
  const client = new LiveManagementClient({ baseUrl: liveUrl as string, token: '' });
  const result = await client.getPropertyTree();
  assert.equal(result.kind, 'problem');
  if (result.kind !== 'problem') return;
  assert.equal(result.problem.status, 401);
  assert.match(result.problem.type, /invalid-credential/);
});

test('live API resident token: 401 problem, not a staff tree', { skip: !liveUrl || !residentToken }, async () => {
  const client = new LiveManagementClient({ baseUrl: liveUrl as string, token: residentToken });
  const result = await client.getScope();
  assert.equal(result.kind, 'problem');
  if (result.kind !== 'problem') return;
  assert.equal(result.problem.status, 401);
});
