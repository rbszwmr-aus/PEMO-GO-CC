# DOC-002 — Step 1: the pin, the unit list, the method

**PID:** DOC-002 v1.0 (Reuse audit: what code carries into the rewrite)
**Write scope:** none. READ-ONLY. This file is the only output.
**Status:** HARD STOP. Awaiting Brain ruling on (a) unit-list completeness, (b) the repo decision.

---

## 1. The pin

Re-pinned from `origin` at execution time. No hash written anywhere else was trusted; `git fetch origin main` was run first and the ref read afterwards.

| Field | Value |
|---|---|
| Remote | `git@github.com:rbszwmr-aus/PEMO.git` |
| Ref | `refs/remotes/origin/main` |
| **Commit** | `360fca77c807c0e85c54d12901af40547317f12d` |
| **Tree** | `627184ffea364aa971396a11e2f3e1625b370938` |
| Commit date | 2026-08-26T21:31:28+10:00 |
| Subject | `feat(management-web): S3 tree expand/collapse [057]` |
| **Tracked file count** | **714** |

Composition of the 714, computed from `git ls-tree -r` (not tallied): 712 mode-`100644` blobs, 2 mode-`100755` blobs, **0 gitlinks (mode `160000`)** — there are no submodules at this pin, so no sub-tree is excluded from the count.

Reproduce:

```
git fetch origin main
git rev-parse refs/remotes/origin/main          # -> 360fca7...
git log -1 --format=%T refs/remotes/origin/main # -> 627184f...
git ls-tree -r --name-only 360fca7 | wc -l      # -> 714
```

**Note, not asserted as safe:** the working tree this session ran in (`/home/luipt/projects/PEMO`) is at detached `9f4756b`, which `git merge-base --is-ancestor` confirms **is** an ancestor of the pin. The audit reads the pin by object hash, never the working tree, so the working tree's position does not affect any finding.

---

## 2. The unit list — 24 units, covering 714 of 714 files

The unit of audit is the package/module. Two rules were applied so the partition is checkable rather than tasteful:

1. Every unit is a directory prefix, so a file belongs to exactly one unit.
2. A directory with its own manifest or its own `tsconfig.json` is its own unit even when it sits inside another (this is why `modules/home-safety/dev-simulator` is separated from `modules/home-safety`, and why the three contract surfaces are separated from the contract tooling).

**Completeness is computed, not claimed:** every path from `git ls-tree -r --name-only <pin>` was run through the classifier below; the per-unit counts sum to 714 and the `UNASSIGNED` bucket is empty. If a unit were missing, files would land in `UNASSIGNED` and the total would not reconcile.

| # | Unit | Files | What it is |
|---|---|---:|---|
| U01 | `(root)` workspace config | 7 | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `.editorconfig`, `.gitignore`, `README.md` |
| U02 | `packages/api-contracts` (tooling + registry) | 3 | `contract-hash.mjs`, `stamp-version.mjs`, `problem-types.json` — the lock/stamp mechanism and the ADR-009 registry |
| U03 | `packages/api-contracts/resident-mobile` | 5 | `openapi.yaml`, `contract-lock.json`, `forbidden-terms.json`, `severity.json`, `severity.md` |
| U04 | `packages/api-contracts/management-web` | 3 | `openapi.yaml`, `contract-lock.json`, `forbidden-terms.json` |
| U05 | `packages/api-contracts/resident-portal` | 3 | `openapi.yaml`, `contract-lock.json`, `forbidden-terms.json` |
| U06 | `modules/access` | 6 | Identity and Access — staff principal, effective-dated scope grant, scope resolution |
| U07 | `modules/home-safety` | 11 | Home Safety — projection, events, audience resolution, acknowledgement, quarantine, ports |
| U08 | `modules/home-safety/dev-simulator` | 3 | Development-only projection writer; own `tsconfig.json`, no manifest |
| U09 | `modules/integration` | 6 | Integration Hub — vocabulary, severity policy, device→location mapping, as-at resolution. **Deliberately unwired** |
| U10 | `modules/platform` | 12 | Platform Foundation — config, db, envelope, problem, health, idempotency, logging, migration runner, outbox |
| U11 | `modules/property` | 14 | Property Core — hierarchy, Location, serving scope, availability, estate contacts |
| U12 | `modules/resident` | 7 | Resident and Household — resident queries, unit authorization |
| U13 | `apps/api` | 43 | Composition layer, HTTP server, CLIs, testing harnesses, boundary scanner, dev-only scaffold reader |
| U14 | `apps/management-web` | 74 | React 19 + Vite management shell, five read surfaces, token/corpus generators, node:test + Playwright suites |
| U15 | `apps/resident-mobile` | 134 | Flutter resident app — `lib/` (30), `test/` incl. 27 golden PNGs, `android/` + `ios/` platform scaffolding |
| U16 | `apps/resident-portal` | 85 | React 19 + Vite resident portal shell — navigation + design-system translation, renders no data |
| U17 | `database/migrations` | 62 | 31 up/down pairs, `0001`–`0114` |
| U18 | `database/seeds` | 63 | 10 base seeds + `scenarios/` (52) + `tools/` (2 generators) |
| U19 | `database/dev` | 3 | `docker-compose.yml`, `.env.example`, `README.md` |
| U20 | `tests/contract` | 8 | OpenAPI conformance, fixture parity, error surface, boundary scans, parity harness (+ criteria doc) |
| U21 | `tests/integration` | 24 | 23 DB-backed suites + 1 denylist JSON |
| U22 | `tests/fixtures` | 115 | Contract fixture corpus for the three surfaces + `validate.mjs` + two declared-gap manifests |
| U23 | `docs/adr` | 12 | ADR-001…ADR-010, an API-015-ST plan, README |
| U24 | `docs/architecture` | 11 | Module catalogue, 2IoThub boundary, logical architecture, dependency rules, security baseline, phased plan, etc. |
| | **TOTAL** | **714** | matches the pin's tracked file count exactly |

