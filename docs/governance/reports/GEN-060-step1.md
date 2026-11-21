# GEN-060 — the genesis is off the public surface (step 1)

**PID:** GEN-060 (branch `codex/gen-060`, worktree off `225021a`)
**Date (UTC):** 2026-09-04
**Status:** author-complete; awaiting the step ruling before merge.

## The exposure, and for how long it existed

`provision()` creates an organization's first `grant_administrator` — the one act with no acting
principal (ADR-010 A1), because the first grant cannot require a grant. That invariant is correct.
Its EXPOSURE was not: the act was reachable over the customer-facing HTTP surface at
`POST /api/management-web/v0/organizations/:organizationId/provision`, registered UNCONDITIONALLY,
the ONLY route not behind `authenticateStaff`, guarded solely by zero-grants-ever. Between an
organization row existing and its provisioning, anyone who could reach the surface and knew or
guessed the org id could become its administrator — permanently, because zero-grants-ever then locks
the real customer out.

**How long:** the route has existed since the provisioning act shipped (W2, the genesis batch). Its
real-world reach was bounded by one fact that must be stated so the exposure is not overstated: **this
entire build is development-only.** `loadConfig()` throws unless `PEMO_ENV === 'development'` (the
build carries a development-only auth stub and fault seam), so there is no production deployment today
and the route was reachable only in a development/CI posture. The exposure was therefore latent — real
for any shared dev/staging surface, and a going-live blocker the moment a production posture is added —
which is why it is fixed now, before that posture exists, rather than after.

## The chosen shape — (a) + (b) + (d)

**The public HTTP genesis route is REMOVED; genesis is an operator act on the host; zero-grants-ever
stays the inner guard.** Chosen over the one-time-secret HTTP option (c) because genesis is an
operator action, not customer self-serve: a property-management system's first administrator is
created by whoever deploys it, on the host, holding the database credentials — exactly the trust
boundary `dev-token` uses. Removing the surface eliminates the exposure rather than papering it.

- **`apps/api/src/management/genesis.ts`** — `provisionOrganization(deps, input)`, the orchestration
  lifted verbatim from the old route (derived keys, `idempotentAuditedWrite`, `provision()`,
  `[genesis-exempt-from-idempotency]`), returning a plain `GenesisOutcome` (`provisioned` / `replayed`
  / `refused`) with no transport. The zero-grants-ever predicate inside `provision()` is untouched.
- **`apps/api/src/cli/provision-organization.ts`** — the operator CLI, modelled on `dev-token`:
  `node dist/cli/provision-organization.js <orgId> <externalId> <displayName> <groupName> [reasonCode]`,
  run where the server runs, wiring `accessDb` + `createGrantCommands` and calling the act.
- **`apps/api/src/server.ts`** — the route registration is DELETED, with a comment where it stood
  explaining the exposure and where genesis lives now.
- **`apps/api/src/testing/provision-organization.ts`** — `provisionForTest(harness, input)`, so tests
  exercise the real act (and the real guard) without a transport that no longer exists.
- Tests migrated off `app.inject(...provision)`: `delegation-floors.test.ts` and the provisioning
  section of `grant-surface.test.ts` (GENESIS, second-provision-refused, refused-writes-no-audit) —
  the HTTP-shape assertions became act-outcome + direct DB assertions, unchanged in what they prove.

## Bites (requirement (e))

- **The public route no longer provisions:** `[probe-must-bite]` in `grant-surface.test.ts` — a POST
  to the old provision URL returns **404** (the route does not exist; re-introducing any HTTP genesis
  path reds it).
- **The operator path DOES provision:** the GENESIS test — `provisionForTest` takes an org from zero
  authority to exactly one effective administrator (principal + group + grant + membership).
- **A second attempt is still refused by the invariant:** the second-provision test (idempotency
  conflict on the derived key) and the refused-writes-no-audit test (zero-grants-ever refuses inside
  the act; nothing is audited and the key is not burned).

These are integration-level guards rather than a single-line manifest mutation, because the change is
a security REMOVAL plus a refactor, not a new predicate; the zero-grants-ever predicate they exercise
is unchanged.

## Cross-track note (not edited here)

`management-web` carries `provisionOrganization` only as a member of a generated act-operations enum
(`src/data/types.ts`) and an i18n message — there is no genesis UI. Flagged for UI CC: the operation
is no longer an HTTP surface, so if any management-web flow references it, it is dead. No management-web
file is edited by this PID.

## Verification

`verify:boundaries` PASS; `delegation-floors` + `grant-surface` 49/49 including the route-gone bite.
Full local register set (`pnpm --filter @pemo/api test` incl. the contract suites) running before push.
