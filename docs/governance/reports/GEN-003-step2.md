# GEN-003 v1.1 — Step 2: the caught edges

**PID:** GEN-003 v1.1 · **Write scope:** `apps/api/.dependency-cruiser.cjs`, `docs/governance/bin/prove.sh`, the governance docs the F1 grep touches, this PID's front-matter.
**Status:** **HARD STOP before the combined commit.** Nothing staged, nothing pushed. Two files changed, both in scope.

---

## The caught edges — the whole proof that the tool can see

```
no-module-to-module:      modules/property/src/hierarchy/tree-queries.ts → modules/access/src/types.ts
no-simulator-in-runtime:  apps/api/src/wiring.ts → modules/home-safety/dev-simulator/src/main.ts
```

Both from **0 → 1 → 0**: clean, inject, caught and named, remove, clean again. **Step 1's zero for `no-simulator-in-runtime` is no longer void** — the rule has been seen firing on a real edge, so a zero from it now means something.

## 1. Why the graph was blind — three causes, not one

Step 1 found the config could not resolve. Fixing that was necessary and left the graph still blind. The full chain:

| # | cause | symptom | fix |
|---|---|---|---|
| 1 | `tsConfig.fileName` cwd-relative while `extends` resolves from the config's dir | `TS5083` from every cwd | `require('node:path').join(__dirname, 'tsconfig.json')` |
| 2 | every module-to-module import is `import type` | type-only edges invisible | `tsPreCompilationDeps: true` |
| 3 | the packages publish only `types` + `default` conditions | 14 `@pemo/*` `couldNotResolve` | `conditionNames: [...,'types']` |
| **4** | **`exclude: { path: '(^|/)dist/' }`** | **0 cross-module edges — the edge is deleted, not the file** | **`doNotFollow` instead of `exclude`** |

**Cause 4 is the one that mattered and it was invisible until 1–3 were fixed.** Every workspace import resolves through the target package's `dist/` via its `exports` map. `exclude` removes a module from the graph entirely, so the *edge* disappeared with it: `no-module-to-module` and `no-simulator-in-runtime` were structurally incapable of firing on any real cross-module import. `doNotFollow` keeps `dist/` visible as an edge **target** while never cruising into it.

Measured progression, each step from the previous:

| configuration | deps | unresolved | cross-module edges visible |
|---|---:|---:|---:|
| committed | — | — | tool will not start |
| + `__dirname` | 598 | 14 | 0 |
| + `tsPreCompilationDeps` | 773 | 48 | 0 |
| + `conditionNames` | 725 | **0** | 0 |
| + `doNotFollow` for `dist/` | 783 | 0 | **22** |

A zero in the last column with zero in the third would have been the perfect false green: resolves everything, sees nothing.

**This middle state is the worked instance behind the caught-edge rule, and it goes on the record as such.** With `conditionNames` added and `doNotFollow` not yet, the tool resolved every specifier, reported a clean run, and could not see a single cross-module edge. Every surface signal said healthy. **The requirement to see a real edge caught, before trusting any zero, is what stopped a resolves-everything / sees-nothing configuration from shipping green.** No principle was added for it — the control is the done-when, and the done-when fired.

## 2. The rule fix

`no-module-to-module` gained the back-reference its capture group was always for:

```js
to: { path: '^modules/', pathNot: '^(modules/platform/|modules/$1/)' },
```

32 violations → 0, and all 32 were intra-module false positives. With the graph now able to see real edges, that 0 is a measurement rather than an artefact — which is exactly what the caught edge above licenses.

## 3. The F1 guard — and it failed twice before it worked

Domain: **execution surfaces only** — `*.sh`, `Makefile`, `package.json`, `.github/workflows/*.y*ml`, `bin/`. Never `*.md`. That single scoping settles both Step-1 conflicts: the closed `DOC-002-step2.md` mention is markdown and is not matched, so **rule 7 needs no exception**; and prose that bans the string is not matched either.

**Scoping alone was not enough, and the battery caught that.** Two self-matching failures, in order:

1. Scoped to execution surfaces, matching any `npx `: it flagged **its own explanatory comment** inside `prove.sh`.
2. Excluding comment lines: it still flagged **its own case labels** — `"npx guard fires on an execution surface"` is a string in a `.sh` file.

The working matcher requires `npx` at a **command position** — line-leading, after a YAML `run:` or `- `, after a shell operator, or opening a `package.json` script value — and drops comment lines:

```
(^[[:space:]]*(-[[:space:]]+)?(run:[[:space:]]*)?|[;&|][[:space:]]*|":[[:space:]]*")npx[[:space:]]
```

Verified against each surface type — a real invocation in `bin/a.sh`, a `run:` step in a workflow, a `package.json` script all match; a `# npx quux is banned` comment does not.

## 4. The battery

19 cases, run where the toolchain exists (the proven export):

```
19 passed, 0 failed
```

The three new boundary cases assert a **caught edge and its rule name**, not an exit code — depcruise exits with its violation count, so asserting "1" alone would pass on the wrong rule firing. Each asserts `1` **and** `no-module-to-module` / `no-simulator-in-runtime` by name. The battery restores both injected files from its snapshot; verified afterwards against `origin/main` — both byte-identical, no plant file left.

## 4b. Pre-flight: a killed run is caught at the next start, not at build time

The boundary cases mutate **real source**. The trap covers `EXIT INT TERM HUP`; `SIGKILL` is uncoverable. Such a leftover is **self-catching** — an injected cross-module or simulator import is precisely a violation the guard that injected it fires on, so it cannot pass a later battery. But self-catching means *caught at build time*. The pre-flight makes it caught at the **next start**:

