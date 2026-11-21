/**
 * Notice delivery — fixture store + job.
 *
 * The notice itself is content (lifecycle, targeting, bilingual text). This
 * module is the delivery repo: channels, a schedule, and outbox rows. It
 * mirrors scheduled invoice send (`processDueInvoiceSends`) without touching
 * Strata Charges.
 *
 * `processDueNoticeDeliveries` is the product job (same function the staff
 * “Run due deliveries” control calls). Email uses Administration Email SMTP
 * config and household `contactEmail`. Print writes an A4 poster. Lobby and
 * portal are fixture status stamps. `sendNoticeNow` is the demo bypass.
 */

import { HOUSEHOLDS_LIST, householdContactEmail } from '../data/households-corpus.ts';
import { appendAuditEvent } from '../data/audit-session.ts';
import {
  findWfgNoticeDetail,
  noticeScopeFor,
} from '../data/notices-wfg-corpus.ts';
import type { HouseholdListItem, NoticeTarget, ScopePath, StaffNoticeDetail } from '../data/types.ts';
import { getAdminEmailConfig } from '../data/admin-email-corpus.ts';
import type { OutboxStatus } from '../data/finance-fixtures.ts';
import { deliverInvoiceEmail, formatFromAddress, resolveSmtpSettings } from '../finance/invoice-mail.ts';
import {
  noticePosterFileName,
  noticeToPoster,
  renderNoticePosterPdf,
} from './notice-poster.ts';

/** Fixture clock for notice delivery gates. Same instant as finance invoices. */
export const NOTICES_FIXTURE_NOW = '2026-09-19T12:00:00+08:00';

export const NOTICE_DELIVERY_CHANNELS = ['email', 'print', 'lobby', 'portal'] as const;
export type NoticeDeliveryChannel = (typeof NOTICE_DELIVERY_CHANNELS)[number];

export type NoticeDeliveryStatus = 'draft' | 'scheduled' | 'sent_displaying' | 'expired';

export type LobbyDisplay = 'none' | 'queued' | 'displaying' | 'expired';
export type PortalPublish = 'none' | 'pending' | 'published' | 'expired';

export type DeliveryRowKind = 'email' | 'print' | 'lobby' | 'portal';
export type DeliveryRowStatus = OutboxStatus | 'printed' | 'displaying' | 'queued' | 'published';

export interface LobbyPlaylistSlot {
  playlistId: string;
  windowStart: string;
  windowEnd: string | null;
  scopeKind: 'estate' | 'building';
  scopeId: string;
  display: LobbyDisplay;
}

export interface NoticeDeliveryPlan {
  noticeId: string;
  channels: NoticeDeliveryChannel[];
  scheduledAt: string | null;
  expireAt: string | null;
  deliveredAt: string | null;
  lobby: LobbyPlaylistSlot | null;
  portal: PortalPublish;
}

export interface NoticeDeliveryRow {
  rowId: string;
  noticeId: string;
  channel: DeliveryRowKind;
  recordedAt: string;
  status: DeliveryRowStatus;
  detail: string;
  to?: string;
  subject?: string;
  attachmentName?: string;
  attachmentBytes?: number;
  delivery?: 'outbox' | 'smtp';
}

export type DeliverySkipReason = 'already-sent' | 'not-due' | 'expired' | 'draft' | 'unknown';

export interface ProcessDueNoticeDeliveriesResult {
  nowIso: string;
  sent: NoticeDeliveryRow[];
  skipped: Array<{ noticeId: string; reason: DeliverySkipReason }>;
}

export interface ScheduleNoticeDeliveryInput {
  channels: NoticeDeliveryChannel[];
  scheduledAt: string;
}

const DUE_NOTICE = 'ntc_wfg_fee_q3';
const LATER_NOTICE = 'ntc_wfg_agm_2026';

let revision = 0;
const listeners = new Set<() => void>();
const plans = new Map<string, NoticeDeliveryPlan>();
const outbox: NoticeDeliveryRow[] = [];

