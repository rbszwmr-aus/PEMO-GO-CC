# GEN-061 — Merge and close ruling: a local run on a different toolchain is a guess, not a gate

Date (UTC): 2026-09-05. Commit 847a763 on codex/gen-061 off a547ff5; CI run 33934820966 success on both jobs.

## The contradiction, resolved to the machine
`which -a flutter` returns nothing on the executor host — Flutter was never on PATH there and answered only by explicit path — and exactly one SDK existed, `~/tools/flutter-3.44.9`. The `3.44.3` I twice relayed as "on that machine" came from the PO's OWN machine. So there was never a two-SDK ambiguity; there was a two-MACHINE one, and I created it by treating a version the PO read on their box as a fact about the executor's box. Recorded as my error. The lesson generalises past this incident: a relayed observation carries the machine it was made on, and dropping that is how "it works here" becomes unfalsifiable.

## Accepted, and why the shape is right
- 3.44.3 installed ALONGSIDE 3.44.9, not replacing it: the executor did not silently reshape the host to make its own claim true, and the older SDK remains available for comparison if a defect ever turns out to be version-specific.
- `flutter-pinned.sh` resolves the SDK by explicit path, never through PATH — the exact mechanism that made "what ran" unidentifiable is the one it refuses to depend on.
- The pin is DERIVED by reading `governance.yml`'s `flutter-version` rather than typed a second time. This is the difference between a local runner that agrees with the gate today and one that cannot disagree with it tomorrow. The workflow is untouched; CI remains the source of truth.
- The bite builds a hermetic fake SDK reporting 9.9.9 and asserts the runner refuses naming both versions — and `expect` is pin-independent, so a legitimate pin bump cannot silently satisfy it. That last property is the one that matters: a version-checking bite written against a literal would become a second place the pin lives.
- Payoff, and the reason this PID was worth doing before closing GEN-056: the GEN-056 suite re-run through the pinned runner gives 280 pass on 3.44.3, so GEN-056's local claim upgrades from "green on 3.44.9" to "green on the gate's pin".

Principle `a-local-run-on-a-different-toolchain-is-a-guess-not-a-gate` registered beside `context-inherited-env` with the distinction drawn.

## Environment change, flagged and accepted
`unzip` was installed on the host to bootstrap 3.44.3. Flagging one out-of-repo change unprompted is the right instinct; accepted, and noted here so the host's state has a written trail rather than living only in one session's memory.

## Merge
Merge GEN-061 FIRST, ahead of GEN-056, so the record reads in causal order: the pinned runner exists, and then GEN-056 lands proven on the pin. Both PIDs append to `manifest.json`'s tail; the second to merge resolves a closing-bracket conflict by union, with no source overlap. Standard refspec push, read the main run, Rule 7 close on this ruling; closed 2026-09-05 (UTC).
