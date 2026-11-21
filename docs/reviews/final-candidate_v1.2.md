# Final candidate — six-area R&T v1.2

- Branch: `review/final-candidate` in `~/code/PEMO-grok-wt/final-candidate`
- Date: 2026-11-20, Australia/Sydney (AEDT, UTC+11)
- Private clusters: PostgreSQL 16 `initdb`, unix socket only, `listen_addresses=''`. The merge-candidate official gates used `/tmp/pemo-fc` (socket `/tmp/pemo-fc-sock`, port 5515). The body-parse P2 official gates used `/tmp/pemo-fc-p2` (socket `/tmp/pemo-fc-p2-sock`, port 5521). Shared `127.0.0.1:5432` was SELECT-only and was not written. Each cluster was stopped and deleted after its gates. The Playwright comparison used the repo's standard R&T runner (in-process static server on an ephemeral port; no Postgres; no custom API). Live :3200 / :5185 / :5186 / :5173–:5176 were not bound, restarted, or killed.

## Changelog

- v1.2 (2026-11-20 AEDT): Record the body-parse P2 fix (`75b08fa`), the OpenAPI decision (no bump; 413 and the interim types are debt), and the official gates on that SHA.
- v1.1 (2026-11-20 AEDT): Playwright line replaced with standard-runner result; private-API run dropped.
- v1.0 (2026-11-20 AEDT): Recorded six-area R&T candidate. `--no-ff` merge of accepted Batch C D1 and accepted R9 onto the accepted RT5-F6 base; official gates and full Playwright vs the baseline 14 known failures.

## SHAs

| Role | Ref | SHA |
| --- | --- | --- |
| Base (accepted RT5-F6 note tip) | `fix/rt5-f6-module-privileges` / `b07e6dc` | `b07e6dcd4ed12b5bc77b10512deb5448445faebd` |
| Accepted Batch C D1 tip (incl. v0.15.1 note) | `fix/batch-c-d1` / `2d57710` | `2d57710cb6426593aefa1e7c90834750a61a6acf` |
| Accepted R9 tip | `perf/r9-initial-bundle` / `9776ff9` | `9776ff9b655e74ddaa315d83a776eaba3092c347` |
| Merge 1 (`git merge --no-ff fix/batch-c-d1`) | parents `b07e6dc` + `2d57710` | `814d1613e5d381a6a558907dee7cf6130afa3bf6` |
| Merged product tip (`git merge --no-ff perf/r9-initial-bundle`) | parents `814d161` + `9776ff9` | `88a72e6dace4627a8a964d22b2b208eb4dc63a33` |
| **Body-parse P2 fix** | `fix(api): map body-parse failures to 400/413 problem+json` on `review/final-candidate` | `75b08fa4efc247a50ba553969d66f68c22390e69` |
| **Current product tip** | `75b08fa` (parent `6423e6e`, the v1.1 docs tip on `88a72e6`) | `75b08fa4efc247a50ba553969d66f68c22390e69` |

Both source branches descend from `b07e6dc` (merge-base is F6). Merges were `--no-ff`, no squash. Surfaces' worktree `~/code/PEMO-grok/.worktrees/r9-initial-bundle` was not entered; R9 was merged from the branch ref only. `fix/batch-c-d1`, `fix/rt5-f6-module-privileges`, and `fix/p1-review-r1-r3` were not modified (still `2d57710`, `b07e6dc`, `b4fe994`, all clean).

The merge official gates and the Playwright comparison were taken on `88a72e6dace4627a8a964d22b2b208eb4dc63a33` and are unchanged from v1.1. The body-parse P2 official gates below were taken on product SHA `75b08fa4efc247a50ba553969d66f68c22390e69`. This docs-only v1.2 is committed after those runs. The current product SHA is `75b08fa`.

## Task IDs covered

Derived from the run notes already on this tree and from the merged commit subjects. Nothing below is invented.

On the F6 base (already accepted; recorded in `docs/reviews/p1-fix-round2-testrun_v0.1.md`, `p1-fix-round3-testrun_v0.2`–`v0.12`, and `rt5-f6-testrun_v0.13.md`):

- P1 F1, F2, F3
- R1, R2, R3, R6, R7, R8
- Batch B R4 and R5, including subsequent Batch B rounds recorded in v0.7–v0.12 (accepted product `664d7f5` / `b4fe994` is an ancestor of this F6 base line)
- RT5-F2, RT5-F4, RT5-F6, RT5-F11, RT5-F14