function emit(): void {
  revision += 1;
  for (const l of listeners) l();
}

export function isDeliveryDue(scheduledAt: string, nowIso: string): boolean {
  return new Date(scheduledAt).getTime() <= new Date(nowIso).getTime();
}

function householdTouches(h: HouseholdListItem, kind: string, id: string): boolean {
  if (h.scope.node.kind === kind && h.scope.node.id === id) return true;
  return h.scope.ancestry.some((n) => n.kind === kind && n.id === id);
}

export function householdsForNotice(noticeId: string): HouseholdListItem[] {
  const occupied = HOUSEHOLDS_LIST.households.filter((h) => h.status === 'occupied' && h.contactEmail);
  const detail = findWfgNoticeDetail(noticeId);
  const targets: NoticeTarget[] = detail?.notice.targets ?? [];
  if (targets.length > 0) {
    return occupied.filter((h) =>
      targets.some((tg) => tg.nodeKind && tg.nodeId && householdTouches(h, tg.nodeKind, tg.nodeId)),
    );
  }
  const scope: ScopePath | null = noticeScopeFor(noticeId);
  if (!scope) return occupied;
  return occupied.filter((h) => householdTouches(h, scope.node.kind, scope.node.id));
}

export function noticeEmailRecipients(noticeId: string): string[] {
  const seen = new Set<string>();
  const to: string[] = [];
  for (const h of householdsForNotice(noticeId)) {
    const email = householdContactEmail(h.householdId);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    to.push(email);
  }
  return to;
}

export function lobbyScopeFor(noticeId: string): { kind: 'estate' | 'building'; id: string } {
  const scope = noticeScopeFor(noticeId);
  if (scope?.node.kind === 'building') return { kind: 'building', id: scope.node.id };
  return { kind: 'estate', id: 'est_wing_fu_garden' };
}

function lobbyPlaylistId(scope: { kind: 'estate' | 'building'; id: string }): string {
  return scope.kind === 'building' ? `playlist_${scope.id}` : 'playlist_wfg_lobby';
}

function contentOf(noticeId: string): StaffNoticeDetail | null {
  return findWfgNoticeDetail(noticeId)?.notice ?? null;
}

function defaultPlan(noticeId: string): NoticeDeliveryPlan {
  const content = contentOf(noticeId);
  return {
    noticeId,
    channels: [],
    scheduledAt: null,
    expireAt: content?.expireAt ?? null,
    deliveredAt: null,
    lobby: null,
    portal: 'none',
  };
}

function seedPlan(
  noticeId: string,
  channels: NoticeDeliveryChannel[],
  scheduledAt: string,
): NoticeDeliveryPlan {
  const content = contentOf(noticeId);
  const scope = lobbyScopeFor(noticeId);
  return {
    noticeId,
    channels: [...channels],
    scheduledAt,
    expireAt: content?.expireAt ?? null,
    deliveredAt: null,
    lobby: channels.includes('lobby')
      ? {
          playlistId: lobbyPlaylistId(scope),
          windowStart: scheduledAt,
          windowEnd: content?.expireAt ?? null,
          scopeKind: scope.kind,
          scopeId: scope.id,
          display: 'queued',
        }
      : null,
    portal: channels.includes('portal') ? 'pending' : 'none',
  };
}

function seed(): void {
  plans.clear();
  outbox.length = 0;
  plans.set(
    DUE_NOTICE,
    seedPlan(DUE_NOTICE, ['email', 'print', 'lobby', 'portal'], '2026-09-19T09:00:00+08:00'),
  );
  plans.set(
    LATER_NOTICE,
    seedPlan(LATER_NOTICE, ['email', 'print', 'lobby', 'portal'], '2026-09-25T09:00:00+08:00'),
  );
}

seed();

export function resetNoticeDeliveries(): void {
  seed();
  emit();
}

