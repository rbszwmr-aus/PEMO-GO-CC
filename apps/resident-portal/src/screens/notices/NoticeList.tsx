import { formatDateTimeHkt } from '../../format/datetime.ts';
import { HelpBubble } from '../../components/HelpBubble.tsx';
import { MESSAGES } from '../../i18n/messages.ts';
import { t, type Locale } from '../../i18n/locale.ts';
import type { DemoNotice } from '../../data/notices-client.ts';

function severityChipClass(severity: DemoNotice['severity']): string {
  if (severity === 'critical') return 'pemo-chip pemo-chip--critical';
  if (severity === 'warning') return 'pemo-chip pemo-chip--warning';
  return 'pemo-chip';
}

export function NoticeList({
  notices,
  source,
  locale,
  onOpen,
}: {
  notices: readonly DemoNotice[];
  source: 'api' | 'local';
  locale: Locale;
  onOpen: (id: string) => void;
}) {
  const M = MESSAGES.noticesPortal;
  return (
    <div className="pemo-panel" data-testid="portal-notice-list">
      <header className="pemo-explore__head">
        <h1 className="pemo-page-title">{t(M.listTitle, locale)}</h1>
        <HelpBubble testId="portal-notice-source" text={source === 'api' ? t(M.sourceApi, locale) : t(M.sourceLocal, locale)} />
      </header>

      {notices.length === 0 ? (
        <section className="pemo-state" data-testid="portal-notice-empty" role="status">
          <h2 className="pemo-state__title">{t(M.emptyTitle, locale)}</h2>
          <p className="pemo-state__body">{t(M.emptyBody, locale)}</p>
        </section>
      ) : (
        <ul className="pemo-explore__results" data-testid="portal-notice-rows">
          {notices.map((n) => (
            <li key={n.noticeId}>
              <button
                type="button"
                className="pemo-facility-card"
                data-testid="portal-notice-row"
                data-notice-id={n.noticeId}
                onClick={() => onOpen(n.noticeId)}
              >
                <div className="pemo-facility-card__title">{n.title}</div>
                <div className="pemo-meta">
                  <span className={severityChipClass(n.severity)} data-testid="portal-notice-severity">
                    {t(M.severity[n.severity as keyof typeof M.severity], locale)}
                  </span>
                  {' · '}
                  <span data-testid="portal-notice-category">{t(
                    (M.category as Record<string, (typeof M.category)['general']>)[n.category]
                      ?? M.category.general,
                    locale,
                  )}</span>
                  {' · '}
                  <span data-testid="portal-notice-published">{formatDateTimeHkt(n.publishedAt, locale)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
