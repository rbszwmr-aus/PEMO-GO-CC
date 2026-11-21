/**
 * The app: resolve (service, tab, state, locale[, ticket]) from the URL and render it.
 *
 * No router dependency. The whole application state is URL parameters, and
 * making every state reachable by URL is what makes the state matrix cheap to
 * test: a state is CONSTRUCTED, never driven to by clicking.
 *
 * UI-028-ST rendered every pane an empty state. UI-031-ST fills two of them from
 * the resident-portal fixtures — Explore (`search`/`explore`) and Facility detail
 * (`search`/`detail`) — while every other pane keeps its empty/coming-soon state.
 * Help desk (`helpdesk` / list|create|detail) is live against @pemo/tickets-demo-store
 * (API :3200 when available).
 */

import { useCallback, useEffect, useState } from 'react';

import { bcp47, DEFAULT_LOCALE, isLocale, type Locale } from './i18n/locale.ts';
import {
  DEFAULT_SERVICE, GROUPS, serviceById, SERVICE_ALIASES, SERVICE_IDS,
  type ReservedId, type ServiceId,
} from './data/services.ts';
import { paneStatesFor, defaultStateFor, isBookingPane } from './data/panes.ts';
import {
  searchAt, facilityAt, problemAt, isExploreProblem, isFacilityProblem,
  type ExploreState, type FacilityFixtureState,
} from './data/booking.ts';
import { Shell, type NavIntent } from './shell/Shell.tsx';
import { TabBar } from './shell/TabBar.tsx';
import { ComingSoonPanel } from './components/ComingSoonPanel.tsx';
import { Empty, ErrorState, Loading, Offline, PermissionDenied } from './components/StateNotice.tsx';
import { Explore } from './screens/Explore.tsx';
import { FacilityDetail } from './screens/FacilityDetail.tsx';
import { ProblemView } from './components/ProblemView.tsx';
import { HelpdeskPane } from './screens/helpdesk/HelpdeskPane.tsx';
import { NoticesPane } from './screens/notices/NoticesPane.tsx';
import { VisitorPane } from './screens/visitor/VisitorPane.tsx';
import { InvoicesPane } from './screens/invoices/InvoicesPane.tsx';
import { isInvoiceFilter } from './data/invoices-types.ts';

interface Route {
  service: ServiceId;
  tab: string;
  state: string;
  locale: Locale;
  ticket?: string;
  notice?: string;
  visitor?: string;
  invoice?: string;
  invoiceFilter?: string;
}

function firstTab(service: ServiceId): string {
  const group = serviceById(service).group;
  return group ? GROUPS[group].tabs[0]!.id : '';
}

function stripTokenFromLocation(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('token')) return;
  url.searchParams.delete('token');
  const search = url.searchParams.toString();
  window.history.replaceState(null, '', `${url.pathname}${search ? `?${search}` : ''}${url.hash}`);
}

function readRoute(): Route {
  stripTokenFromLocation();
  const q = new URLSearchParams(window.location.search);
  const sRaw = q.get('service');
  const sParam = sRaw && SERVICE_ALIASES[sRaw] ? SERVICE_ALIASES[sRaw] : sRaw;
  const service: ServiceId =
    sParam && (SERVICE_IDS as string[]).includes(sParam) ? (sParam as ServiceId) : DEFAULT_SERVICE;

  const group = serviceById(service).group;
  const tabParam = q.get('tab');
  const knownTabs = group ? GROUPS[group].tabs.map((x) => x.id) : [];
  const tab = tabParam && knownTabs.includes(tabParam) ? tabParam : firstTab(service);

  const stParam = q.get('state');
  const validStates = paneStatesFor(service, tab);
  const state = stParam && validStates.includes(stParam) ? stParam : defaultStateFor(service, tab);

  const langParam = q.get('lang');
  const ticketParam = q.get('ticket');
  const noticeParam = q.get('notice');
  const visitorParam = q.get('visitor');
  const route: Route = {
    service,
    tab,
    state,
    locale: isLocale(langParam) ? langParam : DEFAULT_LOCALE,
  };
  if (ticketParam) route.ticket = ticketParam;
  if (noticeParam) route.notice = noticeParam;
  if (visitorParam) route.visitor = visitorParam;
  if (service === 'invoices') {
    const invoiceParam = q.get('invoice');
    const filterParam = q.get('filter');
    if (invoiceParam && tab === 'detail') route.invoice = invoiceParam;
    if (isInvoiceFilter(filterParam)) route.invoiceFilter = filterParam;
  }
  return route;
}

function writeRoute(r: Route): void {
  const q = new URLSearchParams({ service: r.service, state: r.state, lang: r.locale });
  if (r.tab) q.set('tab', r.tab);
  if (r.ticket) q.set('ticket', r.ticket);
  if (r.notice) q.set('notice', r.notice);
  if (r.visitor) q.set('visitor', r.visitor);
  if (r.invoiceFilter) q.set('filter', r.invoiceFilter);
  if (r.invoice) q.set('invoice', r.invoice);
  window.history.replaceState(null, '', `?${q.toString()}`);
}

/** The generic client states, shared by every pane. */
function GenericState({ state, locale }: { state: string; locale: Locale }) {
  switch (state) {
    case 'loading': return <Loading locale={locale} />;
    case 'error': return <ErrorState locale={locale} />;
    case 'denied': return <PermissionDenied locale={locale} />;
    case 'offline': return <Offline locale={locale} />;
    default: return <Empty locale={locale} />;
  }
}

function isHelpdeskPane(service: string): boolean {
  return service === 'helpdesk';
}

function isNoticesPane(service: string): boolean {
  return service === 'notices';
}

function isVisitorPane(service: string): boolean {
  return service === 'visitor';
}