export function subscribeNoticeDeliveries(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function noticeDeliveryRevision(): number {
  return revision;
}

export function deliveryPlanOf(noticeId: string): NoticeDeliveryPlan {
  return plans.get(noticeId) ?? defaultPlan(noticeId);
}

export function noticeDeliveryStatus(
  plan: NoticeDeliveryPlan,
  nowIso: string = NOTICES_FIXTURE_NOW,
): NoticeDeliveryStatus {
  if (plan.expireAt && isDeliveryDue(plan.expireAt, nowIso)) return 'expired';
  if (plan.deliveredAt) return 'sent_displaying';
  if (plan.scheduledAt && plan.channels.length > 0) return 'scheduled';
  return 'draft';
}

export function noticeDeliveryDue(
  plan: NoticeDeliveryPlan,
  nowIso: string = NOTICES_FIXTURE_NOW,
): boolean {
  if (noticeDeliveryStatus(plan, nowIso) !== 'scheduled') return false;
  return Boolean(plan.scheduledAt && isDeliveryDue(plan.scheduledAt, nowIso));
}

export function deliveryRows(): NoticeDeliveryRow[] {
  return outbox.slice().sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : a.recordedAt > b.recordedAt ? -1 : 0));
}

export function deliveryRowsFor(noticeId: string): NoticeDeliveryRow[] {
  return deliveryRows().filter((r) => r.noticeId === noticeId);
}

export function noticeEmailSubject(noticeId: string): string {
  const title = contentOf(noticeId)?.titleEn ?? noticeId;
  return `Notice — ${title}`;
}

function stamp(nowIso: string): string {
  return nowIso.replace(/[^0-9]/g, '');
}

function pushRow(row: NoticeDeliveryRow): void {
  outbox.push(row);
}

/**
 * The audit row for a notice reaching its audience. Email delivery is the contract’s
 * `send_notice_email`; any other channel is the notice being published. The place is the
 * node the notice is addressed to.
 */
function recordNoticeAudit(
  action: 'schedule_notice' | 'send_notice',
  noticeId: string,
  channels: readonly NoticeDeliveryChannel[],
): void {
  const scope = noticeScopeFor(noticeId);
  appendAuditEvent({
    action: action === 'send_notice' && channels.includes('email') ? 'send_notice_email' : 'publish_notice',
    entity: { type: 'notice', id: noticeId },
    place: scope
      ? { nodeKind: scope.node.kind, nodeId: scope.node.id }
      : { nodeKind: 'estate', nodeId: 'est_wing_fu_garden' },
  });
}

function applyScheduleFields(
  current: NoticeDeliveryPlan,
  input: ScheduleNoticeDeliveryInput,
): NoticeDeliveryPlan {
  const channels = NOTICE_DELIVERY_CHANNELS.filter((c) => input.channels.includes(c));
  const scope = lobbyScopeFor(current.noticeId);
  const next: NoticeDeliveryPlan = {
    ...current,
    channels,
    scheduledAt: input.scheduledAt,
    deliveredAt: null,
    lobby: channels.includes('lobby')
      ? {
          playlistId: lobbyPlaylistId(scope),
          windowStart: input.scheduledAt,
          windowEnd: current.expireAt,
          scopeKind: scope.kind,
          scopeId: scope.id,
          display: 'queued',
        }
      : null,
    portal: channels.includes('portal') ? 'pending' : 'none',
  };
  return next;
}

export function scheduleNoticeDelivery(
  noticeId: string,
  input: ScheduleNoticeDeliveryInput,
): { plan: NoticeDeliveryPlan; reason?: 'need-channels' | 'need-when' } {
  if (input.channels.length === 0) {
    return { plan: deliveryPlanOf(noticeId), reason: 'need-channels' };
  }
  if (!input.scheduledAt.trim()) {
    return { plan: deliveryPlanOf(noticeId), reason: 'need-when' };
  }
  const next = applyScheduleFields(deliveryPlanOf(noticeId), input);
  plans.set(noticeId, next);
  recordNoticeAudit('schedule_notice', noticeId, next.channels);
  emit();
  return { plan: next };
}

