/**
 * Portal-originated tickets panel on Help desk — assign + status against
 * @pemo/tickets-demo-store (API :3200 preferred).
 *
 * @version 0.2.2
 * @changelog
 *   0.2.2 (2026-11-20) isPortalTicketId moved to portal-ticket-id.ts (re-exported here).
 *   0.2.1 (2026-11-19) Pop-up facts stay in one column of label/value rows (PT 2026-11-19: read-only pop-ups one column, two columns only for inputs).
 */

import { HintRow, InfoTip, ITDetails } from '../components/FinanceBits.tsx';
import { isPortalTicketId } from './portal-ticket-id.ts';
import { useCallback, useEffect, useState } from 'react';
import {
  DEMO_TICKET_STATUSES,
  statusToStaffChrome,
  toHelpdeskQueueRow,
  type DemoTicket,
  type DemoTicketStatus,
} from '@pemo/tickets-demo-store';
import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { hktStamp } from '../format/datetime.ts';
import { PlainChip } from '../components/SeverityChip.tsx';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import {
  assignPortalTicket,
  getPortalTicket,
  listDemoAdmins,
  listPortalTickets,
  setPortalTicketStatus,
} from '../data/portal-tickets-client.ts';


function demoStatusLabel(status: DemoTicketStatus, locale: Locale): string {
  return t(MESSAGES.portalTickets.status[status], locale);
}

function chromeLabel(state: ReturnType<typeof statusToStaffChrome>, locale: Locale): string {
  return t(MESSAGES.helpdesk.contactState[state], locale);
}

export type PortalTicketsDrill = 'waiting' | 'answered' | 'raised' | null;

