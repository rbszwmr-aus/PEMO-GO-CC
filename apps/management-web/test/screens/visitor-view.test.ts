/**
 * Visits page filter, counts and default sorts.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_SORT, countsOf, inFilter, isOverdue, pressCard, type VisitFacts } from '../../src/screens/visitor-view.ts';

const HOUR = 3_600_000;
const rows: VisitFacts[] = [
  { status: 'expected', overdue: false },
  { status: 'expected', overdue: false },
  { status: 'on_site', overdue: false },
  { status: 'on_site', overdue: true },
  { status: 'checked_out', overdue: false },
];

test('overdue means on site AND past the visit window, never expected or signed out', () => {
  const to = 1_000 * HOUR;
  assert.equal(isOverdue({ status: 'on_site', expectedToMs: to }, to + 1), true);
  assert.equal(isOverdue({ status: 'on_site', expectedToMs: to }, to - 1), false);
  assert.equal(isOverdue({ status: 'expected', expectedToMs: to }, to + HOUR), false);
  assert.equal(isOverdue({ status: 'checked_out', expectedToMs: to }, to + HOUR), false);
  assert.equal(isOverdue({ status: 'on_site', expectedToMs: null }, to + HOUR), false);
});

test('counts are the rows each filter would show: Expected not yet arrived, On site includes the overdue ones', () => {
  assert.deepEqual(countsOf(rows), { all: 5, expected: 2, onsite: 2, overdue: 1 });
  assert.equal(rows.filter((r) => inFilter('onsite', r)).length, 2);
  assert.equal(rows.filter((r) => inFilter('overdue', r)).length, 1);
});

test('each tab has its own default sort, and only Expected and On site start on the visible Expected column', () => {
  assert.deepEqual(DEFAULT_SORT.expected, { key: 'expected', dir: 'asc' });
  assert.deepEqual(DEFAULT_SORT.onsite, { key: 'expected', dir: 'asc' });
  assert.deepEqual(DEFAULT_SORT.overdue, { key: 'due', dir: 'asc' });
  assert.deepEqual(DEFAULT_SORT.all, { key: 'created', dir: 'desc' });
});

test('pressing the lit card a second time goes back to All; pressing another card replaces it', () => {
  assert.equal(pressCard('all', 'onsite'), 'onsite');
  assert.equal(pressCard('onsite', 'onsite'), 'all');
  assert.equal(pressCard('onsite', 'overdue'), 'overdue');
});
