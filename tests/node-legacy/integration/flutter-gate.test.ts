/**
 * THE FLUTTER GATE'S DEBT CANNOT ROT (GEN-048 F6, option B, rules 1–5).
 * The gate's DECISION logic is tested here without a Flutter host, by feeding it
 * synthetic `flutter test --reporter json`.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GATE = resolve(REPO, 'docs/governance/bin/flutter-gate.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'flutter-gate-'));

const EXEMPT_A = 'contract version matches the generated tokens and the embedded corpus';
const EXEMPT_B = 'embedded fixture corpus is byte-identical to the source corpus';

// GEN-056: the gate's RULES are the subject here, NOT whatever debts happen to be
// owed. The earlier form ran the gate against the REAL flutter-test-debt.json, so
// rules 3/4/5 only held while those two debts were unpaid — a test of the debt, not
// of the gate (`[correlated-lists-certify-nothing]`: expectation and subject drawn
// from the same file). GEN-056 pays those debts and empties the file, which broke
// them. The fix is a SYNTHETIC debt the gate is pointed at via the seam GEN-048
// already built, so the rules are proven against controlled input.
const SYNTH_DEBT = join(tmp, 'synthetic-debt.json');
writeFileSync(SYNTH_DEBT, JSON.stringify({ debts: [
  { test: `test/synthetic.dart: ${EXEMPT_A}`, diagnosedCause: 'synthetic fixture for the gate-rule tests', owedBy: 'this test', sinceRedOn: '2026-09-03' },
  { test: `test/synthetic.dart: ${EXEMPT_B}`, diagnosedCause: 'synthetic fixture for the gate-rule tests', owedBy: 'this test', sinceRedOn: '2026-09-03' },
]}));
const run = (jsonFile: string) => spawnSync('node', [GATE, jsonFile],
  { encoding: 'utf8', env: { ...process.env, PEMO_FLUTTER_DEBT_FILE: SYNTH_DEBT } });
const write = (events: object[]) => { const f = join(tmp, `${Math.random()}.json`); writeFileSync(f, events.map((e) => JSON.stringify(e)).join('\n')); return f; };
const done = (id: number, name: string, result: 'success' | 'failure') =>
  [{ type: 'testStart', test: { id, name } }, { type: 'testDone', testID: id, result, skipped: false }];

test('rule 5 — booked debts exempt, other tests gated: a clean run passes', () => {
  const r = run(write([...done(1, EXEMPT_A, 'failure'), ...done(2, EXEMPT_B, 'failure'), ...done(3, 'seven levels', 'success')]));
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /1 gated, 2 exempt/);
});
test('rule 3 — an exempt test that PASSES reds the gate, naming it', () => {
  const r = run(write([...done(1, EXEMPT_A, 'success'), ...done(2, EXEMPT_B, 'failure'), ...done(3, 'seven levels', 'success')]));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /EXEMPT AND GREEN.*remove it from flutter-test-debt\.json/);
  assert.match(r.stdout, new RegExp(EXEMPT_A));
});
test('rule 5 — a non-exempt failure blocks merge', () => {
  const r = run(write([...done(1, EXEMPT_A, 'failure'), ...done(2, EXEMPT_B, 'failure'), ...done(3, 'seven levels', 'failure')]));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /"seven levels" failed and is not a booked debt/);
});
test('rule 4 — the summary names every exempt test and its owing PID, every run', () => {
  const r = run(write([...done(1, EXEMPT_A, 'failure'), ...done(2, EXEMPT_B, 'failure')]));
  assert.match(r.stdout, /exempt: contract version matches.*— owed by/);
  assert.match(r.stdout, /exempt: embedded fixture corpus.*— owed by/);
});
test('rule 2 — the shipped debt file is valid, and a missing field reds', () => {
  const ok = spawnSync('node', [GATE, '--validate-debt'], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stdout);
  // an entry missing owedBy must red, pointed at a temp debt file
  const bad = join(tmp, 'bad-debt.json');
  writeFileSync(bad, JSON.stringify({ debts: [{ test: 'x/y.dart: some test', diagnosedCause: 'c', sinceRedOn: '2026-09-03' }] }));
  const r = spawnSync('node', [GATE, '--validate-debt'], { encoding: 'utf8', env: { ...process.env, PEMO_FLUTTER_DEBT_FILE: bad } });
  assert.equal(r.status, 1, 'an entry with no owing PID must red');
  assert.match(r.stdout, /missing owedBy/);
});
test('rule 1 — no test name is hard-coded in the gate or the workflow; the skip list is the debt file', () => {
  const debts = JSON.parse(readFileSync(resolve(REPO, 'tests/fixtures/flutter-test-debt.json'), 'utf8')).debts as { test: string }[];
  const descriptions = debts.map((d) => d.test.split(': ').slice(1).join(': '));
  const gate = readFileSync(GATE, 'utf8');
  const wf = readFileSync(resolve(REPO, '.github/workflows/governance.yml'), 'utf8');
  for (const desc of descriptions) {
    assert.ok(!gate.includes(desc), `the gate hard-codes the exempt name "${desc}" instead of reading it from the debt file`);
    assert.ok(!wf.includes(desc), `the workflow hard-codes the exempt name "${desc}"`);
  }
});
