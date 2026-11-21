/**
 * Visitors P0 — Visitor log (today / on-site list + detail + fixture check-out).
 *
 * Matches management-web-6-Sept Visitor management layout: boundary note, four
 * stats, Today's visitors table. Check-out is fixture-local only (no write API).
 * No BMS door unlock.
 *
 * @version 0.2.1
 * @changelog
 *   0.2.1 (2026-11-19) Pop-up facts stay in one column of label/value rows (PT 2026-11-19: read-only pop-ups one column, two columns only for inputs).
 */

import { HintRow, InfoTip } from '../components/FinanceBits.tsx';
import { Icon } from '../components/Icon.tsx';
import { useEffect, useMemo, useState } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { copy, t, type Locale } from '../i18n/locale.ts';
import { clockHHmm, hktStamp, number, timeOnly } from '../format/datetime.ts';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import {
  VISITOR_LIST_FIXTURE,
  findVisitor,
  type VisitorRow,
  type VisitorStateId,
  type VisitorTone,
} from '../data/visitor-fixtures.ts';
import { useDeskVisits } from './desk-visits.ts';
import { getFrontCounterClient, type Visit } from '../data/front-counter-client.ts';
import { hostDisplay } from '../data/host-label.ts';
import { DeskStatusCell, SampleDataNote, deskStatusText, hkMinutes } from './VisitorFrontCounter.tsx';
import { FilterBar, NoMatches, type FilterDef } from '../components/TableControls.tsx';
import { distinctOptions, type ViewSpec } from '../components/table-view.ts';
import type { ResolvedPurpose } from '../lookups/lookup-lists.ts';
import { deskPurpose, fixturePurpose, purposeOptionsFor } from '../lookups/purpose-view.ts';
import { useLookupItems } from '../lookups/lookups-client.ts';
import { VISITOR_PURPOSE } from '../lookups/lookup-lists.ts';
import { useTableView } from '../components/useTableView.ts';
import { ButtonTabs, LineTabs, type TabItem } from '../components/Tabs.tsx';
import { FilterChipRow, StatCard } from '../components/StatCard.tsx';
import { Dialog } from '../components/Dialog.tsx';
import { VisitorRegister } from './VisitorRegister.tsx';
import {
  DEFAULT_SORT, countsOf, inFilter, isOverdue, pressCard,
  type VisitFilterId, type VisitStatus,
} from './visitor-view.ts';

const CHECKOUT_ELIGIBLE: ReadonlySet<VisitorStateId> = new Set(['arrived', 'not-signed-out']);

function toneBorder(tone: VisitorTone): string {
  return `var(--pemo-sev-${tone}-border)`;
}

function StateChip({ state, locale }: { state: VisitorStateId; locale: Locale }) {
  const label = t(MESSAGES.visitor.visitorState[state], locale);
  const tone: VisitorTone =
    state === 'arrived' || state === 'checked-out'
      ? 'normal'
      : state === 'expected'
        ? 'information'
        : state === 'not-signed-out'
          ? 'warning'
          : 'unknown';
  return (
    <span
      className="pemo-chip"
      data-testid="visitor-state"
      data-state={state}
      style={{
        color: `var(--pemo-sev-${tone}-strong)`,
        background: `var(--pemo-sev-${tone}-surface)`,
        borderColor: `var(--pemo-sev-${tone}-border)`,
      }}
    >
      {label}
    </span>
  );
}

/** One line of Today’s visitors: a front-counter visit, or a fixture visitor, read the same way for search, filter and sort. */
interface LogRow {
  key: string;
  desk: Visit | null;
  fixture: VisitorRow | null;
  name: string;
  /** The purpose as a managed type (stable code + label in this language), or a legacy value nothing claims. */
  purpose: ResolvedPurpose;
  host: string;
  /** Minutes after midnight of the time shown in Expected; null when there is none. */
  time: number | null;
  /** Timestamps (ms) behind the Expected and In time columns; In time is null until the visitor has arrived. */
  expectedAt: number | null;
  inAt: number | null;
  pass: string;
  state: string;
  registered: 'walk_in' | 'pre_registered';
  status: VisitStatus;
  overdue: boolean;
  /** Timestamps (ms) behind the sorts: arrival (checked in, else expected), end of the visit window, and when the record was made. */
  at: number | null;
  due: number | null;
  created: number | null;
}

