/**
 * S3 — Properties.
 *
 * The household safety column in the export mixes "Full access", "Not
 * permitted" and "Expires in 49 days" — a state and a countdown in one column.
 * The contract splits them and this screen keeps them split.
 *
 * The rule the shape must not contradict, stated by the export itself: the
 * permission is granted by the RESIDENT in their own app, not by management.
 * Staff see who holds it and when it ends. Revocation is a write and is deferred.
 *
 * @version 0.2.0
 * @changelog
 *   0.2.0 (2026-11-19) Stat cards: Locations, Spaces and Public areas & facilities are the shared StatCard with an icon chip and drill down (press lists exactly that many locations, Clear chip, aria-pressed); a list row opens its location in the tree.
 */

import { HintRow } from '../components/FinanceBits.tsx';
import { Icon, type IconName } from '../components/Icon.tsx';
import { FilterChipRow, StatCardRow, cardChip, type CardSpec } from '../components/StatCard.tsx';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { MESSAGES } from '../i18n/messages.ts';
import { copy, t, type Locale } from '../i18n/locale.ts';
import { dateOnly, number } from '../format/datetime.ts';
import { PlainChip } from '../components/SeverityChip.tsx';
import { ScopePathCell } from '../components/ScopePathCell.tsx';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import { DeferredActions } from '../components/DeferredActions.tsx';
import { householdIdForUnit } from '../data/households-corpus.ts';
import { ComposeOnNode } from './NoticeActions.tsx';
import { permits } from '../data/affordances.ts';
import type { PropertyTreeResponse, ScopeTreeNode, ScopeTreeResponse, UnitDetailResponse } from '../data/types.ts';
import {
  collapseAll,
  defaultExpanded,
  expandAll,
  expandedToRevealMatches,
  indexByKey,
  nodeKey,
  parentKey,
  rowVisible,
  searchKeepKeys,
  toggleExpanded,
  withChildren,
  type NodeKey,
} from './tree-collapse.ts';
import { buildRailNodes, filterTreeToFocus } from '../shell/scope-focus.ts';


/** Reference app icon per level: buildings and estates, layered levels (phase, floor), doors (units). */
function kindIcon(kind: string): IconName {
  if (kind === 'phase' || kind === 'floor') return 'Layers';
  if (kind === 'unit' || kind === 'location') return 'DoorOpen';
  return 'Building2';
}

export type PropertyTreeFilter = 'unknown-state' | undefined;

/**
 * Overview units-unknown-state drills here. The tree fixture has no per-unit
 * severity, so the closest client-side signal is `attention` (needs follow-up),
 * keeping ancestors so the hierarchy still reads.
 */
function filterUnknownStateNodes(nodes: PropertyTreeResponse['nodes']): PropertyTreeResponse['nodes'] {
  const byKey = indexByKey(nodes);
  const keep = new Set<string>();
  for (const n of nodes) {
    if (!n.attention) continue;
    let cur: typeof n | undefined = n;
    while (cur) {
      keep.add(nodeKey(cur));
      const pk = parentKey(cur);
      cur = pk ? byKey.get(pk) : undefined;
    }
  }
  if (keep.size === 0) return nodes;
  return nodes.filter((n) => keep.has(nodeKey(n)));
}

const m = copy;

const DEFERRED = [
  m('Revoke a resident-granted safety viewing permission', '撤銷住戶授予的安全資料查看權', '撤销住户授予的安全数据查看权'),
];

const PAGE_SIZES = [25, 50, 100, 200] as const;

type PaneTab = 'location' | 'history';
type ChildView = 'table' | 'cards';
/** The three stat cards; each one lists exactly the locations it counts. */
type DrillKey = 'locations' | 'spaces' | 'shared';

