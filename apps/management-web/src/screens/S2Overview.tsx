/**
 * S2 — Overview.
 *
 * The attention queue is ordered by SERVICE TARGET, not by time; the export
 * states this explicitly and it is the one ordering rule the design commits to.
 *
 * The units-in-unknown-state counter carries its BASIS. The contract records
 * which severity levels the figure includes and whether it is deduplicated by
 * unit, because `unknown` and `offline` are different levels in severity.json
 * and that is exactly where the ambiguity came from. The response states both;
 * the contract decides neither; and this screen shows the basis rather than
 * presenting a bare number that cannot be interpreted.
 *
 * @version 0.2.0
 * @changelog
 *   0.2.0 (2026-11-19) Overview counters carry an icon each (COUNTER_ICON).
 */

import { HintRow } from '../components/FinanceBits.tsx';
import { MESSAGES } from '../i18n/messages.ts';
import { copy, isChinese, t, type Locale } from '../i18n/locale.ts';
import { dateTime, number } from '../format/datetime.ts';
import { SEVERITY } from '../theme/severity-tokens.g.ts';
import { StatCard } from '../components/StatCard.tsx';
import type { IconName } from '../components/Icon.tsx';
import { PlainChip } from '../components/SeverityChip.tsx';
import { DeferredActions } from '../components/DeferredActions.tsx';
import type { OverviewResponse } from '../data/types.ts';
import type { LocalizedText } from '../i18n/locale.ts';

const m = copy;

const DEFERRED = [
  m('Create a case', '建立個案', '建立案件'),
  m('Create a notice', '建立通告', '建立公告'),
];

function counterTip(c: OverviewResponse['counters'][number], locale: Locale): string | undefined {
  const M = MESSAGES.s2;
  const parts: string[] = [];
  if (c.windowHours) parts.push(`${number(c.windowHours, locale)} h`);
  if (c.basis) {
    parts.push(`${t(M.basisLabel, locale)} · ${t(M.basisIncludes, locale)}: ${(c.basis.includesSeverities ?? []).map((s) => t(SEVERITY[s].label, locale)).join(isChinese(locale) ? '、' : ', ')} · ${c.basis.deduplicatedByUnit ? t(M.basisDeduplicated, locale) : t(M.basisNotDeduplicated, locale)}`);
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/** One glyph per overview counter, from the local icon set. */
const COUNTER_ICON: Record<OverviewResponse['counters'][number]['key'], IconName> = {
  'open-cases': 'ClipboardList', 'safety-events-window': 'CircleAlert', 'notices-active': 'Send', 'units-unknown-state': 'CircleDashed',
};

export function S2Overview({
  data,
  locale,
  onCounterClick,
  focusKey,
}: {
  data: OverviewResponse;
  locale: Locale;
  /** Drill from a stats counter into its destination screen (keyed by counter.key). */
  onCounterClick?: Partial<Record<string, () => void>>;
  /** Picked place — counters stay grant-level; the note states that. */
  focusKey?: string | null;
}) {
  const M = MESSAGES.s2;
  return (
    <>
      {focusKey ? (
        <p className="pemo-note" data-testid="scope-filter-note" data-screen="s2">
          {t(MESSAGES.shell.overviewScopeNote, locale)}
        </p>
      ) : null}
      <section aria-label={t(M.countersHeading, locale)}>
        <h2 className="pemo-visually-hidden">{t(M.countersHeading, locale)}</h2>
        <div className="pemo-statcards">
          {data.counters.map((c) => (
            <StatCard
              key={c.key}
              id={c.key}
              label={t(c.label, locale)}
              value={c.value}
              locale={locale}
              icon={COUNTER_ICON[c.key]}
              nav
              onPress={onCounterClick?.[c.key]}
              tip={counterTip(c, locale)}
              note={
                c.windowHours || c.basis ? (
                  <>
                    {c.windowHours ? <span>{number(c.windowHours, locale)} h</span> : null}
                    {c.basis ? (
                      <span data-testid="counter-basis">
                        {t(M.basisLabel, locale)} · {t(M.basisIncludes, locale)}: {(c.basis.includesSeverities ?? []).map((s) => t(SEVERITY[s].label, locale)).join(isChinese(locale) ? '、' : ', ')}
                        {' · '}
                        {c.basis.deduplicatedByUnit ? t(M.basisDeduplicated, locale) : t(M.basisNotDeduplicated, locale)}
                      </span>
                    ) : null}
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      </section>

      <section className="pemo-panel">
        <h2 className="pemo-panel__title">{t(M.attentionHeading, locale)}</h2>
        <HintRow text={t(M.attentionNote, locale)} />
        <ul className="pemo-steps">
          {data.attention.map((a, i) => (
            <li key={i} className="pemo-step" data-testid="attention-item" data-kind={a.kind}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="pemo-cell--wrap">{t(a.title, locale)}</span>
                {a.subtitle ? <div className="pemo-meta">{t(a.subtitle, locale)}</div> : null}
              </span>
              {/* The target's STATE is what a reader branches on; the label is the
                  server's rendering of it. Both are shown, state first. */}
              <PlainChip testId="target-state">{t(M.targetState[a.target.state], locale)}</PlainChip>
              <span className="pemo-meta">{t(a.target.label, locale)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="pemo-panel">
        <h2 className="pemo-panel__title">{t(M.integrationHeading, locale)}</h2>
        <ul className="pemo-steps">
          {data.integrationHealth.map((f) => (
            <li key={f.key} className="pemo-step" data-testid="feed" data-feed={f.key}>
              {/* The name arrives from the contract as 2IoThub. The export's
                  retired IoT2Hub spelling is not reproduced. */}
              <span style={{ flex: 1 }} data-testid="feed-name">{f.name}</span>
              <PlainChip testId="feed-state">{t(M.feedState[f.state], locale)}</PlainChip>
              {f.lastExchangeAt ? (
                <span className="pemo-meta">
                  {t(M.lastExchange, locale)} {dateTime(f.lastExchangeAt, locale)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="pemo-panel">
        <h2 className="pemo-panel__title">{t(M.recentNoticesHeading, locale)}</h2>
        <ul className="pemo-steps">
          {data.recentNotices.map((n) => (
            <li key={n.noticeId} className="pemo-step" data-testid="recent-notice">
              <span style={{ flex: 1, minWidth: 0 }} className="pemo-cell--wrap">{t(n.title, locale)}</span>
              <PlainChip>{t(MESSAGES.s2.noticeRowState[n.state], locale)}</PlainChip>
              {n.publishedAt ? <span className="pemo-meta">{dateTime(n.publishedAt, locale)}</span> : null}
            </li>
          ))}
        </ul>
      </section>

      <DeferredActions locale={locale} actions={DEFERRED} />
    </>
  );
}
