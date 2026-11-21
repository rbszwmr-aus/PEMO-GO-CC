/**
 * THE SERVICE MODEL — the sidebar's "All Services" list, and the subsystem tab map.
 *
 * Sourced from the design export's `SERVICES`, `GROUPS`, `PRIMARY` and `RESERVED`.
 * Rendered as a flat All-Services list (not the management web's OPERATE/SAFETY
 * grouping — that does not recur here, see DIVERGENCES.md B1).
 *
 * A `live` service opens its subsystem (an empty pane per tab — this PID renders
 * no data). A `soon` service opens a coming-soon panel. `soon` means "this
 * estate does not have this service yet" — a true statement about the estate's
 * configuration. It is NOT the same as "we have not built this screen", which is
 * why the account menu (no screen behind it) is not given a `soon` tag and is
 * not rendered at all (Ruling 4 / DIVERGENCES.md).
 *
 * `iconName` names a PNG in public/icons/. Those assets are NOT in the design
 * handoff (both design bundles ship four files and no icons/ folder) — see the
 * finding in the Step 2 report and DIVERGENCES.md. The slot reserves its space;
 * ServiceIcon renders the PNG only when the asset is actually present, so no
 * broken image ships and the label carries wayfinding until the assets arrive.
 * `glyph` services carry a text mark in the export itself (a hybrid nav).
 */

import { MESSAGES } from '../i18n/messages.ts';

export type ServiceTag = 'live' | 'soon';

export type ServiceId =
  | 'search' | 'bookings' | 'passes' | 'loyalty' | 'notifications'
  | 'helpdesk' | 'notices' | 'visitor' | 'access' | 'invoices' | 'community';

export type GroupId = 'book' | 'bookings' | 'passes' | 'loyalty' | 'notifications' | 'helpdesk' | 'notices' | 'visitor' | 'invoices';

export interface ServiceDef {
  id: ServiceId;
  tag: ServiceTag;
  /** PNG basename in public/icons/, when the export assigns one. */
  iconName?: string;
  /** Text mark, for the services the export itself renders as a glyph. */
  glyph?: string;
  /** The subsystem a `live` service opens. Absent for `soon` services. */
  group?: GroupId;
}

/** In sidebar order, exactly as the export lists them. */
export const SERVICES: readonly ServiceDef[] = [
  { id: 'search',        tag: 'live', iconName: 'clubhouse', group: 'book' },
  { id: 'bookings',      tag: 'live', iconName: 'documents', group: 'bookings' },
  { id: 'passes',        tag: 'live', glyph: '▩',            group: 'passes' },
  { id: 'loyalty',       tag: 'live', iconName: 'reports',   group: 'loyalty' },
  { id: 'notifications', tag: 'live', iconName: 'cases',     group: 'notifications' },
  { id: 'helpdesk',      tag: 'live', iconName: 'helpdesk', group: 'helpdesk' },
  { id: 'notices',       tag: 'live', iconName: 'notices', group: 'notices' },
  { id: 'visitor',       tag: 'live', iconName: 'visitor', group: 'visitor' },
  { id: 'access',        tag: 'soon', iconName: 'access' },
  { id: 'invoices',      tag: 'live', glyph: '◫',            group: 'invoices' },
  { id: 'community',     tag: 'soon', glyph: '◎' },
] as const;

export const SERVICE_IDS = SERVICES.map((s) => s.id);

export function serviceById(id: ServiceId): ServiceDef {
  const s = SERVICES.find((x) => x.id === id);
  if (!s) throw new Error(`unknown service ${id}`);
  return s;
}

/** The `soon` services that render a coming-soon panel from RESERVED. */
export type ReservedId = 'access' | 'community';

export interface TabDef {
  id: string;
  label: (typeof MESSAGES.groups.book.tabs)['explore'];
  /** True where the export shows a count badge. The COUNT is data and is not
   *  rendered here — the badge PRIMITIVE reserves its space regardless (B2). */
  badge?: boolean;
}

export interface GroupDef {
  id: GroupId;
  code: string;
  title: (typeof MESSAGES.groups.book)['title'];
  tabs: readonly TabDef[];
}

