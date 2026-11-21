# P1 fix round 3 — test run v0.8.1 (Batch B round 2)

- Version: v0.8.1
- Date: 2026-11-20 AEDT (2026-11-20 12:49 AEDT)
- Branch: `fix/p1-review-r1-r3`
- Baseline SHA: `3fbae39` (measured from a clean detached worktree at `3fbae39170db4471aa567d36962212a080389970`)
- Starting HEAD for this round: `296e3f56c52d8eb8fd0dbb7d2c703017b064e60b` (clean tree recorded before edits)
- Measured candidate SHA: `6245b76ab9ed14e63afc5285620ffb4965619ac3` (clean committed tree, not a dirty worktree)

## Changelog

- v0.8.1 (2026-11-20 AEDT): Re-ran the v0.7 regression gates skipped in round 2 (`test:node`, contract, `grants-complete`, `premise-arm-guard`) on clean `483b40d`. No product code change. Counts match v0.7; no new failures. Playwright skipped (round 2 did not change web code).
- v0.8 (2026-11-20 AEDT): Batch B round 2. Fixture principals and Block A physical parent corrected; `/properties/tree` reuses one expansion across keyset pages; both sides re-measured from clean worktrees at `limit=100`; helpdesk row counter fixed; the ten v0.7 integration failures named and checked on baseline `3fbae39`. RT5-F6 was parked (not started). The F6 run-note number moves to v0.9 later.
- v0.7 (2026-11-20 AEDT): Batch B. Request-scoped RoleScope membership Set (R4) with oracle parity. Batched N+1 reads, bounded paging with a stable tie-break, and frontend AbortController cancellation (R5).

## What this round changed

- **Narrow fixture visibility.** The 1,000 location ids and the serving-scope distribution are unchanged. `loc_r5_0701`–`0850` are now physically parented to `building:blk_wfg_a` so `stf_wfg_block_a`'s building grant expands to that subset (150 fixture locations). The other 850 stay parented to the estate.
- **Revoked principal.** Measurement uses the seeded `stf_wfg_former`, whose estate grant ended `2026-06-01`. Both sides return **200 with an empty body**, not 401 from a missing id. (A verified principal with no active grants is an empty scope, not an invalid credential.)
- **Cross-estate principal.** Measurement uses the seeded `stf_hbv_manager` (`org_harbour_property`, grant on `est_harbour_view` only). Both sides return the Harbour View tree (5 `/scope` nodes, 4 `/tree` nodes) and **0** of the `loc_r5_*` rows.
- **`/properties/tree` expansion reuse.** Paging slices a stable preorder after a full expansion. Walking at `limit=100` used to repeat that expansion on every page (7 → 70 queries, p50 19 → 90 ms). The first page of a walk still recomputes; later pages with the same principal and grants slice the stored list.
- **Helpdesk row counter.** The measure script now reads the queue's `rows` field (2 tickets on the seed).
- **Deferred (named, not fixed in this round).** Default/max page size remains **2000/2000** (a default of 100 would break existing unpaged suite tests). `getResidents` is still a call-site batch that fans out to `getResident` via `Promise.all`, not `= ANY($1)`.

## Private cluster and measurement method

- PostgreSQL 16, `initdb` under `/tmp/pemo-r2pg`, `listen_addresses=''`, unix socket only at `/tmp/pemo-r2pg-sock` (outside DATADIR), port 5498 naming the socket file. Shared `127.0.0.1:5432` was not written to. The cluster was stopped and deleted at the end of the run.
- Baseline was built and measured from a separate worktree `/home/luipt/code/PEMO-grok-wt/p1-r2-baseline` at `3fbae39`. Candidate was measured from the already-clean `p1-review-r1-r3` worktree at `6245b76`. Same fixture, same private cluster, `limit=100`, 1 discarded warmup + 20 samples, query counts wrapping `pg.Pool#query`.
- Times below are milliseconds. `measuredAt` in the raw JSON is UTC; the run was 12:43 AEDT on 20 November 2026.

## Performance (baseline `3fbae39` vs candidate `6245b76`)

