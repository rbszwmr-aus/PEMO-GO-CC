# PEMO: Node.js → Go migration notes

Source: `PEMO-grok` at commit `4c1093e` (the archive is in `_import/`).
Target: this repository, `F:\Projects\PEMO-GO-CC`.
The plan it follows: `docs/reviews/PEMO-Go-migration-plan.md` in PEMO-grok.

## 1. What moved where

| Node (PEMO-grok) | Go (this repo) |
|---|---|
| `apps/api/src/server.ts`, `wiring.ts`, `main.ts` | `backend/internal/api/*`, `backend/cmd/pemo-api` |
| `apps/api/src/management/*` (composers, notice acts, mail, strata, trees, paging, staff problems) | `backend/internal/api/*.go` |
| `apps/api/src/management/case-acts.ts`, `case-permissions.ts`, `case-reasons.ts` | `backend/internal/caseacts` |
| `apps/api/src/management/genesis.ts` | `backend/internal/api/genesis.go` |
| `apps/api/src/cli/*` + `database/bootstrap.sh` | `backend/cmd/pemo` (`bootstrap`, `migrate`, `seed`, `reseed`, `dev-token`, `resident-token`, `provision-organization`, `verify-boundaries`) |
| `apps/api/src/demo/*` + `packages/*-demo-store` (runtime) | `backend/internal/demo`, `backend/internal/api/demo_routes.go`, `backend/cmd/pemo-demo` |
| `apps/mcp-server` | `backend/internal/mcp`, `backend/cmd/pemo-mcp` |
| `modules/<name>` | `backend/internal/<name>` (one package per schema; `home-safety` → `homesafety`) |
| `modules/platform` | `backend/internal/platform` (config, pools, audited write, idempotency, migrations, logger) |

Unchanged: `apps/management-web`, `apps/resident-portal`, `apps/resident-mobile`,
`packages/*` (the UIs still import the demo-store TypeScript for types),
`database/roles|migrations|seeds`, `docs/`, `tests/fixtures`.

Changed outside `backend/`: the two `vite.config.ts` (ports and proxy target),
`apps/management-web/package.json` (`dev:live` → 23280), `database/dev/*`
(port 25480, `pemo-go-*` container/volume names), `database/bootstrap.sh`
(now calls the Go CLI), `pnpm-workspace.yaml` (UI apps + packages only),
`scripts/` (port-checking start scripts), `.github/workflows/ci.yml`,
`.githooks/pre-push`.

## 2. Parity: what "same behaviour" was checked against