/**
 * Properties as the reference lays it out: three stat cards, a narrow Locations tree on the
 * left and the selected location's detail pane on the right.
 *
 * The tree is also the NODE PICKER for composing a notice (UI-051 G6, ruled): the pane toolbar
 * carries the compose control for the SELECTED node iff the server listed composeNotice on it.
 * The control is drawn by NoticeActions.tsx; this file only places it.
 *
 * One data source: the tree and the left scope rail both read the merge of the property tree and
 * the granted-scope tree (buildRailNodes), so a block's child count is the same everywhere.
 */
export function S3Tree({ data, scope, locale, onCompose, onOpenHousehold, filter, focusKey }: {
  data: PropertyTreeResponse;
  scope?: ScopeTreeResponse | null | undefined;
  locale: Locale;
  onCompose?: ((node: ScopeTreeNode) => void) | undefined;
  onOpenHousehold?: ((householdId: string) => void) | undefined;
  /** URL-carried; `unknown-state` keeps attention nodes and their ancestors. */
  filter?: PropertyTreeFilter;
  focusKey?: NodeKey | null;
}) {
  const M = MESSAGES.s3;
  const nodes = useMemo(
    () => {
      const merged = buildRailNodes(data, scope ?? null);
      const base = filter === 'unknown-state' ? filterUnknownStateNodes(merged) : merged;
      return filterTreeToFocus(base, focusKey ?? null);
    },
    [data, scope, filter, focusKey],
  );
  const byKey = useMemo(() => indexByKey(nodes), [nodes]);
  const childful = useMemo(() => withChildren(nodes), [nodes]);
  const [expanded, setExpanded] = useState(() =>
    filter === 'unknown-state' ? expandAll(nodes) : defaultExpanded(nodes),
  );
  const [query, setQuery] = useState('');
  const q = query.trim();
  const keep = useMemo(() => (q ? searchKeepKeys(nodes, q) : null), [nodes, q]);
  const shownExpanded = useMemo(() => {
    if (!q) return expanded;
    const next = new Set(expanded);
    for (const k of expandedToRevealMatches(nodes, q)) next.add(k);
    return next;
  }, [expanded, nodes, q]);
  const childrenOf = useMemo(() => {
    const map = new Map<NodeKey, ScopeTreeNode[]>();
    for (const n of nodes) {
      const p = parentKey(n);
      if (p) map.set(p, [...(map.get(p) ?? []), n]);
    }
    return map;
  }, [nodes]);

  const [selectedKey, setSelectedKey] = useState<NodeKey | null>(null);
  const selected = (selectedKey ? byKey.get(selectedKey) : undefined) ?? nodes[0] ?? null;
  const selKey = selected ? nodeKey(selected) : null;
  const [treeShut, setTreeShut] = useState(false);
  const [tab, setTab] = useState<PaneTab>('location');
  const [view, setView] = useState<ChildView>('table');
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState(0);

  const [drill, setDrill] = useState<DrillKey | null>(null);

  const pick = (key: NodeKey) => { setSelectedKey(key); setPage(0); };
  /** Open a location from a list: reveal it in the tree (every ancestor opens) and leave any card filter. */
  const pickChild = (child: ScopeTreeNode) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (let c: ScopeTreeNode | undefined = child; c; ) {
        const k = parentKey(c);
        if (!k) break;
        next.add(k);
        c = byKey.get(k);
      }
      return next;
    });
    setDrill(null);
    pick(nodeKey(child));
  };

  const stats = useMemo(() => ({
    locations: nodes.length,
    spaces: nodes.filter((n) => n.node.kind === 'unit').length,
    shared: nodes.filter((n) => n.node.kind === 'location').length,
  }), [nodes]);

  const path: ScopeTreeNode[] = [];
  for (let cur = selected ? parentKey(selected) : null; cur; ) {
    const p = byKey.get(cur);
    if (!p) break;
    path.unshift(p);
    cur = parentKey(p);
  }
  const drillRows = useMemo(
    () => (drill === null ? null : nodes.filter((n) => (drill === 'spaces' ? n.node.kind === 'unit' : drill === 'shared' ? n.node.kind === 'location' : true))),
    [nodes, drill],
  );
  const drilling = drillRows !== null;
  const kids = drillRows ?? (selKey ? childrenOf.get(selKey) ?? [] : []);
  const ancestry = (n: ScopeTreeNode) => {
    const names: string[] = [];
    for (let k = parentKey(n); k; ) {
      const p = byKey.get(k);
      if (!p) break;
      names.unshift(t(p.label, locale));
      k = parentKey(p);
    }
    return names.join(' › ');
  };
  const pages = Math.max(1, Math.ceil(kids.length / pageSize));
  const at = Math.min(page, pages - 1);
  const shown = kids.slice(at * pageSize, at * pageSize + pageSize);
  const from = kids.length === 0 ? 0 : at * pageSize + 1;
  const to = at * pageSize + shown.length;
  const kindLabel = (n: ScopeTreeNode) => t(MESSAGES.scopeKind[n.node.kind], locale);
  const linkedHouseholdId = selected && selected.node.kind === 'unit' ? householdIdForUnit(selected.node.id) : null;
  const canCompose = Boolean(selected && onCompose && permits(selected, 'composeNotice'));
  // The single Compose button lives in the page header, next to the title (the Shell's actions slot).
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setActionsSlot(document.getElementById('pemo-page-actions')); }, []);
  const canOpenHousehold = Boolean(linkedHouseholdId && onOpenHousehold);

  // A card with no locations behind it is plain text; every other card lists exactly its number of rows.
  const statCards: CardSpec<DrillKey>[] = [
    { key: 'locations', label: t(M.statLocations, locale), value: stats.locations, icon: 'MapPin', press: stats.locations > 0 },
    { key: 'spaces', label: t(M.statSpaces, locale), value: stats.spaces, icon: 'DoorOpen', press: stats.spaces > 0 },
    { key: 'shared', label: t(M.statShared, locale), value: stats.shared, icon: 'LayoutGrid', press: stats.shared > 0 },
  ];
  const chooseCard = (next: DrillKey | null) => { setDrill(next); setPage(0); setTab('location'); };

  const columns = [
    { key: 'n', label: t(M.colIndex, locale), width: '14%' },
    { key: 'loc', label: t(M.colLocation, locale), width: '52%' },
    { key: 'type', label: t(M.colKind, locale), width: '34%' },
  ];

  return (
    <div className="pemo-props" data-testid="s3-properties">
      {focusKey ? (
        <p className="pemo-note" data-testid="scope-filter-note" data-screen="s3">
          {t(MESSAGES.shell.filterNote, locale)}
        </p>
      ) : null}
      {filter === 'unknown-state' ? (
        <p className="pemo-note" data-testid="s3-filter-note" data-filter="unknown-state">
          {t(M.filterUnknownNote, locale)}
        </p>
      ) : null}

      {actionsSlot && selected && canCompose
        ? createPortal(<ComposeOnNode node={selected} locale={locale} onCompose={onCompose!} primary />, actionsSlot)
        : null}

      <StatCardRow cards={statCards} active={drill} onPick={chooseCard} locale={locale} testId="s3-stats" />
      {drill !== null ? (
        <FilterChipRow label={cardChip(statCards, drill) ?? ''} shown={kids.length} total={nodes.length} locale={locale} onClear={() => chooseCard(null)} />
      ) : null}

      <div className="pemo-props__layout" data-shut={treeShut ? 'true' : 'false'}>
        {treeShut ? (
          <button
            type="button"
            className="pemo-scope-rail__icon pemo-props__shut"
            data-testid="s3-tree-open"
            data-tree-chrome=""
            title={t(M.treeHeading, locale)}
            onClick={() => setTreeShut(false)}
          >
            <Icon name="Building2" size={17} strokeWidth={2} />
            <span className="pemo-visually-hidden">{t(M.treeHeading, locale)}</span>
          </button>
        ) : (
    <section className="pemo-tree-panel pemo-tree-panel--page">
      <header className="pemo-tree-panel__head">
        <h2 className="pemo-tree-panel__title">{t(M.treeHeading, locale)}</h2>
      </header>
      <div className="pemo-tree-controls">
        <div className="pemo-scope-rail__search">
          <label className="pemo-scope-rail__search-field">
            <span className="pemo-visually-hidden">{t(MESSAGES.shell.scopeRailSearchPlaceholder, locale)}</span>
            <Icon name="Search" size={16} strokeWidth={2} className="pemo-tree-controls__lens" />
            <input
              type="search"
              data-testid="s3-tree-search"
              data-tree-chrome=""
              placeholder={t(MESSAGES.shell.scopeRailSearchPlaceholder, locale)}
              value={query}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="pemo-tree-controls__btn"
          data-testid="tree-expand-all"
          data-tree-chrome=""
          title={t(M.expandAll, locale)}
          onClick={() => setExpanded(expandAll(nodes))}
        >
          <Icon name="Plus" size={17} strokeWidth={2} />
          <span className="pemo-visually-hidden">{t(M.expandAll, locale)}</span>
        </button>
        <button
          type="button"
          className="pemo-tree-controls__btn"
          data-testid="tree-collapse-all"
          data-tree-chrome=""
          title={t(M.collapseAll, locale)}
          onClick={() => setExpanded(collapseAll(nodes))}
        >
          <Icon name="Minus" size={17} strokeWidth={2} />
          <span className="pemo-visually-hidden">{t(M.collapseAll, locale)}</span>
        </button>
        <button
          type="button"
          className="pemo-tree-controls__btn"
          data-testid="s3-tree-shut"
          data-tree-chrome=""
          title={t(M.treeHide, locale)}
          onClick={() => setTreeShut(true)}
        >
          <Icon name="ChevronLeft" size={17} strokeWidth={2} />
          <span className="pemo-visually-hidden">{t(M.treeHide, locale)}</span>
        </button>
      </div>
      <ul className="pemo-tree" data-testid="s3-tree">
        {nodes.map((n) => {
          const key = nodeKey(n);
          if (keep && !keep.has(key)) return null;
          if (!rowVisible(n, byKey, shownExpanded)) return null;
          const canToggle = childful.has(key);
          const isOpen = shownExpanded.has(key);
          const count = childrenOf.get(key)?.length;
          const chosen = key === selKey;
          return (
            <li
              key={key}
              className={`pemo-tree__row${chosen ? ' pemo-tree__row--chosen' : ''}`}
              data-testid="tree-node"
              data-kind={n.node.kind}
              data-node-id={n.node.id}
              data-chosen={chosen ? 'true' : 'false'}
              style={{ paddingLeft: `${8 + 17 * n.depth}px` }}
            >
              {canToggle ? (
                <button
                  type="button"
                  className="pemo-tree__toggle"
                  data-testid="tree-toggle"
                  data-tree-chrome=""
                  aria-expanded={isOpen}
                  onClick={() => setExpanded(toggleExpanded(expanded, key))}
                >
                  <Icon name={isOpen ? 'ChevronDown' : 'ChevronRight'} size={13} strokeWidth={2} />
                  <span className="pemo-visually-hidden">{t(MESSAGES.shell.scopeRailDisclose, locale)}</span>
                </button>
              ) : (
                <span className="pemo-tree__toggle pemo-tree__toggle--leaf" aria-hidden="true" />
              )}
              <button
                type="button"
                className="pemo-tree__label"
                data-testid="tree-pick"
                data-tree-chrome=""
                aria-current={chosen ? 'true' : undefined}
                title={kindLabel(n)}
                onClick={() => pick(key)}
              >
                {n.attention ? (
                  <>
                    <span className="pemo-tree__attention" aria-hidden="true" data-testid="attention-dot" />
                    <span className="pemo-visually-hidden">{t(M.attentionDot, locale)}</span>
                  </>
                ) : null}
                <Icon name={kindIcon(n.node.kind)} size={17} strokeWidth={2} className="pemo-tree__kind" />
                <span className="pemo-tree__text">{t(n.label, locale)}</span>
                <span className="pemo-visually-hidden">{kindLabel(n)}</span>
              </button>
              {count ? <small className="pemo-tree__count">{count}</small> : null}
            </li>
          );
        })}
      </ul>
    </section>
        )}

        {selected ? (
          <section className="pemo-pane" data-testid="s3-pane" data-kind={selected.node.kind}>
            <header className="pemo-pane__head">
              <strong data-testid="s3-pane-title">{drilling ? cardChip(statCards, drill) : t(selected.label, locale)}</strong>
            </header>
            {!drilling && path.length > 0 ? (
              <div className="pemo-pane__path" data-testid="s3-pane-path">
                {path.map((p) => t(p.label, locale)).join(' › ')}
              </div>
            ) : null}
            {!drilling && selected.summary ? (
              <div className="pemo-pane__path pemo-pane__summary" data-testid="s3-pane-summary">{t(selected.summary, locale)}</div>
            ) : null}
            {!drilling && canOpenHousehold ? (
              <div className="pemo-pane__actions" data-testid="s3-pane-actions">
                {canOpenHousehold ? (
                  <a
                    className="pemo-button"
                    href={`?screen=householdsDetail&state=detail&lang=${locale}&household=${encodeURIComponent(linkedHouseholdId!)}`}
                    data-testid="s3-open-household"
                    data-read-affordance="navigate"
                    onClick={(e) => {
                      e.preventDefault();
                      onOpenHousehold!(linkedHouseholdId!);
                    }}
                  >
                    {t(MESSAGES.households.openFromUnit, locale)}
                  </a>
                ) : null}
              </div>
            ) : null}
            {!drilling ? (
            <div className="pemo-pane__tabs" role="tablist">
              {(['location', 'history'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  className="pemo-pane__tab"
                  data-testid={`s3-tab-${id}`}
                  data-tree-chrome=""
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                >
                  {t(id === 'location' ? M.tabLocation : M.tabHistory, locale)}
                </button>
              ))}
            </div>
            ) : null}

            {!drilling && tab === 'history' ? (
              <p className="pemo-pane__empty" data-testid="s3-history-empty">{t(M.historyEmpty, locale)}</p>
            ) : !drilling && kids.length === 0 ? (
              <dl className="pemo-dl pemo-pane__facts" data-testid="s3-facts">
                <dt>{t(M.colKind, locale)}</dt>
                <dd>{kindLabel(selected)}</dd>
                {path.length > 0 ? (
                  <>
                    <dt>{t(MESSAGES.s1.colWhere, locale)}</dt>
                    <dd>{path.map((p) => t(p.label, locale)).join(' › ')}</dd>
                  </>
                ) : null}
              </dl>
            ) : (
              <section className="pemo-pane__list" data-testid="s3-children">
                <div className="pemo-view-tabs" role="tablist">
                  {(['table', 'cards'] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      className="pemo-view-tab"
                      data-testid={`s3-view-${id}`}
                      data-tree-chrome=""
                      aria-selected={view === id}
                      onClick={() => setView(id)}
                    >
                      <Icon name={id === 'table' ? 'PanelsTopLeft' : 'LayoutGrid'} size={18} strokeWidth={2} />
                      {t(id === 'table' ? M.viewTable : M.viewCards, locale)}
                    </button>
                  ))}
                </div>
                {view === 'table' ? (
                  <Table caption={t(M.treeHeading, locale)} columns={columns} testId="s3-children-table">
                    {shown.map((c, i) => (
                      <tr key={nodeKey(c)} data-testid="s3-child-row">
                        <td>{from + i}</td>
                        <td>
                          <button type="button" className="pemo-link-button" data-tree-chrome="" onClick={() => pickChild(c)}>
                            <strong>{t(c.label, locale)}</strong>
                          </button>
                          {drilling ? <div className="pemo-meta" data-testid="s3-child-path">{ancestry(c)}</div> : null}
                        </td>
                        <td>{kindLabel(c)}</td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <div className="pemo-cards" data-testid="s3-children-cards">
                    {shown.map((c, i) => (
                      <button key={nodeKey(c)} type="button" className="pemo-card" data-testid="s3-child-card" data-tree-chrome="" onClick={() => pickChild(c)}>
                        <span className="pemo-card__n">#{from + i}</span>
                        <Icon name={kindIcon(c.node.kind)} size={17} strokeWidth={2} />
                        <strong>{t(c.label, locale)}</strong>
                        <small>{kindLabel(c)}</small>
                      </button>
                    ))}
                  </div>
                )}
                <div className="pemo-pager" data-testid="s3-pager">
                  <span>{from} – {to} / {kids.length}</span>
                  <div className="pemo-pager__controls">
                    <select
                      data-tree-chrome=""
                      data-testid="s3-page-size"
                      aria-label={t(M.pageSize, locale)}
                      value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                    >
                      {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    {pages > 1 ? (
                      <>
                        {at > 0 ? (
                          <button type="button" className="pemo-button" data-tree-chrome="" data-testid="s3-page-prev" onClick={() => setPage(at - 1)}>
                            <Icon name="ChevronLeft" size={17} strokeWidth={2} />
                            <span className="pemo-visually-hidden">{t(M.pagePrev, locale)}</span>
                          </button>
                        ) : null}
                        {at < pages - 1 ? (
                          <button type="button" className="pemo-button" data-tree-chrome="" data-testid="s3-page-next" onClick={() => setPage(at + 1)}>
                            <Icon name="ChevronRight" size={17} strokeWidth={2} />
                            <span className="pemo-visually-hidden">{t(M.pageNext, locale)}</span>
                          </button>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </section>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}

export function S3Unit({ data, locale, onOpenHousehold }: { data: UnitDetailResponse; locale: Locale; onOpenHousehold?: (householdId: string) => void }) {
  const M = MESSAGES.s3;
  const u = data.unit;
  const linkedHouseholdId = householdIdForUnit(u.unitId);

  const householdColumns = [
    { key: 'name', label: t(M.colName, locale), width: '26%' },
    { key: 'role', label: t(M.colRole, locale), width: '20%' },
    { key: 'from', label: t(M.colFrom, locale), width: '15%' },
    { key: 'to', label: t(M.colTo, locale), width: '15%' },
    { key: 'safety', label: t(M.colSafety, locale), width: '24%' },
  ];
  const refColumns = [
    { key: 'system', label: t(M.colSystem, locale), width: '30%' },
    { key: 'ref', label: t(M.colReference, locale), width: '45%' },
    { key: 'state', label: t(M.colLinkState, locale), width: '25%' },
  ];

  return (
    <>
      <section className="pemo-panel">
        <h2 className="pemo-panel__title">{t(u.label, locale)}</h2>
        <dl className="pemo-dl">
          <dt>{t(M.colReference, locale)}</dt>
          <dd><span className="pemo-identifier">{u.unitReference}</span></dd>
          <dt>{t(MESSAGES.s1.colWhere, locale)}</dt>
          <dd><ScopePathCell scope={u.scope} locale={locale} /></dd>
          <dt>{t(M.enrolled, locale)}</dt>
          <dd data-testid="enrolment">
            {u.facts.homeSafety.enrolled ? t(M.enrolled, locale) : t(M.notEnrolled, locale)}
            {u.facts.homeSafety.serviceCount !== undefined ? (
              <span className="pemo-meta"> · {t(M.serviceCount, locale)}: {number(u.facts.homeSafety.serviceCount, locale)}</span>
            ) : null}
          </dd>
          <dt>{t(M.occupancyFrom, locale)}</dt>
          <dd>{dateOnly(u.facts.occupancyFrom, locale)}</dd>
          <dt>{t(M.notificationLanguage, locale)}</dt>
          <dd>{u.facts.notificationLanguage === 'zh-Hant' ? t(M.langZh, locale) : t(M.langEn, locale)}</dd>
          {u.facts.sizeAndType ? (
            <>
              <dt>{t(M.sizeAndType, locale)}</dt>
              <dd data-testid="size-and-type">
                {u.facts.sizeAndType.areaSqFt !== null && u.facts.sizeAndType.areaSqFt !== undefined
                  ? `${number(u.facts.sizeAndType.areaSqFt, locale)} sq ft`
                  : null}
                {u.facts.sizeAndType.layout ? ` · ${u.facts.sizeAndType.layout}` : null}
                <div className="pemo-meta" data-testid="system-of-record">
                  {t(M.systemOfRecord, locale)}: {t(M.systemName[u.facts.sizeAndType.systemOfRecord], locale)}
                </div>
              </dd>
            </>
          ) : null}
        </dl>
      </section>

      <section className="pemo-panel">
        <h2 className="pemo-panel__title">{t(M.householdHeading, locale)}</h2>
        <HintRow text={t(M.safetyGrantedByResident, locale)} />
        {linkedHouseholdId && onOpenHousehold ? (
            <p className="pemo-note">
              <a
                href={`?screen=householdsDetail&state=detail&lang=${locale}&household=${encodeURIComponent(linkedHouseholdId)}`}
                data-testid="s3-open-household"
                data-read-affordance="navigate"
                onClick={(e) => {
                  e.preventDefault();
                  onOpenHousehold(linkedHouseholdId);
                }}
              >
                {t(MESSAGES.households.openFromUnit, locale)}
              </a>
            </p>
          ) : null}
        <Table caption={t(M.householdHeading, locale)} columns={householdColumns} testId="s3-household">
          {u.household.map((p, i) => (
            <tr key={i} data-testid="household-row">
              <WrapCell title={p.name}>{p.name}</WrapCell>
              <WrapCell>{t(p.role, locale)}</WrapCell>
              <DenseCell title={p.from ? dateOnly(p.from, locale) : ''}>{p.from ? dateOnly(p.from, locale) : null}</DenseCell>
              <DenseCell title={p.to ? dateOnly(p.to, locale) : ''}>{p.to ? dateOnly(p.to, locale) : null}</DenseCell>
              <td>
                <PlainChip testId="safety-state">{t(M.safety[p.safety.state], locale)}</PlainChip>
                {p.safety.expiresAt ? (
                  <div className="pemo-meta" data-testid="safety-expiry">
                    {t(M.expiresOn, locale)} {dateOnly(p.safety.expiresAt, locale)}
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </Table>
      </section>

      <section className="pemo-panel">
        <h2 className="pemo-panel__title">{t(M.externalHeading, locale)}</h2>
        <HintRow text={t(M.externalNote, locale)} />
        <Table caption={t(M.externalHeading, locale)} columns={refColumns} testId="s3-external">
          {u.externalReferences.map((r, i) => (
            <tr key={i} data-testid="external-row">
              <WrapCell>{t(M.systemName[r.system], locale)}</WrapCell>
              <DenseCell title={r.reference}>
                <span className="pemo-identifier">{r.reference}</span>
              </DenseCell>
              <td><PlainChip>{t(M.linkState[r.state], locale)}</PlainChip></td>
            </tr>
          ))}
        </Table>
      </section>

      <DeferredActions locale={locale} actions={DEFERRED} />
    </>
  );
}
