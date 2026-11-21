/**
 * Fixture-first notice delivery: schedule gate, email outbox, print PDF,
 * lobby playlist and portal publish.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { householdContactEmail } from '../../src/data/households-corpus.ts';
import { WFG_STORY_IDS } from '../../src/data/notices-wfg-corpus.ts';
import { resetAdminEmailConfig, saveAdminEmailConfig, getAdminEmailConfig } from '../../src/data/admin-email-corpus.ts';
import { formatFromAddress } from '../../src/finance/invoice-mail.ts';
import {
  NOTICE_DELIVERY_FIXTURES,
  NOTICES_FIXTURE_NOW,
  deliveryPlanOf,
  deliveryRowsFor,
  noticeDeliveryDue,
  noticeDeliveryStatus,
  noticeEmailRecipients,
  noticeEmailSubject,
  processDueNoticeDeliveries,
  resetNoticeDeliveries,
  scheduleNoticeDelivery,
  sendNoticeNow,
} from '../../src/communicate/notice-delivery.ts';
import {
  noticePosterFileName,
  noticeToPoster,
  renderNoticePosterPdf,
} from '../../src/communicate/notice-poster.ts';
import { findWfgNoticeDetail } from '../../src/data/notices-wfg-corpus.ts';

const DUE = NOTICE_DELIVERY_FIXTURES.due;
const LATER = NOTICE_DELIVERY_FIXTURES.later;
const DRAFT = 'ntc_0820_bbq';

test('fixture clock has one due notice and one scheduled later', () => {
  resetNoticeDeliveries();
  const due = deliveryPlanOf(DUE);
  const later = deliveryPlanOf(LATER);
  assert.equal(DUE, WFG_STORY_IDS.feeReminder);
  assert.equal(LATER, WFG_STORY_IDS.agm);
  assert.equal(noticeDeliveryStatus(due), 'scheduled');
  assert.equal(noticeDeliveryDue(due), true);
  assert.ok(due.scheduledAt && due.scheduledAt < NOTICES_FIXTURE_NOW);
  assert.equal(noticeDeliveryStatus(later), 'scheduled');
  assert.equal(noticeDeliveryDue(later), false);
  assert.ok(later.scheduledAt && later.scheduledAt > NOTICES_FIXTURE_NOW);
  assert.equal(noticeDeliveryStatus(deliveryPlanOf(DRAFT)), 'draft');
});

test('notice poster PDF bytes are a non-empty A4 PDF', () => {
  const detail = findWfgNoticeDetail(DUE);
  assert.ok(detail);
  const model = noticeToPoster(detail!.notice, { scheduledAt: '2026-09-19T09:00:00+08:00', scopeLabel: 'Wing Fu Garden' });
  const bytes = renderNoticePosterPdf(model, 'en');
  assert.ok(bytes.byteLength > 400, `PDF too small: ${bytes.byteLength}`);
  assert.equal(new TextDecoder().decode(bytes.subarray(0, 5)), '%PDF-');
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /ESTATE NOTICE/);
  assert.match(text, /Wing Fu Garden/);
  assert.match(text, /ntc_wfg_fee_q3/);
  assert.equal(noticePosterFileName(model), 'notice-ntc_wfg_fee_q3-poster.pdf');
});

test('processDueNoticeDeliveries writes email outbox rows for the due notice', async () => {
  resetNoticeDeliveries();
  assert.equal(deliveryRowsFor(DUE).length, 0);
  const result = await processDueNoticeDeliveries(NOTICES_FIXTURE_NOW);
  assert.ok(result.sent.some((r) => r.noticeId === DUE && r.channel === 'email'));
  const emails = deliveryRowsFor(DUE).filter((r) => r.channel === 'email');
  assert.ok(emails.length >= 1);
  assert.equal(emails[0]!.to, householdContactEmail('hh_wfg_a_12_a1') ?? 'ho.meiyi@wingfu.example');
  assert.ok(noticeEmailRecipients(DUE).includes('ho.meiyi@wingfu.example'));
  assert.ok(noticeEmailRecipients(DUE).includes('tam.siufong@wingfu.example'));
  assert.match(noticeEmailSubject(DUE), /Q3 management fee reminder/);
  assert.equal(emails[0]!.status, 'outbox');
  assert.equal(emails[0]!.recordedAt, NOTICES_FIXTURE_NOW);
  assert.equal(noticeDeliveryStatus(deliveryPlanOf(DUE)), 'sent_displaying');
});

test('schedule gate does not deliver a later notice; Send now bypasses', async () => {
  resetNoticeDeliveries();
  const noon = await processDueNoticeDeliveries(NOTICES_FIXTURE_NOW);
  assert.ok(noon.skipped.some((s) => s.noticeId === LATER && s.reason === 'not-due'));
  assert.equal(deliveryRowsFor(LATER).length, 0);
  assert.equal(noticeDeliveryStatus(deliveryPlanOf(LATER)), 'scheduled');

  const now = await sendNoticeNow(LATER, undefined, NOTICES_FIXTURE_NOW);
  assert.ok(now.rows.length > 0);
  assert.ok(deliveryRowsFor(LATER).some((r) => r.channel === 'email'));
  assert.equal(noticeDeliveryStatus(deliveryPlanOf(LATER)), 'sent_displaying');
});

test('schedule then due job delivers a draft notice and updates lobby/portal', async () => {
  resetNoticeDeliveries();
  assert.equal(noticeDeliveryStatus(deliveryPlanOf(DRAFT)), 'draft');
  const scheduled = scheduleNoticeDelivery(DRAFT, {
    channels: ['email', 'print', 'lobby', 'portal'],
    scheduledAt: '2026-09-19T09:00:00+08:00',
  });
  assert.equal(scheduled.reason, undefined);
  assert.equal(noticeDeliveryStatus(scheduled.plan), 'scheduled');
  assert.equal(scheduled.plan.lobby?.display, 'queued');
  assert.equal(scheduled.plan.portal, 'pending');

  const result = await processDueNoticeDeliveries(NOTICES_FIXTURE_NOW);
  assert.ok(result.sent.some((r) => r.noticeId === DRAFT && r.channel === 'email'));
  assert.ok(deliveryRowsFor(DRAFT).some((r) => r.channel === 'print' && r.attachmentBytes && r.attachmentBytes > 400));
  assert.ok(deliveryRowsFor(DRAFT).some((r) => r.channel === 'lobby' && r.status === 'displaying'));
  assert.ok(deliveryRowsFor(DRAFT).some((r) => r.channel === 'portal' && r.status === 'published'));
  const after = deliveryPlanOf(DRAFT);
  assert.equal(after.lobby?.display, 'displaying');
  assert.equal(after.portal, 'published');
  assert.equal(noticeDeliveryStatus(after), 'sent_displaying');
});

test('admin Email config supplies From for notice SMTP settings', () => {
  resetAdminEmailConfig();
  saveAdminEmailConfig({
    ...getAdminEmailConfig(),
    fromName: 'Estate office',
    fromAddress: 'notices@wingfu.example',
  });
  assert.match(formatFromAddress(), /Estate office <notices@wingfu.example>/);
  resetAdminEmailConfig();
});
