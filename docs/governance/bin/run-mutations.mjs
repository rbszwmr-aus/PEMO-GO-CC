#!/usr/bin/env node
/**
 * THE MUTATION MANIFEST RUNNER — every bite in the corpus, re-runnable.
 *
 * ─── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * Until GEN-046 not one bite in this repository was an artifact. `with-mutation.sh`
 * existed and worked, and every guard it "proved" was proved in an interactive
 * shell and written up in prose. Nothing could re-run them, so nothing could tell
 * whether a guard that bit last week still bites now — and when GEN-044 found that
 * five bites had never run at all (a compile failure counted as the red), there was
 * no way to ask the same question of everything already "proven".
 *
 * A BITE THAT CANNOT BE RE-RUN IS A CLAIM. This file turns the claims into checks.
 *
 * ─── THE CRITERION (UI-045 R1, now the corpus standard) ──────────────────────
 *
 * `[a-bite-is-a-named-red]` is harness-agnostic, and BOTH harnesses had the same
 * defect at different depths. Main CC's keyed on exit status, so a build failure
 * scored as a proof. The UI's parsed names but matched with `.some()`, so a
 * mutation that reddened the whole suite certified on the wreckage. Certification
 * now requires FOUR conditions, and each is reported by name when it is the one
 * that failed:
 *
 *   1. the named target is RED;
 *   2. its LOG is present — a name with no evidence is not a bite;
 *   3. that log is an ASSERTION failure, not a timeout, a missing module, a dead
 *      browser or a build error — infrastructure noise says nothing about whether
 *      the assertion can fail;
 *   4. the BLAST RADIUS is declared. Reds beyond `target` + `alsoRed` are
 *      collateral, and collateral means the mutation broke more than the thing it
 *      was aimed at, so it has not shown that guard failing for its own reason.
 *
 * Rule 4 is why this runner no longer filters the suite to the target case: a run
 * that cannot SEE the other cases cannot know it did not break them.
 *
 * Two controls beyond the four:
 *
 *   - BASELINE. Every suite must be green before it is mutated. A red baseline
 *     makes every verdict after it meaningless (GEN-039 G2: three probers failed
 *     against the UNMUTATED schema and the reds were read as proof).
 *   - THE INSTRUMENT. If no red anywhere in the whole sweep carried a log, the
 *     PARSER is broken, not the guards — every bite would "fail" identically and
 *     look like a subject finding. That throws rather than reporting.
 *
 *   docs/governance/bin/run-mutations.mjs              every entry
 *   docs/governance/bin/run-mutations.mjs GEN-040      one PID's entries
 *   docs/governance/bin/run-mutations.mjs --self-test  prove the runner refuses
 *
 * It needs a database, so it is NOT in the pre-push hook: the hook must stay fast
 * (GEN-022's reasoning). CI runs it, and a PID adding a guard adds its entry here.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../..');
const MANIFEST = join(REPO, 'docs/governance/mutations/manifest.json');

/** Infrastructure noise. A named case that "fails" this way has proved nothing. */
const NOT_AN_ASSERTION = [
  'ERR_MODULE_NOT_FOUND', 'SyntaxError', 'ENOENT', 'Cannot find module',
  'Test timeout of', 'Target page, context or browser has been closed',
  'net::ERR_', 'browserType.launch', 'EADDRINUSE', 'ERR_REQUIRE_ESM',
  'error TS', 'Cannot read properties of undefined (reading',
];

export function isAssertionFailure(log) {
  if (!log || log.trim().length === 0) return false;
  if (NOT_AN_ASSERTION.some((n) => log.includes(n))) return false;
  return /AssertionError|ERR_ASSERTION|testCodeFailure|expect\(|Expected|assert\./.test(log);
}

/**
 * TAP in, `Map<failing case name, ITS OWN LOG>` out.
 *
 * A set of names is not enough — rule 2 needs the evidence attached to the name
 * that carries it, not to the run.
 */
export function parseTap(out) {
  const reds = new Map();
  const lines = out.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*not ok \d+ - (.*)$/.exec(lines[i]);
    if (!m) continue;
    const name = m[1].trim();
    // The YAML block that follows, to its closing `...`, is this case's log.
    const block = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\s*\.\.\.\s*$/.test(lines[j])) break;
      if (/^\s*not ok \d+ - /.test(lines[j]) || /^\s*ok \d+ - /.test(lines[j])) break;
      block.push(lines[j]);
    }
    reds.set(name, block.join('\n'));
  }
  return reds;
}

