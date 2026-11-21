#!/usr/bin/env node
/**
 * RUN THE INTEGRATION SUITE IN A STATED, REPRODUCIBLE FILE ORDER (GEN-057 F7).
 *
 * `*.test.ts` glob order is the filesystem's, which differs between machines and
 * runs — so the same commit was green once and red once. This lists the files in
 * a DECLARED order: sorted by default (deterministic), or shuffled by a SEED
 * (`--shuffle <seed>`) to prove order-INDEPENDENCE, which holds only if every
 * teardown owns exactly what it created. Always `--test-concurrency=1`: the run
 * is serialised, the stated cost of correctness (per-file schema isolation is a
 * 32-file refactor owed separately).
 */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DIR = resolve(REPO, 'tests/integration');
let files = readdirSync(DIR).filter((f) => f.endsWith('.test.ts')).sort();
const si = process.argv.indexOf('--shuffle');
if (si >= 0) {
  let seed = Number(process.argv[si + 1] ?? 1) || 1;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = files.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [files[i], files[j]] = [files[j], files[i]]; }
  console.error(`# order: shuffled(seed=${process.argv[si + 1]})`);
} else console.error('# order: sorted');
const r = spawnSync('node', ['--test', '--test-concurrency=1', '--test-reporter=tap',
  '--env-file=database/dev/.env', ...files.map((f) => `tests/integration/${f}`)],
  { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 256 * 1024 * 1024 });
const pass = (r.stdout.match(/^# pass (\d+)/m) ?? [])[1];
const fail = (r.stdout.match(/^# fail (\d+)/m) ?? [])[1];
const notok = [...r.stdout.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1]).filter((n) => !/^loading/.test(n));
console.log(`RESULT pass=${pass} fail=${fail}${notok.length ? ' failing=' + JSON.stringify(notok.slice(0, 8)) : ''}`);
process.exit(fail === '0' && notok.length === 0 ? 0 : 1);
