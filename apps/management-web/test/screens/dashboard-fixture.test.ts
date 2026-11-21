/**
 * Dashboard fixture and Chart maths. A card, a donut segment and a bar are derived from the same daily series,
 * so they must agree in every period; the axis top is a whole number.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOOKINGS_PER_DAY, DASH_DAYS, DASH_PERIODS, DRILL_ROW_LIMIT, ESTATE, SAFETY_PER_DAY, drillRows, figures, isoOfDay, dayIndexOf, periodWindow, sumWindow,
} from '../../src/data/dashboard-fixture.ts';
import { niceMax } from '../../src/components/chart-math.ts';

test('the series cover the 30 fixture days, 21 Oct to 19 Nov 2026', () => {
  assert.equal(BOOKINGS_PER_DAY.length, DASH_DAYS);
  assert.equal(SAFETY_PER_DAY.length, DASH_DAYS);
  assert.equal(isoOfDay(0), '2026-10-21');
  assert.equal(isoOfDay(DASH_DAYS - 1), '2026-11-19');
  assert.equal(dayIndexOf('2026-11-19'), DASH_DAYS - 1);
});

test('every period window sits inside the fixture days and Bookings = sum of the bars = Confirmed', () => {
  for (const p of DASH_PERIODS) {
    const w = periodWindow(p, { from: '2026-11-10', to: '2026-11-15' });
    assert.ok(w.from >= 0 && w.to <= DASH_DAYS - 1 && w.from <= w.to, p);
    assert.equal(figures(w).confirmed, sumWindow(BOOKINGS_PER_DAY, w), p);
  }
  assert.equal(periodWindow('today').from, periodWindow('today').to);
  assert.deepEqual(periodWindow('custom', { from: '2026-11-15', to: '2026-11-10' }), { from: 20, to: 25 }, 'a reversed range is ordered');
  assert.deepEqual(periodWindow('custom', { from: '2025-01-01', to: '2030-01-01' }), { from: 0, to: DASH_DAYS - 1 }, 'a wide range is clipped');
});

test('occupied + vacant = households; pop-up rows never exceed the limit and the total is the card figure', () => {
  const w = periodWindow('last30');
  const f = figures(w);
  assert.equal(ESTATE.occupied + f.vacant, ESTATE.households);
  assert.equal(drillRows('confirmed', 0, w).total, f.confirmed);
  assert.equal(drillRows('occupied', 0, w).rows.length, DRILL_ROW_LIMIT);
  const day = BOOKINGS_PER_DAY.indexOf(0);
  assert.equal(drillRows('bar', day, w).rows.length, 0);
  assert.equal(drillRows('bar', 18, w).total, BOOKINGS_PER_DAY[18]);
});

test('niceMax rounds the axis top up to a whole, readable number', () => {
  assert.equal(niceMax(0), 4);
  assert.equal(niceMax(4), 4);
  assert.equal(niceMax(5), 6);
  assert.equal(niceMax(7), 8);
  assert.equal(niceMax(9), 10);
  assert.equal(niceMax(11), 20);
  assert.equal(niceMax(45), 60);
  assert.equal(niceMax(101), 200);
});
