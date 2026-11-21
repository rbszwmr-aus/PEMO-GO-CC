/**
 * Administration Email fixture store + test send + household To alignment.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAdminEmailConfig,
  resetAdminEmailConfig,
  saveAdminEmailConfig,
} from '../../src/data/admin-email-corpus.ts';
import { HOUSEHOLD_CONTACT_EMAIL } from '../../src/data/finance-fixtures.ts';
import { householdContactEmail } from '../../src/data/households-corpus.ts';
import {
  invoiceToAddress,
  outboxEntries,
  resetInvoiceSends,
  sendAdminTestEmail,
} from '../../src/finance/invoice-sends.ts';
import { formatFromAddress, resolveSmtpSettings } from '../../src/finance/invoice-mail.ts';
import { findCharge } from '../../src/data/finance-fixtures.ts';

test('admin email save persists in memory and not as a different object', () => {
  resetAdminEmailConfig();
  const saved = saveAdminEmailConfig({
    ...getAdminEmailConfig(),
    smtpHost: 'smtp.office.example',
    smtpPort: 465,
    encryption: 'tls',
    fromName: 'Estate office',
    fromAddress: 'office@wingfu.example',
    replyTo: 'desk@wingfu.example',
  });
  assert.equal(getAdminEmailConfig().smtpHost, 'smtp.office.example');
  assert.equal(saved.fromAddress, 'office@wingfu.example');
  assert.equal(resolveSmtpSettings().fromAddress, 'office@wingfu.example');
  assert.match(formatFromAddress(), /Estate office/);
  resetAdminEmailConfig();
  assert.equal(getAdminEmailConfig().smtpHost, 'smtp.wingfu.example');
});

test('sendAdminTestEmail writes an outbox row to the test recipient', async () => {
  resetAdminEmailConfig();
  resetInvoiceSends();
  const before = outboxEntries().filter((e) => e.chargeId === 'admin_email_test');
  assert.equal(before.length, 0);
  const entry = await sendAdminTestEmail();
  assert.equal(entry.to, 'alex.chen@wingfu.example');
  assert.match(entry.subject, /test email/i);
  assert.equal(entry.status, 'outbox');
  assert.equal(entry.delivery, 'outbox');
  assert.ok(outboxEntries().some((e) => e.outboxId === entry.outboxId));
});

test('invoice To prefers household.contactEmail over a stale charge field', () => {
  const row = findCharge('chg_wfg_a1_202609');
  assert.ok(row);
  assert.equal(householdContactEmail(row.householdId), 'ho.meiyi@wingfu.example');
  assert.equal(invoiceToAddress(row), HOUSEHOLD_CONTACT_EMAIL[row.householdId]);
  assert.equal(
    invoiceToAddress({ ...row, contactEmail: 'stale@example.test' }),
    'ho.meiyi@wingfu.example',
  );
});
