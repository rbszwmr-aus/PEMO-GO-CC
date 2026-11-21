import { HelpBubble } from '../../components/HelpBubble.tsx';
import { MESSAGES } from '../../i18n/messages.ts';
import { t, type Locale } from '../../i18n/locale.ts';
import type { DemoTicket } from '@pemo/tickets-demo-store';
import { FIXTURE_RESIDENT_NAME, FIXTURE_UNIT_LABEL } from '../../data/tickets-client.ts';

function statusLabel(status: DemoTicket['status'], locale: Locale): string {
  return t(MESSAGES.helpdeskTickets.status[status], locale);
}

export function TicketList({
  tickets,
  source,
  locale,
  onOpen,
  onCreate,
}: {
  tickets: readonly DemoTicket[];
  source: 'api' | 'local';
  locale: Locale;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const M = MESSAGES.helpdeskTickets;
  return (
    <div className="pemo-panel" data-testid="portal-ticket-list">
      <header className="pemo-explore__head">
        <h1 className="pemo-page-title">{t(M.listTitle, locale)}</h1>
        <p className="pemo-note" data-testid="portal-ticket-resident">
          {t(M.fixtureResident, locale)}: {FIXTURE_RESIDENT_NAME} · {FIXTURE_UNIT_LABEL}
        </p>
        <HelpBubble testId="portal-ticket-source" text={source === 'api' ? t(M.sourceApi, locale) : t(M.sourceLocal, locale)} />
      </header>

      <div className="pemo-toolbar">
        <button
          type="button"
          className="pemo-btn pemo-btn--primary"
          data-testid="portal-ticket-new"
          onClick={onCreate}
        >
          {t(M.createAction, locale)}
        </button>
      </div>

      {tickets.length === 0 ? (
        <section className="pemo-state" data-testid="portal-ticket-empty" role="status">
          <h2 className="pemo-state__title">{t(M.emptyTitle, locale)}</h2>
          <p className="pemo-state__body">{t(M.emptyBody, locale)}</p>
        </section>
      ) : (
        <ul className="pemo-explore__results" data-testid="portal-ticket-rows">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <button
                type="button"
                className="pemo-facility-card"
                data-testid="portal-ticket-row"
                data-ticket-id={ticket.id}
                onClick={() => onOpen(ticket.id)}
              >
                <div className="pemo-facility-card__title">{ticket.subject}</div>
                <div className="pemo-meta">
                  <span className="pemo-chip" data-testid="portal-ticket-status-chip" data-status={ticket.status}>
                    {statusLabel(ticket.status, locale)}
                  </span>
                  {' · '}
                  {ticket.category}
                  {ticket.assignedAdminLabel ? ` · ${ticket.assignedAdminLabel}` : ''}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
