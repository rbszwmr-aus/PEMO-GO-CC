# GEN-059 — Close ruling: the cross-schema SQL scanner reads SQL, not text

Date (UTC): 2026-09-04. Renumbered from GEN-058 (collision with the merged UI-058). Merged 714c2b8..d16fe31; main run 33848488271 green — register + Flutter, browser 380 + 26, Flutter 281 gated / 2 exempt — read, not assumed.

## Closed. Accepted.

C1 D1: the qualified name and its SQL verb are read from a literal's STATIC TEXT only. This narrows where a token counts (the authored SQL skeleton) rather than what is forbidden — the distinction between a precision fix and a weakened guard, and stating it that way is why the ruling could be quick.
C2 D2: interpolations excluded entirely, verb also read from static text so `${sql.SELECT}` cannot promote a property access. The obvious way back in is closed by construction, not by a second rule.
C3 D3 is the part worth naming: two bites, and the second is a control against "made precise by disabling it" — `staticText` over-strips, real-crossing detection dies, the precision tests stay green. Every precision fix invites that failure and almost nobody tests for it.
C4 D4: 203 files swept, exactly 1 false positive of the class — the one that fired — and 0 latent. Neither inflated nor implying more safety than was measured.
C5 The principle is accepted as worded, and its distinction from `anchor-the-discriminator` (unanchored pattern vs correctly anchored pattern pointed at the wrong text) is real, not a synonym.
C6 The UI-058 workaround comment removed, binding kept — the creditor paid, the debt stopped advertising itself. Correct.

## The allocation collision, answered honestly
`pid-index --check` DOES detect a duplicate number across types ("duplicate NNN 058 held by 2 files") and the pre-push hook runs it, so a push would have been refused. The failure was timing: `--next` scanned a stale worktree base (79275b1) that predated UI-058's allocation. The rule held at the gate and failed at the point of choice. That answers the gate-coverage PID's D5: the fix is that `--next` resolves against fetched `origin/main`, not the worktree base. Recorded there, not here.
The out-of-band cause was mine: I authorised UI CC's hotfix allocation without routing it through the parallel allocation rule. Recorded so the rule is not blamed for a hole its author opened.

## Also accepted
Branching off a red commit (79275b1) was caught and corrected by rebase onto green main before commit — the right order, and worth noting that the correction cost one rebase because it was caught before the push rather than after.
The G7 decision file rides with the G7 PID rather than landing standalone: correct, and it is the gate working as designed — a commit needs a `[PID-ID]` tag, so a decision reaches the repo carried by the work it governs.
The stated queue is accepted as ordered, including batching G7 adjacent to the emitted⇒declared parity PID: both are small additive bumps on the same surface, and one contract-version cycle for two changes is cheaper than two.

## Rule 7 close authorised
Carry this ruling in, archive/ + index row, status: merged, closed: 2026-09-04 (UTC, `date -u +%F`). Report the closed row and read the close-push run.
