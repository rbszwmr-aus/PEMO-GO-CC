/**
 * Every feature screen the app can render, loaded on demand: the app shell (nav, scope rail, styles, i18n) is the
 * entry bundle; a screen's code, and the fixtures and clients only it reads, arrive when its route is first opened.
 * A screen that reads one of the data clients (front counter, lookups, audit, integration) loads those clients in the
 * same step and selects the app's current source on them (`client-source.ts`) before it renders.
 *
 * @version 0.3.0
 * @changelog
 *   0.3.0 (2026-11-20) Back to plain `React.lazy` (the retry wrapper of 0.2.0 could not work: the browser keeps a failed import; Try again reloads).
 *   0.2.0 (2026-11-20) (withdrawn in 0.3.0) retry wrapper `resetFailedScreens`.
 *   0.1.0 (2026-11-20) New (initial-bundle work): route-level React.lazy for all feature screens.
 */

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { loadClients, type ClientName } from '../data/client-source.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Component<T> = T extends ComponentType<any> ? T : never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Preloadable<T extends ComponentType<any>> = LazyExoticComponent<T> & { preload: () => Promise<void> };

/**
 * `lazy` for one named export of a screen module (the app imports screens by name, not default). `preload()` fetches
 * the same chunk (and clients) ahead of the render, so the first route does not wait for it after the shell is up.
 */
function screen<M, K extends keyof M>(
  load: () => Promise<M>, name: K, clients: readonly ClientName[] = [],
): Preloadable<Component<M[K]>> {
  const fetchAll = () => Promise.all([load(), loadClients(clients)]);
  const lazyScreen = lazy(async () => {
    const [mod] = await fetchAll();
    return { default: mod[name] as Component<M[K]> };
  });
  return Object.assign(lazyScreen, { preload: () => fetchAll().then(() => undefined, () => undefined) });
}

export const S1Delivery = screen(() => import('./S1HomeSafety.tsx'), 'S1Delivery');
export const S1Detail = screen(() => import('./S1HomeSafety.tsx'), 'S1Detail');
export const S1List = screen(() => import('./S1HomeSafety.tsx'), 'S1List');
export const S1Source = screen(() => import('./S1HomeSafety.tsx'), 'S1Source');
export const S2Overview = screen(() => import('./S2Overview.tsx'), 'S2Overview');
export const VisitorFrontCounter = screen(() => import('./VisitorFrontCounter.tsx'), 'VisitorFrontCounter', ['frontCounter', 'lookups']);
export const S3Tree = screen(() => import('./S3Properties.tsx'), 'S3Tree');
export const S3Unit = screen(() => import('./S3Properties.tsx'), 'S3Unit');
export const S4Cases = screen(() => import('./S4Cases.tsx'), 'S4Cases');
export const S5Detail = screen(() => import('./S5Notices.tsx'), 'S5Detail');
export const S5List = screen(() => import('./S5Notices.tsx'), 'S5List');
export const S5Outstanding = screen(() => import('./S5Notices.tsx'), 'S5Outstanding');
export const ActConfirm = screen(() => import('./S5NoticesWrite.tsx'), 'ActConfirm');
export const ActRecorded = screen(() => import('./S5NoticesWrite.tsx'), 'ActRecorded');
export const ComposeForm = screen(() => import('./S5NoticesWrite.tsx'), 'ComposeForm');
export const DocumentsDetail = screen(() => import('./Documents.tsx'), 'DocumentsDetail');
export const DocumentsList = screen(() => import('./Documents.tsx'), 'DocumentsList');
export const ParkCoreLink = screen(() => import('./ParkCoreLink.tsx'), 'ParkCoreLink');
export const ResidentsDetail = screen(() => import('./Residents.tsx'), 'ResidentsDetail');
export const ResidentsList = screen(() => import('./Residents.tsx'), 'ResidentsList');
export const HouseholdsDetail = screen(() => import('./Households.tsx'), 'HouseholdsDetail');
export const HouseholdsList = screen(() => import('./Households.tsx'), 'HouseholdsList');
export const HelpDeskDetail = screen(() => import('./HelpDesk.tsx'), 'HelpDeskDetail');
export const HelpDeskQueue = screen(() => import('./HelpDesk.tsx'), 'HelpDeskQueue');
export const PortalTicketStaffDetail = screen(() => import('./PortalTicketsPanel.tsx'), 'PortalTicketStaffDetail');
export const AdminUsersDetail = screen(() => import('./AdminUsers.tsx'), 'AdminUsersDetail');
export const AdminUsersList = screen(() => import('./AdminUsers.tsx'), 'AdminUsersList');
export const AdminGroupsDetail = screen(() => import('./AdminGroups.tsx'), 'AdminGroupsDetail');
export const AdminGroupsList = screen(() => import('./AdminGroups.tsx'), 'AdminGroupsList');
export const AdminRolesMatrix = screen(() => import('./AdminRoles.tsx'), 'AdminRolesMatrix');
export const AdminEmailConfigForm = screen(() => import('./AdminEmail.tsx'), 'AdminEmailConfigForm');
export const AdminListsScreen = screen(() => import('./AdminLists.tsx'), 'AdminListsScreen', ['frontCounter', 'lookups']);
export const AdminAuditList = screen(() => import('./AdminAudit.tsx'), 'AdminAuditList', ['audit']);
export const IntegrationStatusDetail = screen(() => import('./IntegrationStatus.tsx'), 'IntegrationStatusDetail', ['integration']);
export const IntegrationStatusList = screen(() => import('./IntegrationStatus.tsx'), 'IntegrationStatusList', ['integration']);
export const BookingsList = screen(() => import('./Bookings.tsx'), 'BookingsList');
export const BookingCalendar = screen(() => import('./BookingCalendar.tsx'), 'BookingCalendar');
export const BookingCheckin = screen(() => import('./BookingCheckin.tsx'), 'BookingCheckin');
export const BookingFacilitiesDetail = screen(() => import('./BookingFacilities.tsx'), 'BookingFacilitiesDetail');
export const BookingFacilitiesList = screen(() => import('./BookingFacilities.tsx'), 'BookingFacilitiesList');
export const BookingRates = screen(() => import('./BookingRates.tsx'), 'BookingRates');
export const Reports = screen(() => import('./Reports.tsx'), 'Reports');
export const ChargesDetail = screen(() => import('./Charges.tsx'), 'ChargesDetail');
export const ChargesList = screen(() => import('./Charges.tsx'), 'ChargesList');
export const PaymentsDetail = screen(() => import('./Payments.tsx'), 'PaymentsDetail');
export const PaymentsList = screen(() => import('./Payments.tsx'), 'PaymentsList');
export const RefundsDetail = screen(() => import('./Refunds.tsx'), 'RefundsDetail');
export const RefundsList = screen(() => import('./Refunds.tsx'), 'RefundsList');
export const VisitorLogList = screen(() => import('./VisitorLog.tsx'), 'VisitorLogList', ['frontCounter', 'lookups']);
export const ChainHost = screen(() => import('./ChainHost.tsx'), 'ChainHost');

