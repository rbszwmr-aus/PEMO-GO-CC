/**
 * Page fixture corpus for strata / management-fee Payments (charges,
 * receipts, refunds).
 *
 * NOT a management-web contract operation — v0 freeze has no finance list/write
 * endpoints and no live PSP. Rows are Wing Fu Garden demo data (HKD) for
 * hard-refresh review. Labeled fixture corpus for this page only; do not treat
 * as live API fields. ParkCore parking fees stay outside this slice.
 */

import type { Locale, LocalizedText } from '../i18n/locale.ts';
import { copy, bcp47 } from '../i18n/locale.ts';
import { number } from '../format/datetime.ts';
import type { ScopePath } from './types.ts';
import { HOUSEHOLDS_LIST, householdContactEmail } from './households-corpus.ts';

export type ChargeStatus = 'due' | 'paid' | 'partial' | 'overdue';
export type ChargeTone = 'normal' | 'information' | 'warning' | 'unknown';
export type PaymentMethod = 'fps' | 'cheque' | 'cash' | 'octopus';
export type RefundStatus = 'pending' | 'issued' | 'executed';
export type InvoiceSendBadge = 'scheduled' | 'due' | 'sent';
export type OutboxStatus = 'outbox' | 'sent' | 'failed';

export const FINANCE_FIXTURE_TODAY = '2026-09-19';
/** Fixture clock for invoice schedule gates. Not the browser wall clock. */
export const FINANCE_FIXTURE_NOW = '2026-09-19T12:00:00+08:00';

const m = copy;

export interface InvoiceLineItem {
  description: LocalizedText;
  amountHkd: number;
}

function householdOf(householdId: string) {
  const row = HOUSEHOLDS_LIST.households.find((h) => h.householdId === householdId);
  if (!row) {
    throw new Error(`finance fixtures: household ${householdId} is not in HOUSEHOLDS_LIST`);
  }
  return row;
}

const HH_A1 = householdOf('hh_wfg_a_12_a1');
const HH_B2 = householdOf('hh_wfg_b_03_b2');
const HH_C3 = householdOf('hh_wfg_c_08_c3');
const HH_A4 = householdOf('hh_wfg_a_05_a4_ended');

const KIND_MGMT = m('Monthly management fee', '每月管理費', '每月物业费');

function requireContactEmail(householdId: string): string {
  const email = householdContactEmail(householdId);
  if (!email) {
    throw new Error(`finance fixtures: household ${householdId} has no contactEmail`);
  }
  return email;
}

const EMAIL_A1 = requireContactEmail(HH_A1.householdId);
const EMAIL_B2 = requireContactEmail(HH_B2.householdId);
const EMAIL_C3 = requireContactEmail(HH_C3.householdId);
const EMAIL_A4 = requireContactEmail(HH_A4.householdId);

function invoiceFields(
  unitCode: string,
  period: string,
  amountHkd: number,
  scheduledSendAt: string,
  invoiceSentAt: string | null,
  contactEmail: string,
): Pick<ChargeRow, 'invoiceNumber' | 'scheduledSendAt' | 'invoiceSentAt' | 'lineItems' | 'contactEmail'> {
  return {
    invoiceNumber: `INV-WFG-${unitCode}-${period.replace('-', '')}`,
    scheduledSendAt,
    invoiceSentAt,
    lineItems: [{ description: KIND_MGMT, amountHkd }],
    contactEmail,
  };
}

export interface ChargeRow {
  chargeId: string;
  householdId: string;
  residentId: string;
  payerName: string;
  unitSummary: LocalizedText;
  scope: ScopePath;
  period: string;
  kind: LocalizedText;
  issuedOn: string;
  dueOn: string;
  amountHkd: number;
  paidHkd: number;
  status: ChargeStatus;
  tone: ChargeTone;
  staffNotes: LocalizedText | null;
  invoiceNumber: string;
  scheduledSendAt: string;
  invoiceSentAt: string | null;
  lineItems: InvoiceLineItem[];
  contactEmail: string;
}

export interface PaymentAllocation {
  chargeId: string;
  amountHkd: number;
}

