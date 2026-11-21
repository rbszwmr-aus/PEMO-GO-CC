/**
 * Properties / SCOPE tree rail. Same collapse pattern as the main nav:
 * expanded ~260px shows the tree; collapsed is a thin icon strip.
 * Collapse control sits at the top of the rail (Claude Design).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import type { ScopeTreeNode } from '../data/types.ts';
import {
  collapseAll,
  collapseSubtree,
  defaultExpanded,
  expandAll,
  expandSubtree,
  expandedToRevealMatches,
  nodeKey,
  parentKey,
  rowVisible,
  searchKeepKeys,
  toggleExpanded,
  withChildren,
  indexByKey,
  type NodeKey,
} from '../screens/tree-collapse.ts';
import { expandedToReveal } from './scope-focus.ts';
import { Icon, type IconName } from '../components/Icon.tsx';

/** Reference app icon per level: buildings and estates, layered levels (phase, floor), doors (units). */
function kindIcon(kind: string): IconName {
  if (kind === 'phase' || kind === 'floor') return 'Layers';
  if (kind === 'unit' || kind === 'location') return 'DoorOpen';
  return 'Building2';
}

const SEARCH_DEBOUNCE_MS = 180;

export function ScopeRail({
  locale,
  open,
  onToggle,
  nodes,
  status = 'ready',
  live = false,
  onRetry,
  focusKey,
  onPick,
  onClear,
}: {
  locale: Locale;
  open: boolean;
  onToggle: () => void;
  nodes: readonly ScopeTreeNode[];
  /** Live mode: the tree is loading, failed (a retry is offered) or ready. Fixture mode is always ready. */
  status?: 'ready' | 'loading' | 'error';
  live?: boolean;
  onRetry?: () => void;
  focusKey: NodeKey | null;
  onPick: (key: NodeKey) => void;
  onClear: () => void;
}) {
  const M = MESSAGES.shell;
  const childful = useMemo(() => withChildren(nodes), [nodes]);
  const byKey = useMemo(() => indexByKey(nodes), [nodes]);
  const [expanded, setExpanded] = useState(() => {
    const next = defaultExpanded(nodes);
    for (const k of expandedToReveal(nodes, focusKey)) next.add(k);
    return next;
  });
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const expandBeforeSearch = useRef<Set<NodeKey> | null>(null);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  useEffect(() => {
    const id = window.setTimeout(() => setSearchQuery(searchDraft.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [searchDraft]);

  useEffect(() => {
    if (!focusKey) return;
    setExpanded((prev) => {
      const extra = expandedToReveal(nodes, focusKey);
      if (extra.size === 0) return prev;
      const next = new Set(prev);
      for (const k of extra) next.add(k);
      return next;
    });
  }, [focusKey, nodes]);

  useEffect(() => {
    if (!searchQuery) {
      if (expandBeforeSearch.current) {
        setExpanded(expandBeforeSearch.current);
        expandBeforeSearch.current = null;
      }
      return;
    }
    if (!expandBeforeSearch.current) {
      expandBeforeSearch.current = new Set(expandedRef.current);
    }
  }, [searchQuery, nodes]);

  const keep = useMemo(
    () => (searchQuery ? searchKeepKeys(nodes, searchQuery) : null),
    [nodes, searchQuery],
  );
  const shownExpanded = useMemo(() => {
    if (!searchQuery) return expanded;
    const extra = expandedToRevealMatches(nodes, searchQuery);
    if (extra.size === 0) return expanded;
    const next = new Set(expanded);
    for (const k of extra) next.add(k);
    return next;
  }, [expanded, nodes, searchQuery]);

  const clearSearch = () => {
    setSearchDraft('');
    setSearchQuery('');
  };

  const collapseLabel = open ? t(M.scopeRailCollapse, locale) : t(M.scopeRailExpand, locale);
  const childCount = useMemo(() => {
    const counts = new Map<NodeKey, number>();
    for (const n of nodes) {
      const p = parentKey(n);
      if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    return counts;
  }, [nodes]);

  return (
    <aside
      className="pemo-scope-rail"
      data-testid="scope-rail"
      data-collapsed={open ? 'false' : 'true'}
      aria-label={t(M.scopeRailLabel, locale)}
    >
      <div className="pemo-rail-cap">
        <button
          type="button"
          className="pemo-rail-toggle"
          data-testid="scope-rail-toggle"
          aria-expanded={open}
          aria-controls="scope-rail-tree"
          title={collapseLabel}
          onClick={onToggle}
        >
          <Icon name={open ? 'ChevronLeft' : 'ChevronRight'} size={17} strokeWidth={2} />
          <span className="pemo-visually-hidden">{collapseLabel}</span>
        </button>
      </div>
      {open ? (
        <section className="pemo-tree-panel">
          <header className="pemo-tree-panel__head">{t(M.scopeRailLabel, locale)}</header>
          {status === 'loading' ? (
            <p className="pemo-scope-rail__prompt" data-testid="scope-rail-loading" role="status" aria-busy="true">
              {t(M.scopeRailLoading, locale)}
            </p>
          ) : status === 'error' ? (
            <div className="pemo-scope-rail__prompt" data-testid="scope-rail-error" role="alert">
              <p><Icon name="CircleAlert" size={16} strokeWidth={2} /> {t(M.scopeRailError, locale)}</p>
              {onRetry ? (
                <button type="button" className="pemo-button" data-testid="scope-rail-retry" onClick={onRetry}>
                  {t(MESSAGES.state.tryAgain, locale)}
                </button>
              ) : null}
            </div>
          ) : nodes.length === 0 ? (
            <p className="pemo-scope-rail__prompt" data-testid="scope-rail-empty">
              {t(live ? M.scopeRailEmptyLive : M.scopeRailEmpty, locale)}
            </p>
          ) : (
            <>
              <div className="pemo-tree-controls">
                <div className="pemo-scope-rail__search">
                  <label className="pemo-scope-rail__search-field" htmlFor="scope-rail-search">
                    <span className="pemo-visually-hidden">{t(M.scopeRailSearchPlaceholder, locale)}</span>
                    <Icon name="Search" size={16} strokeWidth={2} className="pemo-tree-controls__lens" />
                    <input
                      id="scope-rail-search"
                      type="search"
                      data-testid="scope-rail-search"
                      placeholder={t(M.scopeRailSearchPlaceholder, locale)}
                      value={searchDraft}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(e) => setSearchDraft(e.target.value)}
                    />
                  </label>
                  {searchDraft ? (
                    <button
                      type="button"
                      className="pemo-scope-rail__search-clear"
                      data-testid="scope-rail-search-clear"
                      title={t(M.scopeRailSearchClear, locale)}
                      onClick={clearSearch}
                    >
                      <Icon name="X" size={14} strokeWidth={2} />
                      <span className="pemo-visually-hidden">{t(M.scopeRailSearchClear, locale)}</span>
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="pemo-tree-controls__btn"
                  data-testid="scope-rail-expand-all"
                  title={t(MESSAGES.s3.expandAll, locale)}
                  aria-label={t(MESSAGES.s3.expandAll, locale)}
                  onClick={() => setExpanded(expandAll(nodes))}
                >
                  <Icon name="Plus" size={17} strokeWidth={2} />
                </button>
                <button
                  type="button"
                  className="pemo-tree-controls__btn"
                  data-testid="scope-rail-collapse-all"
                  title={t(MESSAGES.s3.collapseAll, locale)}
                  aria-label={t(MESSAGES.s3.collapseAll, locale)}
                  onClick={() => setExpanded(collapseAll(nodes))}
                >
                  <Icon name="Minus" size={17} strokeWidth={2} />
                </button>
                <span className="pemo-tree-controls__slot" aria-hidden="true" />
              </div>
              {/* UX re-check 1 G3: no "pick a place" hint — the search box and tree say it. */}
              {!focusKey ? null : (
                <button
                  type="button"
                  className="pemo-scope-rail__clear"
                  data-testid="scope-clear"
                  onClick={onClear}
                >
                  {t(M.scopeClear, locale)}
                </button>
              )}
              {keep && keep.size === 0 ? (
                <p className="pemo-scope-rail__prompt" data-testid="scope-rail-search-empty">
                  {t(M.scopeRailSearchEmpty, locale)}
                </p>
              ) : null}
              <ul id="scope-rail-tree" className="pemo-scope-tree" data-testid="scope-rail-tree">
                {nodes.map((n) => {
                  const key = nodeKey(n);
                  if (keep && !keep.has(key)) return null;
                  if (!rowVisible(n, byKey, shownExpanded)) return null;
                  const canToggle = childful.has(key);
                  const isOpen = shownExpanded.has(key);
                  const selected = focusKey === key;
                  const count = childCount.get(key);
                  return (
                    <li
                      key={key}
                      className={`pemo-scope-tree__row${selected ? ' pemo-scope-tree__row--selected' : ''}`}
                      data-testid="scope-rail-node"
                      data-kind={n.node.kind}
                      data-node-key={key}
                      style={{ paddingLeft: `${8 + 17 * n.depth}px` }}
                    >
                      {canToggle ? (
                        <button
                          type="button"
                          className="pemo-tree__toggle"
                          data-testid="scope-rail-disclosure"
                          aria-expanded={isOpen}
                          onClick={() => setExpanded(toggleExpanded(expanded, key))}
                        >
                          <span className="pemo-visually-hidden">{t(M.scopeRailDisclose, locale)}</span>
                          <Icon name={isOpen ? 'ChevronDown' : 'ChevronRight'} size={13} strokeWidth={2} />
                        </button>
                      ) : (
                        <span className="pemo-tree__toggle pemo-tree__toggle--leaf" aria-hidden="true" />
                      )}
                      <button
                        type="button"
                        className="pemo-scope-tree__pick"
                        data-testid="scope-rail-pick"
                        aria-current={selected ? 'true' : undefined}
                        onClick={() => onPick(key)}
                      >
                        <Icon name={kindIcon(n.node.kind)} size={17} strokeWidth={2} className="pemo-tree__kind" />
                        <span className="pemo-tree__text">{t(n.label, locale)}</span>
                      </button>
                      {count ? <small className="pemo-tree__count">{count}</small> : null}
                      {n.node.kind === 'building' && canToggle ? (
                        <span className="pemo-scope-tree__block-actions">
                          <button
                            type="button"
                            className="pemo-scope-tree__block-action"
                            data-testid="scope-block-expand-all"
                            data-block-id={n.node.id}
                            aria-label={t(M.scopeBlockExpandAll, locale).replace('{block}', t(n.label, locale))}
                            onClick={() => setExpanded((prev) => expandSubtree(prev, nodes, key))}
                          >
                            <Icon name="Plus" size={13} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            className="pemo-scope-tree__block-action"
                            data-testid="scope-block-collapse-all"
                            data-block-id={n.node.id}
                            aria-label={t(M.scopeBlockCollapseAll, locale).replace('{block}', t(n.label, locale))}
                            onClick={() => setExpanded((prev) => collapseSubtree(prev, nodes, key))}
                          >
                            <Icon name="Minus" size={13} strokeWidth={2} />
                          </button>
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      ) : (
        <button
          type="button"
          className="pemo-scope-rail__icon"
          data-testid="scope-rail-icon"
          title={collapseLabel}
          onClick={onToggle}
        >
          <Icon name="Building2" size={17} strokeWidth={2} />
          <span className="pemo-visually-hidden">{t(M.scopeRailLabel, locale)}</span>
        </button>
      )}
    </aside>
  );
}
