/**
 * Thin fetch wrappers for resident-portal demo tickets.
 * No new npm deps. Fixture identity via X-PEMO-Demo-Resident.
 * Freeze: docs/contracts/management-web-v0-tickets-helpdesk-demo.md
 */

export const DEMO_RESIDENT_HEADER = 'X-PEMO-Demo-Resident';
export const FIXTURE_RESIDENT_ID = 'res_demo_ho_mei_yi';

export type TicketStatus =
  | 'open'
  | 'triaged'
  | 'in_progress'
  | 'awaiting_resident'
  | 'resolved'
  | 'closed';

const ticketsBase = '/api/resident-portal/v0/tickets';

function headers(residentId = FIXTURE_RESIDENT_ID): HeadersInit {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    [DEMO_RESIDENT_HEADER]: residentId,
  };
}

export async function listDemoTickets(
  residentId = FIXTURE_RESIDENT_ID,
): Promise<unknown> {
  const res = await fetch(ticketsBase, { method: 'GET', headers: headers(residentId) });
  return res.json();
}

export async function createDemoTicket(
  input: { subject: string; body?: string; category?: string },
  residentId = FIXTURE_RESIDENT_ID,
): Promise<unknown> {
  const res = await fetch(ticketsBase, {
    method: 'POST',
    headers: headers(residentId),
    body: JSON.stringify(input),
  });
  return res.json();
}

export async function getDemoTicket(
  ticketId: string,
  residentId = FIXTURE_RESIDENT_ID,
): Promise<unknown> {
  const res = await fetch(`${ticketsBase}/${encodeURIComponent(ticketId)}`, {
    method: 'GET',
    headers: headers(residentId),
  });
  return res.json();
}
