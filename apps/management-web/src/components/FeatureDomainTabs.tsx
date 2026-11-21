/**
 * Function-domain tabs shared by Group rights, User effective permissions,
 * and the Roles matrix.
 * Labels come from MESSAGES.admin.featureDomain, total over FeatureDomainId.
 *
 * Groups Rights uses the underline strip (active purple + bottom border, muted
 * inactive, granted/total badges) with overflow arrows when the list is wider
 * than the panel. Roles and Users share the same strip; badges are optional.
 */

import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { number } from '../format/datetime.ts';
import {
  FEATURE_DOMAIN_IDS,
  featureDomainLabel,
  type FeatureDomainId,
} from '../data/feature-domains.ts';

export type DomainTabCount = { granted: number; total: number };

export type DomainTabItem<Id extends string> = {
  id: Id;
  label: string;
  count?: DomainTabCount;
};

function tabCountAria(count: DomainTabCount, locale: Locale): string {
  return t(MESSAGES.admin.rightsTabCountAria, locale)
    .replace('{granted}', number(count.granted, locale))
    .replace('{total}', number(count.total, locale));
}

export function DomainTabBar<Id extends string>({
  items,
  active,
  locale,
  onChange,
  idPrefix,
  panelId,
  ariaLabel,
  listTestId,
  tabTestId,
  module,
}: {
  items: readonly DomainTabItem<Id>[];
  active: Id;
  locale: Locale;
  onChange: (id: Id) => void;
  idPrefix: string;
  panelId: string;
  ariaLabel: string;
  listTestId: string;
  tabTestId: string;
  module?: string;
}) {
  const M = MESSAGES.admin;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const focusFromKeys = useRef(false);
  const [overflow, setOverflow] = useState(false);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 1;
    setOverflow(hasOverflow);
    setCanPrev(hasOverflow && el.scrollLeft > 1);
    setCanNext(hasOverflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [measure, items.length]);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const selected = el.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (selected) {
      const s = el.getBoundingClientRect();
      const t = selected.getBoundingClientRect();
      if (t.left < s.left) el.scrollLeft -= s.left - t.left;
      else if (t.right > s.right) el.scrollLeft += t.right - s.right;
    }
    if (focusFromKeys.current) {
      focusFromKeys.current = false;
      selected?.focus({ preventScroll: true });
    }
    measure();
  }, [active, measure]);

  const scrollByPage = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = Math.max(Math.floor(el.clientWidth * 0.7), 160) * dir;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const moveActive = (nextIndex: number) => {
    const bounded = (nextIndex + items.length) % items.length;
    const next = items[bounded];
    if (!next) return;
    focusFromKeys.current = true;
    onChange(next.id);
  };

  const onTabListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = items.findIndex((item) => item.id === active);
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      moveActive(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveActive(i + 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      moveActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      moveActive(items.length - 1);
    }
  };

  return (
    <div
      className="pemo-domain-tabbar"
      data-overflow={overflow ? 'true' : 'false'}
      data-testid={`${listTestId}-bar`}
    >
      <button
        type="button"
        className="pemo-domain-tabbar__arrow"
        data-testid="admin-domain-tabs-prev"
        data-dir="prev"
        aria-label={t(M.rightsTabsScrollPrev, locale)}
        disabled={!overflow || !canPrev}
        hidden={!overflow}
        onClick={() => scrollByPage(-1)}
      >
        <span className="pemo-domain-tabbar__chevron pemo-domain-tabbar__chevron--prev" aria-hidden="true" />
      </button>
      <div
        ref={scrollerRef}
        className="pemo-domain-tabbar__scroller"
        role="tablist"
        aria-label={ariaLabel}
        data-testid={listTestId}
        onKeyDown={onTabListKeyDown}
      >
        {items.map((item) => {
          const selected = item.id === active;
          const tabId = `${idPrefix}-tab-${item.id}`;
          const count = item.count;
          const name = count
            ? `${item.label} — ${tabCountAria(count, locale)}`
            : item.label;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={tabId}
              className="pemo-domain-tab"
              data-testid={tabTestId}
              data-domain={item.id}
              data-module={module}
              data-read-affordance="filter"
              aria-selected={selected}
              aria-controls={panelId}
              aria-label={name}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.id)}
            >
              <span className="pemo-domain-tab__label" data-testid={`${tabTestId}-label`}>
                {item.label}
              </span>
              {count ? (
                <span
                  className="pemo-domain-tab__count"
                  data-testid={`${tabTestId}-count`}
                  data-granted={String(count.granted)}
                  data-total={String(count.total)}
                  aria-hidden="true"
                >
                  {number(count.granted, locale)}/{number(count.total, locale)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="pemo-domain-tabbar__arrow"
        data-testid="admin-domain-tabs-next"
        data-dir="next"
        aria-label={t(M.rightsTabsScrollNext, locale)}
        disabled={!overflow || !canNext}
        hidden={!overflow}
        onClick={() => scrollByPage(1)}
      >
        <span className="pemo-domain-tabbar__chevron pemo-domain-tabbar__chevron--next" aria-hidden="true" />
      </button>
    </div>
  );
}

export function FeatureDomainTabs({
  active,
  locale,
  onChange,
  idPrefix,
  counts,
}: {
  active: FeatureDomainId;
  locale: Locale;
  onChange: (domain: FeatureDomainId) => void;
  idPrefix: string;
  counts?: Readonly<Partial<Record<FeatureDomainId, DomainTabCount>>>;
}) {
  const M = MESSAGES.admin;
  const items: DomainTabItem<FeatureDomainId>[] = FEATURE_DOMAIN_IDS.map((domain) => {
    const count = counts?.[domain];
    return count
      ? { id: domain, label: featureDomainLabel(domain, locale), count }
      : { id: domain, label: featureDomainLabel(domain, locale) };
  });
  return (
    <DomainTabBar
      items={items}
      active={active}
      locale={locale}
      onChange={onChange}
      idPrefix={idPrefix}
      panelId={`${idPrefix}-panel`}
      ariaLabel={t(M.rightsTablistLabel, locale)}
      listTestId="admin-function-tabs"
      tabTestId="admin-function-tab"
      module="pemo"
    />
  );
}

export function FeatureGrantMark({
  granted,
  locale,
  title,
}: {
  granted: boolean;
  locale: Locale;
  title: string;
}) {
  const M = MESSAGES.admin;
  return (
    <span
      className="pemo-matrix-mark"
      data-granted={granted ? 'true' : 'false'}
      title={title}
    >
      {granted ? '✓' : '—'}
      <span className="pemo-visually-hidden">
        {granted ? t(M.granted, locale) : t(M.notGranted, locale)}
      </span>
    </span>
  );
}

/** Interactive grant checkbox for Groups Rights (session-memory, not a live API). */
export function FeatureGrantToggle({
  granted,
  locale,
  label,
  onChange,
  testId,
}: {
  granted: boolean;
  locale: Locale;
  label: string;
  onChange: (next: boolean) => void;
  testId: string;
}) {
  const M = MESSAGES.admin;
  const status = granted ? t(M.granted, locale) : t(M.notGranted, locale);
  return (
    <label className="pemo-check pemo-check--grant">
      <input
        type="checkbox"
        data-testid={testId}
        data-read-affordance="fixture"
        checked={granted}
        aria-label={`${label} — ${status}`}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="pemo-visually-hidden">{status}</span>
    </label>
  );
}
