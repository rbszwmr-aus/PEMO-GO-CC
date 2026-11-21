/**
 * In-memory Audit log session, fixture side.
 *
 * Staff fee / notice / membership actions append events for this page load only, in the
 * contract’s shape (audit/audit-log.ts), so the screen reads session rows and seed rows the same way.
 * No localStorage / sessionStorage / cookies — the credential-storage guard forbids those APIs.
 * Live, the server writes the row in the same transaction as the act; this store is the stand-in.
 *
 * Actor is always the fixture signed-in staff (Alex Chen).
 */

import { AUDIT_FIXTURE_EVENTS } from '../audit/audit-fixture.ts';
import { newestFirst, type AuditEvent } from '../audit/audit-log.ts';

/** Demo Account chrome — absent `session` means signed in as this staff row. */
export const FIXTURE_SIGNED_IN_STAFF = {
  principalId: 'stf_wfg_alex',
  displayName: 'Alex Chen',
} as const;

const SESSION_EVENT_PREFIX = 'aud_sess_';

export interface AuditAppendInput {
  action: string;
  entity: { type: string; id: string };
  place: { nodeKind: string; nodeId: string };
  reasonCode?: string;
  occurredAt?: string;
}

/** The signed-in fixture staff’s authority is whatever the fixture records for them. */
function signedInAuthority(): AuditEvent['authority'] {
  const mine = AUDIT_FIXTURE_EVENTS.find((e) => e.actor?.principalId === FIXTURE_SIGNED_IN_STAFF.principalId);
  return mine?.authority ? { ...mine.authority } : null;
}

let seq = 0;
let events: AuditEvent[] = [];
let revision = 0;
const listeners = new Set<() => void>();

function emit(): void {
  revision += 1;
  for (const l of listeners) l();
}

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

/** Estate-clock ISO (+08:00). */
export function auditOccurredNow(at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+08:00`;
}

export function isSessionAuditEvent(eventId: string): boolean {
  return eventId.startsWith(SESSION_EVENT_PREFIX);
}

export function auditSessionRevision(): number {
  return revision;
}

export function subscribeAuditSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetAuditSession(): void {
  seq = 0;
  events = [];
  emit();
}

export function sessionAuditEvents(): AuditEvent[] {
  return events.map((row) => structuredClone(row));
}

export function appendAuditEvent(input: AuditAppendInput): AuditEvent {
  seq += 1;
  const at = input.occurredAt ?? auditOccurredNow();
  const row: AuditEvent = {
    eventId: `${SESSION_EVENT_PREFIX}${pad4(seq)}`,
    occurredAt: at,
    recordedAt: at,
    source: 'principal',
    actor: { principalId: FIXTURE_SIGNED_IN_STAFF.principalId, displayName: FIXTURE_SIGNED_IN_STAFF.displayName },
    authority: signedInAuthority(),
    action: input.action,
    entity: { ...input.entity },
    place: { ...input.place },
    reasonCode: input.reasonCode ?? null,
    requestId: `req-sess-${pad4(seq)}`,
    clientIp: null,
    userAgent: null,
  };
  events = [...events, row];
  emit();
  return structuredClone(row);
}

/** Seed rows plus session-appended events, newest first, as the route would return them unfiltered. */
export function allAuditEvents(): AuditEvent[] {
  return [...events, ...AUDIT_FIXTURE_EVENTS].map((row) => structuredClone(row)).sort(newestFirst);
}
