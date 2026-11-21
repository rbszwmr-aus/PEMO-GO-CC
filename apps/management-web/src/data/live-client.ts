/**
 * Live client for the management reads served from Postgres.
 *
 * Added ALONGSIDE the corpus path, which is untouched: the fixture matrix is
 * the contract-conformance evidence and it keeps running exactly as it did.
 * This class is the swap seam — the same idea as resident-mobile's
 * LiveSafetyRepository. Fixture is the default; this exists and can be
 * switched on.
 *
 * Reads wired here:
 *   GET /api/management-web/v0/scope
 *   GET /api/management-web/v0/properties/tree
 *   GET /api/management-web/v0/notices                        (UI-051)
 *   GET /api/management-web/v0/notices/{id}                   (UI-051)
 *   GET /api/management-web/v0/notices/{id}/acknowledgements  (UI-051)
 *   GET /api/management-web/v0/helpdesk/queue                 (Help desk — Backend 200 @ 96caed2)
 *   GET /api/management-web/v0/helpdesk/contacts/{contactId}  (Help desk — Backend 200 @ 96caed2)
 *   GET /api/management-web/v0/strata/charges (+ detail)
 *   GET /api/management-web/v0/strata/payments
 *   GET /api/management-web/v0/notices/{id}/delivery
 *   POST /api/management-web/v0/strata/charges/{id}/invoice-email
 *   POST /api/management-web/v0/admin/email/test
 *   POST /api/management-web/v0/notices/{id}/email
 * The acts live in notice-client.ts. Residents / visitors / households are NOT
 * wired. test/live/live-client.test.ts enumerates the wired set and refuses
 * paths beyond it. (A COUNT went stale twice — UI-045 F2 — so the list is
 * enumerated, not counted.) Staff credential. A missing or resident token is
 * a problem state the server already defines, not a 200-looking empty tree or
 * empty help-desk queue.
 */

import { UNREADABLE_PROBLEM } from './unreadable-problem.ts';
import type {
  NoticeOutstandingResponse, Problem, PropertyTreeResponse, ScopeTreeResponse,
  StaffNoticeDetailResponse, StaffNoticeListResponse,
} from './types.ts';
import {
  LIVE_HELPDESK_CONTACTS_PATH,
  LIVE_HELPDESK_QUEUE_PATH,
  normalizeHelpdeskContact,
  normalizeHelpdeskQueue,
  type HelpdeskQueueView,
} from './helpdesk-live.ts';
import type { HelpdeskContactDetail } from './helpdesk-fixtures.ts';
import {
  LIVE_ADMIN_EMAIL_TEST_PATH,
  LIVE_CHARGES_PATH,
  LIVE_PAYMENTS_PATH,
  chargePath,
  invoiceEmailPath,
  noticeDeliveryPath,
  noticeEmailPath,
  toLiveCharge,
  type ChargeDetailResponse,
  type ChargeListResponse,
  type LiveChargeRow,
  type MailSendResponse,
  type NoticeEmailDeliveryResponse,
  type NoticeEmailSendResponse,
  type PaymentListResponse,
} from './strata-live.ts';
import { maySendCredentials } from './live-config.ts';

export const LIVE_SCOPE_PATH = '/api/management-web/v0/scope';
export const LIVE_TREE_PATH = '/api/management-web/v0/properties/tree';
export const LIVE_NOTICES_PATH = '/api/management-web/v0/notices';
export { LIVE_HELPDESK_QUEUE_PATH, LIVE_HELPDESK_CONTACTS_PATH };
export { LIVE_CHARGES_PATH, LIVE_PAYMENTS_PATH, LIVE_ADMIN_EMAIL_TEST_PATH };

export type LiveResult<T> =
  | { readonly kind: 'loaded'; readonly data: T }
  | { readonly kind: 'problem'; readonly problem: Problem }
  | { readonly kind: 'offline' };

export interface LiveClientConfig {
  readonly baseUrl: string;
  readonly token: string;
  readonly fetch?: typeof fetch;
  /** When set, a bearer is sent only if baseUrl is the configured/same-origin API. */
  readonly pageOrigin?: string;
}

const UNREADABLE = UNREADABLE_PROBLEM;

