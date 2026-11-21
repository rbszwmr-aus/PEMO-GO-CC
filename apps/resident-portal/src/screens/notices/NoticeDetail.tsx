import { formatDateTimeHkt } from '../../format/datetime.ts';
import { HelpBubble } from '../../components/HelpBubble.tsx';
import { MESSAGES } from '../../i18n/messages.ts';
import { t, type Locale } from '../../i18n/locale.ts';
import type { DemoNotice } from '../../data/notices-client.ts';

export function NoticeDetail({
  notice,
  source,
  locale,
  onBack,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  positionLabel,
}: {
  notice: DemoNotice;
  source: 'api' | 'local';
  locale: Locale;
  onBack: () => void;
  onPrev?: (() => void) | undefined;
  onNext?: (() => void) | undefined;
  hasPrev?: boolean;
  hasNext?: boolean;
  positionLabel?: string | undefined;
}) {
  const M = MESSAGES.noticesPortal;
  return (
    <div className="pemo-panel" data-testid="portal-notice-detail" data-notice-id={notice.noticeId}>
      <p className="pemo-note" data-testid="portal-notice-nav">
        <button type="button" className="pemo-btn" data-testid="portal-notice-back" onClick={onBack}>
          {t(M.backToList, locale)}
        </button>
        {positionLabel ? (
          <span className="pemo-meta" data-testid="portal-notice-position">{positionLabel}</span>
        ) : null}
      </p>

      <div className="pemo-title-row" data-testid="portal-notice-title-row">
        <button
          type="button"
          className="pemo-title-nav"
          data-testid="portal-notice-prev"
          aria-label={t(M.prevNotice, locale)}
          disabled={!hasPrev || !onPrev}
          onClick={() => onPrev?.()}
        >
          ‹
        </button>
        <h1 className="pemo-page-title">{notice.title}</h1>
        <button
          type="button"
          className="pemo-title-nav"
          data-testid="portal-notice-next"
          aria-label={t(M.nextNotice, locale)}
          disabled={!hasNext || !onNext}
          onClick={() => onNext?.()}
        >
          ›
        </button>
      </div>

      <HelpBubble testId="portal-notice-source" text={source === 'api' ? t(M.sourceApi, locale) : t(M.sourceLocal, locale)} />
      <dl className="pemo-dl">
        <dt>{t(M.fieldPublished, locale)}</dt>
        <dd data-testid="portal-notice-published">{formatDateTimeHkt(notice.publishedAt, locale)}</dd>
        <dt>{t(M.fieldSeverity, locale)}</dt>
        <dd>
          <span className="pemo-chip" data-testid="portal-notice-severity">
            {t(M.severity[notice.severity as keyof typeof M.severity], locale)}
          </span>
        </dd>
        <dt>{t(M.fieldCategory, locale)}</dt>
        <dd data-testid="portal-notice-category">
          {t(
            (M.category as Record<string, (typeof M.category)['general']>)[notice.category]
              ?? M.category.general,
            locale,
          )}
        </dd>
        <dt>{t(M.fieldBody, locale)}</dt>
        <dd className="pemo-cell--wrap" data-testid="portal-notice-body">{notice.body}</dd>
      </dl>
    </div>
  );
}
