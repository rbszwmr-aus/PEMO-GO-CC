# Batch C D1 — test run v0.15.1

- Branch: `fix/batch-c-d1` in `~/code/PEMO-grok-wt/batch-c-d1`
- Base: accepted D1 candidate `9a805f6c33dc89eaea0cea4c6496bd52ad3eb5be` (product `da8f856`; independent R&T ACCEPT, no P0/P1)
- Product SHA (all gates): `bc5ecb0523a354e9a3e45a130c2116d6a53e261e`
- Date: 2026-11-20, Australia/Sydney (AEDT, UTC+11)
- Private cluster: PostgreSQL 16, `initdb` under `/tmp/pemo-cd1-r15`, `listen_addresses=''`, unix socket only at `/tmp/pemo-cd1-r15-sock` (outside DATADIR), port 5511 naming the socket file. Shared `127.0.0.1:5432` was not written. Cluster stopped and deleted after the run.

## Changelog

- v0.15.1: declare 503 `communications-unavailable` on the management-web contract (2.6.0 → 2.7.0). Official gates on product SHA `7395c1b`. Closes the interim `addingAType` debt for this type only; `email-send-forbidden` stays undeclared.
- v0.15: follow-ups F-1 through F-5 from independent R&T of `9a805f6`. Every official gate taken on the final product SHA `bc5ecb0`. F-6 left untouched.
- v0.14: first Batch C D1 run note. P3-1, P3-5, and the narrow D1 communications port, with every official gate taken on the final product SHA `da8f856`.

## What landed (R15 follow-ups)

F-2 (real bug): `handleManagementError` maps `CommunicationsUnavailableError` / `isCommunicationsUnavailable` to `staffProblems.communicationsUnavailable()` — 503 `application/problem+json` (`https://pemo.local/problems/communications-unavailable`, retryable). Invoice-email, notice email, and notice delivery no longer surface an unconfigured port as a 500. Focused harness test: swap in `createUnconfiguredCommunicationsPort()` after `startHarness`, then hit the three seeded routes (`chg_wfg_a1_202609`, `ntc_seed_lift`, `stf_wfg_manager`) and expect 503 problem+json. 503 is **not** declared in OpenAPI or `problem-types.json` in this change (a new type is a MINOR bump); recorded as interim debt under `addingAType`.

F-1: there is no worker or scheduled consumer of the communications port in this tree. Deleted `http-adapter.ts` and `worker-adapter.ts`. HTTP routes call `dispatchMailBatch` / `dispatchClaimedMail` directly. Documented in `docs/design/batch-c-d1-communications_v0.2.md` (v0.1 left in place). The existing D1 focused test now calls `dispatchMailBatch` only.

F-3: new `no-ui-imports-backend` rule (`apps/management-web/` must not import `apps/api/` or `modules/`). Proven with a temporary `main.tsx` import of `apps/api/src/wiring.ts` (1 error, rc 1, rule name in the output), then reverted; the tree is green afterwards. Widened `no-mail-orchestration-imports-strata-storage` from `compose-mail.ts` to `apps/api/src/management/`, with `dependencyTypesNot: ['type-only']`. Moved `outboxPresentationStatus` in `compose-strata.ts` to `communications/policy`. Wired `pnpm --filter @pemo/api run check:dependencies` into `.github/workflows/governance.yml` after `verify:boundaries` (local commit, no push).

F-4: the `010-grants.sql` `CREATE OR REPLACE` / `ALTER OWNER` / `REVOKE` of `service_case.open_from_ticket` now runs only when the `service_case` schema and the function already exist. The tight definer `SELECT` on `helpdesk.ticket` was already `IF EXISTS`.

F-5: added `docs/design/rt5-f6-call-sites_v0.4.md` (v0.3 left in place). The `open_from_ticket` row now records the definer `SELECT` on `helpdesk.ticket` used to constrain `organization_id`. The schema USAGE section names that tight grant.

F-6 (invoice smtp-vs-log official-integration failure) was left as known debt.

## Commits since `9a805f6` (product, oldest first)

- `a95d86c3e58e383a2da252605a10e54b5b17ee79` F-2: map `CommunicationsUnavailableError` to 503 problem+json. Test: `tests/integration/batch-c-d1-f2-unavailable.test.ts` (1/1).
- `9c77b65b51fe6b18b6b40db29281242493ba3bf1` F-1: remove unused HTTP/worker communications aliases. Existing D1 test updated (1/1).
- `1ab3f38f7761ae1c4b0aee4563d26c0b0be62b95` F-3: UI-to-backend rule, widen strata rule, CI hook. Prove-then-revert (see below).
- `27dc8c1d32a3db915d0d078ed211a35e20c03b16` F-4: guard 010-grants `open_from_ticket` on schema and function.
- `bc5ecb0523a354e9a3e45a130c2116d6a53e261e` F-5: record definer SELECT on `helpdesk.ticket` in call-sites v0.4.

## F-3 prove-then-revert

Temporary import in `apps/management-web/src/main.tsx` of `apps/api/src/wiring.ts`:

