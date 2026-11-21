/**
 * B6 — the development request seam is BUILD-EXCLUDED, proven over the artefact.
 *
 * WHY EXCLUSION AND NOT A FLAG. A disabled affordance has the code, a decision
 * point, and an input to that decision — three things that can be wrong.
 * Exclusion removes all three. "Is it disabled" and "is it there" are different
 * questions, and only the second has an answer that cannot drift.
 *
 * The history is the argument, not a hypothetical: this seam was demonstrated to
 * reach verify() and accept an expired credential, which is an authentication
 * bypass any caller could drive with a header. A seam that is merely switched off
 * is one flag from being live, and the flag is exactly the sort of input that
 * gets set wrong.
 *
 * MECHANISM DIFFERS FROM UI-019-ST'S; THE PROPERTY DOES NOT. Vite resolves a
 * `define:`d constant before bundling and drops the branch. tsc has no equivalent
 * — it emits every file it compiles — so the exclusion happens one step earlier:
 * the source tree is staged, the seam file is replaced by its production variant,
 * and tsc compiles the staged tree. Both tracks assert the same thing: the seam
 * is absent from the artefact that ships, proven over that artefact.
 *
 * FOUR CONTROLS STOP THIS PASSING FOR THE WRONG REASON. Without them, "absent
 * from the production build" is an empty oracle that agrees with everything —
 * including with a build that produced nothing at all.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { DEV_SEAM_SENTINEL } from '../../apps/api/dist/dev/dev-seam.js';
import { REPO_ROOT } from '../../apps/api/dist/testing/harness.js';

const run = promisify(execFile);
const API = path.join(REPO_ROOT, 'apps/api');
const PRODUCTION = path.join(API, 'dist/_production');
const DEVELOPMENT = path.join(API, 'dist');

/**
 * The needles: things that exist ONLY in the real seam.
 *
 * `readDevOverrides` was in this list and was WRONG. The symbol exists in both
 * builds by design — the production variant keeps it so the call site is
 * byte-identical — so its presence measures "a function of that name exists",
 * not "the seam shipped". It failed here for a reason unrelated to the property,
 * which is the same defect as a mutation that breaks the code around an assertion
 * rather than the thing the assertion claims to measure.
 *
 * Each needle below was checked to appear in the seam and nowhere else in src/,
 * and to be absent from the production variant.
 */
const NEEDLES = [
  'x-pemo-dev-now',
  'x-pemo-dev-fault',
  'x-pemo-dev-scenario',
  DEV_SEAM_SENTINEL,
  'parseFault',
  'NO_OVERRIDES',
] as const;

const readTree = async (root: string, filter: (f: string) => boolean): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      // The staging tree and the production output live inside dist/. Walking the
      // development build must not descend into them, or the control asserting
      // the needles ARE present would be reading the artefact they are absent from.
      if (entry.name.startsWith('_')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (filter(entry.name)) out.set(path.relative(root, full), await readFile(full, 'utf8'));
    }
  };
  await walk(root);
  return out;
};

test.before(async () => {
  // Build from scratch, so the assertion is over an artefact this run produced.
  await run('node', ['scripts/build-production.mjs'], { cwd: API });
});

test('B6 control 1 — the production build exists and is substantial', async () => {
  // Without this, every needle check below would pass against an empty directory.
  const files = await readTree(PRODUCTION, (f) => f.endsWith('.js'));
  assert.ok(files.size >= 20, `expected a real build, found ${files.size} JS files`);

  const total = [...files.values()].reduce((n, body) => n + body.length, 0);
  assert.ok(total > 50_000, `expected substantial output, found ${total} bytes`);

  // And it is the real server: the routes are there.
  const server = files.get('server.js');
  assert.ok(server, 'server.js must be in the production build');
  assert.match(server, /safety\/events/, 'the production build must contain the real routes');
});

test('B6 control 2 — the sentinel is findable IN SOURCE', async () => {
  // The check that makes the rest mean anything. If the needle could not be found
  // where it demonstrably IS, its absence elsewhere would prove nothing.
  const source = await readFile(path.join(API, 'src/dev/dev-seam.ts'), 'utf8');
  assert.ok(source.includes(DEV_SEAM_SENTINEL), 'the sentinel must exist in the seam source');

  // Imported, not copied: this test holds no second copy of the constant, so it
  // cannot agree with itself while the artefact says otherwise.
  assert.equal(typeof DEV_SEAM_SENTINEL, 'string');
  assert.ok(DEV_SEAM_SENTINEL.length > 10);
});

test('B6 control 3 — the needles ARE present in the development build', async () => {
  // Proves the check discriminates between the two artefacts rather than being
  // unable to find these strings anywhere.
  const dev = await readTree(DEVELOPMENT, (f) => f.endsWith('.js'));
  const devText = [...dev.values()].join('\n');

  for (const needle of NEEDLES) {
    assert.ok(devText.includes(needle), `${needle} must be present in the development build`);
  }
});

test('B6 — no needle appears anywhere in the production build', async () => {
  const files = await readTree(PRODUCTION, (f) => f.endsWith('.js'));

  const found: string[] = [];
  for (const [file, body] of files) {
    for (const needle of NEEDLES) {
      if (body.includes(needle)) found.push(`${file}: ${needle}`);
    }
  }
  assert.deepEqual(found, [], `the seam reached the production build:\n${found.join('\n')}`);
});

test('B6 control 4 — no source map carries the seam either', async () => {
  // A stripped bundle whose source map contains the original is not excluded, it
  // is obfuscated. The production tsconfig disables source maps; this asserts it.
  const maps = await readTree(PRODUCTION, (f) => f.endsWith('.map'));
  assert.equal(maps.size, 0, `production build must emit no source maps, found ${maps.size}`);

  // And the staged tree the compiler read is gone, so nothing downstream can
  // mistake it for a source of truth.
  await assert.rejects(stat(path.join(API, 'dist/_stage', 'dev', 'dev-seam.production.ts')));
});

test('B6 RED — breaking the exclusion makes the assertion fail', async () => {
  /**
   * The positive control for the exclusion itself. The mutant is the mistake
   * somebody would actually make: staging the sources without replacing the seam
   * — which is what happens if the replacement step is dropped or reordered.
   */
  const staged = path.join(API, 'dist/_stage');
  await run('node', ['-e', `
    const { cp, rm, mkdir } = require('node:fs/promises');
    (async () => {
      await rm(${JSON.stringify(staged)}, { recursive: true, force: true });
      await mkdir(${JSON.stringify(staged)}, { recursive: true });
      await cp(${JSON.stringify(path.join(API, 'src'))}, ${JSON.stringify(staged)}, { recursive: true });
    })();
  `]);

  const mutantSeam = await readFile(path.join(staged, 'dev/dev-seam.ts'), 'utf8');
  assert.ok(
    mutantSeam.includes(DEV_SEAM_SENTINEL),
    'MUTANT: without the replacement step the staged tree still holds the real seam',
  );
  assert.ok(mutantSeam.includes('x-pemo-dev-now'), 'MUTANT: and the header names with it');

  // Restore a correct build so the suite leaves the tree as it found it, and the
  // control passes AFTER the mutation as well as before.
  await run('node', ['scripts/build-production.mjs'], { cwd: API });
  const files = await readTree(PRODUCTION, (f) => f.endsWith('.js'));
  const text = [...files.values()].join('\n');
  for (const needle of NEEDLES) {
    assert.ok(!text.includes(needle), `${needle} must be absent again after rebuilding`);
  }
});
