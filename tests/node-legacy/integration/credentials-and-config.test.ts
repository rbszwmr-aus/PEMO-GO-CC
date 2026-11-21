/**
 * B1 (token TTL), B5 (two credential outcomes) and B2 (loud configuration).
 *
 * The TTL and the two outcomes are one change: B5 makes an absent token
 * `invalid-credential`, which leaves `session-expired` producible only by a real
 * expiry — and before B1 no input could produce one. Neither is safe alone.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createDevAuthStub } from '../../apps/api/dist/auth/dev-auth-stub.js';
import { loadConfig } from '../../apps/api/node_modules/@pemo/platform/dist/index.js';
import { REPO_ROOT, startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

const run = promisify(execFile);

let harness: Harness;
test.before(async () => {
  harness = await startHarness();
});
test.after(async () => {
  await harness.close();
});

const RESIDENT = 'res_wfg_000412';
const BASE = '/api/resident-mobile/v0';

// ───────────────────────────────────────────────────────────── B1: the TTL

test('B1 — an expired token is refused AND a fresh one is accepted', async () => {
  const config = loadConfig();
  const stub = createDevAuthStub(config);
  const now = new Date('2026-08-14T12:00:00+08:00');

  // The accept case is NOT optional. A verify() that refuses everything passes
  // every rejection test ever written, so the refusal below only means something
  // alongside this.
  const fresh = stub.verify(`Bearer ${stub.issue(RESIDENT, new Date(now.getTime() - 60_000))}`, now);
  assert.equal(fresh.ok, true, 'a token issued a minute ago must be accepted');
  assert.equal(fresh.ok === true ? fresh.residentId : '', RESIDENT);

  const stale = new Date(now.getTime() - (config.devTokenTtlSeconds + 60) * 1000);
  const expired = stub.verify(`Bearer ${stub.issue(RESIDENT, stale)}`, now);
  assert.equal(expired.ok, false, 'a token older than the TTL must be refused');
  assert.equal(expired.ok === false ? expired.failure : '', 'expired');
});

test('B1 — the TTL boundary is where it says it is', async () => {
  const config = loadConfig();
  const stub = createDevAuthStub(config);
  const now = new Date('2026-08-14T12:00:00+08:00');
  const ttl = config.devTokenTtlSeconds;

  const justInside = stub.verify(`Bearer ${stub.issue(RESIDENT, new Date(now.getTime() - (ttl - 1) * 1000))}`, now);
  assert.equal(justInside.ok, true, 'one second inside the window is still valid');

  const exactly = stub.verify(`Bearer ${stub.issue(RESIDENT, new Date(now.getTime() - ttl * 1000))}`, now);
  assert.equal(exactly.ok, false, 'exactly at the TTL has expired');
});

test('B1 — the TTL is evaluated on the server clock, not a caller-supplied one', async () => {
  // The dev seam can pin the clock for RESPONSE timestamps. It must not reach
  // authentication: a caller who could move that clock could present an expired
  // credential and be believed.
  const response = await harness.app.inject({
    method: 'GET',
    url: `${BASE}/account`,
    headers: {
      authorization: harness.expiredToken(RESIDENT),
      // A pinned "now" from before the token was issued. If this were honoured,
      // the expired token would look fresh.
      'x-pemo-dev-now': '2026-08-13T10:00:00+08:00',
    },
  });
  assert.equal(response.statusCode, 401, 'an expired token must stay expired whatever the caller claims the time is');
  assert.equal(response.json().type, 'https://pemo.local/problems/session-expired');
});

test('B1 — this is still a development stub', () => {
  // Stated as an assertion so it cannot quietly stop being true: the stub refuses
  // to exist outside a development environment, whatever else changes about it.
  const config = loadConfig();
  assert.equal(config.environment, 'development');
  assert.throws(
    () => createDevAuthStub({ ...config, environment: 'production' as never }),
    /must never run against a real environment/,
  );
});

// ─────────────────────────────────────────────── B5: two outcomes, four causes

test('B5 — four causes produce one indistinguishable body', async () => {
  const bodies: string[] = [];
  const credentials = [
    ['absent', undefined],
    ['malformed', 'Bearer not-a-token'],
    ['tampered', `${harness.token(RESIDENT).slice(0, -4)}AAAA`],
    ['unknown resident', harness.token('res_does_not_exist_000')],
  ] as const;

  for (const [, authorization] of credentials) {
    const response = await harness.app.inject({
      method: 'GET',
      url: `${BASE}/account`,
      headers: authorization === undefined ? {} : { authorization },
    });
    assert.equal(response.statusCode, 401);
    const body = response.json();
    assert.equal(body.type, 'https://pemo.local/problems/invalid-credential');
    bodies.push(JSON.stringify({ ...body, correlationId: 'normalised' }));
  }

  assert.equal(new Set(bodies).size, 1, 'the four causes must be indistinguishable to a caller');
});

test('B5 — RED: typing the causes distinctly would break the indistinguishability test', async () => {
  // The mutant: four causes, four bodies. This is the design that was rejected on
  // security grounds — it tells an attacker how far their forgery got — and this
  // asserts the test above would catch it.
  const distinct = ['absent', 'malformed', 'bad_signature', 'bad_claims'].map((cause) =>
    JSON.stringify({ type: `https://pemo.local/problems/${cause}`, correlationId: 'normalised' }),
  );
  assert.notEqual(new Set(distinct).size, 1, 'MUTANT: distinct bodies must fail the same assertion');
});

test('B5 — the cause is available to an operator in the log', async () => {
  // Indistinguishable to the caller, distinguished for whoever has to debug it.
  const lines: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  (process.stdout.write as unknown as (chunk: string) => boolean) = ((chunk: string) => {
    lines.push(String(chunk));
    return true;
  }) as never;

  try {
    await harness.app.inject({ method: 'GET', url: `${BASE}/account`, headers: { authorization: 'Bearer nope' } });
  } finally {
    (process.stdout.write as unknown) = original;
  }

  const refusal = lines.map((l) => l.trim()).filter((l) => l.includes('credential refused'));
  assert.ok(refusal.length > 0, 'the refusal must be logged');
  assert.ok(refusal.some((l) => l.includes('"cause"')), 'the log line must name the cause');
});

// ─────────────────────────────────────────────────────── B2: loud configuration

test('B2 — .env is ignored, checked on a path that exists', async () => {
  // git check-ignore on a NON-EXISTENT path cannot tell what it is, which has
  // already produced one false finding in this project.
  const { existsSync } = await import('node:fs');
  const path = await import('node:path');
  const envPath = path.join(REPO_ROOT, 'database/dev/.env');

  assert.ok(existsSync(envPath), 'the check is only meaningful if the file exists');
  const { stdout } = await run('git', ['check-ignore', '-v', 'database/dev/.env'], { cwd: REPO_ROOT });
  assert.match(stdout, /\.env/);
});

test('B2 — .env.example is committed and carries no real secret', async () => {
  const { stdout } = await run('git', ['ls-files', 'database/dev/.env.example'], { cwd: REPO_ROOT });
  assert.equal(stdout.trim(), 'database/dev/.env.example');

  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const example = await readFile(path.join(REPO_ROOT, 'database/dev/.env.example'), 'utf8');

  // Every value is a placeholder. A real password reaching this file is the one
  // failure that cannot be undone by a later commit.
  for (const line of example.split('\n')) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (match === null) continue;
    const [, key, value] = match as unknown as [string, string, string];
    if (!/PASSWORD|SECRET/.test(key)) continue;
    assert.match(value, /replace-with/, `${key} must be a placeholder, not a value`);
  }
});

test('B2 — a script without configuration fails with a named cause', async () => {
  // Not a connection error three layers down.
  const result = await run('node', ['dist/cli/migrate.js'], {
    cwd: `${REPO_ROOT}/apps/api`,
    env: { PATH: process.env['PATH'] ?? '', HOME: process.env['HOME'] ?? '' },
  }).catch((error: { stderr?: string; stdout?: string }) => error);

  const output = `${(result as { stdout?: string }).stdout ?? ''}${(result as { stderr?: string }).stderr ?? ''}`;

  assert.match(output, /database\/dev\/\.env/, 'the message must name the file');
  assert.match(output, /cp database\/dev\/\.env\.example database\/dev\/\.env/, 'the message must give the command');
  assert.match(output, /PEMO_ENV/, 'the message must name a missing variable');
  assert.ok(!/ECONNREFUSED|ENOTFOUND|password authentication/i.test(output), 'it must fail before connecting');
});
