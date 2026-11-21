/**
 * S4 — Cases.
 *
 * Two collapses in the export that the contract undoes, and this screen keeps
 * undone:
 *   - "Unassigned" is a STATE, rendered in the same column as a person's name.
 *   - TARGET carries "Overdue 4h", "Due in 2h" and "Met" — an elapsed time, a
 *     future time and an outcome, wearing one string.
 *
 * Status and service target are INDEPENDENT. The analysis records no stated
 * relationship between them, so none is invented: a resolved case may have met
 * or missed its target.
 *
 * The boundary the export states and the contract keeps: enquiries and
 * complaints from residents live in PEMO; maintenance execution stays in the
 * external maintenance system, which ADR-007 A5 records as an outward write path
 * PEMO has never had.
 *
 * @version 0.2.0
 * @changelog
 *   0.2.0 (2026-11-19) Assigned-to-me card uses the list glyph; status tabs are CardTabItem (icon required).
 */

import { useMemo } from 'react';
import { FilterBar, NoMatches, type FilterDef } from '../components/TableControls.tsx';
import type { ViewSpec } from '../components/table-view.ts';
import type { TabItem } from '../components/Tabs.tsx';
import { StatusHead, useStatusView, type CardTabItem, type StatusDef } from '../components/StatusList.tsx';
import { HintRow } from '../components/FinanceBits.tsx';
import { MESSAGES } from '../i18n/messages.ts';
import { copy, t, type Locale, type LocalizedText } from '../i18n/locale.ts';
import { dateTime, minutes } from '../format/datetime.ts';
import { PlainChip } from '../components/SeverityChip.tsx';
import { ScopePathCell, scopePathText } from '../components/ScopePathCell.tsx';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import { Empty } from '../components/StateNotice.tsx';
import { DeferredActions } from '../components/DeferredActions.tsx';
import type { CaseListResponse, ServiceTarget } from '../data/types.ts';
import { scopePathInFocus } from '../shell/scope-focus.ts';
import type { NodeKey } from './tree-collapse.ts';

/** Statuses that count as open (matches Overview open-cases / counts.open). */
const OPEN_CASE_STATUSES = new Set(['new', 'in-progress', 'awaiting-resident']);

export type CaseListFilter = 'open' | undefined;

const m = copy;

const DEFERRED = [
  m('Create a case', '建立個案', '建立案件'),
  m('Assign or reassign', '指派或重新指派', '指派或重新指派'),
  m('Re-categorise', '更改類別', '更改类别'),
  m('Close a case', '結束個案', '结束案件'),
  m('Save this filter', '儲存此篩選', '保存此筛选'),
];

/** The target: state first, then its time, never fused into one string. */
function TargetCell({ target, locale }: { target: ServiceTarget; locale: Locale }) {
  return (
    <td data-testid="target-cell" data-target-state={target.state}>
      <PlainChip testId="target-state">{t(MESSAGES.s2.targetState[target.state], locale)}</PlainChip>
      {target.elapsedMinutes !== null && target.elapsedMinutes !== undefined ? (
        <div className="pemo-meta" data-testid="target-elapsed">{minutes(target.elapsedMinutes, locale)}</div>
      ) : null}
      {target.dueAt ? (
        <div className="pemo-meta" data-testid="target-due">{dateTime(target.dueAt, locale)}</div>
      ) : null}
    </td>
  );
}

type CaseTab = 'all' | 'open' | 'overdue';
type CaseRow = CaseListResponse['cases'][number];
/** All, then the two work queues; each tab opens on its own sort. */
const STATUSES: readonly StatusDef<CaseRow, CaseTab>[] = [
  { id: 'all', test: () => true, sort: { key: 'ref', dir: 'desc' } },
  { id: 'open', test: (x) => OPEN_CASE_STATUSES.has(x.status), sort: { key: 'ref', dir: 'asc' } },
  { id: 'overdue', test: (x) => x.target.state === 'overdue', sort: { key: 'target', dir: 'desc' } },
];
const SEARCH = m('Search case, subject or location', '搜尋個案、主旨或位置', '搜索案件、主题或位置');
const ALL_CATEGORIES = m('All categories', '所有類別', '所有类别');

