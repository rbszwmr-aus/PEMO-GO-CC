/**
 * The development affordance is EXCLUDED FROM THE BUILD, and this asserts it
 * over the build OUTPUT.
 *
 * Why the output and not the behaviour: "the toolbar does not render" is a
 * RUN-TIME claim about a BUILD-TIME property. It would still pass if the code
 * shipped and something merely decided not to run it — which is exactly the
 * shape of GEN-013-ST B6, where the `x-pemo-dev-now` seam shipped, was "off",
 * and was demonstrated to reach verify() and accept an expired credential.
 *
 * The question this asks is not "is it disabled" but "is it there".
 *
 * IT LIVES IN test/artefact/ AND NOT test/build/.
 *
 * It was written under `test/build/` — named after the thing it tests — and the
 * root .gitignore's `build/` rule swallowed the whole directory. The assertion
 * was written, proven to fire four ways, reported as delivered, and never
 * committed: B15's MECHANISM reached main and its PROOF did not.
 *
 * The scope check that should have caught it read git's view of the tree, and
 * git's view excludes what git is told to exclude. test/artefact/no-ignored-
 * files.test.ts is the class-level fix; this rename is the instance.
 *
 * The check reads an external artefact, so it first proves the artefact exists,
 * is non-trivial, and that the needle is findable at all. An empty oracle agrees
 * with everything, and a grep over a file that does not exist finds nothing very
 * convincingly.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT } from '../../tool/corpus-source.ts';
import { DEV_TOOLBAR_SENTINEL } from '../../src/shell/dev-toolbar-sentinel.ts';

const DIST = join(APP_ROOT, 'dist');
const SRC_MODULE = join(APP_ROOT, 'src/shell/DevStateToolbar.tsx');

/** Every emitted JS bundle. Source maps are excluded — see the note below. */
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
  // Non-vacuity. If the sentinel were absent or renamed, the exclusion assertion
  // below would pass by looking for a string that never existed anywhere.
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
  // The load-bearing assertion. Several independent needles, because any one of
  // them could be renamed away while the affordance survived under another name.
  const needles = [
    DEV_TOOLBAR_SENTINEL,       // the module's unique marker
    'DevStateToolbar',          // the component identifier
    'state-select',             // the state picker's test id
    'screen-select',            // the screen picker's test id
    '__PEMO_DEV_TOOLBAR__',     // the constant itself must be substituted, not shipped
  ];

  const found: string[] = [];
  for (const { name, body } of bundles()) {
    for (const n of needles) if (body.includes(n)) found.push(`${name} contains ${JSON.stringify(n)}`);
  }

  assert.deepEqual(
    found,
    [],
    `the development affordance survived the production build:\n  ${found.join('\n  ')}\n\n` +
      `It must be build-EXCLUDED, not run-time-disabled. Code that ships and is merely ` +
      `switched off is one flag from being live — GEN-013-ST B6.`,
  );
});

test('the constant was substituted, not shipped as a variable', () => {
  // If `__PEMO_DEV_TOOLBAR__` reached the bundle as an identifier, the branch
  // would be decided at run time by something that could be defined. The whole
  // mechanism rests on the substitution having happened.
  for (const { name, body } of bundles()) {
    assert.ok(!body.includes('__PEMO_DEV_TOOLBAR__'), `${name} still references the constant by name`);
  }
});

test('source maps are not a back door for the affordance', () => {
  // A source map carries the original text. It is not executable and it is not
  // served to a browser that is not asked for it, but shipping one that contains
  // the excluded module means the artefact still describes it. Recorded rather
  // than asserted clean: this is a deployment decision, not a build defect.
  const assets = join(DIST, 'assets');
  const maps = readdirSync(assets).filter((f) => f.endsWith('.map'));
  const leaking = maps.filter((f) => readFileSync(join(assets, f), 'utf8').includes(DEV_TOOLBAR_SENTINEL));
  assert.deepEqual(
    leaking,
    [],
    `the sentinel appears in a source map: ${leaking.join(', ')}. The module was excluded from the ` +
      `executable bundle but its text still ships in the map. Either the exclusion is incomplete or ` +
      `source maps must not be deployed.`,
  );
});

test('the default define does not turn the workbench pickers on for serve', () => {
  // :5175 is `vite` (command serve). That used to substitute `true`, so the PT
  // demo showed Screen/State combos the production artefact does not have.
  // Opt-in is PEMO_DEV_TOOLBAR=1 at define time — still not a run-time flag.
  const src = readFileSync(join(APP_ROOT, 'vite.config.ts'), 'utf8');
  assert.ok(
    src.includes("process.env['PEMO_DEV_TOOLBAR'] === '1'"),
    'the toolbar define is no longer an explicit PEMO_DEV_TOOLBAR=1 opt-in',
  );
  assert.ok(
    !src.includes("command === 'serve' && !isPreview"),
    'vite --serve still enables the Screen/State pickers by default',
  );
});
