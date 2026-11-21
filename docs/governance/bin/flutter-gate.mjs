#!/usr/bin/env node
/**
 * THE RESIDENT-MOBILE FLUTTER GATE, WITH A DEBT THAT CANNOT ROT (GEN-048 F6, option B).
 *
 * The gate runs the whole Flutter suite; a small NAMED set of tests, booked in
 * tests/fixtures/flutter-test-debt.json with a cause, a date and an owing PID, is
 * exempt from BLOCKING merge — the other cases gate today. Five rules, all here so
 * the exemption is incapable of rotting into "(A) forever":
 *
 *   1. The skip list is READ FROM the debt file at run time. No test name lives
 *      in this script or the workflow. (A test asserts that.)
 *   2. Every debt entry names its cause, its date and its owing PID, or the gate
 *      reds. Adding an entry is a HARD STOP by ruling, never an executor act.
 *   3. THE DEBT SCREAMS WHEN PAID: an exempt test that PASSES reds the gate,
 *      naming it — "exempt and green; remove it from flutter-test-debt.json".
 *   4. The summary prints every run: N gated, M exempt, each exempt name + PID.
 *   5. The exemption covers ONLY its named tests; any other red blocks.
 *
 * Usage:
 *   node flutter-gate.mjs <flutter-json-file>   # the workflow captures first, then this
 *   node flutter-gate.mjs --validate-debt        # just the entry-shape check
 *
 * It never pipes a live `flutter test` into itself — the workflow writes the
 * JSON to a file and hands the path, so a short-circuit read cannot crash flutter
 * (`[a-live-process-is-never-piped-into-a-short-circuit-reader]`).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DEBT = process.env['PEMO_FLUTTER_DEBT_FILE'] ?? resolve(REPO, 'tests/fixtures/flutter-test-debt.json');

const loadDebts = () => {
  const doc = JSON.parse(readFileSync(DEBT, 'utf8'));
  const debts = doc.debts ?? [];
  const bad = [];
  for (const d of debts) {
    const missing = ['test', 'diagnosedCause', 'owedBy', 'sinceRedOn'].filter((k) => !d[k]);
    if (missing.length) bad.push(`${d.test ?? '(no test)'} — missing ${missing.join(', ')}`);
  }
  return { debts, bad };
};

/** The exempt test descriptions — the part of `test` after "<file>: ". */
const description = (t) => { const i = t.indexOf(': '); return i < 0 ? t : t.slice(i + 2); };

const { debts, bad } = loadDebts();
if (bad.length) {
  console.log('  FAIL  flutter-gate: debt entries missing a cause, date or owing PID:');
  for (const b of bad) console.log(`        ${b}`);
  console.log('        rule 2: every exemption names all three, or it is not a debt.');
  process.exit(1);
}
if (process.argv[2] === '--validate-debt') {
  console.log(`  ok    flutter-gate: ${debts.length} debt entr${debts.length === 1 ? 'y' : 'ies'}, each with a cause, date and owing PID`);
  process.exit(0);
}

const jsonFile = process.argv[2];
if (!jsonFile) { console.log('  FAIL  flutter-gate: no flutter json file given'); process.exit(2); }

// ─── parse flutter test --reporter json (newline-delimited events) ───────────
const events = readFileSync(jsonFile, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const names = new Map();      // testID -> name
const results = new Map();    // name -> 'success' | 'failed' | 'skipped'
for (const e of events) {
  if (e.type === 'testStart' && e.test) names.set(e.test.id, e.test.name);
  if (e.type === 'testDone') {
    const name = names.get(e.testID);
    if (name === undefined || /^loading /.test(name)) continue;   // suite-load pseudo-tests
    results.set(name, e.skipped ? 'skipped' : (e.result === 'success' ? 'success' : 'failed'));
  }
}
if (results.size === 0) { console.log('  FAIL  flutter-gate: the json names no completed test — did flutter run?'); process.exit(1); }

const exempt = new Set(debts.map((d) => description(d.test)));
const pidOf = new Map(debts.map((d) => [description(d.test), d.owedBy]));

const blockingFailures = [];   // rule 5: a non-exempt failure
const paidDebts = [];          // rule 3: an exempt test that passed
let gated = 0, exemptSeen = 0;
for (const [name, result] of results) {
  if (exempt.has(name)) {
    exemptSeen++;
    if (result === 'success') paidDebts.push(name);   // rule 3
  } else {
    gated++;
    if (result === 'failed') blockingFailures.push(name);
  }
}

// ─── rule 4: the summary, every run ──────────────────────────────────────────
console.log(`  flutter-gate: ${gated} gated, ${exemptSeen} exempt (of ${exempt.size} booked)`);
for (const d of debts) console.log(`    exempt: ${description(d.test)}  — owed by ${d.owedBy}`);

let failed = false;
for (const name of paidDebts) {   // rule 3: scream when paid
  console.log(`  FAIL  flutter-gate: "${name}" is EXEMPT AND GREEN — remove it from flutter-test-debt.json (the debt is paid).`);
  failed = true;
}
for (const name of blockingFailures) {   // rule 5
  console.log(`  FAIL  flutter-gate: "${name}" failed and is not a booked debt — it blocks merge (F2).`);
  failed = true;
}
if (!failed) console.log('  ok    flutter-gate: every gated test passed; booked debts still red as booked');
process.exit(failed ? 1 : 0);
