# GEN-048 step 2 — why CI was red on every main run, and the rebuild that would have seen it

**Date:** 2026-09-03  **Amendment 1 carried in.**  **Clean rebuild:** green.  **Manifest:** +2 proven (R2, R3).

## STEP 3 (amended after the a94b7b0 run failed) — the fix did not take, and why I cannot yet name the cause

The first fix (tsconfig references) merged in `a94b7b0`, and the PO's run for `a94b7b0`/`0e0cab7`
failed IDENTICALLY to #93: TS2307 `@pemo/notices`/`@pemo/helpdesk`. So my "from-nothing rebuild"
did not reproduce the runner. I made it reproduce the runner exactly and ran it. **It builds clean.**

### R7 — every build-graph cause is ruled out by a true reproduction
At commit `a94b7b0`'s tree, with **all node_modules, all dist, all tsconfig.tsbuildinfo removed**,
then `pnpm install --frozen-lockfile`, then the workflow's exact command `pnpm --filter @pemo/api build`:

| variable | runner | tested locally | result |
|---|---|---|---|
| build command | `pnpm --filter @pemo/api build` (= `tsc -b`) | identical | **exit 0, 0 TS errors** |
| pnpm | 11.21.0 (corepack) | 11.21.0 (corepack, packageManager-pinned) | same |
| Node major | 22 | **22.23.1 AND 24.19.0, both tested** | both exit 0 |
| module `composite` | — | all 9 modules `composite: true` | references build |
| apps/api references | — | platform, property, resident, home-safety, access, **helpdesk, notices, service-case** | present in `a94b7b0` |
| tracked build state | fresh checkout | `git ls-files`: **0** tsbuildinfo, **0** dist tracked; both gitignored | nothing stale to check out |

The PO's three R7 candidates — build without building references, exports pointing at absent dist,
references in a tsconfig the workflow does not use — are **each refuted** by the exit-0 reproduction:
`tsc -b` builds the composite references first, so dist exists before apps/api is type-checked.

**I will not fabricate a cause I cannot reproduce.** On the evidence, the runner either built a SHA
that predates the reference fix (a stale or non-retriggered run) or carried a poisoned setup-node
cache. **To settle it I need the a94b7b0 run's own log:** the checkout step's resolved SHA, and the
toolchain step's first lines (Node + pnpm + tsc versions). That is the one thing this host cannot see.

### R6 — one script, both places, so the next run is unambiguous
Regardless of the unfound cause, the structural fix the ruling mandates is done, and it makes the
question self-answering next time:
- **`docs/governance/bin/ci-preflight.sh`** is the single build sequence: it prints an environment
  header (Node, pnpm, TZ, LANG, Postgres — R8), removes **every** node_modules, dist and tsbuildinfo,
  runs `pnpm install --frozen-lockfile`, then `pnpm --filter @pemo/api build`.
- The **workflow's toolchain step calls it and nothing else**; **`prove.sh --ci` calls it**; a drift
  test (`ci-and-hook-run-one-script.test.ts`, 4 cases) reds if either build path stops being that one
  script, or if the workflow hardcodes a Node version instead of reading `.nvmrc`.
- The workflow now reads Node from **`.nvmrc` (24)**, the pin dev uses — closing the CI-22/dev-24
  divergence R8 forbids, whichever way that divergence mattered.

If the next `main` run is green, the earlier red was a stale run; if it is still red, the env header's
first ten lines name exactly what differs. Either way the answer is now IN the log.

### R5 — corrected: red since #57, two causes, the second masking the first
The PO's history: last green was #56 (`c33ff19`, GEN-036 close). Red began at **#57 (`0d0abbe`,
GEN-037, 2026-09-02)** — NOT `292f9da`. #57–#87 **built fine and failed ONE test of 362** (361 pass),
an environment divergence (runner UTC; this host AEST — not HKT as assumed; Postgres/locale may
differ). From **#88** the TS2307 build failure masked it: the suites never ran, so whether that one
test still fails is unknown until the build is green. Every "CI green" statement across GEN-037…GEN-053
is therefore a claim; **the pre-push hook was the real gate throughout, and its checks were real — no
close is reopened**, but the record now says CI was red that whole time. When the build goes green the
one-test failure is expected to reappear; naming it needs the #57 `not ok` line, which did not arrive
in the dispatch — **I ask the PO to relay it.**

