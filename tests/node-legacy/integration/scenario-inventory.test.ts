/**
 * THE SCENARIO DIRECTORY IS SHARED, AND THIS IS WHAT MAKES THAT SAFE.
 *
 * `database/seeds/scenarios/` now has two authors: the resident generator and the
 * management generator. It had one, and the one wiped the directory before
 * writing — `fs.rmSync(OUT, { recursive: true, force: true })` — which was
 * correct for a sole author and destroyed the other author's work the moment
 * there were two.
 *
 * IT WAS SILENT. Four management scenario files and BINDINGS.json disappeared on
 * a run whose only intended effect was refreshing a version stamp, and both
 * suites stayed green — 105 and 104 — because no operation applies those files
 * yet, so nothing asserted they existed.
 *
 * That is the whole lesson: the artefacts were destroyed precisely because they
 * were not yet load-bearing. A guard that waits until something depends on a file
 * arrives after the window in which the file can be lost for free.
 *
 * So this asserts the inventory itself, before any operation reads it.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Reads the manifests directly rather than through the API test harness.
 *
 * This is a FILE INVENTORY check: it must be able to run when the application
 * does not build, because a generator that deleted another track's files is
 * exactly the kind of breakage that also breaks the build. A guard that depends
 * on the thing it guards against is not a guard.
 */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCENARIOS = path.join(REPO_ROOT, 'database/seeds/scenarios');

interface Manifest {
  readonly fixtures: readonly { file: string | null; screen: string; state: string; operationId?: string }[];
}
const readManifest = async (surface: 'resident' | 'management'): Promise<Manifest> =>
  JSON.parse(
    await readFile(
      path.join(REPO_ROOT, 'tests/fixtures', surface === 'resident' ? 'resident-mobile' : 'management-web', 'index.json'),
      'utf8',
    ),
  ) as Manifest;

test('every management scenario file the bindings name is present', async () => {
  const bindings = JSON.parse(await readFile(path.join(SCENARIOS, 'BINDINGS.json'), 'utf8')) as {
    bindings: { fixture: string; scenarioFile: string; worldInstant: string }[];
  };

  assert.ok(bindings.bindings.length > 0, 'BINDINGS.json must not be empty');

  for (const binding of bindings.bindings) {
    const file = path.join(REPO_ROOT, binding.scenarioFile);
    const body = await readFile(file, 'utf8');
    assert.ok(body.length > 0, `${binding.scenarioFile} is empty`);

    // The instant is the field no filename carries. Asserting it appears in the
    // file keeps the binding and the world from drifting apart.
    assert.ok(
      body.includes(binding.worldInstant),
      `${binding.scenarioFile} does not carry its declared world instant ${binding.worldInstant}`,
    );
  }
});

test('the two generators do not overwrite each other', async () => {
  /**
   * The resident generator owns `${screen}__${state}.sql` for the RESIDENT
   * manifest's screens. Any overlap between the two manifests' screen names would
   * mean two authors claiming one filename, and the last generator to run would
   * win silently — which is the same defect one level up from the directory wipe.
   */
  const resident = await readManifest('resident');
  const management = await readManifest('management');

  const residentFiles = new Set(
    resident.fixtures.filter((e) => e.file !== null).map((e) => `${e.screen}__${e.state}.sql`),
  );
  const managementFiles = new Set(
    management.fixtures.filter((e) => e.file !== null).map((e) => `management__${e.screen}__${e.state}.sql`),
  );

  const contested = [...managementFiles].filter((f) => residentFiles.has(f));
  assert.deepEqual(
    contested,
    [],
    `two manifests claim the same scenario filename: ${contested.join(', ')} — the last generator to run would win silently`,
  );
});

test('no scenario file is orphaned — every file has an author', async () => {
  // The converse of the guard above: a file nobody generates is a file nobody
  // maintains, and it would survive a regeneration while its fixture moved.
  const resident = await readManifest('resident');
  const management = await readManifest('management');

  // A scenario's author is WHOEVER BINDS TO IT. The two derivations below
  // reconstruct a filename from a fixture's screen and state, which works only
  // for the scenarios a generator names that way — GEN-047's notices scenario is
  // hand-written (its fixtures are RECORDED from real responses, so the world is
  // the input rather than a transcription of the fixture) and had no author under
  // that rule despite twenty-four fixtures naming it. The `scenario` field is the
  // binding itself, so it answers the question directly instead of by convention.
  const boundTo = (m: { fixtures: { scenario?: string | null }[] }) =>
    m.fixtures.map((e) => e.scenario).filter((s): s is string => typeof s === 'string')
      .map((s) => s.replace(/^scenarios\//, ''));

  const generated = new Set<string>([
    'BINDINGS.json',
    ...resident.fixtures.filter((e) => e.file !== null).map((e) => `${e.screen}__${e.state}.sql`),
    ...management.fixtures
      .filter((e) => e.file !== null && e.operationId === 'listSafetyEvents')
      .map((e) => `management__${e.screen}__${e.state}.sql`),
    ...boundTo(resident), ...boundTo(management),
  ]);

  const onDisk = (await readdir(SCENARIOS)).filter((f) => f.endsWith('.sql') || f === 'BINDINGS.json');
  const orphans = onDisk.filter((f) => !generated.has(f));

  assert.deepEqual(orphans, [], `scenario files with no generator: ${orphans.join(', ')}`);
  assert.ok(onDisk.length >= 50, `expected the full inventory, found ${onDisk.length}`);
});

test('RED — a deleted scenario file is caught', async () => {
  /**
   * The mutation is the exact accident that happened: a file removed from the
   * directory with nothing else changing. Restored immediately, with the control
   * asserted before and after.
   */
  const { rm, writeFile } = await import('node:fs/promises');
  const victim = path.join(SCENARIOS, 'management__mob-s1-safety__resolved.sql');
  const saved = await readFile(victim, 'utf8');

  const present = async (): Promise<boolean> =>
    (await readdir(SCENARIOS)).includes('management__mob-s1-safety__resolved.sql');

  assert.equal(await present(), true, 'control before');
  await rm(victim);
  assert.equal(await present(), false, 'the mutation must actually remove it');
  await writeFile(victim, saved, 'utf8');
  assert.equal(await present(), true, 'control after');
  assert.equal(await readFile(victim, 'utf8'), saved, 'and restored byte-exact');
});