export function S4Cases({
  data,
  locale,
  filter,
  focusKey,
}: {
  data: CaseListResponse;
  locale: Locale;
  /** URL-carried list filter; `open` keeps new / in-progress / awaiting-resident. */
  filter?: CaseListFilter;
  focusKey?: NodeKey | null;
}) {
  const M = MESSAGES.s4;
  const cases = useMemo(
    () => (focusKey ? data.cases.filter((c) => scopePathInFocus(c.scope, focusKey)) : data.cases),
    [data.cases, focusKey],
  );
  const spec = useMemo<ViewSpec<CaseRow>>(() => ({
    searchText: (c) => `${c.reference} ${t(c.subject, locale)} ${scopePathText(c.scope, locale)}`,
    filters: { category: (c) => c.category },
    sorts: {
      ref: (c) => c.reference,
      subject: (c) => t(c.subject, locale),
      cat: (c) => t(M.category[c.category], locale),
      where: (c) => scopePathText(c.scope, locale),
      who: (c) => (c.assignee.state === 'unassigned' ? null : c.assignee.name ?? null),
      target: (c) => c.target.elapsedMinutes ?? null,
      status: (c) => t(M.status[c.status], locale),
    },
  }), [locale, M]);
  const sv = useStatusView(cases, STATUSES, spec, locale, filter === 'open' ? 'open' : undefined);
  const { tv } = sv;
  const tabs: CardTabItem<CaseTab>[] = [
    { id: 'all', label: t(M.countAll, locale), icon: 'ClipboardList', count: sv.counts.all },
    { id: 'open', label: t(M.countOpen, locale), icon: 'Inbox', count: sv.counts.open },
    { id: 'overdue', label: t(M.countOverdue, locale), icon: 'Hourglass', count: sv.counts.overdue, alert: true },
  ];
  const categories = (Object.keys(M.category) as Array<keyof typeof M.category>).filter((k) => cases.some((c) => c.category === k));
  const filters: FilterDef[] = [
    {
      key: 'category', label: t(M.colCategory, locale), allLabel: t(ALL_CATEGORIES, locale),
      options: categories.map((k) => ({ value: k, label: t(M.category[k], locale) })),
      value: tv.state.filters['category'] ?? '', onChange: (v) => tv.setFilter('category', v),
    },
  ];
  // "Assigned to me" needs the signed-in user, which the case rows do not carry: it stays plain, with the server's figure.
  const plain = data.counts.assignedToMe === undefined ? [] : [{ id: 'assignedToMe', label: t(M.countAssignedToMe, locale), value: data.counts.assignedToMe, icon: 'ClipboardList' as const }];
  const columns = [
    { key: 'ref', label: t(M.colReference, locale), width: '11%', sortable: true },
    { key: 'subject', label: t(M.colSubject, locale), width: '20%', sortable: true },
    { key: 'cat', label: t(M.colCategory, locale), width: '12%', sortable: true },
    { key: 'where', label: t(M.colWhere, locale), width: '19%', sortable: true },
    { key: 'who', label: t(M.colAssignee, locale), width: '13%', sortable: true },
    { key: 'target', label: t(M.colTarget, locale), width: '12%', sortable: true },
    { key: 'status', label: t(M.colStatus, locale), width: '13%', sortable: true },
  ];

  return (
    <>
      <StatusHead
        tabs={tabs}
        cardIds={['open', 'overdue']}
        plainCards={plain}
        filter={sv.filter}
        onChoose={sv.choose}
        onPress={sv.press}
        shown={tv.view.length}
        total={cases.length}
        locale={locale}
        root="s4-status"
        ariaLabel={t(M.countsHeading, locale)}
        cardsTestId="case-stats"
      />

      <HintRow text={t(M.boundaryNote, locale)} />

      {focusKey ? (
        <p className="pemo-note" data-testid="scope-filter-note" data-screen="s4">
          {t(MESSAGES.shell.filterNote, locale)}
        </p>
      ) : null}

      {cases.length === 0 ? (
        <Empty locale={locale} />
      ) : (
        <section className="pemo-panel">
          <FilterBar
            locale={locale}
            testId="s4-filters"
            searchLabel={t(SEARCH, locale)}
            query={tv.state.query}
            onQuery={tv.setQuery}
            filters={filters}
            active={tv.active}
            onClear={tv.clear}
          />
          {sv.filter === 'open' ? <HintRow text={t(M.filterOpenNote, locale)} testId="s4-filter-note" /> : null}
          {tv.view.length === 0 ? <NoMatches locale={locale} testId="s4-no-matches" /> : (
          <Table caption={t(M.title, locale)} columns={columns} testId="s4-table" sorting={{ sort: tv.state.sort, onSort: tv.onSort }}>
            {tv.view.map((c) => (
              <tr key={c.reference} data-testid="s4-row">
                <DenseCell title={c.reference}>
                  <span className="pemo-identifier">{c.reference}</span>
                </DenseCell>
                <WrapCell title={t(c.subject, locale)}>{t(c.subject, locale)}</WrapCell>
                <DenseCell title={t(M.category[c.category], locale)}>
                  {t(M.category[c.category], locale)}
                </DenseCell>
                <td><ScopePathCell scope={c.scope} locale={locale} /></td>
                <td data-testid="assignee" data-assignee-state={c.assignee.state}>
                  {/* Unassigned is a state, and is rendered as one. */}
                  {c.assignee.state === 'unassigned'
                    ? <PlainChip testId="unassigned">{t(M.unassigned, locale)}</PlainChip>
                    : <span className="pemo-cell--wrap">{c.assignee.name}</span>}
                </td>
                <TargetCell target={c.target} locale={locale} />
                <DenseCell title={t(M.status[c.status], locale)}>
                  {t(M.status[c.status], locale)}
                </DenseCell>
              </tr>
            ))}
          </Table>
          )}
          <HintRow text={t(M.statusTargetNote, locale)} />
        </section>
      )}

      <DeferredActions locale={locale} actions={DEFERRED} />
    </>
  );
}