### Coverage against the PID's "cover at least" list

| PID asked for | Unit(s) |
|---|---|
| contract packages + governance tooling (lock/stamp, validator, generator, `problem-types`) | U02–U05; validator `tests/fixtures/validate.mjs` in U22; generators in U14/U16/U15 `tool/` and U18 `seeds/tools/` |
| scope/authorization model, effective-dated, differential test | U06; `database/migrations/0110–0112` in U17; `tests/integration/scope-differential-property.test.ts` in U21 |
| Property Core (hierarchy, Location, `serving_scope`, seed machinery) | U11; `0010–0014` in U17; U18 |
| module-boundary enforcement (the four layers) | U13 (`src/cli/verify-boundaries.ts`, `.dependency-cruiser.cjs`, `src/testing/boundary-scanner.ts`); `tests/integration/module-isolation.test.ts` in U21 |
| resident-mobile app + vertical slice | U15; U03; fixtures in U22 |
| management-web front end + backend foundations | U14; U04; U13; U10 |
| classification pipeline (2IoThub boundary, ADR-006 spine) | U09; `0100–0105` in U17; `docs/architecture/2iothub-boundary.md` in U24 |

**Outside that list, and therefore named as the PID requires:** U08 (`dev-simulator`), U16 (`apps/resident-portal` — an entire third front end the PID does not mention, 85 files), U19 (`database/dev`), U23 and U24 (the in-repo ADR and architecture corpus, 23 files, whose relationship to the rewrite's own `adr/` and `architecture/` folders is a decision, not an audit finding).

---

## 3. The audit method

**Everything is read at the pin by object hash** — `git show <pin>:<path>`, `git grep <pattern> <pin> -- <path>`, `git ls-tree -r <pin>`. Nothing is read from a working tree, so no other session's uncommitted state can enter a finding.

**Evidence rule.** A verdict line carries a path — a file, a file plus line number, an `operationId`, a migration plus line, or a test file. A sentence with no path is not evidence and does not appear.

**How KEEP-AS-IS will be proven in Step 2 — and the obstacle, stated now because it changes what Step 2 can deliver.**

The PID requires each KEEP-AS-IS verdict to show that module's tests green at the pin, as a command and its result. At this pin that is not a simple `pnpm -r test`, for four reasons that are facts about the tree, each verifiable:

1. **No module has tests of its own.** `git ls-tree -r <pin> -- modules/` returns 59 paths and not one is a test. Every `modules/*/package.json` has exactly two scripts, `build` and `clean`. The suites that exercise the modules live in `tests/integration/` (U21) and `tests/contract/` (U20) and are invoked from `apps/api`'s `test:contract` / `test:integration` scripts. So "that module's tests" must be read as "the suites in U20/U21 that exercise that module", and Step 2 will name, per module, which suite files those are.
2. **Those suites need a live PostgreSQL.** Both scripts run `node --env-file=../../database/dev/.env`, and `apps/api/package.json` records that they run `--test-concurrency=1` because they share one development database.
3. **`database/dev/.env` does not exist in the working tree** (it is git-ignored; only `.env.example` is tracked). It was verified absent by `ls -la database/dev/`.
4. **The `pnpm` install is not present per-package** — root `node_modules` exists, `apps/api/node_modules`, `apps/management-web/node_modules` and `apps/resident-portal/node_modules` do not.

Creating `.env` or running `pnpm install` inside `/home/luipt/projects/PEMO` would write into the repository working tree, which this PID may not do, and would do so in a tree shared with 30+ live worktrees. **Step 2 will therefore run the suites from a clean export of the pin outside the repository** — `git archive <pin> | tar -x` into the session scratchpad — against a **dedicated throwaway PostgreSQL container on an unused port**, not the running `pemo-dev-db`. The repository is not written to and no shared database state is disturbed. Toolchain confirmed present: Node v24.19.0, pnpm 11.21.0, Docker 29.1.3, Playwright browsers cached (`chromium-1234`), Noto CJK fonts installed (30 matching faces — `apps/management-web` and `apps/resident-portal` both refuse their browser suite without one).

**The one thing this environment cannot run:** neither `flutter` nor `dart` is on this host (`command not found` for both). U15 (`apps/resident-mobile`, 134 files) therefore **cannot be shown green here**, which under the PID's own rule means U15 cannot receive a KEEP-AS-IS verdict from this session on evidence. Step 2 will classify it on substance and mark the test-green gate as unmet-here rather than assert it.

**Boundary checks applied to every unit, independent of whether its tests pass.** Four scans, each with a named artefact:
- *reads another module's tables* — `git grep` for schema-qualified names per module, plus the `search_path` header each repository declares.
- *hard-codes a figure the seed should compute* — `git grep` for the corpus magnitudes against `database/seeds/15-property-wing-fu-garden-magnitude.sql`, which states the basis (`8×35 + 7×22 + 9×42`) and that the total is never typed.
- *asserts repository state* — `git grep` for `child_process`, `execFileSync`, `readdirSync` and git invocation across all suites.
- *dev-only affordance reachable from a production path* — the four exclusion mechanisms `apps/api` and `modules/home-safety/dev-simulator` each document.

---

## 4. First-cut count — the input to the repo decision

Provisional, at unit granularity, from the evidence gathered in Step 1 only. **This is a first cut and not the Step 2 verdict set.**

| Bucket | Units | Count | Share |
|---|---|---:|---:|
| **KEEP-AS-IS + REFACTOR** (carries) | U01–U07, U09–U24 | **23** | **95.8%** |
| **REBUILD + DROP** (does not carry) | U08 | **1** | **4.2%** |

Provisional split inside the carrying bucket: **KEEP-AS-IS candidates 7** (U01, U07, U09, U10, U11, U18, U19); **REFACTOR candidates 16** (U02, U03, U04, U05, U06, U12, U13, U14, U15, U16, U17, U20, U21, U22, U23, U24).

The four verdicts that carry the most weight, with the evidence already in hand:

- **U06 `modules/access` → REFACTOR.** `ADR-010` D4 (`docs/adr/ADR-010-role-list.md`, D4) requires `role` to enter the exclusion-constraint key. `database/migrations/0112_access_scope_grant.up.sql:59-64` builds that key as `(principal_id, node_kind, node_id, tstzrange(...))` — there is no `role` column in the table at all. The schema predates the decision. This is coupling to a re-sequenced identity/role decision, stated as a fact with a line number.
- **U02–U05 contract package → REFACTOR.** `docs/adr/ADR-008-contract-versioning-granularity.md` carries three in-line amendments (`API-016-ST` at line 111, `API-017-ST` at line 119) and a fourth, `Amendment A4` at line 161, which itself says ADR-008 "had been amended three times for its own mechanism and never for its purpose" and supersedes Decision 4's single-hash lock. That is the amendment-scar shape the REFACTOR verdict is written for.
- **U18 `database/seeds` → KEEP-AS-IS candidate, and the strongest reuse case in the tree.** `database/seeds/15-property-wing-fu-garden-magnitude.sql:26` — "812 is not typed anywhere below. It is what 8×35 + 7×22 + 9×42 comes to." A seed that computes its own total from a declared basis is exactly the principle the rewrite keeps.
- **U08 `dev-simulator` → the only DROP/REBUILD candidate at unit granularity.** Its own README calls it "a development fixture. Not a product component, not an integration", and it writes canonical safety projections directly into the `home_safety` schema, bypassing the Integration Hub that U09 exists to become. It is superseded the moment real ingestion lands.

### The caveat the Brain must weigh before reading 95.8% as "almost nothing to rebuild"

**Unit granularity hides sub-unit REBUILD.** No whole package is a wrong-first-attempt, but REBUILD-shaped content sits inside units classified REFACTOR. The clearest case is the fixture-parity scaffold: `database/migrations/0090_dev_scaffold_screen_content.up.sql:1-2` is headed "DEVELOPMENT-ONLY FIXTURE-PARITY SCAFFOLD. DELETE, DO NOT MIGRATE", and its reader `apps/api/src/scaffold/screen-content.ts:1-11` says "when they land it is DELETED rather than migrated". Two files inside two units that otherwise carry. Counting units answers *is the repo worth keeping*; it does not answer *how much re-typing is avoided*. If the repo decision needs the second number, Step 2 can report a file-weighted figure alongside the unit-weighted one — say so at this stop and it will be produced.

---

## 5. Gaps — this list is complete

1. **The rewrite's KEEP/REWRITE decisions do not exist yet.** The PID's task is to audit `origin/main` "against the rewrite's KEEP/REWRITE decisions". Those decisions were looked for and are absent: `rewrite/decisions/`, `rewrite/product/`, `rewrite/adr/`, `rewrite/architecture/`, `rewrite/integrations/`, `rewrite/archive/` and `rewrite/reports/` are all **empty directories** (verified by `ls`). `rewrite/UI/` holds only a `README.md`. In particular `decisions/authority-spine.md` — which `rewrite/README.md` names as "sequenced first; no write is contracted until this is Accepted" — does not exist, and neither does `product/function-scope.md`, which `00-START-HERE.md` puts in the mandatory read order. **Consequence:** REBUILD ("implements a decision that has since changed") is not decidable from the staging drive, because there is no record of which decisions changed. Step 2 will fall back to the in-repo ADRs' own recorded status — `ADR-010` is `Proposed` with three open questions; `ADR-008` A4 supersedes its own Decision 4 — and will label every such verdict as derived from in-repo evidence, not from a rewrite decision. **This is the one gap that can materially change Step 2's output, and it is a Brain input, not an executor call.**
2. **U15 `apps/resident-mobile` cannot be shown green on this host** — no `flutter`, no `dart`. 134 files, 27 golden PNGs, 6 Dart test files. Its KEEP-AS-IS gate is unmeetable here.
3. **Playwright browser suites in U14 and U16 are not yet proven runnable** at the pin. Browsers are cached and CJK fonts are present, so the prerequisites hold, but no suite has been executed yet — Step 1 executed no test.
4. **The module catalogue's count does not match the code, in two independent ways, and neither is reconciled here.** `docs/architecture/module-catalogue.md` lists **17** canonical modules (computed by parsing the table, not counted by eye). `pnpm-workspace.yaml` describes what `GEN-006-ST` populates as "the sixteen-module catalogue" — **16**. The tree contains **6** implemented modules. Both discrepancies are reported as found; a discrepancy of one between a document and its own restatement is exactly the kind that should be investigated rather than smoothed over, and it is outside this PID's write scope to do either.
5. **`apps/resident-portal` (U16, 85 files) is not named anywhere in DOC-002's "cover at least" list.** It is a complete third front end. It is in the unit list, and the Brain should confirm it is in scope before Step 2 spends a verdict on it.
6. **`packages/api-contracts` has no `package.json`** despite `pnpm-workspace.yaml` declaring `packages/*` a workspace glob and its own comment saying "API-005-ST owns `packages/api-contracts`". It is consumed by relative path, not as a workspace package. Reported as an observation; it does not block the audit.
7. **The `.env` / install / shared-database constraints in §3** are carried into Step 2 as a method change (clean export + throwaway container), not as unresolved risk.
8. **`git fetch origin main` was run against the shared repository.** It updated `refs/remotes/origin/main` and `FETCH_HEAD` and nothing else — no branch moved, no working tree or index changed, no worktree was touched. The PID directs this fetch explicitly. Disclosed because it is the only command this session ran that wrote a byte anywhere near the repository.

---

## 6. What the Brain is asked to rule

1. **Is the 24-unit list complete and correctly cut?** Specifically: the separation of `dev-simulator` (U08) from its parent, the four-way split of `packages/api-contracts` (U02–U05), and the inclusion of `docs/adr` + `docs/architecture` (U23/U24, 23 files) as auditable units rather than as reference material.
2. **The repo decision** — reuse the existing repository on a branch, vs. a new repository — off the **23 / 1** unit split (95.8% carries), with the §4 caveat that unit granularity does not measure how much re-typing is avoided. State whether a file-weighted second figure is wanted.
3. **Gap 1** — how Step 2 should classify REBUILD with no rewrite decision record to classify against. Proceed on in-repo ADR status as described, or wait for `decisions/authority-spine.md`.
4. **Gap 5** — is `apps/resident-portal` in scope.

**HARD STOP. No verdict is assigned and no further work proceeds until these are ruled.**
