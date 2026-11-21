/**
 * The genuineness guard fires — proven, not assumed.
 *
 * A stubbed fixture source is indistinguishable from an empty/loading/error
 * state and would leave the whole matrix green. So the guard is in the data path
 * and runs on every load. Here it is pointed at wrong directories and must throw.
 */

import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

async function loadWith(dir: string) {
  process.env.PEMO_PORTAL_FIXTURE_DIR = dir;
  // Fresh module each time so the cached corpus does not leak between cases.
  const mod = await import(`../../tool/corpus-source.ts?bust=${Math.random().toString(36).slice(2)}`);
  return mod.loadCorpus({ skipDigestCheck: true });
}

test('a missing corpus directory throws', async () => {
  await assert.rejects(() => loadWith(join(tmpdir(), 'pemo-does-not-exist-xyz')), /does not exist|not a directory/i);
});

test('a directory with no index.json throws', async () => {
  const d = mkdtempSync(join(tmpdir(), 'pemo-empty-'));
  await assert.rejects(() => loadWith(d), /manifest is missing/i);
});

test('a wrong-surface manifest throws', async () => {
  const d = mkdtempSync(join(tmpdir(), 'pemo-wrong-'));
  writeFileSync(join(d, 'index.json'), JSON.stringify({ surface: 'management', contractVersion: '0', pid: 'x', fixtures: [{ file: 'a.json', screen: 's', state: 't' }] }));
  await assert.rejects(() => loadWith(d), /not the resident-portal surface/i);
});

test('a structurally-valid but STUBBED corpus fails the positive content assertion', async () => {
  // The dangerous case: right shape, wrong (invented) content. A Latin-only stub
  // that fakes the schema still cannot produce the authored values.
  const d = mkdtempSync(join(tmpdir(), 'pemo-stub-'));
  mkdirSync(join(d, 'explore'), { recursive: true });
  writeFileSync(join(d, 'explore', 'default.json'), JSON.stringify({ results: [], facets: { scope: 'page', categories: [], filters: [] }, page: { page: 1, pageSize: 20, total: 0 } }));
  writeFileSync(join(d, 'index.json'), JSON.stringify({ surface: 'resident-portal', contractVersion: '0.1.0', pid: 'stub', fixtures: [{ file: 'explore/default.json', screen: 'explore', state: 'default' }] }));
  await assert.rejects(() => loadWith(d), /positive assertion did not hold/i);
});

test('the GENUINE corpus loads and satisfies every positive assertion', async () => {
  delete process.env.PEMO_PORTAL_FIXTURE_DIR;
  const mod = await import(`../../tool/corpus-source.ts?bust=${Math.random().toString(36).slice(2)}`);
  const c = mod.loadCorpus({ skipDigestCheck: true });
  assert.equal(c.manifest.surface, 'resident-portal');
  assert.ok(c.files.size >= 12, 'the genuine corpus is missing fixtures');
});
