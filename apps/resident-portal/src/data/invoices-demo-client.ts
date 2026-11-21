/**
 * Thin fetch wrappers for resident-portal invoices (READ-ONLY, live :3200 via the
 * Vite always-proxy `/api/resident-portal/v0/invoices`).
 * Freeze: docs/contracts/resident-portal-v0-invoices-demo.md
 *   GET /api/resident-portal/v0/invoices[?status=UNPAID|PARTIAL|PAID|OVERDUE] → { meta, invoices }
 *   GET /api/resident-portal/v0/invoices/summary                            → { meta, summary }
 *   GET /api/resident-portal/v0/invoices/{invoiceId}                        → { meta, invoice } | 404
 * There is deliberately NO pay/write call here — "Pay online" is coming soon.
 */
export const DEMO_RESIDENT_HEADER = 'X-PEMO-Demo-Resident';
export const FIXTURE_RESIDENT_ID = 'res_demo_ho_mei_yi';

export const INVOICES_BASE = '/api/resident-portal/v0/invoices';

/** Thrown for any non-2xx answer; `status` lets callers tell 404 from "unreachable". */
export class InvoiceApiError extends Error {
  constructor(message: string, readonly status: number, readonly isJson: boolean) {
    super(message);
  }
}

function headers(residentId = FIXTURE_RESIDENT_ID): HeadersInit {
  return {
    Accept: 'application/json',
    Authorization: 'Bearer demo',
    [DEMO_RESIDENT_HEADER]: residentId,
  };
}

async function getJson(path: string, what: string, residentId: string): Promise<unknown> {
  const res = await fetch(path, { method: 'GET', headers: headers(residentId) });
  const isJson = (res.headers.get('content-type') ?? '').includes('json');
  if (!res.ok) throw new InvoiceApiError(`${what} ${res.status}`, res.status, isJson);
  // A Vite SPA fallback (HTML) is not an API answer.
  if (!isJson) throw new InvoiceApiError(`${what} not json`, res.status, false);
  return res.json();
}

export function listDemoInvoices(residentId = FIXTURE_RESIDENT_ID): Promise<unknown> {
  return getJson(INVOICES_BASE, 'invoices list', residentId);
}

export function getDemoInvoiceSummary(residentId = FIXTURE_RESIDENT_ID): Promise<unknown> {
  return getJson(`${INVOICES_BASE}/summary`, 'invoices summary', residentId);
}

export function getDemoInvoice(invoiceId: string, residentId = FIXTURE_RESIDENT_ID): Promise<unknown> {
  return getJson(`${INVOICES_BASE}/${encodeURIComponent(invoiceId)}`, 'invoice detail', residentId);
}