```
ABORT: apps/api/src/wiring.ts differs from origin/main before the run started.
       A previous battery was killed mid-mutation and its injected import is still in the tree.
       Restore it from origin/main, then re-run. Refusing to proceed.
```

Exit **9**. Proven by planting one leftover: silent on a clean tree, and it named **only** the file actually altered.

**It failed once first, and the failure is worth recording.** The first version compared `sha256` of `git show origin/main:<path>` output without checking git's exit status. Where the ref was unreadable, `git show` printed nothing, and the hash of nothing is a perfectly good hash that matches no file — so it aborted on **both** targets including one nobody had touched. It now keys on git's exit status and skips loudly per target when the ref cannot be read. A pre-flight that cries wolf gets disabled, which would have cost the check entirely.

## 5. CI now runs the guards — and the one line that makes closing safe

Under the narrow scope extension, `.github/workflows/governance.yml` gains exactly two things: a `toolchain` step (`corepack enable`, `pnpm install --frozen-lockfile`, `pnpm --filter @pemo/api build` — the guards resolve `@pemo/*` through each package's `dist/`, so the workspace must be built or they have nothing to resolve), and `REQUIRE_DEPCRUISE: '1'` on the battery step.

**`REQUIRE_DEPCRUISE=1` is why closing is safe.** Without it a missing toolchain makes the boundary cases skip and the job goes green while the two invariants never execute. With it, a guard that cannot run turns CI **red**. That is the `--require-git` lesson one layer up.

Nothing else in the file moved: `permissions: contents: read`, the two-step shape, and the no-write contract all stand — verified, 0 write/push/commit steps and 0 bare-name `npx` invocations.

**Unverified until it runs.** I cannot execute the GitHub runner locally. The guards passed *where the toolchain exists*; CI is where it might not. Per principle 10, when the first run goes red, separate the **infrastructural** red (checkout / corepack / install / build absent — fix the runner) from the **substantive** red (a guard fired on a real violation — read the code). Neither ever licenses dropping `REQUIRE_DEPCRUISE=1` or loosening a rule to obtain green.

## 5b. Closing GEN-003 broke the battery, and the battery said so

Rule 7 moved `pids/GEN-003.md` to `archive/`. Six cases then mutated a file that no longer existed — `sed` on a missing path changes nothing, `grep -v` writes nothing — so the guards "passed" by doing nothing and the run reported **12 passed, 7 failed**.

**The battery hard-coded `GEN-003.md` as its mutation victim.** That is frozen-axis inside the very tool built to catch defects: a hand-written reference correct only for the state it was written in. It survived exactly as long as the PID it named.

Fixed by **deriving** the victim from `pids/` at runtime — first in-flight PID, with its type, number and the complementary type all computed, and an abort (exit 10) if `pids/` is empty. Re-run with GEN-003 closed: **19 passed, 0 failed**, the victim now being UI-004.

Two things worth stating plainly. It failed **loudly** rather than passing vacuously — six mutations that changed nothing produced six red lines, not six greens; had the assertions been "no fault raised" instead of an exact exit code, all six would have passed while testing nothing. And it was caught **only** because closing GEN-003 happened before the commit rather than after it.

## 6. Gaps — this list is complete

1. **CI does not run the boundary guards** (§5). Needs `pnpm install --frozen-lockfile` and `REQUIRE_DEPCRUISE=1` in the workflow — outside v1.1's scope.
2. **Nothing is committed.** Two files changed: `apps/api/.dependency-cruiser.cjs`, `docs/governance/bin/prove.sh`.
3. **The battery mutates real source files** (`tree-queries.ts`, `wiring.ts`). Trapped since GEN-005; `SIGKILL` remains uncoverable, so a hard kill leaves an injected import in real source. Bounded two ways: such a leftover is **self-catching** (it is a violation the injecting guard fires on), and §4b's pre-flight now aborts at the **next start** rather than at build time.
8. **The two boundary targets are still named literals** in `BOUNDARY_TARGETS` and in the injection cases — §5b's fix derived the *register* victim, not these. They are real source paths chosen because a cross-module and a runtime file are needed; if either is renamed, those cases mutate nothing and the pre-flight skips them loudly per target. Named as the residue of the same class rather than left implicit.
4. **`tsPreCompilationDeps: true` widens what the other rules see.** `no-deep-import`, `no-module-imports-app` and `no-contract-writes` now also see type-only imports. All are at 0, but they were never measured under the old configuration, so their zeros are new measurements — not confirmations of an earlier result.
5. **Two PIDs remain owed**, held until v1.1 closes as instructed: the schema-coupling runtime check (F5), and the `verify-boundaries.ts` PASS-string correction (F2).
6. **`no-simulator-in-runtime` answers only the import question.** Nothing outside `dev-simulator/` imports it; that is now a trustworthy zero. The `dev_scaffold` data coupling is untouched and belongs to the owed PID.
7. **`status:` on GEN-003 is still `draft`.** Unchanged: register content is the Brain's.

## 7. What the Brain is asked to rule

1. **Release the combined commit** — config fix + rule fix + resolver fix + guard + battery, as one change.
2. **§5 — CI.** Widen v1.1 by one line to cover `.github/workflows/governance.yml`, or issue it as a third owed PID? Leaving CI green-while-blind is the one outcome that should not stand.
3. **Gap 4** — accept the three other rules' zeros as new measurements under a wider lens.

**HARD STOP.**
