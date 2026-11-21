/**
 * The inventory must not go stale.
 *
 * An inventory that silently misses a new assertion is worse than none: it
 * reports a small exposure with confidence. So every `test(...)` call site in
 * the suite has to appear in it, and the totals have to agree with what the
 * suites actually run.
 *
 * Same shape as every other guard here — the check reads an external source
 * (the test files), so it first asserts that source is non-empty and
 * recognisable. An empty oracle agrees with everything.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT } from '../../tool/corpus-source.ts';
import { INVENTORY, GUARD_ASSERTIONS, tally } from './inventory.ts';

/** Every `test(...)` call site in the suite, as `key` plus file. */
function callSites(): Array<{ key: string; file: string }> {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(test|spec)\.ts$/.test(e)) files.push(p);
    }
  };
  walk(join(APP_ROOT, 'test'));

  const out: Array<{ key: string; file: string }> = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\btest\(\s*(`[^`]*`|'[^']*')/g)) {
      out.push({ key: m[1] as string, file: relative(APP_ROOT, f) });
    }
  }
  return out;
}

test('the scanner finds the suite — an empty oracle agrees with everything', () => {
  const sites = callSites();
  assert.ok(sites.length >= 40, `only ${sites.length} call sites found; the scanner is not reaching the tests`);
  assert.ok(
    sites.some((s) => s.file.endsWith('state-matrix.spec.ts')),
    'the browser specs were not scanned',
  );
});

test('every assertion in the suite appears in the inventory', () => {
  const sites = callSites();
  const known = new Set(INVENTORY.map((e) => e.key));
  const missing = sites
    .filter((s) => !known.has(s.key))
    .map((s) => `${s.file}  ${s.key}`);
  assert.deepEqual(
    missing,
    [],
    `assertions exist that the inventory does not classify:\n  ${missing.join('\n  ')}\n` +
      `Add them to test/inventory/inventory.ts with their dependency class.`,
  );
});

test('the inventory contains nothing that no longer exists', () => {
  // The other direction. A stale entry inflates the structural count and hides
  // that something was deleted.
  const sites = new Set(callSites().map((s) => s.key));
  const orphaned = INVENTORY.filter((e) => !sites.has(e.key)).map((e) => `${e.file}  ${e.key}`);
  assert.deepEqual(orphaned, [], `the inventory classifies assertions that no longer exist:\n  ${orphaned.join('\n  ')}`);
});

test('the inventory totals agree with what the suites actually run', () => {
  // AGAINST THE RUNNER, NOT A TYPED TOTAL (UI-054 D5). This test used to assert
  // the inventory against numbers written into it — and stayed green through the
  // GEN-052 joint landing while the browser suite had grown by one, because the
  // data-dependent presence-gates loop collected a state nobody counted. A typed
  // total is a second inventory that can drift from the first.
  //
  // Browser: `playwright test --list` is what Playwright will run — loops expanded.
  // Node: node:test has no loops in this suite, so every call site is one test and
  // the call-site scan IS the runner's count; asserted equal to the inventory too.
  const list = execFileSync('npx', ['playwright', 'test', '--list'], { cwd: APP_ROOT, encoding: 'utf8', stdio: 'pipe' });
  const m = /Total: (\d+) tests? in (\d+) files?/.exec(list);
  assert.ok(m, 'playwright --list did not report a total; the runner is the oracle and it said nothing');
  const collected = Number(m![1]);
  assert.ok(collected > 100, `playwright collected only ${collected} tests`);

  const browser = INVENTORY.filter((e) => e.file.startsWith('test/browser')).reduce((a, e) => a + e.count, 0);
  assert.equal(browser, collected, `the inventory accounts for ${browser} browser assertions; Playwright collects ${collected}`);

  const nodeSites = callSites().filter((s) => !s.file.startsWith('test/browser')).length;
  const node = INVENTORY.filter((e) => !e.file.startsWith('test/browser')).reduce((a, e) => a + e.count, 0);
  assert.equal(node, nodeSites, `the inventory accounts for ${node} node assertions; the suite has ${nodeSites} call sites`);
});

test('every content-derived entry names its fixture field and expected literal', () => {
  // The class exists to make impact a lookup. An entry without a field and a
  // literal is a label, not a lookup.
  const bad = INVENTORY.filter((e) => e.cls === 'content-derived' && (!e.field || !e.expects))
    .map((e) => e.key);
  assert.deepEqual(bad, [], `content-derived entries missing field/expects:\n  ${bad.join('\n  ')}`);
});

test('the data-path guard assertions are inventoried too', () => {
  // These break the whole suite rather than one test, so omitting them would
  // understate the exposure precisely where it is worst.
  assert.ok(GUARD_ASSERTIONS.length >= 7);
  for (const g of GUARD_ASSERTIONS) {
    assert.ok(g.where.length > 0 && g.field.length > 0 && g.expects.length > 0, `incomplete guard entry: ${g.where}`);
  }
  assert.ok(
    GUARD_ASSERTIONS.some((g) => g.expects.includes('HS-2026-08-12-004417')),
    'the sharpest content-derived guard is not listed',
  );
});
