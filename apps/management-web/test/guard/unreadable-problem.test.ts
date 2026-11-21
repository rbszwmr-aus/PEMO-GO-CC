/**
 * The live client's "response could not be read" Problem is a literal (so live mode does not load the corpus chunk).
 * It must stay equal to the corpus's recorded internal-error Problem.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-20) New (initial-bundle work, R&T P2-3).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CORPUS } from '../../src/data/corpus.g.ts';
import { UNREADABLE_PROBLEM } from '../../src/data/unreadable-problem.ts';

test('the live client’s unreadable-response Problem equals the corpus internal-error Problem', () => {
  assert.deepEqual(UNREADABLE_PROBLEM, CORPUS['problems/internal-error.json']);
});