/** The screens each route renders; `preloadScreen` fetches them before the first render so no route starts blank. */
const ROUTE_SCREENS: Record<string, readonly { preload: () => Promise<void> }[]> = {
  s1: [S1List, S1Detail, S1Delivery, S1Source],
  s2: [S2Overview],
  s3: [S3Tree, S3Unit],
  s4: [S4Cases],
  s5: [S5List],
  s5detail: [S5Detail],
  s5ack: [S5Outstanding],
  s5compose: [ComposeForm, ActRecorded],
  s5act: [ActConfirm, ActRecorded],
  visitorLog: [VisitorLogList],
  visitorRegister: [VisitorLogList],
  visitorCounter: [VisitorFrontCounter],
  bookings: [BookingsList],
  bookingsDetail: [BookingsList],
  bookingCalendar: [BookingCalendar],
  bookingCheckin: [BookingCheckin],
  bookingFacilities: [ChainHost, BookingFacilitiesList],
  bookingFacilitiesDetail: [ChainHost, BookingFacilitiesList, BookingFacilitiesDetail],
  bookingRates: [BookingRates],
  reports: [Reports],
  charges: [ChainHost, ChargesList],
  chargesDetail: [ChainHost, ChargesList, ChargesDetail],
  payments: [ChainHost, PaymentsList],
  paymentsDetail: [ChainHost, PaymentsList, PaymentsDetail],
  refunds: [ChainHost, RefundsList],
  refundsDetail: [ChainHost, RefundsList, RefundsDetail],
  households: [ChainHost, HouseholdsList],
  householdsDetail: [ChainHost, HouseholdsList, HouseholdsDetail],
  residents: [ChainHost, ResidentsList],
  residentsDetail: [ChainHost, ResidentsList, ResidentsDetail],
  helpdesk: [ChainHost, HelpDeskQueue],
  helpdeskDetail: [ChainHost, HelpDeskQueue, HelpDeskDetail, PortalTicketStaffDetail],
  adminUsers: [ChainHost, AdminUsersList],
  adminUsersDetail: [ChainHost, AdminUsersList, AdminUsersDetail],
  adminGroups: [ChainHost, AdminGroupsList],
  adminGroupsDetail: [ChainHost, AdminGroupsList, AdminGroupsDetail],
  adminRoles: [AdminRolesMatrix],
  adminEmail: [AdminEmailConfigForm],
  adminLists: [AdminListsScreen],
  adminAudit: [AdminAuditList],
  integrationStatus: [IntegrationStatusList],
  integrationStatusDetail: [IntegrationStatusDetail],
  carPark: [ParkCoreLink],
  documents: [DocumentsList],
  documentsDetail: [DocumentsDetail],
};

/** Start fetching the screen chunks a route renders. Resolves when they are in (never rejects). */
export function preloadScreen(screenId: string): Promise<void> {
  return Promise.all((ROUTE_SCREENS[screenId] ?? []).map((c) => c.preload())).then(() => undefined);
}
