# DOC-002 — Step 2: the reuse map

**PID:** DOC-002 v1.0 · **Pin:** `360fca77c807c0e85c54d12901af40547317f12d` · tree `627184ffea364aa971396a11e2f3e1625b370938` · 714 files
**Write scope:** none. READ-ONLY. The repository was not written to.
**Status:** HARD STOP. Awaiting the Brain's ruling on the verdict set.

---

## 0. How this was run, and the proof it was run against the pin

`git archive 360fca77 | tar -x` into the session scratchpad. The export was then proven to *be* the pin rather than assumed to be:

```
git write-tree over the extracted files -> 627184ffea364aa971396a11e2f3e1625b370938   (the pin's tree)
the drifted local checkout 9f4756b's tree -> be5a547fdd0eac4b8f612f76b1379e5e10cf1bb2   (differs, as it must)
git status --porcelain --untracked-files=no in the export -> empty
```

A dedicated throwaway PostgreSQL 17 container was used on port **55439** — never the shared `pemo-dev-db`, never the shared working tree. Toolchain: Node v24.19.0, pnpm 11.21.0, `pnpm install --frozen-lockfile` clean.

**One methodological note that changed a result.** The export initially had no `.git`. Three integration test files shell out to `git`, so they failed for a reason that had nothing to do with the code under test. A `.git` was therefore constructed *in the export* with `HEAD` and `refs/remotes/origin/main` both at the pin and object storage borrowed via `alternates`. Both runs are reported below, because the difference between them **is** finding F3.

### Commands run, and their results

| Command | Result |
|---|---|
| `pnpm --filter @pemo/api migrate` (empty database) | **exit 0** — 31 migrations applied from nothing |
| `pnpm --filter @pemo/api seed` | **exit 1 — FAILED.** See F1 |
| base seeds applied individually (10 files) | **all 10 ok** |
| `pnpm --filter @pemo/api test:contract` | **exit 0 — 105 pass, 0 fail** |
| `pnpm --filter @pemo/api test:integration` (no `.git`) | **exit 1 — 7 named failures**, all git-shelling |
| `pnpm --filter @pemo/api test:integration` (`.git` at pin) | **exit 0 — 163 pass, 0 fail** |
| `pnpm --filter @pemo/api verify:boundaries` | **PASS — module boundaries hold at all four layers** |
| `node tests/fixtures/validate.mjs` | **exit 0 — PASS**, failure set equals the 2 declared open gaps exactly |
| `node packages/api-contracts/contract-hash.mjs` | resident `v0.3.4`, management `v0.1.5`, resident-portal `v0.1.0` |
| `pnpm --filter @pemo/management-web test:node` (no prior build) | **exit 1 — 19 fail markers.** See F9 |
| `pnpm --filter @pemo/management-web build` then `test:node` | **exit 0 — 98 pass, 0 fail** |
| `pnpm --filter @pemo/management-web test:browser` | **exit 0 — 204 passed, 5 skipped.** See F7 |
| same, with `PEMO_LIVE_*` set and the API running | **exit 0 — 209 passed, 0 skipped** |
| `pnpm --filter @pemo/resident-portal build` + `test:node` | **exit 0 — 62 pass, 0 fail** |
| `pnpm --filter @pemo/resident-portal test:browser` | **exit 0 — 26 passed** |
| `apps/resident-mobile` — any Dart/Flutter suite | **NOT RUN.** No `flutter`, no `dart` on this host |

---

## 1. The reuse map

Verdicts are per unit. `KEEP-AS-IS*` marks the one provisional verdict the Brain authorised (tests not run).

