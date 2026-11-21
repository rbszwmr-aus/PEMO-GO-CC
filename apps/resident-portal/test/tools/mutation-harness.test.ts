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

import { APP_ROOT } from '../../tool/tokens-source.ts';
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
    () => proveMutations([], () => new Set(['something was already failing']), () => {}),
    /not green before mutating/,
  );
});

test('proveMutations reports a mutation that did not turn its target red', () => {
  writeFileSync(SCRATCH_ABS, 'alpha\n');
  try {
    const results = proveMutations(
      [{ id: 'm1', target: 'the assertion', edits: [[SCRATCH, 'alpha', 'omega']] }],
      () => new Set<string>(),
      () => {},
    );
    assert.equal(results[0]?.proven, false, 'a mutation that turned nothing red was reported as proven');
  } finally { cleanup(); }
});
