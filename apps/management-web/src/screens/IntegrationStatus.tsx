/**
 * Integration status (S05): what the 2IoT Hub has told PEMO about the building systems.
 *
 * PEMO does not connect to a lift, a camera, a charger or a car-park barrier. The 2IoT Hub does, and
 * reports; PEMO shows what it was told and works out one thing itself: that the Hub has gone quiet, in which
 * case it says “unknown” and never “offline”. So the Hub is shown first, as the boundary, and the systems
 * under it. This screen reads and shows; no control on it starts, stops or changes a system.
 *
 * Names, not ids: the system’s name, its kind in words, the place by its name in the property tree. System
 * and node references, the Hub’s instance and version, device codes and the Hub’s place hint sit in the
 * collapsed IT details.
 *
 * @version 0.2.0
 * @changelog
 *   0.2.0 (2026-11-19) Summary tiles carry an icon each (KPI_ICON).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { bcp47, t, type Locale } from '../i18n/locale.ts';
import { dateTime } from '../format/datetime.ts';
import { Table, WrapCell } from '../components/Table.tsx';
import { FilterBar, NoMatches, type FilterDef } from '../components/TableControls.tsx';
import { useTableView } from '../components/useTableView.ts';
import type { ViewSpec } from '../components/table-view.ts';
import { BackLink, ITDetails, SourceTag, StatusTag, TitleStrip, HintRow } from '../components/FinanceBits.tsx';
import { StatCard } from '../components/StatCard.tsx';
import { Loading, ProblemState } from '../components/StateNotice.tsx';
import type { TagTone } from '../finance/finance-ui.ts';
import type { IconName } from '../components/Icon.tsx';
import type { Problem } from '../data/types.ts';
import { ApiError, type SourceKind } from '../data/sourced.ts';
import { deviceText, fill, kindText, placeLabel, saidText } from '../integration/integration-text.ts';
import { integrationSource } from '../integration/integration-client.ts';
import type { IntegrationVariant } from '../integration/integration-fixture.ts';
import {
  ESTATE_NODE_ID, SYSTEM_STATES, agoText, hubIsQuiet,
  type HistoryEntry, type IntegrationDetailResponse, type IntegrationStatusResponse, type IntegrationSystem,
} from '../integration/integration-status.ts';

const M = MESSAGES.integration;

const asProblem = (err: unknown): Problem => (err instanceof ApiError
  ? err.problem
  : { type: 'https://pemo.local/problems/internal-error', title: 'Something went wrong', status: 0, correlationId: 'none' });

const STATE_TAG: Record<(typeof SYSTEM_STATES)[number], { tone: TagTone; icon: IconName }> = {
  online: { tone: 'positive', icon: 'CircleCheck' },
  degraded: { tone: 'attention', icon: 'CircleAlert' },
  offline: { tone: 'urgent', icon: 'CloudOff' },
  unknown: { tone: 'neutral', icon: 'CircleDashed' },
  maintenance: { tone: 'info', icon: 'Clock' },
};
const known = (s: string): s is keyof typeof STATE_TAG => Object.hasOwn(STATE_TAG, s);

/** The tag for a state. A state this build does not know is shown as Unknown, never as the raw word. */
function StateTag({ state, locale, testId }: { state: string; locale: Locale; testId?: string }) {
  const s = known(state) ? state : 'unknown';
  return <StatusTag tone={STATE_TAG[s].tone} icon={STATE_TAG[s].icon} testId={testId}>{t(M.systemState[s], locale)}</StatusTag>;
}

const detailHref = (locale: Locale, ref: string) => `?screen=integrationStatusDetail&state=detail&lang=${locale}&system=${encodeURIComponent(ref)}`;

type Load<T> =
  | { status: 'loading' }
  | { status: 'problem'; problem: Problem }
  | { status: 'ready'; data: T; source: SourceKind };

/* ------------------------------------------------------------------ list */

