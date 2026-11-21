# GEN-008 — Step 1: assessment and proposals

**PID:** GEN-008 v1.0 · **Write scope:** `docs/governance/**` and `.github/workflows/governance.yml`. Read-only elsewhere.
**Status:** **HARD STOP.** Nothing built. **Check C as specified cannot be built** — §4 explains why and proposes a different signal, tested against history.

---

## 1. Pin and exact paths

| | |
|---|---|
| **Pin (analysis)** | `1c59d623ab2f15fdfb5d17e30b63317b50eaf6dc` / tree `99ee8d1989d16f45f3973dd147362fa6c146370f` / 760 files |
| **`main` now** | `d45c8d90235e7f6bb07aaeb4a5fac62e3b9f5ef9` — the GEN-008 allocation, 761 files |
| **Number** | **008** from `--next`; next is 009 |

Paths Step 2 would touch, all in scope: `docs/governance/PID-PRINCIPLES.md`, `docs/governance/bin/prove.sh`, `.github/workflows/governance.yml`, and — if §3 is ruled that way — one new sibling script under `docs/governance/bin/`.

## 2. Check A — derive the injection targets

Today, `prove.sh:138` and `:226,233`:

```
BOUNDARY_TARGETS="modules/property/src/hierarchy/tree-queries.ts apps/api/src/wiring.ts"
```

Two literal committed-source paths. Rename either and the injection mutates nothing, the guard reports clean, and the battery passes while testing nothing — the frozen-axis shape that already broke the register victim when `GEN-003` closed.

**The derivation is constrained, not free.** A victim must satisfy real conditions:

- **cross-module victim** — a `.ts` under `modules/<A>/src/` where some other module `<B>` (`B ≠ A`, `B ≠ platform`, since platform is exempt from `no-module-to-module`) exposes an importable file. Candidates today: 5 modules carry `src/types.ts`.
- **simulator victim** — a `.ts` on a **runtime** path under `apps/api/src/`, excluding `src/testing/` and the dev seam, or the injected import lands somewhere the rule deliberately tolerates. 30 candidates today.

**Proposed derivation**, deterministic and stable: sort module directories; take the first module with `src/types.ts` as the import **target**; take the first *other* non-platform module's alphabetically-first `src/**/*.ts` as the **victim**. For the simulator, the alphabetically-first `apps/api/src/**/*.ts` excluding `testing/` and `dev-seam`. Abort loudly (like the register victim's exit 10) if either cannot be found, rather than silently skipping the case.

**Its red:** rename a target; the battery still finds a victim and both edges still fire.

## 3. Check B — where it belongs. Recommendation: **both, split by role**

The assertion needs `pnpm run migrate` and `pnpm run seed`, so it needs Postgres, the workspace installed and built. That is a materially heavier dependency than anything in the battery today — **`prove.sh` currently contains zero database references.**

| home | fits | against |
|---|---|---|
| CI job step | CI already installs and builds; a `services: postgres` block is standard and cheap | invisible locally — the executor who breaks a seed learns from CI, not from the battery they run |
| battery case | one command tells you everything, local and CI | drags a DB requirement into a script that has none, and a local run without Postgres would skip — the failure mode this check exists to remove |
| its own PID | isolates the DB dependency | a fourth PID noticing the same class instead of closing it; principle 11 argues against |

**Proposal — split by role, one implementation.** A single script `docs/governance/bin/seed-reproduces.sh` performs `migrate; seed` against a database named by `PEMO_DB_*` and asserts a complete world (a non-empty `dev_scaffold.screen_content` and a non-empty `home_safety.safety_event` — the two tables the pre-fix abort left at **0**, so the assertion is anchored on the measured symptom, not on "no error"). Then:

- **CI** gains a `services: postgres:17-alpine` block and runs it with `REQUIRE_DB=1`, so an absent database is **red**, never green.
- **`prove.sh`** gains one case that invokes the same script and, exactly as `REQUIRE_DEPCRUISE` does, **skips loudly** locally when no database is reachable and is **fatal** under `REQUIRE_DB=1`.

That keeps one implementation, gives CI the hard gate, and gives local runs a loud line rather than a silent pass. It is the shape already ruled correct for depcruise, applied to the same problem.

**Its red:** inject an F1-shaped omission into a scenario seed; the script fails loudly and names the constraint. Remove it; it passes. And with the database absent under `REQUIRE_DB=1`, it fails rather than skipping.

## 4. Check C — **as specified it cannot be built**, and here is the signal that can

### The blocker

The spec says: *if every path in its `write-scope` is already at `main` with no diff*. **`write_scope` is free prose, not machine-readable paths.** Every value in the register today:

| PID | `write_scope` |
|---|---|
| GEN-001 | `docs/governance/** and the index generator, on branch \`rewrite\`. Nothing else.` |
| GEN-005 | `docs/governance/** and CI config for the --check job only` |
| GEN-006 | `a NEW migration under database/migrations/, modules/access/** and its tests. Read-only everything else.` |
| GEN-007 | `the management-scenario seed file(s) under database/seeds/ that omit serving_scope_label_* (Home Safety — …)` |
| DOC-002 | `none — READ-ONLY. Output is reports/DOC-002-step*.md only.` |
| **UI-004** | `rewrite/UI/** only — .dc.html artboards + per-screen brief + divergence notes.` |

GEN-007's scope is a *predicate over file contents*. DOC-002's is `none`. **UI-004's is a G-drive path that is not in the repository at all** — "already at `main` with no diff" is not even meaningful for it. A parser over this would be a heuristic that is wrong in ways nobody could predict, which is principle 2's cry-wolf failure built deliberately.

Making `write_scope` structured is the alternative, and I am not proposing it here: it would mean a second field beside the prose one (two homes for one decision) or rewriting every PID's scope into globs — a register-wide schema change well outside this PID.

### The signal that works: the commit trail

Every commit in this repository ends with `[PID-ID]`. That convention is **100% reliable across all 11 commits** since the register landed — verified, not assumed.

Naive form — *any tagged commit ⇒ warn* — **is useless**: a PID's own allocation commit is tagged with its id and lands while it is `draft`, so it would warn on every PID immediately. That is the cry-wolf failure again, at a 100% false-positive rate.

**The discriminator: a tagged commit that touches paths outside `docs/governance/`.** An allocation or a close is register-only; product code is the signal.

**Tested as a decision at every commit in history, not read off:**

| commit | subject | warns |
|---|---|---|
| `763b686` | allocate GEN-005 | — |
| `8a40eb9` | GEN-005 ships product code | **GEN-005** |
| `e9ed8ef` | close GEN-005 | — |
| `621eb7e` | re-issue GEN-003 v1.1 (register-only) | — |
| `514015e` | GEN-003 ships **and closes** in one commit | — |
| `be31105` | allocate GEN-006 | — |
| `3d879d9` | **GEN-006 ships product code** | **GEN-006** |
| `d94cc4c` | allocate GEN-007 | **GEN-006** |
| `d647032` | GEN-007 ships **and closes** | **GEN-006** |
| `1c59d62` | close GEN-006 | — |

**Zero false positives across 11 commits.** It fires on exactly the two real merged-but-undrafted windows: GEN-006 for three commits — the drift that actually happened — and GEN-005 for one, which was the same condition briefly.

### What it cannot distinguish, stated plainly

It cannot tell **"landed and awaiting its close"** from **"landed step 2 and legitimately continuing"**. GEN-005's single-commit warning is exactly that ambiguity: correct, and indistinguishable from a healthy multi-step PID mid-flight. So it **warns and never fails**, and its message says which two states it is between — the same honesty the orphan guard carries.

Second blind spot, named because it is the load-bearing assumption: **it depends entirely on the `[PID-ID]` commit convention.** A commit that omits the tag is invisible to it. Nothing enforces that convention today; whether it should be enforced is a separate decision I am not folding in.

## 5. Principle placements

All four into `docs/governance/PID-PRINCIPLES.md`, matching the existing sectioning:

| # | principle | section |
|---|---|---|
| 1 | specific expected outcome vs "no fault" | *On proving* |
| 2 | false-positive rate is a safety property | *On proving* |
| 3 | all preconditions before any mutation | *On proving* |
| 4 | merging and closing are two acts | *On boundaries and homes* |

Counted and grepped after, as the GEN-005 carry did: 38 → **42**.

## 6. Gaps — this list is complete

1. **Nothing built.**
2. **Check C's signal is not what the spec named.** §4 proposes a different one; the spec's version is not buildable and I have not built a weaker approximation of it.
3. **Check C rests on an unenforced convention** (§4). If a commit omits its tag, the check is blind and says nothing.
4. **Check B's CI form is unproven against the GitHub runner** — the same standing caveat as the existing workflow. A `services:` block is standard, but it has not run here.
5. **Check A's derivation is deterministic but arbitrary** — "alphabetically first" is stable and has no meaning. If the derived victim is later a file where an injected import is legitimate, the case would break; the abort-loudly clause is what surfaces that rather than hiding it.
6. **I did not assess whether `prove.sh` is becoming too large** to remain one script. It is 19 cases today and Step 2 would add three.

## 7. What the Brain is asked to rule

1. **§4 — Check C's signal.** Accept the commit-trail discriminator in place of the `write_scope` parse, with its two named blind spots. Or rule that `write_scope` becomes structured (a register-wide change, a different PID).
2. **§3 — Check B's home.** The split — one script, CI hard-gates it with `REQUIRE_DB=1`, the battery skips loudly without a database.
3. **§2 — Check A's derivation rule**, and abort-loudly when no victim can be derived.
4. **§5 — the four placements.**
5. **Gap 3** — is the `[PID-ID]` commit convention worth enforcing, or does Check C simply document its dependence on it?

**HARD STOP.**