function isInvoicesPane(service: string): boolean {
  return service === 'invoices';
}

/** The pane content for a data (booking) or generic state. */
function Pane({
  service, tab, state, locale, ticket, notice, visitor, invoice, invoiceFilter, onNavigate,
}: Route & { onNavigate: (next: NavIntent) => void }) {
  const kind = isBookingPane(service, tab);

  if (isHelpdeskPane(service)) {
    return (
      <HelpdeskPane
        tab={tab || 'list'}
        {...(ticket ? { ticketId: ticket } : {})}
        locale={locale}
        onNavigate={onNavigate}
      />
    );
  }

  if (isNoticesPane(service)) {
    return (
      <NoticesPane
        tab={tab || 'list'}
        {...(notice ? { noticeId: notice } : {})}
        locale={locale}
        onNavigate={onNavigate}
      />
    );
  }

  if (isVisitorPane(service)) {
    return (
      <VisitorPane
        tab={tab || 'list'}
        {...(visitor ? { visitorId: visitor } : {})}
        locale={locale}
        onNavigate={onNavigate}
      />
    );
  }

  if (isInvoicesPane(service)) {
    return (
      <InvoicesPane
        tab={tab || 'list'}
        {...(invoice ? { invoiceId: invoice } : {})}
        {...(isInvoiceFilter(invoiceFilter) ? { filter: invoiceFilter } : {})}
        locale={locale}
        onNavigate={onNavigate}
      />
    );
  }

  if (kind === 'explore') {
    if (isExploreProblem(state)) {
      const p = problemAt(state);
      return p ? <ProblemView problem={p} locale={locale} /> : <GenericState state="error" locale={locale} />;
    }
    const search = searchAt(state as ExploreState);
    if (search) return <Explore search={search} locale={locale} />;
    return <GenericState state={state} locale={locale} />;
  }

  if (kind === 'facility') {
    if (isFacilityProblem(state)) {
      const p = problemAt(state);
      return p ? <ProblemView problem={p} locale={locale} /> : <GenericState state="error" locale={locale} />;
    }
    const detail = facilityAt(state as FacilityFixtureState);
    if (detail) return <FacilityDetail detail={detail} locale={locale} />;
    return <GenericState state={state} locale={locale} />;
  }

  return <GenericState state={state} locale={locale} />;
}

function View({ route, onNavigate }: {
  route: Route;
  onNavigate: (next: NavIntent) => void;
}) {
  const { service, tab, locale } = route;
  const def = serviceById(service);
  if (def.tag === 'soon') {
    return <ComingSoonPanel id={service as ReservedId} locale={locale} />;
  }
  const group = GROUPS[def.group!];
  return (
    <>
      <TabBar group={group} activeTab={tab} locale={locale} onSelect={(tabId) => onNavigate({ tab: tabId, ticket: null, notice: null, visitor: null, invoice: null })} />
      <Pane {...route} onNavigate={onNavigate} />
    </>
  );
}

export function App() {
  const [route, setRoute] = useState<Route>(() => readRoute());

  useEffect(() => {
    writeRoute(route);
    document.documentElement.lang = bcp47(route.locale);
  }, [route]);

  const onNavigate = useCallback((next: NavIntent) => {
    setRoute((prev) => {
      const service = next.service ?? prev.service;
      const group = serviceById(service).group;
      const knownTabs = group ? GROUPS[group].tabs.map((x) => x.id) : [];
      const changedService = !!next.service && next.service !== prev.service;
      const tab =
        next.tab ??
        (changedService ? firstTab(service) : knownTabs.includes(prev.tab) ? prev.tab : firstTab(service));
      const valid = paneStatesFor(service, tab);
      const changedPane = changedService || (next.tab !== undefined && next.tab !== prev.tab);
      const state =
        next.state ??
        (changedPane ? defaultStateFor(service, tab) : valid.includes(prev.state) ? prev.state : defaultStateFor(service, tab));
      const nextRoute: Route = {
        service,
        tab,
        state,
        locale: next.locale ?? prev.locale,
      };
      if (service === 'helpdesk' && tab === 'detail') {
        if (typeof next.ticket === 'string') nextRoute.ticket = next.ticket;
        else if (next.ticket !== null && prev.ticket) nextRoute.ticket = prev.ticket;
      }
      if (service === 'notices' && tab === 'detail') {
        if (typeof next.notice === 'string') nextRoute.notice = next.notice;
        else if (next.notice !== null && prev.notice) nextRoute.notice = prev.notice;
      }
      if (service === 'visitor' && tab === 'detail') {
        if (typeof next.visitor === 'string') nextRoute.visitor = next.visitor;
        else if (next.visitor !== null && prev.visitor) nextRoute.visitor = prev.visitor;
      }
      if (service === 'invoices') {
        if (tab === 'detail') {
          if (typeof next.invoice === 'string') nextRoute.invoice = next.invoice;
          else if (next.invoice !== null && prev.invoice) nextRoute.invoice = prev.invoice;
        }
        // The status filter survives list <-> detail so prev/next walks the filtered order.
        if (next.invoiceFilter !== undefined) {
          if (isInvoiceFilter(next.invoiceFilter)) nextRoute.invoiceFilter = next.invoiceFilter;
        } else if (prev.service === 'invoices' && prev.invoiceFilter) {
          nextRoute.invoiceFilter = prev.invoiceFilter;
        }
      }
      return nextRoute;
    });
  }, []);

  return (
    <Shell
      service={route.service}
      state={route.state}
      stateOptions={paneStatesFor(route.service, route.tab)}
      locale={route.locale}
      onNavigate={onNavigate}
    >
      <View route={route} onNavigate={onNavigate} />
    </Shell>
  );
}
