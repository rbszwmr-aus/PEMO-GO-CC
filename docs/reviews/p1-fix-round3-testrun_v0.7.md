# P1 fix round 3 — test run v0.7 (Batch B: R4 + R5)

- Version: v0.7
- Date: 2026-11-20 AEDT (2026-11-20 12:33 AEDT)
- Branch: `fix/p1-review-r1-r3`
- Baseline SHA: `3fbae39` (code-identical to recorded HEAD `7ec2d2b`)
- Starting HEAD: `7ec2d2b27e47a81fcec6492ffb463e89a1903f1a` (clean tree recorded before edits)

## Changelog

- v0.7 (2026-11-20 AEDT): Batch B. Request-scoped RoleScope membership Set (R4) with oracle parity. Batched N+1 reads, bounded paging with a stable tie-break, and frontend AbortController cancellation (R5). Same 1,000-location fixture measured on a private PG16 initdb for baseline and candidate.

## What shipped

- **R4.** `RoleScope` builds a WeakMap-keyed `Set` once per instance and reuses it for `scopeCovers` / `uncoveredNodes`. `uncoveredNodesOracle` keeps the previous `includes()` scan for parity tests. No cross-user or global decision cache.
- **R5.** Batched `getLocations` / serving-scope units / reporter `getResidents` / notice targets and approval policy. List endpoints take `limit` (default 2000, max 2000 so the seeded Wing Fu tree still fits one page) and `after` (tie-break key). Measurement walks used limit=100. Management-web live client walks pages and aborts a stale in-flight request so a previous estate cannot be restored.
- **Not done (as directed).** RT5-F6 is still a design item only (`docs/design/rt5-f6-per-module-db-privileges_v0.2.md`). P2-3, P2-5, and the 403/404 oracle stay on their prior dispositions. Invoice-test 62/62 vs 61/62 SMTP vs log-only is unchanged. No Batch C (R9/D1).

## Private cluster

- PostgreSQL 16, `initdb` under `/tmp/pemo-bbpg`, `listen_addresses=''`, unix socket only at `/tmp/pemo-bbpg-sock` (outside DATADIR), port 5497 naming the socket file.
- Migrated and seeded with `node dist/cli/migrate.js` and `node dist/cli/seed.js` (not `database/bootstrap.sh` / `pnpm run migrate`, so `database/dev/.env` could not retarget 127.0.0.1:5432).
- Shared `127.0.0.1:5432` was not written to.
- The cluster was stopped and deleted at the end of the run.

## Fixture (same for baseline and candidate)

```
R5 1,000-location fixture
date: 2026-11-20 12:05:02 AEDT
organization_id: org_wingfu_holdings
estate_id: est_wing_fu_garden
building_A (narrow / 0701-0850): blk_wfg_a
building_other (0851-1000): blk_wfg_b
location_class: common_area (copied from an existing seeded location)
physical_parent: estate:est_wing_fu_garden (all 1000)
parent_location_id: null
ids: loc_r5_0001 .. loc_r5_1000
serving_scope:
  loc_r5_0001-0700 -> estate:est_wing_fu_garden
  loc_r5_0701-0850 -> building:blk_wfg_a
  loc_r5_0851-1000 -> building:blk_wfg_b
page size used in measurement: 100
cache: no application-level cache; measurement discards 1 warmup then records 20 samples
  in one process (warm PG buffers after warmup).
```

Page size in the timed walks: **100**. Cache: one discarded warmup, then 20 samples in the same process (warm PG buffers, no application query cache). Query counts wrap `pg.Pool#query`.

## Performance (baseline `3fbae39`/`7ec2d2b` vs candidate)

