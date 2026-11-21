/**
 * Small v3 building blocks for Payments & refunds: outlined status tags, the
 * one source chip + ⓘ that replaces stacked notes, icon + label links and
 * the honest empty state.
 */

import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale, type LocalizedText } from '../i18n/locale.ts';
import { Icon, SpecIcon, ICON_SIZE, type IconName, type IconSpec } from './Icon.tsx';
import type { TagTone } from '../finance/finance-ui.ts';
import { useDetailChrome } from './DetailChrome.tsx';

/** Read-only status tag: borderless light tint of the state colour (4S section 6). */
export function StatusTag({
  tone,
  icon,
  children,
  testId,
}: {
  tone: TagTone;
  icon?: IconName | undefined;
  children: ReactNode;
  testId?: string | undefined;
}) {
  return (
    <span className="pemo-tag" data-tone={tone} data-testid={testId}>
      {icon ? <Icon name={icon} size={14} /> : null}
      <span>{children}</span>
    </span>
  );
}

/** Position and open state of a help bubble, clamped to the viewport. */
function useBubble() {
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ left: number; top: number; width: number } | null>(null);
  const show = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(300, window.innerWidth - 16);
    setAt({ left: Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 8)), top: r.bottom + 6, width });
  };
  return { id, btn, at, setAt, show };
}

/**
 * Help bubble (4S guide sections 9 and 14): an icon button whose bubble opens on
 * hover, on keyboard focus and on tap/click, and closes on Escape or blur. The
 * text is also the accessible name. Never the only home of a safety or error
 * message: it carries optional explanation only.
 */
export function InfoTip({ text, testId }: { text: string; testId?: string | undefined }) {
  const { id, btn, at, setAt, show } = useBubble();
  return (
    <span className="pemo-help">
      <button
        ref={btn}
        type="button"
        className="pemo-infotip"
        aria-label={text}
        aria-describedby={at ? id : undefined}
        aria-expanded={at !== null}
        data-read-affordance="help"
        data-testid={testId}
        onMouseEnter={show}
        onMouseLeave={() => setAt(null)}
        onFocus={show}
        onBlur={() => setAt(null)}
        onClick={() => (at ? setAt(null) : show())}
        onKeyDown={(e) => { if (e.key === 'Escape') setAt(null); }}
      >
        <Icon name="Info" size={ICON_SIZE.control} />
      </button>
      {at ? (
        <span role="tooltip" id={id} className="pemo-help__bubble" style={{ left: at.left, top: at.top, width: at.width }}>
          {text}
        </span>
      ) : null}
    </span>
  );
}

/* Page-level hints: every one a page declares is gathered into ONE (i) beside the page title. */
type PageHint = { key: number; testId?: string | undefined; text: string };
let hintSeq = 0;
let pageHints: PageHint[] = [];
const hintListeners = new Set<() => void>();
const emitHints = () => hintListeners.forEach((l) => l());
const subscribeHints = (l: () => void) => { hintListeners.add(l); return () => { hintListeners.delete(l); }; };
const snapshotHints = () => pageHints;

/** The single (i) in the page head: all the page's hints, one per line. Nothing when the page has none. */
export function PageInfo() {
  const hints = useSyncExternalStore(subscribeHints, snapshotHints);
  if (hints.length === 0) return null;
  return <InfoTip text={hints.map((h) => h.text).join('\n')} testId="page-info-tip" />;
}

/** An optional explanation. At page level it joins the (i) beside the page title; inside a titled panel or a pop-up it is its own (i). */
export function HintRow({ text, testId }: { text: string; testId?: string | undefined }) {
  const row = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(false);
  useLayoutEffect(() => {
    const el = row.current;
    if (!el) return;
    const keep = el.closest('[role="dialog"], dialog') !== null || el.parentElement?.querySelector(':scope > .pemo-panel__title') != null;
    setPage(!keep && document.getElementById('pemo-page-info') !== null);
  }, []);
  useEffect(() => {
    if (!page) return undefined;
    const hint: PageHint = { key: ++hintSeq, testId, text };
    pageHints = [...pageHints, hint];
    emitHints();
    return () => { pageHints = pageHints.filter((h) => h.key !== hint.key); emitHints(); };
  }, [page, testId, text]);
  // The text stays in the page for readers and tests, visually hidden; the bubble is the page's single (i).
  if (page) return <span role="note" className="pemo-visually-hidden" data-testid={testId} aria-label={text}>{text}</span>;
  return <div className="pemo-hint-row" ref={row}><InfoTip text={text} testId={testId} /></div>;
}

/** One `Sample data` / `Live` chip with its detail in an ⓘ, replacing note stacks. */
export function SourceTag({ live, locale, testId }: { live: boolean; locale: Locale; testId: string }) {
  const M = MESSAGES.finance;
  return (
    <span className="pemo-source" data-source={live ? 'live' : 'sample'}>
      <StatusTag tone="neutral" icon={live ? 'Radio' : 'FlaskConical'} testId={testId}>
        {t(live ? M.liveLabel : M.fixtureLabel, locale)}
      </StatusTag>
      <InfoTip text={t(live ? M.sourceInfoLive : M.sourceInfoSample, locale)} testId={`${testId}-info`} />
    </span>
  );
}

