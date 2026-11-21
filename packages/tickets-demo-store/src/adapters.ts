import type {
  DemoTicket,
  DemoTimelineEvent,
  HelpdeskChromeState,
  HelpdeskContactDetailChrome,
  HelpdeskQueueRowChrome,
  HelpdeskTimelineTurnChrome,
  HelpdeskTone,
  LocalizedText,
  PortalTicketDetail,
  PortalTicketSummary,
  TicketStatus,
} from './types.js';

/**
 * TicketStatus (+ optional dueAt) → staff chrome, matching compose-helpdesk.ts:
 * closed/resolved → closed; in_progress/awaiting_resident → in_progress;
 * open/triaged → waiting, or overdue when past dueAt.
 */
export function statusToStaffChrome(
  status: TicketStatus,
  dueAt: string | null = null,
  now: Date = new Date(),
): HelpdeskChromeState {
  if (status === 'closed' || status === 'resolved') return 'closed';
  if (status === 'in_progress' || status === 'awaiting_resident') return 'in_progress';
  if (dueAt !== null && Date.parse(dueAt) < now.getTime()) return 'overdue';
  return 'waiting';
}

function toneFor(state: HelpdeskChromeState): HelpdeskTone {
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

function waitLabels(
  state: HelpdeskChromeState,
  ticket: DemoTicket,
  now: Date,
): LocalizedText {
  const opened = Date.parse(ticket.createdAt);
  const mins = Number.isFinite(opened)
    ? Math.max(0, Math.floor((now.getTime() - opened) / 60_000))
    : 0;
  const enM = mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  const zhM = mins < 60 ? `${mins} 分鐘` : `${Math.floor(mins / 60)} 小時 ${mins % 60} 分鐘`;
  if (state === 'closed') return { en: 'Closed', 'zh-Hant': '已完結' };
  if (state === 'in_progress') {
    return { en: `In progress ${enM}`, 'zh-Hant': `處理中 ${zhM}` };
  }
  return { en: enM, 'zh-Hant': zhM };
}

function dispositionText(ticket: DemoTicket): LocalizedText {
  if (ticket.status === 'closed' || ticket.status === 'resolved') {
    return { en: 'Closed at the desk', 'zh-Hant': '已於服務台完結' };
  }
  if (ticket.assignedAdminLabel) {
    return {
      en: `Assigned · ${ticket.assignedAdminLabel}`,
      'zh-Hant': `已指派 · ${ticket.assignedAdminLabel}`,
    };
  }
  return { en: 'Waiting at the desk', 'zh-Hant': '服務台等候中' };
}

function timelineWho(ev: DemoTimelineEvent, ticket: DemoTicket): LocalizedText {
  if (ev.actor === 'resident') {
    return { en: ticket.createdByName, 'zh-Hant': ticket.createdByName };
  }
  if (ev.actor === 'system') {
    return { en: 'System', 'zh-Hant': '系統' };
  }
  return {
    en: ticket.assignedAdminLabel ?? 'Help desk',
    'zh-Hant': ticket.assignedAdminLabel ?? '服務台',
  };
}

function toStaffTimelineTurn(
  ev: DemoTimelineEvent,
  ticket: DemoTicket,
): HelpdeskTimelineTurnChrome {
  return {
    at: ev.at,
    who: timelineWho(ev, ticket),
    channel: ev.actor === 'resident' ? 'app' : 'system',
    body: { en: ev.messageEn, 'zh-Hant': ev.messageZh },
  };
}

export function toHelpdeskQueueRow(
  ticket: DemoTicket,
  now: Date = new Date(),
): HelpdeskQueueRowChrome {
  const state = statusToStaffChrome(ticket.status, ticket.dueAt, now);
  return {
    id: ticket.id,
    channel: 'app',
    who: ticket.createdByName,
    unit: ticket.unitLabel,
    subject: { en: ticket.subject, 'zh-Hant': ticket.subject },
    wait: waitLabels(state, ticket, now),
    state,
    tone: toneFor(state),
    assignedAdminLabel: ticket.assignedAdminLabel,
    demoStatus: ticket.status,
  };
}

export function toHelpdeskContactDetail(
  ticket: DemoTicket,
  now: Date = new Date(),
): HelpdeskContactDetailChrome {
  const row = toHelpdeskQueueRow(ticket, now);
  return {
    id: ticket.id,
    channel: row.channel,
    who: row.who,
    unit: row.unit,
    subject: row.subject,
    wait: row.wait,
    state: row.state,
    tone: row.tone,
    openedAt: ticket.createdAt,
    linkedCaseRef: null,
    disposition: dispositionText(ticket),
    assignedAdminId: ticket.assignedAdminId,
    assignedAdminLabel: ticket.assignedAdminLabel,
    demoStatus: ticket.status,
    timeline: ticket.timeline.map((ev) => toStaffTimelineTurn(ev, ticket)),
  };
}

export function toPortalTicketSummary(ticket: DemoTicket): PortalTicketSummary {
  return {
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category,
    status: ticket.status,
    assignedAdminLabel: ticket.assignedAdminLabel,
    openedAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    unitLabel: ticket.unitLabel,
  };
}

/** Surfaces alias. */
export const toPortalSummary = toPortalTicketSummary;

function isResidentVisible(ev: DemoTimelineEvent): boolean {
  if (ev.residentVisible === false) return false;
  if (ev.residentVisible === true) return true;
  return ev.kind !== 'note';
}

export function toPortalTicketDetail(ticket: DemoTicket): PortalTicketDetail {
  return {
    id: ticket.id,
    subject: ticket.subject,
    body: ticket.body,
    category: ticket.category,
    status: ticket.status,
    assignedAdminLabel: ticket.assignedAdminLabel,
    openedAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    unitLabel: ticket.unitLabel,
    timeline: ticket.timeline.filter(isResidentVisible).map((ev) => {
      const base = {
        id: ev.id,
        at: ev.at,
        kind: ev.kind,
        actor: ev.actor,
        message: { en: ev.messageEn, 'zh-Hant': ev.messageZh } as const,
      };
      return ev.status !== undefined ? { ...base, status: ev.status } : base;
    }),
  };
}
