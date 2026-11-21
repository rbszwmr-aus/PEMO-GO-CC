# Batch C D1 — test run v0.14

- Branch: `fix/batch-c-d1` in `~/code/PEMO-grok-wt/batch-c-d1`
- Base: `b07e6dcd4ed12b5bc77b10512deb5448445faebd` (`fix/rt5-f6-module-privileges`, accepted RT5-F6)
- Product SHA (all gates): `da8f85673672dea7a10dab687426ec0dbc96a5e4`
- Date: 2026-11-20, Australia/Sydney (AEDT, UTC+11)
- Private cluster: PostgreSQL 16, `initdb` under `/tmp/pemo-cd1`, `listen_addresses=''`, unix socket only at `/tmp/pemo-cd1-sock` (outside DATADIR), port 5509 naming the socket file. Shared `127.0.0.1:5432` was not written. Cluster stopped and deleted after the run.

## Changelog

- v0.14: first Batch C D1 run note. P3-1, P3-5, and the narrow D1 communications port, with every official gate taken on the final product SHA `da8f856`.

## What landed

P3-1: `/ready` probes every module pool wiring keeps open (including `noticesDb`, now on the `Modules` surface via `modulePools()`). `/health` stays liveness-only. Closing a non-platform pool (property) fails ready with 503 while `/health` stays 200. A failed probe keeps the pool's name.

P3-5: `append_assertion` refuses a foreign `organization_id` against the existing service_case row (migration `0150`). `open_from_ticket` does the same against the originating `helpdesk.ticket`, installed next to the tight definer `SELECT` grant in `database/roles/010-grants.sql` because the migration runner forbids a `service_case` file from naming another module schema. App-layer org checks stay. Helpdesk remains the only `EXECUTE` grantee.

D1: notice and invoice send/query/resend go through a narrow application-layer communications port (`apps/api/src/communications`). A compatibility adapter retains `strata.email_outbox`. HTTP and worker adapters share one claim-and-dispatch policy; fake and unconfigured adapters expose the same command surface. Unconfigured returns typed `CommunicationsUnavailableError`, not a silent no-op. `compose-mail` no longer imports `@pemo/strata` or `modules.strataOutbox`. Charge and notice content still use the existing query ports. Event outbox and R9 are out of scope.

`pnpm --filter @pemo/api run check:dependencies` (also `pnpm run check:dependencies` at the repo root) fails on new cycles and on UI / management-web imports into the API or domain modules. Two pre-existing cycles are baselined in `apps/api/.dependency-cruiser-known-violations.json`.

Recovery note: `docs/design/batch-c-d1-communications_v0.1.md`. Call-site crossing: `docs/design/rt5-f6-call-sites_v0.3.md` (v0.2 left in place).

## Commits since `b07e6dc` (product, oldest first)

- `a5bfc3d50b93955c56b7e639eebe17a56925d706` P3-1: `/ready` probes every module pool.
- `d8c7d26e0732f48945a0e82f2028851aa3f1b4bb` P3-5: case SQL commands constrain `organization_id`.
- `184052c6508e70a424b338578b1a389cb6b5cc16` D1: communications port for notices and invoices.
- `6a704592eacedf9a34ebf0fc948cbacb99bf440f` P3-5/D1: keep service_case migrations in-schema; baseline existing cycles.
- `6300a0049a139e40dad77f12d7b12b939fdf47ca` P3-1: do not end a module pool twice after the readiness probe.
- `da8f85673672dea7a10dab687426ec0dbc96a5e4` P3-1: keep the pool name when a readiness probe fails.

## Exit evidence (`tests/integration/rt5-f6-module-privileges.test.ts` on `da8f856`)

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

The existing open_from_ticket plant in item 4 now uses a seeded Wing Fu ticket, because the command refuses a synthetic ticket id.

## Focused tests on `da8f856`

- D1 communications policy (HTTP, worker, fake, unconfigured, strata adapter; one notice and one invoice): 1/1 pass
- P3-1 readiness (existing liveness/all-ports-broken tests plus close-property): 3/3 pass

## Gates (2026-11-20 16:09:56–16:13:04 AEDT, private cluster, every row on `da8f856`)

