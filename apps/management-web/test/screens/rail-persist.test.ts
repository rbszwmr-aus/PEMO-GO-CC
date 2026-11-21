/**
 * Rail open/closed on the URL. Absent means open (first visit).
 * Each rail has its own query key.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COLLAPSED_VALUE,
  NAV_COLLAPSED_PARAM,
  SCOPE_COLLAPSED_PARAM,
  readRailCollapsed,
  writeRailCollapsed,
} from '../../src/shell/rail-persist.ts';

test('missing params fall open', () => {
  const q = new URLSearchParams();
  assert.equal(readRailCollapsed(q, NAV_COLLAPSED_PARAM), false);
  assert.equal(readRailCollapsed(q, SCOPE_COLLAPSED_PARAM), false);
});

test('write and read are independent per rail', () => {
  const q = new URLSearchParams();
  writeRailCollapsed(q, NAV_COLLAPSED_PARAM, true);
  writeRailCollapsed(q, SCOPE_COLLAPSED_PARAM, false);
  assert.equal(q.get(NAV_COLLAPSED_PARAM), COLLAPSED_VALUE);
  assert.equal(q.get(SCOPE_COLLAPSED_PARAM), null);
  assert.equal(readRailCollapsed(q, NAV_COLLAPSED_PARAM), true);
  assert.equal(readRailCollapsed(q, SCOPE_COLLAPSED_PARAM), false);

  writeRailCollapsed(q, SCOPE_COLLAPSED_PARAM, true);
  writeRailCollapsed(q, NAV_COLLAPSED_PARAM, false);
  assert.equal(readRailCollapsed(q, NAV_COLLAPSED_PARAM), false);
  assert.equal(readRailCollapsed(q, SCOPE_COLLAPSED_PARAM), true);
});

test('unknown values fall open rather than inventing a closed first visit', () => {
  const q = new URLSearchParams({ nav: 'maybe' });
  assert.equal(readRailCollapsed(q, NAV_COLLAPSED_PARAM), false);
});
