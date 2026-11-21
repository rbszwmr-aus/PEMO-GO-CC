/**
 * D1: one mail policy through dispatchMailBatch, fake, unconfigured, and
 * strata adapters. There is no worker or scheduled consumer.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CommunicationsUnavailableError,
  createFakeCommunicationsPort,
  createStrataCommunicationsAdapter,
  createUnconfiguredCommunicationsPort,
  dispatchMailBatch,
} from '../../apps/api/dist/communications/index.js';
import type { MailAdmitInput, MailDeliveryResult, MailKind } from '../../apps/api/dist/communications/port.js';
import type { StrataOutbox } from '@pemo/strata';

const deliverLog = async (): Promise<MailDeliveryResult> => ({
  status: 'log-only',
  transport: 'log',
  detail: 'log-transport',
});

const admit = (kind: MailKind, subjectId: string, to: string): MailAdmitInput => ({
  outboxId: `obx_${kind}_${to.split('@')[0]}`,
  organizationId: 'org_wingfu_holdings',
  kind,
  subjectId,
  subjectVersion: 1,
  to,
  generation: 1,
  from: 'noreply@example.test',
  subject: `${kind} subject`,
  bodyText: `${kind} body`,
  recordedBy: 'prn_staff',
  recipientScopeNodeKind: 'unit',
  recipientScopeNodeId: 'unit_1',
});

const stubStrataOutbox = (): StrataOutbox => {
  const port = createFakeCommunicationsPort();
  return {
    record: async () => { throw new Error('record is unused in this test'); },
    reserveMany: (rows) => port.reserveMany(rows),
    claimPending: (id) => port.claimPending(id),
    requeueFailed: (id) => port.requeueFailed(id),
    get: (id) => port.get(id),
    markResult: (id, delivery) => port.markResult(id, delivery),
    listForSubject: (input) => port.listForSubject(input),
    nextGeneration: (input) => port.nextGeneration(input),
  };
};

test('D1 communications policy is shared across dispatchMailBatch, fake, unconfigured, and strata adapters', async () => {
  const notice = admit('notice', 'ntc_1', 'notice@example.test');
  const invoice = admit('invoice', 'chg_1', 'invoice@example.test');

  const httpPort = createFakeCommunicationsPort();
  const httpReserved = await httpPort.reserveMany([notice, invoice]);
  const httpResult = await dispatchMailBatch(httpPort, httpReserved, [
    { to: notice.to, text: notice.bodyText },
    { to: invoice.to, text: invoice.bodyText },
  ], deliverLog, 50);
  assert.equal(httpResult.firstPreacceptError, undefined);
  assert.equal(httpResult.recorded.length, 2);
  assert.deepEqual(httpResult.recorded.map((r) => r.kind).sort(), ['invoice', 'notice']);
  for (const row of httpResult.recorded) {
    assert.equal(row.status, 'log-only');
    assert.equal(row.transport, 'log');
  }

  const unconfigured = createUnconfiguredCommunicationsPort();
  await assert.rejects(
    () => unconfigured.reserveMany([notice]),
    (error: unknown) => error instanceof CommunicationsUnavailableError
      && error.code === 'communications_unavailable',
  );

  const strata = createStrataCommunicationsAdapter(stubStrataOutbox());
  assert.equal(strata.adapter, 'strata');
  const reserved = await strata.reserveMany([notice, invoice]);
  const viaHttp = await dispatchMailBatch(strata, reserved, [
    { to: notice.to, text: notice.bodyText },
    { to: invoice.to, text: invoice.bodyText },
  ], deliverLog, 50);
  const noticeRow = viaHttp.recorded.find((r) => r.kind === 'notice');
  const invoiceRow = viaHttp.recorded.find((r) => r.kind === 'invoice');
  assert.ok(noticeRow);
  assert.ok(invoiceRow);
  assert.equal(noticeRow.status, 'log-only');
  assert.equal(invoiceRow.status, 'log-only');
  const listedNotice = await strata.listForSubject({
    organizationId: notice.organizationId, kind: 'notice', subjectId: 'ntc_1',
  });
  const listedInvoice = await strata.listForSubject({
    organizationId: invoice.organizationId, kind: 'invoice', subjectId: 'chg_1',
  });
  assert.equal(listedNotice.length, 1);
  assert.equal(listedInvoice.length, 1);
});
