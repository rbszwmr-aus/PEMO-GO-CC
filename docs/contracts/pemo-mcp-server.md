# PEMO MCP server (v0)

**Status:** PROPOSAL (runnable v0 in `apps/mcp-server`)
**Lane:** PEMO-grok only (`github.com/rbszwmr-aus/PEMO-grok`)
**Related:** [management-web v0 freeze](management-web-v0-freeze.md), [platform module entitlements](platform-module-entitlements.md)

Thin MCP server for **PEMO management reads**, so agents (Grok Bot / Cursor) can call the same staff-Bearer surface as the management API. It is **not** the product API, **not** ParkCore, and **not** a shared mega-MCP.

`@modelcontextprotocol/sdk` is **not** a workspace dependency today (no ADR to add that runtime). v0 is a **minimal Node** JSON-RPC MCP over **stdio** and **SSE / streamable HTTP**, using Node built-ins only.

## Isolation vs ParkCore MCP

ParkCore has its own MCP. PEMO must not collapse into it.

| Rule | v0 |
|---|---|
| Process | Own package `apps/mcp-server` (`@pemo/mcp-server`). No import of ParkCore. No HTTP call to ParkCore (`:5177` / `:3300`). |
| Ports | PEMO MCP **`:3201`**. Do **not** bind `:3200` (PEMO API), `:5175` (PEMO Vite), `:3300` / `:5177` (ParkCore). Do **not** mount under `:3200/mcp`. |
| Auth / DB | Staff Bearer is the same *shape* as PEMO API. This process does **not** share ParkCore’s user table or Postgres. |
| Tools | `pemo.*` read tools only. No `parkcore.*` tools, no write tools, no embedding. |

**Dual-buy = attach both.** When a sale includes PEMO and ParkCore, the agent host (Cursor / Grok Bot) is configured with **two** MCP servers — PEMO on `:3201` (or PEMO stdio) **and** ParkCore’s own MCP. That is how dual-buy works for agents: two attachments, not one merged catalogue.

## Ports

| Surface | Bind | Role |
|---|---|---|
| PEMO management-web | `:5175` | Staff SPA |
| PEMO API | `:3200` | Management + resident HTTP |
| **PEMO MCP (this)** | **`:3201`** | Agent MCP (HTTP JSON-RPC + SSE) |
| ParkCore UI | `:5177` | Sibling product — do not use |
| ParkCore API | `:3300` | Sibling product — do not use |

- Process liveness (no staff token): `GET http://127.0.0.1:3201/health` → `{ status, service: "pemo-mcp" }`
- Streamable HTTP: `POST http://127.0.0.1:3201/mcp`
- Legacy SSE: `GET http://127.0.0.1:3201/sse` then `POST /messages?sessionId=…`
- Stdio: `node apps/mcp-server/dist/stdio.js` (Content-Length framing)

Env: `PEMO_MCP_HOST` (default `127.0.0.1`), `PEMO_MCP_PORT` (default `3201`).

## Auth

Same header as the management API:

```
Authorization: Bearer <staff token>
```

- **Reject without** on `tools/list` and `tools/call` (JSON-RPC `-32001` / HTTP 401 body). Handshake methods (`initialize`, `notifications/initialized`, `ping`) do not require a token so the client can complete MCP initialize.
- Stdio: pass the token as `PEMO_STAFF_TOKEN` (the process prefixes `Bearer `). Missing token → tools refused, not a fabricated catalogue.
- Dev mint (unchanged): `pnpm -C apps/api dev-token stf_wfg_manager` — development only.
- Invalid tokens are not distinguished from absent tokens in the MCP error payload (no probing oracle). Live mode forwards the header to `:3200`; the API remains the verifier.
- **Later (not v0):** gate tools by `pemo_features` claims once PEMO Backend freezes that field (see platform-module-entitlements). v0 does not parse JWT claims.

## Fixture vs live

`PEMO_MCP_MODE=fixture` (default) | `live`

Every tool result is JSON with an explicit envelope:

```json
{
  "mode": "fixture",
  "source": "apps/mcp-server fixtures: health",
  "liveUnavailable": false,
  "reason": null,
  "data": {}
}
```

| Tool | Fixture | Live (`PEMO_API_BASE_URL`, default `http://127.0.0.1:3200`) |
|---|---|---|
| `pemo.get_health` | MCP stand-in `{ status, service: "pemo" }` | `GET /health` |
| `pemo.get_scope_tree` | Slim Wing Fu Garden tree | `GET /api/management-web/v0/scope` |
| `pemo.list_notices` | Slim notice list | `GET /api/management-web/v0/notices` |
| `pemo.list_households` | Slim household list | **Not on v0 freeze** — stays fixture; `liveUnavailable: true` |
| `pemo.list_charges` | Slim management-fee charges | **No finance GET** — stays fixture; `liveUnavailable: true` |

Live transport/problem failures are returned as tool errors (`isError: true`) with the problem JSON. They are **not** replaced by an empty fixture list.

## Tools (v0, reads only)

No write tools. Input schemas are empty objects.

| Name | Returns |
|---|---|
| `pemo.get_health` | API liveness payload in the envelope |
| `pemo.get_scope_tree` | Scope grants + nodes (slim fixture; live is the API tree) |
| `pemo.list_households` | Household list rows |
| `pemo.list_notices` | Staff notice list rows |
| `pemo.list_charges` | Management-fee charge rows (ParkCore parking fees out of scope) |

## Non-goals

- Write tools, ParkCore tools, embedding, shared user DB
- Mounting MCP on the PEMO API process (`:3200/mcp`)
- Adding `@modelcontextprotocol/sdk` until an ADR names it

## Cursor / Grok Bot

See `apps/mcp-server/README.md` and `apps/mcp-server/cursor-mcp.example.json`.