| Gate | SHA | Result |
|---|---|---|
| management-web `pnpm typecheck` | `da8f856` | PASS, exit 0 |
| `apps/api` `pnpm exec tsc -b` | `da8f856` | PASS, exit 0 |
| management-web `pnpm run build` | `da8f856` | PASS, exit 0 |
| management-web `test:node` | `da8f856` | 401/404 pass, 0 fail, 3 skipped |
| focused D1 + P3-1 | `da8f856` | 1/1 and 3/3 pass |
| `grants-complete` (`REQUIRE_DB=1`, definer `SELECT` on `helpdesk.ticket`) | `da8f856` | PASS |
| `premise-arm-guard` (`REQUIRE_DB=1`) | `da8f856` | PASS |
| `pnpm run test:contract` | `da8f856` | 116/117. The only failure is the pre-existing `operation-fixture-parity` list of nine operations (same debt as F6 v0.13). |
| F6 exit-evidence tests | `da8f856` | 13/13 pass, 0 fail (12/12 original plus P3-5) |
| `pnpm run test:integration` | `da8f856` | 560/570 pass, 10 fail: the known ten only (see below). Three new tests vs F6's 567: P3-1, P3-5, and D1 communications. |
| `pnpm --filter @pemo/api run check:dependencies` | `da8f856` | PASS (output below) |

### dependency-check output (on `da8f856`)

```
✔ no dependency violations found (356 modules, 1416 dependencies cruised)
‼ 2 known violations ignored. Run with --no-ignore-known to see them.
```

The ignored baseline cycles are `BookingDialog.tsx` ↔ `Bookings.tsx` and `notice-acts.ts` ↔ `notice-permissions.ts`. New cycles and UI → backend imports still fail the gate.

## The ten known integration failures

Same ten as F6 v0.13 / Batch B v0.12. Not fixed here.

| # | Test | File | Note |
|---|---|---|---|
| 1 | BITING — database state disappearing after a restart is caught | `biting-tests.test.ts` | Asserts PGDATA is the Docker volume `/var/lib/postgresql/data`; a private initdb does not use that path. |
| 2 | F2 — 0145 keeps historical duplicates; down refuses while pending, sending or unknown rows exist | (F2 clone env) | Same pre-existing clone-env failure. |
| 3–9 | seven seed-count drifts | (seed / occupancy / basis fixtures) | Seeded magnitudes, Novatek, occupancy-without-interest, constructed F1 state, product of the basis, households are not units, corpus-stated fact. |
| 10 | invoice email records a log-transport outbox row when SMTP is unset | `strata-live-reads.test.ts` | Official `pnpm test` uses `--env-file`. A copied gov env can still carry SMTP settings. Unconfigured communications is a typed unavailable error and is distinct from unset-SMTP log-only. |

## Deviations

- `open_from_ticket`'s originating-ticket org check is installed in `010-grants.sql`, not in `0150`, because `assertSchemaOwnership` rejects a `service_case` migration that names `helpdesk`. The tight definer `SELECT` on `helpdesk.ticket` is in the same file. `append_assertion` stays in `0150` (same schema).
- `check:dependencies` baselines the two pre-existing cycles above rather than failing the tree on them. The gate still blocks new cycles and UI → backend imports.
- F6 exit evidence is reported as 13/13 because P3-5 was added to the same file; the original twelve still pass.
- Official contract and integration commands exit non-zero because of the known debt / known ten, same as F6 v0.13.
- `docs/design/rt5-f6-call-sites_v0.2.md` was left in place; v0.3 adds the D1 crossing row.
- Event outbox (`platform.enqueue_outbox_message` / `platform.outbox_message`) and R9 were not touched.
- Journey and adapted-privilege reruns from F6 v0.13 were not part of this brief and were not re-run.
- `fix/rt5-f6-module-privileges` (`b07e6dc`, clean) and `fix/p1-review-r1-r3` (`b4fe994`, clean) were not modified. Live :3200 / :5185 / :5186 were not restarted.

## Deferred (named, not fixed in this run)

- N2: empty `limit=` means default
- N3: `/notices` unbounded (notice-paging deferral)
- Physical relocation of `strata.email_outbox` (after-MVP)
- R9 / Surfaces, F6 P3-2 / P3-3 / P4, the known ten, Playwright, remainder of Batch C
