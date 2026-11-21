/**
 * Fixture session on the URL. Absent means signed in. Log out writes
 * session=signed-out. No localStorage.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SESSION_PARAM,
  SESSION_SIGNED_OUT,
  readSignedIn,
  writeSession,
} from '../../src/shell/session.ts';

test('missing session param is signed in', () => {
  const q = new URLSearchParams();
  assert.equal(readSignedIn(q), true);
});

test('signed-out writes and reads on the URL', () => {
  const q = new URLSearchParams();
  writeSession(q, false);
  assert.equal(q.get(SESSION_PARAM), SESSION_SIGNED_OUT);
  assert.equal(readSignedIn(q), false);

  writeSession(q, true);
  assert.equal(q.get(SESSION_PARAM), null);
  assert.equal(readSignedIn(q), true);
});

test('unknown session values stay signed in rather than inventing a lock-out', () => {
  const q = new URLSearchParams({ session: 'maybe' });
  assert.equal(readSignedIn(q), true);
});