/** A fixture visitor's clock time on the fixture's own day, as ms. */
function fixtureMs(hhmm: string | null | undefined): number | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const ms = Date.parse(`${VISITOR_LIST_FIXTURE.asOf.slice(0, 10)}T${hhmm.padStart(5, '0')}:00+08:00`);
  return Number.isNaN(ms) ? null : ms;
}
const isoMs = (iso: string | null | undefined): number | null => {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(ms) ? null : ms;
};
const FIXTURE_STATUS: Record<VisitorStateId, { status: VisitStatus; overdue: boolean }> = {
  expected: { status: 'expected', overdue: false },
  arrived: { status: 'on_site', overdue: false },
  'not-signed-out': { status: 'on_site', overdue: true },
  'host-not-reached': { status: 'on_site', overdue: false },
  'checked-out': { status: 'checked_out', overdue: false },
};

function minutesOf(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function buildLogRows(desk: readonly Visit[], locale: Locale, now: number): LogRow[] {
  const fromDesk: LogRow[] = desk.map((v) => ({
    key: v.visit_id, desk: v, fixture: null, name: v.name, purpose: deskPurpose(v, locale),
    host: hostDisplay(v.host, locale) ?? '—', time: hkMinutes(v.checked_in_at ?? v.expected_from),
    pass: '—', state: deskStatusText(v, locale), registered: v.source === 'pre_registered' ? 'pre_registered' : 'walk_in',
    status: v.status, overdue: isOverdue({ status: v.status, expectedToMs: isoMs(v.expected_to) }, now),
    expectedAt: isoMs(v.expected_from), inAt: isoMs(v.checked_in_at),
    at: isoMs(v.checked_in_at ?? v.expected_from), due: isoMs(v.expected_to), created: isoMs(v.created_at),
  }));
  const fromFixture: LogRow[] = VISITOR_LIST_FIXTURE.visitors.map((v) => ({
    key: v.id, desk: null, fixture: v, name: v.name, purpose: fixturePurpose(v, locale), host: v.hostUnit,
    time: minutesOf(v.expected), pass: v.pass, state: t(MESSAGES.visitor.visitorState[v.state], locale),
    registered: v.registeredBy.en === 'Walk-in at counter' ? 'walk_in' : 'pre_registered',
    ...FIXTURE_STATUS[v.state],
    expectedAt: fixtureMs(v.expected), inAt: isoMs(v.arrivedAt),
    at: isoMs(v.arrivedAt) ?? fixtureMs(v.expected), due: fixtureMs(v.expectedWindow?.end),
    created: isoMs(v.arrivedAt) ?? fixtureMs(v.expected),
  }));
  return [...fromDesk, ...fromFixture];
}

const LOG_SPEC: ViewSpec<LogRow> = {
  searchText: (r) => `${r.name} ${r.host}`,
  filters: {
    purpose: (r) => r.purpose.code,
    pass: (r) => (r.pass === '—' || r.pass === '' ? 'none' : 'with'),
    state: (r) => r.state,
    registered: (r) => r.registered,
  },
  sorts: {
    visitor: (r) => r.name,
    purpose: (r) => r.purpose.label,
    unit: (r) => r.host,
    expected: (r) => r.expectedAt,
    intime: (r) => r.inAt,
    due: (r) => r.due,
    created: (r) => r.created,
    pass: (r) => (r.pass === '—' ? null : r.pass),
    state: (r) => r.state,
  },
};

const COUNTER_SHORT = copy('Front counter', '服務櫃檯', '前台');

export function VisitorLogList({
  locale,
  onOpen,
  onRegister,
  onFrontCounter,
  invitationOpen = false,
  detailId = null,
  onCloseDialog,
}: {
  locale: Locale;
  onOpen: (visitorId: string) => void;
  onRegister: () => void;
  onFrontCounter: () => void;
  /** The Visitor invitation pop-up is open (the Register route is a deep link to it). */
  invitationOpen?: boolean;
  /** A visitor's detail pop-up is open (the detail route is a deep link to it). */
  detailId?: string | null;
  onCloseDialog: () => void;
}) {
  const M = MESSAGES.visitor;
  // Every front-counter visit today, expected ones included: that is where No-show lives.
  const desk = useDeskVisits().visits;
  const purposeTypes = useLookupItems(VISITOR_PURPOSE);
  // Overdue is judged against the clock, so the rows are rebuilt each minute.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const allRows = useMemo(() => buildLogRows(desk, locale, now), [desk, locale, purposeTypes, now]);
  // One status filter, shared by the stat cards and the L2 tabs. Search and the dropdowns persist across it.
  const [filter, setFilterId] = useState<VisitFilterId>('all');
  const counts = useMemo(() => countsOf(allRows), [allRows]);
  const tabRows = useMemo(() => allRows.filter((r) => inFilter(filter, r)), [allRows, filter]);
  const tv = useTableView(tabRows, LOG_SPEC, DEFAULT_SORT.all, locale);
  const chooseFilter = (id: VisitFilterId) => {
    setFilterId(id);
    tv.setSort(DEFAULT_SORT[id]);
  };
  const tabs: TabItem<VisitFilterId>[] = [
    { id: 'all', label: t(M.tabAll, locale), icon: 'ClipboardList', count: counts.all },
    { id: 'expected', label: t(M.tabExpected, locale), icon: 'CalendarCheck', count: counts.expected },
    { id: 'onsite', label: t(M.tabOnSite, locale), icon: 'DoorOpen', count: counts.onsite },
    { id: 'overdue', label: t(M.tabOverdue, locale), icon: 'Hourglass', count: counts.overdue, alert: true },
  ];
  const filterLabel = tabs.find((x) => x.id === filter)?.label ?? '';
  const columns = [
    { key: 'visitor', label: t(M.colVisitor, locale), width: '22%', sortable: true },
    { key: 'purpose', label: t(M.colPurpose, locale), width: '14%', hideBelow: 560, sortable: true },
    { key: 'unit', label: t(M.colHostUnit, locale), width: '18%', sortable: true },
    { key: 'expected', label: t(M.colExpected, locale), width: '12%', sortable: true },
    { key: 'intime', label: t(M.colInTime, locale), width: '12%', sortable: true },
    { key: 'pass', label: t(M.colPass, locale), width: '10%', hideBelow: 640, sortable: true },
    { key: 'state', label: t(M.colState, locale), width: '18%', sortable: true },
  ];
  const TV = MESSAGES.tableView;
  const filters: FilterDef[] = [
    { key: 'purpose', label: t(TV.filterPurpose, locale), allLabel: t(TV.allPurposes, locale), options: purposeOptionsFor(allRows.map((r) => r.purpose), locale), value: tv.state.filters['purpose'] ?? '', onChange: (v) => tv.setFilter('purpose', v) },
    { key: 'pass', label: t(TV.filterPass, locale), allLabel: t(TV.allPasses, locale), options: [{ value: 'with', label: t(TV.withPass, locale) }, { value: 'none', label: t(TV.noPass, locale) }], value: tv.state.filters['pass'] ?? '', onChange: (v) => tv.setFilter('pass', v) },
    { key: 'state', label: t(TV.filterState, locale), allLabel: t(TV.allStates, locale), options: distinctOptions(allRows, (r) => r.state, locale), value: tv.state.filters['state'] ?? '', onChange: (v) => tv.setFilter('state', v) },
    { key: 'registered', label: t(TV.filterRegistered, locale), allLabel: t(TV.allRegistered, locale), options: [{ value: 'walk_in', label: t(MESSAGES.counter.viaWalkIn, locale) }, { value: 'pre_registered', label: t(MESSAGES.counter.viaPass, locale) }], value: tv.state.filters['registered'] ?? '', onChange: (v) => tv.setFilter('registered', v) },
  ];

  return (
    <>
      <div className="pemo-tabrow">
        <LineTabs
          items={[{ id: 'visits', label: t(M.pageTab, locale) }]}
          active="visits"
          locale={locale}
          onChange={() => undefined}
          ariaLabel={t(M.pageTabsLabel, locale)}
          root="visitor-page"
        />
        <span className="pemo-tabrow__actions">
          <span className="pemo-tabrow__counter" data-testid="visitor-front-counter-panel">
            <button type="button" className="pemo-button" data-tree-chrome="true" data-testid="visitor-front-counter-cta" title={t(M.frontCounterTitle, locale)} aria-label={t(M.frontCounterCta, locale)} onClick={onFrontCounter}>
              <Icon name="ScanLine" size={15} /> {t(COUNTER_SHORT, locale)}
            </button>
            <InfoTip text={`${t(M.frontCounterTitle, locale)}. ${t(M.frontCounterNote, locale)}`} testId="visitor-front-counter-info" />
            <SampleDataNote locale={locale} />
          </span>
          <button
            type="button"
            className="pemo-button pemo-button--primary"
            data-tree-chrome="true"
            data-testid="visitor-register-cta"
            onClick={onRegister}
          >
            {t(M.registerCta, locale)}
          </button>
        </span>
      </div>

      <HintRow testId="visitor-boundary" text={`${t(M.boundaryStrong, locale)} ${t(M.boundaryBody, locale)}`} />

      <div className="pemo-statcards" data-testid="visitor-stats">
        <StatCard id="expected-today" label={t(M.statExpectedToday, locale)} value={counts.expected} icon="CalendarCheck" locale={locale} active={filter === 'expected'} onPress={() => chooseFilter(pressCard(filter, 'expected'))} />
        <StatCard id="on-site" label={t(M.statOnSite, locale)} value={counts.onsite} icon="DoorOpen" locale={locale} active={filter === 'onsite'} onPress={() => chooseFilter(pressCard(filter, 'onsite'))} />
        <StatCard id="not-signed-out" label={t(M.statNotSignedOut, locale)} value={counts.overdue} icon="Hourglass" tone="warning" locale={locale} active={filter === 'overdue'} onPress={() => chooseFilter(pressCard(filter, 'overdue'))} />
      </div>

      <ButtonTabs items={tabs} active={filter} locale={locale} onChange={chooseFilter} ariaLabel={t(M.statusTabsLabel, locale)} root="visitor-status" />
      {filter !== 'all' ? (
        <FilterChipRow label={filterLabel} shown={tv.view.length} total={allRows.length} locale={locale} onClear={() => chooseFilter('all')} />
      ) : null}

      <section className="pemo-panel">
        <h2 className="pemo-panel__title"><Icon name="ClipboardList" size={16} /> {t(M.todayHeading, locale)}</h2>
        <FilterBar
          locale={locale}
          testId="visitor-filters"
          searchLabel={t(TV.searchVisitors, locale)}
          query={tv.state.query}
          onQuery={tv.setQuery}
          filters={filters}
          active={tv.active}
          onClear={tv.clear}
        />
        {tv.view.length === 0 ? <NoMatches locale={locale} testId="visitor-no-matches" /> : (
        <Table caption={t(M.todayHeading, locale)} columns={columns} testId="visitor-table" sorting={{ sort: tv.state.sort, onSort: tv.onSort }}>
          {tv.view.map((r) => {
            if (r.desk) {
              const v = r.desk;
              return (
          
                <tr key={v.visit_id} data-testid="visitor-desk-row" data-status={v.status} data-source={v.source}>
                  <WrapCell title={v.name}>
                    <span style={{ fontWeight: 600 }}>{v.name}</span>
                    <div className="pemo-meta" data-alt="purpose">{r.purpose.label}</div>
                  </WrapCell>
                  <DenseCell title={r.purpose.label}>{r.purpose.label}</DenseCell>
                  <DenseCell title={hostDisplay(v.host, locale) ?? '—'}>{hostDisplay(v.host, locale) ?? '—'}</DenseCell>
                  <DenseCell title={hktStamp(v.expected_from, locale)}>{timeOnly(v.expected_from, locale)}</DenseCell>
                  <DenseCell title={v.checked_in_at ? hktStamp(v.checked_in_at, locale) : '–'}>
                    <span data-testid="visitor-in-time">{clockHHmm(v.checked_in_at)}</span>
                  </DenseCell>
                  <DenseCell title="—">—</DenseCell>
                  <td>
                    <DeskStatusCell v={v} locale={locale} onOut={(x) => void getFrontCounterClient().checkOut(x.visit_id).catch(() => null)} testPrefix="visitor-desk" />
                  </td>
                </tr>
              );
            }
            const v = r.fixture!;
            return (
          
                <tr
                  key={v.id}
                  data-testid="visitor-row"
                  data-visitor-id={v.id}
                  style={{ cursor: 'pointer', borderLeft: `3px solid ${toneBorder(v.tone)}` }}
                  onClick={() => onOpen(v.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpen(v.id);
                    }
                  }}
                  tabIndex={0}
                >
                  <WrapCell title={v.name}>
                    <span style={{ fontWeight: 600 }}>{v.name}</span>
                    <div className="pemo-meta" data-alt="purpose">{r.purpose.label}</div>
                    <div className="pemo-meta" data-alt="pass">{t(M.colPass, locale)}: {v.pass}</div>
                  </WrapCell>
                  <DenseCell title={r.purpose.label}>{r.purpose.label}</DenseCell>
                  <DenseCell title={v.hostUnit}>{v.hostUnit}</DenseCell>
                  <DenseCell title={v.expected}>
                    <span className="pemo-identifier pemo-nowrap">{v.expected}</span>
                  </DenseCell>
                  <DenseCell title={v.arrivedAt ? hktStamp(v.arrivedAt, locale) : '–'}>
                    <span className="pemo-identifier pemo-nowrap" data-testid="visitor-in-time">{clockHHmm(v.arrivedAt)}</span>
                  </DenseCell>
                  <DenseCell title={v.pass}>
                    <span className="pemo-identifier">{v.pass}</span>
                  </DenseCell>
                  <td><StateChip state={v.state} locale={locale} /></td>
                </tr>
            );
          })}
        </Table>
        )}
        <HintRow text={t(M.passNote, locale)} />
        <HintRow text={t(M.fixtureLabel, locale)} testId="visitor-fixture-label" />
      </section>
      {invitationOpen ? <VisitorRegister locale={locale} onBackToLog={onCloseDialog} /> : null}
      {detailId !== null ? <VisitorDetailDialog visitorId={detailId} locale={locale} onBack={onCloseDialog} /> : null}
    </>
  );
}

