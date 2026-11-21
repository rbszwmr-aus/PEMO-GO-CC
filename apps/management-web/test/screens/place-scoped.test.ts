/**
 * Properties rail mounts only on place-scoped screens / nav stubs.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { isPlaceScopedRail } from '../../src/shell/place-scoped.ts';

test('wired place screens show the rail', () => {
  for (const screen of [
    's2',
    'households',
    'householdsDetail',
    'residents',
    'visitorLog',
    'visitorRegister',
    'helpdesk',
    'helpdeskDetail',
    'bookings',
    'bookingsDetail',
    'bookingCalendar',
    'bookingCheckin',
    'bookingFacilities',
    'bookingFacilitiesDetail',
    'bookingRates',
    'charges',
    'chargesDetail',
    'payments',
    'paymentsDetail',
    'refunds',
    'refundsDetail',
    's5',
    's5compose',
    's1',
    's4',
    'documents',
    'documentsDetail',
    'carPark',
  ] as const) {
    assert.equal(isPlaceScopedRail(screen, 'overview'), true, screen);
  }
});

test('the reference Properties page has no rail: its Locations tree is the page', () => {
  assert.equal(isPlaceScopedRail('s3', 'overview'), false);
});

test('Car Park stub shows the rail', () => {
  assert.equal(isPlaceScopedRail('stub', 'bs-carpark'), true);
});

test('Car Park connector screen shows the rail', () => {
  assert.equal(isPlaceScopedRail('carPark', 'bs-carpark'), true);
});

test('settings and non-place stubs hide the rail', () => {
  for (const navId of ['admin', 'adm-users', 'adm-groups', 'adm-roles', 'adm-email', 'reports', 'integrations', 'finance', 'bs-cctv']) {
    assert.equal(isPlaceScopedRail('stub', navId), false, navId);
  }
});

test('wired Administration screens hide the rail', () => {
  for (const screen of ['adminUsers', 'adminUsersDetail', 'adminGroups', 'adminGroupsDetail', 'adminRoles', 'adminEmail', 'adminAudit'] as const) {
    assert.equal(isPlaceScopedRail(screen, 'adm-users'), false, screen);
  }
});
