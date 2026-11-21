/**
 * The guard on the mutation harness.
 *
 * "Each verifies the one below it, and each is invisible when absent" — so the
 * bottom of that chain needs its own test, or the whole chain rests on an
 * unverified floor.
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT } from '../../tool/corpus-source.ts';
import { applyMutation, MutationNotAppliedError, proveMutations } from '../../tool/mutate.ts';

const SCRATCH = 'test/tools/.harness-probe.tmp';
const SCRATCH_ABS = join(APP_ROOT, SCRATCH);
const cleanup = () => { if (existsSync(SCRATCH_ABS)) unlinkSync(SCRATCH_ABS); };

test('a mutation whose find text is absent THROWS rather than silently skipping', () => {
  writeFileSync(SCRATCH_ABS, 'hello world\n');
  try {
    // Asserts on the SPECIFIC guard, not merely that something threw.
    //
    // The two guards overlap by design — an absent find text also leaves the
    // file byte-identical, so guard 2 catches what guard 1 misses. That is
    // defence in depth and it is worth keeping, but it means a test asserting
    // only "it threw" cannot tell the two apart and stays green with guard 1
    // deleted. Found by mutating guard 1 away and watching this test pass.
    assert.throws(
      () => applyMutation({ id: 'probe', target: 'x', edits: [[SCRATCH, 'not-present-anywhere', 'y']] }),
      (e: unknown) =>
        e instanceof MutationNotAppliedError && /the find text is NOT PRESENT/.test(e.message),
      'an absent find text was not caught by the pattern guard specifically',
    );
    assert.equal(readFileSync(SCRATCH_ABS, 'utf8'), 'hello world\n', 'the file was modified despite the failure');
  } finally { cleanup(); }
});

test('the escaping slip that caused this guard to exist is caught', () => {
  // The real case: a file containing `\\b`, a harness string collapsing to `\b`.
  writeFileSync(SCRATCH_ABS, 'return new RegExp(`\\\\b${term}\\\\b`);\n');
  try {
    assert.throws(
      () => applyMutation({ id: 'escaping', target: 'x', edits: [[SCRATCH, 'RegExp(`\\b${term}\\b`)', 'RegExp("$^")']] }),
      MutationNotAppliedError,
    );
  } finally { cleanup(); }
});

test('a replacement that changes nothing THROWS even though the find text was present', () => {
  writeFileSync(SCRATCH_ABS, 'alpha beta\n');
  try {
    assert.throws(
      () => applyMutation({ id: 'noop', target: 'x', edits: [[SCRATCH, 'alpha', 'alpha']] }),
      MutationNotAppliedError,
      'a byte-identical mutation was accepted',
    );
  } finally { cleanup(); }
});

test('a successful mutation applies and then restores exactly', () => {
  const original = 'alpha beta gamma\n';
  writeFileSync(SCRATCH_ABS, original);
  try {
    const undo = applyMutation({ id: 'ok', target: 'x', edits: [[SCRATCH, 'beta', 'BETA']] });
    assert.equal(readFileSync(SCRATCH_ABS, 'utf8'), 'alpha BETA gamma\n');
    undo();
    assert.equal(readFileSync(SCRATCH_ABS, 'utf8'), original, 'restore did not return the file to its original bytes');
  } finally { cleanup(); }
});

test('proveMutations refuses to run when the suite is not green first', () => {
  // The control. Without it, "everything went red" proves nothing, because
  // everything was already red.
  assert.throws(
    () => proveMutations([], () => new Map([['something was already failing', 'AssertionError: x']]), () => {}),
    /not green before mutating/,
  );
});

test('proveMutations reports a mutation that did not turn its target red', () => {
  writeFileSync(SCRATCH_ABS, 'alpha\n');
  try {
    const results = proveMutations(
      [{ id: 'm1', target: 'the assertion', edits: [[SCRATCH, 'alpha', 'omega']] }],
      () => new Map<string, string>(),
      () => {},
    );
    assert.equal(results[0]?.proven, false, 'a mutation that turned nothing red was reported as proven');
  } finally { cleanup(); }
});

/* ---------------------------------------------------------------------------
 * GEN-044 — `a-bite-is-a-named-red`, applied to this harness.
 *
 * Main CC's `with-mutation` counted any non-zero exit as a bite, and five bites
 * were false. This harness never keyed on exit status, but it had the same defect
 * one level in: it matched the target against a SET OF NAMES with `.some()`, so a
 * mutation that reddened the whole suite certified and nothing checked that the
 * named case failed for its own reason.
 *
 * Each rule below is asserted by a case that must NOT certify. A rule with no
 * failing case is a rule nobody has tested.
 * ------------------------------------------------------------------------- */