```
  error no-ui-imports-backend: apps/management-web/src/main.tsx → apps/api/src/wiring.ts

x 1 dependency violations (1 errors, 0 warnings). 354 modules, 1412 dependencies cruised.
‼ 2 known violations ignored. Run with --no-ignore-known to see them.
```

Exit status 1. After removing the import, the same command is green (output in the gate table below).

## Exit evidence (`tests/integration/rt5-f6-module-privileges.test.ts` on `bc5ecb0`)

13/13 pass, 0 fail (the accepted 12 plus P3-5):

1. real module logins connect as themselves
2. allowed and denied qualified reads and writes
3. peer and coordinator (definer) SET ROLE are denied
4. named command succeeds; direct access is denied
5. peer logins can call named commands but cannot read or write the command tables
6. cross-estate SQL is denied for foreign schemas; historical recipient rows stay on the notices login
7. strata outbox UPDATE is limited to the six delivery columns
8. pool is reused after a successful transaction and after a rollback
9. aggregate connection capacity stays inside the 90/100 budget
10. forced failure of both case commands leaves no partial state
11. governance detects an unexpected grant and is green when it is revoked
12. rollback of the named-command migrations preserves data
13. case named commands refuse a foreign organization_id (P3-5)

## Focused tests on `bc5ecb0`

- D1 communications policy (`dispatchMailBatch`, fake, unconfigured, strata adapter; one notice and one invoice): 1/1 pass
- F-2 unconfigured port → 503 problem+json on invoice-email, notice email, and notice delivery: 1/1 pass
- P3-1 readiness (existing liveness/all-ports-broken tests plus close-property): 3/3 pass

## Gates (2026-11-20 16:53:13–16:56:31 AEDT, private cluster, every row on `bc5ecb0`)

| Gate | SHA | Result |
|---|---|---|
| management-web `pnpm typecheck` | `bc5ecb0` | PASS, exit 0, 16:53:18 AEDT |
| `apps/api` `pnpm exec tsc -b` | `bc5ecb0` | PASS, exit 0, 16:53:20 AEDT |
| management-web `pnpm run build` | `bc5ecb0` | PASS, exit 0, 16:53:24 AEDT |
| management-web `test:node` | `bc5ecb0` | 401/404 pass, 0 fail, 3 skipped, 16:53:26 AEDT |
| focused D1 + F-2 + P3-1 | `bc5ecb0` | 1/1, 1/1, and 3/3 pass (F-2 at 16:54:30 AEDT) |
| `grants-complete` (`REQUIRE_DB=1`) | `bc5ecb0` | PASS, 16:53:30 AEDT |
| `premise-arm-guard` (`REQUIRE_DB=1`) | `bc5ecb0` | PASS, 16:53:52 AEDT |
| `pnpm run test:contract` | `bc5ecb0` | 116/117, 16:54:21 AEDT. The only failure is the pre-existing `operation-fixture-parity` list of nine operations (same debt as D1 v0.14 / F6 v0.13). |
| F6 exit-evidence tests | `bc5ecb0` | 13/13 pass, 0 fail, 16:54:29 AEDT |
| `pnpm run test:integration` | `bc5ecb0` | 561/571 pass, 10 fail, 16:56:30 AEDT: the known ten only. One new passing test vs D1 v0.14's 560/570 (F-2). |
| `pnpm --filter @pemo/api run check:dependencies` | `bc5ecb0` | PASS, 16:53:21 AEDT (output below) |

### dependency-check output (on `bc5ecb0`)

```
✔ no dependency violations found (354 modules, 1411 dependencies cruised)
‼ 2 known violations ignored. Run with --no-ignore-known to see them.
```

Module/dep counts dropped from v0.14's 356/1416 after deleting the unused HTTP/worker alias files and moving the compose-strata presentation import. The ignored baseline cycles are still `BookingDialog.tsx` ↔ `Bookings.tsx` and `notice-acts.ts` ↔ `notice-permissions.ts`. New cycles and UI → `apps/api` / `modules` imports fail the gate.

## The ten known integration failures

Same ten as D1 v0.14 / F6 v0.13 / Batch B v0.12. F-6 left unfixed.

| # | Test | File | Note |
|---|---|---|---|
| 1 | BITING — database state disappearing after a restart is caught | `biting-tests.test.ts` | Asserts PGDATA is the Docker volume `/var/lib/postgresql/data`; a private initdb does not use that path. |
| 2 | F2 — 0145 keeps historical duplicates; down refuses while pending, sending or unknown rows exist | (F2 clone env) | Same pre-existing clone-env failure. |
| 3–9 | seven seed-count drifts | (seed / occupancy / basis fixtures) | Seeded magnitudes, Novatek, occupancy-without-interest, constructed F1 state, product of the basis, households are not units, corpus-stated fact. |
| 10 | invoice email records a log-transport outbox row when SMTP is unset | `strata-live-reads.test.ts` | Official `pnpm test` uses `--env-file`. A copied gov env can still carry SMTP settings. Unconfigured communications is a typed 503 and is distinct from unset-SMTP log-only. F-6 not addressed here. |

## Deviations

