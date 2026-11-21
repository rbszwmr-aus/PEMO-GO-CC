/**
 * S1 — Home Safety events.
 *
 * Mixed-level by default: in-unit events, a location event, a block-wide
 * advisory and a quarantined event belonging to no node at all, in one list.
 * ADR-007 D5/A1 — filtering happens in the query, and a row a client would have
 * to hide has already leaked.
 *
 * @version 0.2.0
 * @changelog
 *   0.2.0 (2026-11-19) Status tabs are CardTabItem, so every tab that can become a stat card carries an icon (type-level).
 */

import { useMemo } from 'react';
import { HintRow, InfoTip, ITDetails } from '../components/FinanceBits.tsx';
import { Icon } from '../components/Icon.tsx';
import { FilterBar, NoMatches, type FilterDef } from '../components/TableControls.tsx';
import type { ViewSpec } from '../components/table-view.ts';
import type { TabItem } from '../components/Tabs.tsx';
import { StatusHead, useStatusView, type CardTabItem, type StatusDef } from '../components/StatusList.tsx';
import { SEVERITY, SEVERITY_ORDER } from '../theme/severity-tokens.g.ts';
import { unitLabel } from '../data/host-label.ts';
import { MESSAGES } from '../i18n/messages.ts';
import { copy, t, type Locale, type LocalizedText } from '../i18n/locale.ts';
import { dateTime, dateTimeShort } from '../format/datetime.ts';
import { number } from '../format/datetime.ts';
import { SeverityChip, PlainChip } from '../components/SeverityChip.tsx';
import { ScopePathCell, scopePathText, scopeShortText } from '../components/ScopePathCell.tsx';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import { Empty, PartialBanner } from '../components/StateNotice.tsx';
import { DeferredActions } from '../components/DeferredActions.tsx';
import type {
  SafetyEventDeliveryResponse, SafetyEventDetailResponse,
  SafetyEventListResponse, SafetyEventSourceResponse,
} from '../data/types.ts';
import { scopePathInFocus } from '../shell/scope-focus.ts';
import type { NodeKey } from './tree-collapse.ts';

const m = copy;

/** Named, not omitted. openapi.yaml lists these against listSafetyEvents. */
const ACT_SHORT = copy('Action', '處理', '处理');
const COMMS_SHORT = copy('Comms', '通訊', '通讯');

const DEFERRED = [
  m('Publish an update to residents', '向住戶發佈更新', '向住户发布更新'),
  m('Acknowledge receipt', '確認已接收', '确认已接收'),
  m('Request access to restricted material', '申請查閱受限資料', '申请查阅受限数据'),
  m('Export', '匯出', '汇出'),
];

type SafetyStatus = 'all' | 'action' | 'urgent' | 'overdue';
type SafetyEvent = SafetyEventListResponse['events'][number];

const URGENT: ReadonlySet<string> = new Set(['critical', 'warning']);
/** All, then the three statuses the data supports. Each tab opens on its own sort. */
const STATUSES: readonly StatusDef<SafetyEvent, SafetyStatus>[] = [
  { id: 'all', test: () => true, sort: { key: 'when', dir: 'desc' } },
  { id: 'action', test: (e) => e.needsAction, sort: { key: 'when', dir: 'desc' } },
  { id: 'urgent', test: (e) => URGENT.has(e.severity), sort: { key: 'sev', dir: 'desc' } },
  { id: 'overdue', test: (e) => e.communication === 'update-overdue', sort: { key: 'when', dir: 'asc' } },
];
const TAB_ALL = m('All', '全部', '全部');
const TAB_URGENT = m('Urgent', '緊急', '紧急');
const SEARCH = m('Search event or location', '搜尋事件或位置', '搜索事件或位置');
const ALL_SEVERITIES = m('All severities', '所有嚴重程度', '所有严重程度');
const ALL_COMMS = m('All communication', '所有通訊狀態', '所有通讯状态');

