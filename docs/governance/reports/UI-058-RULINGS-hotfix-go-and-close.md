# UI-058 — Ruling: hotfix GO, workaround recorded, close

Date: 2026-09-03
Relayed in-message by the Product Owner (the UI-054 follow-up GO); filed here because a ruling is an artifact and Rule 7's close check reads `-RULINGS-` under `reports/`, never a relay.

## Ruled
- **GO** on the one-file hotfix as a new PID (`UI-058`), not a reopen of the merged `UI-054`: allocation + fix + Rule 7 close, one file `apps/management-web/tool/live-exercise.ts`, the binding change.
- **SAY WHAT IT IS.** This is a WORKAROUND, not a fix: the `no-cross-schema-sql` scanner is wrong here, the code was not. The bound line carries a comment naming the scanner's imprecision and the PID that will fix it; the same is written in `reports/UI-058-step1.md` and in this ruling request. We do not silently rename around guards — a codebase that learns "the guard complained, so change the name" loses the guard.
- **The scanner-precision PID is Main CC's**, dispatched in parallel. When it lands, the binding may stay (it reads fine) but the comment goes.
- **The UI local-gate gap is ruled and recorded**, not fixed here: the report carries the list of which checks the UI pre-push gate runs versus the CI `register` job — the list, not a summary — as the third instance of a local gate seeing less than CI. The list is what the next governance PID acts on.
- **Merge and close:** refspec push from the worktree, main never checked out, tree-hash re-read via ls-remote, through the hook, no `--no-verify`, `[UI-058]` tag. Read the resulting main run; report the closed row and the run's conclusion.

## Recorded
`verify:boundaries` proven clean on the fixed tree by the real CI command (`PASS — module boundaries hold at all four layers`, exit 0) and by the scanner function directly (`["notices.length"]` → `[]`). The freeze on merges to main is lifted by this GO for this hotfix.
