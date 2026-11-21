/**
 * G3 — migration numbers are a rollback dependency, not an ordering.
 *
 * GEN-012-ST numbered its migrations inside the subject-grouped blocks, below a
 * pre-existing 0090. Every file was individually correct and individually
 * reversible, and rolling the PID back still dropped a schema belonging to
 * somebody else's decision — because the runner reverses everything above a
 * floor. The defect existed only in the interaction between the numbering and the
 * runner, so reading found nothing and executing the down path found it at once.
 *
 * This is the cheap mechanical guard: a change's migrations must all sit above
 * every number that existed before it.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { REPO_ROOT } from '../../apps/api/dist/testing/harness.js';

const run = promisify(execFile);
const MIGRATIONS = path.join(REPO_ROOT, 'database/migrations');

const numberOf = (fileName: string): number => Number(fileName.slice(0, 4));

/**
 * Migration FILE NAMES present on the merge base.
 *
 * Keyed on the name and not the number, because numbers repeat across the
 * project's history: an intruder numbered 0001 would look pre-existing to a
 * number-keyed check, since 0001_platform_schema really does exist. The first
 * version of this guard did exactly that and its red condition caught it — which
 * is the argument for red conditions on guards as well as on features.
 */
/**
 * The guard's base is `origin/main`. On a shallow CI checkout that ref may not
 * exist, and `git merge-base` then throws a raw child_process error that reads as
 * a test failure — which is what it did on the runner (GEN-048 F3): a guard that
 * could not SEE its base reported a verdict about it. So this states the missing
 * base as a HARNESS error, named, never a stack trace.
 * `[a-parser-that-cannot-read-the-result-must-not-report-one]`, base-ref arm.
 */
class BaseRefUnavailable extends Error {}
const mergeBaseWithMain = async (): Promise<string> => {
  try {
    await run('git', ['rev-parse', '--verify', 'origin/main'], { cwd: REPO_ROOT });
  } catch {
    throw new BaseRefUnavailable(
      'origin/main is not available in this checkout, so the migration-numbering guard cannot see its '
      + 'base. Fetch it first: `git fetch origin main:refs/remotes/origin/main` (the workflow does, via '
      + 'fetch-depth: 0). This is a HARNESS condition, not a numbering violation.');
  }
  const { stdout } = await run('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: REPO_ROOT });
  return stdout.trim();
};

const preExistingFiles = async (): Promise<Set<string>> => {
  const base = await mergeBaseWithMain();
  const { stdout } = await run('git', ['ls-tree', '--name-only', base, '--', 'database/migrations/'], {
    cwd: REPO_ROOT,
  });
  return new Set(
    stdout
      .split('\n')
      .map((line) => path.basename(line.trim()))
      .filter((name) => name.endsWith('.up.sql')),
  );
};

const workingTreeNumbers = async (): Promise<{ name: string; number: number }[]> => {
  const names = (await readdir(MIGRATIONS)).filter((name) => name.endsWith('.up.sql'));
  return names.map((name) => ({ name, number: numberOf(name) }));
};

const introducedBelowTheMaximum = (
  pre: ReadonlySet<string>,
  current: readonly { name: string; number: number }[],
): string[] => {
  if (pre.size === 0) return [];
  const maximum = Math.max(...[...pre].map(numberOf));
  return current
    .filter((migration) => !pre.has(migration.name) && migration.number < maximum)
    .map((migration) => `${migration.name} is below the pre-existing maximum ${String(maximum).padStart(4, '0')}`);
};

test('G3 — every migration this change introduces is numbered above the pre-existing maximum', async () => {
  const violations = introducedBelowTheMaximum(await preExistingFiles(), await workingTreeNumbers());
  assert.deepEqual(violations, [], violations.join('\n'));
});

test('G3 — working-tree migration numbers are unique — two PIDs in one worktree cannot collide', async () => {
  /**
   * The assertion above answers "is this above main?" by baselining on
   * merge-base. It CANNOT see two PIDs in one worktree allocating the same number,
   * because neither is on main yet — which is exactly the GEN-005-SG defect class,
   * and exactly the risk when GEN-029-ST allocates a migration beside GEN-018-ST's
   * uncommitted 0110-0113.
   *
   * This one answers the other question: does any number appear twice in the
   * working tree? It is independent of merge-base — a collision is a collision
   * whether or not either file is on main. Named as discipline in GEN-029-ST's
   * plan; made the guard's job here, because discipline is what failed in
   * GEN-005-SG.
   */
  const numbers = (await workingTreeNumbers()).map((m) => m.number);
  const seen = new Map<number, number>();
  for (const n of numbers) seen.set(n, (seen.get(n) ?? 0) + 1);
  const collisions = [...seen.entries()].filter(([, count]) => count > 1).map(([n]) => n);
  assert.deepEqual(
    collisions,
    [],
    `migration numbers appear more than once in the working tree: ${collisions.map((n) => String(n).padStart(4, '0')).join(', ')}`,
  );
});

test('G3 — RED: a low-numbered migration is caught', async () => {
  // Proven by making it fail, with a real file on disk rather than a simulated
  // list — the check reads the directory, so anything less would test the helper
  // instead of the guard.
  const intruder = path.join(MIGRATIONS, '0001_platform_numbering_probe.up.sql');
  const intruderDown = path.join(MIGRATIONS, '0001_platform_numbering_probe.down.sql');

  await writeFile(intruder, '-- GEN-013-ST numbering probe. Removed by the test that created it.\nSELECT 1;\n');
  await writeFile(intruderDown, '-- GEN-013-ST numbering probe.\nSELECT 1;\n');

  try {
    const violations = introducedBelowTheMaximum(await preExistingFiles(), await workingTreeNumbers());
    assert.equal(violations.length, 1, 'the guard must see exactly the intruder');
    assert.match(violations[0] ?? '', /0001_platform_numbering_probe/);
  } finally {
    await unlink(intruder);
    await unlink(intruderDown);
  }

  // And the tree is clean again, so the probe cannot outlive the assertion.
  const after = introducedBelowTheMaximum(await preExistingFiles(), await workingTreeNumbers());
  assert.deepEqual(after, []);
});

test('G3 — the guard is not vacuous: it can see the migrations that exist', async () => {
  // A check whose input is empty passes forever. This asserts the input is real.
  const pre = await preExistingFiles();
  const current = await workingTreeNumbers();
  assert.ok(pre.size >= 26, `expected the pin's migrations, found ${pre.size}`);
  assert.ok(current.length >= pre.size);
});