| Check | Result |
|---|---|
| All 37 HTTP routes the Node server registered | present in Go (+ the demo routes, + `/strata/*`) |
| Resident fixture parity (`tests/go/fixture_parity.py`, port of `fixture-parity.test.ts`): reseed, apply the scenario, call with the fixture's clock and correlation id, compare status + body | **69 / 69 identical, byte for byte** |
| OpenAPI conformance (`tests/go/conformance.py`): every response validated against the operation's schema; reads and real write flows (notice lifecycle, grants, principals, memberships, occupancy, estate contacts, safety updates, acknowledgements, invoice/notice/test email) | **66 pass**, 4 inherited contract drifts (§5), 0 failures |
| Module boundaries (`pemo verify-boundaries`: Go imports, cross-schema SQL, cross-module FKs, schema list) | PASS |
| Case acts on the helpdesk **module login** (no owner rights) incl. audit-row count | PASS (`internal/caseacts/integration_test.go`) |
| QR passes signed by Go verified by the Node COSE/CBOR/base45 code | verified |
| Dev tokens minted by `apps/management-web/tool/dev-token.ts` accepted by the Go API | 200 |
| Vocabularies vs `notice-reasons.json`, `notice-types.json`, `case-vocabularies.json` | `vocabulary_test.go` (replaces the generators' `--check`) |
| Windows build (`GOOS=windows`) | builds; binaries shipped in `backend/bin/` |

Not verified here (no npm registry in the build sandbox, no Windows host):
the Vite UIs running in a browser against the Go API, a live side-by-side run
against the Node API (use `tests/go/compare_with_node.py` on the AMD box), a
real SMTP server (a fake one is used in tests), and running on Windows.

## 3. What was fixed while porting

**Security**

- **Dev tokens from the future are refused** (60 s skew). The Node stub accepted any future `issuedAt`, so a token could be made to never expire.
- **Correlation ids must be UUIDs**; anything else is replaced by a fresh one. The Node build echoed any client string into logs and problem bodies.
- **Demo routes are off unless `PEMO_ENABLE_DEMO_ROUTES=1`.** The Node API always registered the ticket demo routes, including unauthenticated resident-portal ticket writes, on the real API. The UIs' demo paths go to the separate `pemo-demo` server.
- **Security headers** on every response (`nosniff`, `DENY` framing, `no-referrer`, CSP `default-src 'none'`, `no-store`) and a **CORS allow-list** (`PEMO_ALLOWED_ORIGINS`).
- **Rate limiting** per client IP (`PEMO_RATE_LIMIT_PER_MINUTE`, default 600) with a `429` problem.
- **Server timeouts** (header 10 s, read 30 s, write 60 s, idle 120 s, headers ≤ 64 KiB) against slow-client exhaustion.
- **`/ready` no longer returns database driver messages** (host names, users); they are logged.
- **nodemailer, Fastify and fast-uri are gone**, and with them the `pnpm audit` advisories. Mail uses Go's `net/smtp` with STARTTLS / implicit TLS. The SMTP password and URL are redacted from the stored delivery detail.

**Data integrity**

- **Notice acts write their audit row and idempotency record in the same transaction as the act.** The Node build committed them through the access pool in a second transaction, so a crash between the two left an unaudited act or an audit row for an act that rolled back.
- **Case acts do the same.** A staff ticket submit writes the ticket, the idempotency record and the audit row in one helpdesk transaction.
- **Ticket display references are serialised** per organisation with an advisory lock. The Node build counted rows and relied on a unique-constraint failure under concurrency.
- **An unknown reason code on resolve-from-case is a refusal (`invalid-reason`)**, not a 500.
- **Mail outcome classification.** A failure before the message was handed over (`DATA`) is `failed` and safe to retry. After `DATA` it is `unknown` and is never re-sent automatically.

**Performance**

- Audience rows, notice targets and scope rows are written in one statement each (`unnest`), not one `INSERT` per row.
- `GetResidents` uses one query, not one per resident.
- `/ready` checks the pools concurrently.
- One static binary per service: no `tsc`, no `node_modules` at run time. The API starts in milliseconds.

**Flexibility** (settings instead of literals)

| Setting | Replaces |
|---|---|
| `PEMO_TIME_ZONE` (default `Asia/Hong_Kong`) | the `'Asia/Hong_Kong'` literal and the fixed `+08:00` arithmetic in 18 files |
| `PEMO_PAGE_DEFAULT`, `PEMO_PAGE_MAX` | hard-coded page sizes |
| `PEMO_INVOICE_HEADER` | the hard-coded estate name in invoice emails |
| `PEMO_RATE_LIMIT_PER_MINUTE`, `PEMO_ALLOWED_ORIGINS` | (new) |
| `PEMO_MAIL_WORKER=1` | (new) background delivery of queued outbox rows |

**Scalability and operations**

- **Mail worker.** Rows left `queued` (batch limit, or a crash between reserve and claim) are drained in the background. The claim is an atomic `UPDATE`, so several API replicas can run the worker safely.
- **No psql or pnpm needed for operations.** `pemo bootstrap` does what `bootstrap.sh` did (roles, login passwords, migrations, grants, seeds).
- **New CLI commands:** `pemo reseed` (the test harness's reseed), `pemo resident-token [--expired]`, and a Go-aware `pemo verify-boundaries`.
- **Start scripts check every port first** and refuse to start on a taken port (`scripts/dev-up.ps1`, `scripts/dev-up.sh`).
- **The database container is renamed** to `pemo-go-dev-db` (volume `pemo-go-dev-db-data`, compose project `pemo-go-dev`). `docker compose down -v` here can never delete the Node build's database.
- **MCP:** `pemo.list_charges` reads the live `/strata/charges` in live mode; the Node MCP always served the fixture. The default MCP port is 23284, and the server refuses all the reserved ports.

### Fixed after an independent code review (2026-11-21)

- **Header injection in notice emails**: a CR/LF in a notice title could add mail headers (for example `Reply-To`). Header values are now stripped of control characters, and mail carries `Date` and `Message-ID`.
- **Sends survive a closed browser tab**: a claimed message is delivered and its outcome recorded even when the request is cancelled; the mail worker finishes the message it is on before shutting down.
- **Rate limiting behind the dev proxy**: `/health` and `/ready` are never limited. Behind a trusted proxy (`PEMO_TRUSTED_PROXIES`, default loopback) the client from `X-Forwarded-For`, or else the caller's credential, is the bucket, so users behind one proxy no longer share one.
- **Bodies with trailing junk** (`{}}`) are refused with 400, as `JSON.parse` did.
- **An ignored error** in the notice acknowledgements read could panic; it is handled.
- **Case notes and external links** could not be written by the helpdesk login; `010-grants.sql` grants INSERT on exactly those two tables, and the DB test now covers both acts.
- **Racing acknowledgements** with the same key answer as a replay instead of a 500; a **blank `Idempotency-Key`** on a notice response is treated as no key (Node used `""` as a real key shared by all residents).
- The server write timeout is 5 minutes, so an email batch cannot outlive its response.

## 4. Kept exactly as the Node build did it (deliberately)

- Every response body, key order, timestamp format (`+08:00` local with optional milliseconds; JS-style UTC `…Z` with milliseconds), problem type and message.
- One pool and one login per module schema (`pemo_app_<schema>`). `service_case` is written only through its SECURITY DEFINER commands.
- Dev auth token format: an HMAC-signed payload. Tokens are interchangeable with the UI tooling.
- The append-only assertion model, ADR-015 idempotency keying, and refusal semantics (a refused act writes nothing).

## 5. Contract drift inherited from the Node build (not changed)

The Node API produced these too, and the UIs read the wire as it is. Each needs
a product decision on the contract, not a code change:

1. `GET /overview` `recentNotices[].type/state` use the notices vocabulary (`planned_interruption`, `live`), not the contract's enum (`planned-interruption`, `published`). The mapping is not one-to-one; for example, `general` has no counterpart.
2. A `__proto__` body is refused with the interim `…/problems/refused` type, which is not yet in the resident problem registry.
3. `POST /admin/email/test` answers `403` to non-administrators, and the contract does not list `403`.
4. `GET /notices/{id}/delivery` includes `email.recipients`, which the contract schema does not declare.

`tests/go/conformance.py` lists these as `KNOWN_DRIFT`, so a new one shows up as a failure.
The contracts also still use the OpenAPI 3.0 `nullable` keyword in a 3.1 document. The checker treats it as "or null".

## 6. Not ported / follow-up

- **Contract operations that neither build implements** answer 404, as before: management `listSafetyEvents`, `getSafetyEvent`, `…/delivery`, `…/source`, `listCases`, `getUnitDetail`, the HTTP form of `provisionOrganization`, and resident-portal `facilities`. The same applies to the front-counter, lookups, audit-log and integration-status paths the management UI proxies.
- **The Node integration suites** (`tests/node-legacy/integration`) were not rewritten one by one. Their rules are covered at the HTTP level by `tests/go/conformance.py` and, for case acts, by the Go DB test. Porting the remaining suites (grant surface, delegation floors, ADR-015 edge cases, audit provenance) to Go table tests is the next step.
- **`packages/api-contracts` generators** that wrote TypeScript into `apps/api` and `modules/` (notice reasons, notice types, case vocabularies, act operations) have no target now. `backend/internal/api/vocabulary_test.go` checks the Go literals against the same JSON instead.
- **`pnpm-lock.yaml`** still lists the removed workspaces. Run `pnpm install` once (without `--frozen-lockfile`) and commit the pruned lock.
- **`backend/go.mod` replace directives.** `golang.org/x/*` point at their GitHub mirrors and `gopkg.in/*` (test-only dependencies of pgx) at local stubs, because the build sandbox could not reach `proxy.golang.org`. `backend/vendor/` is committed, so builds need no network. On a networked machine you can delete the `replace` lines, run `go mod tidy && go mod vendor`, and get the canonical paths back.
- `docs/governance/bin/prove.sh` drives the Node API's dependency-cruiser battery. It is no longer called from the pre-push hook; `go vet`/`go test` and `pemo verify-boundaries` take its place.
