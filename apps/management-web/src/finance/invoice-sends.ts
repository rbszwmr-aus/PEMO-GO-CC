/**
 * Scheduled generic invoice send — fixture store + job.
 *
 * `processDueInvoiceSends` is the product job (same function the staff
 * “Run due invoice sends” control calls). It renders the generic PDF, writes
 * an Email outbox row, and stamps `invoiceSentAt`. The schedule gate is
 * `scheduledSendAt <= now`. `sendInvoiceNow` is the demo bypass.
 */

import { appendAuditEvent } from '../data/audit-session.ts';
import {
  CHARGE_ROWS,
  FINANCE_FIXTURE_NOW,
  findCharge,
  isScheduledSendDue,
  type ChargeRow,
  type OutboxStatus,
} from '../data/finance-fixtures.ts';
import { householdContactEmail } from '../data/households-corpus.ts';
import { getAdminEmailConfig } from '../data/admin-email-corpus.ts';
import type { AdminEmailConfig } from '../data/types.ts';
import { deliverInvoiceEmail, formatFromAddress, resolveSmtpSettings } from './invoice-mail.ts';
import {
  chargeToInvoice,
  invoicePdfFileName,
  renderInvoicePdf,
} from './invoice-template.ts';

export interface OutboxEntry {
  outboxId: string;
  chargeId: string;
  invoiceNumber: string;
  to: string;
  subject: string;
  sentAt: string;
  status: OutboxStatus;
  attachmentName: string;
  attachmentBytes: number;
  delivery: 'outbox' | 'smtp';
}

export type SkipReason = 'already-sent' | 'not-due' | 'unknown';

export interface ProcessDueInvoiceSendsResult {
  nowIso: string;
  sent: OutboxEntry[];
  skipped: Array<{ chargeId: string; reason: SkipReason }>;
}

let revision = 0;
const listeners = new Set<() => void>();
const sentAtByCharge = new Map<string, string>();
const outbox: OutboxEntry[] = [];

function emit(): void {
  revision += 1;
  for (const l of listeners) l();
}

function seed(): void {
  sentAtByCharge.clear();
  outbox.length = 0;
  for (const row of CHARGE_ROWS) {
    if (!row.invoiceSentAt) continue;
    sentAtByCharge.set(row.chargeId, row.invoiceSentAt);
    outbox.push(buildEntry(row, row.invoiceSentAt, 'outbox', 'outbox'));
  }
}

seed();

export function resetInvoiceSends(): void {
  seed();
  emit();
}

