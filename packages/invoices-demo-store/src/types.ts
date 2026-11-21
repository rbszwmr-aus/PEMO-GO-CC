/**
 * Demo resident-portal invoice types (read-only).
 * Freeze: docs/contracts/resident-portal-v0-invoices-demo.md
 *
 * Amounts are INTEGER HKD, matching the management-web strata freeze
 * (`amountHkd`, `paidHkd`). Ids reuse the strata style: invoiceId = strata
 * chargeId (`chg_wfg_…`), paymentId = strata payment id (`pay_wfg_…`).
 */

export type InvoiceStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';

export const INVOICE_STATUSES = [
  'UNPAID',
  'PARTIAL',
  'PAID',
  'OVERDUE',
] as const satisfies readonly InvoiceStatus[];

export const isInvoiceStatus = (value: string): value is InvoiceStatus =>
  (INVOICE_STATUSES as readonly string[]).includes(value);

export type InvoiceChargeType =
  | 'management_fee'
  | 'carpark_licence'
  | 'special_levy'
  | 'sinking_fund';

export type InvoicePaymentMethod = 'fps' | 'cheque' | 'cash' | 'octopus';

export interface LocalizedText {
  readonly en: string;
  readonly 'zh-Hant': string;
}

export interface InvoiceLineItem {
  readonly description: LocalizedText;
  readonly chargeType: InvoiceChargeType;
  readonly quantity: number;
  readonly unitAmountHkd: number;
  /** quantity × unitAmountHkd, integer HKD. */
  readonly amountHkd: number;
}

export interface InvoicePaymentApplied {
  readonly paymentId: string;
  /** RFC 3339 with +08:00. */
  readonly paidAt: string;
  readonly method: InvoicePaymentMethod;
  /** Portion of the payment applied to THIS invoice, integer HKD. */
  readonly amountHkd: number;
  readonly reference: string;
}

/** List item (also the head of the detail object). */
export interface InvoiceSummaryRow {
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly householdId: string;
  readonly unitId: string;
  readonly unitLabel: LocalizedText;
  /** `YYYY-MM`. */
  readonly period: string;
  readonly periodLabel: LocalizedText;
  readonly title: LocalizedText;
  /** `YYYY-MM-DD`. */
  readonly issueDate: string;
  /** `YYYY-MM-DD`. */
  readonly dueDate: string;
  readonly status: InvoiceStatus;
  readonly currency: 'HKD';
  readonly amountHkd: number;
  readonly paidHkd: number;
  readonly balanceHkd: number;
}

export interface InvoiceDetail extends InvoiceSummaryRow {
  readonly lineItems: readonly InvoiceLineItem[];
  readonly paymentsApplied: readonly InvoicePaymentApplied[];
  /** Always null in this demo — no PDF renderer exists in the repo. */
  readonly pdfUrl: string | null;
}

export type InvoiceStatusCounts = Readonly<Record<InvoiceStatus, number>>;

export interface InvoiceSummary {
  readonly householdId: string | null;
  readonly currency: 'HKD';
  /** Business date the statuses are evaluated against (`YYYY-MM-DD`, HK). */
  readonly asOf: string;
  readonly counts: InvoiceStatusCounts;
  readonly totalCount: number;
  /** Sum of balanceHkd over UNPAID + PARTIAL + OVERDUE. */
  readonly outstandingBalanceHkd: number;
  /** Sum of balanceHkd over OVERDUE only. */
  readonly overdueBalanceHkd: number;
}

/** Stable fixture resident (same as tickets / notices / visitors demo). */
export const FIXTURE_RESIDENT_ID = 'res_demo_ho_mei_yi';
/** Strata household id for Ho Mei-yi (database/seeds/80-strata-wing-fu-charges.sql). */
export const FIXTURE_HOUSEHOLD_ID = 'hh_wfg_a_12_a1';
/** Strata unit id for Block A 12/F Flat A1. */
export const FIXTURE_UNIT_ID = 'unit_wfg_a_12_a1';
/** Demo "today" the seed statuses are authored against. */
export const DEMO_AS_OF = '2026-09-25';
