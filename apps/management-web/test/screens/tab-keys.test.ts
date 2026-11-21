/**
 * Arrow-key roving for the shared tab strips.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { nextTabId } from '../../src/components/tab-keys.ts';

const IDS = ['all', 'expected', 'onsite'] as const;

test('arrow keys move to the next and previous tab and wrap at the ends', () => {
  assert.equal(nextTabId(IDS, 'all', 'ArrowRight'), 'expected');
  assert.equal(nextTabId(IDS, 'onsite', 'ArrowRight'), 'all');
  assert.equal(nextTabId(IDS, 'all', 'ArrowLeft'), 'onsite');
  assert.equal(nextTabId(IDS, 'expected', 'ArrowLeft'), 'all');
});

test('Home and End jump to the first and last tab, other keys are not tab keys', () => {
  assert.equal(nextTabId(IDS, 'expected', 'Home'), 'all');
  assert.equal(nextTabId(IDS, 'expected', 'End'), 'onsite');
  assert.equal(nextTabId(IDS, 'expected', 'Enter'), null);
  assert.equal(nextTabId([], 'x', 'ArrowRight'), null);
});

test('with no tab selected (a card filter that is not a tab) the arrows start from the first tab', () => {
  assert.equal(nextTabId(IDS, null, 'ArrowRight'), 'all');
});
