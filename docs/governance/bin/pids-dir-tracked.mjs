#!/usr/bin/env node
// The register must keep pids/ present in git even with no open PID (GEN-062).
//
// git does not track an empty directory. When the last open PID closes, pids/ is
// empty, git drops it, and a FRESH checkout (CI) has no pids/ at all — so prove.sh's
// snapshot, its synthetic victim and restore() all cp against a directory that is
// not there, and the whole guard battery reds for a reason that has nothing to do
// with the guards. A tracked keeper (.gitkeep) guarantees the directory survives an
// empty state. This check reds if nothing under pids/ is tracked, so the keeper
// cannot be removed silently. `[git-tracking-is-not-existence]`.
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
let tracked = '';
try {
  tracked = execFileSync('git', ['ls-files', 'docs/governance/pids/'], { cwd: REPO, encoding: 'utf8' }).trim();
} catch (e) {
  console.error(`FAIL: could not ask git what pids/ tracks: ${e.message}`);
  process.exit(2);
}
if (!tracked) {
  console.error('FAIL: nothing under docs/governance/pids/ is tracked by git.');
  console.error('  An empty checkout drops the directory and the governance battery cannot snapshot it.');
  console.error('  Keep a tracked .gitkeep in pids/. (GEN-062, [git-tracking-is-not-existence])');
  process.exit(1);
}
const files = tracked.split('\n');
console.log(`ok: pids/ is tracked in git (${files.length} file(s), e.g. ${files[0]})`);
