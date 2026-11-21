import { HelpBubble } from '../../components/HelpBubble.tsx';
import { MESSAGES } from '../../i18n/messages.ts';
import { t, type Locale } from '../../i18n/locale.ts';
import type { DemoTicket, DemoTicketStatus, PortalTicketDetail } from '@pemo/tickets-demo-store';

export function TicketDetail({
  ticket,
  detail,
  source,
  locale,
  onBack,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  positionLabel,
}: {
  ticket: DemoTicket | null;
  detail: PortalTicketDetail | null;
  source: 'api' | 'local';
  locale: Locale;
  onBack: () => void;
  onPrev?: (() => void) | undefined;
  onNext?: (() => void) | undefined;
  hasPrev?: boolean;
  hasNext?: boolean;
  positionLabel?: string | undefined;
}) {
  const M = MESSAGES.helpdeskTickets;
  const subject = detail?.subject ?? ticket?.subject ?? '';
  const status = (detail?.status ?? ticket?.status ?? 'open') as DemoTicketStatus;
  const category = detail?.category ?? ticket?.category ?? 'general';
  const assignee = detail?.assignedAdminLabel ?? ticket?.assignedAdminLabel;
  const unit = detail?.unitLabel ?? ticket?.unitLabel ?? '';
  const body = detail?.body ?? ticket?.body ?? '';
  const id = detail?.id ?? ticket?.id ?? '';
  const timeline = detail?.timeline
    ?? (ticket?.timeline.map((ev) => ({
      id: ev.id,
      at: ev.at,
      kind: ev.kind,
      actor: ev.actor,
      message: { en: ev.messageEn, 'zh-Hant': ev.messageZh },
      status: ev.status,
    })) ?? []);

  return (
    <div className="pemo-panel" data-testid="portal-ticket-detail" data-ticket-id={id}>
      <p className="pemo-note" data-testid="portal-ticket-nav">
        <button type="button" className="pemo-btn" data-testid="portal-ticket-back" onClick={onBack}>
          {t(M.backToList, locale)}
        </button>
        {positionLabel ? (
          <span className="pemo-meta" data-testid="portal-ticket-position">{positionLabel}</span>
        ) : null}
      </p>

      <div className="pemo-title-row" data-testid="portal-ticket-title-row">
        <button
          type="button"
          className="pemo-title-nav"
          data-testid="portal-ticket-prev"
          aria-label={t(M.prevTicket, locale)}
          disabled={!hasPrev || !onPrev}
          onClick={() => onPrev?.()}
        >
          ‹
        </button>
        <h1 className="pemo-page-title">{subject}</h1>
        <button
          type="button"
          className="pemo-title-nav"
          data-testid="portal-ticket-next"
          aria-label={t(M.nextTicket, locale)}
          disabled={!hasNext || !onNext}
          onClick={() => onNext?.()}
        >
          ›
        </button>
      </div>

      <HelpBubble testId="portal-ticket-source" text={source === 'api' ? t(M.sourceApi, locale) : t(M.sourceLocal, locale)} />
      <dl className="pemo-dl">
        <dt>{t(M.fieldStatus, locale)}</dt>
        <dd>
          <span className="pemo-chip" data-testid="portal-ticket-status-chip" data-status={status}>
            {t(M.status[status], locale)}
          </span>
        </dd>
        <dt>{t(M.fieldCategory, locale)}</dt>
        <dd>
          {t(
            (M.category as Record<string, (typeof M.category)['general']>)[category]
              ?? M.category.general,
            locale,
          )}
        </dd>
        <dt>{t(M.fieldAssignee, locale)}</dt>
        <dd>{assignee ?? t(M.unassigned, locale)}</dd>
        <dt>{t(M.fieldUnit, locale)}</dt>
        <dd>{unit}</dd>
        <dt>{t(M.fieldBody, locale)}</dt>
        <dd className="pemo-cell--wrap">{body}</dd>
      </dl>

      <h2 className="pemo-panel__title">{t(M.timelineHeading, locale)}</h2>
      <ol className="pemo-dl" data-testid="portal-ticket-timeline">
        {timeline.map((ev) => (
          <li key={ev.id} data-testid="portal-ticket-timeline-event" data-kind={ev.kind}>
            <div className="pemo-meta">{ev.at}</div>
            <div>{t(ev.message, locale)}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
