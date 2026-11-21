/**
 * R8: URL tokens are not ingested in a normal build, are stripped from the
 * address, and credentials are sent only to the configured API base.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  consumeUrlToken,
  credentialPolicy,
  liveBaseUrl,
  maySendCredentials,
  readLiveConfig,
  setCredentialPolicyForTests,
  setSessionToken,
  getSessionToken,
  stripTokenParam,
  writeLiveConfig,
  DEMO_LIVE_TOKEN,
} from '../../src/data/live-config.ts';
import { LiveManagementClient, LIVE_TREE_PATH } from '../../src/data/live-client.ts';

test.afterEach(() => {
  setCredentialPolicyForTests(undefined);
  setSessionToken('');
});

test('a normal build ignores any URL token and strips it from the query', () => {
  setCredentialPolicyForTests({ allowUrlDemoToken: false, configuredApiBase: '' });
  const q = new URLSearchParams('source=live&token=secret-value');
  const cfg = readLiveConfig(q);
  assert.equal(cfg.token, '');
  assert.equal(q.get('token'), null);
  assert.equal(getSessionToken(), '');
});

test('token=demo is ingested only when the demo flag is on, and is still stripped', () => {
  setCredentialPolicyForTests({ allowUrlDemoToken: true, configuredApiBase: '' });
  const q = new URLSearchParams('source=live&token=demo');
  const cfg = readLiveConfig(q);
  assert.equal(cfg.token, DEMO_LIVE_TOKEN);
  assert.equal(q.get('token'), null);
  assert.equal(getSessionToken(), DEMO_LIVE_TOKEN);
});

test('even with the demo flag, a non-demo URL token is refused and stripped', () => {
  setCredentialPolicyForTests({ allowUrlDemoToken: true, configuredApiBase: '' });
  const q = new URLSearchParams('token=staff-secret');
  const cfg = readLiveConfig(q);
  assert.equal(cfg.token, '');
  assert.equal(q.get('token'), null);
});

test('writeLiveConfig never puts a token back on the URL', () => {
  const q = new URLSearchParams();
  writeLiveConfig(q, { live: true, api: '', token: 'demo' });
  assert.equal(q.get('source'), 'live');
  assert.equal(q.get('token'), null);
  const leftover = new URLSearchParams('token=demo&source=live');
  writeLiveConfig(leftover, { live: true, api: '', token: 'demo' });
  assert.equal(leftover.get('token'), null);
});

test('stripTokenParam is idempotent', () => {
  const q = new URLSearchParams('screen=s3&token=x');
  assert.equal(stripTokenParam(q), true);
  assert.equal(stripTokenParam(q), false);
  assert.equal(q.get('screen'), 's3');
});

test('liveBaseUrl ignores an unapproved api= destination', () => {
  setCredentialPolicyForTests({ allowUrlDemoToken: false, configuredApiBase: '' });
  const origin = 'http://127.0.0.1:4173';
  assert.equal(
    liveBaseUrl({ live: true, api: 'https://evil.example', token: 'demo' }, origin),
    origin,
  );
  assert.equal(liveBaseUrl({ live: true, api: '', token: '' }, origin), origin);
});

test('liveBaseUrl accepts a configured API base, including a different port', () => {
  const origin = 'http://127.0.0.1:4173';
  const api = 'http://127.0.0.1:18080';
  setCredentialPolicyForTests({ allowUrlDemoToken: false, configuredApiBase: api });
  assert.equal(liveBaseUrl({ live: true, api, token: '' }, origin), api);
  assert.equal(liveBaseUrl({ live: true, api: api + '/', token: '' }, origin), api);
  assert.equal(liveBaseUrl({ live: true, api: 'https://evil.example', token: '' }, origin), api);
});

test('maySendCredentials is false for an unapproved origin', () => {
  setCredentialPolicyForTests({ allowUrlDemoToken: false, configuredApiBase: '' });
  const origin = 'http://127.0.0.1:4173';
  assert.equal(maySendCredentials(origin, origin), true);
  assert.equal(maySendCredentials('https://evil.example', origin), false);
});

test('the live client omits the bearer when the base is not the allowed origin', async () => {
  setCredentialPolicyForTests({ allowUrlDemoToken: false, configuredApiBase: 'http://api.allowed.test' });
  let sawAuth = 'unset';
  const client = new LiveManagementClient({
    baseUrl: 'https://evil.example',
    token: 'staff-token',
    pageOrigin: 'http://spa.test',
    fetch: async (_input, init) => {
      sawAuth = new Headers(init?.headers).get('Authorization') ?? 'absent';
      return new Response(JSON.stringify({ meta: {}, nodes: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  await client.getPropertyTree();
  assert.equal(sawAuth, 'absent', 'credentials must not be sent to an unapproved origin');
});

test('the live client still sends the bearer to the allowed base', async () => {
  setCredentialPolicyForTests({ allowUrlDemoToken: false, configuredApiBase: 'http://api.allowed.test' });
  let sawAuth = 'unset';
  let sawUrl = '';
  const client = new LiveManagementClient({
    baseUrl: 'http://api.allowed.test',
    token: 'staff-token',
    pageOrigin: 'http://spa.test',
    fetch: async (input, init) => {
      sawUrl = String(input);
      sawAuth = new Headers(init?.headers).get('Authorization') ?? 'absent';
      return new Response(JSON.stringify({ meta: {}, nodes: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  await client.getPropertyTree();
  assert.equal(sawAuth, 'Bearer staff-token');
  assert.equal(sawUrl, 'http://api.allowed.test' + LIVE_TREE_PATH);
});

test('a second initialiser run on the stripped URL keeps the session token', () => {
  setCredentialPolicyForTests({ allowUrlDemoToken: true, configuredApiBase: '' });
  setSessionToken('');
  const first = new URLSearchParams('source=live&token=demo');
  const once = readLiveConfig(first);
  assert.equal(once.token, DEMO_LIVE_TOKEN);
  assert.equal(first.get('token'), null);
  assert.equal(getSessionToken(), DEMO_LIVE_TOKEN);
  const second = new URLSearchParams(first.toString());
  const again = readLiveConfig(second);
  assert.equal(second.get('token'), null);
  assert.equal(getSessionToken(), DEMO_LIVE_TOKEN);
  assert.equal(again.token, DEMO_LIVE_TOKEN);
});

test('consumeUrlToken does not invent a demo token when the query has none', () => {
  setCredentialPolicyForTests({ allowUrlDemoToken: true, configuredApiBase: '' });
  assert.equal(consumeUrlToken(new URLSearchParams('source=live')), '');
  assert.equal(credentialPolicy().allowUrlDemoToken, true);
});
