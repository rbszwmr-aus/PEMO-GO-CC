/**
 * TEST 6 — absence is not zero (R7).
 *
 * `null`/omitted means the property operates no such policy; a set value
 * (including 0) means it does. They render DIFFERENTLY. This tests the plain-TS
 * decision layer (policy.ts) so the mutation battery can attack the RENDER LOGIC
 * rather than the read-only fixture. Both directions (null->0 and 0->null) are
 * proven red in reports/UI-031-ST-step2-logs/test6.log.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { isAbsent, policyRows } from '../../src/data/policy.ts';
import { facilityAt } from '../../src/data/booking.ts';

test('isAbsent distinguishes null/undefined from zero — the one decision', () => {
  assert.equal(isAbsent(null), true, 'null is absent');
  assert.equal(isAbsent(undefined), true, 'undefined is absent');
  assert.equal(isAbsent(0), false, 'ZERO IS A VALUE, not absence');
  assert.equal(isAbsent(15), false);
});

const quota = (state: 'policy-absent' | 'policy-zero') =>
  policyRows(facilityAt(state)!.rules, 'en').find((r) => r.key === 'quota')!;
const adminFee = (state: 'policy-absent' | 'policy-zero') =>
  policyRows(facilityAt(state)!.rules, 'en').find((r) => r.key === 'adminFee')!;

test('function-room (null quota) renders as a NO-POLICY statement', () => {
  const r = quota('policy-absent');
  assert.equal(r.absent, true, 'a null quota must render as absent');
  assert.match(r.text, /no booking quota/i);
});

test('party-room (0 quota) renders as a VALUE of zero', () => {
  const r = quota('policy-zero');
  assert.equal(r.absent, false, 'a quota of 0 must render as a value, not absence');
  assert.match(r.text, /\b0\b/);
});

test('null and 0 render DIFFERENTLY — the distinction the contract preserves', () => {
  assert.notEqual(quota('policy-absent').text, quota('policy-zero').text);
  assert.notEqual(quota('policy-absent').absent, quota('policy-zero').absent);
});

test('adminFee: null (no fee policy) vs a fee of HK$0 are also distinct', () => {
  const absent = adminFee('policy-absent');
  const zero = adminFee('policy-zero');
  assert.equal(absent.absent, true);
  assert.match(absent.text, /no admin fee/i);
  assert.equal(zero.absent, false);
  assert.match(zero.text, /0/);
  assert.notEqual(absent.text, zero.text);
});