async function sendEmailChannel(noticeId: string, recordedAt: string): Promise<NoticeDeliveryRow[]> {
  const content = contentOf(noticeId);
  const smtp = resolveSmtpSettings(getAdminEmailConfig());
  const subject = noticeEmailSubject(noticeId);
  const text = content
    ? `${content.titleEn}\n\n${content.bodyEn}\n\n—\n${content.titleZhHant}\n\n${content.bodyZhHant}`
    : `Notice ${noticeId}`;
  const rows: NoticeDeliveryRow[] = [];
  const recipients = noticeEmailRecipients(noticeId);
  const targets = recipients.length > 0 ? recipients : ['office@wingfu.example'];
  for (const to of targets) {
    const delivery = await deliverInvoiceEmail({
      to,
      from: formatFromAddress(smtp),
      ...(smtp.replyTo ? { replyTo: smtp.replyTo } : {}),
      subject,
      text,
      attachmentName: '',
      attachmentBytes: new Uint8Array(),
    });
    const row: NoticeDeliveryRow = {
      rowId: `ndel_${noticeId}_email_${to.replace(/[^a-z0-9]/gi, '')}_${stamp(recordedAt)}`,
      noticeId,
      channel: 'email',
      recordedAt,
      status: delivery.status,
      detail: to,
      to,
      subject,
      attachmentName: '',
      attachmentBytes: 0,
      delivery: delivery.delivery,
    };
    pushRow(row);
    rows.push(row);
  }
  return rows;
}

function sendPrintChannel(noticeId: string, recordedAt: string): NoticeDeliveryRow {
  const content = contentOf(noticeId);
  const model = noticeToPoster(
    content ?? {
      noticeId,
      titleEn: noticeId,
      titleZhHant: noticeId,
      bodyEn: '',
      bodyZhHant: '',
      expireAt: deliveryPlanOf(noticeId).expireAt,
    },
    { scheduledAt: deliveryPlanOf(noticeId).scheduledAt, scopeLabel: 'Wing Fu Garden' },
  );
  const pdf = renderNoticePosterPdf(model, 'en');
  const row: NoticeDeliveryRow = {
    rowId: `ndel_${noticeId}_print_${stamp(recordedAt)}`,
    noticeId,
    channel: 'print',
    recordedAt,
    status: 'printed',
    detail: noticePosterFileName(model),
    attachmentName: noticePosterFileName(model),
    attachmentBytes: pdf.byteLength,
  };
  pushRow(row);
  return row;
}

function sendLobbyChannel(plan: NoticeDeliveryPlan, recordedAt: string): NoticeDeliveryRow {
  const scope = plan.lobby ?? {
    playlistId: lobbyPlaylistId(lobbyScopeFor(plan.noticeId)),
    windowStart: plan.scheduledAt ?? recordedAt,
    windowEnd: plan.expireAt,
    scopeKind: lobbyScopeFor(plan.noticeId).kind,
    scopeId: lobbyScopeFor(plan.noticeId).id,
    display: 'displaying' as const,
  };
  const row: NoticeDeliveryRow = {
    rowId: `ndel_${plan.noticeId}_lobby_${stamp(recordedAt)}`,
    noticeId: plan.noticeId,
    channel: 'lobby',
    recordedAt,
    status: 'displaying',
    detail: `${scope.playlistId} · ${scope.scopeKind}:${scope.scopeId}`,
  };
  pushRow(row);
  return row;
}

function sendPortalChannel(noticeId: string, recordedAt: string): NoticeDeliveryRow {
  const row: NoticeDeliveryRow = {
    rowId: `ndel_${noticeId}_portal_${stamp(recordedAt)}`,
    noticeId,
    channel: 'portal',
    recordedAt,
    status: 'published',
    detail: 'resident portal',
  };
  pushRow(row);
  return row;
}

