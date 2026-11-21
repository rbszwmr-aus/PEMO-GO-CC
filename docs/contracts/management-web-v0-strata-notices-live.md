# Management-web v0 — strata reads + notices live + SMTP send

**Status:** FROZEN for this slice (PEMO-grok, 2026-09-22)
**Lane:** PEMO-grok only (`github.com/rbszwmr-aus/PEMO-grok`)
**Does not widen** `management-web-v0-freeze.md`. Health, ready, scope, property tree, and helpdesk stay as that note left them. This note freezes only the paths below.

## Runtime

| Role | Bind |
|------|------|
| management-web Vite | `0.0.0.0:5175` |
| API | `0.0.0.0:3200` |
| DB | database `pemo_grok` @ `127.0.0.1:5432` |

The API still connects as the two roles the platform already requires: `pemo_owner` (migrations and seeds) and `pemo_app` (runtime, SELECT+INSERT). Local proof uses password `pemo_grok` for those roles and for a superuser also named `pemo_grok`. SMTP secrets are server env only (`SMTP_HOST` or `SMTP_URL`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). They are never returned to the SPA and never compiled into the bundle.

Dev proxy: when `PEMO_LIVE_BASE_URL=http://127.0.0.1:3200` is set, Vite forwards the freeze paths **plus**:

- `/api/management-web/v0/strata`
- `/api/management-web/v0/notices` (existing notice reads and acts, plus the email send and delivery read below)
- `/api/management-web/v0/admin/email`

## UI live switch

Same as the v0 freeze:

- Live: `?source=live&token=<staff-bearer>` (optional `api=`; empty means same-origin / Vite proxy)
- Fixture (default): omit `source=live`. Corpus and page fixtures stay the default.

Demo principal: `stf_wfg_manager` (Wing Fu Garden / `est_wing_fu_garden`).

```bash
cd apps/api && node --env-file=../../database/dev/.env dist/cli/dev-token.js stf_wfg_manager
```

Missing or invalid token → `401` `application/problem+json`. Never a `200` empty charge list or notice list.

## Frozen paths

Bearer staff. Scope is applied in the query. Opaque ids. Errors are `application/problem+json` with `type`, `title`, `status`, `correlationId`, `staffMessage { en, zh-Hant }`, `retryable`.

### Strata reads

1. `GET /api/management-web/v0/strata/charges` → `StrataChargeListResponse`
2. `GET /api/management-web/v0/strata/charges/{chargeId}` → `StrataChargeDetailResponse` or `404` (`record-not-found`; out of scope and missing are the same answer)
3. `GET /api/management-web/v0/strata/payments` → `StrataPaymentListResponse`

Wing Fu Garden demo rows are seeded in `strata` (`chg_wfg_*`, `pay_wfg_*`). Amounts are integer HKD. `paidHkd` is the sum of allocations. Household and unit ids are stable identifiers with no cross-module foreign key. `contactEmail` on a charge is the invoice To **snapshot** (seeded from `resident.household.contact_email` at charge time). Invoice send resolves To from the live household email, falling back to this snapshot when live is null or empty.

`StrataChargeListResponse`:

- `meta`: `{ correlationId, contractVersion, generatedAt }`
- `charges`: `StrataCharge[]`

`StrataCharge` (list and detail share this object; detail adds `receipts` and `invoiceSends`):

- `chargeId`, `householdId`, `residentId`, `payerName`
- `unitSummary`: `{ en, zh-Hant }`
- `scope`: `ScopePath` (`node` + `ancestry`)
- `period` (`YYYY-MM`), `kind`: `{ en, zh-Hant }`
- `issuedOn`, `dueOn` (`YYYY-MM-DD`)
- `amountHkd`, `paidHkd` (integers)
- `status`: `due | paid | partial | overdue`
- `tone`: `normal | information | warning | unknown`
- `staffNotes`: `{ en, zh-Hant } | null`
- `invoiceNumber`, `scheduledSendAt` (RFC 3339, `+08:00`), `contactEmail`
- `lineItems`: `[{ description: { en, zh-Hant }, amountHkd }]`
- `invoiceEmail`: `{ status: none|queued|sending|accepted|failed|unknown|log-only, recordedAt, transport: log|smtp|null, detail }`