export function PortalTicketsQueue({
  locale,
  onOpen,
  drill = null,
  onClearDrill,
}: {
  locale: Locale;
  onOpen: (ticketId: string) => void;
  /** Desk-stat drill: waiting → open chrome; answered → closed chrome. */
  drill?: PortalTicketsDrill;
  onClearDrill?: () => void;
}) {
  const M = MESSAGES.portalTickets;
  const [tickets, setTickets] = useState<DemoTicket[]>([]);
  const [source, setSource] = useState<'api' | 'local'>('local');

  useEffect(() => {
    void listPortalTickets().then((res) => {
      setTickets(res.tickets);
      setSource(res.source);
    });
  }, [drill]);

  const visible = (() => {
    const todayKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Hong_Kong',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const onHongKongDay = (iso: string | null | undefined): boolean => {
      if (!iso) return false;
      const t = Date.parse(iso);
      if (!Number.isFinite(t)) return false;
      return (
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Hong_Kong',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(t)) === todayKey
      );
    };
    if (drill === 'waiting') {
      // Spec: open | triaged portal tickets (live store).
      return tickets.filter((ticket) => ticket.status === 'open' || ticket.status === 'triaged');
    }
    if (drill === 'answered') {
      // Heuristic: resolved/closed with updatedAt (or latest status timeline) today HKT.
      return tickets.filter((ticket) => {
        if (ticket.status !== 'resolved' && ticket.status !== 'closed') return false;
        if (onHongKongDay(ticket.updatedAt)) return true;
        const lastStatus = [...ticket.timeline]
          .reverse()
          .find((ev) => ev.kind === 'status' && (ev.status === 'resolved' || ev.status === 'closed'));
        return onHongKongDay(lastStatus?.at);
      });
    }
    if (drill === 'raised') {
      // Heuristic (no case-link field on DemoTicket): active case-like work =
      // in_progress | awaiting_resident (staff elevated beyond intake).
      return tickets.filter(
        (ticket) => ticket.status === 'in_progress' || ticket.status === 'awaiting_resident',
      );
    }
    return tickets;
  })();

  const sortedVisible = [...visible].sort((a, b) => {
    const ta = Date.parse(a.createdAt) || 0;
    const tb = Date.parse(b.createdAt) || 0;
    return tb - ta;
  });

  const columns = [
    { key: 'subject', label: t(MESSAGES.helpdesk.colSubject, locale), width: '32%' },
    { key: 'who', label: t(MESSAGES.helpdesk.colResident, locale), width: '20%' },
    { key: 'status', label: t(M.colDemoStatus, locale), width: '14%' },
    { key: 'chrome', label: t(MESSAGES.helpdesk.colState, locale), width: '14%' },
    { key: 'assignee', label: t(M.colAssignee, locale), width: '20%' },
  ];

  const drillNote =
    drill === 'waiting'
      ? t(M.waitingDrillNote, locale)
      : drill === 'answered'
        ? t(M.answeredDrillNote, locale)
        : drill === 'raised'
          ? t(M.raisedDrillNote, locale)
          : null;
  const drillEmpty =
    drill === 'waiting'
      ? t(M.waitingDrillEmpty, locale)
      : drill === 'answered'
        ? t(M.answeredDrillEmpty, locale)
        : drill === 'raised'
          ? t(M.raisedDrillEmpty, locale)
          : t(M.empty, locale);

  return (
    <section className="pemo-panel" data-testid="portal-tickets-queue" id="portal-tickets-queue">
      <h2 className="pemo-panel__title">
        {t(M.sectionTitle, locale)}
        <InfoTip text={t(M.sectionNote, locale)} />
        <InfoTip
          testId="portal-tickets-source"
          text={`${source === 'api' ? t(M.sourceApi, locale) : t(M.sourceLocal, locale)}${source !== 'api' && drill ? ` ${t(M.liveNeeded, locale)}` : ''}`}
        />
      </h2>
      {drillNote ? (
        <p className="pemo-note" data-testid="portal-tickets-stat-drill" data-drill={drill}>
          {drillNote}
          {' '}
          {onClearDrill ? (
            <button
              type="button"
              className="pemo-btn"
              data-testid="portal-tickets-clear-drill"
              onClick={onClearDrill}
            >
              {t(M.clearWaitingDrill, locale)}
            </button>
          ) : null}
        </p>
      ) : null}
      {sortedVisible.length === 0 ? (
        <p className="pemo-state__body" data-testid="portal-tickets-empty">
          {drillEmpty}
        </p>
      ) : (
        <Table caption={t(M.sectionTitle, locale)} columns={columns} testId="portal-tickets-table">
          {sortedVisible.map((ticket) => {
            const row = toHelpdeskQueueRow(ticket);
            return (
              <tr key={ticket.id} data-testid="portal-ticket-row" data-ticket-id={ticket.id}>
                <WrapCell title={ticket.subject}>
                  <a
                    href={`?screen=helpdeskDetail&state=detail&lang=${locale}&contact=${encodeURIComponent(ticket.id)}`}
                    data-testid="portal-ticket-open"
                    data-read-affordance="navigate"
                    onClick={(e) => {
                      e.preventDefault();
                      onOpen(ticket.id);
                    }}
                  >
                    {ticket.subject}
                  </a>
                </WrapCell>
                <td>
                  <span className="pemo-cell--wrap">{ticket.createdByName}</span>
                  <div className="pemo-meta">{ticket.unitLabel}</div>
                </td>
                <DenseCell title={demoStatusLabel(ticket.status, locale)}>
                  <PlainChip>{demoStatusLabel(ticket.status, locale)}</PlainChip>
                </DenseCell>
                <DenseCell title={chromeLabel(row.state, locale)}>
                  <PlainChip>{chromeLabel(row.state, locale)}</PlainChip>
                </DenseCell>
                <DenseCell title={ticket.assignedAdminLabel ?? t(M.unassigned, locale)}>
                  {ticket.assignedAdminLabel ?? t(M.unassigned, locale)}
                </DenseCell>
              </tr>
            );
          })}
        </Table>
      )}
    </section>
  );
}

export { isPortalTicketId };

