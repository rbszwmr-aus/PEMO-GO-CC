import { formatHktStamp } from '../../format/datetime.ts';
import { HelpBubble } from '../../components/HelpBubble.tsx';
import { MESSAGES } from '../../i18n/messages.ts';
import { t, type Locale } from '../../i18n/locale.ts';
import type { DemoVisitor } from '../../data/visitors-client.ts';

export function VisitorList({
  visitors,
  source,
  locale,
  onOpen,
  onCreate,
}: {
  visitors: readonly DemoVisitor[];
  source: 'api' | 'local';
  locale: Locale;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const M = MESSAGES.visitorPortal;
  return (
    <div className="pemo-panel" data-testid="portal-visitor-list">
      <header className="pemo-explore__head">
        <h1 className="pemo-page-title">{t(M.listTitle, locale)}</h1>
        <HelpBubble testId="portal-visitor-source" text={source === 'api' ? t(M.sourceApi, locale) : t(M.sourceLocal, locale)} />
      </header>

      <div className="pemo-toolbar">
        <button
          type="button"
          className="pemo-btn pemo-btn--primary"
          data-testid="portal-visitor-new"
          onClick={onCreate}
        >
          {t(M.createAction, locale)}
        </button>
      </div>

      {visitors.length === 0 ? (
        <section className="pemo-state" data-testid="portal-visitor-empty" role="status">
          <h2 className="pemo-state__title">{t(M.emptyTitle, locale)}</h2>
          <p className="pemo-state__body">{t(M.emptyBody, locale)}</p>
        </section>
      ) : (
        <ul className="pemo-explore__results" data-testid="portal-visitor-rows">
          {visitors.map((v) => (
            <li key={v.visitorId}>
              <button
                type="button"
                className="pemo-facility-card"
                data-testid="portal-visitor-row"
                data-visitor-id={v.visitorId}
                onClick={() => onOpen(v.visitorId)}
              >
                <div className="pemo-facility-card__title">{v.name}</div>
                <div className="pemo-meta">
                  <span className="pemo-chip" data-testid="portal-visitor-status">
                    {t(M.status[v.status as keyof typeof M.status], locale)}
                  </span>
                  {v.purpose ? ` · ${v.purpose}` : ''}
                  {' · '}
                  <span data-testid="portal-visitor-window">
                    {formatHktStamp(v.expectedFrom, locale)} → {formatHktStamp(v.expectedTo, locale)}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