export interface PaymentRow {
  paymentId: string;
  householdId: string;
  residentId: string;
  payerName: string;
  unitSummary: LocalizedText;
  scope: ScopePath;
  paidOn: string;
  method: PaymentMethod;
  amountHkd: number;
  reference: LocalizedText;
  allocations: PaymentAllocation[];
  staffNotes: LocalizedText | null;
}

export interface RefundRow {
  refundId: string;
  householdId: string;
  residentId: string;
  payerName: string;
  unitSummary: LocalizedText;
  scope: ScopePath;
  requestedOn: string;
  amountHkd: number;
  status: RefundStatus;
  chargeId: string | null;
  reason: LocalizedText;
  staffNotes: LocalizedText | null;
}

export const CHARGE_ROWS: ChargeRow[] = [
  {
    chargeId: 'chg_wfg_a1_202609',
    householdId: HH_A1.householdId,
    residentId: 'res_wfg_000412',
    payerName: HH_A1.primaryName,
    unitSummary: HH_A1.unitSummary,
    scope: HH_A1.scope,
    period: '2026-09',
    kind: KIND_MGMT,
    issuedOn: '2026-09-01',
    dueOn: '2026-09-30',
    amountHkd: 3280,
    paidHkd: 0,
    status: 'due',
    tone: 'information',
    staffNotes: m('September statement — not yet paid.', '九月帳單 — 尚未繳付。', '九月账单 — 尚未缴付。'),
    ...invoiceFields('A1', '2026-09', 3280, '2026-09-19T09:00:00+08:00', null, EMAIL_A1),
  },
  {
    chargeId: 'chg_wfg_b2_202609',
    householdId: HH_B2.householdId,
    residentId: 'res_wfg_000501',
    payerName: HH_B2.primaryName,
    unitSummary: HH_B2.unitSummary,
    scope: HH_B2.scope,
    period: '2026-09',
    kind: KIND_MGMT,
    issuedOn: '2026-09-01',
    dueOn: '2026-09-30',
    amountHkd: 3150,
    paidHkd: 1500,
    status: 'partial',
    tone: 'warning',
    staffNotes: m('Octopus part-payment recorded on 10 Sep.', '9 月 10 日已錄八達通部分付款。', '9 月 10 日已录八达通部分付款。'),
    ...invoiceFields('B2', '2026-09', 3150, '2026-09-19T08:30:00+08:00', null, EMAIL_B2),
  },
  {
    chargeId: 'chg_wfg_c3_202609',
    householdId: HH_C3.householdId,
    residentId: 'res_wfg_000908',
    payerName: HH_C3.primaryName,
    unitSummary: HH_C3.unitSummary,
    scope: HH_C3.scope,
    period: '2026-09',
    kind: KIND_MGMT,
    issuedOn: '2026-09-01',
    dueOn: '2026-09-30',
    amountHkd: 2980,
    paidHkd: 0,
    status: 'due',
    tone: 'information',
    staffNotes: null,
    ...invoiceFields('C3', '2026-09', 2980, '2026-09-19T18:00:00+08:00', null, EMAIL_C3),
  },
  {
    chargeId: 'chg_wfg_a1_202608',
    householdId: HH_A1.householdId,
    residentId: 'res_wfg_000412',
    payerName: HH_A1.primaryName,
    unitSummary: HH_A1.unitSummary,
    scope: HH_A1.scope,
    period: '2026-08',
    kind: KIND_MGMT,
    issuedOn: '2026-08-01',
    dueOn: '2026-08-31',
    amountHkd: 3280,
    paidHkd: 3280,
    status: 'paid',
    tone: 'normal',
    staffNotes: m('Settled by FPS on 3 Aug.', '8 月 3 日已以轉數快結清。', '8 月 3 日已以转数快结清。'),
    ...invoiceFields('A1', '2026-08', 3280, '2026-08-01T09:00:00+08:00', '2026-08-01T09:05:00+08:00', EMAIL_A1),
  },
  {
    chargeId: 'chg_wfg_b2_202608',
    householdId: HH_B2.householdId,
    residentId: 'res_wfg_000501',
    payerName: HH_B2.primaryName,
    unitSummary: HH_B2.unitSummary,
    scope: HH_B2.scope,
    period: '2026-08',
    kind: KIND_MGMT,
    issuedOn: '2026-08-01',
    dueOn: '2026-08-31',
    amountHkd: 3150,
    paidHkd: 3150,
    status: 'paid',
    tone: 'normal',
    staffNotes: m('Settled by cheque on 5 Aug.', '8 月 5 日已以支票結清。', '8 月 5 日已以支票结清。'),
    ...invoiceFields('B2', '2026-08', 3150, '2026-08-01T09:00:00+08:00', '2026-08-01T09:06:00+08:00', EMAIL_B2),
  },
  {
    chargeId: 'chg_wfg_c3_202608',
    householdId: HH_C3.householdId,
    residentId: 'res_wfg_000908',
    payerName: HH_C3.primaryName,
    unitSummary: HH_C3.unitSummary,
    scope: HH_C3.scope,
    period: '2026-08',
    kind: KIND_MGMT,
    issuedOn: '2026-08-01',
    dueOn: '2026-08-31',
    amountHkd: 2980,
    paidHkd: 0,
    status: 'overdue',
    tone: 'warning',
    staffNotes: m('August fee still open on the fixture clock (19 Sep).', '固定時鐘（9 月 19 日）上八月費用仍未清。', '固定时钟（9 月 19 日）上八月费用仍未清。'),
    ...invoiceFields('C3', '2026-08', 2980, '2026-08-01T09:00:00+08:00', null, EMAIL_C3),
  },
  {
    chargeId: 'chg_wfg_a4_202607',
    householdId: HH_A4.householdId,
    residentId: 'res_wfg_000220',
    payerName: HH_A4.primaryName,
    unitSummary: HH_A4.unitSummary,
    scope: HH_A4.scope,
    period: '2026-07',
    kind: KIND_MGMT,
    issuedOn: '2026-07-01',
    dueOn: '2026-07-31',
    amountHkd: 3100,
    paidHkd: 3100,
    status: 'paid',
    tone: 'normal',
    staffNotes: m('Last full month before occupancy ended.', '佔用結束前最後一個完整月份。', '占用结束前最后一个完整月份。'),
    ...invoiceFields('A4', '2026-07', 3100, '2026-07-01T09:00:00+08:00', '2026-07-01T09:04:00+08:00', EMAIL_A4),
  },
  {
    chargeId: 'chg_wfg_a1_202607',
    householdId: HH_A1.householdId,
    residentId: 'res_wfg_000412',
    payerName: HH_A1.primaryName,
    unitSummary: HH_A1.unitSummary,
    scope: HH_A1.scope,
    period: '2026-07',
    kind: KIND_MGMT,
    issuedOn: '2026-07-01',
    dueOn: '2026-07-31',
    amountHkd: 3280,
    paidHkd: 3280,
    status: 'paid',
    tone: 'normal',
    staffNotes: null,
    ...invoiceFields('A1', '2026-07', 3280, '2026-07-01T09:00:00+08:00', '2026-07-01T09:03:00+08:00', EMAIL_A1),
  },
];