const isProblem = (body: unknown): body is Problem => {
  if (body === null || typeof body !== 'object') return false;
  const o = body as Record<string, unknown>;
  return typeof o['type'] === 'string' && typeof o['title'] === 'string' && typeof o['status'] === 'number';
};

export class LiveManagementClient {
  private readonly config: LiveClientConfig;
  constructor(config: LiveClientConfig) {
    this.config = config;
  }

  private mayAttachAuthorization(): boolean {
    const origin = this.config.pageOrigin;
    if (origin === undefined || origin === '') return true;
    return maySendCredentials(this.config.baseUrl, origin);
  }

  getScope(signal?: AbortSignal): Promise<LiveResult<ScopeTreeResponse>> {
    return this.getPaged<ScopeTreeResponse>(LIVE_SCOPE_PATH, signal, (acc, page) => ({
      ...page,
      nodes: [...(acc?.nodes ?? []), ...page.nodes],
    }));
  }

  getPropertyTree(signal?: AbortSignal): Promise<LiveResult<PropertyTreeResponse>> {
    return this.getPaged<PropertyTreeResponse>(LIVE_TREE_PATH, signal, (acc, page) => ({
      ...page,
      nodes: [...(acc?.nodes ?? []), ...page.nodes],
    }));
  }

  listNotices(signal?: AbortSignal): Promise<LiveResult<StaffNoticeListResponse>> {
    return this.get<StaffNoticeListResponse>(LIVE_NOTICES_PATH, signal);
  }

  getNotice(noticeId: string): Promise<LiveResult<StaffNoticeDetailResponse>> {
    return this.get<StaffNoticeDetailResponse>(`${LIVE_NOTICES_PATH}/${encodeURIComponent(noticeId)}`);
  }

  getNoticeOutstanding(noticeId: string): Promise<LiveResult<NoticeOutstandingResponse>> {
    return this.get<NoticeOutstandingResponse>(`${LIVE_NOTICES_PATH}/${encodeURIComponent(noticeId)}/acknowledgements`);
  }

  /**
   * listHelpdeskQueue — UI-mapped queue (ticket→chrome enums in Surfaces).
   * Never synthesises an empty queue on transport/problem failure.
   */
  async listHelpdeskQueue(): Promise<LiveResult<HelpdeskQueueView>> {
    const result = await this.get<unknown>(this.helpdeskPath(LIVE_HELPDESK_QUEUE_PATH));
    if (result.kind !== 'loaded') return result;
    return { kind: 'loaded', data: normalizeHelpdeskQueue(result.data) };
  }

  /**
   * getHelpdeskContact — UI-mapped contact detail.
   * Never invents a contact when the server refuses or is offline.
   */
  async getHelpdeskContact(contactId: string): Promise<LiveResult<HelpdeskContactDetail>> {
    const path = `${LIVE_HELPDESK_CONTACTS_PATH}/${encodeURIComponent(contactId)}`;
    const result = await this.get<unknown>(this.helpdeskPath(path));
    if (result.kind !== 'loaded') return result;
    return { kind: 'loaded', data: normalizeHelpdeskContact(result.data) };
  }

  async listCharges(): Promise<LiveResult<readonly LiveChargeRow[]>> {
    const result = await this.get<ChargeListResponse>(LIVE_CHARGES_PATH);
    if (result.kind !== 'loaded') return result;
    return { kind: 'loaded', data: result.data.charges.map(toLiveCharge) };
  }

  async getCharge(chargeId: string): Promise<LiveResult<ChargeDetailResponse & { charge: LiveChargeRow }>> {
    const result = await this.get<ChargeDetailResponse>(chargePath(chargeId));
    if (result.kind !== 'loaded') return result;
    return { kind: 'loaded', data: { ...result.data, charge: toLiveCharge(result.data.charge) } };
  }

  listPayments(): Promise<LiveResult<PaymentListResponse>> {
    return this.get<PaymentListResponse>(LIVE_PAYMENTS_PATH);
  }

  getNoticeDelivery(noticeId: string): Promise<LiveResult<NoticeEmailDeliveryResponse>> {
    return this.get<NoticeEmailDeliveryResponse>(noticeDeliveryPath(noticeId));
  }

  sendInvoiceEmail(chargeId: string): Promise<LiveResult<MailSendResponse>> {
    return this.post<MailSendResponse>(invoiceEmailPath(chargeId), {});
  }

