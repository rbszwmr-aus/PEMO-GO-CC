# GEN-003 v1.1 — Step 1: the config resolution, proposed and proven

**PID:** GEN-003 **v1.1** · **Write scope:** `apps/api/.dependency-cruiser.cjs`, `docs/governance/bin/prove.sh`, the governance docs the F1 grep touches, and this PID's own front-matter.
**Status:** **HARD STOP before any fix.** The resolution below is proposed and proven in an isolated export; **nothing under `apps/api/` has been modified.** The only repository write is the v1.1 re-issue itself.

*This supersedes the v1.0 Step 1 report of the same name. Its findings stand; §4's obstacle now has a proven resolution and two further defects are added.*

---

## 1. Pin, isolation, and the exact config path

| | |
|---|---|
| **Commit** | `621eb7edc74f91bac2d6a37068068f7ef04fc482` (v1.1 re-issue) |
| Step-1 analysis ran at | `e9ed8ef12fea8d39132ff369bc1a494ac0725e0a` / tree `17a62f7b08f272fd576490ef456cd77c5da41af8` / 743 files |
| Export proof | `git write-tree` over the export = `17a62f7b…` = the pin's tree |

**The exact depcruise config path, as asked, not guessed: `apps/api/.dependency-cruiser.cjs`.** It is the only dependency-cruiser config in the repository. The tool is `dependency-cruiser@16.10.4`, a devDependency of `apps/api` alone; the root `node_modules/.bin` has no `depcruise`.

## 2. The config resolution — proposed, and proven by making it fail

**Root cause.** `options.tsConfig.fileName` is `'apps/api/tsconfig.json'`, resolved relative to **cwd**. `apps/api/tsconfig.json` contains `"extends": "../../tsconfig.base.json"`, which dependency-cruiser resolves relative to **the config's own directory**, looking for `apps/api/tsconfig.base.json` — a file that has never existed. `tsConfig.fileName` needs cwd = repo root; the `extends` needs cwd = `apps/api`. No cwd satisfies both; three were tested and all fail.

**Proposed resolution — one line, portable, no wrapper:**

```js
// apps/api/.dependency-cruiser.cjs
tsConfig: { fileName: require('node:path').join(__dirname, 'tsconfig.json') },
```

The config is a `.cjs` module, so `__dirname` is `apps/api` wherever it is invoked from. That makes `fileName` absolute and cwd-independent, and the `extends` then resolves from the tsconfig's real directory. **No wrapper script, no inlined base config, no `tsConfig` removal** — the three loosenings v1.0 Step 1 refused.

**Proven, not asserted.** The done-when is that the *full extends chain* resolves, so the chain was broken deliberately:

| state | result |
|---|---|
| fixed config, `tsconfig.base.json` present | **runs** — 250 modules, 595 dependencies cruised |
| fixed config, `tsconfig.base.json` renamed away | `TS5083: Cannot read file '<root>/tsconfig.base.json'` |
| restored | runs again |

The failure names the **root** path — the correct target — which is what shows the chain is genuinely followed rather than skipped. Under the committed config the same error named `apps/api/tsconfig.base.json`, the wrong target.

Command used throughout (F1: local binary by explicit path, never `npx`):

```
apps/api/node_modules/.bin/depcruise --config apps/api/.dependency-cruiser.cjs apps modules packages
```

## 3. Two further defects, both found while proving §2

### F4 — after the fix, `@pemo/*` workspace specifiers still do not resolve, and the graph has no cross-module edges at all

With the config fixed **and** the workspace built (`pnpm run build`, exit 0, five module `dist/` trees present, `modules/platform/dist/index.js` confirmed on disk, pnpm symlinks confirmed at `apps/api/node_modules/@pemo/*`):

```
250 modules, 595 dependencies cruised, 32 violations
unresolved: 14  {@pemo/platform: 9, @pemo/access: 2, @pemo/home-safety: 1, @pemo/property: 1, @pemo/resident: 1}
genuine cross-module edges in the graph: 0
```

**Zero cross-module edges is not a clean boundary — it is an unresolved one.** Every module-to-module import in this repository is written as a bare `@pemo/*` specifier (`import type { ModuleDb } from '@pemo/platform'`), and all 14 of those are `couldNotResolve`. The edges that `no-module-to-module` and `no-simulator-in-runtime` exist to catch are the exact edges the tool cannot see.

This is a **second empty oracle**, distinct from the first. v1.0's zero came from a tool that could not start. This one would come from a tool that starts, runs, reports, and is blind to the only edges that matter. It is more dangerous because it looks like a result.

**Consequence for v1.1's done-when:** the simulator red (inject an import, see it caught) must be injected as an edge the tool can actually resolve, and if a bare `@pemo/*` import cannot be made to resolve, that is itself the finding — layer 3 cannot enforce the rule it declares.

### F5 — `no-simulator-in-runtime` and F4's blast radius are two different questions, and only one is an import question

GEN-003 asks whether any runtime path reaches "`modules/home-safety/dev-simulator` **or** the `dev_scaffold` schema/reader". Those are not the same shape:

