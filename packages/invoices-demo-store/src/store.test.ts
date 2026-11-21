import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createInvoiceStore,
  deriveInvoiceStatus,
  FIXTURE_HOUSEHOLD_ID,
  FIXTURE_RESIDENT_ID,
  INVOICE_STATUSES,
  seedInvoices,
} from './index.js';

describe('invoices-demo-store', () => {
  it('seeds 6 invoices covering all four statuses', () => {
    const seed = seedInvoices();
    assert.equal(seed.length, 6);
    for (const s of INVOICE_STATUSES) {
      assert.ok(seed.some((i) => i.status === s), `missing ${s}`);
    }
  });

  it('amounts are integer HKD and consistent', () => {
    for (const i of seedInvoices()) {
      assert.equal(i.currency, 'HKD');
      for (const n of [i.amountHkd, i.paidHkd, i.balanceHkd]) assert.ok(Number.isInteger(n));
      assert.equal(i.amountHkd, i.lineItems.reduce((s, l) => s + l.amountHkd, 0));
      assert.equal(i.paidHkd, i.paymentsApplied.reduce((s, p) => s + p.amountHkd, 0));
      assert.equal(i.balanceHkd, i.amountHkd - i.paidHkd);
      for (const l of i.lineItems) assert.equal(l.amountHkd, l.quantity * l.unitAmountHkd);
      assert.equal(i.pdfUrl, null);
      assert.match(i.invoiceId, /^chg_wfg_a1_/);
    }
  });

  it('keeps strata seed ids/amounts for Sep (due) and Aug (paid)', () => {
    const store = createInvoiceStore();
    const sep = store.getForHousehold(FIXTURE_HOUSEHOLD_ID, 'chg_wfg_a1_202609');
    const aug = store.getForHousehold(FIXTURE_HOUSEHOLD_ID, 'chg_wfg_a1_202608');
    assert.equal(sep?.status, 'UNPAID');
    assert.equal(sep?.amountHkd, 3280);
    assert.equal(aug?.status, 'PAID');
    assert.equal(aug?.paymentsApplied[0]?.paymentId, 'pay_wfg_r1001');
  });

  it('resolves demo resident, lists newest first, filters by status', () => {
    const store = createInvoiceStore();
    const hh = store.householdForResident(FIXTURE_RESIDENT_ID);
    assert.equal(hh, FIXTURE_HOUSEHOLD_ID);
    const all = store.listForHousehold(FIXTURE_HOUSEHOLD_ID);
    assert.equal(all.length, 6);
    assert.equal(all[0]?.issueDate, '2026-09-01');
    assert.ok(!('lineItems' in (all[0] as object)));
    assert.deepEqual(store.listForHousehold(FIXTURE_HOUSEHOLD_ID, 'OVERDUE').map((i) => i.invoiceId), [
      'chg_wfg_a1_202607_lv',
    ]);
    assert.equal(store.householdForResident('res_someone_else'), null);
  });

  it('other household / unknown id → null', () => {
    const store = createInvoiceStore();
    assert.equal(store.getForHousehold('hh_wfg_b_03_b2', 'chg_wfg_a1_202609'), null);
    assert.equal(store.getForHousehold(FIXTURE_HOUSEHOLD_ID, 'chg_nope'), null);
  });

  it('summary counts + outstanding balance', () => {
    const s = createInvoiceStore().summaryForHousehold(FIXTURE_HOUSEHOLD_ID);
    assert.deepEqual(s.counts, { UNPAID: 1, PARTIAL: 1, PAID: 3, OVERDUE: 1 });
    assert.equal(s.totalCount, 6);
    assert.equal(s.outstandingBalanceHkd, 3280 + 1200 + 5600);
    assert.equal(s.overdueBalanceHkd, 5600);
    const empty = createInvoiceStore().summaryForHousehold(null);
    assert.equal(empty.totalCount, 0);
    assert.equal(empty.outstandingBalanceHkd, 0);
  });

  it('deriveInvoiceStatus precedence', () => {
    const base = { amountHkd: 100, dueDate: '2026-09-30', asOf: '2026-09-25' };
    assert.equal(deriveInvoiceStatus({ ...base, paidHkd: 0 }), 'UNPAID');
    assert.equal(deriveInvoiceStatus({ ...base, paidHkd: 40 }), 'PARTIAL');
    assert.equal(deriveInvoiceStatus({ ...base, paidHkd: 100 }), 'PAID');
    assert.equal(deriveInvoiceStatus({ ...base, paidHkd: 40, asOf: '2026-10-01' }), 'OVERDUE');
    assert.equal(deriveInvoiceStatus({ ...base, paidHkd: 0, asOf: '2026-09-30' }), 'UNPAID');
  });
});