export function S1List({ data, locale, focusKey }: { data: SafetyEventListResponse; locale: Locale; focusKey?: NodeKey | null }) {
  const M = MESSAGES.s1;
  const events = useMemo(
    () => (focusKey ? data.events.filter((e) => scopePathInFocus(e.scope, focusKey)) : data.events),
    [data.events, focusKey],
  );
  const spec = useMemo<ViewSpec<SafetyEvent>>(() => ({
    searchText: (e) => `${e.reference} ${t(e.title, locale)} ${scopePathText(e.scope, locale)}`,
    filters: { severity: (e) => e.severity, communication: (e) => e.communication },
    sorts: {
      ref: (e) => e.reference,
      sev: (e) => SEVERITY_ORDER.indexOf(e.severity),
      event: (e) => t(e.title, locale),
      where: (e) => scopePathText(e.scope, locale),
      when: (e) => Date.parse(e.occurredAt),
      comms: (e) => t(M.communication[e.communication], locale),
      act: (e) => (e.needsAction ? 1 : 0),
    },
  }), [locale, M]);
  const sv = useStatusView(events, STATUSES, spec, locale);
  const { tv } = sv;
  const tabs: CardTabItem<SafetyStatus>[] = [
    { id: 'all', label: t(TAB_ALL, locale), icon: 'ClipboardList', count: sv.counts.all },
    { id: 'action', label: t(M.colAction, locale), icon: 'CircleAlert', count: sv.counts.action, alert: true },
    { id: 'urgent', label: t(TAB_URGENT, locale), icon: 'Zap', count: sv.counts.urgent, alert: true },
    { id: 'overdue', label: t(M.communication['update-overdue'], locale), icon: 'Hourglass', count: sv.counts.overdue, alert: true },
  ];
  const sevOptions = SEVERITY_ORDER.filter((l) => events.some((e) => e.severity === l)).map((l) => ({ value: l, label: t(SEVERITY[l].label, locale) }));
  const commOptions = (Object.keys(M.communication) as Array<keyof typeof M.communication>)
    .filter((k) => events.some((e) => e.communication === k)).map((k) => ({ value: k, label: t(M.communication[k], locale) }));
  const filters: FilterDef[] = [
    { key: 'severity', label: t(M.colSeverity, locale), allLabel: t(ALL_SEVERITIES, locale), options: sevOptions, value: tv.state.filters['severity'] ?? '', onChange: (v) => tv.setFilter('severity', v) },
    { key: 'communication', label: t(M.colCommunication, locale), allLabel: t(ALL_COMMS, locale), options: commOptions, value: tv.state.filters['communication'] ?? '', onChange: (v) => tv.setFilter('communication', v) },
  ];
  const columns = [
    { key: 'ref', label: t(M.colReference, locale), width: '11%', hideBelow: 600, sortable: true },
    { key: 'sev', label: t(M.colSeverity, locale), width: '12%', sortable: true },
    { key: 'event', label: t(M.colEvent, locale), width: '24%', sortable: true },
    { key: 'where', label: t(M.colWhere, locale), width: '15%', hideBelow: 480, sortable: true },
    { key: 'when', label: t(M.colOccurred, locale), width: '14%', sortable: true },
    { key: 'comms', label: t(COMMS_SHORT, locale), width: '14%', hideBelow: 720, sortable: true },
    { key: 'act', label: t(ACT_SHORT, locale), width: '10%', hideBelow: 500, sortable: true },
  ];

  return (
    <>
      {data.meta.partial ? (
        <PartialBanner locale={locale} reasons={(data.meta.degraded ?? []).map((d) => d.reason)} />
      ) : null}

      {/*
        The window count stays rendered from the contract's own numbers, not the row count:
        `returned` is what the server says it returned, and substituting `events.length` would
        hide any future disagreement. The window and retention sentences sit behind the (i).
      */}
      <p className="pemo-meta pemo-reports__period" data-testid="window-count-row">
        <Icon name="Clock" size={14} />
        <span data-testid="window-count">
          {t(M.windowCount, locale)
            .replace('{returned}', number(data.window.returned, locale))
            .replace('{total}', number(data.window.total, locale))}
        </span>
        {data.window.returned < data.window.total ? (
          <span className="pemo-source" data-testid="window-truncated" title={t(M.windowTruncated, locale)}>
            <Icon name="CircleAlert" size={14} /> {t(M.windowTruncated, locale)}
          </span>
        ) : null}
        <InfoTip
          testId="retention"
          text={`${t(M.windowLine, locale)}. ${t(M.retentionLabel, locale)} ${number(data.window.retentionMonths, locale)} ${t(M.months, locale)}`}
        />
      </p>

      {focusKey ? (
        <p className="pemo-note" data-testid="scope-filter-note" data-screen="s1">
          {t(MESSAGES.shell.filterNote, locale)}
        </p>
      ) : null}

      {events.length === 0 ? (
        <Empty locale={locale} />
      ) : (
        <>
          <StatusHead
            tabs={tabs}
            cardIds={['action', 'urgent', 'overdue']}
            filter={sv.filter}
            onChoose={sv.choose}
            onPress={sv.press}
            shown={tv.view.length}
            total={events.length}
            locale={locale}
            root="s1-status"
            ariaLabel={t(M.title, locale)}
            cardsTestId="s1-stats"
          />
          <section className="pemo-panel">
            <FilterBar
              locale={locale}
              testId="s1-filters"
              searchLabel={t(SEARCH, locale)}
              query={tv.state.query}
              onQuery={tv.setQuery}
              filters={filters}
              active={tv.active}
              onClear={tv.clear}
            />
            {tv.view.length === 0 ? <NoMatches locale={locale} testId="s1-no-matches" /> : (
              <Table caption={t(M.title, locale)} columns={columns} testId="s1-table" sorting={{ sort: tv.state.sort, onSort: tv.onSort }}>
                {tv.view.map((e) => (
                  <tr key={e.eventId} data-testid="s1-row" data-severity={e.severity}>
                    <DenseCell title={e.reference}>
                      <span className="pemo-identifier pemo-nowrap">{e.reference.replace(/^HS-\d{4}-\d{2}-\d{2}-/, 'HS-')}</span>
                    </DenseCell>
                    <td><SeverityChip level={e.severity} locale={locale} /></td>
                    <WrapCell title={t(e.title, locale)}>
                      {t(e.title, locale)}
                      <div className="pemo-meta" data-alt="where">{e.scope.unassigned ? t(MESSAGES.s1.unassignedBadge, locale) : scopeShortText(e.scope, locale)}</div>
                      <div className="pemo-meta pemo-nowrap" data-alt="ref">{e.reference}</div>
                      {e.needsAction ? <div className="pemo-meta" data-alt="act">{t(M.needsAction, locale)}</div> : null}
                    </WrapCell>
                    <td>
                      <ScopePathCell scope={e.scope} locale={locale} short />
                    </td>
                    <DenseCell title={dateTime(e.occurredAt, locale)}><span className="pemo-nowrap">{dateTimeShort(e.occurredAt, locale)}</span></DenseCell>
                    <DenseCell title={t(M.communication[e.communication], locale)}>
                      {t(M.communication[e.communication], locale)}
                    </DenseCell>
                    <td>{e.needsAction ? t(M.needsAction, locale) : t(M.noAction, locale)}</td>
                  </tr>
                ))}
              </Table>
            )}
            {/* Gated on the row it describes: only a quarantined row has anything to explain. */}
            {tv.view.some((e) => e.scope.unassigned) ? (
              <HintRow text={t(M.unassignedNote, locale)} testId="unassigned-note" />
            ) : null}
          </section>
        </>
      )}

      <DeferredActions locale={locale} actions={DEFERRED} />
    </>
  );
}

