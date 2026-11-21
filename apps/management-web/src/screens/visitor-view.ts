/**
 * Visits page: the one status filter that the stat cards and the L2 tabs share,
 * the counts both show, and each tab's default sort. Plain functions so the
 * rules are testable without a browser.
 *
 * Rules (PT, 2026-11-19):
 *   Expected   = expected and not yet arrived.
 *   On site    = arrived and not yet signed out.
 *   Overdue    = on site AND past the visit window ("Not signed out").
 *   Approval and Walk-in are not built: the live Visit has no approval or
 *   host-not-reached field, so neither a tab nor a card is shown for them.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New.
 */

import type { SortSpec } from '../components/table-view.ts';

export type VisitFilterId = 'all' | 'expected' | 'onsite' | 'overdue';
export const VISIT_FILTER_IDS = ['all', 'expected', 'onsite', 'overdue'] as const satisfies readonly VisitFilterId[];

export type VisitStatus = 'expected' | 'on_site' | 'checked_out';

export interface VisitFacts {
  status: VisitStatus;
  overdue: boolean;
}

/** On site and past the end of the visit window. `now` is injected so tests do not depend on the clock. */
export function isOverdue(v: { status: VisitStatus; expectedToMs: number | null }, now: number): boolean {
  return v.status === 'on_site' && v.expectedToMs !== null && now > v.expectedToMs;
}

export function inFilter(id: VisitFilterId, v: VisitFacts): boolean {
  switch (id) {
    case 'all':
      return true;
    case 'expected':
      return v.status === 'expected';
    case 'onsite':
      return v.status === 'on_site';
    case 'overdue':
      return v.overdue;
  }
}

export function countsOf(rows: readonly VisitFacts[]): Record<VisitFilterId, number> {
  return {
    all: rows.length,
    expected: rows.filter((r) => inFilter('expected', r)).length,
    onsite: rows.filter((r) => inFilter('onsite', r)).length,
    overdue: rows.filter((r) => inFilter('overdue', r)).length,
  };
}

/**
 * Where each tab starts. Expected: soonest arrival first. On site: earliest
 * check-in first. Overdue: most overdue first (earliest window end). All:
 * newest record first. `at`, `due` and `created` are timestamp sorts that are
 * not columns, so no header is marked until the reader clicks one.
 */
export const DEFAULT_SORT: Record<VisitFilterId, SortSpec> = {
  all: { key: 'created', dir: 'desc' },
  expected: { key: 'expected', dir: 'asc' },
  onsite: { key: 'expected', dir: 'asc' },
  overdue: { key: 'due', dir: 'asc' },
};

/** A stat card drives the tab with the same set; pressing the lit one again clears back to All. */
export function pressCard(current: VisitFilterId, card: Exclude<VisitFilterId, 'all'>): VisitFilterId {
  return current === card ? 'all' : card;
}