On the D1 merge (recorded in `docs/reviews/batch-c-d1-testrun_v0.14.md` and `v0.15.md` / v0.15.1 addendum):

- Batch C P3-1 (`/ready` probes every module pool; a failed probe keeps the pool's name)
- Batch C P3-5 (case SQL commands constrain `organization_id`; migration `0150`)
- Batch C D1 communications port, plus follow-ups F-1, F-2, F-3, F-4, F-5
- Management-web contract declaration of 503 `communications-unavailable` (2.6.0 → 2.7.0)

On the R9 merge (commit subjects on `perf/r9-initial-bundle`, no separate Surfaces run note in `docs/reviews/`):

- R9 initial bundle: lazy-load feature screens, clients, and corpus off the entry graph (`d288904`)
- R9 R&T P2 fixes: load-failure boundary, nav transition, live mode off the corpus (`c1d4a89`)
- R9 R&T round 2: reload retry, live mode off the corpus, rail states, live node labels (`d8b40b2`)
- R9 R&T round 3: log out from a live session loads the corpora first (`9776ff9`)

F-6 (invoice smtp-vs-log official-integration failure) was left untouched throughout D1 and remains one of the known ten.

## Changed contracts and migrations

- **management-web** OpenAPI / `contract-lock.json`: **2.7.0** (D1 503 declaration; changelog: "declare 503 `communications-unavailable` on invoice-email, notice email, and notice delivery."). `surfaceHash` `sha256:3472fd5035efceac92d1cdd1240c9a8ef7bd93506cc2451b03195c45d0533270`. `corpusHash` `sha256:6e1ce3307971f749e6fc16a571868a29f3d18692e770892ce224f225a8089514`.
- **resident-mobile** remains 0.4.0. **resident-portal** remains 0.1.0. `problem-types.json` `contractVersion` remains 0.4.0 (`communications-unavailable` is registered against the management surface, `since` 2.7.0).
- **Migrations new on this candidate versus the F6 base:** `0150_service_case_org_constraint` (P3-5). Official migrate on the private cluster applied 66 files, `0001` through `0150`. `0146`–`0149` (named-command / outbox work) are already on the F6 base. R9 added no migrations.


## Body-parse P2 fix

Six-area R&T on `88a72e6` (`rt-final-six-area-88a72e6_v1.0.md`) found no P1 and one P2: `POST` with malformed JSON, a body over the 1 MB framework limit, or a `__proto__` key returned 500 `internal-error` plus a full-stack error log, including when unauthenticated. The same behaviour was present on `3fbae39`. No data was written and nothing leaked, but a client fault was answered as a server fault and an anonymous caller could write error-level logs at will.

Fix SHA `75b08fa4efc247a50ba553969d66f68c22390e69` maps those failures in `apps/api` before auth:

- malformed JSON → 400 `https://pemo.local/problems/invalid-request` (management) or `bad-request` (resident)
- a `__proto__` key → 400 `https://pemo.local/problems/refused`
- body over 1 MB → 413 `https://pemo.local/problems/request-too-large`

The JSON content-type parser tags the first two; `FST_ERR_CTP_BODY_TOO_LARGE` is mapped in `setErrorHandler` (and in `frameworkErrors` if it is reached). Logs are `warn` with `kind`, no `stack`. A valid empty `{}` body on the same unauthenticated route is still 401 `invalid-credential`.

Files changed (product commit only):

- `apps/api/src/server.ts`
- `apps/api/src/management/staff-problems.ts`
- `apps/api/src/errors/problem-catalog.ts`
- `tests/integration/body-parse-errors.test.ts` — one focused test covering all three cases, unauthenticated, no 500, and no stack field on the warn lines

### OpenAPI decision

No OpenAPI bump, no digest, no contract-lock change, and no `problem-types.json` edit.

- Generic 400 is already modelled: `components/responses/BadRequest` exists and is referenced as `'400'` on many operations, including `sendAdminEmailTest`. Malformed JSON uses the already-registered management type `invalid-request` (or resident `bad-request`). The 400 shape was not invented here.
- 413 is not modelled anywhere in the management-web contract (no `components/responses` entry, no operation declares it).
- `sendStrataChargeInvoiceEmail` and `sendNoticeEmail` still do not declare 400. `sendAdminEmailTest` declares 400 but not 413.

Interim debt, same class as the earlier 503 `communications-unavailable` approach before it was declared:

- type URIs `https://pemo.local/problems/refused` and `https://pemo.local/problems/request-too-large` are emitted but not yet in `problem-types.json`
- HTTP 413 is implemented and tested but not declared on any operation
- HTTP 400 from body-parse is undeclared on `sendStrataChargeInvoiceEmail` and `sendNoticeEmail`

The next contract change should fold the types into the registry (`addingAType.interim`) and declare 400/413 on the operations that can emit them, which is a MINOR bump.

## Merge conflicts

None. `git merge-tree` preview for R9 into F6+D1 reported zero conflict paths. Both `--no-ff` merges completed with the `ort` strategy and a clean tree (`MERGE_CLEAN`). No lockfile, digest, contract-lock, or generated file needed regeneration.

## Official gates (after the body-parse fix)

All rows are on product SHA `75b08fa4efc247a50ba553969d66f68c22390e69`. Private cluster `/tmp/pemo-fc-p2` (socket `/tmp/pemo-fc-p2-sock`, port 5521), 2026-11-20 20:01:57–20:04:38 AEDT. Live :3200 / :5185 / :5186 and `127.0.0.1:5432` were still listening afterwards. The cluster and the worktree `database/dev/.env` symlink were removed.

| Gate | SHA | Result | At (AEDT) |
| --- | --- | --- | --- |
| `apps/api` `tsc -b` | `75b08fa` | PASS | 20:01:57 |
| management-web `test:node` | `75b08fa` | **405 tests, 402 pass, 0 fail, 3 skipped** (unchanged vs `88a72e6`) | 20:01:59 |
| `pnpm run test:contract` | `75b08fa` | **116/117**. The only failure is the pre-existing `operation-fixture-parity` list (`every declared operation has a fixture, or a named debt`). | 20:02:29 |
| F6 exit-evidence (`rt5-f6-module-privileges.test.ts`) | `75b08fa` | **13/13 pass**, including P3-5 item 13 | 20:02:36 |
| Focused body-parse (`tests/integration/body-parse-errors.test.ts`) | `75b08fa` | **1/1 pass** — unauthenticated malformed JSON → 400 `invalid-request`, `__proto__` → 400 `refused`, body > 1 MB → 413 `request-too-large`; no 500; warn logs with `kind` and no `stack`; valid `{}` still 401 | 20:02:37 |
| `pnpm run test:integration` | `75b08fa` | **562/572 pass, 10 fail: the known ten only** (one more passing test than `88a72e6`'s 561/571 — the new body-parse test). Failure titles unchanged (listed below). | 20:04:38 |

## Official gates (merged product `88a72e6`)

All rows are on product SHA `88a72e6dace4627a8a964d22b2b208eb4dc63a33`. Private cluster `/tmp/pemo-fc`, 2026-11-20 18:38:58–18:42:20 AEDT. Unchanged from v1.1.

| Gate | SHA | Result | At (AEDT) |
| --- | --- | --- | --- |
| management-web `typecheck` | `88a72e6` | PASS | 18:39:09 |
| management-web production `build` | `88a72e6` | PASS | 18:39:13 |
| `apps/api` `tsc -b` | `88a72e6` | PASS | 18:39:09 |
| management-web `test:node` | `88a72e6` | **405 tests, 402 pass, 0 fail, 3 skipped** (D1 `7395c1b` was 401 pass / 404 tests / 3 skipped; R9 added node tests) | 18:39:15 |
| `pnpm run test:contract` | `88a72e6` | **116/117**. The only failure is the pre-existing `operation-fixture-parity` list (`every declared operation has a fixture, or a named debt`). Eight uncovered operations remain; `sendStrataChargeInvoiceEmail` is covered by the 503 fixture. | 18:40:09 |
| `grants-complete` (`REQUIRE_DB=1`) | `88a72e6` | PASS — role model holds for module logins (BYPASSRLS, CREATEDB, CREATEROLE, SUPERUSER), 63 tables, SELECT+INSERT per module, plus documented extra: `strata.email_outbox` UPDATE (columns) | 18:39:19 |
| `premise-arm-guard` (`REQUIRE_DB=1`) | `88a72e6` | PASS | 18:39:40 |
| F6 exit-evidence (`rt5-f6-module-privileges.test.ts`) | `88a72e6` | **13/13 pass**, including P3-5 item 13 (case named commands refuse a foreign `organization_id`) | 18:40:16 |
| Focused D1 / F-2 / P3-1 | `88a72e6` | **1/1**, **1/1**, and **3/3** pass | 18:39:11 / 18:40:18 / 18:40:17 |
| `pnpm run test:integration` | `88a72e6` | **561/571 pass, 10 fail: the known ten only** (listed below) | 18:42:19 |
| `pnpm --filter @pemo/api run check:dependencies` | `88a72e6` | PASS after module dists were built (see deviations). Output: | 18:39:11 |

```
✔ no dependency violations found (363 modules, 1436 dependencies cruised)
‼ 2 known violations ignored. Run with --no-ignore-known to see them.
```

Known ten integration failures (unchanged titles vs v0.12 / D1 v0.15.1):

1. BITING — database state disappearing after a restart is caught (`biting-tests.test.ts`)
2. F2 — 0145 keeps historical duplicates; down refuses while pending, sending or unknown rows exist (`p1-f2-send-key-migration.test.ts`)
3. the seeded magnitudes are UNCHANGED — interests are additive, no household added (`party-interest-seed.test.ts`)
4. D7 — the Novatek case: five occupied units, the company holds the tenancy, occupants hold NO interest (`party-interest-seed.test.ts`)
5. D7 — occupancy WITHOUT interest and interest WITHOUT occupancy both exist, which is the whole point (`party-interest-seed.test.ts`)
6. F1 as a tested STATE — the contradiction is CONSTRUCTED in a test, never seeded (`party-interest-seed.test.ts`)
7. the total is the PRODUCT of the basis, not a number anybody typed (`seed-basis.test.ts`)
8. households are NOT units — vacancy is non-zero at every block (`seed-basis.test.ts`)
9. the corpus-stated fact is a FACT, and the rest are inventions (`seed-basis.test.ts`)
10. invoice email records a log-transport outbox row when SMTP is unset (F-6 smtp-vs-log)

## Playwright (standard runner)

The comparison uses the same command and config Surfaces and R&T used for 1812 passed / 14 failed / 5 skipped on `9776ff9`, recorded in `rt-independent-9776ff9_v1.0.md` and in `grok-evidence-d288904/scripts/pw.sh` / `grok-evidence-9776ff9/raw/pw-cand.json`.

From a fresh detached worktree (`/tmp/pw-88a72e6` and `/tmp/pw-9776ff9`; Surfaces' worktree was not used):

```
pnpm install --frozen-lockfile --offline --ignore-scripts
cd apps/management-web
pnpm run build
```

Then, with `apps/management-web/playwright.config.ts` unchanged (no `webServer`; the harness binds `listen(0, '127.0.0.1')`):

```
cd $CLONE/apps/management-web
PLAYWRIGHT_JSON_OUTPUT_NAME=… npx playwright test --reporter=json --workers=6
```

No `VITE_API_BASE` override, no custom dist, no custom API, no Postgres. `ss -ltn` was taken first; reserved live ports were still listening after. Temporary worktrees were removed afterwards. Lists were kept under `/tmp/pw-cmp/`.

| SHA | When (AEDT) | Passed | Failed | Skipped | Flaky | Total |
| --- | --- | --- | --- | --- | --- | --- |
| `88a72e6` (merged product tip) | 18:57:08–19:00:18 (190 s) | **1812** | **14** | **5** | **0** | 1831 |
| `9776ff9` (R9 tip) | 19:00:22–19:03:31 (189 s) | **1812** | **14** | **5** | **0** | 1831 |

Diff by test name (`file > title > project`):

1. Fail on `88a72e6` but pass on `9776ff9` — merge regressions: **0**
2. Fail on `9776ff9` but pass on `88a72e6`: **0**
3. Fail on both: **14**

The 14 (identical on both SHAs, sorted):

1. `dense-cells.spec.ts > dense cells > Chinese and Latin break differently, and both stay in the column > screens`
2. `front-counter.spec.ts > live source: the Bearer goes with every call, the log is read from the API, and a refused session is said > screens` (timed out at 30 s)
3. `notices.spec.ts > Notices is in the nav, once, and the nav stayed flat > screens`
4. `scope-rail.spec.ts > picked Block A filters households and help-desk fixture rows > screens`
5. `state-matrix.spec.ts > state matrix > adminRoles · matrix · en > screens`
6. `state-matrix.spec.ts > state matrix > adminRoles · matrix · zh-Hans > screens`
7. `state-matrix.spec.ts > state matrix > adminRoles · matrix · zh-Hant > screens`
8. `state-matrix.spec.ts > state matrix > visitorLog · detail · en > screens`
9. `state-matrix.spec.ts > state matrix > visitorLog · detail · zh-Hans > screens`
10. `state-matrix.spec.ts > state matrix > visitorLog · detail · zh-Hant > screens`
11. `state-matrix.spec.ts > state matrix > visitorRegister · blank · en > screens`
12. `state-matrix.spec.ts > state matrix > visitorRegister · blank · zh-Hans > screens`
13. `state-matrix.spec.ts > state matrix > visitorRegister · blank · zh-Hant > screens`
14. `state-matrix.spec.ts > the states that had to be got right > a Portfolio-level grant renders — the form a scope check descends from > screens`

Skipped sets were identical (five `live-properties.spec.ts` tests). No flaky or retried results (project `retries` is 0; each failure is a single attempt). Suite composition was identical (0 tests present on only one SHA).

Artifacts on amd128:

- `/tmp/pw-cmp/summary.txt`
- `/tmp/pw-cmp/diff.txt`
- `/tmp/pw-cmp/fails-88a72e6.txt` and `fails-88a72e6-names.txt`
- `/tmp/pw-cmp/fails-9776ff9.txt` and `fails-9776ff9-names.txt`
- raw JSON: `/tmp/pw-cmp/pw-88a72e6.json`, `/tmp/pw-cmp/pw-9776ff9.json`

## Deferred

Consolidated from the run notes on this tree (`p1-fix-round3` v0.10/v0.12, `rt5-f6-testrun_v0.13`, `batch-c-d1-testrun` v0.14/v0.15.1) and the latest R&T P3s named for this candidate. R9 is no longer deferred (it is merged here). The 503 `communications-unavailable` OpenAPI/`problem-types` declaration recorded as interim debt in v0.15 is closed (v0.15.1).

- Body-parse P2 interim contract debt: types `refused` and `request-too-large` are emitted but not in `problem-types.json`; 413 is unimplemented in OpenAPI; body-parse 400 is undeclared on `sendStrataChargeInvoiceEmail` and `sendNoticeEmail`. Fold in at the next management-web contract change (MINOR).
- Latest R&T P3s named for this candidate: missing 200/503 fixtures; resend not in OpenAPI; `check:dependencies` needs a built strata `dist`
- `email-send-forbidden` remains an undeclared staff mail type (not added to the registry or debt lists)
- Contract `operation-fixture-parity`: eight uncovered operations remain (down from nine after the invoice-email 503 fixture)
- The known ten official-integration failures, including F-6 invoice smtp-vs-log
- Playwright: the 14 failures named above (identical on `88a72e6` and `9776ff9`; no merge regressions)
- F6 P3-2, P3-3, P4
- Batch B leftovers still named as deferred in the F6 note: P3-1 mid-walk 410 UI restart; P3-2 `/properties/tree` 15 s snapshot vs live `/scope` walks; `/scope` row order; page size default and max of 2,000; `getResidents` fan-out and the per-ticket helpdesk query; RT5-F12
- N2: empty `limit=` means default
- N3: `/notices` unbounded (notice-list paging)
- Physical relocation of `strata.email_outbox` (after-MVP)
- 403/404 oracle (carried in Batch B v0.10 / v0.12)
- Remainder of Batch C (anything not P3-1, P3-5, or D1 F-1..F-5)

## Deviations

- Official contract and integration commands exit non-zero because of the known fixture-parity debt and the known ten, same shape as D1 v0.15.1 and as the `88a72e6` run. They were not "fixed." Integration is 562/572 rather than 561/571 only because the new focused body-parse test is part of the suite and passes.
- `check:dependencies` was run after `tsc -b` of `apps/api` and sibling modules (including strata) so dists existed. The gate passed (363 modules, 1436 dependencies, 2 known violations ignored). The standing R&T caveat that the gate needs a built strata `dist` still applies to a tree without those dists.
- No history rewrite, no squash, no push, no worktree reset. No amendment of source branches.

