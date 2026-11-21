/**
 * Scheduled generic invoice PDF + due send + schedule gate.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FINANCE_FIXTURE_NOW,
  findCharge,
} from '../../src/data/finance-fixtures.ts';
import {
  chargeToInvoice,
  invoicePdfFileName,
  renderInvoicePdf,
} from '../../src/finance/invoice-template.ts';
import {
  invoiceToAddress,
  outboxForCharge,
  processDueInvoiceSends,
  resetInvoiceSends,
  sendInvoiceNow,
} from '../../src/finance/invoice-sends.ts';
import { householdContactEmail } from '../../src/data/households-corpus.ts';
import { resetAdminEmailConfig, saveAdminEmailConfig, getAdminEmailConfig } from '../../src/data/admin-email-corpus.ts';
import { formatFromAddress } from '../../src/finance/invoice-mail.ts';

const DUE = 'chg_wfg_a1_202609';
const SOON = 'chg_wfg_c3_202609';

test('generic invoice PDF bytes are a non-empty PDF', () => {
  const row = findCharge(DUE);
  assert.ok(row);
  const bytes = renderInvoicePdf(chargeToInvoice(row), 'en');
  assert.ok(bytes.byteLength > 400, `PDF too small: ${bytes.byteLength}`);
  assert.equal(new TextDecoder().decode(bytes.subarray(0, 5)), '%PDF-');
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /INV-WFG-A1-202609/);
  assert.match(text, /Wing Fu Garden/);
  assert.match(text, /HKD 3,280/);
  assert.equal(invoicePdfFileName(chargeToInvoice(row)), 'INV-WFG-A1-202609.pdf');
});

test('processDueInvoiceSends writes an outbox entry for a due unsent charge', async () => {
  resetInvoiceSends();
  const before = outboxForCharge(DUE);
  assert.equal(before.length, 0);
  const result = await processDueInvoiceSends(FINANCE_FIXTURE_NOW);
  assert.ok(result.sent.some((e) => e.chargeId === DUE));
  const rows = outboxForCharge(DUE);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.to, householdContactEmail(findCharge(DUE)!.householdId) ?? 'ho.meiyi@wingfu.example');
  assert.equal(invoiceToAddress(findCharge(DUE)!), 'ho.meiyi@wingfu.example');
  assert.match(rows[0]!.subject, /INV-WFG-A1-202609/);
  assert.equal(rows[0]!.status, 'outbox');
  assert.ok(rows[0]!.attachmentBytes > 400);
  assert.equal(rows[0]!.sentAt, FINANCE_FIXTURE_NOW);
});

test('schedule gate does not send before scheduledSendAt', async () => {
  resetInvoiceSends();
  const early = await processDueInvoiceSends('2026-09-19T08:00:00+08:00');
  assert.ok(early.skipped.some((s) => s.chargeId === DUE && s.reason === 'not-due'));
  assert.equal(outboxForCharge(DUE).length, 0);
  assert.equal(outboxForCharge(SOON).length, 0);

  const noon = await processDueInvoiceSends(FINANCE_FIXTURE_NOW);
  assert.ok(noon.sent.some((e) => e.chargeId === DUE));
  assert.ok(noon.skipped.some((s) => s.chargeId === SOON && s.reason === 'not-due'));
  assert.equal(outboxForCharge(SOON).length, 0);

  const now = await sendInvoiceNow(SOON, FINANCE_FIXTURE_NOW);
  assert.ok(now.entry);
  assert.equal(outboxForCharge(SOON).length, 1);
});

test('admin Email config supplies From for invoice SMTP settings', () => {
  resetAdminEmailConfig();
  saveAdminEmailConfig({
    ...getAdminEmailConfig(),
    fromName: 'Test office',
    fromAddress: 'office@wingfu.example',
  });
  assert.match(formatFromAddress(), /Test office <office@wingfu.example>/);
  resetAdminEmailConfig();
});
