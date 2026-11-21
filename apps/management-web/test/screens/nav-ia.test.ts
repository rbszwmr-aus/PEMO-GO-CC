/**
 * AMENITIES keeps Facility booking and its children. The standalone
 * Coming Soon `clubhouse` leaf is gone — Facility booking already owns that icon.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { NAV_IA, NAV_TO_SCREEN, isNavItemId, resolveAppScreen } from '../../src/data/nav-ia.ts';

test('AMENITIES shows only Facility booking', () => {
  const amenities = NAV_IA.find((g) => g.id === 'amenities');
  assert.ok(amenities, 'AMENITIES group missing');
  assert.deepEqual(
    amenities.items.map((it) => it.id),
    ['booking'],
  );
  assert.deepEqual(
    (amenities.items[0]?.children ?? []).map((c) => c.id),
    ['bk-bookings', 'bk-calendar', 'bk-checkin', 'bk-facilities', 'bk-rates'],
  );
  assert.equal(amenities.items[0]?.iconImg, '/icons/clubhouse-w.png');
});

test('removed clubhouse nav id is not a Coming Soon stub', () => {
  assert.equal(isNavItemId('clubhouse'), false);
  assert.equal((NAV_TO_SCREEN as Record<string, string | undefined>)['clubhouse'], undefined);
  assert.deepEqual(resolveAppScreen('clubhouse'), { kind: 'screen', screen: 's2' });
});

test('Car Park nav wires to the ParkCore connector', () => {
  assert.equal(NAV_TO_SCREEN['bs-carpark'], 'carPark');
  assert.deepEqual(resolveAppScreen('bs-carpark'), { kind: 'screen', screen: 'carPark' });
  assert.deepEqual(resolveAppScreen('carPark'), { kind: 'screen', screen: 'carPark' });
});

test('Reports sits directly above Administration, not near the top', () => {
  const configure = NAV_IA.find((g) => g.id === 'configure');
  assert.ok(configure, 'CONFIGURE group missing');
  const ids = configure.items.map((it) => it.id);
  assert.equal(ids.at(-1), 'admin');
  assert.equal(ids.at(-2), 'reports');
  assert.equal(NAV_IA.findIndex((g) => g.items.some((it) => it.id === 'reports')), NAV_IA.length - 1);
});
