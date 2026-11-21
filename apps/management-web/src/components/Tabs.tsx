/**
 * Shared tab strips for the page hierarchy (PT rule, 2026-11-19):
 *   L1 LineTabs   — underline strip directly under the page title.
 *   L2 ButtonTabs — icon + label + count buttons that set the SAME filter the
 *                   stat cards above them drive.
 * A pop-up (Dialog, L3) may hold its own LineTabs and ButtonTabs (L4); nothing
 * nests deeper. Both are WAI-ARIA tablists with arrow-key roving.
 *
 * ButtonTabs `active` may be null: a filter that matches no tab (a stat card
 * whose set is not a tab) lights none, and the filter chip carries it instead.
 *
 * @version 0.2.0
 * @changelog
 *   0.2.0 (2026-11-19) ButtonTabs are two lines: icon and title side by side on line 1, the count pill centred under them on line 2 (was three lines).
 *   0.1.0 (2026-11-19) New. Replaces the per-screen pane / view tab copies as
 *     screens migrate.
 */

import { useRef, type KeyboardEvent } from 'react';
import { Icon, type IconName } from './Icon.tsx';
import { nextTabId } from './tab-keys.ts';
import { number } from '../format/datetime.ts';
import type { Locale } from '../i18n/locale.ts';

export type TabItem<Id extends string> = {
  id: Id;
  label: string;
  icon?: IconName;
  count?: number;
  /** Count is a problem count (e.g. overdue): tint it. */
  alert?: boolean;
};

type StripProps<Id extends string> = {
  items: readonly TabItem<Id>[];
  active: Id | null;
  locale: Locale;
  onChange: (id: Id) => void;
  ariaLabel: string;
  /** Prefix for tab ids and `data-tab`; also the test id root (`<root>-tab`). */
  root: string;
};

function Strip<Id extends string>({
  variant,
  items,
  active,
  locale,
  onChange,
  ariaLabel,
  root,
}: StripProps<Id> & { variant: 'line' | 'button' }) {
  const refs = useRef(new Map<Id, HTMLButtonElement>());
  const ids = items.map((i) => i.id);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = nextTabId(ids, active, e.key);
    if (next === null) return;
    e.preventDefault();
    onChange(next);
    refs.current.get(next)?.focus();
  };
  const tabbable = active ?? ids[0];
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={variant === 'line' ? 'pemo-linetabs' : 'pemo-buttontabs'}
      data-testid={`${root}-tabs`}
      onKeyDown={onKeyDown}
    >
      {items.map((it) => {
        const selected = it.id === active;
        return (
          <button
            key={it.id}
            ref={(el) => {
              if (el) refs.current.set(it.id, el);
              else refs.current.delete(it.id);
            }}
            type="button"
            role="tab"
            id={`${root}-tab-${it.id}`}
            aria-selected={selected}
            tabIndex={it.id === tabbable ? 0 : -1}
            className={variant === 'line' ? 'pemo-linetab' : 'pemo-buttontab'}
            data-testid={`${root}-tab`}
            data-tree-chrome="true"
            data-tab={it.id}
            onClick={() => onChange(it.id)}
          >
            {variant === 'button' ? (
              <span className="pemo-buttontab__head">
                {it.icon ? <Icon name={it.icon} size={20} /> : null}
                <span className="pemo-tab__label">{it.label}</span>
              </span>
            ) : (
              <>
                {it.icon ? <Icon name={it.icon} size={16} /> : null}
                <span className="pemo-tab__label">{it.label}</span>
              </>
            )}
            {it.count !== undefined ? (
              <span
                className="pemo-tab__count"
                data-testid={`${root}-tab-count`}
                data-alert={it.alert && it.count > 0 ? 'true' : undefined}
              >
                {number(it.count, locale)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** L1: underline strip under the page title. */
export function LineTabs<Id extends string>(props: StripProps<Id>) {
  return <Strip variant="line" {...props} />;
}

/** L2: icon + label + count buttons; shares its filter with the stat cards. */
export function ButtonTabs<Id extends string>(props: StripProps<Id>) {
  return <Strip variant="button" {...props} />;
}