export const PAYMENT_ROWS: PaymentRow[] = [
  {
    paymentId: 'pay_wfg_r1001',
    householdId: HH_A1.householdId,
    residentId: 'res_wfg_000412',
    payerName: HH_A1.primaryName,
    unitSummary: HH_A1.unitSummary,
    scope: HH_A1.scope,
    paidOn: '2026-08-03',
    method: 'fps',
    amountHkd: 3280,
    reference: m('FPS stub · WFG-A1-0803', '轉數快 Stub · WFG-A1-0803', '转数快 Stub · WFG-A1-0803'),
    allocations: [{ chargeId: 'chg_wfg_a1_202608', amountHkd: 3280 }],
    staffNotes: m('Counter confirmed FPS reference. No live PSP.', '櫃檯已核對轉數快參考編號。並無即時付款服務。', '柜台已核对转数快参考编号。并无即时付款服务。'),
  },
  {
    paymentId: 'pay_wfg_r1002',
    householdId: HH_B2.householdId,
    residentId: 'res_wfg_000501',
    payerName: HH_B2.primaryName,
    unitSummary: HH_B2.unitSummary,
    scope: HH_B2.scope,
    paidOn: '2026-08-05',
    method: 'cheque',
    amountHkd: 3150,
    reference: m('Cheque stub · 382194', '支票 Stub · 382194', '支票 Stub · 382194'),
    allocations: [{ chargeId: 'chg_wfg_b2_202608', amountHkd: 3150 }],
    staffNotes: m('Cheque cleared in the fixture week of 10 Aug.', '支票於固定資料的 8 月 10 日一週兌現。', '支票于固定数据的 8 月 10 日一周兑现。'),
  },
  {
    paymentId: 'pay_wfg_r1003',
    householdId: HH_A4.householdId,
    residentId: 'res_wfg_000220',
    payerName: HH_A4.primaryName,
    unitSummary: HH_A4.unitSummary,
    scope: HH_A4.scope,
    paidOn: '2026-07-04',
    method: 'cash',
    amountHkd: 3100,
    reference: m('Cash stub · desk 2', '現金 Stub · 2 號櫃檯', '现金 Stub · 2 号柜台'),
    allocations: [{ chargeId: 'chg_wfg_a4_202607', amountHkd: 3100 }],
    staffNotes: null,
  },
  {
    paymentId: 'pay_wfg_r1004',
    householdId: HH_B2.householdId,
    residentId: 'res_wfg_000501',
    payerName: HH_B2.primaryName,
    unitSummary: HH_B2.unitSummary,
    scope: HH_B2.scope,
    paidOn: '2026-09-10',
    method: 'octopus',
    amountHkd: 1500,
    reference: m('Octopus stub · tap 19:12', '八達通 Stub · 19:12 拍卡', '八达通 Stub · 19:12 拍卡'),
    allocations: [{ chargeId: 'chg_wfg_b2_202609', amountHkd: 1500 }],
    staffNotes: m('Part-payment only. Balance stays on the September charge.', '僅部分付款。餘額仍掛於九月帳單。', '仅部分付款。余额仍挂于九月账单。'),
  },
  {
    paymentId: 'pay_wfg_r1005',
    householdId: HH_A1.householdId,
    residentId: 'res_wfg_000412',
    payerName: HH_A1.primaryName,
    unitSummary: HH_A1.unitSummary,
    scope: HH_A1.scope,
    paidOn: '2026-07-03',
    method: 'fps',
    amountHkd: 3280,
    reference: m('FPS stub · WFG-A1-0703', '轉數快 Stub · WFG-A1-0703', '转数快 Stub · WFG-A1-0703'),
    allocations: [{ chargeId: 'chg_wfg_a1_202607', amountHkd: 3280 }],
    staffNotes: null,
  },
];

