/** Table primitives. Semantic <table>, per the no-component-library decision. */

import type { KeyboardEventHandler, ReactNode, Ref } from 'react';
import { Icon } from './Icon.tsx';
import { ariaSortFor, type SortSpec } from './table-view.ts';

/**
 * A column may set `hideBelow` (px of the table's card). When the card is
 * narrower, the column is dropped instead of the table scrolling inside the
 * card, and any element marked `data-alt="<key>"` in the row (a context line
 * under the row's main text) appears in its place. UX re-check 2.
 */
export type TableColumn = { key: string; label: string; width?: string; hideBelow?: number; sortable?: boolean };

/** Header sorting: which column is sorted and which way, and what a click on a sortable header does. */
export type TableSort = { sort: SortSpec; onSort: (key: string) => void };

/** The main column is set at the reference's 1.4 type scale, so a column needs about 1.2x
 * the card width it needed at 14px before the row fits without scrolling. */
const TYPE_SCALE = 1.2;

function narrowCss(testId: string, columns: TableColumn[]): string {
  const t = `[data-testid="${testId}"]`;
  return columns
    .map((c, i) => (c.hideBelow
      ? `${t} [data-alt="${c.key}"]{display:none}` +
        `@container (max-width:${Math.round(c.hideBelow * TYPE_SCALE) - 1}px){` +
        `${t}>colgroup>col:nth-child(${i + 1}),${t} tr>:nth-child(${i + 1}):not([colspan]){display:none}` +
        `${t} [data-alt="${c.key}"]{display:block}}`
      : ''))
    .join('');
}

export function Table({ caption, columns, children, testId, bodyRef, onBodyKeyDown, bodyTestId, sorting }: {
  caption: string;
  columns: TableColumn[];
  children: ReactNode;
  testId: string;
  /** Optional tbody ref (e.g. keyboard cursor row focus). */
  bodyRef?: Ref<HTMLTableSectionElement>;
  onBodyKeyDown?: KeyboardEventHandler<HTMLTableSectionElement>;
  bodyTestId?: string;
  /** Makes the columns marked `sortable` into header buttons (asc, desc, off) with aria-sort. */
  sorting?: TableSort;
}) {
  return (
    <div className="pemo-table-wrap">
      {columns.some((c) => c.hideBelow) ? <style>{narrowCss(testId, columns)}</style> : null}
      <table className="pemo-table" data-testid={testId}>
        <caption className="pemo-visually-hidden">{caption}</caption>
        <colgroup>
          {columns.map((c) => <col key={c.key} style={c.width ? { width: c.width } : undefined} />)}
        </colgroup>
        <thead>
          <tr>
            {columns.map((c) => (c.sortable && sorting ? (
              <th key={c.key} scope="col" aria-sort={ariaSortFor(sorting.sort, c.key)}>
                <button
                  type="button"
                  className="pemo-th-sort"
                  data-read-affordance="sort"
                  data-testid={`sort-${c.key}`}
                  onClick={() => sorting.onSort(c.key)}
                >
                  <span>{c.label}</span>
                  {sorting.sort?.key === c.key ? (
                    <Icon name={sorting.sort.dir === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={14} strokeWidth={2} />
                  ) : null}
                </button>
              </th>
            ) : <th key={c.key} scope="col">{c.label}</th>))}
          </tr>
        </thead>
        <tbody ref={bodyRef} onKeyDown={onBodyKeyDown} data-testid={bodyTestId}>
          {children}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A cell that truncates rather than widening its column.
 *
 * `title` is REQUIRED, not optional. A dense cell clips its content, and
 * Traditional Chinese clips where the English equivalent does not — a date
 * renders as `12 Aug 2026, 09:42 am` in English and `2026年8月12日 上午09:42` in
 * Chinese, and only the second overflows. Silent clipping leaves a staff member
 * unable to tell a value is incomplete, so the full text must stay reachable.
 *
 * Found by the dense-cell layout suite, which failed on exactly that timestamp.
 * Made a required prop rather than fixed in place: the compiler now refuses the
 * defect instead of a reviewer having to notice it.
 */
export function DenseCell({ children, title }: { children: ReactNode; title: string }) {
  return <td className="pemo-cell--dense" title={title} data-dense="true">{children}</td>;
}

/**
 * A cell that wraps at word boundaries and clamps to two lines in tables.
 * Pass `title` with the full text so clipped content stays reachable (same
 * reason DenseCell requires it). Optional so short labels can omit it.
 */
export function WrapCell({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <td className="pemo-cell--wrap" title={title} data-wrap="true">
      <span className="pemo-cell--wrap__inner">{children}</span>
    </td>
  );
}
