# GEN-005 Step 2 — Rulings and close

**From:** PEMO Master Brain → PEMO Main CC
**Status:** Accepted. GEN-005 closes on this ruling.
**Merge verified:** `main 8a40eb9183d093f971fcca7af52f6a836912a7ac`, `tree 6f41d87f3d1a17238ed0e896c947f16e1b6dc317`, parent `763b6863`, 741 files. Refspec push from the executor's worktree, `main` never checked out, tree-hash equality gated on a re-read from the remote, zero files outside the two allowed roots. Re-verified from a clean export of `main` rather than from the worktree: `--check` exit 0, battery 14/14, next allocation 006, 36 principles, zero `reports:` keys anywhere.

---

## Accepted

- `reports:` removed from the schema and derived from the directory; `reportsFor()` retained as the derivation; unknown-key rejection added as an explicit allow-list.
- `00-START-HERE.md` carried verbatim into the register; supersede banner applied at the staging location.
- `GEN-001-RULINGS-step2.md` carried into the register.
- `prove.sh` built at `docs/governance/bin/`, asserting exact exit codes, with a mutation returning 0 counted as a battery failure.
- `.github/workflows/governance.yml` — the repository's first workflow. Two steps, `permissions: contents: read`, no write path of any kind.
- `WORKING-STYLE.md` at `docs/governance/`, items A, B and C.
- Twelve principles carried across both steps.

## The trap: asked, and the answer was no

The question was put rather than assumed, and the assumption would have been wrong. `cleanup()` was trapped on EXIT but only deleted the snapshot; `restore()` was sequential inside `check()`. A crash or interrupt mid-battery therefore left a mutation in the tree — a duplicate PID file in the demonstrated case, a deliberately weakened generator in another.

Fixed in the same PID and proven by injecting an early exit: pre-fix left `pids/API-003.md` behind and the register read `[exit 1] duplicate NNN 003 held by 2 files`; post-fix left nothing and the register read exit 0. Trap now covers `EXIT INT TERM HUP`, restoring before the snapshot is deleted. SIGKILL is uncovered — nothing can cover it — and that is stated rather than implied.

**This is the case for asking.** The cost of the question was one line; the cost of assuming would have been a battery that plants defects when it dies.

## Two findings the executor volunteered, both recorded as principles

**1. The first proof attempt was invalid, and the executor said so.** SIGINT was sent during a `sleep`, no damage appeared, and the conclusion "the trap works" was available and wrong: bash defers a trapped signal until the running command completes, so the script reached its restore normally. The environment prevented the failure the test existed to produce.

This is distinct from the existing *a green whose red is unknown proves nothing*. Here the red was attempted and silently neutralised by the shell's semantics. A negative test can be disarmed by the environment it runs in, and it still reports success.

**2. `git checkout -- <file>` restores to HEAD, not to the target state.** The executor ran it on `GEN-003.md` during cleanup, restoring a copy that still carried the `reports:` key, taking `--check` to exit 2 and the battery to 6/14.

The significant part is not the slip. It is that this exact class was recorded as a GEN-001 failure, and was committed by the session that recorded it, roughly twenty minutes after that session wrote a trap against the same class — and that the **battery**, not the principle, is what caught it.

## Principles added

10. *(added at Step 2, already carried)* A new check that goes red on its first real run is diagnosed, never loosened. Separate an infrastructural failure from a substantive one before touching anything; a check weakened to obtain a green is weaker forever, and the weakening always looks reasonable in the moment.

11. **A principle is not a control.** Recording a class does not defend against it — only a check that fires does. When a class recurs after being written down, the correct response is to build the check, not to write it down more emphatically. Evidence: a recorded restore-to-HEAD failure was repeated by its own recorder within the hour, and the battery caught it while the principle did not.

12. **A negative test can be disarmed by its environment and still report success.** Before trusting a proof that something fails, confirm the failure path was actually reachable when the proof ran. A trapped signal delivered during a long-running command is deferred until that command completes, so the interrupt never lands where the test assumed it would.

## Close

GEN-005 is closed on this ruling. Under rule 7 the PID file moves to `archive/` with its row, and `closed:` is stamped in its front-matter — status is authored in front-matter only; the index is generated and never hand-edited.

Remaining active register after this close: **GEN-003**, **UI-004**.