export function S1Detail({ data, locale }: { data: SafetyEventDetailResponse; locale: Locale }) {
  const M = MESSAGES.s1;
  const e = data.event;
  return (
    <>
      <section className="pemo-panel">
        <h2 className="pemo-panel__title">{t(e.title, locale)}</h2>
        <dl className="pemo-dl">
          <dt>{t(M.colReference, locale)}</dt>
          <dd><span className="pemo-identifier">{e.reference}</span></dd>
          <dt>{t(M.colSeverity, locale)}</dt>
          <dd><SeverityChip level={e.severity} locale={locale} /></dd>
          <dt>{t(M.colWhere, locale)}</dt>
          <dd><ScopePathCell scope={e.scope} locale={locale} /></dd>
          <dt>{t(M.colOccurred, locale)}</dt>
          <dd>{dateTime(e.occurredAt, locale)}</dd>
          <dt>{t(M.colCommunication, locale)}</dt>
          <dd>{t(M.communication[e.communication], locale)}</dd>
        </dl>
        {e.unmappedSourceRef ? (
          <ITDetails
            locale={locale}
            testId="s1-detail-it-details"
            rows={[[M.sourceRefLabel, <span data-testid="unmapped-source-ref" key="r">{e.unmappedSourceRef}</span>]]}
          />
        ) : null}
      </section>

      <section className="pemo-panel" data-testid="resident-projection">
        <h2 className="pemo-panel__title">{t(M.residentHeading, locale)}</h2>
        <dl className="pemo-dl">
          <dt>{t(MESSAGES.s5.colTitle, locale)}</dt>
          <dd>{t(data.residentProjection.title, locale)}</dd>
          <dt>{t(M.instruction, locale)}</dt>
          <dd>{t(data.residentProjection.instruction, locale)}</dd>
          <dt>{t(M.disclaimer, locale)}</dt>
          <dd data-testid="statutory-disclaimer">{t(data.residentProjection.disclaimer, locale)}</dd>
        </dl>
      </section>

      <DeferredActions locale={locale} actions={DEFERRED} />
    </>
  );
}

