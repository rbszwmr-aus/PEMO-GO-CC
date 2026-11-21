/**
 * Demo notices + visitors types for resident-portal coherence.
 * Opaque ids: ntc_… / vis_…. No BMS / door unlock.
 */

export type NoticeSeverity = 'info' | 'warning' | 'critical';

export type VisitorStatus = 'expected' | 'checked_in' | 'checked_out' | 'cancelled';

export const VISITOR_STATUSES = [
  'expected',
  'checked_in',
  'checked_out',
  'cancelled',
] as const satisfies readonly VisitorStatus[];

export const isVisitorStatus = (value: string): value is VisitorStatus =>
  (VISITOR_STATUSES as readonly string[]).includes(value);

export interface DemoNotice {
  readonly noticeId: string;
  readonly title: string;
  readonly body: string;
  /** ISO-8601 with offset (Hong Kong +08:00 preferred). */
  readonly publishedAt: string;
  readonly severity: NoticeSeverity;
  readonly category: string;
}

export interface DemoVisitor {
  readonly visitorId: string;
  readonly name: string;
  readonly purpose: string | null;
  readonly expectedFrom: string;
  readonly expectedTo: string;
  readonly hostUnitId: string | null;
  readonly idStub: string | null;
  readonly residentRef: string;
  readonly status: VisitorStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly checkedOutAt: string | null;
}

export interface CreateVisitorInput {
  readonly name: string;
  readonly purpose?: string;
  readonly expectedFrom: string;
  readonly expectedTo: string;
  readonly hostUnitId?: string;
  readonly idStub?: string;
  readonly residentRef?: string;
}

/** Stable fixture resident (same as tickets demo). */
export const FIXTURE_RESIDENT_ID = 'res_demo_ho_mei_yi';
export const FIXTURE_RESIDENT_NAME = 'Ho Mei-yi 何美儀';
export const FIXTURE_UNIT_ID = 'unt_demo_a_12f_a1';
export const FIXTURE_UNIT_LABEL = 'A · 12/F A1';
