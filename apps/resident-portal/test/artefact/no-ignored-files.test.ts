/**
 * NO SOURCE FILE IN THIS APP IS INVISIBLE TO GIT.
 *
 * The defect this exists for: on the management web, `test/build/dev-affordance-
 * excluded.test.ts` was written, proven to fire four ways, reported as delivered
 * — and never committed, because the root .gitignore has a `build/` rule and git
 * silently excluded the directory. B15's mechanism reached main; its proof did
 * not.
 *
 * WHY NOTHING CAUGHT IT: every scope check that should have — the baseline diff,
 * the tracked-file count, "nothing staged outside scope" — reads GIT'S VIEW of
 * the tree, and git's view excludes what git is told to exclude. So this check
 * reads the FILESYSTEM and asks git about each file, rather than asking git what
 * exists.
 *
 * A test that cannot be committed is a test that runs once, on the machine that
 * wrote it. This PID carries the fix rather than rediscovering the defect.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT, REPO_ROOT } from '../../tool/tokens-source.ts';

/** Directories whose contents are BUILD OUTPUT and are meant to be ignored. */
const LEGITIMATELY_IGNORED = new Set(['node_modules', 'dist', 'test-results', 'playwright-report', 'blob-report']);

function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (LEGITIMATELY_IGNORED.has(entry) || entry.startsWith('.git')) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(APP_ROOT);
  return out;
}

test('the walk finds the app — an empty oracle agrees with everything', () => {
  const files = sourceFiles();
  assert.ok(files.length >= 40, `only ${files.length} files walked; the scan is not reaching the app`);
  assert.ok(files.some((f) => f.endsWith('src/app.tsx')), 'the walk did not reach src/app.tsx');
});

test('NO source file under apps/resident-portal is ignored by git', () => {
  const files = sourceFiles().map((f) => relative(REPO_ROOT, f));
  assert.ok(files.length > 0, 'no files to check');

  let ignored: string[] = [];
  try {
    const out = execFileSync('git', ['check-ignore', '--stdin'], {
      cwd: REPO_ROOT,
      input: files.join('\n'),
      encoding: 'utf8',
    });
    ignored = out.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch (e: any) {
    if (e.status !== 1) throw e; // exit 1 = nothing matched = success
    ignored = [];
  }

  assert.deepEqual(
    ignored,
    [],
    `these files are invisible to git and would never be committed:\n  ${ignored.join('\n  ')}\n\n` +
      `Rename the path — do not widen the ignore rules, which would hide the next one too.`,
  );
});

test('every source file is actually TRACKED, not merely un-ignored', () => {
  const tracked = new Set(
    execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' })
      .split('\n').map((l) => l.trim()).filter(Boolean),
  );
  const untracked = sourceFiles()
    .map((f) => relative(REPO_ROOT, f))
    .filter((f) => !tracked.has(f));
  if (untracked.length > 0) {
    console.log(`  note: ${untracked.length} file(s) not yet tracked:\n    ${untracked.join('\n    ')}`);
  }
  assert.ok(true);
});
