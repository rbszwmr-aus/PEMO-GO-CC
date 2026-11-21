/**
 * The Visits pattern for any status-based list page (PT rule, 2026-11-19): stat cards that
 * drill, L2 button tabs with counts that drive the SAME filter, sortable headers with a
 * default sort per tab, and one search + dropdown bar whose values persist across tabs.
 * A page declares its statuses once; this hook owns the filter, the counts and the sorts.
 *
 * @version 0.2.0
 * @changelog
 *   0.2.0 (2026-11-19) Every tab carries an icon (type-level, CardTabItem), because a tab named in cardIds becomes a stat card, which requires one; plain cards need an icon too.
 *   0.1.0 (2026-11-19) New. First used by Home Safety events; the other list pages follow.
 */

import { useMemo, useState } from 'react';
import { ButtonTabs, type TabItem } from './Tabs.tsx';
import { FilterChipRow, StatCard } from './StatCard.tsx';
import { useTableView } from './useTableView.ts';
import type { SortSpec, ViewSpec } from './table-view.ts';
import type { IconName } from './Icon.tsx';
import type { Locale } from '../i18n/locale.ts';

/** A status tab with its icon required: a tab named in `cardIds` becomes a stat card, and a card must have an icon. */
export type CardTabItem<Id extends string> = TabItem<Id> & { icon: IconName };

/** One status: a tab, optionally a card, a row test and the sort the table opens with. */
export interface StatusDef<R, Id extends string> {
  id: Id;
  test: (row: R) => boolean;
  sort: SortSpec;
}

/** `defs` must be a module constant: the first entry is "All". */
export function useStatusView<R, Id extends string>(rows: readonly R[], defs: readonly StatusDef<R, Id>[], spec: ViewSpec<R>, locale: Locale, initial?: Id) {
  const first = defs[0]!;
  const [filter, setFilter] = useState<Id>(initial ?? first.id);
  const counts = useMemo(
    () => Object.fromEntries(defs.map((d) => [d.id, rows.filter(d.test).length])) as Record<Id, number>,
    [rows, defs],
  );
  const def = defs.find((d) => d.id === filter) ?? first;
  const tabRows = useMemo(() => rows.filter(def.test), [rows, def]);
  const tv = useTableView(tabRows, spec, (defs.find((d) => d.id === (initial ?? first.id)) ?? first).sort, locale);
  const choose = (id: Id) => {
    setFilter(id);
    tv.setSort(defs.find((d) => d.id === id)?.sort ?? null);
  };
  /** A card press toggles its status; pressing the lit one returns to All. */
  const press = (id: Id) => choose(filter === id ? first.id : id);
  return { filter, counts, tv, choose, press, tabRows, total: rows.length };
}

/** Cards (for the listed statuses) over L2 tabs over the filter chip; the cards are the tabs' own counts. */
export function StatusHead<Id extends string>({
  tabs, cardIds, plainCards = [], filter, onChoose, onPress, shown, total, locale, root, ariaLabel, cardsTestId,
}: {
  /** Every tab carries an icon: a tab named in `cardIds` becomes a card, and a card must have one. */
  tabs: readonly CardTabItem<Id>[];
  cardIds: readonly Id[];
  /** Cards with no filter behind them (for example a figure the rows cannot reproduce): plain text, not buttons. */
  plainCards?: readonly { id: string; label: string; value: number; icon: IconName }[];
  filter: Id;
  onChoose: (id: Id) => void;
  onPress: (id: Id) => void;
  shown: number;
  total: number;
  locale: Locale;
  root: string;
  ariaLabel: string;
  cardsTestId: string;
}) {
  const first = tabs[0]!;
  const label = tabs.find((x) => x.id === filter)?.label ?? '';
  return (
    <>
      {cardIds.length > 0 || plainCards.length > 0 ? (
        <div className="pemo-statcards" data-testid={cardsTestId}>
          {plainCards.map((c) => <StatCard key={c.id} id={c.id} label={c.label} value={c.value} icon={c.icon} locale={locale} />)}
          {cardIds.map((id) => {
            const tab = tabs.find((x) => x.id === id)!;
            return (
              <StatCard
                key={id}
                id={id}
                label={tab.label}
                value={tab.count ?? 0}
                icon={tab.icon}
                tone={tab.alert ? 'warning' : undefined}
                locale={locale}
                active={filter === id}
                onPress={() => onPress(id)}
              />
            );
          })}
        </div>
      ) : null}
      <ButtonTabs items={tabs} active={filter} locale={locale} onChange={onChoose} ariaLabel={ariaLabel} root={root} />
      {filter !== first.id ? <FilterChipRow label={label} shown={shown} total={total} locale={locale} onClear={() => onChoose(first.id)} /> : null}
    </>
  );
}
