/**
 * Stat card and the filter chip row that goes with it.
 *
 * A card with `onPress` is a toggle button: hover, focus ring, `aria-pressed`,
 * Enter / Space. A card without it is plain text, not focusable and not
 * styled as clickable — never fake a target the page cannot filter to.
 * Counts are the number of rows the press would show, derived from the same
 * rows the table renders.
 *
 * @version 0.3.0
 * @changelog
 *   0.3.0 (2026-11-19) `icon` is required (a card without one fails tsc) and is drawn as a small tinted chip before the label, decorative (aria-hidden), one style on every page.
 *   0.2.0 (2026-11-19) Optional icon; StatCardRow for pages whose cards drive one filter.
 *   0.1.0 (2026-11-19) New.
 */

import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon.tsx';
import { number } from '../format/datetime.ts';
import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';

export function StatCard({
  id,
  label,
  value,
  locale,
  note,
  tip,
  tone,
  active,
  onPress,
  icon,
  nav,
}: {
  id: string;
  label: string;
  value: number | string;
  locale: Locale;
  /** How the number is counted: kept for readers as hidden text, shown as the card's tooltip. */
  note?: ReactNode;
  /** The same explanation as plain text, for the tooltip. */
  tip?: string | undefined;
  /** Severity tint for the number (warning / critical). */
  tone?: 'warning' | 'critical' | undefined;
  active?: boolean | undefined;
  onPress?: (() => void) | undefined;
  /** Required: every card carries a glyph from the local icon set, drawn as a decorative chip. */
  icon: IconName;
  /** The press goes to another page, not a filter on this one: no pressed state. */
  nav?: boolean | undefined;
}) {
  const shown = typeof value === 'number' ? number(value, locale) : value;
  const body = (
    <>
      <span className="pemo-statcard__value" data-testid="stat-card-value">
        {shown}
      </span>
      <span className="pemo-statcard__label">
        <span className="pemo-statcard__chip" aria-hidden="true" data-testid="stat-card-icon" data-icon={icon}>
          <Icon name={icon} size={16} strokeWidth={2} />
        </span>
        {label}
        {onPress && !nav ? <Icon name="ListFilter" size={14} /> : null}
      </span>
      {note ? <span className="pemo-statcard__note pemo-visually-hidden">{note}</span> : null}
    </>
  );
  if (!onPress) {
    return (
      <div className="pemo-statcard" data-testid="stat-card" data-stat={id} data-tone={tone} title={tip}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      className="pemo-statcard pemo-statcard--press"
      data-testid="stat-card"
      data-tree-chrome="true"
      data-stat={id}
      data-tone={tone}
      aria-pressed={nav ? undefined : active === true}
      title={nav ? tip : (tip ?? t(MESSAGES.ui.cardFilters, locale))}
      onClick={onPress}
    >
      {body}
    </button>
  );
}

/** "Filtered by [chip ×]   Clear   Showing 3 of 12" — only while a filter is on. */
export function FilterChipRow({
  label,
  shown,
  total,
  locale,
  onClear,
}: {
  label: string;
  shown: number;
  total: number;
  locale: Locale;
  onClear: () => void;
}) {
  return (
    <div className="pemo-filterrow" data-testid="filter-row">
      <span className="pemo-filterrow__lead">{t(MESSAGES.ui.filteredBy, locale)}</span>
      <span className="pemo-filterchip" data-testid="filter-chip">
        {label}
        <button
          type="button"
          className="pemo-filterchip__x"
          aria-label={`${t(MESSAGES.ui.removeFilter, locale)}: ${label}`}
          data-testid="filter-chip-remove"
          data-tree-chrome="true"
          onClick={onClear}
        >
          <Icon name="X" size={14} />
        </button>
      </span>
      <button type="button" className="pemo-filterrow__clear" data-tree-chrome="true" data-testid="filter-clear" onClick={onClear}>
        {t(MESSAGES.ui.clearFilter, locale)}
      </button>
      <span className="pemo-meta" data-testid="filter-count">
        {t(MESSAGES.ui.showingRows, locale)
          .replace('{shown}', number(shown, locale))
          .replace('{total}', number(total, locale))}
      </span>
    </div>
  );
}

export interface CardSpec<K extends string> {
  key: K;
  label: string;
  /** The number of rows pressing this card would show. */
  value: number;
  icon: IconName;
  tone?: 'warning' | 'critical';
  note?: ReactNode;
  /** False when the page has nothing to filter to: the card stays plain text. */
  press: boolean;
}

/** A row of cards that share one filter: press toggles, the active card stays lit, a target-less card is inert. */
export function StatCardRow<K extends string>({
  cards,
  active,
  onPick,
  locale,
  testId,
}: {
  cards: readonly CardSpec<K>[];
  active: K | null;
  onPick: (next: K | null) => void;
  locale: Locale;
  testId: string;
}) {
  return (
    <div className="pemo-statcards" data-testid={testId}>
      {cards.map((c) => (
        <StatCard
          key={c.key}
          id={c.key}
          label={c.label}
          value={c.value}
          locale={locale}
          icon={c.icon}
          tone={c.tone}
          note={c.note}
          active={c.press && active === c.key}
          onPress={c.press ? () => onPick(active === c.key ? null : c.key) : undefined}
        />
      ))}
    </div>
  );
}

/** The chip row for a card-driven filter: label of the lit card, rows shown of rows total. */
export function cardChip<K extends string>(cards: readonly CardSpec<K>[], active: K | null): string | null {
  return cards.find((c) => c.key === active)?.label ?? null;
}
