/**
 * The app: resolve (screen, state, locale) from the URL and render it.
 *
 * No router dependency. Fixture states are pure functions of corpus data, so
 * the whole fixture application state is URL parameters — a state is
 * CONSTRUCTED, never driven to by clicking.
 *
 * Live mode is the same idea, switched on by `source=live`. Default remains
 * the corpus / page fixtures. Live wires GET /scope, GET /properties/tree,
 * notices (UI-051), Help desk queue/contact reads, strata charges/payments,
 * and SMTP sends (invoice, admin test, notice email).
 * Residents / visitors / households stay on fixtures. Live reads must
 * fail honestly (problem / offline) — never invent empty trees.
 *
 * WRITES ARE NEVER OPTIMISTIC. An act is confirmed, sent through the act client,
 * and the RESPONSE decides the next route: a recorded act navigates to its
 * recorded state (fixture mode) or to the notice fetched again (live mode); a
 * refusal renders the Problem by type where the form stood; offline renders
 * offline. Nothing the client holds is changed by pressing a button.
 */

import { startTransition, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { fixtures, lazyFixtures, loadFixtures } from './data/fixture-gate.ts';
import { setLocationTree } from './data/host-label.ts';
import { setClientSource } from './data/client-source.ts';
import { SCREENS, statesFor, type ScreenId } from './data/states.ts';
import type { LiveManagementClient, LiveResult } from './data/live-client.ts';
import { createCancellableLoader } from './data/live-scope-load.ts';

import type { HelpdeskContactDetail } from './data/helpdesk-fixtures.ts';
import type { HelpdeskQueueView } from './data/helpdesk-live.ts';
import type { ChargeReceipt, LiveChargeRow, NoticeEmailDeliveryResponse, PaymentListResponse } from './data/strata-live.ts';
import { liveBaseUrl, readLiveConfig, writeLiveConfig, stripTokenFromLocation, type LiveConfig } from './data/live-config.ts';
import { readResidentId, writeResidentId } from './shell/resident-param.ts';
import {
  isModuleLicensed,
  readLicensedModules,
  writeLicensedModules,
  type PlatformModuleId,
} from './data/module-license.ts';
import type { ActResult, NoticeActClient } from './data/notice-client.ts';
import { DEFAULT_LOCALE, isLocale, t, type Locale, type LocalizedText, bcp47 } from './i18n/locale.ts';
import { MESSAGES } from './i18n/messages.ts';
import { Shell } from './shell/Shell.tsx';
import { BootFailure, ScreenErrorBoundary } from './shell/LoadFailure.tsx';
import { Loading, NoFixture, Offline, ProblemState } from './components/StateNotice.tsx';
import { ComingSoon } from './screens/ComingSoon.tsx';
import { SignedOut } from './screens/SignedOut.tsx';
import { deniedNavItems } from './shell/nav-access.ts';
import { isIntegrationVariant } from './integration/variants.ts';
import {
  NAV_TO_SCREEN, SCREEN_TO_NAV, findNavLabel, resolveAppScreen, type NavItemId,
} from './data/nav-ia.ts';
import type {
  CaseListResponse, ComposeNoticeRequest, NoticeActResponse, NoticeOutstandingResponse,
  NoticeTransition, NoticeTransitionRequest, OverviewResponse, Problem, PropertyTreeResponse,
  SafetyEventDeliveryResponse, SafetyEventDetailResponse, SafetyEventListResponse,
  SafetyEventSourceResponse, ScopeRef, ScopeTreeNode, ScopeTreeResponse, StaffNoticeDetailResponse,
  StaffNoticeListResponse, UnitDetailResponse,
  ResidentDetailResponse, ResidentListResponse,
  HouseholdDetailResponse, HouseholdListResponse,
  AdminUserListResponse, AdminUserDetailResponse,
  AdminGroupListResponse, AdminGroupDetailResponse,
  AdminRolesMatrixResponse,
} from './data/types.ts';
import { NOTICE_TRANSITIONS } from './data/types.ts';
import {
  buildRailNodes,
  findRailNode,
  parseFocusParam,
  pathForFocus,
} from './shell/scope-focus.ts';
import type { NodeKey } from './screens/tree-collapse.ts';
import {
  NAV_COLLAPSED_PARAM,
  SCOPE_COLLAPSED_PARAM,
  readRailCollapsed,
  writeRailCollapsed,
} from './shell/rail-persist.ts';
import { readSignedIn, writeSession } from './shell/session.ts';
import { CHAIN_LIST_OF, isChainScreen } from './screens/chain-screens.ts';
import type { ChainView } from './screens/ChainHost.tsx';
import { isPortalTicketId } from './screens/portal-ticket-id.ts';
import {
  ActConfirm, ActRecorded, AdminAuditList, AdminEmailConfigForm, AdminGroupsDetail, AdminGroupsList, AdminListsScreen, AdminRolesMatrix, AdminUsersDetail, AdminUsersList, BookingCalendar, BookingCheckin, BookingFacilitiesDetail, BookingFacilitiesList, BookingRates, BookingsList, ChainHost, ChargesDetail, ChargesList, ComposeForm, DocumentsDetail, DocumentsList, HelpDeskDetail, HelpDeskQueue, HouseholdsDetail, HouseholdsList, IntegrationStatusDetail, IntegrationStatusList, ParkCoreLink, PaymentsDetail, PaymentsList, PortalTicketStaffDetail, RefundsDetail, RefundsList, Reports, ResidentsDetail, ResidentsList, S1Delivery, S1Detail, S1List, S1Source, S2Overview, S3Tree, S3Unit, S4Cases, S5Detail, S5List, S5Outstanding, VisitorFrontCounter, VisitorLogList,
  preloadScreen,
} from './screens/lazy-screens.ts';

// The corpus is proven genuine before anything renders. On this surface absent
// data is indistinguishable from the empty state, so the app refuses to start
// rather than rendering plausible nothing.
/**
 * The scope response. Two fixtures exist and they differ in the way that
 * matters: `default` grants at ESTATE level, `portfolio-grant` grants at
 * PORTFOLIO level — the form a scope check descends from, per the manifest note.
 * Since 2.1.0 they also differ in WHERE composeNotice is permitted, which is
 * what the compose entry renders from.
 */
/** The two scope fixtures; named here so reading the URL never needs the corpus. */
const SCOPE_IDS = ['default', 'portfolio-grant'] as const;
let scopesCache: Record<string, ScopeTreeResponse> | null = null;
const scopes = (): Record<string, ScopeTreeResponse> => (scopesCache ??= {
  default: fixtures().CORPUS['scope/default.json'] as ScopeTreeResponse,
  'portfolio-grant': fixtures().CORPUS['scope/portfolio-grant.json'] as ScopeTreeResponse,
});

interface Route extends LiveConfig {
  /** Existing screen id, or `'stub'` for Coming Soon nav targets. */
  screen: ScreenId | 'stub';
  /** Design nav id for rail active state (and stub title). */
  navId: string;
  state: string;
  locale: Locale;
  scope: string;
  /** Fixture licensed modules. Absent `modules` means PEMO + ParkCore. */
  licensedModules: readonly PlatformModuleId[];
  /** The notice the detail, outstanding and act screens address. URL-carried. */
  notice?: string | undefined;
  /** The scope node a compose was entered from, as `kind:id`. URL-carried. */
  node?: string | undefined;
  /** Current viewing place in the properties tree, as `kind:id`. URL-carried. */
  at?: string | undefined;
  /** Main nav collapsed to icons-only. URL-carried; absent means expanded. */
  navCollapsed: boolean;
  /** Properties tree collapsed to a thin strip. URL-carried; absent means expanded. */
  scopeCollapsed: boolean;
  /** Fixture session. Absent `session` means signed in as the demo account. */
  signedIn: boolean;
  /** List filter from Overview drill-down (open | active | unknown-state). URL-carried. */
  filter?: string | undefined;
  /** Resident id for residentsDetail. URL-carried. */
  resident?: string | undefined;
  /** Household id for householdsDetail. URL-carried. */
  household?: string | undefined;
  /** Visitor id for visitorLog detail. URL-carried. */
  visitor?: string | undefined;
  /** Help desk contact id for helpdeskDetail. URL-carried. */
  contact?: string | undefined;
  /** Staff id for adminUsersDetail. URL-carried. */
  user?: string | undefined;
  /** Group id for adminGroupsDetail. URL-carried. */
  group?: string | undefined;
  /** Booking id for bookingsDetail. URL-carried. */
  booking?: string | undefined;
  /** Facility id for bookingFacilitiesDetail. URL-carried. */
  facility?: string | undefined;
  /** Charge id for chargesDetail. URL-carried. */
  charge?: string | undefined;
  /** Payment id for paymentsDetail. URL-carried. */
  payment?: string | undefined;
  /** Refund id for refundsDetail. URL-carried. */
  refund?: string | undefined;
  /** Document id for documentsDetail. URL-carried. */
  document?: string | undefined;
  /** System reference for integrationStatusDetail. URL-carried. */
  system?: string | undefined;
}

function readRoute(): Route {
  const q = new URLSearchParams(window.location.search);
  const live = readLiveConfig(q);
  stripTokenFromLocation(window.location, window.history);
  const resolved = resolveAppScreen(q.get('screen'));
  const langParam = q.get('lang');
  const scopeParam = q.get('scope');
  if (resolved.kind === 'stub') {
    return {
      screen: 'stub',
      navId: resolved.navId,
      state: 'default',
      locale: isLocale(langParam) ? langParam : DEFAULT_LOCALE,
      scope: scopeParam && (SCOPE_IDS as readonly string[]).includes(scopeParam) ? scopeParam : 'default',
      notice: q.get('notice') ?? undefined,
      node: q.get('node') ?? undefined,
      at: q.get('at') ?? undefined,
      filter: q.get('filter') ?? undefined,
      resident: readResidentId(q),
      household: q.get('household') ?? undefined,
      visitor: q.get('visitor') ?? undefined,
      contact: q.get('contact') ?? undefined,
      user: q.get('user') ?? undefined,
      group: q.get('group') ?? undefined,
      booking: q.get('booking') ?? undefined,
      facility: q.get('facility') ?? undefined,
      charge: q.get('charge') ?? undefined,
      payment: q.get('payment') ?? undefined,
      refund: q.get('refund') ?? undefined,
      document: q.get('document') ?? undefined,
      system: q.get('system') ?? undefined,
      navCollapsed: readRailCollapsed(q, NAV_COLLAPSED_PARAM),
      scopeCollapsed: readRailCollapsed(q, SCOPE_COLLAPSED_PARAM),
      signedIn: readSignedIn(q),
      licensedModules: readLicensedModules(q),
      ...live,
    };
  }
  const screen = resolved.screen;
  const known = statesFor(screen).map((s) => s.id);
  const stateParam = q.get('state');
  const state = stateParam && known.includes(stateParam) ? stateParam : (known[0] as string);
  return {
    screen,
    navId: SCREEN_TO_NAV[screen] ?? 'overview',
    state,
    locale: isLocale(langParam) ? langParam : DEFAULT_LOCALE,
    scope: scopeParam && (SCOPE_IDS as readonly string[]).includes(scopeParam) ? scopeParam : 'default',
    notice: q.get('notice') ?? undefined,
    node: q.get('node') ?? undefined,
    at: q.get('at') ?? undefined,
    filter: q.get('filter') ?? undefined,
    resident: readResidentId(q),
    household: q.get('household') ?? undefined,
    visitor: q.get('visitor') ?? undefined,
    contact: q.get('contact') ?? undefined,
    user: q.get('user') ?? undefined,
    group: q.get('group') ?? undefined,
    booking: q.get('booking') ?? undefined,
    facility: q.get('facility') ?? undefined,
    charge: q.get('charge') ?? undefined,
    payment: q.get('payment') ?? undefined,
    refund: q.get('refund') ?? undefined,
    document: q.get('document') ?? undefined,
    system: q.get('system') ?? undefined,
    navCollapsed: readRailCollapsed(q, NAV_COLLAPSED_PARAM),
    scopeCollapsed: readRailCollapsed(q, SCOPE_COLLAPSED_PARAM),
    signedIn: readSignedIn(q),
    licensedModules: readLicensedModules(q),
    ...live,
  };
}

/** The screen the address names and whether it is live, read without touching the corpus; main.tsx fetches that screen's chunks while the corpus loads (fixture mode only). */
export const initialRoute = (): { screen: string; live: boolean } => {
  const r = readRoute();
  return { screen: r.screen, live: r.live };
};
export { preloadScreen };

function writeRoute(r: Route): void {
  const screenParam = r.screen === 'stub' ? r.navId : r.screen;
  const q = new URLSearchParams({ screen: screenParam, state: r.state, lang: r.locale, scope: r.scope });
  if (r.notice) q.set('notice', r.notice);
  if (r.node) q.set('node', r.node);
  if (r.at) q.set('at', r.at);
  if (r.filter) q.set('filter', r.filter);
  writeResidentId(q, r.resident);
  if (r.household) q.set('household', r.household);
  if (r.visitor) q.set('visitor', r.visitor);
  if (r.contact) q.set('contact', r.contact);
  if (r.user) q.set('user', r.user);
  if (r.group) q.set('group', r.group);
  if (r.booking) q.set('booking', r.booking);
  if (r.facility) q.set('facility', r.facility);
  if (r.charge) q.set('charge', r.charge);
  if (r.payment) q.set('payment', r.payment);
  if (r.refund) q.set('refund', r.refund);
  if (r.document) q.set('document', r.document);
  if (r.system) q.set('system', r.system);
  writeRailCollapsed(q, NAV_COLLAPSED_PARAM, r.navCollapsed);
  writeRailCollapsed(q, SCOPE_COLLAPSED_PARAM, r.scopeCollapsed);
  writeSession(q, r.signedIn);
  writeLiveConfig(q, r);
  writeLicensedModules(q, r.licensedModules);
  window.history.replaceState(null, '', `?${q.toString()}`);
}

const nodeKey = (ref: ScopeRef): string => `${ref.kind}:${ref.id}`;

/** Resolve the URL's `node=kind:id` against a scope response, if it names one. */
function resolveNode(param: string | undefined, scope: ScopeTreeResponse | null, tree: PropertyTreeResponse | null): { ref: ScopeRef; label: string } | null {
  if (!param) return null;
  // The tree is the node picker (UI-051 G6): a floor or unit is named there and
  // nowhere in the scope response, so the tree on show (fixture or live) is consulted first.
  const found = tree?.nodes.find((n) => nodeKey(n.node) === param) ?? scope?.nodes.find((n) => nodeKey(n.node) === param);
  if (found) return { ref: found.node, label: found.label.en };
  const [kind, ...rest] = param.split(':');
  const id = rest.join(':');
  if (!kind || !id) return null;
  return { ref: { kind: kind as ScopeRef['kind'], id }, label: id };
}

const isTransition = (s: string): s is NoticeTransition =>
  (NOTICE_TRANSITIONS as readonly string[]).includes(s);

/* --------------------------------------------------------------- outcomes */

/** What an act came back with, rendered where the form stood. */
function ActOutcome({ outcome, locale }: { outcome: ActResult | null; locale: Locale }) {
  if (!outcome) return null;
  if (outcome.kind === 'offline') return <Offline locale={locale} />;
  if (outcome.kind === 'problem') return <ProblemState problem={outcome.problem} locale={locale} />;
  return null;
}

interface Handlers {
  onOpen: (id: string) => void;
  onOpenResident: (id: string) => void;
  onBackToResidents: () => void;
  onOpenHousehold: (id: string) => void;
  onBackToHouseholds: () => void;
  onOutstanding: (id: string) => void;
  onAct: (noticeId: string, op: NoticeTransition) => void;
  onCompose: (node: ScopeTreeNode) => void;
  onGoToTree: () => void;
  onCounterClick: Partial<Record<string, () => void>>;
  onSubmitCompose: (body: ComposeNoticeRequest, clientKey: string) => void;
  onConfirm: (op: NoticeTransition, noticeId: string, body: NoticeTransitionRequest) => void;
  onBackToNotice: () => void;
  onBackToList: () => void;
  onOpenVisitor: (visitorId: string) => void;
  onVisitorRegister: () => void;
  onCounterTab: (tab: 'walk-in' | 'pass') => void;
  onBackToVisitorLog: () => void;
  onOpenHelpdesk: (contactId: string) => void;
  onBackToHelpdesk: () => void;
  onOpenUser: (staffId: string) => void;
  onBackToUsers: () => void;
  onOpenGroup: (groupId: string) => void;
  onBackToGroups: () => void;
  onOpenBooking: (bookingId: string) => void;
  onBackToBookings: () => void;
  onBookingView: (view: 'list' | 'calendar') => void;
  onOpenFacility: (facilityId: string) => void;
  onBackToFacilities: () => void;
  onOpenCharge: (chargeId: string) => void;
  onBackToCharges: () => void;
  onOpenPayment: (paymentId: string) => void;
  onBackToPayments: () => void;
  onOpenRefund: (refundId: string) => void;
  onBackToRefunds: () => void;
  onOpenDocument: (documentId: string) => void;
  onBackToDocuments: () => void;
  onOpenSystem: (systemRef: string) => void;
  onBackToIntegration: () => void;
}

/** Title of each screen the pop-up host shows or sits over. */
const CHAIN_TITLES: Partial<Record<ScreenId, LocalizedText>> = {
  charges: MESSAGES.finance.chargesListTitle,
  chargesDetail: MESSAGES.finance.chargeDetailTitle,
  payments: MESSAGES.finance.paymentsListTitle,
  paymentsDetail: MESSAGES.finance.paymentDetailTitle,
  refunds: MESSAGES.finance.refundsListTitle,
  refundsDetail: MESSAGES.finance.refundDetailTitle,
  households: MESSAGES.households.listTitle,
  householdsDetail: MESSAGES.households.detailTitle,
  residents: MESSAGES.residents.listTitle,
  residentsDetail: MESSAGES.residents.detailTitle,
  bookingFacilities: MESSAGES.booking.facilitiesTitle,
  bookingFacilitiesDetail: MESSAGES.booking.facilityDetailTitle,
  helpdesk: MESSAGES.helpdesk.listTitle,
  helpdeskDetail: MESSAGES.helpdesk.detailTitle,
  adminUsers: MESSAGES.admin.usersListTitle,
  adminUsersDetail: MESSAGES.admin.usersDetailTitle,
  adminGroups: MESSAGES.admin.groupsListTitle,
  adminGroupsDetail: MESSAGES.admin.groupsDetailTitle,
};

function FixtureView({
  route, scope, handlers, outcome, busy, focusKey, focusNode, tree,
}: {
  route: Omit<Route, 'screen'> & { screen: ScreenId };
  scope: ScopeTreeResponse | null;
  handlers: Handlers;
  outcome: ActResult | null;
  busy: boolean;
  focusKey: NodeKey | null;
  focusNode: ScopeTreeNode | null;
  tree: PropertyTreeResponse | null;
}) {
  const { screen, state, locale } = route;
  // Read through `F`: a screen that renders from none of the corpora (most live-mode screens) never fetches them.
  const F = lazyFixtures();
  const entry = statesFor(screen).find((s) => s.id === state);
  if (!entry) return <NoFixture locale={locale} />;

  if (entry.kind === 'client-only') {
    return entry.id === 'loading' ? <Loading locale={locale} /> : <Offline locale={locale} />;
  }

  if (entry.kind === 'no-fixture') {
    return <NoFixture locale={locale} missing={entry.missing} />;
  }

  // COMMON problem fixtures (error / session-expired / invalid-credential /
  // denied) belong to every screen, including page-fixture surfaces that
  // otherwise short-circuit before CORPUS. Render the Problem, not the page.
  if (entry.kind === 'problem' && entry.file) {
    const problem = (F.CORPUS[entry.file] ?? F.RESIDENTS_CORPUS[entry.file] ?? F.HOUSEHOLDS_CORPUS[entry.file] ?? F.ADMIN_DIRECTORY_CORPUS[entry.file] ?? F.NOTICES_WFG_CORPUS[entry.file]) as Problem | undefined;
    if (problem) return <ProblemState problem={problem} locale={locale} />;
    return <NoFixture locale={locale} missing={entry.missing} />;
  }

  // Visitors P0 — page fixtures (no contract operation / CORPUS entry).
  if (screen === 'visitorLog' || screen === 'visitorRegister') {
    return (
      <VisitorLogList
        locale={locale}
        onOpen={handlers.onOpenVisitor}
        onRegister={handlers.onVisitorRegister}
        onFrontCounter={() => handlers.onCounterTab('pass')}
        invitationOpen={screen === 'visitorRegister'}
        detailId={screen === 'visitorLog' && state === 'detail' ? (route.visitor ?? '') : null}
        onCloseDialog={handlers.onBackToVisitorLog}
      />
    );
  }
  if (screen === 'visitorCounter') {
    return <VisitorFrontCounter locale={locale} tab={state === 'pass' ? 'pass' : 'walk-in'} onTab={handlers.onCounterTab} scope={scope} />;
  }
  if (screen === 'bookings') {
    return <BookingsList locale={locale} onOpen={handlers.onOpenBooking} focusKey={focusKey} onView={handlers.onBookingView} />;
  }
  if (screen === 'bookingsDetail') {
    return (
      <BookingsList
        locale={locale}
        onOpen={handlers.onOpenBooking}
        focusKey={focusKey}
        onView={handlers.onBookingView}
        detailId={route.booking ?? ''}
        onCloseDetail={handlers.onBackToBookings}
      />
    );
  }
  if (screen === 'bookingCalendar') {
    return <BookingCalendar locale={locale} onView={handlers.onBookingView} />;
  }
  if (screen === 'bookingCheckin') {
    return <BookingCheckin locale={locale} onOpen={handlers.onOpenBooking} />;
  }
  if (screen === 'bookingFacilities') {
    return <BookingFacilitiesList locale={locale} onOpen={handlers.onOpenFacility} />;
  }
  if (screen === 'bookingFacilitiesDetail') {
    return (
      <BookingFacilitiesDetail
        facilityId={route.facility ?? ''}
        locale={locale}
        onBack={handlers.onBackToFacilities}
      />
    );
  }
  if (screen === 'bookingRates') {
    return <BookingRates locale={locale} />;
  }
  if (screen === 'reports') {
    return <Reports locale={locale} initialMetric={state === 'drill' ? 'tenancies-active' : null} />;
  }
  if (screen === 'charges') {
    return (
      <ChargesList
        locale={locale}
        onOpen={handlers.onOpenCharge}
        onOpenHousehold={handlers.onOpenHousehold}
        focusKey={focusKey}
      />
    );
  }
  if (screen === 'chargesDetail') {
    return (
      <ChargesDetail
        chargeId={route.charge ?? ''}
        locale={locale}
        onBack={handlers.onBackToCharges}
        onOpenHousehold={handlers.onOpenHousehold}
        onOpenPayment={handlers.onOpenPayment}
      />
    );
  }
  if (screen === 'payments') {
    return <PaymentsList locale={locale} onOpen={handlers.onOpenPayment} focusKey={focusKey} />;
  }
  if (screen === 'paymentsDetail') {
    return (
      <PaymentsDetail
        paymentId={route.payment ?? ''}
        locale={locale}
        onBack={handlers.onBackToPayments}
        onOpenCharge={handlers.onOpenCharge}
      />
    );
  }
  if (screen === 'refunds') {
    return <RefundsList locale={locale} onOpen={handlers.onOpenRefund} focusKey={focusKey} />;
  }
  if (screen === 'refundsDetail') {
    return (
      <RefundsDetail
        refundId={route.refund ?? ''}
        locale={locale}
        onBack={handlers.onBackToRefunds}
        onOpenHousehold={handlers.onOpenHousehold}
        onOpenCharge={handlers.onOpenCharge}
      />
    );
  }
  if (screen === 'adminEmail') {
    return <AdminEmailConfigForm locale={locale} />;
  }
  if (screen === 'adminLists') {
    return <AdminListsScreen locale={locale} />;
  }
  if (screen === 'adminAudit') {
    return <AdminAuditList locale={locale} />;
  }
  if (screen === 'integrationStatus') {
    return <IntegrationStatusList locale={locale} variant={isIntegrationVariant(state) ? state : 'list'} onOpen={handlers.onOpenSystem} />;
  }
  if (screen === 'integrationStatusDetail') {
    return <IntegrationStatusDetail locale={locale} systemRef={route.system ?? 'sys_wfg_intercom'} onBack={handlers.onBackToIntegration} />;
  }
  if (screen === 'carPark') {
    return <ParkCoreLink locale={locale} />;
  }
  if (screen === 'documents') {
    return (
      <DocumentsList
        locale={locale}
        onOpen={handlers.onOpenDocument}
        focusKey={focusKey}
        empty={state === 'empty'}
      />
    );
  }
  if (screen === 'documentsDetail') {
    return (
      <DocumentsDetail
        documentId={route.document ?? ''}
        locale={locale}
        onBack={handlers.onBackToDocuments}
        onOpenNotice={handlers.onOpen}
      />
    );
  }
  if (screen === 'helpdesk') {
    return (
      <HelpDeskQueue
        locale={locale}
        onOpen={handlers.onOpenHelpdesk}
        empty={state === 'empty'}
        partial={state === 'partial'}
        filter={route.filter}
        focusNode={focusNode}
      />
    );
  }
  if (screen === 'helpdeskDetail') {
    const contactId = route.contact ?? '';
    if (isPortalTicketId(contactId)) {
      return (
        <PortalTicketStaffDetail
          ticketId={contactId}
          locale={locale}
          onBack={handlers.onBackToHelpdesk}
        />
      );
    }
    return (
      <HelpDeskDetail
        contactId={contactId}
        locale={locale}
        onBack={handlers.onBackToHelpdesk}
      />
    );
  }
  if (screen === 'householdsDetail') {
    if (entry.kind === 'problem' && entry.file) {
      const problem = (F.CORPUS[entry.file] ?? F.RESIDENTS_CORPUS[entry.file] ?? F.HOUSEHOLDS_CORPUS[entry.file]) as Problem | undefined;
      if (problem) return <ProblemState problem={problem} locale={locale} />;
      return <NoFixture locale={locale} missing={entry.missing} />;
    }
    return (
      <HouseholdsDetail
        householdId={route.household ?? ''}
        locale={locale}
        onBack={handlers.onBackToHouseholds}
        onOpenResident={handlers.onOpenResident}
        data={
          entry.kind === 'fixture' && entry.file
            ? ((F.HOUSEHOLDS_CORPUS[entry.file] ?? F.CORPUS[entry.file]) as HouseholdDetailResponse | undefined)
            : undefined
        }
      />
    );
  }

  if (entry.kind === 'client-form' && screen === 's5compose') {
    // The author's own form before any request — the one write state no
    // response describes. Only compose has one; a transition starts from a notice.
    return (
      <ComposeForm initial={null} node={resolveNode(route.node, scope, tree)} locale={locale} onSubmit={handlers.onSubmitCompose} busy={busy}>
        <ActOutcome outcome={outcome} locale={locale} />
      </ComposeForm>
    );
  }

  const data = entry.file
    ? (F.CORPUS[entry.file] ?? F.RESIDENTS_CORPUS[entry.file] ?? F.HOUSEHOLDS_CORPUS[entry.file] ?? F.ADMIN_DIRECTORY_CORPUS[entry.file] ?? F.NOTICES_WFG_CORPUS[entry.file])
    : undefined;
  if (data === undefined) return <NoFixture locale={locale} missing={entry.missing} />;

  if (entry.kind === 'problem') {
    return <ProblemState problem={data as Problem} locale={locale} />;
  }

  switch (screen) {
    case 's1':
      if (state === 'detail') return <S1Detail data={data as SafetyEventDetailResponse} locale={locale} />;
      if (state === 'delivery') return <S1Delivery data={data as SafetyEventDeliveryResponse} locale={locale} />;
      if (state === 'source' || state === 'source-unmapped')
        return <S1Source data={data as SafetyEventSourceResponse} locale={locale} />;
      return <S1List data={data as SafetyEventListResponse} locale={locale} focusKey={focusKey} />;
    case 's2':
      return <S2Overview data={data as OverviewResponse} locale={locale} onCounterClick={handlers.onCounterClick} focusKey={focusKey} />;
    case 's3':
      return state === 'unit'
        ? <S3Unit data={data as UnitDetailResponse} locale={locale} onOpenHousehold={handlers.onOpenHousehold} />
        : <S3Tree data={data as PropertyTreeResponse} scope={scope} locale={locale} onCompose={handlers.onCompose} onOpenHousehold={handlers.onOpenHousehold} filter={route.filter === 'unknown-state' ? 'unknown-state' : undefined} focusKey={focusKey} />;
    case 's4':
      return <S4Cases data={data as CaseListResponse} locale={locale} filter={route.filter === 'open' ? 'open' : undefined} focusKey={focusKey} />;
    case 's5':
      return (
        <S5List
          data={data as StaffNoticeListResponse}
          locale={locale}
          onOpen={handlers.onOpen}
          onAct={handlers.onAct}
          onGoToTree={handlers.onGoToTree}
          filter={route.filter === 'active' ? 'active' : undefined}
          focusKey={focusKey}
          corpusLabel={state === 'wfg'}
        />
      );
    case 's5detail': {
      const wfgDetail = F.findWfgNoticeDetail(route.notice);
      return (
        <S5Detail
          data={(wfgDetail ?? data) as StaffNoticeDetailResponse}
          locale={locale}
          onAct={handlers.onAct}
          onOutstanding={handlers.onOutstanding}
          onOpenDocument={handlers.onOpenDocument}
        />
      );
    }
    case 's5ack': {
      const wfgAck = F.findWfgOutstanding(route.notice);
      return <S5Outstanding data={(wfgAck ?? data) as NoticeOutstandingResponse} locale={locale} onBack={handlers.onOpen} />;
    }
    case 's5compose':
      if (state === 'created') {
        return (
          <ActRecorded op="composeNotice" data={data as NoticeActResponse} locale={locale} corpusMode onOpen={handlers.onOpen} onBack={handlers.onBackToList} />
        );
      }
      // `prefilled`: the recorded request, field for field.
      return (
        <ComposeForm initial={data as ComposeNoticeRequest} node={resolveNode(route.node, scope, tree)} locale={locale} onSubmit={handlers.onSubmitCompose} busy={busy}>
          <ActOutcome outcome={outcome} locale={locale} />
        </ComposeForm>
      );
    case 'residents':
      return (
        <ResidentsList
          data={data as ResidentListResponse}
          locale={locale}
          onOpen={handlers.onOpenResident}
          focusKey={focusKey}
        />
      );
    case 'residentsDetail':
      return (
        <ResidentsDetail
          residentId={route.resident ?? ''}
          data={data as ResidentDetailResponse}
          locale={locale}
          onBack={handlers.onBackToResidents}
        />
      );
    case 'households':
      return (
        <HouseholdsList
          data={data as HouseholdListResponse}
          locale={locale}
          onOpen={handlers.onOpenHousehold}
          focusKey={focusKey}
        />
      );
    case 'adminUsers':
      return (
        <AdminUsersList
          data={data as AdminUserListResponse}
          locale={locale}
          onOpen={handlers.onOpenUser}
        />
      );
    case 'adminUsersDetail':
      return (
        <AdminUsersDetail
          staffId={route.user ?? ''}
          locale={locale}
          onBack={handlers.onBackToUsers}
          onOpenGroup={handlers.onOpenGroup}
          data={data as AdminUserDetailResponse}
        />
      );
    case 'adminGroups':
      return (
        <AdminGroupsList
          data={data as AdminGroupListResponse}
          locale={locale}
          onOpen={handlers.onOpenGroup}
        />
      );
    case 'adminGroupsDetail':
      return (
        <AdminGroupsDetail
          groupId={route.group ?? ''}
          locale={locale}
          onBack={handlers.onBackToGroups}
          onOpenUser={handlers.onOpenUser}
          data={data as AdminGroupDetailResponse}
          parkcoreLicensed={isModuleLicensed(route.licensedModules, 'parkcore')}
        />
      );
    case 'adminRoles':
      return <AdminRolesMatrix data={data as AdminRolesMatrixResponse} locale={locale} />;
    case 's5act': {
      const recorded = state.endsWith('-recorded');
      const verb = recorded ? state.slice(0, -'-recorded'.length) : state;
      const op = `${verb}Notice`;
      if (!isTransition(op)) return <NoFixture locale={locale} />;
      if (recorded) {
        return (
          <ActRecorded op={op} data={data as NoticeActResponse} locale={locale} corpusMode onOpen={handlers.onOpen} onBack={handlers.onBackToList} />
        );
      }
      const request = data as NoticeTransitionRequest;
      // The notice addressed: from the URL when the act was started from a notice,
      // otherwise the id the recorded response names — the recorded world's own.
      const noticeId = route.notice ?? (F.CORPUS[`notices/${verb}.json`] as NoticeActResponse).noticeId;
      return (
        <ActConfirm
          op={op}
          noticeId={noticeId}
          initial={request}
          locale={locale}
          busy={busy}
          onConfirm={(body) => handlers.onConfirm(op, noticeId, body)}
          onBack={handlers.onBackToNotice}
        >
          <ActOutcome outcome={outcome} locale={locale} />
        </ActConfirm>
      );
    }
  }
}

function livePanel<T>(result: LiveResult<T> | null, locale: Locale, whenLoaded: (data: T) => ReactNode) {
  if (result === null) return <Loading locale={locale} />;
  if (result.kind === 'offline') return <Offline locale={locale} />;
  if (result.kind === 'problem') return <ProblemState problem={result.problem} locale={locale} />;
  return whenLoaded(result.data);
}

export function App() {
  const [route, setRoute] = useState<Route>(() => readRoute());
  // A move to another screen is a transition: the screen on show stays until the next one's chunk has arrived.
  const setRouteT = useCallback((u: Parameters<typeof setRoute>[0]) => startTransition(() => setRoute(u)), []);
  const [liveScope, setLiveScope] = useState<LiveResult<ScopeTreeResponse> | null>(null);
  const [liveTree, setLiveTree] = useState<LiveResult<PropertyTreeResponse> | null>(null);
  const [liveList, setLiveList] = useState<LiveResult<StaffNoticeListResponse> | null>(null);
  const [liveDetail, setLiveDetail] = useState<LiveResult<StaffNoticeDetailResponse> | null>(null);
  const [liveAck, setLiveAck] = useState<LiveResult<NoticeOutstandingResponse> | null>(null);
  const [liveHelpdeskQueue, setLiveHelpdeskQueue] = useState<LiveResult<HelpdeskQueueView> | null>(null);
  const [liveHelpdeskContact, setLiveHelpdeskContact] = useState<LiveResult<HelpdeskContactDetail> | null>(null);
  const [liveCharges, setLiveCharges] = useState<LiveResult<readonly LiveChargeRow[]> | null>(null);
  const [liveCharge, setLiveCharge] = useState<LiveResult<{ charge: LiveChargeRow; receipts: readonly ChargeReceipt[] }> | null>(null);
  const [livePayments, setLivePayments] = useState<LiveResult<PaymentListResponse> | null>(null);
  const [liveNoticeEmail, setLiveNoticeEmail] = useState<LiveResult<NoticeEmailDeliveryResponse> | null>(null);
  const [liveTick, setLiveTick] = useState(0);
  const [sendNote, setSendNote] = useState<string | null>(null);
  /** The last act's outcome, shown where the form stood. Cleared on every navigation. */
  const [outcome, setOutcome] = useState<ActResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    writeRoute(route);
    document.documentElement.lang = bcp47(route.locale);
  }, [route]);

  useEffect(() => {
    setOutcome(null);
  }, [route.screen, route.state, route.notice]);

  // The rail's scope and tree are the page's, not a screen's: loaded once per live session (and when "Try again" is
  // pressed on the rail), not on every move between screens.
  const [railTick, setRailTick] = useState(0);
  const onRailRetry = useCallback(() => setRailTick((n) => n + 1), []);
  useEffect(() => {
    if (!route.live) { setLiveScope(null); setLiveTree(null); return; }
    let cancelled = false;
    const scopeLoad = createCancellableLoader<LiveResult<ScopeTreeResponse>>();
    const treeLoad = createCancellableLoader<LiveResult<PropertyTreeResponse>>();
    const ignoreAbort = (err: unknown): void => {
      if (err instanceof Error && err.name === 'AbortError') return;
      throw err;
    };
    setLiveScope(null);
    setLiveTree(null);
    void import('./data/live-client.ts').then(({ LiveManagementClient: Client }) => {
      if (cancelled) return;
      const client = new Client({ baseUrl: liveBaseUrl(route, window.location.origin), token: route.token });
      void scopeLoad.load((signal) => client.getScope(signal)).then((result) => {
        if (!cancelled) setLiveScope(result);
      }).catch(ignoreAbort);
      void treeLoad.load((signal) => client.getPropertyTree(signal)).then((result) => {
        if (!cancelled) setLiveTree(result);
      }).catch(ignoreAbort);
    });
    return () => { cancelled = true; scopeLoad.abort(); treeLoad.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.live, route.api, route.token, railTick]);

  useEffect(() => {
    if (!route.live) {
      setLiveList(null);
      setLiveDetail(null);
      setLiveAck(null);
      setLiveHelpdeskQueue(null);
      setLiveHelpdeskContact(null);
      setLiveCharges(null);
      setLiveCharge(null);
      setLivePayments(null);
      setLiveNoticeEmail(null);
      return;
    }
    let cancelled = false;
    const noticesLoad = createCancellableLoader<LiveResult<StaffNoticeListResponse>>();
    const ignoreAbort = (err: unknown): void => {
      if (err instanceof Error && err.name === 'AbortError') return;
      throw err;
    };
    setLiveList(null);
    setLiveDetail(null);
    setLiveAck(null);
    setLiveHelpdeskQueue(null);
    setLiveHelpdeskContact(null);
    setLiveCharges(null);
    setLiveCharge(null);
    setLivePayments(null);
    setLiveNoticeEmail(null);
    // The live client is only needed in live mode, so it is fetched here, not with the app shell.
    void import('./data/live-client.ts').then(({ LiveManagementClient: Client }) => {
      if (cancelled) return;
      const client = new Client({
        baseUrl: liveBaseUrl(route, window.location.origin),
        token: route.token,
      });
      if (route.screen === 's5') {
        void noticesLoad.load((signal) => client.listNotices(signal)).then((result) => {
          if (!cancelled) setLiveList(result);
        }).catch(ignoreAbort);
      }
      // The detail is fetched for the detail screen AND for a transition's confirm
      // step, whose fromVersion is the notice's current version and nothing else.
      if ((route.screen === 's5detail' || route.screen === 's5act') && route.notice) {
        void client.getNotice(route.notice).then((result) => {
          if (!cancelled) setLiveDetail(result);
        });
      }
      if (route.screen === 's5ack' && route.notice) {
        void client.getNoticeOutstanding(route.notice).then((result) => {
          if (!cancelled) setLiveAck(result);
        });
      }
      if (route.screen === 'helpdesk' || route.screen === 'helpdeskDetail') {
        void client.listHelpdeskQueue().then((result) => {
          if (!cancelled) setLiveHelpdeskQueue(result);
        });
      }
      if (route.screen === 'helpdeskDetail' && route.contact) {
        void client.getHelpdeskContact(route.contact).then((result) => {
          if (!cancelled) setLiveHelpdeskContact(result);
        });
      }
      if (route.screen === 'charges' || route.screen === 'chargesDetail') {
        void client.listCharges().then((result) => {
          if (!cancelled) setLiveCharges(result);
        });
      }
      if (route.screen === 'chargesDetail' && route.charge) {
        void client.getCharge(route.charge).then((result) => {
          if (!cancelled) {
            if (result.kind !== 'loaded') setLiveCharge(result);
            else setLiveCharge({ kind: 'loaded', data: { charge: result.data.charge, receipts: result.data.receipts } });
          }
        });
      }
      if (route.screen === 'payments' || route.screen === 'paymentsDetail') {
        void client.listPayments().then((result) => {
          if (!cancelled) setLivePayments(result);
        });
      }
      if (route.screen === 's5detail' && route.notice) {
        void client.getNoticeDelivery(route.notice).then((result) => {
          if (!cancelled) setLiveNoticeEmail(result);
        });
      }
    });
    return () => {
      cancelled = true;
      noticesLoad.abort();
    };
  }, [route.live, route.api, route.token, route.screen, route.state, route.notice, route.contact, route.charge, liveTick]);

  const [liveClient, setLiveClient] = useState<LiveManagementClient | null>(null);
  useEffect(() => {
    if (!route.live) { setLiveClient(null); return; }
    let current = true;
    void import('./data/live-client.ts').then(({ LiveManagementClient: Client }) => {
      if (current) setLiveClient(new Client({ baseUrl: liveBaseUrl(route, window.location.origin), token: route.token }));
    });
    return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.live, route.api, route.token]);

  // The Visitors front counter and the visitor log read the same client. No URL params: live when the
  // API answers (demo Bearer), the contract fixture when it does not. ?source=fixture forces the
  // fixture (tests); ?source=live forces live with the token given. Selecting is idempotent.
  const forcedFixture = useRef(new URLSearchParams(window.location.search).get('source') === 'fixture');
  // The managed lists, the audit log and the integration status follow the same source rule (Backend's endpoint when it
  // answers, the fixture when it does not). The client modules load with the screens that read them (client-source.ts).
  useMemo(
    () => setClientSource({
      mode: route.live ? 'live' : forcedFixture.current ? 'fixture' : 'auto',
      base: liveBaseUrl(route, window.location.origin),
      token: route.token,
    }),
    [route.live, route.api, route.token],
  );

  // Nav items whose own read the API refuses (403) are left out of the nav.
  const [deniedNav, setDeniedNav] = useState<ReadonlySet<NavItemId>>(() => new Set());
  useEffect(() => {
    let current = true;
    void deniedNavItems({
      mode: route.live ? 'live' : forcedFixture.current ? 'fixture' : 'auto',
      base: liveBaseUrl(route, window.location.origin),
      token: route.token,
    }).then((denied) => { if (current) setDeniedNav(denied); });
    return () => { current = false; };
  }, [route.live, route.api, route.token]);

  const noteFromSend = (result: LiveResult<{ status: string; transport: string; detail: string }>): string => {
    if (result.kind === 'loaded') return `${result.data.status} · ${result.data.transport} · ${result.data.detail}`;
    if (result.kind === 'problem') return result.problem.staffMessage?.en ?? result.problem.title;
    return 'offline';
  };

  const onNavigate = useCallback(
    (next: { screen?: ScreenId | undefined; state?: string | undefined; locale?: Locale | undefined }) => {
      setRouteT((prev) => {
        if (next.locale && next.screen === undefined && next.state === undefined) {
          return { ...prev, locale: next.locale };
        }
        const screen = (next.screen ?? (prev.screen === 'stub' ? 's2' : prev.screen)) as ScreenId;
        const fallback = statesFor(screen)[0]?.id ?? 'default';
        const state =
          next.state ?? (next.screen && next.screen !== prev.screen ? fallback : prev.state);
        const known = statesFor(screen).map((s) => s.id);
        const screenChanged = next.screen !== undefined && next.screen !== prev.screen;
        return {
          ...prev,
          screen,
          navId: SCREEN_TO_NAV[screen] ?? prev.navId,
          state: known.includes(state) ? state : fallback,
          locale: next.locale ?? prev.locale,
          ...(screenChanged ? { filter: undefined } : {}),
        };
      });
    },
    [],
  );

  const onNav = useCallback((id: NavItemId) => {
    const mapped = NAV_TO_SCREEN[id];
    if (mapped) {
      const fallback = statesFor(mapped)[0]?.id ?? 'default';
      setRouteT((prev) => ({
        ...prev,
        screen: mapped,
        navId: id,
        state: fallback,
        notice: undefined,
        node: undefined,
        filter: undefined,
        resident: undefined,
        household: undefined,
        visitor: undefined,
        contact: undefined,
        user: undefined,
        group: undefined,
        booking: undefined,
        facility: undefined,
        charge: undefined,
        payment: undefined,
        refund: undefined,
        document: undefined,
        system: undefined,
      }));
      return;
    }
    setRouteT((prev) => ({
      ...prev,
      screen: 'stub',
      navId: id,
      state: 'default',
      notice: undefined,
      node: undefined,
      filter: undefined,
      resident: undefined,
      household: undefined,
      visitor: undefined,
      contact: undefined,
      user: undefined,
      group: undefined,
      booking: undefined,
      facility: undefined,
      charge: undefined,
      payment: undefined,
      refund: undefined,
      document: undefined,
      system: undefined,
    }));
  }, []);

  const go = useCallback((patch: Partial<Route>) => setRouteT((prev) => {
    const next = { ...prev, ...patch };
    if (patch.screen && patch.screen !== 'stub') {
      next.navId = SCREEN_TO_NAV[patch.screen] ?? next.navId;
    }
    return next;
  }), []);

  /**
   * Opening a notice is a NAVIGATION, not a fetch: the URL is the state, so the
   * list hands the id to the URL and the detail screen renders from the corpus
   * (or, live, fetches it). The corpus carries one detail fixture, so in fixture
   * mode the id is carried for the address bar and the round-trip.
   */
  const handlers: Handlers = {
    onOpen: useCallback((noticeId: string) => go({ screen: 's5detail', state: 'detail', notice: noticeId }), [go]),
    onOutstanding: useCallback((noticeId: string) => go({ screen: 's5ack', state: 'outstanding', notice: noticeId }), [go]),
    // An act STARTS at its confirm state; the control that started it is gone
    // from the screen by the time anything could be sent.
    onAct: useCallback((noticeId: string, op: NoticeTransition) =>
      go({ screen: 's5act', state: op.replace(/Notice$/, ''), notice: noticeId }), [go]),
    onCompose: useCallback((node: ScopeTreeNode) =>
      go({ screen: 's5compose', state: 'blank', node: nodeKey(node.node) }), [go]),
    onGoToTree: useCallback(() => go({ screen: 's3', state: 'tree' }), [go]),
    onCounterClick: {
      'open-cases': () => go({ screen: 's4', state: 'default', filter: 'open', notice: undefined, node: undefined }),
      'safety-events-window': () => go({ screen: 's1', state: 'default', filter: undefined, notice: undefined, node: undefined }),
      'notices-active': () => go({ screen: 's5', state: 'wfg', filter: 'active', notice: undefined, node: undefined }),
      'units-unknown-state': () => go({ screen: 's3', state: 'tree', filter: 'unknown-state', notice: undefined, node: undefined }),
    },
    onBackToNotice: useCallback(() => go({ screen: 's5detail', state: 'detail' }), [go]),
    onBackToList: useCallback(() => go({ screen: 's5', state: 'wfg' }), [go]),
    onOpenResident: useCallback((residentId: string) => go({ screen: 'residentsDetail', state: 'detail', resident: residentId, household: undefined }), [go]),
    onBackToResidents: useCallback(() => go({ screen: 'residents', state: 'list', resident: undefined }), [go]),
    onOpenHousehold: useCallback((householdId: string) => go({ screen: 'householdsDetail', state: 'detail', household: householdId, resident: undefined }), [go]),
    onBackToHouseholds: useCallback(() => go({ screen: 'households', state: 'list', household: undefined }), [go]),
    onOpenVisitor: useCallback((visitorId: string) => go({ screen: 'visitorLog', state: 'detail', visitor: visitorId }), [go]),
    onCounterTab: useCallback((tab: 'walk-in' | 'pass') => go({ screen: 'visitorCounter', state: tab, visitor: undefined }), [go]),
    onVisitorRegister: useCallback(() => go({ screen: 'visitorRegister', state: 'blank', visitor: undefined }), [go]),
    onBackToVisitorLog: useCallback(() => go({ screen: 'visitorLog', state: 'default', visitor: undefined }), [go]),
    onOpenHelpdesk: useCallback((contactId: string) => go({ screen: 'helpdeskDetail', state: 'detail', contact: contactId }), [go]),
    onBackToHelpdesk: useCallback(() => go({ screen: 'helpdesk', state: 'queue', contact: undefined }), [go]),
    onOpenUser: useCallback((staffId: string) => go({ screen: 'adminUsersDetail', state: 'detail', user: staffId, group: undefined }), [go]),
    onBackToUsers: useCallback(() => go({ screen: 'adminUsers', state: 'list', user: undefined }), [go]),
    onOpenGroup: useCallback((groupId: string) => go({ screen: 'adminGroupsDetail', state: 'detail', group: groupId, user: undefined }), [go]),
    onBackToGroups: useCallback(() => go({ screen: 'adminGroups', state: 'list', group: undefined }), [go]),
    onOpenBooking: useCallback((bookingId: string) => go({ screen: 'bookingsDetail', state: 'detail', booking: bookingId, facility: undefined }), [go]),
    onBackToBookings: useCallback(() => go({ screen: 'bookings', state: 'default', booking: undefined }), [go]),
    onBookingView: useCallback((view: 'list' | 'calendar') => go({ screen: view === 'list' ? 'bookings' : 'bookingCalendar', state: 'default', booking: undefined }), [go]),
    onOpenFacility: useCallback((facilityId: string) => go({ screen: 'bookingFacilitiesDetail', state: 'detail', facility: facilityId, booking: undefined }), [go]),
    onBackToFacilities: useCallback(() => go({ screen: 'bookingFacilities', state: 'default', facility: undefined }), [go]),
    onOpenCharge: useCallback((chargeId: string) => go({ screen: 'chargesDetail', state: 'detail', charge: chargeId, payment: undefined, refund: undefined }), [go]),
    onBackToCharges: useCallback(() => go({ screen: 'charges', state: 'default', charge: undefined }), [go]),
    onOpenPayment: useCallback((paymentId: string) => go({ screen: 'paymentsDetail', state: 'detail', payment: paymentId, charge: undefined, refund: undefined }), [go]),
    onBackToPayments: useCallback(() => go({ screen: 'payments', state: 'default', payment: undefined }), [go]),
    onOpenRefund: useCallback((refundId: string) => go({ screen: 'refundsDetail', state: 'detail', refund: refundId, charge: undefined, payment: undefined }), [go]),
    onBackToRefunds: useCallback(() => go({ screen: 'refunds', state: 'default', refund: undefined }), [go]),
    onOpenDocument: useCallback((documentId: string) => go({ screen: 'documentsDetail', state: 'detail', document: documentId }), [go]),
    onBackToDocuments: useCallback(() => go({ screen: 'documents', state: 'list', document: undefined }), [go]),
    onOpenSystem: useCallback((systemRef: string) => go({ screen: 'integrationStatusDetail', state: 'detail', system: systemRef }), [go]),
    onBackToIntegration: useCallback(() => go({ screen: 'integrationStatus', state: 'list', system: undefined }), [go]),
    onSubmitCompose: useCallback(async (body: ComposeNoticeRequest, clientKey: string) => {
      const { LiveNoticeActClient, CorpusNoticeActClient } = await import('./data/notice-client.ts');
      const client: NoticeActClient = route.live
        ? new LiveNoticeActClient({ baseUrl: liveBaseUrl(route, window.location.origin), token: route.token, pageOrigin: window.location.origin })
        : new CorpusNoticeActClient();
      setBusy(true);
      const result = await client.compose(body, clientKey);
      setBusy(false);
      if (result.kind !== 'recorded') { setOutcome(result); return; }
      // Live: the notice, fetched again. Fixture: the recorded response, then the notice.
      if (route.live) go({ screen: 's5detail', state: 'detail', notice: result.data.noticeId });
      else go({ screen: 's5compose', state: 'created', notice: result.data.noticeId });
    }, [route, go]),
    onConfirm: useCallback(async (op: NoticeTransition, noticeId: string, body: NoticeTransitionRequest) => {
      const { LiveNoticeActClient, CorpusNoticeActClient } = await import('./data/notice-client.ts');
      const client: NoticeActClient = route.live
        ? new LiveNoticeActClient({ baseUrl: liveBaseUrl(route, window.location.origin), token: route.token, pageOrigin: window.location.origin })
        : new CorpusNoticeActClient();
      setBusy(true);
      const result = await client.transition(op, noticeId, body);
      setBusy(false);
      if (result.kind !== 'recorded') { setOutcome(result); return; }
      if (route.live) go({ screen: 's5detail', state: 'detail', notice: result.data.noticeId });
      else go({ screen: 's5act', state: `${op.replace(/Notice$/, '')}-recorded`, notice: result.data.noticeId });
    }, [route, go]),
  };

  const fixtureScope = route.live ? null : scopes()[route.scope] ?? null;
  const shellScope =
    route.live
      ? liveScope?.kind === 'loaded' ? liveScope.data : null
      : fixtureScope;
  // Live mode never reads the fixture tree: the rail is the live tree, or empty until it loads (and if it does not load,
  // the live screens say so themselves). That is what keeps the corpus out of a live-mode page.
  const fixtureTree = route.live ? null : (fixtures().CORPUS['mob-s3-properties/tree.json'] as PropertyTreeResponse);
  const railTree =
    route.live && liveTree?.kind === 'loaded' ? liveTree.data : fixtureTree;
  // Live: the rail says whether the tree is loading or failed (it never falls back to the scope's partial nodes or a fixture).
  const railStatus: 'ready' | 'loading' | 'error' = !route.live || liveTree?.kind === 'loaded' ? 'ready' : liveTree === null ? 'loading' : 'error';
  setLocationTree(railTree);
  const railNodes = railStatus === 'ready' ? buildRailNodes(railTree, shellScope) : [];
  const requestedFocus = parseFocusParam(route.at);
  const focusNode = findRailNode(railNodes, requestedFocus);
  const focusKey = focusNode ? requestedFocus : null;
  const focusPath = pathForFocus(railNodes, focusKey);

  const onPickFocus = useCallback((key: NodeKey) => {
    go({ at: key });
  }, [go]);
  const onClearFocus = useCallback(() => {
    go({ at: undefined });
  }, [go]);
  const onToggleNav = useCallback(() => {
    setRoute((prev) => ({ ...prev, navCollapsed: !prev.navCollapsed }));
  }, []);
  const onToggleScope = useCallback(() => {
    setRoute((prev) => ({ ...prev, scopeCollapsed: !prev.scopeCollapsed }));
  }, []);
  // Logging out leaves live mode for the fixture one, whose corpora a live session never fetched: they load first, and
  // if they cannot, the page says so rather than going blank.
  const [corpusFailed, setCorpusFailed] = useState(false);
  const onLogOut = useCallback(() => {
    void loadFixtures().then(() => {
      setRoute((prev) => ({
        ...prev,
        signedIn: false,
        live: false,
        api: '',
        token: '',
      }));
    }, () => setCorpusFailed(true));
  }, []);
  const onSignInFixture = useCallback(() => {
    setRoute((prev) => ({ ...prev, signedIn: true }));
  }, []);

  const bodyFor = (route: Route, inChain: boolean): ReactNode => {
  let body: ReactNode;
  if (!inChain && route.screen !== 'stub' && isChainScreen(route.screen)) {
    // Payments chain, Households, Residents, Facilities, Help desk and Admin users / groups: the list stays under
    // ONE pop-up that the detail routes fill. Live mode too: the pop-up renders each route's own live panel.
    const view: ChainView = {
      screen: route.screen, state: route.state,
      charge: route.charge, payment: route.payment, refund: route.refund, household: route.household, resident: route.resident,
      facility: route.facility, contact: route.contact, user: route.user, group: route.group,
    };
    body = (
      <ChainHost
        view={view}
        locale={route.locale}
        titleOf={(sc) => t(CHAIN_TITLES[sc] ?? MESSAGES.app.name, route.locale)}
        onGo={(v) => go(v)}
        renderScreen={(sc, st) => bodyFor({ ...route, screen: sc, state: st }, true)}
      />
    );
  } else if (route.live && route.screen === 's3' && route.state === 'tree') {
    body = livePanel(liveTree, route.locale, (data) => <S3Tree data={data} scope={shellScope} locale={route.locale} onCompose={handlers.onCompose} onOpenHousehold={handlers.onOpenHousehold} filter={route.filter === 'unknown-state' ? 'unknown-state' : undefined} focusKey={focusKey} />);
  } else if (route.live && route.screen === 's5') {
    body = livePanel(liveList, route.locale, (data) => (
      <S5List data={data} locale={route.locale} onOpen={handlers.onOpen} onAct={handlers.onAct} onGoToTree={handlers.onGoToTree} filter={route.filter === 'active' ? 'active' : undefined} focusKey={focusKey} />
    ));
  } else if (route.live && route.screen === 's5detail') {
    body = route.notice
      ? livePanel(liveDetail, route.locale, (data) => (
        <S5Detail
          data={data}
          locale={route.locale}
          onAct={handlers.onAct}
          onOutstanding={handlers.onOutstanding}
          onOpenDocument={handlers.onOpenDocument}
          liveEmail={{
            delivery: liveNoticeEmail?.kind === 'loaded' ? liveNoticeEmail.data : null,
            problem: liveNoticeEmail?.kind === 'problem'
              ? liveNoticeEmail.problem
              : liveNoticeEmail?.kind === 'offline'
                ? {
                    type: 'https://pemo.local/problems/internal-error',
                    title: 'Offline',
                    status: 0,
                    correlationId: '00000000-0000-4000-8000-000000000000',
                    staffMessage: { en: 'The API could not be reached.', 'zh-Hant': '未能連接 API。', 'zh-Hans': '未能连接 API。' },
                  }
                : null,
            pending: liveNoticeEmail === null,
            sendNote,
            onSend: () => {
              if (!liveClient || !route.notice) return;
              void liveClient.sendNoticeEmail(route.notice).then((result) => {
                if (result.kind === 'loaded') {
                  const first = result.data.results[0];
                  setSendNote(first
                    ? `${result.data.results.length} · ${first.status} · ${first.transport} · ${first.detail}`
                    : result.data.transport);
                } else if (result.kind === 'problem') {
                  setSendNote(result.problem.staffMessage?.en ?? result.problem.title);
                } else {
                  setSendNote('offline');
                }
                setLiveTick((n) => n + 1);
              });
            },
          }}
        />
      ))
      : <NoFixture locale={route.locale} missing={MESSAGES.s5.noNoticeNamed} />;
  } else if (route.live && route.screen === 's5ack') {
    body = route.notice
      ? livePanel(liveAck, route.locale, (data) => <S5Outstanding data={data} locale={route.locale} onBack={handlers.onOpen} />)
      : <NoFixture locale={route.locale} missing={MESSAGES.s5.noNoticeNamed} />;
  } else if (route.live && route.screen === 's5compose') {
    body = (
      <ComposeForm initial={null} node={resolveNode(route.node, shellScope, railTree)} locale={route.locale} onSubmit={handlers.onSubmitCompose} busy={busy}>
        <ActOutcome outcome={outcome} locale={route.locale} />
      </ComposeForm>
    );
  } else if (route.live && route.screen === 's5act') {
    const op = `${route.state}Notice`;
    if (!isTransition(op) || !route.notice) {
      body = <NoFixture locale={route.locale} missing={MESSAGES.s5.noNoticeNamed} />;
    } else {
      const noticeId = route.notice;
      // The confirm step is built from the notice AS THE SERVER NOW HOLDS IT:
      // fromVersion is its version, the content fields its content.
      body = livePanel(liveDetail, route.locale, (d) => (
        <ActConfirm
          op={op}
          noticeId={noticeId}
          initial={{
            fromVersion: d.notice.version,
            titleEn: d.notice.titleEn, titleZhHant: d.notice.titleZhHant,
            bodyEn: d.notice.bodyEn, bodyZhHant: d.notice.bodyZhHant,
            publishAt: d.notice.publishAt ?? null, expireAt: d.notice.expireAt ?? null,
            mandatoryAck: d.notice.mandatoryAck,
            responseOptions: d.notice.responseOptions ?? [],
            targets: d.notice.targets,
          }}
          locale={route.locale}
          busy={busy}
          onConfirm={(reqBody) => handlers.onConfirm(op, noticeId, reqBody)}
          onBack={handlers.onBackToNotice}
        >
          <ActOutcome outcome={outcome} locale={route.locale} />
        </ActConfirm>
      ));
    }
  } else if (route.live && route.screen === 'charges') {
    body = livePanel(liveCharges, route.locale, (rows) => (
      <ChargesList
        locale={route.locale}
        onOpen={handlers.onOpenCharge}
        onOpenHousehold={handlers.onOpenHousehold}
        focusKey={focusKey}
        liveRows={rows}
      />
    ));
  } else if (route.live && route.screen === 'chargesDetail') {
    body = route.charge
      ? livePanel(liveCharge, route.locale, (data) => (
        <ChargesDetail
          chargeId={route.charge ?? ''}
          locale={route.locale}
          onBack={handlers.onBackToCharges}
          onOpenHousehold={handlers.onOpenHousehold}
          onOpenPayment={handlers.onOpenPayment}
          liveCharge={data.charge}
          liveReceipts={data.receipts}
          sendNote={sendNote}
          onSendInvoice={() => {
            if (!liveClient || !route.charge) return;
            void liveClient.sendInvoiceEmail(route.charge).then((result) => {
              setSendNote(noteFromSend(result));
              setLiveTick((n) => n + 1);
            });
          }}
        />
      ))
      : <NoFixture locale={route.locale} missing={MESSAGES.finance.chargeNotFound} />;
  } else if (route.live && route.screen === 'payments') {
    body = livePanel(livePayments, route.locale, (data) => (
      <PaymentsList
        locale={route.locale}
        onOpen={handlers.onOpenPayment}
        focusKey={focusKey}
        liveRows={data.payments}
      />
    ));
  } else if (route.live && route.screen === 'paymentsDetail') {
    body = livePanel(livePayments, route.locale, (data) => (
      <PaymentsDetail
        paymentId={route.payment ?? ''}
        locale={route.locale}
        onBack={handlers.onBackToPayments}
        onOpenCharge={handlers.onOpenCharge}
        liveRow={data.payments.find((p) => p.paymentId === route.payment) ?? null}
      />
    ));
  } else if (route.live && route.screen === 'adminEmail') {
    body = (
      <AdminEmailConfigForm
        locale={route.locale}
        onLiveTest={async (to) => {
          if (!liveClient) return { ok: false, detail: 'offline' };
          const result = await liveClient.sendAdminTestEmail(to);
          if (result.kind === 'loaded') {
            return { ok: true, detail: `${result.data.status} · ${result.data.transport} · ${result.data.detail}` };
          }
          if (result.kind === 'problem') {
            return { ok: false, detail: result.problem.staffMessage?.en ?? result.problem.title };
          }
          return { ok: false, detail: 'offline' };
        }}
      />
    );
  } else if (route.live && route.screen === 'helpdesk') {
    // Live Help desk: problem/offline/loading until Backend 200 — never invent empty queues.
    body = livePanel(liveHelpdeskQueue, route.locale, (data) => (
      <HelpDeskQueue locale={route.locale} onOpen={handlers.onOpenHelpdesk} liveView={data} focusNode={focusNode} />
    ));
  } else if (route.live && route.screen === 'helpdeskDetail') {
    body = route.contact && isPortalTicketId(route.contact)
      ? (
        <PortalTicketStaffDetail
          ticketId={route.contact}
          locale={route.locale}
          onBack={handlers.onBackToHelpdesk}
        />
      )
      : route.contact
      ? livePanel(liveHelpdeskContact, route.locale, (data) => (
        <HelpDeskDetail contactId={route.contact ?? ''} locale={route.locale} onBack={handlers.onBackToHelpdesk} liveDetail={data} liveMode />
      ))
      : <NoFixture locale={route.locale} missing={MESSAGES.helpdesk.notFound} />;
  } else if (route.screen === 'stub') {
    const label = findNavLabel(route.navId) ?? MESSAGES.app.name;
    body = <ComingSoon title={label} locale={route.locale} />;
  } else {
    body = <FixtureView route={{ ...route, screen: route.screen }} tree={railTree} scope={shellScope} handlers={handlers} outcome={outcome} busy={busy} focusKey={focusKey} focusNode={focusNode} />;
  }
  return body;
  };
  const body = bodyFor(route, false);

  const pageTitleLabel = route.screen === 'stub'
    ? (findNavLabel(route.navId) ?? MESSAGES.app.name)
    : (
      {
        s1: MESSAGES.s1.title,
        s2: MESSAGES.s2.title,
        s3: MESSAGES.s3.title,
        s4: MESSAGES.s4.title,
        s5: MESSAGES.s5.listTitle,
        s5detail: MESSAGES.s5.detailTitle,
        s5ack: MESSAGES.s5.ackTitle,
        s5compose: MESSAGES.s5.composeTitle,
        s5act: MESSAGES.s5.actTitle,
        visitorLog: route.state === 'detail' ? MESSAGES.visitor.detailTitle : MESSAGES.visitor.logTitle,
        visitorRegister: MESSAGES.visitor.registerTitle,
        visitorCounter: MESSAGES.counter.title,
        residents: MESSAGES.residents.listTitle,
        residentsDetail: MESSAGES.residents.detailTitle,
        households: MESSAGES.households.listTitle,
        householdsDetail: MESSAGES.households.detailTitle,
        helpdesk: MESSAGES.helpdesk.listTitle,
        helpdeskDetail: MESSAGES.helpdesk.detailTitle,
        adminUsers: MESSAGES.admin.usersListTitle,
        adminUsersDetail: MESSAGES.admin.usersDetailTitle,
        adminGroups: MESSAGES.admin.groupsListTitle,
        adminGroupsDetail: MESSAGES.admin.groupsDetailTitle,
        adminRoles: MESSAGES.admin.rolesTitle,
        adminEmail: MESSAGES.admin.emailTitle,
        adminLists: MESSAGES.lookups.title,
        adminAudit: MESSAGES.admin.auditListTitle,
        integrationStatus: MESSAGES.integration.title,
        integrationStatusDetail: MESSAGES.integration.detailTitle,
        bookings: MESSAGES.booking.listTitle,
        bookingsDetail: MESSAGES.booking.detailTitle,
        bookingCalendar: MESSAGES.booking.calendarTitle,
        bookingCheckin: MESSAGES.booking.checkinTitle,
        bookingFacilities: MESSAGES.booking.facilitiesTitle,
        bookingFacilitiesDetail: MESSAGES.booking.facilityDetailTitle,
        bookingRates: MESSAGES.booking.ratesTitle,
        reports: MESSAGES.reports.title,
        charges: MESSAGES.finance.chargesListTitle,
        chargesDetail: MESSAGES.finance.chargeDetailTitle,
        payments: MESSAGES.finance.paymentsListTitle,
        paymentsDetail: MESSAGES.finance.paymentDetailTitle,
        refunds: MESSAGES.finance.refundsListTitle,
        refundsDetail: MESSAGES.finance.refundDetailTitle,
        documents: MESSAGES.documents.listTitle,
        documentsDetail: MESSAGES.documents.detailTitle,
        carPark: MESSAGES.carPark.title,
      } as const
    )[route.screen];

  // A chain detail opens over its list, so the page keeps the list's title; the pop-up carries the detail's.
  const chainUnder = route.live || route.screen === 'stub' ? undefined : CHAIN_LIST_OF[route.screen];
  const pageTitle = t(chainUnder ? (CHAIN_TITLES[chainUnder] ?? pageTitleLabel) : pageTitleLabel, route.locale);

  if (corpusFailed) return <BootFailure locale={route.locale} />;

  if (!route.signedIn) {
    return (
      <SignedOut
        locale={route.locale}
        onNavigate={onNavigate}
        onSignIn={onSignInFixture}
      />
    );
  }

  return (
    <Shell
      screen={route.screen}
      navId={route.navId}
      state={route.state}
      locale={route.locale}
      scope={shellScope}
      railNodes={railNodes}
      railStatus={railStatus}
      railLive={route.live}
      onRailRetry={onRailRetry}
      focusKey={focusKey}
      focusPath={focusPath}
      pageTitle={pageTitle}
      onNavigate={onNavigate}
      onNav={onNav}
      onPickFocus={onPickFocus}
      onClearFocus={onClearFocus}
      navCollapsed={route.navCollapsed}
      scopeCollapsed={route.scopeCollapsed}
      onToggleNav={onToggleNav}
      onToggleScope={onToggleScope}
      onLogOut={onLogOut}
      hiddenNav={deniedNav}
    >
      <ScreenErrorBoundary locale={route.locale} resetKey={`${route.screen}/${route.state}`}>
        <Suspense fallback={<div className="pemo-screen-loading" aria-busy="true" data-testid="screen-loading" />}>{body}</Suspense>
      </ScreenErrorBoundary>
    </Shell>
  );
}