/** Card heading row (4S section 3) with optional right-hand content. */
export function TitleStrip({
  icon,
  title,
  info,
  children,
  testId,
  head = false,
}: {
  icon?: IconSpec | undefined;
  title: string;
  info?: string | undefined;
  children?: ReactNode | undefined;
  testId?: string | undefined;
  /** The record's own title: in the detail pop-up it becomes the pop-up's title and is not drawn twice. */
  head?: boolean;
}) {
  const inDialog = useDetailChrome(head ? title : null, info);
  if (head && inDialog) return children ? <div className="pemo-titlestrip__aside">{children}</div> : null;
  return (
    <div className="pemo-titlestrip" data-testid={testId}>
      <h2 className="pemo-titlestrip__title">
        {icon ? <SpecIcon spec={icon} size={ICON_SIZE.nav} /> : null}
        <span>{title}</span>
        {info ? <InfoTip text={info} testId={testId ? `${testId}-info` : undefined} /> : null}
      </h2>
      {children ? <div className="pemo-titlestrip__aside">{children}</div> : null}
    </div>
  );
}

/** Harmless navigation: object icon + short label + chevron. No "View". */
export function ObjectLink({
  href,
  icon,
  label,
  onOpen,
  testId,
  stopRow = false,
}: {
  href: string;
  icon: IconSpec;
  label: string;
  onOpen: () => void;
  testId: string;
  stopRow?: boolean;
}) {
  return (
    <a
      className="pemo-rowlink"
      href={href}
      data-testid={testId}
      data-read-affordance="navigate"
      onClick={(e) => {
        e.preventDefault();
        if (stopRow) e.stopPropagation();
        onOpen();
      }}
    >
      <SpecIcon spec={icon} size={ICON_SIZE.control} />
      <span>{label}</span>
      <Icon name="ChevronRight" size={14} />
    </a>
  );
}

/** ← Object (not "Back to …"). */
export function BackLink({
  href,
  label,
  locale,
  onBack,
  testId,
  always = false,
}: {
  href: string;
  label: LocalizedText;
  locale: Locale;
  onBack: () => void;
  testId: string;
  /** Draw it inside the detail pop-up too (the host's own back arrow does). */
  always?: boolean;
}) {
  const inDialog = useDetailChrome(null);
  if (inDialog && !always) return null;
  return (
    <a
      className="pemo-backlink"
      href={href}
      data-testid={testId}
      data-read-affordance="navigate"
      onClick={(e) => {
        e.preventDefault();
        onBack();
      }}
    >
      <Icon name="ArrowLeft" size={ICON_SIZE.control} />
      <span>{t(label, locale)}</span>
    </a>
  );
}

/** Honest empty state: a title and a Clear filters action, nothing else. */
export function NoMatch({
  title,
  locale,
  onClear,
  testId,
}: {
  title: LocalizedText;
  locale: Locale;
  onClear: () => void;
  testId: string;
}) {
  return (
    <section className="pemo-state" data-testid={testId} role="status">
      <h2 className="pemo-state__title">{t(title, locale)}</h2>
      <button type="button" className="pemo-button pemo-button--quiet" data-testid={`${testId}-clear`} data-read-affordance="filter" onClick={onClear}>
        <Icon name="X" size={ICON_SIZE.control} />
        <span>{t(MESSAGES.finance.clearFilters, locale)}</span>
      </button>
    </section>
  );
}

/** Filter heading as an icon only, with an accessible name. */
export function FilterMark({ locale }: { locale: Locale }) {
  const label = t(MESSAGES.finance.filterLabel, locale);
  return (
    <span className="pemo-filtermark" role="img" aria-label={label} title={label}>
      <Icon name="ListFilter" size={ICON_SIZE.nav} />
    </span>
  );
}

/**
 * Money cell: tabular numerals, right-aligned, nowrap, and NEVER truncated —
 * no ellipsis, no overflow clip. Column widths must leave room for it.
 */
export function NumCell({ value, testId }: { value: string; testId?: string | undefined }) {
  return (
    <td className="pemo-cell--money pemo-num" data-money="true" data-testid={testId}>
      {value}
    </td>
  );
}

/**
 * PT guideline §6: system IDs, codes and technical tags never sit on main
 * pages. Detail screens put them here, collapsed by default.
 */
export function ITDetails({
  locale,
  rows,
  testId = 'it-details',
}: {
  locale: Locale;
  rows: ReadonlyArray<readonly [label: LocalizedText, value: ReactNode]>;
  testId?: string;
}) {
  return (
    <details className="pemo-itdetails" data-testid={testId}>
      <summary>{t(MESSAGES.finance.itDetails, locale)}</summary>
      <dl className="pemo-dl">
        {rows.map(([label, value], i) => (
          <div key={i} className="pemo-itdetails__row">
            <dt>{t(label, locale)}</dt>
            <dd><span className="pemo-identifier">{value}</span></dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** "Sample data" / "Live" as plain text, for IT details only. */
export function sourceText(live: boolean, locale: Locale): string {
  return t(live ? MESSAGES.finance.liveLabel : MESSAGES.finance.fixtureLabel, locale);
}
