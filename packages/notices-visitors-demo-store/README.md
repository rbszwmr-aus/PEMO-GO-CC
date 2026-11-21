# @pemo/notices-visitors-demo-store

In-memory demo notices + visitors for resident-portal round-trip. Pure TypeScript
(no React, no pg). Freeze:
`docs/contracts/resident-portal-v0-notices-visitors-demo.md`.

Opaque ids: `ntc_…`, `vis_…`. Process singleton via `getDemoNoticeStore()` /
`getDemoVisitorStore()`. Restart of `dev:tickets-demo` wipes seed + mutations.
