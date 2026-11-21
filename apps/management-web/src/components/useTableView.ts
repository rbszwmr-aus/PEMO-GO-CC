import { useCallback, useMemo, useState } from 'react';
import {
  applyView, emptyFilters, filtersActive, nextSort,
  type SortSpec, type ViewSpec, type ViewState,
} from './table-view.ts';

/**
 * State and result for a sortable, filterable list table. `rows` are everything the table could show;
 * `view` is what is left after the search, the filters and the sort. `initialSort` is where it starts
 * (clicking a header cycles ascending, descending, off; off returns to the rows' own order).
 */
export function useTableView<R>(rows: readonly R[], spec: ViewSpec<R>, initialSort: SortSpec, locale: string) {
  const [state, setState] = useState<ViewState>({ ...emptyFilters(), sort: initialSort });
  const view = useMemo(() => applyView(rows, spec, state, locale), [rows, spec, state, locale]);
  const onSort = useCallback((key: string) => setState((s) => ({ ...s, sort: nextSort(s.sort, key) })), []);
  const setQuery = useCallback((query: string) => setState((s) => ({ ...s, query })), []);
  const setFilter = useCallback((key: string, value: string) => setState((s) => ({ ...s, filters: { ...s.filters, [key]: value } })), []);
  const setSort = useCallback((sort: SortSpec) => setState((s) => ({ ...s, sort })), []);
  const clear = useCallback(() => setState((s) => ({ ...s, ...emptyFilters() })), []);
  return { view, state, onSort, setSort, setQuery, setFilter, clear, active: filtersActive(state) };
}