export const REFUND_ROWS: RefundRow[] = [
  {
    refundId: 'ref_wfg_c2001',
    householdId: HH_A1.householdId,
    residentId: 'res_wfg_000412',
    payerName: HH_A1.primaryName,
    unitSummary: HH_A1.unitSummary,
    scope: HH_A1.scope,
    requestedOn: '2026-09-12',
    amountHkd: 80,
    status: 'pending',
    chargeId: 'chg_wfg_a1_202608',
    reason: m('Overpayment credit on the August fee.', '八月費用溢繳貸記。', '八月费用溢缴贷记。'),
    staffNotes: m('Waiting to be paid out to the household.', '等待向住戶發放。', '等待向住户发放。'),
  },
  {
    refundId: 'ref_wfg_c2002',
    householdId: HH_B2.householdId,
    residentId: 'res_wfg_000501',
    payerName: HH_B2.primaryName,
    unitSummary: HH_B2.unitSummary,
    scope: HH_B2.scope,
    requestedOn: '2026-08-18',
    amountHkd: 150,
    status: 'issued',
    chargeId: 'chg_wfg_b2_202608',
    reason: m('Rate-card correction credit after the August statement.', '八月帳單後的收費更正貸記。', '八月账单后的收费更正贷记。'),
    staffNotes: m('Credit note issued in the office book. Not paid out.', '辦事處帳冊已發貸記單。尚未支款。', '办事处账册已发贷记单。尚未支款。'),
  },
  {
    refundId: 'ref_wfg_c2003',
    householdId: HH_A4.householdId,
    residentId: 'res_wfg_000220',
    payerName: HH_A4.primaryName,
    unitSummary: HH_A4.unitSummary,
    scope: HH_A4.scope,
    requestedOn: '2026-08-02',
    amountHkd: 400,
    status: 'executed',
    chargeId: 'chg_wfg_a4_202607',
    reason: m('Residual credit when occupancy ended.', '佔用結束時的剩餘貸記。', '占用结束时的剩余贷记。'),
    staffNotes: m('Fixture-executed against the July cash receipt. No PSP.', '固定資料上已對七月現金收據執行。並無付款服務商。', '固定数据上已对七月现金收据执行。并无付款服务商。'),
  },
];

