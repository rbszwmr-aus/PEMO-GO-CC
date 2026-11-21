/**
 * Help desk live reads — domain payloads + Surfaces ticket→UI enum map (option a).
 *
 * Backend returns domain ticket / contact fields (channel, status, ...). Surfaces
 * maps them to UI chrome enums used by HelpDesk.tsx (waiting | in_progress |
 * overdue | closed, app | phone | counter, tones). Do not invent empty queues
 * when the server is down — the live client returns problem / offline instead.
 *
 * Paths (contract docs/contracts/proposed-helpdesk-read-ops.md):
 *   GET /api/management-web/v0/helpdesk/queue
 *   GET /api/management-web/v0/helpdesk/contacts/{contactId}
 */

import type { LocalizedText } from '../i18n/locale.ts';
import type { Meta } from './types.ts';
import type {
  HelpdeskChannel,
  HelpdeskContactDetail,
  HelpdeskContactState,
  HelpdeskQueueRow,
  HelpdeskStat,
  HelpdeskTimelineTurn,
  HelpdeskTone,
} from './helpdesk-fixtures.ts';

export const LIVE_HELPDESK_QUEUE_PATH = '/api/management-web/v0/helpdesk/queue';
export const LIVE_HELPDESK_CONTACTS_PATH = '/api/management-web/v0/helpdesk/contacts';

/** Domain ticket_channel vocabulary (packages/api-contracts/case-vocabularies.json). */
export type DomainTicketChannel =
  | 'resident_app'
  | 'staff_manual'
  | 'phone'
  | 'email'
  | 'kiosk'
  | 'external';

/** Domain ticket_status vocabulary. */
export type DomainTicketStatus =
  | 'open'
  | 'triaged'
  | 'in_progress'
  | 'awaiting_resident'
  | 'resolved'
  | 'closed';

export interface HelpdeskQueueResponse {
  meta: Meta;
  stats: {
    waiting: number;
    answeredToday: number;
    raisedAsCases: number;
    officeHours: { start: string; end: string };
    longestWaitMinutes?: number | null;
    medianFirstReplyMinutes?: number | null;
  };
  rows: HelpdeskQueueRowDomain[];
}

export interface HelpdeskQueueRowDomain {
  contactId: string;
  channel: DomainTicketChannel;
  residentDisplayName: string;
  unitLabel: string;
  subject: LocalizedText;
  /** Prefer Backend-supplied waiting label; else derived from waitingMinutes. */
  waitingLabel?: LocalizedText;
  waitingMinutes?: number | null;
  status: DomainTicketStatus;
  /** When true, Surfaces paints overdue chrome even if status is still open. */
  overdue?: boolean;
}

export interface HelpdeskContactDetailResponse {
  meta: Meta;
  contact: {
    contactId: string;
    channel: DomainTicketChannel;
    residentDisplayName: string;
    unitLabel: string;
    subject: LocalizedText;
    waitingLabel?: LocalizedText;
    waitingMinutes?: number | null;
    status: DomainTicketStatus;
    overdue?: boolean;
    openedAt: string;
    linkedCaseRef: string | null;
    /** Staff-facing disposition note (not the domain disposition act enum). */
    dispositionNote: LocalizedText;
    timeline: Array<{
      at: string;
      who: LocalizedText;
      channel: DomainTicketChannel | 'system';
      body: LocalizedText;
    }>;
  };
}

/** UI view model after ticket→chrome mapping. */
export interface HelpdeskQueueView {
  stats: HelpdeskStat[];
  rows: HelpdeskQueueRow[];
}

/** Waiting minutes at/above this threshold become overdue chrome when still open. */
export const HELPDESK_OVERDUE_WAIT_MINUTES = 20;

export function mapDomainChannel(channel: DomainTicketChannel): HelpdeskChannel {
  switch (channel) {
    case 'phone':
      return 'phone';
    case 'kiosk':
    case 'staff_manual':
      return 'counter';
    case 'resident_app':
    case 'email':
    case 'external':
      return 'app';
  }
}

export function mapDomainStatus(
  status: DomainTicketStatus,
  opts: { overdue?: boolean | undefined; waitingMinutes?: number | null | undefined } = {},
): HelpdeskContactState {
  if (status === 'resolved' || status === 'closed') return 'closed';
  if (status === 'in_progress') return 'in_progress';
  const overdue =
    opts.overdue === true
    || (typeof opts.waitingMinutes === 'number' && opts.waitingMinutes >= HELPDESK_OVERDUE_WAIT_MINUTES);
  return overdue ? 'overdue' : 'waiting';
}

export function mapUiTone(state: HelpdeskContactState): HelpdeskTone {
  switch (state) {
    case 'overdue':
      return 'critical';
    case 'waiting':
      return 'warning';
    case 'in_progress':
      return 'info';
    case 'closed':
      return 'normal';
  }
}

function waitingLabelFromMinutes(minutes: number | null | undefined): LocalizedText {
  if (minutes == null || Number.isNaN(minutes)) {
    return { en: '—', 'zh-Hant': '—', 'zh-Hans': '—' };
  }
  const m = Math.max(0, Math.round(minutes));
  return {
    en: m + 'm',
    'zh-Hant': m + ' 分鐘',
  };
}

