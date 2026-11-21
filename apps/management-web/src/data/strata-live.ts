/**
 * Strata + SMTP live payloads for management-web.
 *
 * Fixture rows stay the default. These types are what `?source=live` paints.
 * `log-only` is a recorded message that was not handed to SMTP — it is not `accepted`.
 */

import type { ChargeRow, PaymentRow } from './finance-fixtures.ts';
import type { Meta } from './types.ts';

export const LIVE_CHARGES_PATH = '/api/management-web/v0/strata/charges';
export const LIVE_PAYMENTS_PATH = '/api/management-web/v0/strata/payments';
export const LIVE_ADMIN_EMAIL_TEST_PATH = '/api/management-web/v0/admin/email/test';

export type MailStatus = 'queued' | 'sending' | 'accepted' | 'failed' | 'unknown' | 'log-only';
export type MailTransport = 'log' | 'smtp';

export interface ApiInvoiceEmail {
  status: 'none' | MailStatus;
  recordedAt: string | null;
  transport: MailTransport | null;
  detail: string | null;
}

export interface ApiCharge extends Omit<ChargeRow, 'invoiceSentAt'> {
  invoiceEmail: ApiInvoiceEmail;
}

export interface ChargeListResponse {
  meta: Meta;
  charges: ApiCharge[];
}

export interface ChargeReceipt {
  paymentId: string;
  method: PaymentRow['method'];
  amountHkd: number;
  paidOn: string;
}

export interface MailOutboxRow {
  outboxId: string;
  to: string;
  subject: string;
  status: MailStatus;
  transport: MailTransport;
  detail: string;
  recordedAt: string;
}

export interface ChargeDetailResponse {
  meta: Meta;
  charge: ApiCharge;
  receipts: ChargeReceipt[];
  invoiceSends: MailOutboxRow[];
}

export interface PaymentListResponse {
  meta: Meta;
  payments: PaymentRow[];
}

export interface MailSendResponse {
  meta: Meta;
  outboxId: string;
  kind: 'invoice' | 'admin_test' | 'notice';
  subjectId: string | null;
  to: string;
  from: string;
  subject: string;
  status: MailStatus;
  transport: MailTransport;
  detail: string;
}

export interface NoticeEmailDeliveryResponse {
  meta: Meta;
  noticeId: string;
  schedule: null;
  email: {
    recipientCount: number;
    sends: MailOutboxRow[];
  };
}

export interface NoticeEmailSendResponse {
  meta: Meta;
  noticeId: string;
  transport: MailTransport;
  results: Array<Omit<MailSendResponse, 'meta'>>;
}

/** A live charge the screens can render with the fixture row shape. */
export interface LiveChargeRow extends ChargeRow {
  invoiceEmail: ApiInvoiceEmail;
}

export function toLiveCharge(charge: ApiCharge): LiveChargeRow {
  return {
    ...charge,
    invoiceSentAt: charge.invoiceEmail.status === 'accepted' ? charge.invoiceEmail.recordedAt : null,
    invoiceEmail: charge.invoiceEmail,
  };
}

export function chargePath(chargeId: string): string {
  return `${LIVE_CHARGES_PATH}/${encodeURIComponent(chargeId)}`;
}

export function invoiceEmailPath(chargeId: string): string {
  return `${chargePath(chargeId)}/invoice-email`;
}

export function noticeDeliveryPath(noticeId: string): string {
  return `/api/management-web/v0/notices/${encodeURIComponent(noticeId)}/delivery`;
}

export function noticeEmailPath(noticeId: string): string {
  return `/api/management-web/v0/notices/${encodeURIComponent(noticeId)}/email`;
}
