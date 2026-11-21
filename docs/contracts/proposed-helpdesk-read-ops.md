# Proposed contract amend - Help desk reads (OPERATE)

**Status:** IMPLEMENTED (2026-09-07) — GET queue + contacts/{id} live under management-web v0
**Lane:** PEMO-grok management-web Surfaces <-> Backend
**Accepted with:** PEMO-grok master + Backend notes below
**Fixture remains default until Surfaces flips live.** Backend smoke @ 96caed2: queue + contacts/{id} return 200 with staff Bearer (contractVersion 2.4.0).

## Why

The management-web rail item `helpdesk` (OPERATE -> Help desk, CD 6 Sept badge)
needs a fixture-first **queue -> contact detail** vertical slice. Design shows one
office queue for app messages, phone calls and counter visits (office hours
08:00-20:00), with stats, a live queue table, and notes that separate help-desk
contacts from Cases / Home Safety.

The management OpenAPI under v0 freeze has **no** help-desk / contact-queue
reads. Live remains frozen at Surfaces<->Backend v0 (scope + tree only) until
this amend is implemented and the freeze note / OpenAPI are updated.

UI ships fixture-first under
`apps/management-web/src/data/helpdesk-fixtures.ts` and does **not** call live.
`?source=live` on Help desk must not invent empty queues.

## Accepted operations (implement later)

1. `GET /api/management-web/v0/helpdesk/queue` - `listHelpdeskQueue` -> `HelpdeskQueueResponse`
2. `GET /api/management-web/v0/helpdesk/contacts/{contactId}` - `getHelpdeskContact` -> `HelpdeskContactDetailResponse`

Paths use the management-web v0 prefix (same family as scope / properties/tree),
not bare `/helpdesk/...`.

## Backend acceptance notes (locked)

1. **Paths:** under `/api/management-web/v0/helpdesk/...` - match scope/tree + future Vite proxy allowlist.
2. **Auth / grant-scope:** `Authorization: Bearer` staff; missing/invalid -> `401 application/problem+json`; queue and detail filtered by authorizing grants; no cross-estate leak.
3. **Opaque IDs:** contact / resident / unit / case refs are opaque own IDs (e.g. `hd_` / `res_` / `unit_` / `case_`); not resident-mobile identifiers.
4. **Ticket -> UI enum map (option a):** Backend returns domain ticket / contact fields; Surfaces maps them to UI chrome enums (`waiting` | `in_progress` | `overdue` | `closed`, channel tones, etc.). Do not require Backend to emit design-chrome-only labels.
5. **Queue response:** `meta` + `stats` + `rows` (fixture-shaped counts / office hours / queue rows). Confirm pagination at implement.
6. **Detail response:** timeline / transcript turns, optional linked case reference, disposition note. A help-desk contact is a **conversation**, not a case; safety events never route here as owned work.
7. **Writes out of amend:** no create/update/close/disposition writes in this amend - reads only.
8. **When implemented:** add only these two GETs to the Vite `PEMO_LIVE_BASE_URL` proxy allowlist; update OpenAPI + `docs/contracts/management-web-v0-freeze.md` (or successor) only after implement lock - not before.

## Shape intent (from UI fixtures)

- Queue row: channel (`app` | `phone` | `counter`), resident display name, unit label, subject, waiting label, state, tone for chrome.
- Stats: waiting count, answered today, raised as cases, office hours.
- Contact detail: channel, resident, unit, subject, waiting, state, openedAt, timeline turns, optional linked case, disposition.

## Live freeze / Surfaces prep note

Surfaces (2026-09-07): Vite `PEMO_LIVE_BASE_URL` allowlist includes the two Help
desk GETs; live client + ticket→UI enum map exist; `?source=live` on Help desk
calls them. Fixture remains the default (omit `source=live`).

**Do not update `management-web-v0-freeze.md` / OpenAPI for Help desk live-success
until Backend proves 200s on :3200** (same convention as residents — freeze only
after implement lock / proof). Until then, live Help desk must surface
problem+json / offline — never invent empty queues. No Residents live. No writes.

