/**
 * Portal tickets — prefers :3200 via tickets-demo-client; falls back to
 * process-local @pemo/tickets-demo-store (single-app only).
 * Freeze: docs/contracts/management-web-v0-tickets-helpdesk-demo.md
 *
 * Cross-app round-trip requires API :3200 + Vite PEMO_LIVE_BASE_URL.
 */

import {
  FIXTURE_RESIDENT_ID,
  FIXTURE_RESIDENT_NAME,
  FIXTURE_UNIT_LABEL,
  getPortalTicketStore,
  toPortalTicketDetail,
  type DemoTicket,
  type PortalTicketDetail,
  type PortalTicketSummary,
} from '@pemo/tickets-demo-store';
import {
  createDemoTicket,
  getDemoTicket,
  listDemoTickets,
} from './tickets-demo-client.ts';

export {
  FIXTURE_RESIDENT_ID,
  FIXTURE_RESIDENT_NAME,
  FIXTURE_UNIT_LABEL,
};

function asSummaries(data: unknown): PortalTicketSummary[] | null {
  if (!data || typeof data !== 'object') return null;
  const tickets = (data as { tickets?: unknown }).tickets;
  if (!Array.isArray(tickets)) return null;
  return tickets as PortalTicketSummary[];
}

function asDetail(data: unknown): PortalTicketDetail | null {
  if (!data || typeof data !== 'object') return null;
  const root = data as { id?: unknown; ticket?: unknown; fullTicket?: unknown };
  if (typeof root.id === 'string') return data as PortalTicketDetail;
  if (root.ticket && typeof root.ticket === 'object' && typeof (root.ticket as { id?: unknown }).id === 'string') {
    return root.ticket as PortalTicketDetail;
  }
  return null;
}

function asFullTicket(data: unknown): DemoTicket | null {
  if (!data || typeof data !== 'object') return null;
  const full = (data as { fullTicket?: unknown }).fullTicket;
  if (full && typeof full === 'object' && typeof (full as { id?: unknown }).id === 'string') {
    return full as DemoTicket;
  }
  return null;
}

function summaryToThinTicket(s: PortalTicketSummary): DemoTicket {
  return {
    id: s.id,
    subject: s.subject,
    body: '',
    category: s.category,
    status: s.status,
    assignedAdminId: null,
    assignedAdminLabel: s.assignedAdminLabel,
    unitLabel: s.unitLabel,
    channel: 'app',
    reporterRef: FIXTURE_RESIDENT_ID,
    createdByResidentId: FIXTURE_RESIDENT_ID,
    createdByName: FIXTURE_RESIDENT_NAME,
    createdAt: s.openedAt,
    updatedAt: s.updatedAt,
    dueAt: null,
    timeline: [],
  };
}

export async function listMyTickets(): Promise<{
  tickets: DemoTicket[];
  summaries: PortalTicketSummary[];
  source: 'api' | 'local';
}> {
  try {
    const raw = await listDemoTickets(FIXTURE_RESIDENT_ID);
    const summaries = asSummaries(raw);
    if (summaries) {
      return {
        tickets: summaries.map(summaryToThinTicket),
        summaries,
        source: 'api',
      };
    }
  } catch {
    /* fall through */
  }
  const tickets = getPortalTicketStore().listForResident(FIXTURE_RESIDENT_ID);
  return {
    tickets,
    summaries: tickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      category: t.category,
      status: t.status,
      assignedAdminLabel: t.assignedAdminLabel,
      openedAt: t.createdAt,
      updatedAt: t.updatedAt,
      unitLabel: t.unitLabel,
    })),
    source: 'local',
  };
}

export async function getMyTicket(id: string): Promise<{
  ticket: DemoTicket | null;
  detail: PortalTicketDetail | null;
  source: 'api' | 'local';
}> {
  try {
    const raw = await getDemoTicket(id, FIXTURE_RESIDENT_ID);
    const detail = asDetail(raw);
    if (detail) {
      return { ticket: getPortalTicketStore().getTicket(id), detail, source: 'api' };
    }
  } catch {
    /* fall through */
  }
  const ticket = getPortalTicketStore().getTicket(id);
  return {
    ticket,
    detail: ticket ? toPortalTicketDetail(ticket) : null,
    source: 'local',
  };
}

export async function createMyTicket(input: {
  subject: string;
  body: string;
  category: string;
}): Promise<{ ticket: DemoTicket | null; detail: PortalTicketDetail | null; source: 'api' | 'local' }> {
  try {
    const raw = await createDemoTicket(input, FIXTURE_RESIDENT_ID);
    const detail = asDetail(raw);
    const full = asFullTicket(raw);
    if (detail) {
      return { ticket: full, detail, source: 'api' };
    }
  } catch {
    /* fall through */
  }
  const ticket = getPortalTicketStore().createTicket({
    subject: input.subject,
    body: input.body,
    category: input.category,
    unitLabel: FIXTURE_UNIT_LABEL,
    createdByResidentId: FIXTURE_RESIDENT_ID,
    createdByName: FIXTURE_RESIDENT_NAME,
  });
  return { ticket, detail: toPortalTicketDetail(ticket), source: 'local' };
}