function HubCard({ data, locale, filters, setFilter }: { data: IntegrationStatusResponse; locale: Locale; filters: Readonly<Record<string, string>>; setFilter: (key: string, value: string) => void }) {
  const { summary } = data;
  const hub = data.hubs[0];
  const state = summary.hubState;
  if (state === null) return null;
  const now = data.meta.generatedAt;
  const tag = state === 'online' ? { tone: 'positive' as const, icon: 'CircleCheck' as const }
    : state === 'late' ? { tone: 'attention' as const, icon: 'Clock' as const }
      : { tone: 'urgent' as const, icon: 'CloudOff' as const };
  const quiet = hubIsQuiet(state);
  return (
    <section className="pemo-panel" data-testid="integration-hub" data-hub-state={state}>
      <TitleStrip title={t(M.hubTitle, locale)} testId="integration-hub-title">
        {summary.lastHeartbeatAt ? (
          <span className="pemo-meta" data-testid="integration-hub-heartbeat">
            {fill(t(M.lastHeartbeat, locale), { ago: agoText(summary.lastHeartbeatAt, now, bcp47(locale)) })}
          </span>
        ) : null}
      </TitleStrip>
      <HintRow text={t(M.hubIntro, locale)} testId="integration-hub-intro" />
      <p className="pemo-integration__hubline" data-testid={`integration-hub-is-${state}`}>
        <StatusTag tone={tag.tone} icon={tag.icon} testId="integration-hub-state">{t(M.hubState[state], locale)}</StatusTag>
        <span data-testid="integration-hub-sentence">{t(M.hubSentence[state], locale)}</span>
      </p>
      {quiet || state === 'late' ? <p className="pemo-note" data-testid="integration-hub-hint">{t(M.hubHint, locale)}</p> : null}
      {summary.lastSnapshotAt ? (
        <p className="pemo-meta" data-testid="integration-hub-report">{fill(t(M.lastFullReport, locale), { ago: agoText(summary.lastSnapshotAt, now, bcp47(locale)) })}</p>
      ) : null}
      <Kpis data={data} locale={locale} systems={data.systems} filters={filters} setFilter={setFilter} />
      {hub ? (
        <ITDetails
          locale={locale}
          testId="integration-hub-it-details"
          rows={[
            [M.factHub, hub.itDetails.hubInstance],
            [M.factEstate, hub.itDetails.estateNodeId],
            [M.factVersion, hub.itDetails.version],
            [M.factUptime, hub.itDetails.uptimeS],
            ...(hub.itDetails.outbox ? [
              [M.factOutbox, hub.itDetails.outbox.pending] as const,
              ...(hub.itDetails.outbox.oldestOccurredAt ? [[M.factOutboxOldest, hub.itDetails.outbox.oldestOccurredAt] as const] : []),
            ] : []),
          ]}
        />
      ) : null}
    </section>
  );
}

type KpiKey = 'connected' | 'online' | 'attention' | 'unknown' | 'maintenance' | 'not-placed' | 'devices';

/** One glyph per summary tile, from the local icon set. */
const KPI_ICON: Record<KpiKey, IconName> = {
  connected: 'Radio', online: 'CircleCheck', attention: 'CircleAlert', unknown: 'CircleDashed', maintenance: 'Hourglass', 'not-placed': 'MapPin', devices: 'Nfc',
};

/**
 * The summary tiles. A tile filters the systems table only when the rows it would show are exactly the
 * number it states (the hub's summary can be larger than the list, or blank while the hub is quiet);
 * otherwise it stays plain text.
 */
