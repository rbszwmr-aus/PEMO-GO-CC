/**
 * Demo ticket types for portal ↔ Help desk coherence.
 * TicketStatus mirrors @pemo/helpdesk vocabulary — re-declared so UI apps
 * need not depend on @pemo/helpdesk (React allowlist).
 * Assign is NOT a status: use assignedAdminId + assignedAdminLabel.
 */

export type TicketStatus =
  | 'open'
  | 'triaged'
  | 'in_progress'
  | 'awaiting_resident'
  | 'resolved'
  | 'closed';

/** Surfaces alias — same union. */
export type DemoTicketStatus = TicketStatus;

export const TICKET_STATUS = [
  'open',
  'triaged',
  'in_progress',
  'awaiting_resident',
  'resolved',
  'closed',
] as const satisfies readonly TicketStatus[];

export const DEMO_TICKET_STATUSES = TICKET_STATUS;

export const isTicketStatus = (value: string): value is TicketStatus =>
  (TICKET_STATUS as readonly string[]).includes(value);

export interface LocalizedText {
  readonly en: string;
  readonly 'zh-Hant': string;
}

export type DemoTimelineKind = 'created' | 'status' | 'assign' | 'note';

export type DemoTimelineActor = 'resident' | 'staff' | 'system';

export interface DemoTimelineEvent {
  readonly id: string;
  readonly at: string;
  readonly kind: DemoTimelineKind;
  readonly actor: DemoTimelineActor;
  readonly messageEn: string;
  readonly messageZh: string;
  readonly status?: TicketStatus;
  /** When false, portal detail omits this turn. Defaults true except kind=note. */
  readonly residentVisible?: boolean;
}

export interface DemoTicket {
  readonly id: string;
  readonly subject: string;
  readonly body: string;
  readonly category: string;
  readonly status: TicketStatus;
  readonly assignedAdminId: string | null;
  readonly assignedAdminLabel: string | null;
  readonly unitLabel: string;
  readonly channel: 'app';
  readonly reporterRef: string;
  readonly createdByResidentId: string;
  readonly createdByName: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Optional SLA due — past due + open/triaged → overdue chrome. */
  readonly dueAt: string | null;
  readonly timeline: readonly DemoTimelineEvent[];
}

export interface DemoAdmin {
  readonly id: string;
  readonly label: string;
}

export interface CreateTicketInput {
  readonly subject: string;
  readonly body?: string;
  readonly category?: string;
  readonly unitLabel?: string;
  readonly reporterRef?: string;
  readonly createdByResidentId?: string;
  readonly createdByName?: string;
}

/** Staff Help desk chrome states (compose-helpdesk / helpdesk-fixtures). */
export type HelpdeskChromeState = 'waiting' | 'in_progress' | 'overdue' | 'closed';

export type HelpdeskTone = 'critical' | 'warning' | 'info' | 'normal' | 'unknown';

export interface HelpdeskQueueRowChrome {
  readonly id: string;
  readonly channel: 'app' | 'phone' | 'counter';
  readonly who: string;
  readonly unit: string;
  readonly subject: LocalizedText;
  readonly wait: LocalizedText;
  readonly state: HelpdeskChromeState;
  readonly tone: HelpdeskTone;
  readonly assignedAdminLabel: string | null;
  readonly demoStatus: TicketStatus;
}

export interface HelpdeskTimelineTurnChrome {
  readonly at: string;
  readonly who: LocalizedText;
  readonly channel: 'app' | 'phone' | 'counter' | 'system';
  readonly body: LocalizedText;
}

export interface HelpdeskContactDetailChrome {
  readonly id: string;
  readonly channel: 'app' | 'phone' | 'counter';
  readonly who: string;
  readonly unit: string;
  readonly subject: LocalizedText;
  readonly wait: LocalizedText;
  readonly state: HelpdeskChromeState;
  readonly tone: HelpdeskTone;
  readonly openedAt: string;
  readonly linkedCaseRef: string | null;
  readonly disposition: LocalizedText;
  readonly assignedAdminId: string | null;
  readonly assignedAdminLabel: string | null;
  readonly demoStatus: TicketStatus;
  readonly timeline: readonly HelpdeskTimelineTurnChrome[];
}

export interface PortalTicketSummary {
  readonly id: string;
  readonly subject: string;
  readonly category: string;
  readonly status: TicketStatus;
  readonly assignedAdminLabel: string | null;
  readonly openedAt: string;
  readonly updatedAt: string;
  readonly unitLabel: string;
}

export interface PortalTicketDetail {
  readonly id: string;
  readonly subject: string;
  readonly body: string;
  readonly category: string;
  readonly status: TicketStatus;
  readonly assignedAdminLabel: string | null;
  readonly openedAt: string;
  readonly updatedAt: string;
  readonly unitLabel: string;
  readonly timeline: readonly {
    readonly id: string;
    readonly at: string;
    readonly kind: DemoTimelineKind;
    readonly actor: DemoTimelineActor;
    readonly message: LocalizedText;
    readonly status?: TicketStatus;
  }[];
}

/** Stable fixture resident for the portal demo (Ho Mei-yi · A · 12/F A1). */
export const FIXTURE_RESIDENT_ID = 'res_demo_ho_mei_yi';
export const FIXTURE_RESIDENT_NAME = 'Ho Mei-yi 何美儀';
export const FIXTURE_UNIT_LABEL = 'A · 12/F A1';
