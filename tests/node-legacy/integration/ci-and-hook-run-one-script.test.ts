/**
 * THE WORKFLOW AND THE HOOK-BATTERY RUN ONE BUILD SCRIPT (GEN-048 R6).
 *
 * CI was red on `main` while every local rebuild was green, because prove.sh
 * built with a loop of its own while the workflow ran `pnpm --filter @pemo/api
 * build` on a tree that keeps nothing. This test forbids that drift: the
 * workflow's toolchain step must invoke `ci-preflight.sh` and nothing else for
 * the build, and prove.sh's --ci lane must invoke the same script. A change to
 * one build path that is not the shared script reds here.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string) => readFileSync(resolve(REPO, p), 'utf8');

test('the workflow toolchain step builds ONLY via ci-preflight.sh', () => {
  const wf = read('.github/workflows/governance.yml');
  // the toolchain step's run block
  const m = /- name: toolchain\n(?:.*\n)*?        run: \|\n((?:          .*\n)+)/.exec(wf);
  assert.ok(m, 'the toolchain step has no run block');
  const lines = m![1].split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  // corepack enable is allowed; the ONLY build command is ci-preflight.sh
  const build = lines.filter((l) => l !== 'corepack enable');
  assert.deepEqual(build, ['docs/governance/bin/ci-preflight.sh'],
    'the workflow builds by some path other than ci-preflight.sh — CI and the local gate would diverge again');
  // and it must NOT still carry the old loose commands
  assert.doesNotMatch(m![1], /pnpm --filter @pemo\/api build/, 'the old direct build command survives in the workflow');
});

test('prove.sh --ci delegates the build to ci-preflight.sh', () => {
  const prove = read('docs/governance/bin/prove.sh');
  assert.match(prove, /--ci.*\n(?:.*\n)*?.*ci-preflight\.sh/, 'prove.sh --ci does not call ci-preflight.sh');
});

test('ci-preflight keeps nothing and runs the runner commands verbatim', () => {
  const ci = read('docs/governance/bin/ci-preflight.sh');
  assert.match(ci, /-name node_modules -type d -prune.*-exec rm -rf/, 'ci-preflight does not remove node_modules');
  assert.match(ci, /name 'tsconfig\.tsbuildinfo'/, 'ci-preflight does not remove tsbuildinfo');
  assert.match(ci, /install --frozen-lockfile/, 'ci-preflight does not install --frozen-lockfile');
  assert.match(ci, /--filter @pemo\/api build/, 'ci-preflight does not run the exact build command');
  // the environment header (R8) — Node, pnpm, TZ, LANG in the first lines
  for (const k of ['node ', 'pnpm ', 'TZ ', 'LANG ']) assert.ok(ci.includes(k), `ci-preflight prints no ${k.trim()} in its header`);
});

test('the workflow reads its Node from .nvmrc, the same pin dev uses (R8)', () => {
  const wf = read('.github/workflows/governance.yml');
  assert.match(wf, /node-version-file: '\.nvmrc'/, 'the workflow hardcodes a Node version instead of reading .nvmrc');
  assert.doesNotMatch(wf, /node-version: '/, 'a hardcoded node-version survives — dev and CI can drift');
});