function Kpis({ data, locale, systems, filters, setFilter }: {
  data: IntegrationStatusResponse;
  locale: Locale;
  systems: readonly IntegrationSystem[];
  filters: Readonly<Record<string, string>>;
  setFilter: (key: string, value: string) => void;
}) {
  const s = data.summary;
  const quiet = hubIsQuiet(s.hubState);
  const num = new Intl.NumberFormat(bcp47(locale));
  const rowsOf: Partial<Record<KpiKey, { n: number; key: string; value: string }>> = {
    online: { n: systems.filter((x) => x.state === 'online').length, key: 'status', value: 'online' },
    attention: { n: systems.filter((x) => x.needsAttention).length, key: 'attn', value: 'attention' },
    unknown: { n: systems.filter((x) => x.state === 'unknown').length, key: 'status', value: 'unknown' },
    maintenance: { n: systems.filter((x) => x.state === 'maintenance').length, key: 'status', value: 'maintenance' },
    'not-placed': { n: systems.filter((x) => x.needsMapping).length, key: 'unmapped', value: 'not-placed' },
  };
  const tiles: Array<{ key: KpiKey; label: string; value: string; stated: number; alert?: boolean }> = [
    { key: 'connected', label: t(M.kpiConnected, locale), value: num.format(s.systemsTotal), stated: s.systemsTotal },
    { key: 'online', label: t(M.kpiOnline, locale), value: quiet ? t(M.noValue, locale) : num.format(s.online), stated: quiet ? -1 : s.online },
    { key: 'attention', label: t(M.kpiAttention, locale), value: num.format(s.needsAttention), stated: s.needsAttention, alert: s.needsAttention > 0 },
    ...(s.unknown > 0 ? [{ key: 'unknown' as const, label: t(M.kpiUnknown, locale), value: num.format(s.unknown), stated: s.unknown, alert: true }] : []),
    ...(s.maintenance > 0 ? [{ key: 'maintenance' as const, label: t(M.kpiMaintenance, locale), value: num.format(s.maintenance), stated: s.maintenance }] : []),
    ...(s.needsMapping > 0 ? [{ key: 'not-placed' as const, label: t(M.kpiNotPlaced, locale), value: num.format(s.needsMapping), stated: s.needsMapping, alert: true }] : []),
    ...(s.devicesTotal > 0 ? [{
      key: 'devices' as const,
      label: t(M.kpiDevices, locale),
      value: quiet ? t(M.noValue, locale) : `${num.format(s.devicesOnline)} / ${num.format(s.devicesTotal)}`,
      stated: -1,
    }] : []),
  ];
  const lit = (k: KpiKey) => { const r = rowsOf[k]; return r !== undefined && filters[r.key] === r.value; };
  return (
    <div className="pemo-statcards pemo-integration__kpis" data-testid="integration-kpis">
      {tiles.map((k) => {
        const r = rowsOf[k.key];
        const press = r !== undefined && r.n === k.stated && k.stated > 0;
        return (
          <StatCard
            key={k.key}
            id={k.key}
            label={k.label}
            value={k.value}
            locale={locale}
            icon={KPI_ICON[k.key]}
            tone={k.alert ? 'warning' : undefined}
            active={press && lit(k.key)}
            onPress={press && r ? () => { setFilter('status', ''); setFilter('attn', ''); setFilter('unmapped', ''); if (!lit(k.key)) setFilter(r.key, r.value); } : undefined}
          />
        );
      })}
    </div>
  );
}