export function S1Delivery({ data, locale }: { data: SafetyEventDeliveryResponse; locale: Locale }) {
  const M = MESSAGES.s1;
  const columns = [
    { key: 'who', label: t(M.colRecipient, locale), width: '35%' },
    { key: 'role', label: t(M.colRole, locale), width: '30%' },
    { key: 'state', label: t(M.colDelivery, locale), width: '35%' },
  ];
  return (
    <>
      <section className="pemo-panel">
        <h2 className="pemo-panel__title">{t(M.recipients, locale)}</h2>
        <Table caption={t(M.recipients, locale)} columns={columns} testId="s1-recipients">
          {data.recipients.map((r) => (
            <tr key={r.recipientId} data-testid="recipient-row">
              <WrapCell title={r.name}>{r.name}</WrapCell>
              <WrapCell>{t(r.role, locale)}</WrapCell>
              <td>
                {/* Read 09:43 is TWO facts. The contract splits them and so does this. */}
                <PlainChip>{t(M.deliveryStatus[r.state.status], locale)}</PlainChip>
                {r.state.at ? <span className="pemo-meta"> {dateTime(r.state.at, locale)}</span> : null}
              </td>
            </tr>
          ))}
        </Table>
      </section>

      <section className="pemo-panel">
        <h2 className="pemo-panel__title">{t(M.timeline, locale)}</h2>
        <ul className="pemo-steps">
          {data.timeline.map((item, i) => (
            <li key={i} className="pemo-step" data-testid="timeline-item">
              <span className="pemo-meta" style={{ minWidth: '9rem' }}>{dateTime(item.at, locale)}</span>
              <span className="pemo-cell--wrap">{t(item.what, locale)}</span>
              {/* `by` is a NAME, not translatable copy — rendered as received. */}
              {item.by ? <span className="pemo-meta">{t(M.by, locale)}: {item.by}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export function S1Source({ data, locale }: { data: SafetyEventSourceResponse; locale: Locale }) {
  const M = MESSAGES.s1;
  return (
    <section className="pemo-panel" data-testid="s1-source">
      <h2 className="pemo-panel__title">{t(M.tabSource, locale)}</h2>
      <HintRow text={t(M.bothAttributions, locale)} />
      <dl className="pemo-dl" style={{ marginTop: 'var(--pemo-space-4)' }}>
        <dt>{t(M.sourceSystem, locale)}</dt>
        <dd>{t(MESSAGES.s3.systemName.twoiothub, locale)}</dd>

        {/* Both attributions explicit — ADR-006 C5, and the resolution of the
            sharpest disagreement the analysis found. The source classifies its
            own event; PEMO classifies what is shown. */}
        <dt>{t(M.pemoShows, locale)}</dt>
        <dd data-testid="pemo-classification">
          <SeverityChip level={data.classification.pemo.severity} locale={locale} />
        </dd>

        <dt>{t(M.occurredAtSource, locale)}</dt>
        <dd>{dateTime(data.occurredAt, locale)}</dd>

        <dt>{t(M.mappingState, locale)}</dt>
        <dd data-testid="mapping-state">
          <PlainChip>{t(M.mapping[data.mapping.state], locale)}</PlainChip>
        </dd>

        {data.mapping.unitId && unitLabel(data.mapping.unitId, locale) ? (
          <>
            <dt>{t(M.mappedTo, locale)}</dt>
            <dd data-testid="mapped-to">{unitLabel(data.mapping.unitId, locale)}</dd>
          </>
        ) : null}
      </dl>
      <ITDetails
        locale={locale}
        testId="s1-source-it-details"
        rows={[
          [M.sourceEventRef, <span data-testid="source-event-id" key="e">{data.sourceEventId}</span>],
          [M.sourceSaid, <span data-testid="source-classification" key="c">{data.classification.source.code} · {data.classification.source.level}</span>],
          [M.policyVersion, data.classification.pemo.policyVersion],
          ...(data.mapping.sourceNodeRef ? [[M.sourceRefLabel, <span data-testid="source-node-ref" key="n">{data.mapping.sourceNodeRef}</span>] as const] : []),
          ...(data.mapping.unitId ? [[M.mappedTo, data.mapping.unitId] as const] : []),
        ]}
      />
      {data.mapping.state === 'unmapped' ? (
        <p className="pemo-note" data-testid="quarantine-note">{t(M.unassignedNote, locale)}</p>
      ) : null}
    </section>
  );
}