export function PortalTicketStaffDetail({
  ticketId,
  locale,
  onBack,
}: {
  ticketId: string;
  locale: Locale;
  onBack: () => void;
}) {
  const M = MESSAGES.portalTickets;
  const [ticket, setTicket] = useState<DemoTicket | null>(null);
  const [source, setSource] = useState<'api' | 'local'>('local');
  const [adminId, setAdminId] = useState('');
  const [status, setStatus] = useState<DemoTicketStatus>('open');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const admins = listDemoAdmins();

  const reload = useCallback(async () => {
    const res = await getPortalTicket(ticketId);
    setTicket(res.ticket);
    setSource(res.source);
    if (res.ticket) {
      setStatus(res.ticket.status);
      setAdminId(res.ticket.assignedAdminId ?? admins[0]?.id ?? '');
    }
  }, [ticketId, admins]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!ticket) {
    return (
      <section className="pemo-panel" data-testid="portal-ticket-missing">
        <p>{t(M.notFound, locale)}</p>
        <button type="button" className="pemo-btn" onClick={onBack}>{t(MESSAGES.helpdesk.backToQueue, locale)}</button>
      </section>
    );
  }

  async function onAssign() {
    const admin = admins.find((a) => a.id === adminId);
    if (!admin) return;
    setBusy(true);
    await assignPortalTicket(ticketId, { adminId: admin.id, adminLabel: admin.label });
    await reload();
    setBusy(false);
  }

  async function onStatus() {
    setBusy(true);
    await setPortalTicketStatus(ticketId, status, note || undefined);
    setNote('');
    await reload();
    setBusy(false);
  }

  return (
    <>
      <section className="pemo-panel" data-testid="portal-ticket-staff-detail" data-ticket-id={ticket.id}>
        <div className="pemo-toolbar">
          <button type="button" className="pemo-btn" data-testid="helpdesk-back" onClick={onBack}>
            {t(MESSAGES.helpdesk.backToQueue, locale)}
          </button>
        </div>
        <h2 className="pemo-panel__title">{ticket.subject}</h2>
        <HintRow testId="portal-tickets-source" text={source === 'api' ? t(M.sourceApi, locale) : t(M.sourceLocal, locale)} />
        <dl className="pemo-dl">
          <dt>{t(MESSAGES.helpdesk.colResident, locale)}</dt>
          <dd>
            {ticket.createdByName}
            <div className="pemo-meta">{ticket.unitLabel}</div>
          </dd>
          <dt>{t(M.colDemoStatus, locale)}</dt>
          <dd><PlainChip>{demoStatusLabel(ticket.status, locale)}</PlainChip></dd>
          <dt>{t(MESSAGES.helpdesk.colState, locale)}</dt>
          <dd><PlainChip>{chromeLabel(statusToStaffChrome(ticket.status), locale)}</PlainChip></dd>
          <dt>{t(M.colAssignee, locale)}</dt>
          <dd>{ticket.assignedAdminLabel ?? t(M.unassigned, locale)}</dd>
          <dt>{t(M.fieldBody, locale)}</dt>
          <dd className="pemo-cell--wrap">{ticket.body}</dd>
        </dl>
        <ITDetails locale={locale} testId="portal-ticket-it-details" rows={[[MESSAGES.helpdesk.factContactId, ticket.id]]} />
      </section>

      <section className="pemo-panel" data-testid="portal-ticket-assign">
        <h3 className="pemo-panel__title">{t(M.assignHeading, locale)}</h3>
        <div className="pemo-toolbar">
          <label className="pemo-field">
            {t(M.colAssignee, locale)}
            <select
              data-testid="portal-ticket-admin"
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
            >
              {admins.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </label>
          <button type="button" className="pemo-btn" disabled={busy} data-testid="portal-ticket-assign-btn" onClick={() => void onAssign()}>
            {t(M.assignAction, locale)}
          </button>
        </div>
        <HintRow text={t(M.assignNote, locale)} />
      </section>

      <section className="pemo-panel" data-testid="portal-ticket-status">
        <h3 className="pemo-panel__title">{t(M.statusHeading, locale)}</h3>
        <div className="pemo-toolbar">
          <label className="pemo-field">
            {t(M.colDemoStatus, locale)}
            <select
              data-testid="portal-ticket-status-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as DemoTicketStatus)}
            >
              {DEMO_TICKET_STATUSES.map((s) => (
                <option key={s} value={s}>{demoStatusLabel(s, locale)}</option>
              ))}
            </select>
          </label>
          <label className="pemo-field">
            {t(M.fieldNote, locale)}
            <input data-testid="portal-ticket-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="button" className="pemo-btn" disabled={busy} data-testid="portal-ticket-status-btn" onClick={() => void onStatus()}>
            {t(M.statusAction, locale)}
          </button>
        </div>
      </section>

      <section className="pemo-panel">
        <h3 className="pemo-panel__title">{t(M.timelineHeading, locale)}</h3>
        <ol className="pemo-helpdesk-timeline" data-testid="portal-ticket-timeline">
          {ticket.timeline.map((ev) => (
            <li key={ev.id} data-testid="portal-ticket-timeline-event" data-kind={ev.kind}>
              <div className="pemo-meta">
                <span data-testid="portal-ticket-timeline-time">{hktStamp(ev.at, locale)}</span>
                {' · '}
                {ev.kind}
              </div>
              <div>{t({ en: ev.messageEn, 'zh-Hant': ev.messageZh }, locale)}</div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

// silence unused helper in case tree-shaking
