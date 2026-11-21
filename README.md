# PEMO — Go build

The same PEMO product — staff management web, resident portal, resident mobile
(Flutter), and every API they call — with the backend rewritten from Node.js
(Fastify + pg) to **Go** (net/http + pgx). The UIs, the database schema,
migrations, seeds, contracts and fixtures are unchanged; the API answers the
same routes with the same bodies (the 69 resident fixtures match byte for byte).

What changed and why: [`docs/go-migration/MIGRATION-NOTES.md`](docs/go-migration/MIGRATION-NOTES.md).

## Layout

| Path | What |
|---|---|
| `backend/` | Go module `pemo`: the API, the CLI, the demo server, the MCP server |
| `backend/cmd/pemo-api` | the PEMO API (was `apps/api`) |
| `backend/cmd/pemo` | operator CLI: `bootstrap`, `migrate`, `seed`, `reseed`, `dev-token`, `resident-token`, `provision-organization`, `verify-boundaries` |
| `backend/cmd/pemo-demo` | in-memory demo server: help-desk tickets, invoices, notices/visitors, QR passes (was `tickets-demo-server`) |
| `backend/cmd/pemo-mcp` | management read MCP, HTTP+SSE or stdio (was `apps/mcp-server`) |
| `backend/internal/*` | one package per module schema (`property`, `access`, `resident`, `homesafety`, `notices`, `helpdesk`, `strata`, `integration`) + `platform`, `api`, `caseacts`, `demo`, `mcp` |
| `apps/management-web`, `apps/resident-portal` | React + Vite UIs (unchanged apart from ports) |
| `apps/resident-mobile` | Flutter app (unchanged) |
| `packages/` | contracts (OpenAPI) and the demo-store TypeScript the UIs import as types |
| `database/` | roles, migrations, seeds, dev compose file |
| `tests/go/` | conformance, fixture parity, side-by-side comparison with the Node API |
| `tests/node-legacy/` | the Node suites, kept as the behavioural spec |

## Ports — chosen so nothing collides with other projects

| Service | Port | Note |
|---|---|---|
| PostgreSQL (docker `pemo-go-dev-db`) | **25480** | Node build uses 55433; host Postgres 5432 untouched |
| API `pemo-api` | **23280** | Node build used 8080 / 3200 |
| management-web (Vite) | **23281** | was 5175 |
| resident-portal (Vite) | **23282** | was 5176 |
| demo server `pemo-demo` | **23283** | was 3200 |
| MCP `pemo-mcp` | **23284** | was 3201 |

Never used: 3100, 3200, 3201, 3210, 3300, 5173–5177, 5179, 5185, 5186, 5432,
8080, 55432–55434, 18120, 18121. Every start script checks its ports first and
**refuses to start** if one is taken; it never stops another process.
Ports live in `scripts/ports.env`.

## Run it

Needs Go ≥ 1.24 (or the prebuilt `backend/bin/*.exe`), Docker for the database,
and Node ≥ 22 + pnpm only for the web UIs.

```powershell
# Windows (PowerShell), from the repository root
copy database\dev\.env.example database\dev\.env        # set the passwords in it
docker compose --env-file database\dev\.env -f database\dev\docker-compose.yml up -d
cd backend; go build -o bin\ ./cmd/...; cd ..             # or use the shipped bin\*.exe
backend\bin\pemo.exe bootstrap --with-seed               # roles, migrations, grants, seeds
powershell -ExecutionPolicy Bypass -File scripts\dev-up.ps1   # API, demo server, both UIs
```

```bash
# Linux / macOS
cp database/dev/.env.example database/dev/.env
docker compose --env-file database/dev/.env -f database/dev/docker-compose.yml up -d
database/bootstrap.sh --with-seed
scripts/dev-up.sh            # --no-ui for the backend only, --stop to stop
```

Then open http://127.0.0.1:23281 (management) and http://127.0.0.1:23282 (portal).
Live mode for the management UI: `pnpm -C apps/management-web dev:live` with a
token from `backend/bin/pemo dev-token stf_wfg_manager`.

MCP: `backend/bin/pemo-mcp` (HTTP on 23284) or `pemo-mcp -stdio`;
`PEMO_MCP_MODE=live PEMO_STAFF_TOKEN=… ` reads the API.

## Check it

```bash
tests/go/run-all.sh   # go vet + unit tests + DB tests + boundaries + fixture parity + OpenAPI conformance
```

Against the Node build on the same seeds (e.g. on the AMD box):
`python3 tests/go/compare_with_node.py --node http://127.0.0.1:8080 --node-secret … --go http://127.0.0.1:23280 --go-secret …`
