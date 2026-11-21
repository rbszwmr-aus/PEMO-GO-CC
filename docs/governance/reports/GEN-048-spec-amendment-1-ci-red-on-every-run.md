# GEN-048 — Amendment 1: CI is red on every main run; D2 becomes "make CI green and prove it gates"

Date: 2026-09-03. Filed before dispatch (rule from GEN-050 close F2).
Evidence: PO's Actions view — `governance` workflow red on every push #88 (15b26fc) … #93 (5ac8963), ~36–48 s each. Log excerpt from #93 (PO-copied): corepack/pnpm install succeeds (13 workspace projects, 151 packages, lockfile up to date), then `apps/api` `tsc -b` fails: TS2307 Cannot find module `@pemo/notices` (notice-acts.ts, notice-permissions.ts, server.ts, wiring.ts) and `@pemo/helpdesk` (case-acts.ts); two TS7006 implicit-any at server.ts:2432/2436 are downstream of the missing types. Exit 2 at `@pemo/api build`.

## Reading of the evidence (hypothesis for Main CC to confirm or refute from the files)
Only the two cut-A modules fail to resolve; `@pemo/access` and the rest resolve. On a fresh install pnpm links exactly what apps/api/package.json declares. The most plausible cause: `@pemo/notices` and `@pemo/helpdesk` were never added to `apps/api/package.json` as `workspace:*` dependencies (and/or to its tsconfig references) when N1/C1 wired them; locally they resolve through a node_modules that was never rebuilt from nothing. If that is the cause, CI has been red since the notices wiring merged (GEN-042 routes or earlier), and every "from-nothing rebuild green" line since is a claim about a stale node_modules.

## Rulings
R1 D2 is redefined: make the `governance` workflow green on main and prove it gates. Diagnose from the files, name the cause; fix the dependency declarations (a `pnpm install` on a clean checkout must link every module apps/api imports); no weakening of any job, no continue-on-error, no skipped step.
R2 The local from-nothing rebuild must actually be from nothing: prove.sh's rebuild step (or a documented `prove.sh --clean`) removes node_modules in every workspace and reinstalls with `--frozen-lockfile` before building, or runs in a fresh temporary clone. Bite: remove a declared workspace dependency from a package.json → the clean rebuild reds with TS2307 where the current one stays green. Principle: `a-rebuild-that-keeps-node_modules-is-not-from-nothing`.
R3 Boundary guard: dependency-cruiser (or the boundary check) reds when a package imports a workspace module it does not declare in package.json. Bite: import `@pemo/notices` from a package that does not declare it → red.
R4 PROVE: the GEN-048 merge run green; one deliberately broken push on a throwaway branch red at the named job, browser job included (quote the runner log line naming the browser + version); restore. Both run URLs in the report.
R5 Record: the date range during which CI was red and what it means for prior close reports ("CI green" statements are claims; the hook was the gate). No prior close is reopened — the hook's checks were real — but the record says so.
D1 (Flutter pin + gate resident-mobile) unchanged; lands with D2.
Report: cause, fix diff, before/after run URLs, R2/R3 bites, R5 date range. HARD STOP for the close ruling.
