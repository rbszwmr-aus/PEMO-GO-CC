# GEN-008 — Step 2: three checks built, four reds fired

**PID:** GEN-008 v1.0 · **Pin:** `d45c8d90` · **Write scope:** `docs/governance/**` and `.github/workflows/governance.yml`.
**Status:** **HARD STOP before commit.** Nothing staged. Five files, 0 outside scope.

---

## 1. Files

| file | change |
|---|---|
| `docs/governance/PID-PRINCIPLES.md` | five principles, 38 → **43** |
| `docs/governance/bin/pid-index.mjs` | Check C (warning) + `[PID-ID]` enforcement (**exit 7**) |
| `docs/governance/bin/prove.sh` | Check A derivation; Check B case |
| `docs/governance/bin/seed-reproduces.sh` | **new** — Check B's implementation |
| `.github/workflows/governance.yml` | `services: postgres`, a database-env step, `REQUIRE_DB=1` |

## 2. The four reds

**Check A — rename the derived victim; the battery still finds one.**

```
derived victim before:  modules/home-safety/src/acknowledgement/acknowledgement-commands.ts
renamed to:             …/acknowledgement-commands-RENAMED.ts
derivation now picks:   …/acknowledgement-commands-RENAMED.ts
  ok  cross-module import fires no-module-to-module    CAUGHT: no-module-to-module
  ok  simulator import fires no-simulator-in-runtime   CAUGHT: no-simulator-in-runtime
```

The victim, the import target and the relative specifier are all computed. `abort exit 11` if no victim can be derived — a battery that silently drops a case because it could not build its own injection is the empty oracle it exists to prevent.

**Check B — an F1-shaped omission, pass → fail → pass.**

```
ok    seed reproduces from nothing    scaffold=5 events=7
  ↓ remove one serving_scope_label pair from a scenario seed
  | error: new row for relation "safety_event" violates check constraint
  |        "serving_scope_audience_is_explained"
FAIL  seed did not complete — the world is partial, and every scenario after the failing one never ran
  ↓ restore
ok    seed reproduces from nothing    scaffold=5 events=7
```

Anchored on `dev_scaffold.screen_content` and `home_safety.safety_event` being **non-zero**, not on "no error" — those are the two tables the real abort left at 0, so the assertion is on the measured symptom. It also catches the harder case: a seed that exits 0 having silently skipped the scenario layer.

**Fails, not skips, when the toolchain is absent:**

```
SKIP  seed-reproduces-from-nothing: no database/dev/.env — cannot reach a database
      ^ LOUD SKIP, not a pass. This check did not run. Set REQUIRE_DB=1 to make it fatal.
REQUIRE_DB=1 → FAIL … and REQUIRE_DB is set    exit 1
```

With no database at all the rest of the battery still runs: **19 passed, 0 failed**, one loud skip. `prove.sh` had zero database references before this and still has exactly one, behind its own script and flag.

**Check C — warns on the real condition, silent on the proxy.**

```
GEN-007 forced back to draft (its product code landed at d647032):
  WARNING: GEN-007 is 'draft' but 1 commit(s) tagged [GEN-007] have landed outside
  docs/governance/ (d647032). It is either merged-and-awaiting-close, or
  landed-and-legitimately-continuing — this check cannot tell those apart, so it
  warns and does not fail.

GEN-008, also draft, with only its register-only allocation commit:
  mentions: 0   ← silent
```

Warning, never a fault; `--check` still exits 0.

**`[PID-ID]` enforcement — a tagless commit.**

```
[exit 7] commit 0238d7b carries no [PID-ID] tag: "chore: a commit with no PID tag"
         — the merged-but-draft check reads this tag, and an untagged commit is
         invisible to it
exit=7
```

## 3. Two failures during the build, both worth the record

**The merged-but-draft guard cried wolf on its own PID first.** Its first run warned on GEN-008's *allocation* commit. Cause: `ROOT` in `pid-index.mjs` is `docs/governance/`, and git resolves pathspecs against the process cwd — so `-- . ':(exclude)docs/governance'` made `.` mean `docs/governance` and the exclusion miss entirely. Every PID would have warned the moment it was allocated: a 100% false-positive rate, which is **the cry-wolf principle this same commit carries**, failing on its author within the hour. Fixed by running the commit-trail checks from the repository root; the fix and the reason are in the code.