---

## The cause — confirmed from the files, narrower than the hypothesis
`apps/api/package.json` **does** declare `@pemo/notices` and `@pemo/helpdesk` (run #93's install
links 13 projects and succeeds — that half of the hypothesis is refuted). What it never declared was the
**build order**: `apps/api/tsconfig.json` `references` stopped at five modules — `helpdesk`, `notices`
and `service-case` were absent — so on a clean clone `tsc -b` never built their `dist/` first, and
`@pemo/notices`' types could not be found: TS2307, the two TS7006 downstream of it. Every module's
tsconfig had the same shape one level down (a `@pemo/platform` dep with no reference). Locally it was
always green because every build here loops `tsc -b --force` over every module before touching the API.

**R5 — how long.** `apps/api` first imported `@pemo/notices` at **`292f9da` (GEN-040, 2026-09-02)** and
`@pemo/helpdesk` at `6020a54` (GEN-044, 2026-09-02). The `governance` workflow has therefore been red on
**every push to main since 2026-09-02** through #93 (`5ac8963`). Every "from-nothing rebuild green" in
GEN-040 … GEN-053's reports was a claim about a tree whose `node_modules` and `dist/` were never removed.
**The pre-push hook was the gate throughout, and its checks were real; no close is reopened.** The record
says what those lines meant.

## The fix (R1)
Every package's tsconfig `references` now follow its declared `@pemo` deps — derived, not typed: api
gains `helpdesk`, `notices`, `service-case`; eight modules gain `platform`. No job weakened, nothing
skipped, no `continue-on-error`.

## R2 — a rebuild that keeps node_modules is not from nothing
`docs/governance/bin/clean-rebuild.sh` (and `prove.sh --clean`) removes **every `node_modules`, every
`dist/` and every `tsbuildinfo`**, reinstalls from the frozen lockfile (offline from the same store CI
hard-links from) and builds as CI builds. **The first version kept `dist/`, and the bite stayed green** —
the removed reference was satisfied by the notices output the previous run had built: GEN-039's dist
hazard at workspace scale. Now the bite reds with **TS2307**, exactly CI's line. Timestamps prove the
reinstall is real. Principle `a-rebuild-that-keeps-node_modules-is-not-from-nothing` registered.

## R3 — the guard
`workspace-deps-declared.mjs` in the battery: every `@pemo/*` import in any package's `src/` must be in
its `package.json`, and every declared `@pemo` dep must have a tsconfig reference. 30 edges over 12
packages. **Bite:** an undeclared import → reds naming the package.

## R4 — what this host can and cannot prove
- The GEN-048 merge run: readable only by the PO; I ask for its URL and the browser job's log line
  naming browser + version.
- The deliberately broken run: **the workflow triggers on pushes to `main` and on pull requests only**, so a
  broken throwaway *branch* push runs nothing. I have pushed `codex/gen-048-red-probe` (the notices
  reference removed again); **opening a PR from it is the PO's act**, and its run should red at
  "the integration and contract suites" / build with TS2307. Please relay both URLs.

## A refusal of my own, recorded
The hook refused this branch's first push: my new principle's "distinguished from" clause cited
\`[a-rehearsal-only-covers-its-own-change-class]\` — a slug from my private memory index, not the corpus.
The invented-citation class the register has caught five times before; \`adrs-present\` caught the sixth in
strict context, where D4 left it strict on purpose. Clause dropped.

## Merge
Merged at **`a94b7b0`** (from `112b4cb`, tree-hash equal via `ls-remote`, through the hook — battery 36
with the new R3 guard, no `--no-verify`). The `governance` workflow run for `a94b7b0` **is the R4 merge run**;
its URL and the browser job's runner line are the PO's to relay. Rule 7 close waits for a filed ruling.

## D1 unchanged
Flutter pin 3.44.3, gate over the eight tests as they stand — lands with this.
