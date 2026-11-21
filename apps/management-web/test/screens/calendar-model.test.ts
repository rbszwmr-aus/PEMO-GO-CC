/**
 * Facility calendar rules: what a month cell shows, how the arrows step, which tint a facility wears.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_FACILITIES, cellView, drawn, monthGrid, pillsText, shift, shortFacility, tintOf, weekDays } from '../../src/screens/calendar-model.ts';
import type { BookingRow } from '../../src/data/booking-fixtures.ts';

const ORDER = ['f1', 'f2', 'f3'];
const bk = (id: string, facilityId: string, start = '10:00', status: BookingRow['status'] = 'confirmed'): BookingRow =>
  ({ bookingId: id, facilityId, slotStart: start, slotEnd: '11:00', status, date: '2026-11-13' }) as BookingRow;

test('Calendar: a single-facility cell shows three chips and counts the rest as "+N more"', () => {
  const rows = ['a', 'b', 'c', 'd', 'e'].map((id, i) => bk(id, 'f1', `0${8 + i}:00`));
  const v = cellView(rows, 'f1', ORDER);
  assert.equal(v.kind, 'chips');
  if (v.kind === 'chips') { assert.equal(v.chips.length, 3); assert.equal(v.more, 2); }
  const other = cellView(rows, 'f2', ORDER);
  assert.deepEqual(other.kind === 'chips' ? [other.chips.length, other.more] : null, [0, 0]);
});

test('Calendar: All mode keeps chips for two bookings and swaps to per-facility count pills for more', () => {
  const two = cellView([bk('a', 'f1'), bk('b', 'f2')], ALL_FACILITIES, ORDER);
  assert.equal(two.kind, 'chips');
  const rows = [bk('a', 'f2'), bk('b', 'f1'), bk('c', 'f2'), bk('d', 'f3')];
  const v = cellView(rows, ALL_FACILITIES, ORDER);
  assert.equal(v.kind, 'pills');
  if (v.kind === 'pills') {
    assert.deepEqual(v.pills, [{ facilityId: 'f1', count: 1 }, { facilityId: 'f2', count: 2 }, { facilityId: 'f3', count: 1 }]);
    assert.equal(v.total, 4);
    assert.equal(pillsText(v.pills, (id) => id.toUpperCase()), 'F1 1 · F2 2 · F3 1');
  }
});

test('Calendar: cancelled bookings are not drawn and the rest are in time order', () => {
  const out = drawn([bk('late', 'f1', '15:00'), bk('gone', 'f1', '09:00', 'cancelled'), bk('early', 'f1', '08:00')]);
  assert.deepEqual(out.map((b) => b.bookingId), ['early', 'late']);
});

test('Calendar: arrows step a day, a week, a month or a year and clamp to the month end', () => {
  assert.equal(shift('2026-11-19', 'day', 1), '2026-11-20');
  assert.equal(shift('2026-11-19', 'week', -1), '2026-11-12');
  assert.equal(shift('2026-11-19', 'month', 1), '2026-12-19');
  assert.equal(shift('2026-12-31', 'month', 1), '2027-01-31');
  assert.equal(shift('2026-01-31', 'month', 1), '2026-02-28');
  assert.equal(shift('2026-01-15', 'month', -1), '2025-12-15');
  assert.equal(shift('2024-02-29', 'year', 1), '2025-02-28');
});

test('Calendar: the month grid is six Monday-first weeks that contain the whole month', () => {
  const g = monthGrid('2026-11-19');
  assert.equal(g.length, 42);
  assert.equal(g[0], '2026-10-26');
  assert.ok(g.includes('2026-11-01') && g.includes('2026-11-30'));
  assert.deepEqual(weekDays('2026-11-19'), ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
});

test('Calendar: a facility keeps one tint by its place in the list, and the short name is localised', () => {
  assert.equal(tintOf('f1', ORDER), 1);
  assert.equal(tintOf('f3', ORDER), 3);
  assert.equal(tintOf('nope', ORDER), 1);
  assert.equal(tintOf('f1', ['a', 'b', 'c', 'd', 'e', 'f1']), 1);
  assert.equal(shortFacility('fac_wfg_bbq', 'zh-Hant', 'x'), '燒烤');
  assert.equal(shortFacility('unknown', 'en', 'Full name'), 'Full name');
});
