# Resident-portal v0 — Invoices demo (read-only)

**Status:** DEMO FROZEN v0 (PEMO-grok, 2026-09-25)
**Lane:** PEMO-grok only (`github.com/rbszwmr-aus/PEMO-grok`)
**Does not widen** the production `strata` module or `management-web-v0-strata-notices-live.md`. This note freezes the **in-memory, read-only** resident Invoices demo only (same pattern as `resident-portal-v0-notices-visitors-demo.md`).

## Runtime

| Role | Bind |
|------|------|
| resident-portal Vite | `0.0.0.0:5176` |
| API (tickets-demo) | `0.0.0.0:3200` |
| Demo data | **in-memory** `@pemo/invoices-demo-store` in the API process — **not** Postgres |

No writes exist, so a restart of `pnpm run dev:tickets-demo` changes nothing. Statuses are derived against a fixed demo business date **`asOf = 2026-09-25`** (not the wall clock), so the demo does not drift.

## Auth / fixture resident

```http
Authorization: Bearer demo
X-PEMO-Demo-Resident: res_demo_ho_mei_yi
```

- `Authorization: Bearer <any non-empty token>` is **required** (same rule the tickets-demo server applies to its staff routes). Missing / malformed → `401` `invalid-credential` (resident problem catalogue, `apps/api/src/errors/problem-catalog.ts`).
- Missing `X-PEMO-Demo-Resident` → fixture `res_demo_ho_mei_yi`.
- Resident → household: `res_demo_ho_mei_yi` → **`hh_wfg_a_12_a1`** (the strata household for Ho Mei-yi, Block A 12/F Flat A1, `database/seeds/80-strata-wing-fu-charges.sql`). Any other resident ref resolves to no household: list is `[]`, summary is all zeros with `householdId: null`, detail is `404`.

## Ids (reuse strata style)

- `invoiceId` = strata **chargeId** style: `chg_wfg_a1_YYYYMM[_suffix]`.
  `chg_wfg_a1_202609` and `chg_wfg_a1_202608` are the **same ids and amounts** as the strata seed; the rest are demo-only rows in the same style.
- `invoiceNumber` = strata `invoiceNumber` style: `INV-WFG-A1-YYYYMM[-SUFFIX]`.
- `paymentId` = strata payment style `pay_wfg_rNNNN` (`pay_wfg_r1001` is the strata seed FPS payment for August).

## Amount representation

**Integer HKD** (whole dollars), exactly as the management-web strata freeze (`amountHkd`, `paidHkd` integers). Field names carry the `Hkd` suffix, plus `currency: "HKD"` on every invoice and on the summary. No cents / minor units, no decimal strings.

- `amountHkd` = Σ `lineItems[].amountHkd`
- `paidHkd` = Σ `paymentsApplied[].amountHkd`
- `balanceHkd` = `amountHkd − paidHkd` (never negative)
- line `amountHkd` = `quantity × unitAmountHkd`

## Status enum

`InvoiceStatus` = `"UNPAID" | "PARTIAL" | "PAID" | "OVERDUE"`

Derivation (in order): balance 0 → `PAID`; `dueDate < asOf` → `OVERDUE` (wins over PARTIAL); `paidHkd > 0` → `PARTIAL`; else `UNPAID`.
Mapping to strata `ChargeStatus`: `due→UNPAID`, `partial→PARTIAL`, `paid→PAID`, `overdue→OVERDUE`.

## Endpoints

