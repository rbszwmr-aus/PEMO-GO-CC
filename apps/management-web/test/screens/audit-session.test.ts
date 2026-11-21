/**
 * Session-memory audit appends merge with the Wing Fu seed, in the contract’s event shape.
 * Actor is the fixture signed-in staff. No localStorage.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { addAdminGroupMember, removeAdminGroupMember, resetAdminDirectory } from '../../src/data/admin-directory-session.ts';
import { AUDIT_FIXTURE } from '../../src/audit/audit-fixture.ts';
import {
  FIXTURE_SIGNED_IN_STAFF,
  allAuditEvents,
  appendAuditEvent,
  isSessionAuditEvent,
  resetAuditSession,
  sessionAuditEvents,
} from '../../src/data/audit-session.ts';
import {
  NOTICE_DELIVERY_FIXTURES,
  resetNoticeDeliveries,
  scheduleNoticeDelivery,
  sendNoticeNow,
} from '../../src/communicate/notice-delivery.ts';
import { resetInvoiceSends, sendInvoiceNow } from '../../src/finance/invoice-sends.ts';

const SEED_COUNT = AUDIT_FIXTURE.events.length;

test('empty session list is the Wing Fu seed, newest first', () => {
  resetAuditSession();
  const list = allAuditEvents();
  assert.equal(list.length, SEED_COUNT);
  assert.equal(list[0]?.eventId, AUDIT_FIXTURE.events[0]?.eventId);
  assert.equal(sessionAuditEvents().length, 0);
});

test('appended events merge ahead of the seed when they are newer', () => {
  resetAuditSession();
  const row = appendAuditEvent({
    action: 'send_invoice_email',
    entity: { type: 'invoice', id: 'INV-TEST' },
    place: { nodeKind: 'estate', nodeId: 'est_wing_fu_garden' },
    occurredAt: '2026-09-21T18:00:00+08:00',
  });
  assert.equal(row.actor?.principalId, FIXTURE_SIGNED_IN_STAFF.principalId);
  assert.equal(row.actor?.displayName, FIXTURE_SIGNED_IN_STAFF.displayName);
  assert.ok(row.authority, 'a session event carries the authority the signed-in staff acts under');
  assert.equal(row.source, 'principal');
  assert.ok(isSessionAuditEvent(row.eventId));
  const list = allAuditEvents();
  assert.equal(list.length, SEED_COUNT + 1);
  assert.equal(list[0]?.eventId, row.eventId);
  assert.equal(list[1]?.eventId, AUDIT_FIXTURE.events[0]?.eventId);
});

test('add and remove membership append group audit rows', () => {
  resetAuditSession();
  resetAdminDirectory();
  assert.equal(addAdminGroupMember('grp_wfg_security', 'stf_wfg_alex'), true);
  assert.equal(removeAdminGroupMember('grp_wfg_security', 'stf_wfg_alex'), true);
  const session = sessionAuditEvents();
  assert.equal(session.length, 2);
  assert.equal(session[0]?.action, 'add_membership');
  assert.equal(session[0]?.entity.type, 'membership');
  assert.ok(session[0]?.entity.id.includes('grp_wfg_security'));
  assert.equal(session[1]?.action, 'remove_membership');
  assert.equal(addAdminGroupMember('grp_wfg_security', 'stf_wfg_alex'), true);
  assert.equal(addAdminGroupMember('grp_wfg_security', 'stf_wfg_alex'), false);
  assert.equal(sessionAuditEvents().length, 3);
});

test('notice schedule and send append notice audit rows', async () => {
  resetAuditSession();
  resetNoticeDeliveries();
  const scheduled = scheduleNoticeDelivery('ntc_0820_bbq', {
    channels: ['email', 'print'],
    scheduledAt: '2026-09-19T09:00:00+08:00',
  });
  assert.equal(scheduled.reason, undefined);
  const sent = await sendNoticeNow(NOTICE_DELIVERY_FIXTURES.due);
  assert.ok(sent.rows.length > 0);
  const session = sessionAuditEvents();
  assert.ok(session.some((r) => r.action === 'publish_notice' && r.entity.id === 'ntc_0820_bbq'));
  assert.ok(session.some((r) => r.action === 'send_notice_email' && r.entity.id === NOTICE_DELIVERY_FIXTURES.due));
  assert.ok(session.every((r) => r.entity.type === 'notice' && r.place.nodeId.length > 0));
});

test('invoice Send now appends a send_invoice_email row', async () => {
  resetAuditSession();
  resetInvoiceSends();
  const result = await sendInvoiceNow('chg_wfg_a1_202609');
  assert.ok(result.entry);
  const row = sessionAuditEvents().find((r) => r.action === 'send_invoice_email');
  assert.ok(row);
  assert.equal(row.entity.id, 'INV-WFG-A1-202609');
  assert.equal(row.entity.type, 'invoice');
  assert.equal(row.place.nodeKind, 'unit');
  assert.equal(row.actor?.principalId, 'stf_wfg_alex');
});

test('resetAuditSession drops session rows and leaves the seed', () => {
  resetAuditSession();
  appendAuditEvent({
    action: 'send_admin_test_email',
    entity: { type: 'email', id: 'eml_test' },
    place: { nodeKind: 'estate', nodeId: 'est_wing_fu_garden' },
    occurredAt: '2026-09-21T19:00:00+08:00',
  });
  assert.equal(allAuditEvents().length, SEED_COUNT + 1);
  resetAuditSession();
  assert.equal(sessionAuditEvents().length, 0);
  assert.equal(allAuditEvents().length, SEED_COUNT);
});