| scope | endpoint | base q | base rows | base pages | base p50 | base p95 | cand q | cand rows | cand pages | cand p50 | cand p95 | fixture locs |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| full (`stf_wfg_manager`) | /scope | 2023 | 1926 | 1 | 57.8 | 64.1 | 162 | 1926 | 20 | 196.4 | 219.9 | 1000 / 1000 |
| full | /tree | 7 | 918 | 1 | 19.0 | 22.5 | 25 | 918 | 10 | 17.0 | 19.1 | 0 / 0 |
| full | /notices | 9 | 1 | 1 | 6.1 | 7.4 | 9 | 1 | 1 | 6.8 | 8.2 | 0 / 0 |
| full | /helpdesk | 7 | 2 | 1 | 5.6 | 8.3 | 9 | 2 | 1 | 5.8 | 8.1 | 0 / 0 |
| narrow (`stf_wfg_block_a`) | /scope | 315 | 471 | 1 | 12.1 | 14.2 | 39 | 471 | 5 | 30.4 | 32.6 | 150 / 150 |
| narrow | /tree | 7 | 317 | 1 | 7.2 | 8.7 | 13 | 317 | 4 | 8.0 | 9.0 | 0 / 0 |
| narrow | /notices | 9 | 1 | 1 | 5.0 | 5.5 | 9 | 1 | 1 | 4.9 | 5.7 | 0 / 0 |
| narrow | /helpdesk | 7 | 2 | 1 | 3.2 | 3.7 | 9 | 2 | 1 | 4.2 | 4.6 | 0 / 0 |
| revoked (`stf_wfg_former`) | /scope | 3 | 0 | 1 | 0.54 | 0.72 | 3 | 0 | 1 | 0.67 | 1.68 | 0 / 0 |
| revoked | /tree | 3 | 0 | 1 | 0.47 | 0.65 | 3 | 0 | 1 | 0.53 | 0.92 | 0 / 0 |
| revoked | /notices | 3 | 0 | 1 | 0.56 | 0.77 | 3 | 0 | 1 | 0.57 | 0.73 | 0 / 0 |
| revoked | /helpdesk | 4 | 0 | 1 | 0.79 | 0.90 | 4 | 0 | 1 | 0.65 | 0.81 | 0 / 0 |
| cross-estate (`stf_hbv_manager`) | /scope | 9 | 5 | 1 | 2.44 | 3.28 | 9 | 5 | 1 | 3.01 | 3.21 | 0 / 0 |
| cross-estate | /tree | 7 | 4 | 1 | 2.59 | 2.86 | 7 | 4 | 1 | 2.92 | 3.42 | 0 / 0 |
| cross-estate | /notices | 5 | 0 | 1 | 1.60 | 1.74 | 5 | 0 | 1 | 1.78 | 2.19 | 0 / 0 |
| cross-estate | /helpdesk | 5 | 0 | 1 | 1.61 | 1.95 | 5 | 0 | 1 | 1.87 | 2.23 | 0 / 0 |

Walked every page in stable order. Unique row counts matched; `omissionsOrDupes` was false on every 200 cell. Raw JSON: `/tmp/pemo-bb-r2-baseline.json`, `/tmp/pemo-bb-r2-candidate.json`.

**`/tree` vs the target (queries and p50 no worse than baseline).** Full-walk p50 is **17.0 ms vs 19.0 ms** (no worse; slightly better). Query count is **25 vs 7**, not equal. The first page still does the same expansion as baseline (~7 queries). Each later page reuses that list and does not re-expand, but every HTTP request still resolves the staff credential and principal (~2 queries). Ten pages therefore cost 7 + 2×9 = 25. Repeating the expansion would have been ~70 queries and ~90 ms, as in v0.7. The extra queries are per-request auth, not a second expansion. Narrow `/tree` is the same shape (13 vs 7 queries, p50 8.0 vs 7.2 ms over 4 pages).

**`/scope` wall time vs query count.** Walking 1,926 nodes at `limit=100` is 20 pages, so candidate full `/scope` p50 is higher (196 vs 58 ms) even though query count fell 2023 → 162. Narrow `/scope` fell 315 → 39 queries once the 150 Block A fixture locations were in the expanded set (baseline still did the per-location N+1). Default page size 2000 would have returned each of these in one page; that default is deferred.

## R4 membership-check work (1k / 2k / 4k), on `6245b76`

- 1,000 nodes: 0.658 ms, Set constructions = 1
- 2,000 nodes: 0.258 ms, Set constructions = 1
- 4,000 nodes: 0.893 ms, Set constructions = 1

Oracle parity (empty / narrow / full / mixed / wrong-estate / revoked) and two-principal isolation passed. Focused R4/R5 tests including the new tree-walk cache test: **6/6 pass**.

## The ten v0.7 integration failures

v0.7's official integration run was **538/548**. None of those ten is an R4/R5 product test. The five files were re-run in isolation on a fresh private cluster (migrate+seed, no `loc_r5` fixture) at both `3fbae39` and `6245b76`: **32 tests, 30 pass, 2 fail, identical on both SHAs**.

