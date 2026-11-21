/**
 * Portal invoices — LIVE :3200 first (READ-ONLY). The local fixture corpus
 * (a mirror of the Backend seed) is used ONLY when the API is unreachable.
 * Freeze: docs/contracts/resident-portal-v0-invoices-demo.md
 */
import {
  INVOICE_STATUSES,
  isInvoiceStatus,
  type InvoiceDetail,
  type InvoiceListItem,
  type InvoiceStatus,
  type InvoiceSummary,
} from './invoices-types.ts';
import {
  getDemoInvoice,
  getDemoInvoiceSummary,
  InvoiceApiError,
  listDemoInvoices,
} from './invoices-demo-client.ts';
import { INVOICE_FIXTURES } from './invoices-fixture.ts';

export type Source = 'api' | 'local';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

/** Minimal shape guard — the freeze is trusted, but a malformed row is skipped, not rendered. */
function isListItem(v: unknown): v is InvoiceListItem {
  return (
    isRec(v) &&
    typeof v.invoiceId === 'string' &&
    typeof v.invoiceNumber === 'string' &&
    isInvoiceStatus(v.status) &&
    typeof v.amountHkd === 'number' &&
    typeof v.balanceHkd === 'number'
  );
}

function asDetail(v: unknown): InvoiceDetail | null {
  if (!isListItem(v)) return null;
  const o = v as unknown as Rec;
  return {
    ...(v as InvoiceListItem),
    lineItems: Array.isArray(o.lineItems) ? (o.lineItems as InvoiceDetail['lineItems']) : [],
    paymentsApplied: Array.isArray(o.paymentsApplied) ? (o.paymentsApplied as InvoiceDetail['paymentsApplied']) : [],
    pdfUrl: typeof o.pdfUrl === 'string' && o.pdfUrl ? o.pdfUrl : null,
  };
}

function asSummary(v: unknown): InvoiceSummary | null {
  if (!isRec(v) || !isRec(v.summary) || !isRec(v.summary.counts)) return null;
  const s = v.summary;
  const c = s.counts as Rec;
  const counts = {} as Record<InvoiceStatus, number>;
  for (const k of INVOICE_STATUSES) counts[k] = typeof c[k] === 'number' ? (c[k] as number) : 0;
  return {
    householdId: typeof s.householdId === 'string' ? s.householdId : null,
    currency: 'HKD',
    asOf: typeof s.asOf === 'string' ? s.asOf : '',
    counts,
    totalCount: typeof s.totalCount === 'number' ? s.totalCount : 0,
    outstandingBalanceHkd: typeof s.outstandingBalanceHkd === 'number' ? s.outstandingBalanceHkd : 0,
    overdueBalanceHkd: typeof s.overdueBalanceHkd === 'number' ? s.overdueBalanceHkd : 0,
  };
}

/** Same derivation the Backend store uses — only for the fixture fallback. */
export function summarise(rows: readonly InvoiceListItem[], householdId: string | null, asOf: string): InvoiceSummary {
  const counts: Record<InvoiceStatus, number> = { UNPAID: 0, PARTIAL: 0, PAID: 0, OVERDUE: 0 };
  let outstanding = 0;
  let overdue = 0;
  for (const r of rows) {
    counts[r.status] += 1;
    if (r.status !== 'PAID') outstanding += r.balanceHkd;
    if (r.status === 'OVERDUE') overdue += r.balanceHkd;
  }
  return {
    householdId, currency: 'HKD', asOf, counts, totalCount: rows.length,
    outstandingBalanceHkd: outstanding, overdueBalanceHkd: overdue,
  };
}

/** Newest issue date first; stable, so equal dates keep the server's order. */
function latestFirst<T extends InvoiceListItem>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.issueDate === b.issueDate ? 0 : a.issueDate < b.issueDate ? 1 : -1));
}

function localList() {
  const invoices = latestFirst(INVOICE_FIXTURES);
  return {
    invoices: invoices as InvoiceListItem[],
    summary: summarise(invoices, invoices[0]?.householdId ?? null, '2026-09-25'),
    source: 'local' as Source,
  };
}

export async function listMyInvoices(): Promise<{ invoices: InvoiceListItem[]; summary: InvoiceSummary; source: Source }> {
  let invoices: InvoiceListItem[];
  try {
    const raw = await listDemoInvoices();
    if (!isRec(raw) || !Array.isArray(raw.invoices)) return localList();
    // Server already returns newest first; keep its order.
    invoices = raw.invoices.filter(isListItem);
  } catch {
    return localList();
  }
  let summary: InvoiceSummary | null = null;
  try {
    summary = asSummary(await getDemoInvoiceSummary());
  } catch {
    /* summary is a separate call; fall back to counting the list we have */
  }
  return {
    invoices,
    summary: summary ?? summarise(invoices, invoices[0]?.householdId ?? null, ''),
    source: 'api',
  };
}

export async function getMyInvoice(invoiceId: string): Promise<{ invoice: InvoiceDetail | null; source: Source }> {
  try {
    const raw = await getDemoInvoice(invoiceId);
    return { invoice: isRec(raw) ? asDetail(raw.invoice) : null, source: 'api' };
  } catch (e) {
    // A real API 404 (unknown / other household) is an answer, not an outage.
    if (e instanceof InvoiceApiError && e.status === 404 && e.isJson) return { invoice: null, source: 'api' };
  }
  return { invoice: INVOICE_FIXTURES.find((x) => x.invoiceId === invoiceId) ?? null, source: 'local' };
}
