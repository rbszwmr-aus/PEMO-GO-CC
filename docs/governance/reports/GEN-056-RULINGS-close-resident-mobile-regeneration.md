# GEN-056 — Close ruling: the resident-mobile debt paid, and the two failures paying it exposed

Date (UTC): 2026-09-05. A+B green on both CI jobs; both bites proven; the suite re-run through GEN-061's pinned runner on 3.44.3 gives 280 pass.

## Closed. Accepted.

### The debt is genuinely paid
Both `.g.dart` consumers regenerated to 0.4.0; `flutter-test-debt.json` empty; the flutter gate reports `347 gated, 0 exempt (of 0 booked)`. The stamp check now extends to `.g.dart` (4 stamped, bite proven, principle registered) — which is the part that stops this recurring: GEN-048's F6 existed because the stamp check had never covered a Dart consumer, so a month of contract bumps passed it by in silence. Paying the debt without extending the check would have bought one regeneration; extending it buys the class.

### (A) The kind signal
`problems` and `notices` are not screens — they are operation-fixture categories (Problem bodies at httpStatus 400; the `markNoticeRead` act) sharing a corpus with screens, and `screenFor()` threw for them, killing roughly sixty tests across section 18, rule 7 touch targets, rule 8 both-languages/200%-scale, and the semantics tree. The remedy is the entry's KIND, derived at generation from the fixture's origin, with every test that renders by corpus key deriving its population from kind rather than iterating raw keys. Stopping twice — first to report that the codebase could not express "sourceless", then to size the failure honestly at sixty tests rather than the one I had assumed — is what kept this from becoming a per-screen exemption list that would have rotted like the drop list and the prober before it. My earlier ruling reasoned about "does it fetch"; it was aimed at the wrong question, and the executor's investigation, not my ruling, found the right one.

### (B) The gate's tests were tests of the debt
GEN-048's flutter-gate tests asserted against whatever was currently owed, so they passed BECAUSE the debt existed — the `correlated-lists-certify-nothing` family, seen from an unusual angle: the coupling only became visible when the debt was paid. The synthetic fixture via `PEMO_FLUTTER_DEBT_FILE` is the correction, and it must supply both halves — results and debt — since supplying one recreated the same coupling mirrored.

### The process note, which outlasts the PID
"I judged it Dart-only and ran only the stamp check" — recorded and registered as `the-exception-that-proves-the-rule-is-where-the-rule-fails`. A discipline is not usually abandoned; it is exempted, once, on the judgement that this particular change is too small to need it, and that judgement is made most confidently exactly where it is most wrong. GEN-056 is the named instance.

## Rule 7 close authorised
Merge after GEN-061 (union-resolve the manifest tail), carry this ruling in, archive/ + index row, status: merged, closed: 2026-09-05 (UTC). Report the closed row and read the close-push run.
