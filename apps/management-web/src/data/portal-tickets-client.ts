/**
 * Portal tickets for Help desk — prefers :3200 demo routes (Bearer + ?demo=1);
 * falls back to process-local store.
 * Freeze: docs/contracts/management-web-v0-tickets-helpdesk-demo.md
 */

import {
  getPortalTicketStore,
  type DemoTicket,
  type DemoTicketStatus,
} from '@pemo/tickets-demo-store';
import {
  assignDemoContact,
  fetchDemoHelpdeskQueue,
  setDemoContactStatus,
} from './tickets-demo-client.ts';

import { getSessionToken } from './live-config.ts';

function readToken(): string {
  // Use the in-memory session bearer only. A URL token is ingested (and then
  // stripped) by live-config when the demo flag is on; we never read the URL
  // here, and we do not invent a demo bearer in a normal build.
  return getSessionToken().trim();
}

export async function listPortalTickets(): Promise<{ tickets: DemoTicket[]; source: 'api' | 'local' }> {
  const token = readToken();
  if (token) {
    try {
      const res = await fetch('/api/management-web/v0/helpdesk/portal-tickets', {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = (await res.json()) as { tickets?: DemoTicket[] };
        if (Array.isArray(data.tickets)) {
          return { tickets: data.tickets, source: 'api' };
        }
      }
    } catch {
      /* try queue */
    }
    try {
      const raw = await fetchDemoHelpdeskQueue(token);
      const rows = (raw as { rows?: { id: string }[] })?.rows;
      if (Array.isArray(rows)) {
        // Prefer full tickets from portal-tickets; else local hydrate by id
        const store = getPortalTicketStore();
        const tickets = rows
          .map((r) => store.getTicket(r.id))
          .filter((t): t is DemoTicket => t != null);
        if (tickets.length > 0) return { tickets, source: 'api' };
      }
    } catch {
      /* fall through */
    }
  }
  return { tickets: getPortalTicketStore().listAll(), source: 'local' };
}

export async function getPortalTicket(id: string): Promise<{ ticket: DemoTicket | null; source: 'api' | 'local' }> {
  const token = readToken();
  if (token) {
    try {
      const res = await fetch(
        `/api/management-web/v0/helpdesk/contacts/${encodeURIComponent(id)}?demo=1`,
        { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = (await res.json()) as { ticket?: DemoTicket; contact?: { id: string } };
        if (data.ticket?.id) return { ticket: data.ticket, source: 'api' };
        const local = getPortalTicketStore().getTicket(id);
        if (local) return { ticket: local, source: 'api' };
      }
    } catch {
      /* fall through */
    }
  }
  return { ticket: getPortalTicketStore().getTicket(id), source: 'local' };
}

export async function assignPortalTicket(
  id: string,
  admin: { adminId: string; adminLabel: string },
): Promise<{ ticket: DemoTicket | null; source: 'api' | 'local' }> {
  const token = readToken();
  if (token) {
    try {
      const raw = await assignDemoContact(token, id, admin) as { ticket?: DemoTicket };
      if (raw?.ticket?.id) return { ticket: raw.ticket, source: 'api' };
    } catch {
      /* fall through */
    }
  }
  return { ticket: getPortalTicketStore().assignTicket(id, admin), source: 'local' };
}

export async function setPortalTicketStatus(
  id: string,
  status: DemoTicketStatus,
  note?: string,
): Promise<{ ticket: DemoTicket | null; source: 'api' | 'local' }> {
  const token = readToken();
  if (token) {
    try {
      const raw = await setDemoContactStatus(token, id, status) as { ticket?: DemoTicket };
      if (raw?.ticket?.id) {
        if (note?.trim()) {
          // optional note only on local path; API status body is status-only per freeze
        }
        return { ticket: raw.ticket, source: 'api' };
      }
    } catch {
      /* fall through */
    }
  }
  return { ticket: getPortalTicketStore().setTicketStatus(id, status, note), source: 'local' };
}

export function listDemoAdmins() {
  return getPortalTicketStore().listAdmins();
}