const green = () => new Map<string, string>();
const oneEdit = (id: string, target: string, alsoRed?: string[]) => ({
  id, target, edits: [[SCRATCH, 'alpha', 'omega']] as [string, string, string][],
  ...(alsoRed ? { alsoRed } : {}),
});

test('a NAMED red with its own assertion log certifies', () => {
  writeFileSync(SCRATCH_ABS, 'alpha\n');
  try {
    const runs = [green(), new Map([['the assertion', 'AssertionError [ERR_ASSERTION]: expected 1 to be 2']]), green()];
    let i = 0;
    const results = proveMutations([oneEdit('m', 'the assertion')], () => runs[i++] ?? green(), () => {});
    assert.equal(results[0]?.proven, true, 'a genuine named red with a log was not certified');
  } finally { cleanup(); }
});

test('a named red with NO LOG does not certify — a name alone is a parse artefact', () => {
  writeFileSync(SCRATCH_ABS, 'alpha\n');
  try {
    // A second red DOES carry a log, so the parser is demonstrably working and the
    // instrument control below cannot be what fires. Without that, "this one case
    // has no log" and "the parser reads no logs at all" are indistinguishable —
    // and the harness is right to treat the ambiguous case as a broken parser.
    const runs = [
      green(),
      new Map([['the assertion', '   '], ['a witness', 'AssertionError: the parser can read this one']]),
      green(),
    ];
    let i = 0;
    const results = proveMutations([oneEdit('m', 'the assertion', ['a witness'])], () => runs[i++] ?? green(), () => {});
    assert.equal(results[0]?.proven, false);
    assert.match(results[0]?.reason ?? '', /NO LOG/);
  } finally { cleanup(); }
});

test('an INFRASTRUCTURE failure does not certify — the harness broke, the assertion did not fail', () => {
  writeFileSync(SCRATCH_ABS, 'alpha\n');
  try {
    // This is the GEN-044 shape exactly: something went wrong, the named case is
    // listed, and it says nothing whatever about whether the assertion can fail.
    const runs = [green(), new Map([['the assertion', 'Error: ERR_MODULE_NOT_FOUND cannot find package']]), green()];
    let i = 0;
    const results = proveMutations([oneEdit('m', 'the assertion')], () => runs[i++] ?? green(), () => {});
    assert.equal(results[0]?.proven, false);
    assert.match(results[0]?.reason ?? '', /INFRASTRUCTURE/);
  } finally { cleanup(); }
});

test('a timeout does not certify either', () => {
  writeFileSync(SCRATCH_ABS, 'alpha\n');
  try {
    const runs = [green(), new Map([['the assertion', 'Test timeout of 30000ms exceeded.']]), green()];
    let i = 0;
    const results = proveMutations([oneEdit('m', 'the assertion')], () => runs[i++] ?? green(), () => {});
    assert.equal(results[0]?.proven, false);
  } finally { cleanup(); }
});

test('UNDECLARED COLLATERAL does not certify — a mutation broader than its target proves the app can break, not that the assertion can fail', () => {
  writeFileSync(SCRATCH_ABS, 'alpha\n');
  try {
    const wide = new Map([
      ['the assertion', 'AssertionError: expected 1 to be 2'],
      ['a different screen', 'AssertionError: expected 3 to be 4'],
    ]);
    const runs = [green(), wide, green()];
    let i = 0;
    const results = proveMutations([oneEdit('m', 'the assertion')], () => runs[i++] ?? green(), () => {});
    assert.equal(results[0]?.proven, false, 'a suite-wide red certified — this is the .some() defect');
    assert.deepEqual(results[0]?.collateral, ['a different screen']);
  } finally { cleanup(); }
});

test('a DECLARED radius certifies — the honest move is to state the blast radius, not to suppress it', () => {
  writeFileSync(SCRATCH_ABS, 'alpha\n');
  try {
    const wide = new Map([
      ['the assertion', 'AssertionError: expected 1 to be 2'],
      ['a different screen', 'AssertionError: expected 3 to be 4'],
    ]);
    const runs = [green(), wide, green()];
    let i = 0;
    const results = proveMutations(
      [oneEdit('m', 'the assertion', ['a different screen'])],
      () => runs[i++] ?? green(),
      () => {},
    );
    assert.equal(results[0]?.proven, true);
    assert.deepEqual(results[0]?.collateral, []);
  } finally { cleanup(); }
});

test('a run where NOTHING carries a log throws — the parser is the instrument, and a broken instrument looks like honest NOT-REDs', () => {
  writeFileSync(SCRATCH_ABS, 'alpha\n');
  try {
    const runs = [green(), new Map([['some other case', '']]), green()];
    let i = 0;
    assert.throws(
      () => proveMutations([oneEdit('m', 'the assertion')], () => runs[i++] ?? green(), () => {}),
      /log parser is broken/,
    );
  } finally { cleanup(); }
});
