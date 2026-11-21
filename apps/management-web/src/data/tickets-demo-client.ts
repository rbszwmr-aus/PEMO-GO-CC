/**
 * Thin fetch wrappers for Help desk demo writes / demo queue.
 * No new npm deps. Surfaces bind screens later.
 * Freeze: docs/contracts/management-web-v0-tickets-helpdesk-demo.md
 */

export type TicketStatus =
  | 'open'
  | 'triaged'
  | 'in_progress'
  | 'awaiting_resident'
  | 'resolved'
  | 'closed';

const base = (): string => {
  // Same-origin when Vite proxies; absolute when PEMO_LIVE_BASE_URL used at build time is rare —
  // prefer relative /api paths.
  return '';
};

async function staffFetch(
  path: string,
  init: RequestInit & { token: string },
): Promise<Response> {
  const { token, ...rest } = init;
  return fetch(`${base()}${path}`, {
    ...rest,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(rest.headers ?? {}),
    },
  });
}

export function demoHelpdeskQueuePath(): string {
  return '/api/management-web/v0/helpdesk/queue?demo=1';
}

export function demoHelpdeskContactPath(contactId: string): string {
  return `/api/management-web/v0/helpdesk/contacts/${encodeURIComponent(contactId)}?demo=1`;
}

export async function fetchDemoHelpdeskQueue(token: string): Promise<unknown> {
  const res = await staffFetch(demoHelpdeskQueuePath(), { method: 'GET', token });
  return res.json();
}

export async function fetchDemoHelpdeskContact(
  token: string,
  contactId: string,
): Promise<unknown> {
  const res = await staffFetch(demoHelpdeskContactPath(contactId), { method: 'GET', token });
  return res.json();
}

export async function assignDemoContact(
  token: string,
  contactId: string,
  body: { adminId: string; adminLabel: string },
): Promise<unknown> {
  const res = await staffFetch(
    `/api/management-web/v0/helpdesk/contacts/${encodeURIComponent(contactId)}/assign`,
    { method: 'POST', token, body: JSON.stringify(body) },
  );
  return res.json();
}

export async function setDemoContactStatus(
  token: string,
  contactId: string,
  status: TicketStatus,
): Promise<unknown> {
  const res = await staffFetch(
    `/api/management-web/v0/helpdesk/contacts/${encodeURIComponent(contactId)}/status`,
    { method: 'POST', token, body: JSON.stringify({ status }) },
  );
  return res.json();
}
