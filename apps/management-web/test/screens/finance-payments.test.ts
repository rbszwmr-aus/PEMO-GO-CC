/**
 * Strata / management-fee fixtures must resolve charges → receipts → refunds.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHARGE_ROWS,
  FINANCE_FIXTURE_NOW,
  HOUSEHOLD_CONTACT_EMAIL,
  PAYMENT_ROWS,
  REFUND_ROWS,
  findCharge,
  findPayment,
  findRefund,
  isScheduledSendDue,
  outstandingHkd,
  paymentsForCharge,
} from '../../src/data/finance-fixtures.ts';
import { HOUSEHOLDS_LIST } from '../../src/data/households-corpus.ts';

test('every charge list row has a household, unit path, and bilingual period kind', () => {
  assert.ok(CHARGE_ROWS.length >= 6, 'charge list is hollow');
  const statuses = new Set(CHARGE_ROWS.map((c) => c.status));
  assert.ok(statuses.has('due') && statuses.has('paid') && statuses.has('partial') && statuses.has('overdue'));
  for (const row of CHARGE_ROWS) {
    const hh = HOUSEHOLDS_LIST.households.find((h) => h.householdId === row.householdId);
    assert.ok(hh, `no household for ${row.chargeId}`);
    assert.ok(row.scope.node.id, `${row.chargeId} has no scope node`);
    assert.ok(row.kind['zh-Hant'].length > 0, `${row.chargeId} missing zh-Hant kind`);
    assert.equal(outstandingHkd(row), row.amountHkd - row.paidHkd);
    if (row.status === 'paid') assert.equal(row.paidHkd, row.amountHkd);
    if (row.status === 'due' || row.status === 'overdue') assert.equal(row.paidHkd, 0);
    if (row.status === 'partial') {
      assert.ok(row.paidHkd > 0);
      assert.ok(row.paidHkd < row.amountHkd);
    }
    assert.match(row.scheduledSendAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(row.invoiceNumber, /^INV-WFG-/);
    assert.equal(row.contactEmail, HOUSEHOLD_CONTACT_EMAIL[row.householdId]);
    assert.equal(row.contactEmail, hh?.contactEmail);
    assert.ok(row.lineItems.length >= 1);
    const lineSum = row.lineItems.reduce((n, i) => n + i.amountHkd, 0);
    assert.equal(lineSum, row.amountHkd);
  }
  const dueUnsent = CHARGE_ROWS.filter((c) => !c.invoiceSentAt && isScheduledSendDue(c.scheduledSendAt, FINANCE_FIXTURE_NOW));
  const soon = CHARGE_ROWS.filter((c) => !c.invoiceSentAt && !isScheduledSendDue(c.scheduledSendAt, FINANCE_FIXTURE_NOW));
  assert.ok(dueUnsent.length >= 1, 'need a charge already due to send');
  assert.ok(soon.length >= 1, 'need a charge scheduled soon');
});

test('every payment allocates to a known charge and names a stub method', () => {
  assert.ok(PAYMENT_ROWS.length >= 4, 'payment list is hollow');
  const methods = new Set(PAYMENT_ROWS.map((p) => p.method));
  assert.ok(methods.has('fps') && methods.has('cheque') && methods.has('cash') && methods.has('octopus'));
  for (const row of PAYMENT_ROWS) {
    assert.ok(row.allocations.length >= 1, `${row.paymentId} has no allocation`);
    const allocated = row.allocations.reduce((n, a) => n + a.amountHkd, 0);
    assert.equal(allocated, row.amountHkd, `${row.paymentId} allocation does not sum to the receipt`);
    for (const a of row.allocations) {
      assert.ok(findCharge(a.chargeId), `${row.paymentId} allocates to unknown ${a.chargeId}`);
    }
    assert.ok(row.scope.node.id, `${row.paymentId} has no scope node`);
  }
  assert.ok(paymentsForCharge('chg_wfg_a1_202608').some((p) => p.paymentId === 'pay_wfg_r1001'));
});

test('every refund names a household and a deferred-or-recorded status', () => {
  assert.ok(REFUND_ROWS.length >= 3, 'refund list is hollow');
  const statuses = new Set(REFUND_ROWS.map((r) => r.status));
  assert.ok(statuses.has('pending') && statuses.has('issued') && statuses.has('executed'));
  for (const row of REFUND_ROWS) {
    assert.ok(HOUSEHOLDS_LIST.households.some((h) => h.householdId === row.householdId), row.refundId);
    if (row.chargeId) assert.ok(findCharge(row.chargeId), `${row.refundId} names unknown charge`);
    assert.ok(row.reason['zh-Hant'].length > 0, `${row.refundId} missing zh-Hant reason`);
  }
});

test('findCharge, findPayment and findRefund miss unknown ids', () => {
  assert.equal(findCharge('chg_does_not_exist'), undefined);
  assert.equal(findPayment('pay_does_not_exist'), undefined);
  assert.equal(findRefund('ref_does_not_exist'), undefined);
  assert.ok(findCharge('chg_wfg_a1_202609'));
  assert.ok(findPayment('pay_wfg_r1001'));
  assert.ok(findRefund('ref_wfg_c2001'));
});
