# P1 fix round 3 — test run v0.10 (Batch B round 3)

- Version: v0.10
- Date: 2026-11-20 AEDT (2026-11-20 13:39 AEDT)
- Branch: `fix/p1-review-r1-r3`
- Starting HEAD for this round: `26c5c52ad08747df541be71991eb046d00f41eb3` (clean tree recorded before edits)
- Candidate SHA: the commit that adds this note (product work lands at `9826086888820b3878441c3b6237265366153fb9` plus contract fixtures `47e258a5ad2825ce6342fcd17cd3cdba2863de8f`)
- Authority: `/home/luipt/codex-workspaces/物管/reviews/rt-independent-483b40d_v1.0.md` and `reviews/grok-evidence-483b40d/`
- F6 parked SHA (do not rebase): `f49dcd1a60d081cba212121b00c4eca50924fdc0` on `fix/rt5-f6-module-privileges` in `~/code/PEMO-grok-wt/rt5-f6`

## Changelog

- v0.10 (2026-11-20 AEDT): Batch B round 3, after R&T accepted R4 and rejected R5 solely on blocking P2-1 (management-web typecheck). Fixes P2-1, P2-2, P2-3, P2-4, and the P3 items ordered now. `pnpm typecheck` is a listed gate. F6 implementation remains parked; its run note, when resumed, becomes v0.11. v0.9 was reserved for F6 and was not written.
- v0.8.1 (2026-11-20 AEDT): Re-ran the v0.7 regression gates skipped in round 2 on clean `483b40d`. No product code change.
- v0.8 (2026-11-20 AEDT): Batch B round 2. Fixture principals and Block A physical parent corrected; `/properties/tree` reuses one expansion across keyset pages; both sides re-measured from clean worktrees at `limit=100`; helpdesk row counter fixed; the ten v0.7 integration failures named and checked on baseline `3fbae39`.
- v0.7 (2026-11-20 AEDT): Batch B. Request-scoped RoleScope membership Set (R4) with oracle parity. Batched N+1 reads, bounded paging with a stable tie-break, and frontend AbortController cancellation (R5).

## What this round changed

| Finding | Commit | Fix | Focused test |
| --- | --- | --- | --- |
| P2-1 management-web `pnpm typecheck` exits 2 (4 errors in `live-client.ts`) | `e50a579` | `ScopeTreeResponse`, `PropertyTreeResponse`, and `StaffNoticeListResponse` declare optional `page`. `get()` forwards `AbortSignal` only when it is defined (`exactOptionalPropertyTypes`). | Gate: `apps/management-web` `pnpm typecheck` exits 0. |
| P2-2 malformed `limit` (`abc`, `0`, `-1`, `1.5`) returned 500 | `992c578` | `parsePageParams` throws `InvalidPageLimitError`; `handleManagementError` maps it to 400 `invalid-request` before the unhandled-error log. | `parsePageParams` throws `InvalidPageLimitError` for those four values; `staffProblems.badRequest` is status 400. |
| P2-3 stale/unknown `after` returned a silent empty last page (R&T: 726/1926 dropped) | `992c578` plus the contract fixtures commit | `slicePage` throws `CursorExpiredError` when `after` is not in the result set; mapped to 410 `cursor-expired`. A found cursor with no later rows is still a legitimate last page. OpenAPI declares `limit`/`after`, `page`, 400, and 410 on `/scope`, `/properties/tree`, `/notices`, and `/helpdesk/queue`. The shared registry adds both type URIs. Fixtures: `tests/fixtures/management-web/problems/{cursor-expired,invalid-request}.json`. | `slicePage` on an unknown cursor throws `CursorExpiredError` and does not return an empty last page; `staffProblems.cursorExpired` is status 410. |
| P2-4 `/tree` walk cache ignored role/grant changes (`permittedActions` stale up to 15s) | `86d367f` | Cache key is `authorizationFingerprint(grants)` (role, node, effective dates, grant id), not node keys alone. | `tree walk cache: a role change misses the previous walk (P2-4)`. |
| P3 helpdesk order | `defe344` | Queue rows sort by `opened_at` then `ticketId` (`compareTicketsByOpenedAt` in `helpdesk-order.ts`), matching the SQL order. The page key remains `r.id`. | `helpdesk queue sorts by opened_at then ticket id (P3-5)`. |
| P3 AbortController was dead code | `defe344` | `app.tsx` wires `createCancellableLoader` for live `/scope`, `/properties/tree`, and `/notices`, passes the `AbortSignal`, aborts on effect cleanup, and swallows `AbortError`. The pre-existing `cancelled` flag still drops stale responses for non-paged fetches. | Existing loader tests plus this wiring. |
| P3 expired tree-cache entries not evicted on write | `86d367f` | `rememberTreeWalk` calls `evictExpiredTreeWalks` before insert. | `tree walk cache: remember evicts expired entries (P3-1)`. |

