# Resident-portal v0 — Notices + Visitor Management demo

**Status:** FROZEN for this demo slice (PEMO-grok, 2026-09-23)
**Lane:** PEMO-grok only (`github.com/rbszwmr-aus/PEMO-grok`)
**Does not widen** production notices module or BMS/door unlock. This note freezes the **in-memory demo** round-trip only (same pattern as `management-web-v0-tickets-helpdesk-demo.md`).

## Runtime

| Role | Bind |
|------|------|
| resident-portal Vite | `0.0.0.0:5176` |
| API (tickets-demo) | `0.0.0.0:3200` |
| Demo data | **in-memory** `@pemo/notices-visitors-demo-store` in the API process — **not** Postgres |

Prefer no DB. Restart of `pnpm run dev:tickets-demo` **wipes** seed + any POST/check-out mutations.

Staff compose of notices is **out of scope**. No BMS / door unlock on visitor check-out.

## Opaque ids

- Notice id: `ntc_…`
- Visitor id: `vis_…`

## Fixture resident / auth

Same as tickets demo:

```http
Authorization: Bearer demo
X-PEMO-Demo-Resident: res_demo_ho_mei_yi
```

Portal routes accept either or both. Missing `X-PEMO-Demo-Resident` → treat as fixture `res_demo_ho_mei_yi`. Notices are estate-wide read-only for the demo resident (no per-resident filter). Visitors list/detail/create/check-out are scoped to the resolved resident ref.

## Shared store

Package: `packages/notices-visitors-demo-store` → `@pemo/notices-visitors-demo-store`

- `getDemoNoticeStore()` — `listAll`, `get`
- `getDemoVisitorStore()` — `listForResident`, `get`, `create`, `checkOut`, `setStatus`
- Seed: 4 notices (`ntc_seed_*`), 2 visitors (`vis_seed_*`)

## Notice shape

```json
{
  "noticeId": "ntc_…",
  "title": "string",
  "body": "string",
  "publishedAt": "2026-09-21T09:00:00+08:00",
  "severity": "info | warning | critical",
  "category": "string"
}
```

## Visitor shape

```json
{
  "visitorId": "vis_…",
  "name": "string",
  "purpose": "string | null",
  "expectedFrom": "ISO-8601",
  "expectedTo": "ISO-8601",
  "hostUnitId": "string | null",
  "idStub": "string | null",
  "residentRef": "res_demo_ho_mei_yi",
  "status": "expected | checked_in | checked_out | cancelled",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "checkedOutAt": "ISO-8601 | null"
}
```

## Resident ops (demo)

Base notices: `/api/resident-portal/v0/notices`

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/` | list → `{ meta, notices[] }` |
| `GET` | `/{noticeId}` | detail → `{ meta, notice }` or `404` |

Base visitors: `/api/resident-portal/v0/visitors`

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/` | my visitors for demo resident → `{ meta, visitors[] }` |
| `POST` | `/` | body `{ name, purpose?, expectedFrom, expectedTo, hostUnitId?, idStub? }` → `201` `{ meta, visitor }` |
| `GET` | `/{visitorId}` | detail (ownership = `residentRef`) |
| `POST` or `PATCH` | `/{visitorId}/check-out` | set `status: checked_out` + `checkedOutAt` — **no** door unlock |

## Dev proxy

When `PEMO_LIVE_BASE_URL=http://127.0.0.1:3200` is set, resident-portal Vite proxies:

- `/api/resident-portal/v0/tickets`
- `/api/resident-portal/v0/notices`
- `/api/resident-portal/v0/visitors`

## smallest Lenovo (no Docker)

```
cd apps/api
pnpm run dev:tickets-demo
# listens :3200 — in-memory only (tickets + notices + visitors)
# UIs: PEMO_LIVE_BASE_URL=http://127.0.0.1:3200
# resident: X-PEMO-Demo-Resident: res_demo_ho_mei_yi
# staff Bearer (tickets helpdesk): any token e.g. demo
```

Standalone entry: `apps/api/src/demo/tickets-demo-server.ts` — registers tickets routes **and** notices/visitors demo routes. Ready/health remain `{ ok: true, demo: true }`.

## Curl examples

```bash
curl -s http://127.0.0.1:3200/health

curl -s -H "Authorization: Bearer demo" \
  -H "X-PEMO-Demo-Resident: res_demo_ho_mei_yi" \
  http://127.0.0.1:3200/api/resident-portal/v0/notices

curl -s -H "Authorization: Bearer demo" \
  -H "X-PEMO-Demo-Resident: res_demo_ho_mei_yi" \
  http://127.0.0.1:3200/api/resident-portal/v0/notices/ntc_seed_lift_maintenance

curl -s -X POST -H "Authorization: Bearer demo" \
  -H "X-PEMO-Demo-Resident: res_demo_ho_mei_yi" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Guest Chan\",\"purpose\":\"Dinner\",\"expectedFrom\":\"2026-09-24T18:00:00+08:00\",\"expectedTo\":\"2026-09-24T22:00:00+08:00\"}" \
  http://127.0.0.1:3200/api/resident-portal/v0/visitors

curl -s -H "Authorization: Bearer demo" \
  -H "X-PEMO-Demo-Resident: res_demo_ho_mei_yi" \
  http://127.0.0.1:3200/api/resident-portal/v0/visitors

# replace VIS_ID from POST response
curl -s -H "Authorization: Bearer demo" \
  -H "X-PEMO-Demo-Resident: res_demo_ho_mei_yi" \
  http://127.0.0.1:3200/api/resident-portal/v0/visitors/VIS_ID

curl -s -X POST -H "Authorization: Bearer demo" \
  -H "X-PEMO-Demo-Resident: res_demo_ho_mei_yi" \
  -H "Content-Type: application/json" \
  -d "{}" \
  http://127.0.0.1:3200/api/resident-portal/v0/visitors/VIS_ID/check-out
```

## Out of scope

Staff notice compose, email/push, real resident SSO, BMS/door unlock, OpenAPI production expansion.

## Surfaces field names

Surfaces client not painted yet at freeze time — shapes above are the contract. Prefer matching these names; if a later Surfaces paint diverges, note the delta in a follow-up.
