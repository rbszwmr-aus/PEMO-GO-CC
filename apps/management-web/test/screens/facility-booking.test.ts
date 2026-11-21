/**
 * Facility booking fixtures must resolve list → detail and cover the catalogue.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOOKING_FACILITIES,
  BOOKING_FIXTURE_TODAY,
  BOOKING_RATE_CARDS,
  BOOKING_ROWS,
  addDays,
  bookingsInWeek,
  checkinTodayRows,
  findBooking,
  findFacility,
  findZone,
  rateCardFor,
} from '../../src/data/booking-fixtures.ts';

test('every booking list row has a matching facility and zone', () => {
  assert.ok(BOOKING_ROWS.length >= 8, 'booking list is hollow');
  for (const row of BOOKING_ROWS) {
    const facility = findFacility(row.facilityId);
    assert.ok(facility, `no facility for ${row.bookingId} (${row.facilityId})`);
    assert.ok(findZone(facility, row.zoneId), `no zone ${row.zoneId} on ${row.facilityId}`);
    assert.ok(row.scope.node.id, `${row.bookingId} has no scope node`);
  }
});

test('every facility has a rate card and at least one zone', () => {
  assert.equal(BOOKING_FACILITIES.length, 5);
  for (const f of BOOKING_FACILITIES) {
    assert.ok(rateCardFor(f.facilityId), `no rate card for ${f.facilityId}`);
    assert.ok(f.zones.length >= 1, `${f.facilityId} has no zones`);
    assert.ok(f.name['zh-Hant'].length > 0, `${f.facilityId} missing zh-Hant name`);
  }
  assert.equal(BOOKING_RATE_CARDS.length, BOOKING_FACILITIES.length);
});

test('check-in today set is non-empty confirmed on the fixture clock', () => {
  const today = checkinTodayRows();
  assert.ok(today.some((b) => b.status === 'confirmed'), 'no confirmed booking on fixture today');
  assert.ok(today.every((b) => b.date === BOOKING_FIXTURE_TODAY));
  assert.ok(findBooking('bk_wfg_1001')?.date === BOOKING_FIXTURE_TODAY);
});

test('week helper keeps the fixture week and addDays stays in Hong Kong', () => {
  const week = bookingsInWeek(addDays(BOOKING_FIXTURE_TODAY, -5));
  assert.ok(week.some((b) => b.bookingId === 'bk_wfg_1001'));
  assert.ok(week.some((b) => b.bookingId === 'bk_wfg_1009'));
  assert.equal(addDays('2026-09-14', 5), '2026-09-19');
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
});

test('findBooking and findFacility miss unknown ids', () => {
  assert.equal(findBooking('bk_does_not_exist'), undefined);
  assert.equal(findFacility('fac_does_not_exist'), undefined);
  assert.ok(findBooking('bk_wfg_1001'));
  assert.ok(findFacility('fac_wfg_clubhouse_mp'));
});