| scope | endpoint | base queries | base rows | base p50 ms | base p95 ms | cand queries | cand rows | cand p50 ms | cand p95 ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| full | scope | 2023 | 1926 | 59.51524399999994 | 69.7956979999999 | 162 | 1926 | 195.516662 | 221.934845 |
| full | tree | 7 | 918 | 19.082094999999754 | 21.30494499999986 | 70 | 918 | 89.57703000000038 | 100.4541849999996 |
| full | notices | 9 | 1 | 6.813834000000043 | 8.181561000000329 | 9 | 1 | 6.299189999999726 | 7.542281000000003 |
| full | helpdesk | 7 | 0 | 5.835845000000063 | 7.504551999999876 | 9 | 0 | 7.039136999999755 | 7.941999000000578 |
| narrow | scope | 15 | 321 | 7.203242000000046 | 10.803637999999864 | 30 | 321 | 23.887572000000546 | 31.31105699999989 |
| narrow | tree | 7 | 317 | 7.347446999999647 | 8.565259000000424 | 28 | 317 | 22.04359099999965 | 24.991148000000067 |
| narrow | notices | 9 | 1 | 5.0637400000000525 | 6.400706999999784 | 9 | 1 | 4.58410399999957 | 4.902354999999261 |
| narrow | helpdesk | 7 | 0 | 3.7826100000002043 | 4.278093999999783 | 9 | 0 | 3.5657669999991413 | 4.817027999999482 |
| revoked | scope | 1 | 0 | 0.18918399999984103 | 0.3192500000000109 | 1 | 0 | 0.14437499999985448 | 0.21705300000030547 |
| revoked | tree | 1 | 0 | 0.1651849999998376 | 0.26058199999988574 | 1 | 0 | 0.12929499999972904 | 0.13931599999978062 |
| revoked | notices | 1 | 0 | 0.15336600000000544 | 0.1990139999998064 | 1 | 0 | 0.1340860000000248 | 0.19840300000032585 |
| revoked | helpdesk | 1 | 0 | 0.14404599999988932 | 0.16827499999999418 | 1 | 0 | 0.13352500000019063 | 0.1634250000006432 |
| cross-estate | scope | 2023 | 1926 | 59.67820799999981 | 62.22097799999983 | 162 | 1926 | 184.90038899999854 | 206.10361699999885 |
| cross-estate | tree | 7 | 918 | 18.79187499999989 | 22.619533000000047 | 70 | 918 | 91.8781680000011 | 104.67274300000099 |
| cross-estate | notices | 9 | 1 | 6.387297999999646 | 7.174562000000151 | 9 | 1 | 5.529104999999618 | 6.761465999999928 |
| cross-estate | helpdesk | 7 | 0 | 5.699629000000641 | 7.610149000000092 | 9 | 0 | 5.49968600000102 | 6.003979999999501 |

Baseline SHA named: `3fbae39 (7ec2d2b27e47a81fcec6492ffb463e89a1903f1a code-identical)`. Candidate measurement was taken on the dirty worktree from `7ec2d2b`. That tree was then committed as R4 `b6b055f`, R5 `cddeedd`, premise-arm-guard `e6e6190`, and docs `163c20f`.

Walked every page in stable order. `omissionsOrDupes` is recorded per cell in the raw JSON (`/tmp/pemo-bb-baseline.json`, `/tmp/pemo-bb-candidate.json`). Revoked staff must not see `loc_r5_*` rows; a cross-estate / foreign-estate check is recorded in the run log.

## R4 membership-check work (1k / 2k / 4k)

