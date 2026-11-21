/**
 * Sort and filter for list tables, as plain functions so they can be tested without a browser.
 *
 * A header click cycles ascending, descending, off. A row is hidden unless it passes the text search
 * (every typed word must appear in the row's searchable text) and every dropdown filter that is set.
 * Rows with no value for the sorted column always go last, in either direction.
 */

export type SortDir = 'asc' | 'desc';
export type SortSpec = { key: string; dir: SortDir } | null;

/** The next sort after a click on `key`: a new column starts ascending; ascending -> descending -> off. */
export function nextSort(current: SortSpec, key: string): SortSpec {
  if (!current || current.key !== key) return { key, dir: 'asc' };
  return current.dir === 'asc' ? { key, dir: 'desc' } : null;
}

export interface ViewState {
  query: string;
  /** Dropdown filter values by filter key; '' (or absent) means no filter. */
  filters: Record<string, string>;
  sort: SortSpec;
}

export interface ViewSpec<R> {
  /** Text the search box looks through (for example the visitor and the host unit). */
  searchText?: (row: R) => string;
  /** The value a row has for each dropdown filter. */
  filters?: Record<string, (row: R) => string>;
  /** The value a row sorts by for each sortable column; null sorts last. */
  sorts?: Record<string, (row: R) => string | number | null>;
}

export function emptyFilters(): Pick<ViewState, 'query' | 'filters'> {
  return { query: '', filters: {} };
}

export function filtersActive(state: Pick<ViewState, 'query' | 'filters'>): boolean {
  return state.query.trim() !== '' || Object.values(state.filters).some((v) => v !== '');
}

export function matches<R>(row: R, spec: ViewSpec<R>, state: Pick<ViewState, 'query' | 'filters'>): boolean {
  const words = state.query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    const text = (spec.searchText?.(row) ?? '').toLowerCase();
    if (!words.every((w) => text.includes(w))) return false;
  }
  for (const [key, want] of Object.entries(state.filters)) {
    if (want === '') continue;
    const of = spec.filters?.[key];
    if (of && of(row) !== want) return false;
  }
  return true;
}

export function applyView<R>(rows: readonly R[], spec: ViewSpec<R>, state: ViewState, locale = 'en'): R[] {
  const kept = rows.filter((r) => matches(r, spec, state));
  const by = state.sort ? spec.sorts?.[state.sort.key] : undefined;
  if (!state.sort || !by) return kept;
  const sign = state.sort.dir === 'asc' ? 1 : -1;
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  return kept
    .map((row, index) => ({ row, index, value: by(row) }))
    .sort((a, b) => {
      if (a.value === null && b.value === null) return a.index - b.index;
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      const c = typeof a.value === 'number' && typeof b.value === 'number'
        ? a.value - b.value
        : collator.compare(String(a.value), String(b.value));
      return c * sign || a.index - b.index;
    })
    .map((x) => x.row);
}

/** The distinct values a column has, for a dropdown: value as filtered on, label as shown. */
export function distinctOptions<R>(rows: readonly R[], of: (row: R) => string, locale = 'en'): Array<{ value: string; label: string }> {
  const seen = new Set<string>();
  for (const r of rows) {
    const v = of(r);
    if (v !== '' && v !== '—') seen.add(v);
  }
  const collator = new Intl.Collator(locale);
  return [...seen].sort(collator.compare).map((v) => ({ value: v, label: v }));
}

/** aria-sort for a header: the sorted column says which way, the others say none. */
export function ariaSortFor(sort: SortSpec, key: string): 'ascending' | 'descending' | 'none' {
  return sort && sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
}
