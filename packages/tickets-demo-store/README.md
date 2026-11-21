# @pemo/tickets-demo-store

In-memory demo ticket store for resident-portal ↔ management-web Help desk
round-trip. Pure TypeScript (no React, no pg). Owned with the freeze at
`docs/contracts/management-web-v0-tickets-helpdesk-demo.md`.

## Status vocabulary

`open | triaged | in_progress | awaiting_resident | resolved | closed`

Assign is **not** a status — it is `assignedAdminId` + `assignedAdminLabel`.

Opaque ids: `tkt_…` (contact id === ticket id).

## Singleton

`getDemoTicketStore()` is a process singleton. Cross-app coherence requires both
apps to call thin demo routes on API `:3200`, which holds this store.

## Vite apps

Do **not** add this package to app `package.json` dependencies (React allowlist).
Wire a Vite `resolve.alias` to `packages/tickets-demo-store/src/index.ts` if UIs
need types/adapters locally.