export function IntegrationStatusList({ locale, variant = 'list', onOpen }: {
  locale: Locale;
  variant?: IntegrationVariant;
  onOpen?: (systemRef: string) => void;
}) {
  const [load, setLoad] = useState<Load<IntegrationStatusResponse>>({ status: 'loading' });
  const run = useRef(0);
  useEffect(() => {
    const mine = ++run.current;
    setLoad({ status: 'loading' });
    void integrationSource().read(variant).then(
      (r) => { if (mine === run.current) setLoad({ status: 'ready', data: r.response, source: r.source }); },
      (err: unknown) => { if (mine === run.current) setLoad({ status: 'problem', problem: asProblem(err) }); },
    );
  }, [variant]);

  const systems = load.status === 'ready' ? load.data.systems : [];
  const quiet = load.status === 'ready' && hubIsQuiet(load.data.summary.hubState);
  const spec = useMemo<ViewSpec<IntegrationSystem>>(() => ({
    searchText: (s) => `${t(s.displayName, locale)} ${kindText(s, locale)} ${saidText(s, locale)} ${placeLabel(s.itDetails.placeNodeId, locale)}`,
    filters: { status: (s) => s.state, place: (s) => s.itDetails.placeNodeId ?? ESTATE_NODE_ID, attn: (s) => (s.needsAttention ? 'attention' : ''), unmapped: (s) => (s.needsMapping ? 'not-placed' : '') },
  }), [locale]);
  const { view, state, setQuery, setFilter, clear, active } = useTableView(systems, spec, null, locale);

  if (load.status === 'loading') return <Loading locale={locale} />;
  if (load.status === 'problem') return <ProblemState problem={load.problem} locale={locale} />;
  const data = load.data;
  const placeOptions = [...new Map(systems.map((s) => [s.itDetails.placeNodeId ?? ESTATE_NODE_ID, placeLabel(s.itDetails.placeNodeId, locale)])).entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, bcp47(locale)));
  const filters: FilterDef[] = [
    {
      key: 'status', label: t(M.filterStatus, locale), allLabel: t(M.allStatuses, locale), value: state.filters['status'] ?? '', onChange: (v) => setFilter('status', v),
      options: SYSTEM_STATES.filter((st) => systems.some((s) => s.state === st)).map((st) => ({ value: st, label: t(M.systemState[st], locale) })),
    },
    { key: 'place', label: t(M.filterPlace, locale), allLabel: t(M.allPlaces, locale), value: state.filters['place'] ?? '', onChange: (v) => setFilter('place', v), options: placeOptions },
  ];
  const columns = [
    { key: 'system', label: t(M.colSystem, locale), width: '18%' },
    { key: 'type', label: t(M.colType, locale), width: '14%', hideBelow: 700 },
    { key: 'status', label: t(M.colStatus, locale), width: '15%' },
    { key: 'said', label: t(M.colSaid, locale), width: '21%' },
    { key: 'since', label: t(M.colSince, locale), width: '12%', hideBelow: 700 },
    { key: 'devices', label: t(M.colDevices, locale), width: '11%', hideBelow: 700 },
    { key: 'where', label: t(M.colWhere, locale), width: '12%' },
  ];

  return (
    <div className="pemo-integration" data-testid="integration-status" data-scope={data.scope} data-variant={variant}>
      <HubCard data={data} locale={locale} filters={state.filters} setFilter={setFilter} />
      {data.scope === 'places' ? (
        <section className="pemo-panel" data-testid="integration-places">
          <HintRow text={t(M.placesNote, locale)} testId="integration-places-note" />
          {systems.length > 0 ? <Kpis data={data} locale={locale} systems={systems} filters={state.filters} setFilter={setFilter} /> : null}
        </section>
      ) : null}

      <section className="pemo-panel" data-testid="integration-systems">
        <TitleStrip title={t(M.systemsTitle, locale)} testId="integration-systems-title">
          <SourceTag live={load.source === 'live'} locale={locale} testId="integration-source" />
        </TitleStrip>
        {systems.length === 0 ? (
          <div className="pemo-state" role="status" data-testid="integration-empty">
            <h2 className="pemo-state__title">{t(data.scope === 'places' ? M.emptyPlacesTitle : M.emptyEstateTitle, locale)}</h2>
            <p className="pemo-state__body">{t(data.scope === 'places' ? M.emptyPlacesBody : M.emptyEstateBody, locale)}</p>
          </div>
        ) : (
          <>
            <FilterBar
              locale={locale}
              testId="integration-filters"
              searchLabel={t(M.search, locale)}
              query={state.query}
              onQuery={setQuery}
              filters={filters}
              active={active}
              onClear={clear}
            />
            <p className="pemo-meta" data-testid="integration-count" data-count={view.length}>
              {fill(t(M.showing, locale), { n: view.length, total: systems.length })}
            </p>
            {view.length === 0 ? <NoMatches locale={locale} testId="integration-no-match" /> : (
              <Table caption={t(M.systemsTitle, locale)} columns={columns} testId="integration-systems-table">
                {view.map((s) => {
                  const where = placeLabel(s.itDetails.placeNodeId, locale);
                  const said = saidText(s, locale);
                  return (
                    <tr key={s.systemRef} data-testid="integration-row" data-system={s.systemRef} data-state={s.state}>
                      <td>
                        <a
                          className="pemo-rowlink"
                          href={detailHref(locale, s.systemRef)}
                          data-testid="integration-open"
                          data-read-affordance="navigate"
                          onClick={(e) => { if (onOpen) { e.preventDefault(); onOpen(s.systemRef); } }}
                        >
                          <span>{t(s.displayName, locale)}</span>
                        </a>
                        <div className="pemo-meta" data-alt="type">{kindText(s, locale)}</div>
                      </td>
                      <WrapCell title={kindText(s, locale)}>{kindText(s, locale)}</WrapCell>
                      <td><StateTag state={s.state} locale={locale} testId="integration-row-state" /></td>
                      <td data-testid="integration-said">
                        <div>{said}</div>
                        {s.state === 'maintenance' && s.expectedEnd ? (
                          <div className="pemo-meta" data-testid="integration-expected">{fill(t(M.expectedBack, locale), { when: dateTime(s.expectedEnd, locale) })}</div>
                        ) : null}
                        {s.needsAttention && s.state !== 'unknown' ? <div className="pemo-meta" data-testid="integration-attention">{t(M.needsAttention, locale)}</div> : null}
                        {s.needsMapping ? <div className="pemo-meta" data-testid="integration-not-placed">{t(M.notPlaced, locale)}</div> : null}
                        <div className="pemo-meta" data-alt="since">{s.since && !quiet ? dateTime(s.since, locale) : ''}</div>
                        <div className="pemo-meta" data-alt="devices">{deviceText(s, quiet, locale)}</div>
                      </td>
                      <WrapCell>{s.since && !quiet ? dateTime(s.since, locale) : t(M.noValue, locale)}</WrapCell>
                      <WrapCell>{deviceText(s, quiet, locale)}</WrapCell>
                      <WrapCell title={where}>{where}</WrapCell>
                    </tr>
                  );
                })}
              </Table>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- detail */

function causeText(h: HistoryEntry, locale: Locale): string {
  if (h.cause === 'derived') {
    const why = h.reason && Object.hasOwn(M.unknownReason, h.reason) ? t(M.unknownReason[h.reason], locale) : t(M.unknownReasonOther, locale);
    return fill(t(M.causeDerived, locale), { why });
  }
  return h.message.en === M.causeReport.en ? t(M.causeReport, locale) : `${t(M.causeReport, locale)} ${t(h.message, locale)}`;
}

export function IntegrationStatusDetail({ locale, systemRef, variant = 'list', onBack }: {
  locale: Locale;
  systemRef: string;
  variant?: IntegrationVariant;
  onBack?: () => void;
}) {
  const [load, setLoad] = useState<Load<IntegrationDetailResponse>>({ status: 'loading' });
  const run = useRef(0);
  useEffect(() => {
    const mine = ++run.current;
    setLoad({ status: 'loading' });
    void integrationSource().readDetail(systemRef, variant).then(
      (r) => { if (mine === run.current) setLoad({ status: 'ready', data: r.response, source: r.source }); },
      (err: unknown) => { if (mine === run.current) setLoad({ status: 'problem', problem: asProblem(err) }); },
    );
  }, [systemRef, variant]);

  if (load.status === 'loading') return <Loading locale={locale} />;
  if (load.status === 'problem') return <ProblemState problem={load.problem} locale={locale} />;
  const { system: s, history, itDetails } = load.data;
  const listHref = `?screen=integrationStatus&state=list&lang=${locale}`;
  const where = placeLabel(s.itDetails.placeNodeId, locale);
  const placeBy = s.itDetails.placeSource ?? 'nobody';
  const row = (label: string, value: string, testId: string) => (
    <>
      <dt>{label}</dt>
      <dd data-testid={testId}>{value}</dd>
    </>
  );

  return (
    <div className="pemo-integration" data-testid="integration-detail" data-system={s.systemRef}>
      <section className="pemo-panel">
        <BackLink href={listHref} label={M.backToList} locale={locale} onBack={() => onBack?.()} testId="integration-back" />
        <TitleStrip title={t(s.displayName, locale)} testId="integration-detail-title">
          <SourceTag live={load.source === 'live'} locale={locale} testId="integration-source" />
        </TitleStrip>
        <p><StateTag state={s.state} locale={locale} testId="integration-detail-state" /></p>
        <p data-testid="integration-detail-said">{saidText(s, locale)}</p>
        <dl className="pemo-dl" data-testid="integration-detail-facts">
          {row(t(M.colType, locale), kindText(s, locale), 'integration-detail-type')}
          {row(t(M.colWhere, locale), where, 'integration-detail-where')}
          {s.since ? row(t(M.colSince, locale), dateTime(s.since, locale), 'integration-detail-since') : null}
          {s.lastSeenAt ? row(t(M.lastHeardFrom, locale), dateTime(s.lastSeenAt, locale), 'integration-detail-seen') : null}
          {s.lastSnapshotAt ? row(t(M.lastReport, locale), dateTime(s.lastSnapshotAt, locale), 'integration-detail-report') : null}
          {s.state === 'maintenance' && s.expectedEnd ? row(t(M.expectedBackLabel, locale), dateTime(s.expectedEnd, locale), 'integration-detail-expected') : null}
          {s.devicesTotal > 0 && s.state !== 'unknown' ? row(t(M.colDevices, locale), deviceText(s, false, locale), 'integration-detail-devices') : null}
        </dl>
        {s.needsMapping ? <p className="pemo-note" data-testid="integration-detail-not-placed">{t(M.notPlaced, locale)}</p> : null}
        <ITDetails
          locale={locale}
          testId="integration-it-details"
          rows={[
            [M.factSystem, s.systemRef],
            [M.factEstate, s.itDetails.estateNodeId],
            [M.factPlace, s.itDetails.placeNodeId ?? '—'],
            [M.factPlaceBy, t(M.placeBy[placeBy], locale)],
            ...(s.itDetails.hubPlaceNodeId ? [[M.factHubPlace, s.itDetails.hubPlaceNodeId] as const] : []),
            ...(s.itDetails.placeMismatch !== null ? [[M.factMismatch, t(s.itDetails.placeMismatch ? M.yes : M.no, locale)] as const] : []),
            [M.factReportedState, t(known(s.reportedState) ? M.systemState[s.reportedState] : M.systemState.unknown, locale)],
            ...(s.itDetails.source ? [[M.factSource, s.itDetails.source] as const] : []),
            ...(s.itDetails.detailCode ? [[M.factCode, s.itDetails.detailCode] as const] : []),
            ...(s.itDetails.hubState ? [[M.factHubState, t(M.hubState[s.itDetails.hubState], locale)] as const] : []),
            ...itDetails.recentDeviceChanges.map((d) => [M.factDevice, `${d.hubRef}: ${d.state}${d.since ? `, ${d.since}` : ''}`] as const),
          ]}
        />
      </section>

      <section className="pemo-panel" data-testid="integration-history">
        <TitleStrip title={t(M.historyTitle, locale)} testId="integration-history-title" />
        {history.length === 0 ? <p className="pemo-note" data-testid="integration-history-empty">{t(M.historyEmpty, locale)}</p> : (
          <ol className="pemo-integration__history">
            {history.map((h) => (
              <li key={`${h.at}-${h.to}`} data-testid="integration-history-row" data-cause={h.cause} data-to={h.to}>
                <span className="pemo-integration__when">{dateTime(h.at, locale)}</span>
                <span className="pemo-integration__change">
                  {h.from ? <><StateTag state={h.from} locale={locale} /><span aria-hidden="true">→</span></> : null}
                  <StateTag state={h.to} locale={locale} />
                </span>
                <span>{h.from === null ? t(M.firstReport, locale) : causeText(h, locale)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