**The first tag-enforcement test proved nothing and looked like a pass.** I ran `git stash -u` before making the tagless commit — which reverted the very check under test — so the run used the old generator and returned exit 0. That is **principle 12 exactly**: a negative test disarmed by its environment, still reporting success. Re-run with the working tree intact (an empty commit stages nothing, so the stash was never needed): exit 7. Recorded because the first result was available and wrong.

**And the battery caught my own change.** Re-wording the generator's skip line to name three checks broke the case asserting `'tracked-file check SKIPPED'` — 19 passed, **1 failed**. That is the specific-assertion principle working on the commit that carries it. Re-anchored on the stable part (`SKIPPED` **and** `git work tree`) rather than loosened to "something was printed".

## 4. CI

`services: postgres:17-alpine` with the same image and `--locale=C` as `database/dev/docker-compose.yml`, so CI and a developer's machine are not two different worlds; a step writing the git-ignored `database/dev/.env` the services block provides; and `REQUIRE_DB: '1'` beside `REQUIRE_DEPCRUISE: '1'`.

Contract verified unchanged: `permissions: contents: read`, **0** write/push/commit steps, **0** bare-name `npx` invocations, 6 steps, 96 lines.

## 3b. The destructive-drop guard — required addition, and its ordering was wrong first

The check drops every schema before migrating. It now refuses unless the **actual connection target** says development:

```
DEV_DB_PATTERN='^pemo_dev'
DEV_HOST_PATTERN='^(127\.0\.0\.1|localhost|::1)$'
```

`PEMO_ENV` is checked too, and is explicitly the cheap extra. The target is load-bearing because the misconfiguration that destroys data is not a missing label — it is a correct `PEMO_ENV=development` beside a connection string pasted from staging, which passes every label check.

**Both reds, refusing before touching anything:**

```
name 'pemo_prod'  → FAIL  REFUSING to drop schemas: database name 'pemo_prod' does not match ^pemo_dev
                          schemas untouched: 5
host db.staging.internal, PEMO_ENV=development
                  → FAIL  REFUSING to drop schemas: host 'db.staging.internal' is not loopback
                          schemas untouched: 5
```

The second is the case that matters: **the label was right and it refused anyway.**

**The first version of this guard was in the wrong place, and both its proofs passed for the wrong reason.** It sat *after* the connectivity probe, so a wrong target that happens to be unreachable short-circuited into `SKIP … LOUD SKIP, not a pass` and the guard never executed. Both reds "fired" green. **A safety check a bad target can route around is not a safety check**, and the tell was that neither refusal message ever appeared. It is a pure string test over configuration, needs no database, and now runs before anything reaches out — ordering recorded in the script with the reason.

**Principle carried** (43 now, not 42): *a destructive operation confirms the real target it will act on, never a label that claims what the target is.*

## 5. Gaps — this list is complete

1. **Nothing committed.**
2. **CI is unverified against the GitHub runner** — the standing caveat. The `services:` block, the env step and `REQUIRE_DB` have not run there. When the first run goes red, separate infrastructural from substantive before touching anything.
3. **Check C's irreducible ambiguity stands** — landed-awaiting-close vs landed-and-continuing. It warns and says so. Its other blind spot is now closed by the enforcement, but only from `5b06361` forward; commits before the register landed are out of scope by construction.
4. **`TAG_EXEMPT` is empty.** Deliberate — an exemption is added with a reason, never pre-emptively. It exists so an unavoidable future exception is a named entry rather than a weakened rule.
5. **Check A's derivation is deterministic but arbitrary.** "Alphabetically first" is stable and means nothing. If a derived victim is later a file where the injected import is legitimate, the case breaks; the abort clause surfaces the *no-victim* case, not that one.
6. **`prove.sh` is 20 cases and ~300 lines.** Still one screen per section, but it is the largest thing in `bin/`. I did not split it; flagging that the question exists.
7. **Closed by §3b.** The drop now refuses unless the connection target itself says development.
8. **The guard's patterns are narrow and literal by design** — `^pemo_dev` and loopback only. A future CI runner reaching Postgres over a service hostname rather than loopback would be refused, correctly, and widening the pattern is then a visible diff someone has to justify. The current workflow uses `127.0.0.1`, so it passes.

## 6. What the Brain is asked to rule

1. **Release the commit.**
2. **Gap 6** — split `prove.sh`, or leave it.

**HARD STOP.**