async function deliverPlan(plan: NoticeDeliveryPlan, recordedAt: string): Promise<NoticeDeliveryRow[]> {
  const rows: NoticeDeliveryRow[] = [];
  if (plan.channels.includes('email')) {
    rows.push(...await sendEmailChannel(plan.noticeId, recordedAt));
  }
  if (plan.channels.includes('print')) {
    rows.push(sendPrintChannel(plan.noticeId, recordedAt));
  }
  if (plan.channels.includes('lobby')) {
    rows.push(sendLobbyChannel(plan, recordedAt));
  }
  if (plan.channels.includes('portal')) {
    rows.push(sendPortalChannel(plan.noticeId, recordedAt));
  }
  const scope = lobbyScopeFor(plan.noticeId);
  const next: NoticeDeliveryPlan = {
    ...plan,
    deliveredAt: recordedAt,
    lobby: plan.channels.includes('lobby')
      ? {
          playlistId: lobbyPlaylistId(scope),
          windowStart: plan.scheduledAt ?? recordedAt,
          windowEnd: plan.expireAt,
          scopeKind: scope.kind,
          scopeId: scope.id,
          display: 'displaying',
        }
      : plan.lobby,
    portal: plan.channels.includes('portal') ? 'published' : plan.portal,
  };
  plans.set(plan.noticeId, next);
  return rows;
}

function skipReason(plan: NoticeDeliveryPlan, nowIso: string): DeliverySkipReason | null {
  const status = noticeDeliveryStatus(plan, nowIso);
  if (status === 'expired') return 'expired';
  if (status === 'sent_displaying') return 'already-sent';
  if (status === 'draft') return 'draft';
  if (!plan.scheduledAt || !isDeliveryDue(plan.scheduledAt, nowIso)) return 'not-due';
  return null;
}

/**
 * Job / endpoint: deliver every scheduled notice whose `scheduledAt` has been
 * reached at `nowIso` (fixture noon unless a caller passes another instant).
 */
export async function processDueNoticeDeliveries(
  nowIso: string = NOTICES_FIXTURE_NOW,
): Promise<ProcessDueNoticeDeliveriesResult> {
  const sent: NoticeDeliveryRow[] = [];
  const skipped: Array<{ noticeId: string; reason: DeliverySkipReason }> = [];
  const ids = new Set<string>([...plans.keys()]);
  for (const noticeId of ids) {
    const plan = deliveryPlanOf(noticeId);
    const reason = skipReason(plan, nowIso);
    if (reason) {
      skipped.push({ noticeId, reason });
      continue;
    }
    sent.push(...await deliverPlan(plan, nowIso));
    recordNoticeAudit('send_notice', noticeId, plan.channels);
  }
  if (sent.length > 0) emit();
  return { nowIso, sent, skipped };
}

/** Demo bypass — deliver this notice even if `scheduledAt` is still in the future. */
export async function sendNoticeNow(
  noticeId: string,
  input?: ScheduleNoticeDeliveryInput,
  nowIso: string = NOTICES_FIXTURE_NOW,
): Promise<{ rows: NoticeDeliveryRow[]; reason?: DeliverySkipReason | 'need-channels' | 'need-when' }> {
  let plan = deliveryPlanOf(noticeId);
  if (input) {
    const scheduled = scheduleNoticeDelivery(noticeId, {
      channels: input.channels,
      scheduledAt: input.scheduledAt.trim() || nowIso,
    });
    if (scheduled.reason) return { rows: [], reason: scheduled.reason };
    plan = scheduled.plan;
  }
  const status = noticeDeliveryStatus(plan, nowIso);
  if (status === 'expired') return { rows: [], reason: 'expired' };
  if (status === 'sent_displaying') return { rows: [], reason: 'already-sent' };
  if (plan.channels.length === 0) return { rows: [], reason: 'draft' };
  const rows = await deliverPlan(plan, nowIso);
  recordNoticeAudit('send_notice', noticeId, plan.channels);
  emit();
  return { rows };
}

export const NOTICE_DELIVERY_FIXTURES = {
  due: DUE_NOTICE,
  later: LATER_NOTICE,
} as const;
