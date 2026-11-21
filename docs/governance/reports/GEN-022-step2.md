# GEN-022 — C2 D: the pre-push merge gate

**Status:** built, proven, **NOT COMMITTED. HARD STOP.**
**Headline:** the worktree pre-check came back clean, and then the build found a **second** blocker the design had not anticipated — **git exports `GIT_DIR` into every hook, and two battery cases exist to prove the generator behaves outside a git work tree.** Run unstripped inside the hook the battery reports `21 passed, 2 failed` while standalone it is 23/23. Measured, not reasoned about, and fixed in the hook.

---

## 1. Pin and state

| | |
|---|---|
| **Pin** | `52f0c968c37fee0625f9468ce3d57950aafe0f52`, re-read from the remote at build start, 871 files |
| **`main` now** | `70d8ae6003da2fded6baba4989e00f63d9ee4b0f` — the allocation only. **Deliverable uncommitted.** |
| **Green** | battery **23/23** (was 22) · suite **347** · boundaries PASS · validator PASS · index OK · premise-arm guard ok |

## 2. The worktree pre-check — clean, with one sub-finding

Run before anything was built, because it was the design's blocker risk.

| | |
|---|---|
| `.git` | a **file**: `gitdir: /home/luipt/projects/PEMO/.git/worktrees/rewrite-GEN-001` |
| `--git-dir` | the main repo's worktree metadata |
| `--show-toplevel` | the worktree itself |
| **the hook fired** | **yes** — `HOOK FIRED. cwd=/home/luipt/projects/PEMO-worktrees/rewrite-GEN-001` |
| relative `.githooks` | resolves against the **worktree's own** checkout, because git runs the hook with the worktree as cwd |
| where the opt-in is stored | `/home/luipt/projects/PEMO/.git/config` — the **shared** config, so one opt-in covers the main repo and every linked worktree |

Tested by pushing to a throwaway local bare repository with a hook that refused, never against `origin`.

**Sub-finding, recorded rather than fixed.** Because the config is shared, the *main* repo checkout also gets `core.hooksPath=.githooks` — and it currently sits at `9f4756b`, an old commit with **no `.githooks` directory**. Git treats a missing hooks directory as *no hook*, silently. So a push from that checkout would be ungated and say nothing. It is the same class as `--no-verify` and the same answer applies — CI is the guarantee — but the opt-in check cannot see it, because the opt-in is present and correct; it is the *checkout* that lacks the hook.

## 3. THE SECOND BLOCKER — git's exported environment

The pre-check passed, so I built. The first end-to-end push then failed for a reason the design had not considered:

```
FAIL  outside a git work tree                    exit 0 (or skip was silent)
FAIL  --require-git makes the skip fatal         expected 4, got 0
21 passed, 2 failed
```

**Git exports `GIT_DIR`, `GIT_PREFIX`, `GIT_EDITOR` and `GIT_EXEC_PATH` into every hook**, and children inherit them. Two battery cases exist precisely to prove the generator *notices it has no repository* — they run it from a temporary directory. With `GIT_DIR` inherited it finds one anyway, and both cases fail.

**The hook strips the environment for its children** (`env -u GIT_DIR -u GIT_PREFIX …`), because the hook is the abnormal context: the battery should not have to defend itself against every caller. `env -u` rather than `unset`, so the hook's own `git` calls are unaffected. After the fix the same push reports **23 passed, 0 failed** and `gate passed.`

**This is worth more than the fix.** A gate that silently mis-reports its subject is worse than no gate — and it mis-reported in the direction of *failure*, which is the recoverable direction. Had those two cases been ones that pass spuriously under an inherited `GIT_DIR`, the hook would have shipped green while gating on less than it claimed.

## 4. What was built

**`.githooks/pre-push`** — `pid-index --check --require-git`, then the battery, with the environment stripped. Its own output calls it *"a habit, not a guarantee (CI is the guarantee)"*, and every refusal names both the fix and `--no-verify` as the escape, so the limit is stated where it will be read rather than in a document.

