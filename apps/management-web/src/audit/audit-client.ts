/**
 * Audit log, S04: everything the screen needs to read and export the log, behind one interface.
 *
 *   fixture: the contract-shaped sample (audit-fixture.json) plus whatever staff did in this session,
 *            filtered and paged by the same rules the server states.
 *   live:    GET /admin/audit-log and ?format=csv over fetch with Bearer.
 *   auto:    live when the route answers (a 403 counts: the route is there), the fixture otherwise.
 */

import { allAuditEvents } from '../data/audit-session.ts';
import { apiGet, routeAnswers, sourced, type ProbeOptions, type SourceKind, type SourceMode } from '../data/sourced.ts';
import { AUDIT_FIXTURE } from './audit-fixture.ts';
import {
  DEFAULT_PAGE, csvFilename, matches, pageOf, toCsv, toSearchParams,
  type AuditLogResponse, type AuditQuery,
} from './audit-log.ts';

export interface AuditCsv {
  filename: string;
  text: string;
  /** More than 10,000 events matched; the file holds the newest 10,000. */
  truncated: boolean;
}

export interface AuditLogClient {
  list(query: AuditQuery): Promise<AuditLogResponse>;
  exportCsv(query: AuditQuery): Promise<AuditCsv>;
}

export interface AuditLogRead {
  source: SourceKind;
  response: AuditLogResponse;
}

export function createFixtureAuditClient(): AuditLogClient {
  return {
    async list(query) {
      const limit = query.limit ?? DEFAULT_PAGE;
      const { events, hasMore, nextCursor } = pageOf(allAuditEvents().filter((e) => matches(e, query)), limit, query.cursor);
      return { meta: { ...AUDIT_FIXTURE.meta }, events, page: { limit, hasMore, nextCursor } };
    },
    async exportCsv(query) {
      return { filename: csvFilename(), ...toCsv(allAuditEvents().filter((e) => matches(e, query))) };
    },
  };
}

export interface LiveAuditOptions extends ProbeOptions {
  token?: string;
}

export function createLiveAuditClient(opts: LiveAuditOptions = {}): AuditLogClient {
  const o = { ...(opts.base !== undefined ? { base: opts.base } : {}), ...(opts.token ? { token: opts.token } : {}), ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}) };
  return {
    async list(query) {
      const res = await apiGet(`/admin/audit-log?${toSearchParams(query)}`, o);
      return (await res.json()) as AuditLogResponse;
    },
    async exportCsv(query) {
      const res = await apiGet(`/admin/audit-log?${toSearchParams(query, 'csv')}`, { ...o, accept: 'text/csv' });
      // Response.text() drops the byte-order mark; the file keeps it so Excel reads UTF-8.
      const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await res.arrayBuffer());
      const cd = res.headers.get('Content-Disposition') ?? '';
      const named = /filename="([^"]+)"/.exec(cd)?.[1];
      return { filename: named ?? csvFilename(), text, truncated: res.headers.get('X-Audit-Export-Truncated') === 'true' };
    },
  };
}

export interface AuditLogSource {
  read(query: AuditQuery): Promise<AuditLogRead>;
  exportCsv(query: AuditQuery): Promise<AuditCsv>;
}

export function createAuditSource(cfg: { mode: SourceMode; base?: string; token?: string; fetchImpl?: typeof fetch; enabled?: boolean }): AuditLogSource {
  const probe: ProbeOptions = { ...(cfg.base !== undefined ? { base: cfg.base } : {}), ...(cfg.fetchImpl ? { fetchImpl: cfg.fetchImpl } : {}) };
  const s = sourced<AuditLogClient>({
    mode: cfg.mode,
    fixture: createFixtureAuditClient(),
    live: createLiveAuditClient({ ...probe, token: cfg.mode === 'live' ? cfg.token ?? '' : 'demo' }),
    probe: () => routeAnswers('/admin/audit-log?limit=1', probe, (st) => st === 200 || st === 401 || st === 403),
    ...(cfg.enabled !== undefined ? { enabled: cfg.enabled } : {}),
  });
  return {
    async read(query) {
      const { kind, client } = await s.use();
      return { source: kind, response: await client.list(query) };
    },
    async exportCsv(query) {
      const { client } = await s.use();
      return client.exportCsv(query);
    },
  };
}

/* ------------------------------------------------------------- selection */

let shared: AuditLogSource = createAuditSource({ mode: 'auto' });
let sharedKey = 'auto|';

export function auditSource(): AuditLogSource { return shared; }

/** Tests swap the source; production goes through selectAuditSource. */
export function setAuditSource(s: AuditLogSource | null): void {
  shared = s ?? createAuditSource({ mode: 'auto' });
  sharedKey = 'custom';
}

/** Same modes as the front-counter and lookups clients, so one `?source=` decides all of them. */
export function selectAuditSource(cfg: { mode: SourceMode; base: string; token: string }): AuditLogSource {
  const key = `${cfg.mode}|${cfg.base}|${cfg.mode === 'live' ? cfg.token : ''}`;
  if (key === sharedKey) return shared;
  sharedKey = key;
  shared = createAuditSource(cfg);
  return shared;
}