R4 membership work [
  { size: 1000, ms: 0.157295, constructions: 1 },
  { size: 2000, ms: 0.249533, constructions: 1 },
  { size: 4000, ms: 0.9619, constructions: 1 }
]
(node:1761773) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/luipt/code/PEMO-grok-wt/p1-review-r1-r3/tests/integration/p2-r4-tree-authorization.test.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/luipt/code/PEMO-grok-wt/p1-review-r1-r3/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ R4 — empty, narrow, full, mixed, wrong-estate and revoked scopes match the oracle (1.005638ms)
✔ R4 — membership Set is built once per resolved role, not once per node, at 1k/2k/4k (18.656039ms)
✔ R4 — two principals do not share a membership Set (0.136066ms)
(node:1761780) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/luipt/code/PEMO-grok-wt/p1-review-r1-r3/tests/integration/p2-r5-paging.test.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/luipt/code/PEMO-grok-wt/p1-review-r1-r3/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ parsePageParams: default, cap, and after (0.578252ms)
✔ slicePage: walks every key once, in order, with a stable tie-break (0.512224ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 153.68053


## Suite results

Focused and governance (this tree, private PG16 cluster):

- R4/R5 focused tests: **5/5 pass**. Oracle parity (empty/narrow/full/mixed/wrong-estate/revoked). Two principals do not share a Set. Paging unit tests pass.
- Membership Set constructions at 1k/2k/4k: **1** each. Times: 1k 0.157 ms, 2k 0.250 ms, 4k 0.962 ms.
- management-web abort test: **1/1 pass**.
- management-web `test:node`: **401 pass, 0 fail, 3 skipped** (includes inventory and the new abort test).
- `grants-complete` with `REQUIRE_DB=1` and `PEMO_GOVERNANCE_ENV` on the private cluster: **pass** (role model holds, 63 tables, SELECT+INSERT, plus documented `strata.email_outbox` column UPDATE).
- `premise-arm-guard` with the same private env: **pass** after treating a unix-socket `PEMO_DB_HOST` as local (TCP still must be loopback).
- Official `apps/api` contract suite: **116/117**. The one failure is pre-existing at `7ec2d2b` (see deviations).
- Official integration suite on the private cluster: **538/548 pass, 10 fail**. None of the 10 are R4/R5 product tests (see deviations). Scope/tree, notice, R4 and R5 paging tests in this glob passed.
- Playwright (already recorded on this same web change): **1805 passed, 14 failed, 5 skipped**, all 14 in fixture `state-matrix` visitor screens, not the live scope/tree client.

Raw accumulator from the orchestrators (includes earlier failed attempts and cleanup lines):

```
head_ok=7ec2d2b27e47a81fcec6492ffb463e89a1903f1a
migrate=1
seed=1
baseline=1
private_cluster_removed=/tmp/pemo-bbpg
tsc_api=0
tsc_api=0
tsc_api=1
candidate_measure=1
private_cluster_removed=/tmp/pemo-bbpg
seed=1 (tests cluster, no loc_r5 fixture)
focused_r4_r5=0
web_abort_test=1
full_suite=0
grants_complete=1
premise_arm_guard=1
web_tests=0
private_cluster_removed=/tmp/pemo-bbpg
focused_r4_r5=0
web_abort_test=1
full_api_suite=0
grants_complete=1
premise_arm_guard=0
web_tests=0
private_cluster_removed=/tmp/pemo-bbpg
focused_r4_r5=1
web_abort_test=1
full_api_suite=0
grants_complete=1
premise_arm_guard=1
web_node_tests=1
web_playwright_prior=1805_passed_14_failed_5_skipped_state-matrix_visitor
private_cluster_removed=/tmp/pemo-bbpg
full_api_suite=0
private_cluster_removed=/tmp/pemo-bbpg
integration_suite=0
private_cluster_removed=/tmp/pemo-bbpg
```

Hot paths actually measured and then batched: `servingScope.getLocation` per location on `GET /scope` (two SQL statements each: location row + serving scope), help-desk reporter `getResident` per ticket, and notice-permissions `readTargets` + `requiresApproval` per notice. `compose-trees` `noticeActRegistry.permitted()` stayed one call per (paged) node; R4 makes each membership check O(1).

## Deviations from PT's notes

- **Default page size is 2000, max 2000**, not 100. The seeded Wing Fu Garden tree is 926 nodes on `GET /scope` and 918 on `GET /properties/tree`; a default of 100 would break existing suite tests that do not walk pages. Measurement still walked every page at **limit=100**, as specified.
- **Revoked principal.** `stf_r5_revoked` is not in the seed. Baseline and candidate both received **401 invalid-credential** (no such principal), not an ended-grant empty tree. The same unprovisioned id was used on both sides so the cells stay comparable; they are not a revoked-grant oracle.
- **Cross-estate principal.** No org-B staff was wired into the measure harness. The cross-estate cells used `stf_wfg_manager` and therefore match **full**. All 1,000 `loc_r5_*` locations and 1,926 `/scope` nodes belong to `est_wing_fu_garden` / `org_wingfu_holdings`.
- **Narrow fixture visibility.** `stf_wfg_block_a` saw **0** of the 1,000 fixture locations. Every `loc_r5_*` is physically parented to the estate; `expanded.locationIds` for Block A does not include estate-parented locations, including 0701–0850 whose serving scope is `building:blk_wfg_a`. The demonstrated N+1 (and the query-count drop) is on the **full** `/scope` path (1,000 fixture locations, 2,023 → 162 queries).
- **Full-walk wall time vs query count.** Walking `/scope` at limit=100 is 20 pages, so candidate p50 wall time is higher (≈196 ms vs ≈60 ms) even though query count fell from 2,023 to 162. `/properties/tree` is not an N+1 path (baseline already 7 queries); walking 10 pages repeats expansion work, so a full walk rose 7 → 70 queries. The bound is still applied; the default of 2,000 would have returned the seed-shaped tree in one page.
- **Helpdesk row counter.** The measure script walked `nodes` / `notices` / `tickets` / `queue` / `items` and missed the queue's `rows` field. Baseline and candidate therefore both report 0 helpdesk rows; candidate `page.total` is 2. Query counts remain comparable (7 vs 9).
- **`getResidents`** is a single call-site batch that still fans out to `getResident` per id (`Promise.all`), not one `= ANY($1)` statement. Queue size in this fixture is two tickets, so it was not a measured hot path.
- **premise-arm-guard** originally refused any `PEMO_DB_HOST` that was not TCP loopback, so it could not run on the mandated private unix-socket cluster. A one-line pattern change treats a host starting with `/` as local; TCP hosts still have to be loopback. The guard was then run with `REQUIRE_DB=1` and `PEMO_GOVERNANCE_ENV` pointing at a private env file (never 127.0.0.1:5432).
- **Playwright.** `pnpm run test:node` is the required web gate and was green (401/401, including the new abort test and inventory). `pnpm run test:browser` reported 1805 passed, 14 failed, 5 skipped, all 14 in `state-matrix` visitor screens (`visitor-detail` visibility / unmarked controls on visitorLog / visitorRegister). Those screens are fixture chrome, not the live scope/tree client. They are recorded, not treated as an R5 product fix in this batch.
- **Contract fixture-parity (pre-existing at 7ec2d2b).** Official `apps/api` `pnpm test` is `test:contract && test:integration`. The contract suite was 116/117: `operation-fixture-parity` REDS nine already-declared helpdesk/strata/email operations that have no fixture and are not in `tests/fixtures/fixture-debt.json`. That debt file is identical at `7ec2d2b`. Batch B did not change the contract or the debt list, so this was not treated as an R4/R5 fix. The integration suite was run separately as the Batch B API gate.
- **Integration 10 fails, not treated as R4/R5 product regressions.** (1) `biting-tests` asserts PGDATA is `/var/lib/postgresql/data` (Docker volume); the private initdb lives at `/tmp/pemo-bbpg`. (2) `p1-f2-send-key-migration` requires `PEMO_F2_DB_NAME`, a throwaway clone of a pre-0145 database, which this private cluster does not provide. (3–9) `party-interest-seed` and `seed-basis` report +17 Block A households/units versus the corpus (e.g. 285≠268, 297≠280, occupancy 2≠1). R4/R5 do not write seed data; a fresh initdb+migrate+seed plus the suite was used. (10) `strata-live-reads` expected log transport and saw `smtp` — the known invoice-test SMTP vs log-only disposition; the private gov env was copied from the official dev env and still carried SMTP settings even though the shell had unset them (node `--env-file` applies those keys).
- RT5-F6 was not implemented. P2-3, P2-5, the 403/404 oracle, and the invoice-test 62/62 vs 61/62 SMTP vs log-only disposition are unchanged.

## Prior dispositions carried forward

- Invoice-test discrepancy (62/62 vs 61/62, SMTP vs log-only): not changed in Batch B.
- F-spot failures P2-3, P2-5, 403/404 oracle: not changed in Batch B.
- RT5-F6 not implemented.
