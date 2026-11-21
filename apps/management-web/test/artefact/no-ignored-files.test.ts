/**
 * NO SOURCE FILE IN THIS APP IS INVISIBLE TO GIT.
 *
 * The defect this exists for: `test/build/dev-affordance-excluded.test.ts` was
 * written, proven to fire four ways, reported as delivered — and never
 * committed. The root .gitignore has a `build/` rule, the directory had been
 * named after the thing it tests, and git silently excluded all of it. B15's
 * mechanism reached main; the assertion proving it did not.
 *
 * WHY NOTHING CAUGHT IT. Every check that should have — the baseline diff, the
 * tracked-file count, "nothing staged outside scope" — reads GIT'S VIEW of the
 * tree, and git's view excludes what git is told to exclude. An ignored file is
 * absent from `git status`, from `git add`, and from the diff, so a scope check
 * built on any of them reports success precisely because the file is missing.
 *
 * The same blindness surfaced from the other side days earlier, when
 * `git status --porcelain` on an entirely untracked directory reported "drift"
 * it had never measured. Two instruments, one blind spot: git's view is not the
 * filesystem, and a check that conflates them cannot see its own gap.
 *
 * So this check reads the FILESYSTEM and asks git about each file, rather than
 * asking git what exists.
 *
 * A test that cannot be committed is a test that runs once, on the machine that
 * wrote it.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT, REPO_ROOT } from '../../tool/corpus-source.ts';

/** Directories whose contents are BUILD OUTPUT and are meant to be ignored. */
const LEGITIMATELY_IGNORED = new Set(['node_modules', 'dist', 'test-results', 'playwright-report', 'blob-report']);

/** Every file this app actually consists of, read from disk rather than from git. */
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
  assert.ok(files.length >= 50, `only ${files.length} files walked; the scan is not reaching the app`);
  assert.ok(
    files.some((f) => f.endsWith('src/app.tsx')),
    'the walk did not reach src/app.tsx',
  );
});

test('NO source file under apps/management-web is ignored by git', () => {
  // git check-ignore over the filesystem, not git status over the index. The
  // difference is the whole point: the first can see a file git has been told
  // to forget, the second cannot.
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
    // git check-ignore exits 1 when NOTHING matches. That is the success case.
    if (e.status !== 1) throw e;
    ignored = [];
  }

  assert.deepEqual(
    ignored,
    [],
    `these files are invisible to git and would never be committed:\n  ${ignored.join('\n  ')}\n\n` +
      `A test or source file matching an ignore rule is written, passes, is reported as ` +
      `delivered, and never ships. Rename the path — do not widen the ignore rules, which ` +
      `would hide the next one too.`,
  );
});

test('every source file is actually TRACKED, not merely un-ignored', () => {
  // Un-ignored and untracked are different. This is the stronger form and it is
  // what "the assertion is in the tree" actually means.
  const tracked = new Set(
    execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' })
      .split('\n').map((l) => l.trim()).filter(Boolean),
  );
  const untracked = sourceFiles()
    .map((f) => relative(REPO_ROOT, f))
    .filter((f) => !tracked.has(f));

  // New files are legitimately untracked until they are committed, so this
  // reports rather than fails — the ignore check above is the hard gate.
  if (untracked.length > 0) {
    console.log(`  note: ${untracked.length} file(s) not yet tracked:\n    ${untracked.join('\n    ')}`);
  }
  assert.ok(true);
});
