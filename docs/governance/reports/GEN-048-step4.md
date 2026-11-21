# GEN-048 step 4 — two more environment reds (#96 → 583f9891), both fixed

**Date:** 2026-09-03  **Battery:** 36 passed, 0 failed. **Bites:** 5 proven, 1 unreliable (CI-only, below).
Both reds were environment, both diagnosed from the logs, both a class already met once.

## F3 — the "not vacuous" guard became its own counter-example
`migration-numbering.test.ts` computes its base as `git merge-base HEAD origin/main`. `actions/checkout@v4`
does a shallow, single-branch fetch, so **`origin/main` does not exist on the runner**; `merge-base`
threw `fatal: Not a valid object name origin/main`, and the test — the one named "the guard is not
vacuous" — reported a numbering violation about a base it could not see. This is F1's disease in a
second place.

**Fix (a) — the workflow makes the base available:** the `register` job's checkout gains **`fetch-depth:
0`** (full history, so `merge-base` has a common ancestor) and an explicit step **`git fetch --no-tags
origin +refs/heads/main:refs/remotes/origin/main`** (creates the remote-tracking ref the guard names).
Both, because fetch-depth alone gives history but not necessarily the `origin/main` ref on a
branch-triggered run, and the explicit fetch alone can fail to find a merge base on a shallow clone.

**Fix (b) — the test distinguishes a missing base from a verdict:** `mergeBaseWithMain()` `rev-parse
--verify origin/main` first, and on failure throws a named **`BaseRefUnavailable`** with the fetch
command to run — a HARNESS error, never a raw `child_process` throw read as a numbering violation.
Principle extended (its base-ref arm): *a guard that cannot see its base states that, and reds as a
harness error.* The harness-error path is proven locally by construction; the **remove-the-fetch bite is
CI-only** (a shallow checkout cannot be made in a full-history worktree), recorded `unreliable` with its
diagnosis and confirmed by CI at this fix.

**R14 RESOLVED — F3 IS the #57 failure.** `migration-numbering.test.ts` **existed at `0d0abbe` (GEN-037,
#57)** and already referenced `origin/main`. A missing `origin/main` fails there identically and passes
locally — exactly the #57 signature (built fine, one test of 362 failed, environment divergence). The
one-test red the PO could not extract from the old log is this test; #57 needs no further archaeology.

## F4 — the Flutter pin assertion crashed on a broken pipe (second strike)
The step I wrote for F2 ran `flutter --version --machine | grep -E ... || exit 1`. **`grep` closes the
pipe on its first match; flutter then crashes writing to stdout** (the stack ends in
`Stdio._stdioWrite` / `StdoutLogger.writeToStdOut`, exit 2) — a red with nothing to do with the pin.
This is the **exact defect GEN-053 D4 diagnosed** (grep-q on a live pipe killing `node --test` before
teardown), now in the very step meant to satisfy F2.

**Fix — capture first, match after:** `machine="$(flutter --version --machine)"` then `printf '%s'
"$machine" | grep`. A captured string piped into grep is safe (the producer already exited); a **live
process is never piped into a short-circuit reader.** New principle registered:
**`a-live-process-is-never-piped-into-a-short-circuit-reader`** (75 → 76), with a workflow-lint bite:
restore the `flutter --version | grep` form → the lint reds. **Swept the workflow and battery** — every
other `| grep -q` / `| head` / `| tr` feeds a CAPTURED string (`printf '%s' "$out"`) or a FILE, not a
live process, so none crashes; the flutter one was the only live pipe.

## Standing
- **R16** self-reports this branch on push; **R15** the merge run is still the gate.
- Merge `codex/gen-048` only on green across EVERY job — register (with the origin/main fetch) and the
  Flutter suite. GEN-048 closes on that `main` run URL plus the browser line from the `the app browser
  suites` step.
- **R13:** GEN-055 holds author-complete.