- 503 `communications-unavailable` is implemented and tested but not declared in management OpenAPI or `packages/api-contracts/problem-types.json`. A new type is a MINOR bump under ADR-008 and would require generating the Problem.type enum and either a fixture or `emittedOnlyBy`. This is interim debt under `addingAType` (same shape as existing undeclared staff mail types such as `email-send-forbidden`). To be folded in at the next contract change.
- F-1 deleted the unused alias files rather than inventing a worker path; documented in comms v0.2.
- `check:dependencies` module counts changed (354/1411 vs 356/1416) for the reasons above; not a new cycle.
- Official contract and integration commands exit non-zero because of the known debt / known ten, same as v0.14.
- `docs/design/rt5-f6-call-sites_v0.3.md` and `batch-c-d1-communications_v0.1.md` were left in place; v0.4 and v0.2 are the current notes.
- Event outbox (`platform.enqueue_outbox_message` / `platform.outbox_message`) and R9 were not touched.
- Journey and adapted-privilege reruns from F6 v0.13 were not part of this brief and were not re-run.
- `fix/rt5-f6-module-privileges` (`b07e6dc`, clean) and `fix/p1-review-r1-r3` (`b4fe994`, clean) were not modified. Live :3200 (pid 121988) / :5185 (3035582) / :5186 (3035711) were not restarted. No push.

## Deferred (named, not fixed in this run)

- F-6: invoice smtp-vs-log official-integration failure
- Contract declaration of 503 `communications-unavailable` (MINOR bump)
- N2: empty `limit=` means default
- N3: `/notices` unbounded (notice-paging deferral)
- Physical relocation of `strata.email_outbox` (after-MVP)
- R9 / Surfaces, F6 P3-2 / P3-3 / P4, the known ten, Playwright, remainder of Batch C

## Addendum v0.15.1 (2026-11-20, Australia/Sydney AEDT)

Product SHA: `7395c1bf6bbd9a39df2c475bed22f8808456b7ca` (all gates below).

Management-web contract **2.6.0 → 2.7.0**. `communications-unavailable` is now in `problem-types.json` (`emittedOnlyBy` `sendStrataChargeInvoiceEmail`, `getNoticeEmailDelivery`, `sendNoticeEmail`), declared as 503 on those three operations, fixtured at `tests/fixtures/management-web/problems/communications-unavailable.json`, with generated Problem enum, stamped fixture versions, corpus generate + digest, contract-lock (`contract-hash --write`), and a one-line changelog in `packages/api-contracts/management-web/CHANGELOG.md`.

The interim `addingAType` debt for `communications-unavailable` recorded in v0.15 is closed. `email-send-forbidden` remains an undeclared staff mail type and was not added to the registry or debt lists.

Two product commits after `219683f`: `dc8c085` (declaration, fixture, digest/generate, stamp) and `7395c1b` (restamp `contract-lock.json`; `REFUSED_SUBJECT` supplies `chargeId` for the Problem fixture). A first gate run on `dc8c085` failed the lock version check and `every management fixture states its own request`; those are fixed in `7395c1b`. Cannot amend `dc8c085` (no worktree reset).

### Gates (2026-11-20 17:17:44–17:21:11 AEDT, private cluster `/tmp/pemo-cd1-r151b`, every row on `7395c1b`)

| Gate | SHA | Result |
|---|---|---|
| management-web `pnpm typecheck` | `7395c1b` | PASS, 17:17:49 AEDT |
| `apps/api` `pnpm exec tsc -b` | `7395c1b` | PASS, 17:17:50 AEDT |
| management-web `pnpm run build` | `7395c1b` | PASS, 17:17:54 AEDT |
| management-web `test:node` | `7395c1b` | 401/404 pass, 0 fail, 3 skipped, 17:17:55 AEDT |
| focused D1 + F-2 + P3-1 | `7395c1b` | 1/1, 1/1, and 3/3 pass, 17:17:51 / 17:19:01 AEDT |
| `grants-complete` (`REQUIRE_DB=1`) | `7395c1b` | PASS, 17:17:59 AEDT |
| `premise-arm-guard` (`REQUIRE_DB=1`) | `7395c1b` | PASS, 17:18:21 AEDT |
| `pnpm run test:contract` | `7395c1b` | 116/117, 17:18:51 AEDT. The only failure is the pre-existing `operation-fixture-parity` list (now eight uncovered operations; `sendStrataChargeInvoiceEmail` is covered by the new 503 fixture). |
| F6 exit-evidence tests | `7395c1b` | 13/13 pass, 17:19:00 AEDT |
| `pnpm run test:integration` | `7395c1b` | 561/571 pass, 10 fail: the known ten only, 17:21:11 AEDT |
| `pnpm --filter @pemo/api run check:dependencies` | `7395c1b` | PASS, 17:17:51 AEDT |

```
✔ no dependency violations found (354 modules, 1411 dependencies cruised)
‼ 2 known violations ignored. Run with --no-ignore-known to see them.
```

Private cluster deleted. `fix/rt5-f6-module-privileges` (`b07e6dc`) and `fix/p1-review-r1-r3` (`b4fe994`) unchanged. Live :3200 / :5185 / :5186 not restarted. No push.