Base: `/api/resident-portal/v0/invoices` (all `GET`, read-only)

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/api/resident-portal/v0/invoices` | `200 { meta, invoices: InvoiceListItem[] }` — newest `issueDate` first. Optional `?status=UNPAID\|PARTIAL\|PAID\|OVERDUE` (case-insensitive); other values → `400` `bad-request`. |
| `GET` | `/api/resident-portal/v0/invoices/summary` | `200 { meta, summary: InvoiceSummary }` — counts for summary cards. |
| `GET` | `/api/resident-portal/v0/invoices/{invoiceId}` | `200 { meta, invoice: InvoiceDetail }` or `404` `not-found` (unknown id **and** another household's id give the same answer). |

`summary` is a separate endpoint (not embedded in the list). It is a static route registered before `/{invoiceId}`, so it is never captured as an invoice id.

## Shapes

`LocalizedText` = `{ "en": string, "zh-Hant": string }` (strata style).

### `meta`

```json
{
  "correlationId": "string (X-Correlation-Id echo, else a demo tag)",
  "demo": true,
  "generatedAt": "2026-09-25T18:55:00+08:00",
  "reporterRef": "res_demo_ho_mei_yi",
  "householdId": "hh_wfg_a_12_a1 | null (list only)",
  "status": "UNPAID (list only, when filtered)"
}
```

### `InvoiceListItem`

| Field | Type |
|-------|------|
| `invoiceId` | string (`chg_…`) |
| `invoiceNumber` | string (`INV-WFG-…`) |
| `householdId` | string (`hh_…`) |
| `unitId` | string (`unit_wfg_a_12_a1`) |
| `unitLabel` | LocalizedText |
| `period` | string `YYYY-MM` |
| `periodLabel` | LocalizedText (`September 2026` / `2026年9月`) |
| `title` | LocalizedText (e.g. Monthly management fee / 每月管理費) |
| `issueDate` | string `YYYY-MM-DD` |
| `dueDate` | string `YYYY-MM-DD` |
| `status` | `InvoiceStatus` |
| `currency` | `"HKD"` |
| `amountHkd` | integer |
| `paidHkd` | integer |
| `balanceHkd` | integer |

```json
{
  "invoiceId": "chg_wfg_a1_202609",
  "invoiceNumber": "INV-WFG-A1-202609",
  "householdId": "hh_wfg_a_12_a1",
  "unitId": "unit_wfg_a_12_a1",
  "unitLabel": { "en": "Block A · 12/F · Flat A1", "zh-Hant": "A座 12樓 A1室" },
  "period": "2026-09",
  "periodLabel": { "en": "September 2026", "zh-Hant": "2026年9月" },
  "title": { "en": "Monthly management fee", "zh-Hant": "每月管理費" },
  "issueDate": "2026-09-01",
  "dueDate": "2026-09-30",
  "status": "UNPAID",
  "currency": "HKD",
  "amountHkd": 3280,
  "paidHkd": 0,
  "balanceHkd": 3280
}
```

### `InvoiceDetail` = `InvoiceListItem` +

| Field | Type |
|-------|------|
| `lineItems[]` | `{ description: LocalizedText, chargeType: "management_fee" \| "carpark_licence" \| "special_levy" \| "sinking_fund", quantity: integer, unitAmountHkd: integer, amountHkd: integer }` |
| `paymentsApplied[]` | `{ paymentId: string (pay_…), paidAt: RFC 3339 +08:00, method: "fps" \| "cheque" \| "cash" \| "octopus", amountHkd: integer (portion applied to this invoice), reference: string }` — oldest first; `[]` when nothing paid |
| `pdfUrl` | `string \| null` — **always `null`** in this demo (see below) |

```json
{
  "invoiceId": "chg_wfg_a1_202609_cp",
  "invoiceNumber": "INV-WFG-A1-202609-CP",
  "householdId": "hh_wfg_a_12_a1",
  "unitId": "unit_wfg_a_12_a1",
  "unitLabel": { "en": "Block A · 12/F · Flat A1", "zh-Hant": "A座 12樓 A1室" },
  "period": "2026-09",
  "periodLabel": { "en": "September 2026", "zh-Hant": "2026年9月" },
  "title": { "en": "Car park licence fee", "zh-Hant": "車位牌照費" },
  "issueDate": "2026-09-01",
  "dueDate": "2026-09-30",
  "status": "PARTIAL",
  "currency": "HKD",
  "amountHkd": 2400,
  "paidHkd": 1200,
  "balanceHkd": 1200,
  "lineItems": [
    {
      "description": { "en": "Car park licence — bay P2-017", "zh-Hant": "車位牌照 — P2-017 車位" },
      "chargeType": "carpark_licence",
      "quantity": 1,
      "unitAmountHkd": 2400,
      "amountHkd": 2400
    }
  ],
  "paymentsApplied": [
    {
      "paymentId": "pay_wfg_r1012",
      "paidAt": "2026-09-12T19:40:00+08:00",
      "method": "octopus",
      "amountHkd": 1200,
      "reference": "Octopus stub · tap 19:40"
    }
  ],
  "pdfUrl": null
}
```

### `InvoiceSummary`

| Field | Type |
|-------|------|
| `householdId` | string \| null |
| `currency` | `"HKD"` |
| `asOf` | string `YYYY-MM-DD` (demo business date statuses are evaluated against) |
| `counts` | `{ UNPAID: integer, PARTIAL: integer, PAID: integer, OVERDUE: integer }` (all four keys always present) |
| `totalCount` | integer |
| `outstandingBalanceHkd` | integer — Σ `balanceHkd` of UNPAID + PARTIAL + OVERDUE |
| `overdueBalanceHkd` | integer — Σ `balanceHkd` of OVERDUE |

```json
{
  "householdId": "hh_wfg_a_12_a1",
  "currency": "HKD",
  "asOf": "2026-09-25",
  "counts": { "UNPAID": 1, "PARTIAL": 1, "PAID": 3, "OVERDUE": 1 },
  "totalCount": 6,
  "outstandingBalanceHkd": 10080,
  "overdueBalanceHkd": 5600
}
```

### Errors (`application/problem+json`, `PemoProblem.toBody`)

```json
{ "type": "https://pemo.local/problems/invalid-credential", "title": "Credential is not valid", "status": 401,
  "correlationId": "demo-invoices-list",
  "residentMessage": { "en": "Please sign in again to continue.", "zh-Hant": "請重新登入以繼續。" },
  "retryable": false }
