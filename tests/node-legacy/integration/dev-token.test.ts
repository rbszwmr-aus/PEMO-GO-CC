/**
 * THE DEV-TOKEN COMMAND REFUSES FOR THE RIGHT REASONS (GEN-050 D1).
 * Run as a real child process, so the refusal that is tested is the one a
 * person at a terminal would see — not an exported function's return value.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CLI = resolve(REPO, 'apps/api/dist/cli/dev-token.js');
const run = (args: string[], env: Record<string, string | undefined>) =>
  spawnSync('node', [CLI, ...args], { cwd: REPO, encoding: 'utf8', env: { ...process.env, ...env } });

test('a seeded principal gets a token that the stub itself verifies', async () => {
  const r = run(['stf_wfg_manager'], {});
  assert.equal(r.status, 0, r.stderr);
  const token = r.stdout.trim();
  assert.ok(token.length > 20, 'no token printed');
  const { loadConfig } = await import('../../modules/platform/dist/index.js');
  const { createStaffAuthStub } = await import('../../apps/api/dist/management/staff-auth-stub.js');
  const v = createStaffAuthStub(loadConfig()).verify(`Bearer ${token}`);
  assert.ok(v.ok && v.principalId === 'stf_wfg_manager', 'the printed token is not a staff credential for that principal');
});

test('without PEMO_ENV=development it is REFUSED by the platform guard, with its own words', () => {
  const r = run(['stf_wfg_manager'], { PEMO_ENV: 'production' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /PEMO_ENV must be exactly "development"/, 'the refusal is the config guard\'s, not a new one');
  assert.equal(r.stdout.trim(), '', 'and nothing token-shaped leaks to stdout');
});

test('an unknown principal is refused, and the refusal names NOTHING about other principals', () => {
  const r = run(['stf_nobody'], {});
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /unknown principal/);
  assert.doesNotMatch(r.stderr + r.stdout, /stf_wfg_|stf_hbv_/, 'an enumeration oracle: the message must not name any real principal');
  assert.equal(r.stdout.trim(), '');
});