| # | Test | File | Why it fails (v0.7 full suite) | On `3fbae39` / `6245b76` in isolation |
| --- | --- | --- | --- | --- |
| 1 | BITING — database state disappearing after a restart is caught | `biting-tests.test.ts` | Asserts PGDATA is the Docker volume `/var/lib/postgresql/data`; the private initdb lives at `/tmp/pemo-r2pg` (was `/tmp/pemo-bbpg`). | Failed on both, same assertion. |
| 2 | F2 — 0145 keeps historical duplicates; down refuses while pending, sending or unknown rows exist | `p1-f2-send-key-migration.test.ts` | Requires `PEMO_F2_DB_NAME`, a throwaway clone of a pre-0145 database, which a fresh private cluster does not provide. | Failed on both, same assertion. |
| 3 | the seeded magnitudes are UNCHANGED — interests are additive, no household added | `party-interest-seed.test.ts` | In the v0.7 full 548-test run, household counts were +17 vs the corpus (782≠765). R4/R5 do not write seed data. | **Passed on both.** |
| 4 | D7 — the Novatek case: five occupied units, the company holds the tenancy, occupants hold NO interest | `party-interest-seed.test.ts` | Occupancy 2≠1 in the full-suite run. | **Passed on both.** |
| 5 | D7 — occupancy WITHOUT interest and interest WITHOUT occupancy both exist | `party-interest-seed.test.ts` | Occupied units 10≠5 in the full-suite run. | **Passed on both.** |
| 6 | F1 as a tested STATE — the contradiction is CONSTRUCTED in a test, never seeded | `party-interest-seed.test.ts` | Legacy occupancy 2≠1 in the full-suite run. | **Passed on both.** |
| 7 | the total is the PRODUCT of the basis, not a number anybody typed | `seed-basis.test.ts` | Block A 8×35 expected 280, world had 297 in the full-suite run. | **Passed on both.** |
| 8 | households are NOT units — vacancy is non-zero at every block | `seed-basis.test.ts` | Block A households 285≠268 in the full-suite run. | **Passed on both.** |
| 9 | the corpus-stated fact is a FACT, and the rest are inventions | `seed-basis.test.ts` | Block A households 285≠268 in the full-suite run. | **Passed on both.** |
| 10 | invoice email records a log-transport outbox row when SMTP is unset | `strata-live-reads.test.ts` | Official `pnpm test` uses `--env-file=../../database/dev/.env`. A private gov env copied from that file still carried SMTP settings, so the test saw `smtp` instead of `log`. Known invoice-test SMTP vs log-only disposition. | **Passed on both** (this isolation run did not apply `--env-file`, so SMTP stayed unset). |

Failures 3–9 in the full suite are therefore test-order or harness pollution, present or not depending on what ran earlier, and they are not caused by R4/R5 (they pass on the candidate when run against a clean seed, and they also pass on baseline `3fbae39` the same way). Failures 1, 2 and 10 are environment/process shape, and 1 and 2 were reproduced identically on baseline.

Contract 116/117 (`operation-fixture-parity`) and Playwright 14 `state-matrix` visitor failures remain as recorded in v0.7: pre-existing at `7ec2d2b` / fixture chrome, not Batch B product work. `grants-complete`, `premise-arm-guard`, and management-web `test:node` 401/401 were already green on this branch in v0.7 and were not re-run in round 2.

## RT5-F6 parking

RT5-F6 implementation was stopped by master order before any F6 code was written. `fix/p1-review-r1-r3` was already clean at `296e3f5` when the stop arrived, so there was nothing to stash or to commit on `wip/rt5-f6`. No such branch was created. The last F6 artefact on the branch remains the design-only note at `7ec2d2b`. The F6 run-note number, when that work starts, moves to v0.9.

## Prior dispositions carried forward

- Invoice-test discrepancy (62/62 vs 61/62, SMTP vs log-only): not changed.
- F-spot failures P2-3, P2-5, 403/404 oracle: not changed.
- RT5-F6 not implemented.
- Default/max page size 2000/2000 and `getResidents` `Promise.all` fan-out: deferred, as above.

## Addendum — regression gates re-run on `483b40d` (2026-11-20 12:49 AEDT)

Clean tree at `483b40d0d3933900f5d5deeeec9022aaee177e2d`. Fresh private PG16 initdb `/tmp/pemo-gatespg`, unix socket only at `/tmp/pemo-gatespg-sock`, port 5499, `listen_addresses=''`. Shared `127.0.0.1:5432` was not written to. Cluster stopped and deleted after the run. No product code was edited. Full Playwright was not run: round 2's only product commit (`6245b76`) is API-only (`compose-trees.ts`, `tree-page-cache.ts`, and the paging unit test). `pnpm test` in management-web would also run `test:browser`; only `test:node` was executed (after a production build).

| Gate | v0.7 | this run (`483b40d`) |
| --- | --- | --- |
| management-web `test:node` | 401 pass, 0 fail, 3 skipped | 404 tests, **401 pass, 0 fail, 3 skipped** — same counts |
| contract suite | 116/117, pre-existing `operation-fixture-parity` | **116/117**. Same failure: `every declared operation has a fixture, or a named debt` (`tests/contract/operation-fixture-parity.test.ts`). Same nine undeclared-debt operations (listHelpdeskQueue, getHelpdeskContact, listStrataCharges, getStrataCharge, listStrataPayments, sendStrataChargeInvoiceEmail, sendAdminEmailTest, getNoticeEmailDelivery, sendNoticeEmail). Not a new failure. |
| `grants-complete` (`REQUIRE_DB=1`) | pass, 63 tables | **pass**: role model holds, **63 tables**, SELECT+INSERT, plus documented `strata.email_outbox` column UPDATE |
| `premise-arm-guard` (`REQUIRE_DB=1`) | pass (unix-socket host treated as local) | **pass**: premise arm bites on every reversible attribute (BYPASSRLS, CREATEDB, CREATEROLE, SUPERUSER) |

No new failure.