  sendAdminTestEmail(to: string): Promise<LiveResult<MailSendResponse>> {
    return this.post<MailSendResponse>(LIVE_ADMIN_EMAIL_TEST_PATH, { to });
  }

  sendNoticeEmail(noticeId: string): Promise<LiveResult<NoticeEmailSendResponse>> {
    return this.post<NoticeEmailSendResponse>(noticeEmailPath(noticeId), {});
  }

  /** Help desk reads carry ?demo=1 only for the demo bearer (see withDemoHelpdeskQuery). */
  private helpdeskPath(path: string): string {
    return withDemoHelpdeskQuery(path, this.config.token);
  }

  private async get<T>(path: string, signal?: AbortSignal): Promise<LiveResult<T>> {
    return this.request<T>(path, { method: 'GET', ...(signal !== undefined ? { signal } : {}) });
  }

  private async getPaged<T extends { page?: { next: string | null } }>(
    path: string,
    signal: AbortSignal | undefined,
    merge: (acc: T | undefined, page: T) => T,
  ): Promise<LiveResult<T>> {
    let after: string | null = null;
    let acc: T | undefined;
    const qAt = path.indexOf('?');
    const pathBase = qAt === -1 ? path : path.slice(0, qAt);
    const existing = qAt === -1 ? '' : path.slice(qAt + 1);
    for (;;) {
      const params = new URLSearchParams(existing);
      let url = existing ? `${pathBase}?${existing}` : pathBase;
      if (after) {
        params.set('limit', '100');
        params.set('after', after);
        url = `${pathBase}?${params.toString()}`;
      }
      const result = await this.get<T>(url, signal);
      if (result.kind !== 'loaded') return result;
      acc = merge(acc, result.data);
      const next = result.data.page?.next ?? null;
      if (!next || next === after) break;
      after = next;
    }
    return { kind: 'loaded', data: acc as T };
  }

  private async post<T>(path: string, body: unknown): Promise<LiveResult<T>> {
    return this.request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  private async request<T>(
    path: string,
    init: { method: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
  ): Promise<LiveResult<T>> {
    const headers: Record<string, string> = { Accept: 'application/json', ...init.headers };
    // A missing token is still a request. Inventing a tree because the header
    // is empty is the failure this client exists to refuse.
    if (this.config.token && this.mayAttachAuthorization()) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    const url = `${this.config.baseUrl}${path}`;
    const doFetch = this.config.fetch ?? fetch;
    let response: Response;
    try {
      response = await doFetch(url, {
        method: init.method,
        headers,
        ...(init.body !== undefined ? { body: init.body } : {}),
        ...(init.signal !== undefined ? { signal: init.signal } : {}),
      });
    } catch (err) {
      if (init.signal?.aborted || (err instanceof Error && err.name === 'AbortError')) {
        const aborted = new Error('aborted');
        aborted.name = 'AbortError';
        throw aborted;
      }
      return { kind: 'offline' };
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      return { kind: 'problem', problem: UNREADABLE };
    }

    if (response.status >= 400) {
      return { kind: 'problem', problem: isProblem(parsed) ? parsed : UNREADABLE };
    }

    return { kind: 'loaded', data: parsed as T };
  }
}

/**
 * The in-memory tickets demo API (:3200, `Bearer demo`) answers Help desk queue
 * and contact reads only with `?demo=1`. When the live token is exactly `demo`,
 * append demo=1 to the path, merging with any query already present (an
 * existing demo param is replaced, not duplicated). Any other token, including
 * an empty one, gets the path back unchanged.
 */
export const DEMO_LIVE_TOKEN = 'demo';

export function withDemoHelpdeskQuery(path: string, token: string): string {
  if (token !== DEMO_LIVE_TOKEN) return path;
  const hashAt = path.indexOf('#');
  const hash = hashAt === -1 ? '' : path.slice(hashAt);
  const beforeHash = hashAt === -1 ? path : path.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  const pathname = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt);
  const params = new URLSearchParams(queryAt === -1 ? '' : beforeHash.slice(queryAt + 1));
  params.set('demo', '1');
  return `${pathname}?${params.toString()}${hash}`;
}

export function isLiveProblem(value: unknown): value is Problem {
  return isProblem(value);
}