`accepted` means an SMTP server accepted the message; it is not a delivery or read receipt. `log-only` means the server recorded the message and did **not** hand it to SMTP (`SMTP_HOST` and `SMTP_URL` unset). `failed` means a proven pre-DATA SMTP error (connection, DNS, auth, or envelope/RCPT rejection) and may be retried. `unknown` means acknowledgement was lost or uncertain and must not be auto-retried. The detail string says which, and it does not contain a password.

`StrataPaymentListResponse.payments[]`:

- `paymentId`, `householdId`, `residentId`, `payerName`, `unitSummary`, `scope`
- `paidOn`, `method`: `fps | cheque | cash | octopus`, `amountHkd`
- `reference`: `{ en, zh-Hant }`, `staffNotes`, `allocations`: `[{ chargeId, amountHkd }]`

Refunds are not in this freeze.

### Notice reads (existing module, not a second notice domain)

These operations already exist on `@pemo/notices` and are frozen here so the live UI may call them:

4. `GET /api/management-web/v0/notices` → `StaffNoticeListResponse`
5. `GET /api/management-web/v0/notices/{noticeId}` → `StaffNoticeDetailResponse`
6. `GET /api/management-web/v0/notices/{noticeId}/acknowledgements` → `NoticeOutstandingResponse`

Shapes are the ones already in `packages/api-contracts/management-web/openapi.yaml` (`StaffNoticeListResponse`, `StaffNoticeDetailResponse`). Scope intersection is unchanged.

A delivery **schedule** (channels, lobby playlist, portal publish) is not modeled in `notices` — ADR-019 leaves delivery out of that module, and this slice does not invent a second notice. The live read for staff delivery is the email-channel ledger only:

7. `GET /api/management-web/v0/notices/{noticeId}/delivery` → `NoticeEmailDeliveryResponse`, `404` `notice-not-found`, or `403` when the caller has no estate_staff grant (or is otherwise unauthorised). Ordinary notice reading is unchanged (intersection). Delivery preview and history return only recipients and outbox rows whose *recipient* scope the caller covers. Legacy rows with no stored recipient scope are visible only to estate-wide (estate/organization/portfolio) staff. The `email.recipients` list and `email.recipientCount` cover only those preview recipients; `email.sends` lists only visible outbox rows. The response includes no counts, addresses, or totals about hidden rows. Changing the notice's current targets does not expose earlier recipients.

```json
{
  "meta": {},
  "noticeId": "ntc_seed_lift",
  "schedule": null,
  "email": {
    "recipientCount": 1,
    "sends": [
      {
        "outboxId": "obx_…",
        "to": "ho.meiyi@wingfu.example",
        "subject": "…",
        "status": "logged",
        "transport": "log",
        "detail": "SMTP_HOST and SMTP_URL are unset; …",
        "recordedAt": "2026-09-22T09:00:00+08:00"
      }
    ]
  }
}
```

`schedule` is always `null` in this freeze. An empty `sends` array on `200` means no email has been recorded. A transport or auth failure is a problem, not that empty array.

MVP outbox policy: a send is admitted as `queued` and claimed (`sending`) before SMTP. On SMTP acceptance the row is `accepted` (not a delivery receipt). When SMTP is unset the row is `log-only`. A proven pre-DATA error is `failed` and may return to `queued` on retry. A lost DATA acknowledgement, or any uncertain transport exception, is persisted as `unknown` and is never auto-retried. If the transport accepted (or returned `unknown`) and the result cannot be saved, the row stays `sending` and is never auto-resent; after 15 minutes (`SENDING_UNKNOWN_AFTER_MS`) it is reported as `unknown`. Manual resend of an `unknown` or `failed` row is an explicit, authorised, audited `POST .../email/resend` that creates a new generation and leaves the original row intact. There is no background worker in this MVP.

