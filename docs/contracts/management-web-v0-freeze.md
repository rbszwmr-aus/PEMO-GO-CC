# Management-web Surfaces-Backend v0 freeze

**Status:** FROZEN + helpdesk read amend (PEMO-grok master, 2026-09-07)
**Lane:** PEMO-grok only (/home/luipt/code/PEMO-grok, github.com/rbszwmr-aus/PEMO-grok)
**Do not widen** paths beyond this note until a new brief.

## Runtime (amd128)

| Role | Bind |
|------|------|
| management-web Vite | 0.0.0.0:5175 → LAN http://192.168.0.134:5175/ |
| API | 0.0.0.0:3200 → LAN http://192.168.0.134:3200/ |
| DB | pemo_grok @ 127.0.0.1:5432 |

Dev proxy: when PEMO_LIVE_BASE_URL=http://127.0.0.1:3200 is set, Vite forwards only:

- /api/management-web/v0/scope
- /api/management-web/v0/properties/tree
- /api/management-web/v0/helpdesk/queue
- /api/management-web/v0/helpdesk/contacts/*

## UI live switch

- Live: ?source=live&token=<staff-bearer> (optional api=; empty/omitted = same-origin / Vite proxy)
- Fixture (default): omit source=live — corpus remains default; do not invent empty trees

Example Properties paint:

http://192.168.0.134:5175/?source=live&screen=s3&lang=zh-Hant&token=<bearer>


## Help desk read proof (2026-09-07)

amd128 API :3200 @ 96caed2: staff Bearer → GET helpdesk/queue and GET helpdesk/contacts/tkt_seed_a → **200**, `contractVersion` **2.4.0**. Backend compose returns fixture/UI chrome (Surfaces normalizes chrome wire; domain map retained). Vite :5175 `dev:live` proxies both paths. Fixture remains default without `source=live`. Residents stay fixture-only.

## Frozen paths

1. GET /health → { status, service }
2. GET /ready → { ready, dependencies: [{ name, ok }] }
3. GET /api/management-web/v0/scope → ScopeTreeResponse or problem
4. GET /api/management-web/v0/properties/tree → PropertyTreeResponse or problem
5. GET /api/management-web/v0/helpdesk/queue → HelpdeskQueueResponse or problem
6. GET /api/management-web/v0/helpdesk/contacts/{contactId} → HelpdeskContactDetailResponse or problem

Out of freeze: Residents/Visitors reads, notices GETs/acts, and other management-web operations not listed above.

## Auth

- Header: Authorization: Bearer <staff-token>
- Dev mint (amd128): cd /home/luipt/code/PEMO-grok/apps/api && node --env-file=../../database/dev/.env dist/cli/dev-token.js stf_wfg_manager
- Or from repo root: package-manager --filter @pemo/api dev-token stf_wfg_manager
- Demo principal for proof: stf_wfg_manager (Wing Fu Garden / est_wing_fu_garden)
- Missing/invalid token → 401 problem (never a fabricated empty 200 tree)
- TTL: PEMO_DEV_TOKEN_TTL_SECONDS (typically 3600)

## Error shape (application/problem+json)

Observed live fields: type, title, status, correlationId, staffMessage { en, zh-Hant }, retryable. Optional detail allowed by client type.

Example type URI: https://pemo.local/problems/invalid-credential

## Success payloads (live proof, contractVersion 2.3.0)

### ScopeTreeResponse

- meta: { correlationId, contractVersion, generatedAt }
- grants: ScopeRef[] — proof: [{ kind: estate, id: est_wing_fu_garden }]
- nodes: ScopeTreeNode[] — proof count 926 (estate1, building3, floor102, unit812, location8)

### PropertyTreeResponse

- meta: same as scope
- nodes: ScopeTreeNode[] — proof count 918 (estate1, building3, floor102, unit812); no grants key

### ScopeTreeNode

- node: { kind, id }
- parent: { kind, id } | null
- label: { en, zh-Hant }
- depth: number
- counts: { units, occupied, vacant }
- permittedActions: string[] — proof: [composeNotice]

### ScopeRef

- { kind, id }

## Proof snapshot

- Surfaces: Vite :5175 + PEMO_LIVE_BASE_URL proxy
- Backend: API :3200 health/ready green; scope + tree 200 with Bearer
- Master: FREEZE ACK on this exact proof + payload shapes (2026-09-06)

### HelpdeskQueueResponse (contractVersion 2.4.0+)

- meta: { correlationId, contractVersion, generatedAt }
- stats: HelpdeskStat[] — waiting / answered / raised / office hours
- rows: HelpdeskQueueRow[] — channel app|phone|counter; state waiting|in_progress|overdue|closed

### HelpdeskContactDetailResponse

- meta: same
- contact: detail with timeline from ticket_message, linkedCaseRef opaque|null, disposition from ticket fields