- **The simulator** is reached by an *import*. Statically, **nothing outside `dev-simulator/` references it by path** — grep over `apps/` and `modules/` returns nothing. That is consistent with it being run as its own entry point.
- **The `dev_scaffold` schema** is reached by *data*. `apps/api/src/scaffold/screen-content.ts` is ordinary app code importing `@pemo/platform` and issuing SQL against a schema. **No import graph can see that**, at any configuration — it is layer 4's territory, which is `verify:boundaries` plus the database checks, not dependency-cruiser.

So F4's `DROP SCHEMA` → 33-fail evidence will **not** be reproduced by fixing dependency-cruiser, and a clean `no-simulator-in-runtime` would not contradict it. They are compatible facts about different couplings. v1.1's done-when 1 offers "reproduce F4's DROP SCHEMA → 33, or introduce a real cross-module import" — the second is the one this tool can discharge; the first belongs to layer 4.

## 4. The record: where the broken rule was cited, named rather than assumed

Per the ruling: find where `no-module-to-module` was leaned on, do not assume nowhere.

| citation | verdict |
|---|---|
| `DOC-002-step2.md` §3: *"`pnpm --filter @pemo/api verify:boundaries` → **PASS — module boundaries hold at all four layers**"* | **Stands.** This came from `apps/api/src/cli/verify-boundaries.ts`, **not** from dependency-cruiser. Its own `no-module-to-module` filters `spec !== '@pemo/platform' && spec !== '@pemo/${owner}'` — it **has** the same-module exemption depcruise's rule lacks, so it is correctly written. |
| `DOC-002-step2.md` gap 4: *"`dependency-cruiser` was not run … `no-simulator-in-runtime` is therefore unverified by execution"* | **Stands, and was already correct.** DOC-002 disclosed the gap rather than claiming the rule green. |
| `DOC-002-step1.md`: module-boundary enforcement mapped to `verify-boundaries.ts` + `.dependency-cruiser.cjs` | **Stands as a map**, but see below. |

**One claim needs qualifying, and it is a wording claim, not a false green.** `verify-boundaries.ts` prints *"PASS — module boundaries hold at all four layers"* and **does not mention the simulator at all** — zero occurrences of `simulator` in the file. `no-simulator-in-runtime` exists only in the depcruise config. So "all four layers" covers layers 1, 2, 4 and *part* of layer 3; the simulator rule within layer 3 is not implemented there. DOC-002 reported the tool's own output faithfully and separately disclosed the depcruise gap, so no DOC-002 claim is void — but the **tool's own PASS string overstates its coverage**, and that string is what a future reader will quote.

**No claim is reopened. One is qualified.** `verify:boundaries`' PASS is real for what it checks and does not cover the simulator rule.

## 5. Two conflicts in the F1 scrub, for ruling before Step 2

1. **`DOC-002-step2.md` still contains the `npx depcruise` string** (gap 4). DOC-002 is **closed**, and rule 7 says a merged PID is not reopened. Editing a closed PID's filed report to remove a footgun is a direct conflict between rule 7 and F1's scrub. I have not touched it. Options: leave it and rely on the grep-guard exempting historical reports; annotate rather than edit; or rule that a supply-chain hazard overrides rule 7 for this one string.
2. **The grep-guard must distinguish an instruction from a prohibition.** GEN-003 v1.1's own text quotes `npx depcruise` in order to ban it, and this report does the same. A naive grep for a bare-name `npx` will flag the ban itself. The guard needs to match an *invocation* — e.g. a fenced code block or a line beginning with the command — not any mention. Proposed for Step 2, flagged now because it changes what the check is.

## 6. Gaps — this list is complete

1. **Nothing is fixed.** `apps/api/.dependency-cruiser.cjs` is untouched at the pin; §2's proof used a generated copy in the export.
2. **Both reds are unfired.** v1.1's done-when 1 and 2 are Step 2 work. Step 1's zero for `no-simulator-in-runtime` remains **void**.
3. **F4 may be unresolvable**, and if so the honest outcome is "layer 3 cannot enforce its own rules on this repository's import style", not a green. No method is proposed yet; diagnosing it is Step 2's first task.
4. **The 32 violations are still all intra-module false positives** — unchanged by the config fix, since F2 is a rule defect, not a resolution defect.
5. **This report and the v1.1 ruling are on the drive only.** v1.1's scope covers the governance docs the grep touches; whether that extends to carrying `reports/` in is not settled, so I have not.
6. **`GEN-003`'s `status` is still `draft`** though it is running. Left alone: status is register content and the Brain authors it, and v1.1's scope over "this PID's own front-matter" was granted for the version and scope fields.

## 7. What the Brain is asked to rule

1. **§2's resolution** — `path.join(__dirname, 'tsconfig.json')`, proven to resolve the full chain. Approve for Step 2.
2. **F4** — if `@pemo/*` cannot be made to resolve, is "layer 3 cannot enforce its declared rules" an acceptable terminal finding?
3. **F5** — confirm done-when 1 is discharged by the cross-module import, since F4's `DROP SCHEMA` evidence is layer 4's and not reachable by this tool.
4. **§5.1** — the `npx` string inside a closed PID's report: rule 7 or the scrub?
5. **§5.2** — the grep-guard matches invocations, not mentions.

**HARD STOP.**