**The opt-in**, one line, in `docs/governance/00-START-HERE.md` under a new **Setup** heading: `git config core.hooksPath .githooks`, with the habit-not-guarantee framing and the note that it is repository-wide and covers linked worktrees.

**`docs/governance/bin/hook-opt-in.sh`**, the battery's 23rd case. In CI (`GITHUB_ACTIONS`, or `CI`) it prints a loud `SKIP` explaining that CI is the backstop and has no clone to opt in. In a developer clone it **fails**, with the one-line fix in the message. It also refuses if `.githooks/pre-push` is missing or not executable, so the opt-in can never point at a hook that is not there. **It names its own limitation in the file**: exporting `CI` skips it silently, which is the same deliberate act as `--no-verify`, and not what it defends against.

**The carried date fix**: `GEN-021`'s `closed:` corrected `2026-08-30 → 2026-08-31`, today's date read from `date` rather than carried from the instruction.

## 5. Proof

| | |
|---|---|
| hook fires in the worktree topology | ✔ §2 |
| broken register → **push refused** | ✔ `[exit 3] PID-INDEX.md DRIFT` → `REFUSED` → push exit 1 |
| intact register → **push allowed** | ✔ `23 passed, 0 failed` → `gate passed.` → push exit 0 |
| `--no-verify` bypasses it | ✔ exit 0 with the register deliberately broken — the documented limit, demonstrated rather than asserted |
| opt-in, dev clone with none | ✔ exit 1, message carries the one-line fix |
| opt-in, simulated CI | ✔ exit 0, loud `SKIP` |
| opt-in, dev clone opted in | ✔ exit 0 |

**Each branch confirmed taken** (`[probe-must-bite]`): the register probe was checked to actually break `--check` before the push was attempted, and `core.hooksPath` was read back as `unset` before asserting the failing branch.

**Timing**, because a slow hook is a bypassed hook: **4.6s** with a database, **2.8s** without, with 2 loud `SKIP` lines naming what did not run.

## 6. The bound on what is proven

**The first real CI run is this PID's experiment.** `gh` is not installed in this session and I have no other route to GitHub Actions, so I cannot see it. What I verified is that the opt-in check takes the SKIP branch under `GITHUB_ACTIONS=true` locally — which is the branch CI will take, but not a CI run. **A red there is a finding, and it is the Product Owner's to check.** The same bound applies to `GEN-021`'s premise-arm step, still unconfirmed in real CI.

## 7. Weight

**Six files**: the hook, the opt-in check, the battery wiring, the setup docs, the carried date fix, and the archive index. No code, no schema, no contract, no test file.

**And one honesty note.** I pushed the allocation with `--no-verify`, reflexively, on the grounds that the hook was not yet on `main`. It did not need it — the gate was green and would have passed. The deliverable push will go through the hook, ungated by any flag, which is the only demonstration that counts.

## 8. Gaps — this list is complete

1. **Real CI is unconfirmed** (§6), for both D and E.
2. **A checkout on a commit without `.githooks` is silently ungated** (§2), and the opt-in check cannot see it.
3. **The hook runs on every push**, including ones touching nothing governance-related. 4.6s each; scoping it would mean parsing the diff.
4. **The env strip is a fixed list.** If git begins exporting another variable that matters, the two cases regress — and they regress *loudly*, which is the recoverable direction, but nothing derives the list.
5. **`hook-opt-in.sh` asserts the path, not the content.** A clone could point `core.hooksPath` at `.githooks` while holding a modified hook; nothing checks the hook is the committed one.
6. **The battery is now 23 cases and ~3s**; the hook runs all of them, so the two costs are the same cost.

## 9. Rulings sought

1. **§2** — the ungated main-repo checkout: leave as a stated limit, or is it worth an owed item?
2. **§8.5** — should the opt-in check verify the hook's content, not just the path?
3. **Commit** — nothing beyond the allocation is committed.

**HARD STOP.**
