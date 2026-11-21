/**
 * The development affordance is EXCLUDED FROM THE BUILD, asserted over the build
 * OUTPUT.
 *
 * "The toolbar does not render" is a RUN-TIME claim about a BUILD-TIME property.
 * It would still pass if the code shipped and something merely decided not to run
 * it — the shape of GEN-013-ST B6, where the `x-pemo-dev-now` seam shipped, was
 * "off", and reached verify() and accepted an expired credential. The question
 * is not "is it disabled" but "is it there".
 *
 * IT LIVES IN test/artefact/ AND NOT test/build/. The root .gitignore has a
 * `build/` rule that swallowed exactly this test on the management web — its
 * mechanism reached main and its proof did not. test/artefact/no-ignored-files
 * is the class-level fix; this location is the instance.
 *
 * The check reads an external artefact, so it first proves the artefact exists,
 * is non-trivial, and that the needle is findable — an empty oracle agrees with
 * everything.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT } from '../../tool/tokens-source.ts';
import { DEV_TOOLBAR_SENTINEL } from '../../src/shell/dev-toolbar-sentinel.ts';

const DIST = join(APP_ROOT, 'dist');
const SRC_MODULE = join(APP_ROOT, 'src/shell/DevStateToolbar.tsx');

function bundles(): Array<{ name: string; body: string }> {
  const assets = join(DIST, 'assets');
  assert.ok(existsSync(assets), `dist/assets does not exist — run \`pnpm run build\` first`);
  return readdirSync(assets)
    .filter((f) => f.endsWith('.js'))
    .map((f) => ({ name: f, body: readFileSync(join(assets, f), 'utf8') }));
}

test('the build output exists and is non-trivial', () => {
  const b = bundles();
  assert.ok(b.length > 0, 'no JS bundle was emitted');
  const total = b.reduce((n, x) => n + x.body.length, 0);
  assert.ok(total > 50_000, `the bundle is only ${total} bytes; this is not a real build`);
});

test('the needle is findable — the sentinel really is in the source', () => {
  assert.ok(existsSync(SRC_MODULE), 'the dev toolbar module is missing');
  const src = readFileSync(SRC_MODULE, 'utf8');
  assert.ok(src.includes('DEV_TOOLBAR_SENTINEL'), 'the dev toolbar module no longer carries the sentinel');
  assert.ok(
    readFileSync(join(APP_ROOT, 'src/shell/dev-toolbar-sentinel.ts'), 'utf8').includes(DEV_TOOLBAR_SENTINEL),
    'the sentinel constant lost its value',
  );
  assert.ok(DEV_TOOLBAR_SENTINEL.length > 12, 'the sentinel is too short to be distinctive');
});

test('NO reference to the development toolbar survives the production build', () => {
  const needles = [
    DEV_TOOLBAR_SENTINEL,
    'DevStateToolbar',
    'dev-state-select',
    'dev-service-select',
    '__PEMO_DEV_TOOLBAR__',
  ];
  const found: string[] = [];
  for (const { name, body } of bundles()) {
    for (const n of needles) if (body.includes(n)) found.push(`${name} contains ${JSON.stringify(n)}`);
  }
  assert.deepEqual(
    found,
    [],
    `the development affordance survived the production build:\n  ${found.join('\n  ')}\n\n` +
      `It must be build-EXCLUDED, not run-time-disabled — GEN-013-ST B6.`,
  );
});

test('the constant was substituted, not shipped as a variable', () => {
  for (const { name, body } of bundles()) {
    assert.ok(!body.includes('__PEMO_DEV_TOOLBAR__'), `${name} still references the constant by name`);
  }
});

test('source maps are not a back door for the affordance', () => {
  const assets = join(DIST, 'assets');
  const maps = readdirSync(assets).filter((f) => f.endsWith('.map'));
  const leaking = maps.filter((f) => readFileSync(join(assets, f), 'utf8').includes(DEV_TOOLBAR_SENTINEL));
  assert.deepEqual(
    leaking,
    [],
    `the sentinel appears in a source map: ${leaking.join(', ')}. The module was excluded from the ` +
      `executable bundle but its text still ships in the map.`,
  );
});