export function VisitorDetailDialog({
  visitorId,
  locale,
  onBack,
}: {
  visitorId: string;
  locale: Locale;
  onBack: () => void;
}) {
  const M = MESSAGES.visitor;
  const base = findVisitor(visitorId);
  const [row, setRow] = useState<VisitorRow | undefined>(base);
  const [checkoutNote, setCheckoutNote] = useState<string | null>(null);

  const canCheckout = useMemo(
    () => row != null && CHECKOUT_ELIGIBLE.has(row.state),
    [row],
  );

  if (!row) {
    return (
      <Dialog title={t(M.detailTitle, locale)} locale={locale} onClose={onBack} testId="visitor-dialog">
        <section data-testid="visitor-detail-missing">
          <p className="pemo-note">{t(M.notFound, locale)}</p>
          <button type="button" className="pemo-button" data-tree-chrome="true" onClick={onBack}>{t(M.backToList, locale)}</button>
        </section>
      </Dialog>
    );
  }

  const onCheckout = () => {
    if (!canCheckout) return;
    setRow({ ...row, state: 'checked-out', tone: 'normal' });
    setCheckoutNote(t(M.checkoutFixtureNote, locale));
  };

  const windowLabel = row.expectedWindow
    ? `${row.expectedWindow.start}–${row.expectedWindow.end}`
    : '—';

  return (
    <Dialog title={row.name} locale={locale} onClose={onBack} wide testId="visitor-dialog">
    <section data-testid="visitor-detail" data-visitor-id={row.id}>
      <div className="pemo-toolbar">
        <button type="button" className="pemo-button" data-tree-chrome="true" data-testid="visitor-back" onClick={onBack}>
          {t(M.backToList, locale)}
        </button>
        {canCheckout ? (
        <button
          type="button"
          className="pemo-button pemo-button--primary"
          data-tree-chrome="true"
          data-testid="visitor-checkout"
          title={t(M.checkoutHint, locale)}
          onClick={onCheckout}
        >
          {t(M.checkout, locale)}
        </button>
        ) : null}
      </div>

      <StateChip state={row.state} locale={locale} />

      <dl className="pemo-dl" style={{ marginTop: 'var(--pemo-space-4)' }}>
        <dt>{t(M.colPurpose, locale)}</dt>
        <dd>{fixturePurpose(row, locale).label}</dd>
        <dt>{t(M.colHostUnit, locale)}</dt>
        <dd>{row.hostUnit}</dd>
        <dt>{t(M.fieldHostResident, locale)}</dt>
        <dd>{row.hostResident ?? '—'}</dd>
        <dt>{t(M.fieldExpectedWindow, locale)}</dt>
        <dd><span className="pemo-identifier">{windowLabel}</span></dd>
        <dt>{t(M.colPass, locale)}</dt>
        <dd><span className="pemo-identifier">{row.pass}</span></dd>
        <dt>{t(M.fieldArrivedAt, locale)}</dt>
        <dd>{row.arrivedAt ?? '—'}</dd>
        <dt>{t(M.fieldRegisteredBy, locale)}</dt>
        <dd>{t(row.registeredBy, locale)}</dd>
        <dt>{t(M.fieldIdStub, locale)}</dt>
        <dd>{row.idStub ?? '—'}</dd>
        {row.notes ? (
          <>
            <dt>{t(M.fieldNotes, locale)}</dt>
            <dd>{t(row.notes, locale)}</dd>
          </>
        ) : null}
      </dl>

      {checkoutNote ? (
        <p className="pemo-note" data-testid="visitor-checkout-note" role="status">{checkoutNote}</p>
      ) : null}

      <HintRow text={t(M.fixtureLabel, locale)} testId="visitor-fixture-label" />
      <p className="pemo-note">{t(M.noDoorUnlock, locale)}</p>
    </section>
    </Dialog>
  );
}