function mapRow(row: HelpdeskQueueRowDomain): HelpdeskQueueRow {
  const state = mapDomainStatus(row.status, {
    overdue: row.overdue,
    waitingMinutes: row.waitingMinutes,
  });
  return {
    id: row.contactId,
    channel: mapDomainChannel(row.channel),
    who: row.residentDisplayName,
    unit: row.unitLabel,
    subject: row.subject,
    wait: row.waitingLabel ?? waitingLabelFromMinutes(row.waitingMinutes),
    state,
    tone: mapUiTone(state),
  };
}

export function mapHelpdeskQueue(response: HelpdeskQueueResponse): HelpdeskQueueView {
  const s = response.stats;
  const longest = s.longestWaitMinutes;
  const median = s.medianFirstReplyMinutes;
  const stats: HelpdeskStat[] = [
    {
      id: 'waiting',
      label: { en: 'WAITING', 'zh-Hant': '等候中', 'zh-Hans': '等候中' },
      value: String(s.waiting),
      note:
        longest != null
          ? {
              en: 'longest ' + longest + ' minutes',
              'zh-Hant': '最長 ', 'zh-Hans': '最长 ' + longest + ' 分鐘',
            }
          : {
              en: 'open contacts in queue',
              'zh-Hant': '佇列中待處理聯絡', 'zh-Hans': '队列中待处理联络',
            },
      tone: s.waiting > 0 ? 'warning' : 'normal',
    },
    {
      id: 'answered',
      label: { en: 'ANSWERED TODAY', 'zh-Hant': '今日已回覆', 'zh-Hans': '今日已回复' },
      value: String(s.answeredToday),
      note:
        median != null
          ? {
              en: 'median first reply ' + median + ' minutes',
              'zh-Hant': '首次回覆中位數 ', 'zh-Hans': '首次回复中位数 ' + median + ' 分鐘',
            }
          : {
              en: 'closed or handed on today',
              'zh-Hant': '今日已完結或轉交', 'zh-Hans': '今日已完结或转交',
            },
      tone: 'normal',
    },
    {
      id: 'raised',
      label: { en: 'RAISED AS CASES', 'zh-Hant': '已轉為個案', 'zh-Hans': '已转为案件' },
      value: String(s.raisedAsCases),
      note: {
        en: 'of ' + s.answeredToday + ' · the rest closed at the desk',
        'zh-Hant': '共 ', 'zh-Hans': '共 ' + s.answeredToday + ' 宗 · 其餘於服務台完結',
      },
      tone: 'info',
    },
    {
      id: 'hours',
      label: { en: 'OFFICE HOURS', 'zh-Hant': '辦公時間', 'zh-Hans': '办公时间' },
      value: s.officeHours.start,
      note: {
        en: 'to ' + s.officeHours.end + ' · out of hours goes to phone',
        'zh-Hant': '至 ', 'zh-Hans': '至 ' + s.officeHours.end + ' · 非辦公時間轉電話',
      },
      tone: 'unknown',
    },
  ];
  return { stats, rows: response.rows.map(mapRow) };
}

export function mapHelpdeskContact(response: HelpdeskContactDetailResponse): HelpdeskContactDetail {
  const c = response.contact;
  const state = mapDomainStatus(c.status, {
    overdue: c.overdue,
    waitingMinutes: c.waitingMinutes,
  });
  const timeline: HelpdeskTimelineTurn[] = c.timeline.map((turn) => ({
    at: turn.at,
    who: turn.who,
    channel: turn.channel === 'system' ? 'system' : mapDomainChannel(turn.channel),
    body: turn.body,
  }));
  return {
    id: c.contactId,
    channel: mapDomainChannel(c.channel),
    who: c.residentDisplayName,
    unit: c.unitLabel,
    subject: c.subject,
    wait: c.waitingLabel ?? waitingLabelFromMinutes(c.waitingMinutes),
    state,
    tone: mapUiTone(state),
    openedAt: c.openedAt,
    linkedCaseRef: c.linkedCaseRef,
    disposition: c.dispositionNote,
    timeline,
  };
}

/** Backend @ 96caed2 returns fixture/UI chrome already (compose-helpdesk maps server-side). */
export interface HelpdeskChromeQueueWire {
  meta: Meta;
  stats: HelpdeskStat[];
  rows: HelpdeskQueueRow[];
}

export interface HelpdeskChromeContactWire {
  meta: Meta;
  contact: HelpdeskContactDetail;
}

export function isChromeQueueWire(body: unknown): body is HelpdeskChromeQueueWire {
  if (body === null || typeof body !== 'object') return false;
  const o = body as Record<string, unknown>;
  return Array.isArray(o['stats']) && Array.isArray(o['rows']);
}

export function isChromeContactWire(body: unknown): body is HelpdeskChromeContactWire {
  if (body === null || typeof body !== 'object') return false;
  const contact = (body as Record<string, unknown>)['contact'];
  if (contact === null || typeof contact !== 'object') return false;
  const c = contact as Record<string, unknown>;
  return typeof c['id'] === 'string' && typeof c['who'] === 'string' && 'disposition' in c;
}

/** Accept Backend chrome wire or domain wire; always return UI view model. */
export function normalizeHelpdeskQueue(body: unknown): HelpdeskQueueView {
  if (isChromeQueueWire(body)) {
    return { stats: body.stats, rows: body.rows };
  }
  return mapHelpdeskQueue(body as HelpdeskQueueResponse);
}

export function normalizeHelpdeskContact(body: unknown): HelpdeskContactDetail {
  if (isChromeContactWire(body)) {
    return body.contact;
  }
  return mapHelpdeskContact(body as HelpdeskContactDetailResponse);
}