export const CHARGE_DETAIL_DEFAULT = CHARGE_ROWS[0]!;
export const PAYMENT_DETAIL_DEFAULT = PAYMENT_ROWS[0]!;
export const REFUND_DETAIL_DEFAULT = REFUND_ROWS[0]!;

export const CHARGE_STATUSES: readonly ChargeStatus[] = ['due', 'paid', 'partial', 'overdue'];
export const PAYMENT_METHODS: readonly PaymentMethod[] = ['fps', 'cheque', 'cash', 'octopus'];
export const REFUND_STATUSES: readonly RefundStatus[] = ['pending', 'issued', 'executed'];

export function findCharge(chargeId: string): ChargeRow | undefined {
  return CHARGE_ROWS.find((c) => c.chargeId === chargeId);
}

export function findPayment(paymentId: string): PaymentRow | undefined {
  return PAYMENT_ROWS.find((p) => p.paymentId === paymentId);
}

export function findRefund(refundId: string): RefundRow | undefined {
  return REFUND_ROWS.find((r) => r.refundId === refundId);
}

export function outstandingHkd(row: ChargeRow): number {
  return row.amountHkd - row.paidHkd;
}

export function paymentsForCharge(chargeId: string): PaymentRow[] {
  return PAYMENT_ROWS.filter((p) => p.allocations.some((a) => a.chargeId === chargeId));
}

export function chargePeriods(): string[] {
  return [...new Set(CHARGE_ROWS.map((c) => c.period))].sort().reverse();
}

export function hkd(amount: number, locale: Locale): string {
  return `HKD ${number(amount, locale)}`;
}

export function periodLabel(period: string, locale: Locale): string {
  return new Intl.DateTimeFormat(bcp47(locale), {
    year: 'numeric',
    month: 'short',
    timeZone: 'Asia/Hong_Kong',
  }).format(new Date(`${period}-01T00:00:00+08:00`));
}

export function estateLabel(scope: ScopePath): LocalizedText {
  const estate = [...scope.ancestry, scope.node].find((n) => n.kind === 'estate');
  return estate?.label ?? m('Wing Fu Garden', '榮富花園', '荣富花园');
}

export function unitPathLabel(scope: ScopePath, fallback: LocalizedText): LocalizedText {
  const kinds = new Set(['building', 'floor', 'unit']);
  const parts = [...scope.ancestry, scope.node].filter((n) => kinds.has(n.kind) && n.label);
  if (parts.length === 0) return fallback;
  return {
    en: parts.map((n) => n.label!.en).join(' · '),
    'zh-Hant': parts.map((n) => n.label!['zh-Hant']).join(' · '),
  };
}

export function isScheduledSendDue(scheduledSendAt: string, nowIso: string): boolean {
  return new Date(scheduledSendAt).getTime() <= new Date(nowIso).getTime();
}

export function invoiceSendBadge(
  scheduledSendAt: string,
  invoiceSentAt: string | null,
  nowIso: string = FINANCE_FIXTURE_NOW,
): InvoiceSendBadge {
  if (invoiceSentAt) return 'sent';
  return isScheduledSendDue(scheduledSendAt, nowIso) ? 'due' : 'scheduled';
}

export const HOUSEHOLD_CONTACT_EMAIL: Readonly<Record<string, string>> = Object.fromEntries(
  HOUSEHOLDS_LIST.households
    .filter((h) => h.contactEmail)
    .map((h) => [h.householdId, h.contactEmail as string]),
);
