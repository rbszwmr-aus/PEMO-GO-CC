/**
 * ParkCore connector: PEMO only names the origin and known deep-link stubs.
 * Isolation is a URL, not an embed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PARKCORE_LAN_ORIGIN_PLACEHOLDER,
  PARKCORE_ORIGIN,
  PARKCORE_PATHS,
  PARKCORE_SSO_STUB_CODE,
  parkcoreHref,
  parkcoreSsoStubHref,
} from '../../src/data/parkcore-link.ts';

test('ParkCore console href is localhost:5177', () => {
  assert.equal(PARKCORE_ORIGIN, 'http://localhost:5177');
  assert.equal(parkcoreHref(), 'http://localhost:5177/');
  assert.equal(parkcoreHref(PARKCORE_PATHS.console), 'http://localhost:5177/');
  assert.match(PARKCORE_LAN_ORIGIN_PLACEHOLDER, /^http:\/\/<lan-host>:5177\/$/);
});

test('ParkCore Counter and Lists are origin-relative deep-link stubs', () => {
  assert.equal(parkcoreHref(PARKCORE_PATHS.counter), 'http://localhost:5177/counter');
  assert.equal(parkcoreHref(PARKCORE_PATHS.lists), 'http://localhost:5177/lists');
});

test('ParkCore SSO stub is a fixture callback on :5177 carrying a one-time code', () => {
  assert.equal(PARKCORE_PATHS.ssoCallback, '/sso/callback');
  const href = parkcoreSsoStubHref();
  const url = new URL(href);
  assert.equal(url.origin, PARKCORE_ORIGIN);
  assert.equal(url.pathname, '/sso/callback');
  assert.equal(url.searchParams.get('code'), PARKCORE_SSO_STUB_CODE);
  assert.equal(url.searchParams.get('aud'), 'parkcore');
  assert.equal(href.startsWith('http://localhost:5177/sso/callback?'), true);
});