| # | Unit | Files | Verdict | Evidence — a path, not a sentence |
|---|---|---:|---|---|
| U01 | `(root)` workspace config | 7 | **KEEP-AS-IS** | `pnpm install --frozen-lockfile` clean from `pnpm-lock.yaml`; every suite below runs off `pnpm-workspace.yaml` + `tsconfig.base.json`. ADR-004. |
| U02 | `packages/api-contracts` tooling | 3 | **REFACTOR** | `docs/adr/ADR-008…md` amended 3× in-line (`:111` API-016-ST, `:119` API-017-ST) and again at `:161` Amendment A4, which supersedes its own Decision 4 single-hash lock. `contract-hash.mjs` runs green — the mechanism works, the decision has scars. |
| U03 | `…/resident-mobile` contract | 5 | **REFACTOR** | `contract-lock.json` at `v0.3.4`; carries `severity.json` + `severity.md` that the other two surfaces do not — the ADR-005/008 D3 stamping asymmetry. |
| U04 | `…/management-web` contract | 3 | **REFACTOR** | `v0.1.5`. Same versioning mechanism; `openapi.yaml` `ScopeTreeNode.summary` is declared and never emitted (F6). |
| U05 | `…/resident-portal` contract | 3 | **REFACTOR** | `v0.1.0`. Same mechanism, newest surface. |
| U06 | `modules/access` | 6 | **REFACTOR** | `database/migrations/0112_access_scope_grant.up.sql:59-64` — exclusion key is `(principal_id, node_kind, node_id, tstzrange)`. `docs/adr/ADR-010…md` D4 requires `role` to join that key; **the table has no `role` column at all**. The authority-spine gap, in schema. |
| U07 | `modules/home-safety` | 11 | **KEEP-AS-IS** | Exercised green by `tests/integration/adr-006-provenance-and-resolution.test.ts`, `tenancy-negative.test.ts`, `tests/contract/severity-and-envelope.test.ts` (163+105 pass). `src/ports.ts` inverts the property/resident dependency — `verify:boundaries` `no-module-to-module` ok. |
| U08 | `modules/home-safety/dev-simulator` | 3 | **DROP** | `dev-simulator/README.md:1-3` — "A development fixture. Not a product component, not an integration." Writes projections straight into `home_safety`, bypassing U09. Per D01, excised. |
| U09 | `modules/integration` | 6 | **KEEP-AS-IS** | `tests/integration/adr-006-provenance-and-resolution.test.ts` green. `src/resolution/as-at-resolution.ts` is the sole home of as-at semantics; `package.json` `//unwired` records the deliberate non-wiring. |
| U10 | `modules/platform` | 12 | **KEEP-AS-IS** | `src/migration/runner.ts` applied 31 migrations to an empty database, exit 0. `tests/integration/platform-and-operations.test.ts` green (with `.git`). |
| U11 | `modules/property` | 14 | **KEEP-AS-IS** | `tests/integration/property-model.test.ts`, `property-tree-expansion.test.ts`, `estate-summary-basis.test.ts`, `scope-list-filtering.test.ts` all green. `src/repository/property-repository.ts:7` declares `search_path=property,pg_catalog`; `verify:boundaries` `no-cross-schema-sql` ok for every file. |
| U12 | `modules/resident` | 7 | **REFACTOR** | `database/migrations/0114_resident_party_and_interest.up.sql` lands party/interest, which the rewrite sequences behind the authority spine. Tests green (`party-interest.test.ts`, `party-interest-seed.test.ts`), so this is coupling, not breakage. |
| U13 | `apps/api` | 43 | **REFACTOR** | Two independent reasons: the scaffold excision reaches `src/wiring.ts:70,119,172` and three projections (F4); and `src/server.ts:162-168` emits a resident-surface problem type as the global 404 (F5). Composition layer itself is sound — 105 contract assertions green. |
| U14 | `apps/management-web` | 74 | **REFACTOR** | 98 node + 209 browser assertions green. Coupled to the fixture corpus: `src/data/corpus.g.ts` and two Playwright specs hard-code `3 blocks · 812 units`, which nothing computes (F6). `DIVERGENCES.md` is a live divergence ledger, not a finished state. |
| U15 | `apps/resident-mobile` | 134 | **KEEP-AS-IS\*** | **PROVISIONAL — tests NOT run.** No `flutter`/`dart` on this host. Substance: `lib/data/live_repository.dart` + `lib/data/clock.dart` implement the two-clocks layer; 27 committed goldens under `test/golden/goldens/`; `test/rules/rule01_offline_never_green_test.dart` encodes the safety rule. Contract `v0.3.4` matches U03. **To be verified on a Flutter host or at its migration PID.** |
| U16 | `apps/resident-portal` | 85 | **KEEP-AS-IS** | 62 node + 26 browser assertions green. `test/data/policy-absence.test.ts` and `test/boundary/residue-scan.test.ts` prove it renders no data *on purpose*; `package.json` description records the API-027-ST gate. A shell that is complete as a shell. |
| U17 | `database/migrations` | 62 | **REFACTOR** | 31 pairs apply cleanly from empty (exit 0). Three carry decisions: the `0090` pair is excised per D01; `0112` lacks `role` (U06); `0113_home_safety_resident_text_nullable` is an amendment patch to `0030`-era schema. |
| U18 | `database/seeds` | 63 | **REFACTOR** | **Split verdict, and the reason the unit is not KEEP-AS-IS.** The 10 base seeds are the strongest reuse case in the tree — verified below. But `scenarios/management__mob-s1-safety__default.sql` and `__partial.sql` are **broken at the pin** (F1), and 15 scenario files write into the schema D01 excises. |
| U19 | `database/dev` | 3 | **KEEP-AS-IS** | `docker-compose.yml` + `.env.example` were the basis of the throwaway container used for every result above. Carries no credential. |
| U20 | `tests/contract` | 8 | **REFACTOR** | 105 assertions green — but 33 of them evaporate when the excised scaffold is removed (F4, measured). `PARITY-STEP-CRITERIA.md` is a live criteria doc. |
| U21 | `tests/integration` | 24 | **REFACTOR** | 163 assertions green with `.git`; `credentials-and-config.test.ts`, `migration-numbering.test.ts`, `platform-and-operations.test.ts` shell out to `git` and go red without it (F3). |
| U22 | `tests/fixtures` | 115 | **REFACTOR** | `validate.mjs` exits 0 with a declared-gap set matched by **equality, not superset** (`declared-open-gaps.json:$comment`) — exemplary. But `resident-mobile/mob-02-home/*` and `mob-03-services/*` transcribe scaffold-sourced content (F4), and every fixture re-stamps on a version bump (ADR-008 A4's own complaint). |
| U23 | `docs/adr` | 12 | **REFACTOR** | ADR-008 carries 4 amendments in-line; ADR-010 is `Proposed` with 3 open questions (`:107-131`). Rewrite convention is amendments folded in, one clean ADR each. |
| U24 | `docs/architecture` | 11 | **REFACTOR** | `module-catalogue.md` states a module count the tree contradicts (F8). |
| | **TOTAL** | **714** | | 24 units, matching the pin exactly |

---

## 2. The counts

Unit-weighted (the Step 1 gate) and file-weighted (the migration-planning column the Brain asked for).

| Verdict | Units | Files | File share |
|---|---:|---:|---:|
| KEEP-AS-IS | 7 | 138 | 19.3% |
| KEEP-AS-IS\* (provisional, U15) | 1 | 134 | 18.8% |
| REFACTOR | 15 | 439 | 61.5% |
| DROP | 1 | 3 | 0.4% |
| **Carries (KEEP + REFACTOR)** | **23 / 24** | **711 / 714** | **99.6%** |

**Read the two columns as different questions, because they disagree.** *Is the repo worth keeping?* — 23 of 24 units, 711 of 714 files: yes, decisively, and D01 is well supported. *How much re-typing is avoided?* — only **272 files (38.1%) carry unchanged**; **439 files (61.5%) need work**. The unit column and the file column are not two views of one number.

**A caution on the 38.1%.** Half of it — 134 files — is U15 `apps/resident-mobile`, whose verdict is provisional and untested. If U15 does not hold up on a Flutter host, the unchanged share falls to **138 files (19.3%)**. The single largest input to the file-weighted figure is the one thing this session could not run.

---

## 3. Flagged findings — reusable on their tests, failing a boundary check

The PID asks for these even where tests pass. Nine.

### F1 — The seed does not reproduce from nothing. `pnpm run seed` fails at the pin.

The strongest principle in `PID-PRINCIPLES` ("reproducible from nothing… verify by building a fresh database from migrations + seeds alone") does not hold at this pin.

All 31 migrations and all 10 base seeds apply. Then `database/seeds/scenarios/management__mob-s1-safety__default.sql:48-62` fails:

```
error: new row for relation "safety_event" violates check constraint
       "serving_scope_audience_is_explained"
```

The INSERT's column list (`:49-54`) sets `location_class='common_area'` and `audience_source='serving_scope'` but **omits `serving_scope_label_en` / `serving_scope_label_zh_hant`**, which `database/migrations/0032_home_safety_events.up.sql:60-62` requires to be NOT NULL exactly when `audience_source = 'serving_scope'`. Reproduced in isolation with `psql -v ON_ERROR_STOP=1`. `…__partial.sql` fails identically. Scanned: those are the only two of the 52 scenario files with this shape.

The database constraint is right. The seed is wrong. This is the schema enforcing a rule the fixture author did not know about — the constraint working as designed, years after being written.

### F2 — …and no test applies those two files, which is why F1 survived.

`applyScenario` (`apps/api/src/testing/harness.ts:94-103`) is called only with `mob-*` screens — `fixture-parity.test.ts:28-41`, `tenancy-negative.test.ts`, `openapi-conformance.test.ts`, `error-surface.test.ts`, `resident-boundary-scan.test.ts`. **No caller passes a `management__*` screen.** The only code that applies them is `apps/api/src/cli/seed.ts:58-60`, which no test invokes.

What does test them is `tests/integration/scenario-inventory.test.ts:50` — "every management scenario file the bindings name is **present**". Presence, not execution. `tests/fixtures/management-web/index.json:26,46` names both files as its scenario. So the suite proves the file exists and the manifest points at it, and nothing ever runs it. This is *"X exists" is not evidence* — the exact failure the PID's own evidence rule was written against — sitting inside the test suite.

### F3 — Three integration test files assert repository state and go red outside a git checkout.

`tests/integration/platform-and-operations.test.ts:271,305`, `credentials-and-config.test.ts:150,162`, `migration-numbering.test.ts:66,96,120` shell out to `git merge-base HEAD origin/main` and `git check-ignore`. Named failures include *"this PID wrote only inside its exclusive scope"* and *"no secret is committed anywhere in this PID's scope"*.

Measured both ways: **7 failures without `.git`, 0 with `.git` at the pin** — same code, same database, same commands. These assert *the state of the working copy and its governance process*, not the behaviour of the software. They are PID-era scaffolding that outlived its PID, and they make the suite un-runnable from any export, tarball, or container build.

### F4 — The scaffold's own removal note is false, and the excision D01 ruled is 33 files, not 6.

`apps/api/src/scaffold/screen-content.ts:9-11` states: *"No module depends on it, so removing it touches this file and one migration."*

That claim does not hold at this pin. `grep` for `dev_scaffold|screenContent|screen-content` returns **33 files**, including three composition projections that read it for product content:

- `src/composition/home-projection.ts:39-41` — MOB-02's `notices`, `openCase`, `quickServices` sections
- `src/composition/services-projection.ts:46-47` — MOB-03's entire service catalogue and coming-soon note
- `src/composition/degraded.ts:27` — the degraded state for **every** screen
- `src/wiring.ts:70,119,172` — constructs the reader and its `dev_scaffold` `ModuleDb`
- 15 scenario seed files that INSERT into `dev_scaffold.screen_content`
- `src/cli/verify-boundaries.ts` (whitelists the schema), `.dependency-cruiser.cjs`

**Proven by making it fail.** With the contract suite green at 105/105, `DROP SCHEMA dev_scaffold CASCADE` and re-run:

```
105 pass, 0 fail   ->   89 pass, 33 fail
error: relation "dev_scaffold.screen_content" does not exist
```

All 33 are `fixture parity — mob-02-home/*` and `mob-03-services/*`. Restoring the schema and re-running returns **105 pass, 0 fail**, so the 33 are attributable to the removal and to nothing else.

**This bears directly on D01.** Excising the scaffold is not deleting 6 files. It removes the data source behind MOB-02 Home and MOB-03 Services and the degraded state of every screen, and turns 33 contract assertions red until those sections have a real owner. The scaffold was correctly labelled and correctly fenced; what was not correct is the estimate of what removing it costs. That estimate is what a migration PID would have planned against.

### F5 — The API's global 404 emits a resident-surface problem type on the management surface.

`apps/api/src/server.ts:162-168` sets `app.setNotFoundHandler` to `problems.eventNotFound()` for every unmatched route. Verified against the running API:

| Request | `Problem.type` returned |
|---|---|
| `/api/management-web/v0/…` (valid) | *200, correct payload* |
| `/management/scope` | `…/problems/event-not-found` |
| `/nonexistent-xyz` | `…/problems/event-not-found` |

`packages/api-contracts/problem-types.json` (`contractVersion 0.3.4`) registers `event-not-found` with **`surfaces: ["resident"]`** and the summary *"No such safety event, or its existence must not be disclosed to this resident."* A management-web client that mistypes a path receives a **resident-facing safety message**: `"This alert is not available to you." / "您無法查看此警報。"`

The registry already contains the right types — `record-not-found` (`surfaces: ["management","resident-portal"]`) and `scope-not-found` (`surfaces: ["management"]`). This is an ADR-009 surface-boundary violation with a correct fix already registered, and the contract suite is green over it.

### F6 — `3 blocks · 812 units` is hard-coded in three places and computed in none.

`src/data/corpus.g.ts` and the specs `test/browser/live-properties.spec.ts:23` and `test/browser/tree-collapse.spec.ts:14` carry the literal. Against the live API:

```
GET /api/management-web/v0/properties/tree
-> 918 nodes: 1 estate + 3 buildings + 102 floors + 812 units
-> nodes carrying a `summary` field: 0
```

The world holds the figure exactly — the tree returns precisely the **812** residential units, and `database/seeds/15-property-wing-fu-garden-magnitude.sql:26` computes that total from the declared basis rather than typing it (verified in §4). `ScopeTreeNode.summary` is declared in the management `openapi.yaml`. So the number is derivable, is declared in the contract, and is nonetheless transcribed by hand into a generated corpus and two assertions. `DIVERGENCES.md:55` classifies the gap as "cosmetic only", which is true of the pixel and not of the provenance.

### F7 — The live integration layer is default-off, and its absence is silent.

`test/browser/live-properties.spec.ts:18-20` reads `PEMO_LIVE_BASE_URL`, defaulting to `''` and skipping. A default `pnpm test` reports **204 passed, 5 skipped** and exits 0. Supplying the env and running the API gives **209 passed** — the tests are real and they pass. But the newest and least-proven layer in the repository is the one a default run does not exercise, and a skip that costs nothing to ignore is a skip that will be ignored.

### F8 — The module count disagrees three ways. Carried, not reconciled, per the Brain.

`docs/architecture/module-catalogue.md` — **17** canonical modules (computed by parsing the table). `pnpm-workspace.yaml` — "the sixteen-module catalogue", **16**. The tree — **6** implemented. Reported as found; the Brain owns the reconciliation.

### F9 — `pnpm test` fails on a clean checkout of `apps/management-web`.

`package.json` defines `test` as `test:node && test:browser`, with no `build`. Nine artefact assertions read `dist/` — *"the build output exists and is non-trivial"*, *"NO reference to the development toolbar survives the production build"*. On a clean export: **19 fail markers**. After `pnpm run build`: **98 pass, 0 fail**. The assertions are correct and valuable; the script does not state its own precondition, so a first-time run reports failure of the production-exclusion guarantee when nothing is wrong with it.

---

## 4. The strongest reuse case, verified rather than asserted

`database/seeds/15-property-wing-fu-garden-magnitude.sql:26` — *"812 is not typed anywhere below. It is what 8×35 + 7×22 + 9×42 comes to."*

Built from an empty database (migrations + base seeds only) and queried:

| Block | Residential floors | Residential units | Basis |
|---|---:|---:|---|
| `blk_wfg_a` | 35 | 280 | 8 × 35 |
| `blk_wfg_b` | 22 | 154 | 7 × 22 |
| `blk_wfg_c` | 42 | 378 | 9 × 42 |
| | | **812** | |

Parking 236 (118+52+66) and storage 41 (17+11+13) reconcile to the file's own `812 residential + 236 parking + 41 storage` at `50-party-and-interest-demonstration.sql:35`; total rows 1089.

**One discrepancy investigated rather than smoothed over.** A first query returned 36/23/43 floors per block — one more than the basis states in each case. The extra floor is `G/F` in every block, carrying only `parking`/`storage` units (135/63/79). The basis counts residential floors; the extra floor is the non-residential one. Consistent, and explained — not reconciled by assumption.

This is the principle working end to end: a declared basis, a computed total, and a fresh database that reproduces it.

---

## 5. Gaps — this list is complete

1. **U15 `apps/resident-mobile` was not tested.** 134 files, 6 Dart test files, 27 goldens. No `flutter`/`dart` on this host. Its `KEEP-AS-IS*` is on substance only and is **18.8 points of the 38.1% unchanged figure** — the largest single uncertainty in this report.
2. **F1 blocks the full seed path, so no result here covers the management scenario overlays.** Every result above is from migrations + the 10 base seeds + `mob-*` overlays, which is what the suites themselves apply.
3. **`git`-dependent assertions (F3) were satisfied with a synthetic `.git`** whose `HEAD` and `origin/main` both point at the pin. That makes "this PID wrote only inside its exclusive scope" trivially true. Those three files are reported green under that qualifier, not green unconditionally.
4. **`dependency-cruiser` was not run** — `npx depcruise` failed on tsconfig resolution from the export root and there is no package script for it. The four-layer boundary claim rests on `verify:boundaries`, which passed. `.dependency-cruiser.cjs` rule `no-simulator-in-runtime` is therefore **unverified by execution** at this pin.
5. **`tests/fixtures/validate.mjs` reports "Scenario binding … 34 pending"** — declared, not silent, and inside its own PASS. Named here because it is a carried gap and this list is complete.
6. **Verdicts are against in-repo ADRs at the pin**, per the Brain's ruling. Flagged as would-flip under a consolidated rewrite decision: **U06** (ADR-010 D4 `role`), **U12** (party/interest sequencing), **U02–U05** (ADR-008 A4 consolidation), **U23** (amendment folding). Not silently resolved.
7. **Verdicts are per unit.** Sub-unit REBUILD content exists inside REFACTOR units — F4's scaffold is the worked example. The file column in §2 is the closest available proxy and is not a substitute for per-file migration planning.
8. **No performance, security, or licence assessment was made.** Outside the PID.

---

## 6. What the Brain is asked to rule

1. **The verdict set** — 7 KEEP-AS-IS, 1 KEEP-AS-IS\*, 15 REFACTOR, 1 DROP, as the input to the `GEN-002`+ migration PIDs.
2. **F4 changes the shape of D01's excision.** The scaffold is not 6 deletable files; removing it costs MOB-02 Home's notices/open-case/quick-services, MOB-03 Services' catalogue, every screen's degraded state, and 33 contract assertions. Does the rewrite branch excise it **and** re-own those sections, or does the scaffold stay until Notices/Help Desk/Resident Services land?
3. **F1 and F2 together are a defect and a hole in the method** — a broken seed and a test suite structured so nothing could catch it. New PID, or folded into a migration PID?
4. **F5** is a live surface-boundary leak with the correct problem types already registered. New PID, or carried into the API migration PID?
5. **F3** — do the repo-state assertions carry onto the rewrite branch, be rewritten as CI-only checks, or be dropped?
6. **U15 must be verified on a Flutter host** before its 134 files count as carrying unchanged.

**HARD STOP.**
