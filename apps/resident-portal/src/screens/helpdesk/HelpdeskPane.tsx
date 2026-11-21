import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DemoTicket, PortalTicketDetail } from '@pemo/tickets-demo-store';
import type { Locale } from '../../i18n/locale.ts';
import { t } from '../../i18n/locale.ts';
import { MESSAGES } from '../../i18n/messages.ts';
import { getMyTicket, listMyTickets } from '../../data/tickets-client.ts';
import { Loading } from '../../components/StateNotice.tsx';
import { TicketList } from './TicketList.tsx';
import { TicketCreate } from './TicketCreate.tsx';
import { TicketDetail } from './TicketDetail.tsx';

function sortNewestFirst(tickets: DemoTicket[]): DemoTicket[] {
  return [...tickets].sort((a, b) => {
    const ta = Date.parse(a.updatedAt || a.createdAt || '') || 0;
    const tb = Date.parse(b.updatedAt || b.createdAt || '') || 0;
    return tb - ta;
  });
}

export function HelpdeskPane({
  tab,
  ticketId,
  locale,
  onNavigate,
}: {
  tab: string;
  ticketId?: string;
  locale: Locale;
  onNavigate: (next: { tab?: string; ticket?: string | null }) => void;
}) {
  const M = MESSAGES.helpdeskTickets;
  const [tickets, setTickets] = useState<DemoTicket[]>([]);
  const [source, setSource] = useState<'api' | 'local'>('local');
  const [detail, setDetail] = useState<PortalTicketDetail | null>(null);
  const [ticket, setTicket] = useState<DemoTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailReady, setDetailReady] = useState(false);

  const ordered = useMemo(() => sortNewestFirst(tickets), [tickets]);

  const refreshList = useCallback(async () => {
    const res = await listMyTickets();
    setTickets(res.tickets);
    setSource(res.source);
    return res.tickets;
  }, []);

  useEffect(() => {
    if (tab === 'list') {
      setLoading(true);
      void refreshList().finally(() => setLoading(false));
    }
  }, [tab, refreshList]);

  // Detail tab: never silently fall back to the list.
  // Deep link ?ticket= wins; otherwise open the latest ticket.
  useEffect(() => {
    if (tab !== 'detail') {
      setDetailReady(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setDetailReady(false);

    void (async () => {
      const list = await refreshList();
      if (cancelled) return;
      const sorted = sortNewestFirst(list);

      if (ticketId) {
        const res = await getMyTicket(ticketId);
        if (cancelled) return;
        setDetail(res.detail);
        setTicket(res.ticket);
        setSource(res.source);
        setDetailReady(true);
        setLoading(false);
        return;
      }

      if (sorted.length === 0) {
        setDetail(null);
        setTicket(null);
        setDetailReady(true);
        setLoading(false);
        return;
      }

      // No selection → navigate to latest (keeps ?ticket= in sync).
      setLoading(false);
      onNavigate({ tab: 'detail', ticket: sorted[0]!.id });
    })();

    return () => {
      cancelled = true;
    };
  }, [tab, ticketId, refreshList, onNavigate]);

  const index = ticketId ? ordered.findIndex((x) => x.id === ticketId) : -1;
  // ordered is newest-first → older = higher index, newer = lower index
  const hasPrev = index >= 0 && index < ordered.length - 1;
  const hasNext = index > 0;

  if (tab === 'create') {
    return (
      <TicketCreate
        locale={locale}
        onCancel={() => onNavigate({ tab: 'list', ticket: null })}
        onCreated={(id) => onNavigate({ tab: 'detail', ticket: id })}
      />
    );
  }

  if (tab === 'detail') {
    if (loading || !detailReady) return <Loading locale={locale} />;

    if (!ticketId && ordered.length === 0) {
      return (
        <div className="pemo-panel" data-testid="portal-ticket-detail-empty">
          <h1 className="pemo-page-title">{t(M.detailEmptyTitle, locale)}</h1>
          <p className="pemo-note">{t(M.detailEmptyBody, locale)}</p>
          <p className="pemo-note">
            <button
              type="button"
              className="pemo-btn"
              data-testid="portal-ticket-empty-create"
              onClick={() => onNavigate({ tab: 'create', ticket: null })}
            >
              {t(M.createAction, locale)}
            </button>
          </p>
        </div>
      );
    }

    if (detail || ticket) {
      const positionLabel =
        index >= 0
          ? t(M.ticketPosition, locale)
              .replace('{current}', String(index + 1))
              .replace('{total}', String(ordered.length))
          : undefined;
      return (
        <TicketDetail
          ticket={ticket}
          detail={detail}
          source={source}
          locale={locale}
          onBack={() => onNavigate({ tab: 'list', ticket: null })}
          hasPrev={hasPrev}
          hasNext={hasNext}
          {...(positionLabel ? { positionLabel } : {})}
          {...(hasPrev
            ? { onPrev: () => onNavigate({ tab: 'detail', ticket: ordered[index + 1]!.id }) }
            : {})}
          {...(hasNext
            ? { onNext: () => onNavigate({ tab: 'detail', ticket: ordered[index - 1]!.id }) }
            : {})}
        />
      );
    }

    return (
      <div className="pemo-panel" data-testid="portal-ticket-detail-missing">
        <h1 className="pemo-page-title">{t(M.detailEmptyTitle, locale)}</h1>
        <p className="pemo-note">{t(M.detailEmptyBody, locale)}</p>
        <p className="pemo-note">
          <button
            type="button"
            className="pemo-btn"
            data-testid="portal-ticket-back"
            onClick={() => onNavigate({ tab: 'list', ticket: null })}
          >
            {t(M.backToList, locale)}
          </button>
        </p>
      </div>
    );
  }

  if (loading) return <Loading locale={locale} />;

  return (
    <TicketList
      tickets={tickets}
      source={source}
      locale={locale}
      onOpen={(id) => onNavigate({ tab: 'detail', ticket: id })}
      onCreate={() => onNavigate({ tab: 'create', ticket: null })}
    />
  );
}