Action endpoints recheck authorization themselves. Management write routes are thin adapters: "NO ROUTE DECIDES ANYTHING" (`apps/api/src/server.ts`, notice act routes). Each notice transition calls `noticeActRegistry.canPerform(...)` in `apps/api/src/management/notice-acts.ts` (revise, correct, submit, approve, decline, publish, withdraw) and returns a refusal if the floor is not covered. Stale `permittedActions` on a cached tree page is a UI hint only. The out-of-scope refusal is already fixtured as `tests/fixtures/management-web/notices/refusal-out-of-scope.json` (contract: "the notice refusals UI-051 named are fixtured"). `tests/integration/p2-r4-tree-authorization.test.ts` covers composition/coverage, not the act path.

## Deferred (named, not fixed in this round)

- **P3-3 `/scope` row order.** Locations now come after the hierarchy preorder, sorted by key. The row *set* matches baseline; order is stable across limits. A client that relied on the old order would notice. Documented only.
- **P3-4 default/max page size remains 2000/2000.** The UI's first request sends no `limit`, so the first page is 2000. A per-request bound still applies; lowering the default would break existing unpaged suite tests. Deferred.

## Re-measurement

Not re-measured. These fixes do not touch the expansion or query hot path: P2-3 only changes the unknown-cursor miss path of `slicePage`; P2-4 changes the cache-key contents, not when a first page is expanded; evict-on-write is TTL maintenance; helpdesk changes the comparator, not the query; AbortController is the management-web client. The v0.8 figures (`3fbae39` vs `6245b76`, same fixture, `limit=100`) still stand. Code-identical measured candidate remains `6245b76` / `483b40d` / `26c5c52` for that path.

## Gates (2026-11-20 13:30 AEDT, private cluster, candidate product tree `9826086`)

PostgreSQL 16, `initdb` under `/tmp/pemo-r3pg`, `listen_addresses=''`, unix socket only at `/tmp/pemo-r3pg-sock` (outside DATADIR), port 5501 naming the socket file. Shared `127.0.0.1:5432` was not written to. The cluster was stopped and deleted at the end of the run (`private_cluster_removed=/tmp/pemo-r3pg`). F6 worktree stayed clean at `f49dcd1`. Live :3200 / :5185 / :5186 were not restarted.

| Gate | Result |
| --- | --- |
| management-web `pnpm typecheck` | PASS, exit 0 (was exit 2 / 4 errors at `26c5c52`) |
| `apps/api` `pnpm exec tsc -b` | PASS, exit 0 |
| Focused `tests/integration/p2-r5-paging.test.ts` | 8/8 pass, 0 fail |
| management-web `pnpm run build` + `test:node` | 401/404 pass, 0 fail, 3 skipped |
| `grants-complete` (`REQUIRE_DB=1`) | PASS |
| `premise-arm-guard` (`REQUIRE_DB=1`) | PASS |
| `pnpm run test:contract` on `9826086` (before fixtures) | 115/117: the pre-existing 9-operation fixture-debt failure, plus `cursor-expired` / `invalid-request` not yet fixtured |
| `operation-fixture-parity` after adding the two problem fixtures | Problem-type check PASS; the only remaining failure is the pre-existing `operation-fixture-parity` list of nine operations (`listHelpdeskQueue`, `getHelpdeskContact`, `listStrataCharges`, `getStrataCharge`, `listStrataPayments`, `sendStrataChargeInvoiceEmail`, `sendAdminEmailTest`, `getNoticeEmailDelivery`, `sendNoticeEmail`). That is the same 116/117 debt recorded in v0.8.1. |

Playwright was not re-run. The 14 visitor `state-matrix` failures remain as recorded in v0.7 / v0.8.1: pre-existing fixture chrome, not this round's product work.

## The ten known integration failures (8 identical on both trees, plus BITING and F2)