const sh = (cmd, args, opts = {}) => {
  try {
    return { ok: true, out: execFileSync(cmd, args, { cwd: REPO, encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], ...opts }) };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
};

const build = () => {
  for (const m of ['modules/platform', 'modules/access', 'modules/property', 'modules/resident',
                   'modules/home-safety', 'modules/integration', 'modules/notices',
                   'modules/helpdesk', 'modules/service-case']) {
    if (existsSync(join(REPO, m, 'tsconfig.json'))) sh('pnpm', ['-s', '-C', m, 'exec', 'tsc', '-b', '--force']);
  }
  return sh('pnpm', ['-s', '-C', 'apps/api', 'exec', 'tsc', '-b', '--force']);
};

const runSuite = (testFile) => {
  const r = sh('node', ['--test', '--test-concurrency=1', '--test-reporter=tap',
                        '--env-file=database/dev/.env', testFile]);
  return parseTap(r.out);
};

/** Apply a mutation to the real tree; return an undo that restores it byte-for-byte. */
export function applyMutation(m) {
  const abs = join(REPO, m.file);
  if (!existsSync(abs)) throw new Error(`${m.id}: ${m.file} does not exist`);
  const before = readFileSync(abs, 'utf8');
  const n = before.split(m.from).length - 1;
  // A MUTATION THAT DOES NOT APPLY IS INDISTINGUISHABLE FROM A GUARD THAT CANNOT
  // FAIL. Both leave the suite green. Refuse rather than score it.
  if (n !== 1) {
    throw new Error(
      `${m.id}: its <from> matches ${n} time(s) in ${m.file}, not exactly once.\n` +
      `  A mutation that does not apply is indistinguishable from a guard that cannot fail.`);
  }
  writeFileSync(abs, before.replace(m.from, m.to));
  return () => writeFileSync(abs, before);
}

export function certify(m, reds) {
  const names = [...reds.keys()];
  const hit = names.find((f) => f === m.expect) ?? names.find((f) => f.includes(m.expect));
  const evidence = hit ? reds.get(hit) ?? '' : '';
  const declared = m.alsoRed ?? [];
  const collateral = names.filter(
    (f) => f !== hit && !declared.some((d) => f === d || f.includes(d)));

  let reason;
  if (!hit) reason = 'the named case did not go red';
  else if (!evidence.trim()) reason = 'the named case is red but carries NO LOG — cannot confirm it failed for its own reason';
  else if (!isAssertionFailure(evidence)) reason = 'the named case failed for an INFRASTRUCTURE reason, not its own';
  else if (collateral.length > 0) reason = `${collateral.length} undeclared red(s) — the mutation is broader than its target`;
  return { proven: reason === undefined, reason, collateral, evidence, names };
}

// ─── the self-test: a runner that cannot refuse certifies anything ───────────
// Each case is a bite the runner MUST NOT certify. `[probe-must-bite]` applied to
// the instrument: a criterion nobody has seen reject is a criterion on paper.
function selfTest() {
  const L = (ok, what) => { console.log(`  ${ok ? 'ok   ' : 'FAIL '} ${what}`); return ok; };
  let all = true;
  const M = { id: 'x', expect: 'the target case' };

  all &= L(certify(M, new Map([['another case', 'AssertionError: x']])).reason
           === 'the named case did not go red', 'rule 1 — a red that is not the target does not certify');
  all &= L(certify(M, new Map([['the target case', '']])).reason?.startsWith('the named case is red but carries NO LOG'),
           'rule 2 — a named red with no log does not certify');
  all &= L(certify(M, new Map([['the target case', "error TS2322: Type 'true' is not assignable"]])).reason
           === 'the named case failed for an INFRASTRUCTURE reason, not its own',
           'rule 3 — a build failure wearing the target name does not certify');
  all &= L(certify(M, new Map([['the target case', 'AssertionError: x'], ['a bystander', 'AssertionError: y']])).reason
           ?.includes('undeclared red'), 'rule 4 — undeclared collateral does not certify');
  all &= L(certify({ ...M, alsoRed: ['a bystander'] },
             new Map([['the target case', 'AssertionError: x'], ['a bystander', 'AssertionError: y']])).proven,
           'rule 4 — DECLARED collateral does certify');
  all &= L(certify(M, new Map([['the target case', 'AssertionError: x']])).proven,
           'all four met — certifies');
  all &= L(parseTap('TAP version 13\nnot ok 1 - a\n  ---\n  error: |-\n    boom\n  ...\nok 2 - b\n').get('a')?.includes('boom'),
           'the parser attaches each log to ITS OWN case');
  // The sentinel is COMPOSED AT RUNTIME. Written as a literal it would appear in
  // this file, and the first version of this self-test duly found its own text,
  // matched once, and rewrote its own source — the check for "does not apply"
  // being the one thing that did. It also proves nothing is written on the
  // refusal path: `applyMutation` throws before it can touch the file.
  const absent = ['no', 'such', 'text', randomUUID()].join('-');
  try {
    applyMutation({ id: 'y', file: 'package.json', from: absent, to: 'x' });
    all &= L(false, 'a mutation whose <from> is absent is refused');
  } catch { all &= L(true, 'a mutation whose <from> is absent is refused'); }
  all &= L(readFileSync(join(REPO, 'package.json'), 'utf8').includes('"name"'),
           'and the refusal path writes NOTHING');
  return !!all;
}

