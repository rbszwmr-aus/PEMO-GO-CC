# Contracts

Lane notes that freeze or propose Surfaces ↔ Backend shapes, plus the platform module-entitlements contract.

- [PEMO MCP server (v0)](pemo-mcp-server.md) — isolated read MCP for agents (`:3201`). Dual-buy = attach this **and** ParkCore’s MCP; not a mega-MCP.
- [Platform module entitlements (SSO + dual-module RBAC)](platform-module-entitlements.md) — locked doctrine 2026-09-21; all current and future modules. ParkCore claims frozen (`parkcore_actions` + optional `parkcore_role`); JWKS/`aud` cite is car-park `docs/contracts/platform-sso-jwks-parkcore.md` (`PARKCORE_OIDC_AUDIENCE=parkcore`). Other modules’ field names still PROPOSAL.
- [Alias: PEMO ↔ ParkCore](pemo-parkcore-entitlements.md) — pointer only; do not fork doctrine here
- [Shared QR Pass Service v0 (FROZEN 0.1.0)](qr-pass-service-v0.md) — platform signed/expiring QR passes (PAYMENT, VISITOR_ACCESS), offline verify via JWKS, revocation list, scan log; frozen 0.1.0 2026-09-25, D1–D8 locked.
- [Management-web v0 freeze](management-web-v0-freeze.md)
- [Management-web v0 strata + notices live](management-web-v0-strata-notices-live.md)
- [Management-web / resident-portal v0 tickets Help desk demo](management-web-v0-tickets-helpdesk-demo.md)
- [Resident-portal v0 invoices demo (read-only)](resident-portal-v0-invoices-demo.md) — in-memory on tickets-demo `:3200`; integer HKD; `pdfUrl` always `null`
- [Proposed help-desk reads](proposed-helpdesk-read-ops.md)
- [Proposed households reads](proposed-households-read-ops.md)
- [Proposed residents reads](proposed-residents-read-ops.md)
- [Proposed household contact email](proposed-household-contact-email.md)
