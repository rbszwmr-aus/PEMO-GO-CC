# Surfaces coord — Residents slice (2026-09-06 PT)

Agent: PEMO-grok Surfaces / Residents
Isolation: `/home/luipt/code/PEMO-grok` only · ports `:5175` / `:3200`

## Done

- Rail `prop-residents` → ScreenId `residents` / `residentsDetail` (fixture list→detail)
- UI fixtures: `apps/management-web/src/data/residents-fixtures/{list,detail,empty}.json`
- Contract amend proposal: `docs/contracts/proposed-residents-read-ops.md`
- No live API; no OpenAPI edit; design-ref HTML not committed

## Sibling lanes (do not block)

- Visitors (`visitor`) — sibling extracting design; leave alone
- Households (`prop-households`) — still Coming Soon unless a sibling owns it

## LAN check

- Fixture: `http://192.168.0.134:5175/?screen=prop-residents&lang=zh-Hant`
- Or: `http://192.168.0.134:5175/?screen=residents&state=list&lang=en`
- Detail: `http://192.168.0.134:5175/?screen=residentsDetail&state=detail&resident=res_wfg_000412`
- Live: not applicable for Residents (v0 freeze = scope/tree only)