// ─── main ────────────────────────────────────────────────────────────────────
const arg = process.argv[2] ?? '';
if (arg === '--self-test') {
  console.log('  harness self-test — each case is a bite the runner MUST refuse\n');
  process.exit(selfTest() ? 0 : 1);
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const entries = manifest.mutations.filter((m) => !arg || m.pid === arg);
if (entries.length === 0) { console.log(`  no manifest entries for ${arg}`); process.exit(2); }

// ─── PRE-FLIGHT: no mutant may already be in the tree (GEN-049) ─────────────
// `undo()` runs in a `finally`, and a `finally` does not run on SIGKILL. A runner
// killed by a timeout mid-bite leaves the mutant in the source, and a mutant in
// the source looks exactly like uncommitted work: GEN-049 spent three baseline
// runs red on `covering-conjunction` before reading that the file still said
// `uncovered.length < addressed.length`. So before anything runs, every entry's
// `to` text is checked for and refused — a tree already carrying a mutation
// cannot give a baseline, let alone a verdict.
{
  const stuck = manifest.mutations.filter((m) => m.kind !== 'compile' || true)
    .filter((m) => existsSync(join(REPO, m.file)) && m.to && m.from !== m.to
      && readFileSync(join(REPO, m.file), 'utf8').includes(m.to)
      && !readFileSync(join(REPO, m.file), 'utf8').includes(m.from));
  if (stuck.length > 0) {
    console.error('  A MUTANT IS ALREADY IN THE TREE — a previous run did not restore it:');
    for (const m of stuck) console.error(`    ${m.file}  (${m.pid} ${m.id})`);
    console.error('  Restore it (git diff will show the `to` text) before running anything.');
    process.exit(2);
  }
}
// And restore on the signals a `finally` does see, so a Ctrl-C mid-bite is clean.
let activeUndo = undefined;
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { try { activeUndo?.(); } finally { process.exit(130); } });

build();

// ─── BASELINE: every suite green before anything is mutated ──────────────────
const suites = [...new Set(entries.filter((m) => m.kind !== 'compile' && m.kind !== 'guard').map((m) => m.testFile))];
for (const s of suites) {
  const reds = runSuite(s);
  if (reds.size > 0) {
    console.error(`  THE BASELINE IS NOT GREEN — every verdict after this would be meaningless.\n` +
      `  ${s}\n` + [...reds.keys()].map((k) => `    red: ${k}`).join('\n'));
    process.exit(2);
  }
}
console.log(`  control: ${suites.length} suite(s) green before mutating\n`);

