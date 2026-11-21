/**
 * Resident-portal invoice shapes — 1:1 with the Backend freeze
 * docs/contracts/resident-portal-v0-invoices-demo.md (DEMO FROZEN v0).
 * Integer HKD (`…Hkd`), UPPERCASE status, bilingual copy as LocalizedText.
 */
import type { LocalizedText } from '../i18n/locale.ts';

export type InvoiceStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';

/** Card order on the List tab (PT: Unpaid / Overdue / Partial / Paid). */
export const INVOICE_STATUSES = ['UNPAID', 'OVERDUE', 'PARTIAL', 'PAID'] as const satisfies readonly InvoiceStatus[];

export function isInvoiceStatus(v: unknown): v is InvoiceStatus {
  return typeof v === 'string' && (INVOICE_STATUSES as readonly string[]).includes(v);
}

/** URL filter value (`?filter=overdue`) — lowercase form of InvoiceStatus. */
export type InvoiceFilter = 'unpaid' | 'overdue' | 'partial' | 'paid';

export function isInvoiceFilter(v: unknown): v is InvoiceFilter {
  return v === 'unpaid' || v === 'overdue' || v === 'partial' || v === 'paid';
}
export const filterToStatus = (f: InvoiceFilter): InvoiceStatus => f.toUpperCase() as InvoiceStatus;
export const statusToFilter = (s: InvoiceStatus): InvoiceFilter => s.toLowerCase() as InvoiceFilter;

export type InvoiceChargeType = 'management_fee' | 'carpark_licence' | 'special_levy' | 'sinking_fund';
export type InvoicePaymentMethod = 'fps' | 'cheque' | 'cash' | 'octopus';

export interface InvoiceListItem {
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

export interface InvoiceLineItem {
  readonly description: LocalizedText;
  readonly chargeType: InvoiceChargeType | string;
  readonly quantity: number;
  readonly unitAmountHkd: number;
  readonly amountHkd: number;
}

export interface InvoicePaymentApplied {
  readonly paymentId: string;
  /** RFC 3339 with +08:00. */
  readonly paidAt: string;
  readonly method: InvoicePaymentMethod | string;
  readonly amountHkd: number;
  readonly reference: string;
}

export interface InvoiceDetail extends InvoiceListItem {
  readonly lineItems: readonly InvoiceLineItem[];
  readonly paymentsApplied: readonly InvoicePaymentApplied[];
  /** Null in the demo — the PDF link is hidden when null. */
  readonly pdfUrl: string | null;
}

export type InvoiceStatusCounts = Readonly<Record<InvoiceStatus, number>>;

export interface InvoiceSummary {
  readonly householdId: string | null;
  readonly currency: 'HKD';
  readonly asOf: string;
  readonly counts: InvoiceStatusCounts;
  readonly totalCount: number;
  readonly outstandingBalanceHkd: number;
  readonly overdueBalanceHkd: number;
}
