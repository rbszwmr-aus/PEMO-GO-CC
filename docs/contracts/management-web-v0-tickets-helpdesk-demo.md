# Management-web / resident-portal v0 — tickets Help desk demo

**Status:** FROZEN for this demo slice (PEMO-grok, 2026-09-22)
**Lane:** PEMO-grok only (`github.com/rbszwmr-aus/PEMO-grok`)
**Does not widen** `management-web-v0-freeze.md` production Help desk reads. This note freezes the **in-memory demo** round-trip only.

## Runtime

| Role | Bind |
|------|------|
| management-web Vite | `0.0.0.0:5175` |
| resident-portal Vite | `0.0.0.0:5176` |
| API | `0.0.0.0:3200` |
| Demo data | **in-memory** `@pemo/tickets-demo-store` in the API process — **not** Postgres |

Prefer no DB. Do not invent empty live Postgres ticket rows for this demo.

## TicketStatus (domain)

Same vocabulary as `@pemo/helpdesk` / `helpdesk.ticket.status`:

`open | triaged | in_progress | awaiting_resident | resolved | closed`

**There is no status named `assigned`.** Assign-to-admin is a **field** on the demo ticket:

- `assignedAdminId: string | null`
- `assignedAdminLabel: string | null`

(Real domain assigns Cases via `assignCase`; this demo keeps assign on the Help desk ticket surface.)

## Staff UI chrome map

Existing map in `apps/api/src/management/compose-helpdesk.ts` / helpdesk-fixtures:

| TicketStatus (+ due) | Chrome |
|----------------------|--------|
| `closed` / `resolved` | `closed` |
| `in_progress` / `awaiting_resident` | `in_progress` |
| `open` / `triaged` past `dueAt` | `overdue` |
| `open` / `triaged` otherwise | `waiting` |

## Opaque ids

- Ticket / contact id: `tkt_…`
- Contact id === ticket id for Help desk.

## Fixture resident

Header (no SSO):

```http
X-PEMO-Demo-Resident: res_demo_ho_mei_yi
```

Fixed reporter: `res_demo_ho_mei_yi` (Ho Mei-yi 何美儀 · A · 12/F A1). Missing/unknown header → treat as that fixture for demo GET/POST list/create, or `401` problem if you prefer fail-closed on detail ownership checks — this freeze uses: create/list require the header equal to the fixture (or omit → fixture); detail requires the ticket’s `reporterRef` match.

No notifications / email / push.

## Shared store

Package: `packages/tickets-demo-store` → `@pemo/tickets-demo-store`

- `createTicketStore()` / process singleton `getDemoTicketStore()`
- Methods: `listAll`, `listForReporter`, `get`, `create`, `assign`, `setStatus` (Surfaces aliases `*Ticket` / `getPortalTicketStore` kept)
- Adapters: `toHelpdeskQueueRow`, `toHelpdeskContactDetail`, `toPortalTicketSummary`, `toPortalTicketDetail`

## Resident ops (demo)

Base: `/api/resident-portal/v0/tickets`

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/` | create — body `{ subject, body?, category? }` → portal detail |
| `GET` | `/` | list for fixture resident → summaries |
| `GET` | `/{ticketId}` | detail (resident-visible timeline only) |

## Staff ops (demo)

Base: `/api/management-web/v0`

Bearer staff required (same stub as other management routes).

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/helpdesk/queue?demo=1` | queue from in-memory store (fixture chrome rows) |
| `GET` | `/helpdesk/contacts/{contactId}?demo=1` | contact detail from store |
| `POST` | `/helpdesk/contacts/{contactId}/assign` | body `{ adminId, adminLabel }` |
| `POST` | `/helpdesk/contacts/{contactId}/status` | body `{ status: TicketStatus }` |

Default live queue (`GET .../helpdesk/queue` without `demo=1`) stays DB-backed via `composeHelpdeskQueue`. Demo mode is **opt-in** via `?demo=1`.

Assign / status POSTs always mutate the in-memory demo store (demo writes).

Surfaces convenience (same store): `GET /api/management-web/v0/helpdesk/portal-tickets` (and `.../{ticketId}`) return raw `DemoTicket` rows — Bearer staff. Prefer `?demo=1` queue/contact for chrome-shaped Help desk rows.

## Dev proxy

When `PEMO_LIVE_BASE_URL` is set:

- management-web already proxies `/api/management-web/v0/helpdesk/contacts` (covers assign/status) and `/helpdesk/queue`
- resident-portal proxies `/api/resident-portal/v0/tickets` → `:3200`


## smallest Lenovo (no Docker)

```
# smallest Lenovo (no Docker)
cd apps/api
pnpm run dev:tickets-demo
# listens :3200 — in-memory only
# UIs: PEMO_LIVE_BASE_URL=http://127.0.0.1:3200
# staff Bearer: any token e.g. demo
# resident: X-PEMO-Demo-Resident: res_demo_ho_mei_yi
```

Standalone entry: `apps/api/src/demo/tickets-demo-server.ts` — no `wireModules`, no Postgres, no `database/dev/.env`. Ready/health are `{ ok: true, demo: true }` without DB checks.

## Out of scope

Invoices/notices, email/push, real resident SSO, OpenAPI production expansion (freeze is enough for this slice).

## Demo steps

1. `POST /api/resident-portal/v0/tickets` with `X-PEMO-Demo-Resident: res_demo_ho_mei_yi`
2. `GET /api/management-web/v0/helpdesk/queue?demo=1` (Bearer staff) — new `tkt_…` appears
3. `POST .../contacts/{id}/assign` with `{ adminId, adminLabel }`
4. `POST .../contacts/{id}/status` with `{ status: "in_progress" }`
5. `GET /api/resident-portal/v0/tickets/{id}` — assignee + status visible; internal notes omitted