let pass = 0, fail = 0, unreliable = 0, sawAnyLog = false;
for (const m of entries) {
  // ─── UNRELIABLE (GEN-047 step ruling (a)): reported, not run, counted apart ──
  // A bite that reds only sometimes certifies nothing, and running it would put a
  // coin-flip into the verdict column. It stays in the manifest — with its
  // diagnosis and the PID that owes the deterministic replacement — so the
  // register is honest about what is proven and what is merely claimed.
  if (m.status === 'unreliable') {
    console.log(`  ....  ${m.pid.padEnd(9)} ${m.id.padEnd(32)} UNRELIABLE — not run; owed by ${m.owedBy ?? '?'}`);
    unreliable++; continue;
  }
  let undo;
  // A guard-kind entry whose subject is the DATABASE (with-ddl-mutation.sh) mutates
  // no file: its from/to are identical by convention and applyMutation is skipped.
  if (m.kind === 'guard' && m.from === m.to) undo = () => {};
  else try { undo = applyMutation(m); activeUndo = undo; }
  catch (e) { console.log(`  FAIL  ${m.pid.padEnd(9)} ${m.id.padEnd(32)} ${e.message.split('\n')[0]}`); fail++; continue; }
  if (undo === undefined) { console.log(`  FAIL  ${m.pid.padEnd(9)} ${m.id.padEnd(32)} no mutation`); fail++; continue; }
  try {
    // kind=guard (GEN-050): the subject is a SHELL GUARD. The four conditions read
    // the same: the guard's command must exit non-zero AND its output must carry
    // the named message — a crash, a missing file or a usage error is not a bite.
    if (m.kind === 'guard') {
      const g = sh('bash', ['-c', m.command]);
      // A failed restore is a FAIL even when the bite fired: the schema is damaged.
      if (g.out.includes('RESTORE FAILED')) {
        console.log(`  FAIL  ${m.pid.padEnd(9)} ${m.id.padEnd(32)} ${(g.out.split('\n').find((l) => l.includes('because:')) ?? 'RESTORE FAILED').trim().slice(0, 100)}`);
        fail++; continue;
      }
      const hit = !g.ok && g.out.includes(m.expect);
      const crashed = !g.ok && !hit;
      if (hit) { console.log(`  ok    ${m.pid.padEnd(9)} ${m.id.padEnd(32)} guard refuses: ${m.expect.slice(0, 50)}`); pass++; }
      else {
        console.log(`  FAIL  ${m.pid.padEnd(9)} ${m.id.padEnd(32)} ${g.ok ? 'THE GUARD DID NOT REFUSE' : crashed ? 'refused for ANOTHER reason: ' + (g.out.trim().split('\n').pop() ?? '').slice(0, 60) : ''}`);
        // A refusal nobody can read is a verdict nobody can check: show the run's tail.
        for (const l of g.out.trim().split('\n').slice(-4)) console.log(`        | ${l.slice(0, 110)}`);
        fail++;
      }
      continue;
    }
    if (m.kind === 'compile') {
      const b = build();
      const hit = !b.ok && b.out.includes(m.expect);
      if (hit) { console.log(`  ok    ${m.pid.padEnd(9)} ${m.id.padEnd(32)} breaks the build: ${(/error TS\d+[^\n]*/.exec(b.out) ?? [''])[0].slice(0, 62)}`); pass++; }
      else { console.log(`  FAIL  ${m.pid.padEnd(9)} ${m.id.padEnd(32)} expected ${m.expect}, got ${b.ok ? 'A CLEAN BUILD — the type guard did not bite' : 'another diagnostic'}`); fail++; }
      continue;
    }
    build();
    const reds = runSuite(m.testFile);
    for (const l of reds.values()) if (l.trim()) sawAnyLog = true;
    const v = certify(m, reds);
    if (v.proven) {
      const why = (/error: \|-\s*\n\s*(.+)/.exec(v.evidence) ?? [, ''])[1] ?? '';
      console.log(`  ok    ${m.pid.padEnd(9)} ${m.id.padEnd(32)} reds: ${m.expect.slice(0, 44)}${why ? ` — ${why.trim().slice(0, 40)}` : ''}`);
      pass++;
    } else {
      console.log(`  FAIL  ${m.pid.padEnd(9)} ${m.id.padEnd(32)} ${v.reason}`);
      if (v.collateral.length) console.log(`        collateral: ${v.collateral.slice(0, 4).join(' | ')}`);
      fail++;
    }
  } finally { undo(); activeUndo = undefined; }
}
build();

// ─── THE INSTRUMENT CONTROL ──────────────────────────────────────────────────
if (!sawAnyLog && entries.some((m) => m.kind !== 'compile' && m.kind !== 'guard')) {
  throw new Error(
    'INSTRUMENT FAILURE: not one red anywhere in this sweep carried a log.\n' +
    '  That is the PARSER, not the guards. Every bite would fail identically and\n' +
    '  read as a subject finding. Fix the runner before believing any verdict.');
}

console.log(`\n${pass} proven, ${fail} failed${unreliable ? `, ${unreliable} unreliable (not run)` : ''}`);
process.exit(fail === 0 ? 0 : 1);
