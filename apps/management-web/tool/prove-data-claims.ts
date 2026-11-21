/**
 * Standing proof that the absence checks CAN fire.
 *
 * The next re-pin is addition-heavy — fixtures added, states added, a severity
 * level rendered for the first time. That is precisely the change class that
 * broke the absence claims once already, and `absence-claims.test.ts` exists to
 * catch it.
 *
 * If that merge lands and the suite stays GREEN, the check needs its own
 * evidence that it could have gone red — otherwise "it did not fire" and "it
 * cannot fire" are indistinguishable, which is the failure this project keeps
 * meeting in new costumes.
 *
 * So the proof is a command rather than a memory of having run one:
 *
 *     pnpm run prove:absence-claims
 *
 * It doctors a COPY of the corpus with exactly what the coming merge will add —
 * an event at severity `normal`, and a notice at `draft` — records a digest for
 * that copy so the digest guard cannot mask the result, and requires the
 * absence check to fail naming both. Then it restores.
 *
 * Proof 1 originally fired for the wrong reason: the digest guard tripped first
 * and every test failed, which looked like success and proved nothing. Isolating
 * it is the whole reason this script re-records the digest rather than just
 * pointing at a doctored directory.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APP_ROOT, CORPUS_DIR, DIGEST_FILE } from './corpus-source.ts';
import { ABSENCE_CLAIMS, STRING_CLAIMS } from '../test/inventory/data-claims.data.ts';
import { applyMutation } from './mutate.ts';

const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const TEST = 'test/inventory/data-claims.test.ts';
if (!existsSync(join(APP_ROOT, TEST))) {
  // The prover named a test file, the file was renamed, and the run reported
  // "DID NOT FIRE" — a working check declared broken because the prover pointed
  // at nothing. Same shape as naming the injections instead of deriving them.
  throw new Error(`the prover points at ${TEST}, which does not exist. A prover that runs no tests reports success as failure.`);
}

function runAbsenceCheck(corpusDir: string): { failed: string[]; out: string } {
  let out = '';
  try {
    out = execFileSync(
      process.execPath,
      ['--test', '--experimental-strip-types', '--test-reporter=tap', TEST],
      { cwd: APP_ROOT, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, PEMO_MGMT_FIXTURE_DIR: corpusDir } },
    );
  } catch (e: any) {
    out = String(e.stdout ?? '') + String(e.stderr ?? '');
  }
  return { failed: [...out.matchAll(/^not ok \d+ - (.+)$/gm)].map((m) => m[1]!.trim()), out };
}

const digestBefore = sha(DIGEST_FILE);
const scratch = mkdtempSync(join(tmpdir(), 'pemo-absence-proof-'));
let ok = false;

try {
  // ---- control: the real corpus must be GREEN, or nothing below means anything
  const control = runAbsenceCheck(CORPUS_DIR);
  if (control.failed.length > 0) {
    throw new Error(`control failed — the absence checks are already red:\n  ${control.failed.join('\n  ')}`);
  }
  console.log('control  : absence checks GREEN against the real corpus');

  // ---- doctor a copy so that EVERY live claim is violated
  //
  // Derived from ABSENCE_CLAIMS, never hard-coded. The first version of this
  // tool injected a `normal` event and a `draft` notice; API-020-ST added both,
  // the injection silently became a no-op, and the tool reported the checks
  // "not load-bearing" — a false alarm from a proof that had gone stale in
  // exactly the way the claims it guards once did.
  cpSync(CORPUS_DIR, scratch, { recursive: true });

  const io = {
    read: (rel: string) => JSON.parse(readFileSync(join(scratch, rel), 'utf8')),
    write: (rel: string, body: unknown) => writeFileSync(join(scratch, rel), JSON.stringify(body, null, 2)),
  };

  if (ABSENCE_CLAIMS.length === 0) {
    console.log('proof    : there are no absence claims left to prove — nothing to do');
    ok = true;
  }
  const injected: string[] = [];
  for (const claim of ABSENCE_CLAIMS) {
    const value = claim.values[0] as string;
    claim.inject(scratch, value, io);
    injected.push(`${claim.screen}/${claim.state} <- ${claim.label} "${value}"`);
  }
  for (const line of injected) console.log(`inject   : ${line}`);

  // ---- record a digest for the COPY, so the digest guard cannot mask the result
  execFileSync(process.execPath, ['--experimental-strip-types', 'tool/write-digest.ts'], {
    cwd: APP_ROOT, stdio: 'pipe', env: { ...process.env, PEMO_MGMT_FIXTURE_DIR: scratch },
  });

  const proof = runAbsenceCheck(scratch);
  const target = 'the corpus really does lack what the no-fixture panels say it lacks';
  const fired = proof.failed.includes(target);

  console.log(`proof    : absence check ${fired ? 'FIRED' : 'DID NOT FIRE'} on a corpus doctored to violate every live claim`);
  if (fired) {
    for (const line of proof.out.split('\n').filter((l) => l.includes('but the corpus now has one'))) {
      console.log(`           ${line.trim().replace(/^[-'"\s]+/, '')}`);
    }
  } else {
    console.log(proof.out.slice(0, 1500));
  }
  ok = fired || ABSENCE_CLAIMS.length === 0;
} finally {
  // ---- restore, and PROVE the restore, rather than assuming it
  execFileSync(process.execPath, ['--experimental-strip-types', 'tool/write-digest.ts'], { cwd: APP_ROOT, stdio: 'pipe' });
  rmSync(scratch, { recursive: true, force: true });
  const digestAfter = sha(DIGEST_FILE);
  if (digestAfter !== digestBefore) {
    console.error(`\nRESTORE FAILED — corpus-digest.json differs from before the proof.\n  was ${digestBefore}\n  now ${digestAfter}`);
    process.exit(2);
  }
  console.log('restore  : corpus-digest.json byte-identical to before the proof');
}

/* -------------------------------------------------- arm 2: presence gates */

const gated = STRING_CLAIMS.filter((c) => c.disposition === 'gated');
const withoutViolator = gated.filter((c) => !c.violator && c.direction !== 'absence').map((c) => c.key);
if (withoutViolator.length > 0) {
  console.log(`\nNOTE: gated claims with no declared violator: ${withoutViolator.join(', ')}`);
}

let presenceOk = true;
for (const claim of gated.filter((c) => c.violator?.edit)) {
  const [rel, find, replace] = claim.violator!.edit!;
  const undo = applyMutation({ id: claim.key, target: claim.key, edits: [[rel, find, replace]] });
  try {
    execFileSync('npx', ['vite', 'build'], { cwd: APP_ROOT, stdio: 'pipe' });
    let out = '';
    try {
      out = execFileSync('npx', ['playwright', 'test', '--project=screens', '--grep', 'presence gates', '--reporter=list'],
        { cwd: APP_ROOT, encoding: 'utf8', stdio: 'pipe' });
    } catch (e: any) { out = String(e.stdout ?? '') + String(e.stderr ?? ''); }
    const fired = /\d+ failed/.test(out);
    presenceOk = presenceOk && fired;
    console.log(`presence : ${claim.key} — gate removed, check ${fired ? 'FIRED' : 'DID NOT FIRE'}`);
  } finally {
    undo();
    execFileSync('npx', ['vite', 'build'], { cwd: APP_ROOT, stdio: 'pipe' });
  }
}

const allOk = ok && presenceOk;
console.log(allOk
  ? '\nVERDICT: the data-claim checks can fire, in every direction proven.'
  : '\nVERDICT: A DATA-CLAIM CHECK DID NOT FIRE — it is not load-bearing.');
process.exit(allOk ? 0 : 1);
