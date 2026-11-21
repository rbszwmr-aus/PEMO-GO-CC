/**
 * Audit log, S04: the shapes and the pure rules.
 *
 * Mirrors docs/contracts/audit-log-v0-PROPOSED_v0.1.md (GET /admin/audit-log). PROPOSED, not frozen:
 * every name below is the contract’s, so the freeze changes this file and nothing else.
 *
 * What the screen may show: names, not ids. `eventId`, `requestId`, `clientIp`, `userAgent`,
 * `entity.id`, `actor.principalId` and `authority.groupId` belong in the collapsed IT details.
 */

import type { Meta } from '../data/types.ts';

export const AUDIT_SOURCES = ['principal', 'provisioning', 'integration'] as const;
export type AuditSource = (typeof AUDIT_SOURCES)[number];

/** The action vocabulary of v0.1 (section 7). The code’s list, not a database constraint. */
export const AUDIT_ACTIONS = [
  'confer_grant',
  'revoke_grant',
  'provision_organization',
  'register_principal',
  'add_membership',
  'remove_membership',
  'publish_management_update',
  'record_occupancy',
  'end_occupancy',
  'add_estate_contact',
  'compose_notice',
  'revise_notice',
  'correct_notice',
  'submit_notice',
  'approve_notice',
  'decline_notice',
  'publish_notice',
  'withdraw_notice',
  'send_invoice_email',
  'send_admin_test_email',
  'send_notice_email',
  // The demo API also records the writes of the other screens in a dotted vocabulary (S04 section 7 has not absorbed it yet).
  'document.upload', 'document.add_version', 'document.update_metadata', 'document.check_out', 'document.check_in', 'document.download', 'document.write',
  'lookup.create', 'lookup.update', 'lookup.reorder', 'lookup.deactivate', 'lookup.delete',
  'ticket.create', 'ticket.assign', 'ticket.set_status',
  'visitor.create', 'visitor.redeem_pass', 'visitor.check_out',
  'notification.mark_read', 'notification.mark_all_read',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** `entity.type` is the target’s kind. The contract does not enumerate it; these are the ones the vocabulary implies. */
export const AUDIT_ENTITY_TYPES = [
  'grant',
  'principal',
  'group',
  'membership',
  'safety_event',
  'occupancy',
  'estate_contact',
  'notice',
  'invoice',
  'email',
  'organization',
  'document',
  'lookup_item',
  'lookup_list',
  'ticket',
  'visitor',
  'pass',
  'notification',
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export interface AuditEvent {
  eventId: string;
  occurredAt: string;
  recordedAt: string;
  source: AuditSource;
  actor: { principalId: string; displayName: string } | null;
  authority: { groupId: string; role: string } | null;
  action: string;
  entity: { type: string; id: string };
  place: { nodeKind: string; nodeId: string };
  reasonCode: string | null;
  requestId: string;
  clientIp: string | null;
  userAgent: string | null;
}

export interface AuditLogResponse {
  meta: Meta;
  events: AuditEvent[];
  page: { limit: number; hasMore: boolean; nextCursor: string | null };
}

/** The query the screen builds. Dates are `YYYY-MM-DD`, read as Hong Kong midnight; `to` is the last day SHOWN. */
export interface AuditQuery {
  actor?: string;
  action?: string;
  entityType?: string;
  nodeKind?: string;
  nodeId?: string;
  /** First day shown, inclusive. */
  fromDay?: string;
  /** Last day shown, inclusive. The wire `to` is the day after (it is exclusive). */
  toDay?: string;
  limit?: number;
  cursor?: string;
}

export const DEFAULT_PAGE = 50;
export const CSV_ROW_CAP = 10_000;

/** The day after a `YYYY-MM-DD`, because the contract’s `to` is exclusive. */
export function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00+08:00`);
  d.setUTCDate(d.getUTCDate() + 1);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** The contract’s query string for a screen query. `from` and `to` are dates read as Hong Kong midnight. */
export function toSearchParams(q: AuditQuery, format?: 'csv'): URLSearchParams {
  const p = new URLSearchParams();
  if (q.actor) p.set('actor', q.actor);
  if (q.action) p.set('action', q.action);
  if (q.entityType) p.set('entity_type', q.entityType);
  if (q.nodeKind && q.nodeId) { p.set('node_kind', q.nodeKind); p.set('node_id', q.nodeId); }
  if (q.fromDay) p.set('from', q.fromDay);
  if (q.toDay) p.set('to', nextDay(q.toDay));
  if (format === 'csv') p.set('format', 'csv');
  else {
    p.set('limit', String(q.limit ?? DEFAULT_PAGE));
    if (q.cursor) p.set('cursor', q.cursor);
  }
  return p;
}

const hkMidnight = (day: string): number => Date.parse(`${day}T00:00:00+08:00`);

/** Does an event pass the query? The same rule the server applies; the fixture client uses it. */
export function matches(e: AuditEvent, q: AuditQuery): boolean {
  if (q.actor && e.actor?.principalId !== q.actor) return false;
  if (q.action && e.action !== q.action) return false;
  if (q.entityType && e.entity.type !== q.entityType) return false;
  if (q.nodeKind && q.nodeId && !(e.place.nodeKind === q.nodeKind && e.place.nodeId === q.nodeId)) return false;
  const at = Date.parse(e.occurredAt);
  if (q.fromDay && at < hkMidnight(q.fromDay)) return false;
  if (q.toDay && at >= hkMidnight(nextDay(q.toDay))) return false;
  return true;
}

/** Newest first by (occurredAt, eventId) descending. */
export function newestFirst(a: AuditEvent, b: AuditEvent): number {
  const d = Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
  if (d !== 0) return d;
  return a.eventId < b.eventId ? 1 : a.eventId > b.eventId ? -1 : 0;
}

/** Keyset paging over an already-sorted list: the cursor is the last event’s position key. */
export function pageOf(sorted: readonly AuditEvent[], limit: number, cursor: string | undefined): { events: AuditEvent[]; hasMore: boolean; nextCursor: string | null } {
  let start = 0;
  if (cursor) {
    const key = decodeCursor(cursor);
    start = key === null ? 0 : sorted.findIndex((e) => `${e.occurredAt}|${e.eventId}` === key) + 1;
  }
  const events = sorted.slice(start, start + limit);
  const hasMore = start + limit < sorted.length;
  const last = events[events.length - 1];
  return { events, hasMore, nextCursor: hasMore && last ? encodeCursor(`${last.occurredAt}|${last.eventId}`) : null };
}

const encodeCursor = (s: string): string => btoa(unescape(encodeURIComponent(s)));
function decodeCursor(c: string): string | null {
  try { return decodeURIComponent(escape(atob(c))); } catch { return null; }
}

/* ------------------------------------------------------------------ CSV (section 3.2) */

export const CSV_COLUMNS = [
  'occurred_at', 'recorded_at', 'actor_id', 'actor_name', 'action', 'entity_type', 'entity_id', 'place_kind', 'place_id',
  'source', 'role', 'group_id', 'reason_code', 'request_id', 'client_ip', 'user_agent', 'event_id',
] as const;

/** A caller-controlled cell that would be read as a formula gets a leading apostrophe. */
export function neutralise(cell: string): string {
  return /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
}

/** RFC 4180: quote a cell with a comma, quote, CR or LF, and double its quotes. */
export function csvCell(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = neutralise(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The export body: UTF-8 BOM, header row, one CRLF-ended record per event, newest first, capped at 10,000. */
export function toCsv(events: readonly AuditEvent[]): { text: string; truncated: boolean } {
  const rows = events.slice(0, CSV_ROW_CAP);
  const lines = [CSV_COLUMNS.join(',')];
  for (const e of rows) {
    lines.push([
      e.occurredAt, e.recordedAt, e.actor?.principalId, e.actor?.displayName, e.action, e.entity.type, e.entity.id,
      e.place.nodeKind, e.place.nodeId, e.source, e.authority?.role, e.authority?.groupId, e.reasonCode,
      e.requestId, e.clientIp, e.userAgent, e.eventId,
    ].map(csvCell).join(','));
  }
  return { text: `\uFEFF${lines.join('\r\n')}\r\n`, truncated: events.length > CSV_ROW_CAP };
}

/** `audit-log-YYYYMMDD.csv`, Hong Kong date. */
export function csvFilename(at: Date = new Date()): string {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  return `audit-log-${ymd.replace(/-/g, '')}.csv`;
}
