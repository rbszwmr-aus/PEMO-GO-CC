# GEN-021 — Step 1: the merge gate and the premise-arm guard, designed

**Status:** designed. **Nothing built.** HARD STOP.
**Three findings.** **D's CI backstop already exists** — CI has run `--check` and the battery since `GEN-011`, so D's remaining work is only the local half. **D cannot be a guarantee**, because a hook is bypassable and a repository cannot enforce one; it closes the *accidental* case and CI stays the guarantee. And **I propose splitting D from E, on provability rather than size**: E is fully provable locally, D's central mechanism cannot be proven until a real CI run.

---

## 1. Pin and allocation

| | |
|---|---|
| **Pin** | `4011b0fea2d43e3224fee9248df65fcfdceb1502` — `origin/main` after batch B, re-read from the remote, tree `6e67217a…`, 865 files |
| **Number** | **021**; next is 022 |
| **`main` now** | `06ebe65ac2a573c283edafc4ccc76c6f9067899e` — the allocation |

## 2. D1 — the hook

`.githooks/pre-push`, versioned, running exactly what the manual gate runs today:

```
node docs/governance/bin/pid-index.mjs --check --require-git
docs/governance/bin/prove.sh
```

**Measured, because a slow hook is a bypassed hook:** `--check` is **0.074s**; the battery is **2.9s** with no database, and it exits **0** with two loud `SKIP` lines rather than failing. So a developer without Docker still gets the register and boundary checks and is told what did not run — which is the `REQUIRE_DB` design already working in the hook's favour. **~3 seconds is not a bypass incentive.**

The opt-in is one line, and it is the whole installation:

```
git config core.hooksPath .githooks
```

## 3. D2 — the crux: a checkable opt-in that does not false-red CI

**The problem, stated exactly.** `core.hooksPath` is per-clone git config, not versioned. A fresh CI checkout has none. A bare battery assertion `core.hooksPath == .githooks` would therefore red on every CI run — and a check that is expected to be red is a check that stops being read.

**Proposed mechanism: a battery case that asserts the opt-in only where a push can originate — a developer clone — and skips loudly in CI.**

- Discriminator: `${GITHUB_ACTIONS:-}` (precise), with `${CI:-}` as a fallback.
- In CI: prints a `SKIP` naming why — *the hook is irrelevant here; CI is the backstop* — in the same loud-skip shape `REQUIRE_DB` already uses, so it is visible rather than silent.
- In a developer clone with no opt-in: **FAIL**, with the one-line fix in the message. A fresh clone cannot run the battery green until the developer runs one command, and that is the point rather than a side effect.

**Why it does not false-red:** CI is the only context where the opt-in is both absent and correct to be absent, and it is exactly the context the environment identifies.

**The residual, named as the design's weakest link:** the discriminator is an environment variable, so a developer who exports `CI` silently skips the assertion. It is self-inflicted and invisible, and I would rather record it than pretend the guard is airtight. I could find no non-environment discriminator that distinguishes a CI checkout from a developer clone — both have an `origin`, both are full clones, both can push.

## 4. D3 — the CI backstop already exists

CI's `governance.yml` already runs, in order: `pid-index --check --require-git`, `verify:boundaries`, `prove.sh`, and the full suite. **So D's post-push half is done and has been since `GEN-011`.** Nothing needs adding for the backstop; what D adds is the *local* half plus the opt-in check.

**The layering, and the honest limit.** The hook is **prevention**, best-effort and client-side; CI is **detection**, guaranteed and post-hoc. `git push --no-verify` bypasses any hook, and no repository can prevent that. **D therefore closes the accidental case — `GEN-013`'s shell chain gating the push on the commit rather than the generator — and not the deliberate one.** That is worth stating plainly, because a gate described as a guarantee is worse than one described as a habit: people stop checking the thing they believe is impossible.

## 5. E — the premise-arm guard

**Placement:** a CI step, immediately after the battery, in `governance.yml`. Not `prove.sh` — as ruled at `GEN-012`, CI's Postgres is ephemeral so a flipped attribute dies with the container, where a developer's cluster is persistent and a leftover superuser would be a real hazard.

**Shape:**

1. **Pre-flight** — assert `pemo_app` is `rolsuper = false` *before* flipping. An interrupted earlier run could have left it flipped, and testing a guard against a tainted role would prove nothing.
2. `ALTER ROLE pemo_app SUPERUSER`.
3. Assert `grants-complete.sh` **fails**. This is the whole guard: if the premise arm has been deleted, the script passes here, and the step reds.
4. `ALTER ROLE pemo_app NOSUPERUSER`.
5. Assert `grants-complete.sh` **passes**, so the red in step 3 is attributable to the flip and not to something incidental.

**Only the reversible attribute.** Never ownership — `GEN-012` proved ownership is not a reversible experiment: transferring a table away and back drops the grants an owner does not need, and the MISSING arm then reds for an unrelated reason.

**How it proves it bites:** delete the premise arm from `grants-complete.sh` and step 3 finds the script passing under a superuser — the step reds. That is the assertion `GEN-012` could not make, and it is the reason E exists.

## 6. D and E — I propose splitting them, and the reason is provability

Not size: both are small, and they touch different files (`.githooks/` plus a battery case; a workflow step).

**The asymmetry is that E is fully provable before merge and D is not.** E's mechanism can be exercised end-to-end on a throwaway database locally — flip, assert red, restore, assert green — and the mutation that matters (delete the premise arm) can be run here. **D's central mechanism cannot.** Its whole subject is a `pre-push` hook and a CI-context discriminator, and the only real test of "does this red in a developer clone and skip in CI" is a genuine CI run. Landing them together means merging one half whose key behaviour is unverified until after the push — the same shape as `GEN-011`'s node-22 caveat, but load-bearing rather than incidental.

**Proposed: E first, then D.** E closes the `GEN-012` hole with a locally-proven red. D follows, and its first CI run is explicitly its experiment — which is `[first-red-is-diagnosed]`'s territory and should be entered deliberately rather than bundled.

If you prefer one diff, it works; I would then want the report to state clearly which half was proven locally and which was not.

## 7. Gaps — this list is complete

1. **D's opt-in discriminator is environment-based** (§3) and bypassable by exporting `CI`.
2. **I have not tested a `pre-push` hook in this worktree.** This is a linked worktree, and `core.hooksPath` is per-repository config — I have not confirmed how it resolves for a worktree of a repo whose `.git` is a file. That is a Step-2 verification and could change the opt-in's shape.
3. **The hook will run the battery on every push**, including pushes that touch nothing governance-related. 3 seconds each, and no way to scope it cheaply without parsing the diff.
4. **E adds a mutation of cluster state to CI.** Confined to an ephemeral container and reversible, but it is the first CI step that writes to the role model rather than reading it.
5. **Neither D nor E addresses `--no-verify`.** Stated in §4, not solvable.
6. **I have not measured the battery's cost with a database present** — 2.9s is the no-DB path, and the DB path runs the seed-reproduces case, which is the slowest.

## 8. Rulings sought

1. **§3** — the CI-context-guarded battery assertion: accepted, with its named residual?
2. **§6** — split, E first? Or one diff with the unproven half declared?
3. **§4** — is the prevention-versus-guarantee framing what you want recorded in the hook itself?
4. **§7.2** — if `core.hooksPath` turns out not to apply cleanly to a linked worktree, is the opt-in still the right mechanism?

**HARD STOP.**