```

```json
{ "type": "https://pemo.local/problems/not-found", "title": "Not Found", "status": 404,
  "correlationId": "demo-invoices-detail", "detail": "Invoice not found",
  "residentMessage": { "en": "This invoice could not be found.", "zh-Hant": "找不到此帳單。" },
  "retryable": false }
```

```json
{ "type": "https://pemo.local/problems/bad-request", "title": "Bad request", "status": 400,
  "correlationId": "demo-invoices-list",
  "detail": "status must be one of UNPAID, PARTIAL, PAID, OVERDUE", "retryable": false }
```

Fields: `type`, `title`, `status`, `correlationId`, optional `detail`, optional `residentMessage { en, zh-Hant }`, `retryable`.

## Seed (household `hh_wfg_a_12_a1`, asOf 2026-09-25)

| invoiceId | period | title | issue → due | status | amountHkd | paidHkd | balanceHkd | payments |
|-----------|--------|-------|-------------|--------|-----------|---------|------------|----------|
| `chg_wfg_a1_202609` | 2026-09 | Monthly management fee | 09-01 → 09-30 | UNPAID | 3280 | 0 | 3280 | — (strata seed row) |
| `chg_wfg_a1_202609_cp` | 2026-09 | Car park licence fee | 09-01 → 09-30 | PARTIAL | 2400 | 1200 | 1200 | `pay_wfg_r1012` octopus |
| `chg_wfg_a1_202607_lv` | 2026-07 | Special levy — external wall repair (4800 levy + 2×400 sinking fund) | 07-15 → 08-15 | OVERDUE | 5600 | 0 | 5600 | — |
| `chg_wfg_a1_202608` | 2026-08 | Monthly management fee | 08-01 → 08-31 | PAID | 3280 | 3280 | 0 | `pay_wfg_r1001` fps (strata seed) |
| `chg_wfg_a1_202607` | 2026-07 | Monthly management fee | 07-01 → 07-31 | PAID | 3280 | 3280 | 0 | `pay_wfg_r0962` cheque |
| `chg_wfg_a1_202606` | 2026-06 | Monthly management fee | 06-01 → 06-30 | PAID | 3280 | 3280 | 0 | `pay_wfg_r0917` fps |

## `pdfUrl`

**Always `null`.** The repo has no PDF renderer or invoice PDF template (no PDF dependency in any workspace package; the strata invoice e-mail is plain text by its own freeze). Serving a fake or placeholder PDF would be dishonest, so the field is present for shape stability and is `null`. Clients must hide / disable a "Download PDF" affordance when `pdfUrl` is `null`.

## Shared store

Package: `packages/invoices-demo-store` → `@pemo/invoices-demo-store`

- `getDemoInvoiceStore()` → `householdForResident`, `listForHousehold(householdId, status?)`, `getForHousehold(householdId, invoiceId)`, `summaryForHousehold(householdId | null)`
- `deriveInvoiceStatus`, `seedInvoices(asOf?)`, `INVOICE_STATUSES`
- Tests: `pnpm --filter @pemo/invoices-demo-store test`

Routes: `apps/api/src/demo/invoices-demo-routes.ts`, registered in `apps/api/src/demo/tickets-demo-server.ts`.

## Dev proxy

resident-portal Vite also proxies `/api/resident-portal/v0/invoices` to `PEMO_LIVE_BASE_URL` (default `http://127.0.0.1:3200`).

## Curl examples

```bash
curl -s -H "Authorization: Bearer demo" -H "X-PEMO-Demo-Resident: res_demo_ho_mei_yi" \
  http://127.0.0.1:3200/api/resident-portal/v0/invoices
curl -s -H "Authorization: Bearer demo" -H "X-PEMO-Demo-Resident: res_demo_ho_mei_yi" \
  "http://127.0.0.1:3200/api/resident-portal/v0/invoices?status=OVERDUE"
curl -s -H "Authorization: Bearer demo" -H "X-PEMO-Demo-Resident: res_demo_ho_mei_yi" \
  http://127.0.0.1:3200/api/resident-portal/v0/invoices/summary
curl -s -H "Authorization: Bearer demo" -H "X-PEMO-Demo-Resident: res_demo_ho_mei_yi" \
  http://127.0.0.1:3200/api/resident-portal/v0/invoices/chg_wfg_a1_202609
curl -s -i http://127.0.0.1:3200/api/resident-portal/v0/invoices            # 401
curl -s -i -H "Authorization: Bearer demo" \
  http://127.0.0.1:3200/api/resident-portal/v0/invoices/chg_does_not_exist  # 404
```

## Out of scope

Payments / pay-now, any writes, QR PAYMENT passes, PDF generation, e-mail, receipts download, Postgres-backed live reads, real resident SSO, OpenAPI production expansion.