export const GROUPS: Record<GroupId, GroupDef> = {
  book: {
    id: 'book', code: 'BOOKING', title: MESSAGES.groups.book.title,
    tabs: [
      { id: 'explore', label: MESSAGES.groups.book.tabs.explore },
      { id: 'detail', label: MESSAGES.groups.book.tabs.detail },
      { id: 'form', label: MESSAGES.groups.book.tabs.form },
      { id: 'checkout', label: MESSAGES.groups.book.tabs.checkout },
      { id: 'confirmation', label: MESSAGES.groups.book.tabs.confirmation },
      { id: 'saved', label: MESSAGES.groups.book.tabs.saved },
    ],
  },
  bookings: {
    id: 'bookings', code: 'BOOKINGS', title: MESSAGES.groups.bookings.title,
    tabs: [
      { id: 'upcoming', label: MESSAGES.groups.bookings.tabs.upcoming, badge: true },
      { id: 'pending', label: MESSAGES.groups.bookings.tabs.pending },
      { id: 'past', label: MESSAGES.groups.bookings.tabs.past },
      { id: 'cancelled', label: MESSAGES.groups.bookings.tabs.cancelled },
      { id: 'bookingDetail', label: MESSAGES.groups.bookings.tabs.bookingDetail },
    ],
  },
  passes: {
    id: 'passes', code: 'PASSES', title: MESSAGES.groups.passes.title,
    tabs: [
      { id: 'mine', label: MESSAGES.groups.passes.tabs.mine },
      { id: 'buy', label: MESSAGES.groups.passes.tabs.buy },
      { id: 'classes', label: MESSAGES.groups.passes.tabs.classes },
    ],
  },
  loyalty: {
    id: 'loyalty', code: 'LOYALTY', title: MESSAGES.groups.loyalty.title,
    tabs: [
      { id: 'balance', label: MESSAGES.groups.loyalty.tabs.balance },
      { id: 'ledger', label: MESSAGES.groups.loyalty.tabs.ledger },
      { id: 'redeem', label: MESSAGES.groups.loyalty.tabs.redeem },
      { id: 'expiry', label: MESSAGES.groups.loyalty.tabs.expiry },
    ],
  },
  notifications: {
    id: 'notifications', code: 'INBOX', title: MESSAGES.groups.notifications.title,
    tabs: [
      { id: 'all', label: MESSAGES.groups.notifications.tabs.all, badge: true },
      { id: 'bookings', label: MESSAGES.groups.notifications.tabs.bookings },
      { id: 'payments', label: MESSAGES.groups.notifications.tabs.payments },
      { id: 'estateNotices', label: MESSAGES.groups.notifications.tabs.estateNotices },
      { id: 'preferences', label: MESSAGES.groups.notifications.tabs.preferences },
    ],
  },
  helpdesk: {
    id: 'helpdesk', code: 'HELPDESK', title: MESSAGES.groups.helpdesk.title,
    tabs: [
      { id: 'list', label: MESSAGES.groups.helpdesk.tabs.list },
      { id: 'create', label: MESSAGES.groups.helpdesk.tabs.create },
      { id: 'detail', label: MESSAGES.groups.helpdesk.tabs.detail },
    ],
  },
  notices: {
    id: 'notices', code: 'NOTICES', title: MESSAGES.groups.notices.title,
    tabs: [
      { id: 'list', label: MESSAGES.groups.notices.tabs.list },
      { id: 'detail', label: MESSAGES.groups.notices.tabs.detail },
    ],
  },
  visitor: {
    id: 'visitor', code: 'VISITOR', title: MESSAGES.groups.visitor.title,
    tabs: [
      { id: 'list', label: MESSAGES.groups.visitor.tabs.list },
      { id: 'create', label: MESSAGES.groups.visitor.tabs.create },
      { id: 'detail', label: MESSAGES.groups.visitor.tabs.detail },
    ],
  },
  invoices: {
    id: 'invoices', code: 'INVOICES', title: MESSAGES.groups.invoices.title,
    tabs: [
      { id: 'list', label: MESSAGES.groups.invoices.tabs.list },
      { id: 'detail', label: MESSAGES.groups.invoices.tabs.detail },
    ],
  },
};

/** Legacy service ids still accepted in a URL (the export called Invoices `bills`). */
export const SERVICE_ALIASES: Readonly<Record<string, ServiceId>> = { bills: 'invoices' };

/** The portal opens on Explore — no home grid (the export removed U-01). */
export const DEFAULT_SERVICE: ServiceId = 'search';