R&T's independent run at `483b40d` / `26c5c52` and the v0.8 isolation check on `3fbae39` / `6245b76` name the same ten. None is an R4/R5 or Round 3 product test. In a *full* official integration run they fail identically on both trees. In v0.8, the five files were re-run in isolation on a fresh private cluster (migrate+seed, no `loc_r5` fixture) at both `3fbae39` and `6245b76`: **32 tests, 30 pass, 2 fail, identical on both SHAs**. Failures 3–9 therefore depend on test order / harness pollution in the full suite (they pass against a clean seed). Failures 1, 2 and 10 are environment/process shape.

| # | Test | File | Why it fails in a full-suite run | Isolated on `3fbae39` / `6245b76` |
| --- | --- | --- | --- | --- |
| 1 | BITING — database state disappearing after a restart is caught | `biting-tests.test.ts` | Asserts PGDATA is the Docker volume `/var/lib/postgresql/data`; a private initdb does not use that path. | Failed on both, same assertion. |
| 2 | F2 — 0145 keeps historical duplicates; down refuses while pending, sending or unknown rows exist | `p1-f2-send-key-migration.test.ts` | Requires `PEMO_F2_DB_NAME`, a throwaway clone of a pre-0145 database, which a fresh private cluster does not provide. | Failed on both, same assertion. |
| 3 | the seeded magnitudes are UNCHANGED — interests are additive, no household added | `party-interest-seed.test.ts` | Household counts drift vs the corpus once earlier tests have written seed-shaped rows. Round 3 does not write seed data. | **Passed on both.** |
| 4 | D7 — the Novatek case: five occupied units, the company holds the tenancy, occupants hold NO interest | `party-interest-seed.test.ts` | Occupancy counts drift in the full-suite run. | **Passed on both.** |
| 5 | D7 — occupancy WITHOUT interest and interest WITHOUT occupancy both exist, which is the whole point | `party-interest-seed.test.ts` | Occupied-unit counts drift in the full-suite run. | **Passed on both.** |
| 6 | F1 as a tested STATE — the contradiction is CONSTRUCTED in a test, never seeded | `party-interest-seed.test.ts` | Legacy occupancy counts drift in the full-suite run. | **Passed on both.** |
| 7 | the total is the PRODUCT of the basis, not a number anybody typed | `seed-basis.test.ts` | Block A 8×35 expected 280; the world is larger after earlier tests. | **Passed on both.** |
| 8 | households are NOT units — vacancy is non-zero at every block | `seed-basis.test.ts` | Block A household counts drift in the full-suite run. | **Passed on both.** |
| 9 | the corpus-stated fact is a FACT, and the rest are inventions | `seed-basis.test.ts` | Same household-count drift as #8. | **Passed on both.** |
| 10 | invoice email records a log-transport outbox row when SMTP is unset | `strata-live-reads.test.ts` | Official `pnpm test` uses `--env-file=../../database/dev/.env`. A copied gov env can still carry SMTP settings, so the test sees `smtp` instead of `log`. Known invoice-test SMTP vs log-only disposition. | **Passed on both** (the isolation run did not apply `--env-file`, so SMTP stayed unset). |

R&T also saw a first-run BITING "unmapped unit being guessed" failure that passed on a clean rerun, attributed to overlapping `premise-arm-guard` on the same private cluster, and a file-level `adr-006-provenance-and-resolution.test.ts` load failure on one candidate log. Those are not added to the known product list.

## RT5-F6 parking

R&T accepted R4 and rejected R5 (P2-1) while F6 implementation was in flight. F6 was parked immediately, not stacked on this Round 3 work. Worktree `~/code/PEMO-grok-wt/rt5-f6` on `fix/rt5-f6-module-privileges` is clean at `f49dcd1a60d081cba212121b00c4eca50924fdc0` (SQL `6916b3e`, app wiring `f49dcd1`). No leftover private F6 cluster. F6 is not rebased in this round. The F6 run note, when work resumes, is v0.11.

Known F6 gaps at the parked SHA (not fixed here): `USAGE` on `access` and `platform` is required to call the definer functions; the F6 exit test imported `pg` from the repo root and failed `ERR_MODULE_NOT_FOUND`.

## Prior dispositions carried forward

- Invoice-test discrepancy (SMTP vs log-only): not changed, listed above.
- 403/404 oracle, Playwright 14 visitor state-matrix: not changed.
- Default/max page size 2000/2000 and `getResidents` `Promise.all` fan-out: still deferred.
- RT5-F6: parked, not rebased, not continued in this round.