### SMTP send

Secrets stay on the server. Request bodies do not carry host, username, or password.

8. `POST /api/management-web/v0/strata/charges/{chargeId}/invoice-email`
   - No fields. Omit `Content-Type`, or send `{}`. An empty `application/json` body is rejected by the HTTP server before the handler.
   - To = live household email via `householdContacts.listByIds(organizationId, [charge.householdId])` → `contactEmail`; if null/empty, fall back to the charge's `contactEmail` snapshot. From = `SMTP_FROM` or `invoices@wingfu.example`.
   - Plain-text invoice (not a PDF). Records `strata.email_outbox` `kind=invoice`.
   - `200` `MailSendResponse`. `404` when the charge is missing or out of scope.

9. `POST /api/management-web/v0/admin/email/test`
   - Body: `{ "to": "staff@example.com" }` only.
   - MVP decision for PT: `grant_administrator` covers the SMTP test. The access catalogue has no narrower email-admin capability (`estate_staff`, `approver`, `integration_support`, `grant_administrator`, `resident`). Callers without that grant receive 403 and the recipient is not echoed.
   - `400` when `to` is missing or not an email address.
   - Records `kind=admin_test`. `200` `MailSendResponse`.

10. `POST /api/management-web/v0/notices/{noticeId}/email`
    - No body. Recipients are **current** residential occupancies of the notice's existing targets whose household has `contact_email`. One outbox row per distinct address (`kind=notice`).
    - `404` when the notice is missing or out of scope.
    - `422` `notice-email-no-recipient` when the audience has no contact email.
    - `200` `NoticeEmailSendResponse`: `{ meta, noticeId, transport, results: MailSendResponse[] }` (each result omits a nested `meta`).

`MailSendResponse`:

- `meta`
- `outboxId`, `kind`, `subjectId` (charge id, notice id, or null for an admin test)
- `to`, `from`, `subject`
- `status`: `queued | sending | accepted | failed | unknown | log-only`
- `transport`: `log | smtp`
- `detail` (no secret)
- `recordedAt` (RFC 3339, `+08:00`)

When SMTP env is unset the transport is `log` and the status is `log-only` (nodemailer JSON transport). The response says so. It does not pretend the message was delivered.

## Proof URLs (Lenovo)

Replace `<bearer>` with the `stf_wfg_manager` token.

```bash
curl -sS -H "Authorization: Bearer <bearer>" http://127.0.0.1:3200/api/management-web/v0/strata/charges
curl -sS -H "Authorization: Bearer <bearer>" http://127.0.0.1:3200/api/management-web/v0/strata/charges/chg_wfg_a1_202609
curl -sS -H "Authorization: Bearer <bearer>" http://127.0.0.1:3200/api/management-web/v0/strata/payments
curl -sS -H "Authorization: Bearer <bearer>" http://127.0.0.1:3200/api/management-web/v0/notices
curl -sS -H "Authorization: Bearer <bearer>" http://127.0.0.1:3200/api/management-web/v0/notices/ntc_seed_lift
curl -sS -H "Authorization: Bearer <bearer>" -H 'Content-Type: application/json' \
  -d '{"to":"desk@wingfu.example"}' \
  http://127.0.0.1:3200/api/management-web/v0/admin/email/test
```

UI (Vite proxy, `PEMO_LIVE_BASE_URL=http://127.0.0.1:3200`):

- Charges: `http://127.0.0.1:5175/?source=live&screen=charges&token=<bearer>`
- Payments: `http://127.0.0.1:5175/?source=live&screen=payments&token=<bearer>`
- Notices: `http://127.0.0.1:5175/?source=live&screen=s5&token=<bearer>`
- Admin email test: `http://127.0.0.1:5175/?source=live&screen=adminEmail&token=<bearer>`

## Non-goals

Resident portal invoices and notices, ParkCore, SSO, MCP, refunds, and a production SMTP settings screen. Administration → Email fields in the SPA stay a fixture form; the live test button sends `{ to }` and the server uses `SMTP_*`.