export function subscribeInvoiceSends(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function invoiceSendRevision(): number {
  return revision;
}

export function invoiceSentAtOf(chargeId: string): string | null {
  return sentAtByCharge.get(chargeId) ?? findCharge(chargeId)?.invoiceSentAt ?? null;
}

export function outboxEntries(): OutboxEntry[] {
  return outbox.slice().sort((a, b) => (a.sentAt < b.sentAt ? 1 : a.sentAt > b.sentAt ? -1 : 0));
}

export function outboxForCharge(chargeId: string): OutboxEntry[] {
  return outboxEntries().filter((e) => e.chargeId === chargeId);
}

export function invoiceSubject(row: ChargeRow): string {
  return `Invoice ${row.invoiceNumber} — Wing Fu Garden management fee ${row.period}`;
}

/** Prefer household.contactEmail (fixture / live field); charge row is fallback. */
export function invoiceToAddress(row: ChargeRow): string {
  return householdContactEmail(row.householdId) ?? row.contactEmail;
}

function buildEntry(
  row: ChargeRow,
  sentAt: string,
  status: OutboxStatus,
  delivery: 'outbox' | 'smtp',
  attachmentBytes = 0,
): OutboxEntry {
  return {
    outboxId: `outbox_${row.chargeId}_${sentAt.replace(/[^0-9]/g, '')}`,
    chargeId: row.chargeId,
    invoiceNumber: row.invoiceNumber,
    to: invoiceToAddress(row),
    subject: invoiceSubject(row),
    sentAt,
    status,
    attachmentName: invoicePdfFileName(chargeToInvoice(row)),
    attachmentBytes,
    delivery,
  };
}

function recordInvoiceSendAudit(row: ChargeRow): void {
  appendAuditEvent({
    action: 'send_invoice_email',
    entity: { type: 'invoice', id: row.invoiceNumber },
    place: { nodeKind: row.scope.node.kind, nodeId: row.scope.node.id },
  });
}

async function sendCharge(row: ChargeRow, sentAt: string): Promise<OutboxEntry> {
  const model = chargeToInvoice(row);
  const pdf = renderInvoicePdf(model, 'en');
  const smtp = resolveSmtpSettings();
  const delivery = await deliverInvoiceEmail({
    to: invoiceToAddress(row),
    from: formatFromAddress(smtp),
    ...(smtp.replyTo ? { replyTo: smtp.replyTo } : {}),
    subject: invoiceSubject(row),
    text: `Please find invoice ${row.invoiceNumber} attached.`,
    attachmentName: invoicePdfFileName(model),
    attachmentBytes: pdf,
  });
  const entry = buildEntry(row, sentAt, delivery.status, delivery.delivery, pdf.byteLength);
  sentAtByCharge.set(row.chargeId, sentAt);
  outbox.push(entry);
  return entry;
}

/**
 * Job / endpoint: send every unsent charge whose `scheduledSendAt` has been
 * reached at `nowIso` (fixture noon unless a caller passes another instant).
 */
export async function processDueInvoiceSends(
  nowIso: string = FINANCE_FIXTURE_NOW,
): Promise<ProcessDueInvoiceSendsResult> {
  const sent: OutboxEntry[] = [];
  const skipped: Array<{ chargeId: string; reason: SkipReason }> = [];
  for (const row of CHARGE_ROWS) {
    if (invoiceSentAtOf(row.chargeId)) {
      skipped.push({ chargeId: row.chargeId, reason: 'already-sent' });
      continue;
    }
    if (!isScheduledSendDue(row.scheduledSendAt, nowIso)) {
      skipped.push({ chargeId: row.chargeId, reason: 'not-due' });
      continue;
    }
    sent.push(await sendCharge(row, nowIso));
    recordInvoiceSendAudit(row);
  }
  if (sent.length > 0) emit();
  return { nowIso, sent, skipped };
}

/** Demo bypass — send this charge even if `scheduledSendAt` is still in the future. */
export async function sendInvoiceNow(
  chargeId: string,
  nowIso: string = FINANCE_FIXTURE_NOW,
): Promise<{ entry: OutboxEntry | null; reason?: SkipReason }> {
  const row = findCharge(chargeId);
  if (!row) return { entry: null, reason: 'unknown' };
  if (invoiceSentAtOf(chargeId)) return { entry: null, reason: 'already-sent' };
  const entry = await sendCharge(row, nowIso);
  recordInvoiceSendAudit(row);
  emit();
  return { entry };
}

const TEST_CHARGE_ID = 'admin_email_test';

/** Administration → Email: write an outbox row; try SMTP when Node env is set. */
export async function sendAdminTestEmail(opts?: {
  config?: Partial<AdminEmailConfig>;
  nowIso?: string;
}): Promise<OutboxEntry> {
  const cfg = opts?.config ? { ...getAdminEmailConfig(), ...opts.config } : getAdminEmailConfig();
  const smtp = resolveSmtpSettings(cfg);
  const sentAt = opts?.nowIso ?? FINANCE_FIXTURE_NOW;
  const to = cfg.testRecipient || smtp.fromAddress;
  const subject = 'PEMO test email — Wing Fu Garden';
  const delivery = await deliverInvoiceEmail({
    to,
    from: formatFromAddress(smtp),
    ...(smtp.replyTo ? { replyTo: smtp.replyTo } : {}),
    subject,
    text: 'This is a PEMO Administration Email configuration test.',
    attachmentName: '',
    attachmentBytes: new Uint8Array(),
  }, cfg);
  const entry: OutboxEntry = {
    outboxId: `outbox_${TEST_CHARGE_ID}_${sentAt.replace(/[^0-9]/g, '')}_${revision + 1}`,
    chargeId: TEST_CHARGE_ID,
    invoiceNumber: 'TEST',
    to,
    subject,
    sentAt,
    status: delivery.status,
    attachmentName: '',
    attachmentBytes: 0,
    delivery: delivery.delivery,
  };
  outbox.push(entry);
  emit();
  return entry;
}
