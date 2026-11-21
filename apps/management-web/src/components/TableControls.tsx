/** The filter bar above a list table: a text search, dropdown filters and a Clear filters link. */

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { Icon } from './Icon.tsx';

export interface FilterDef {
  key: string;
  label: string;
  /** The first option, which turns the filter off. */
  allLabel: string;
  options: ReadonlyArray<{ value: string; label: string; group?: string | undefined }>;
  value: string;
  onChange: (value: string) => void;
}

/** Room one row needs: the search at its minimum, each dropdown at its minimum, the gaps and a Clear link. */
const SEARCH_MIN = 180;
const SELECT_MIN = 140;
const GAP = 10;
const CLEAR_ROOM = 90;
const roomNeeded = (filters: number): number => SEARCH_MIN + filters * (SELECT_MIN + GAP) + CLEAR_ROOM;

/** True when the bar's own box is too tight for one row, so the dropdowns move into a popover. */
function useTooNarrow(ref: React.RefObject<HTMLElement | null>, filters: number): boolean {
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setNarrow(el.getBoundingClientRect().width < roomNeeded(filters));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, filters]);
  return narrow;
}

function FilterSelect({ f, testId }: { f: FilterDef; testId: string }) {
  return (
    <label className="pemo-field pemo-table-filters__select">
      <span className="pemo-visually-hidden">{f.label}</span>
      <select
        value={f.value}
        aria-label={f.label}
        data-read-affordance="filter"
        data-testid={`${testId}-${f.key}`}
        onChange={(e) => f.onChange(e.target.value)}
      >
        <option value="">{f.allLabel}</option>
        {f.options.filter((o) => !o.group).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        {[...new Set(f.options.filter((o) => o.group).map((o) => o.group!))].map((g) => (
          <optgroup key={g} label={g}>
            {f.options.filter((o) => o.group === g).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/** One row when there is room; when there is not, the dropdowns sit behind a Filters button. */
export function FilterBar({ locale, testId, searchLabel, query, onQuery, filters, active, onClear }: {
  locale: Locale;
  testId: string;
  searchLabel: string;
  query: string;
  onQuery: (q: string) => void;
  filters: readonly FilterDef[];
  active: boolean;
  onClear: () => void;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const narrow = useTooNarrow(bar, filters.length);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const count = filters.filter((f) => f.value !== '').length;
  const clear = (
    <button type="button" className="pemo-table-filters__clear" data-read-affordance="filter" data-testid={`${testId}-clear`} onClick={onClear}>
      {t(MESSAGES.tableView.clear, locale)}
    </button>
  );

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => {
      if (bar.current && !bar.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={bar} className="pemo-table-filters" data-testid={testId} data-layout={narrow ? 'popover' : 'row'} role="search" aria-label={searchLabel}>
      <label className="pemo-field pemo-table-filters__search">
        <span className="pemo-visually-hidden">{searchLabel}</span>
        <input
          type="search"
          value={query}
          placeholder={searchLabel}
          data-read-affordance="filter"
          data-testid={`${testId}-search`}
          onChange={(e) => onQuery(e.target.value)}
        />
      </label>
      {narrow ? (
        <>
          <button
            type="button"
            className="pemo-table-filters__toggle"
            aria-expanded={open}
            aria-controls={panelId}
            data-read-affordance="filter"
            data-testid={`${testId}-toggle`}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name="ListFilter" size={16} />
            <span>{t(MESSAGES.tableView.filters, locale)}</span>
            {count > 0 ? <span className="pemo-table-filters__badge" data-testid={`${testId}-count`}>{count}</span> : null}
          </button>
          {open ? (
            <div id={panelId} className="pemo-table-filters__panel" role="group" aria-label={t(MESSAGES.tableView.filters, locale)} data-testid={`${testId}-panel`}>
              {filters.map((f) => <FilterSelect key={f.key} f={f} testId={testId} />)}
            </div>
          ) : null}
          {active ? clear : null}
        </>
      ) : (
        <>
          {filters.map((f) => <FilterSelect key={f.key} f={f} testId={testId} />)}
          {active ? clear : null}
        </>
      )}
    </div>
  );
}

/** What replaces a table when the search and filters leave nothing. */
export function NoMatches({ locale, testId }: { locale: Locale; testId: string }) {
  return <p className="pemo-note" data-testid={testId} role="status">{t(MESSAGES.tableView.noMatches, locale)}</p>;
}
