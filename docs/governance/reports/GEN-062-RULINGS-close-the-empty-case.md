# GEN-062 — Close ruling: the empty pids/ hazard, and the class it belongs to

Date (UTC): 2026-09-05. Landed at 40c2312; run 33937319631 success on both jobs. Main green, register clean.

Filing note, mine: this ruling was issued in a dispatch box and not filed here. Main CC held at `read-the-filed-ruling-not-the-relay` and reported the missing artifact rather than acting on the relay. That is the rule working exactly as intended, against me, and it is filed now.

## D1 — GEN-056's close STANDS, with a note
The red was infrastructural and unrelated to the close's content; the register and main are green. But the closed row carries a note: "close-push run 33936770015 reddened on the empty-pids/ hazard, fixed by GEN-062 at 40c2312." Added by REGENERATION (a rendered field), never by reopening. A clean row over an unclean history is a small lie that costs nothing to avoid, and flagging it for a blessing rather than letting it stand silently is what earns the blessing.

## D2 — GEN-062 accepted
The diagnosis is exact. The GEN-056 close was the first in the register's history to empty `pids/`; git tracks no empty directory; a clean CI checkout therefore had none, and prove.sh's snapshot, synthetic victim and restore all `cp`'d against a missing path. The pre-push hook passed because the executor's worktree still held the directory as a REMNANT — the same family as a rebuild that keeps `node_modules`: the local machine retains something a clean checkout does not have, so the local gate cannot see the absence. The three-layer remedy is right — root fix (`pids/.gitkeep`, tracked), defence (`mkdir -p` before the snapshot), and a check that reds when git tracks nothing under `pids/`, with run 33936770015 standing as the natural experiment. Fixing it immediately without asking, because it blocked every session, was correct.

## D3 — The class, which is why this ruling is longer than the fix
This is the SECOND time in two days that a collection reaching EMPTY for the first time broke something. `flutter-test-debt.json` emptying broke the flutter gate's own tests (GEN-056 B, where the tests passed *because* the debt existed); `pids/` emptying broke CI. Both share one shape: a collection non-empty since it was created, whose empty state therefore arrives LAST — after sixty PIDs of habit — and has been exercised NEVER.

Registered: `the-empty-case-arrives-last-and-is-tested-never`.

SWEEP, folded into GEN-062 if small, otherwise the first item of the gate-coverage PID — Main CC's call, stated with its size. Enumerate every collection, directory or file whose emptiness is REACHABLE but has not yet occurred: `pids/`, `problem-debt.json`, `flutter-test-debt.json`, `mutations/manifest.json` entries, `archive/`, the scenarios directory, and every generated list. For each, two verdicts: (1) can it legitimately be empty? (2) is that state exercised anywhere today? Where emptiness is legal and untested, add the case as a TEST; where emptiness is illegal, add a check that REDS. The enumeration table with its verdicts is the deliverable — the fixes are the easy part, and a table that names three survivors is worth more than one that claims none.

## Rule 7 close authorised
Carry this ruling in; archive/ + index row; status: merged; closed: 2026-09-05 (UTC). Report the closed row and read the close-push run.
Then the queue: the one-world PID (plan the capture step and state what the PO must run BEFORE composing) → gate-coverage → parity + G7 → backstop.
