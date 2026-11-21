# GEN-048 — Close ruling: CI becomes a gate (Flutter in CI; the browser job verified)

Date: 2026-09-04. Merged a94b7b0, then 9abfabb (F6's debt gate), report 0e0cab7. Rule 7 close authorised by this ruling.

## The evidence, read by Main CC itself

| commit | run | conclusion | detail |
|---|---|---|---|
| 9abfabb (GEN-048 merge) | 33819896280 | failure | `register` failed at "the integration and contract suites" — the F7 unstable suite (the frozen-clock cross-route race). Browser step skipped: it runs after the integration step. Flutter job: success. |
| 27eda6c (GEN-057 merge) | 33843757096 | success | Browser: 361 passed (management-web) + 26 passed (resident-portal). Flutter gate: 281 gated, 2 exempt of 2 booked, both owed by GEN-056. "every gated test passed; booked debts still red as booked". |
| 6a787b2 (GEN-057 close) | 33844543279 | success | both jobs green; browser 361 + 26; Flutter 281 gated, 2 exempt. |

GEN-048's own merge run was red — for a defect GEN-048 did not introduce and could not have fixed (F7, closed by GEN-057). Its deliverables are nevertheless proven on main: the Flutter job passed on its own merge run, and the browser line arrives on the first run in which the integration step lets it execute.

## Closed. Accepted.

D1 Flutter toolchain in CI, pinned 3.44.3, resolution asserted against the pin, the resident-mobile tests gated, red blocks merge. Proven: 281 gated green on two consecutive main runs.
D2 The browser job verified: 361 + 26 passing under a real browser in `the app browser suites`, read from the run, not claimed.
R2 The from-nothing rebuild made genuinely from nothing (node_modules, dist and tsbuildinfo all removed) after the first version kept dist/ and its own bite stayed green — the GEN-039 dist hazard at workspace scale. Principle `a-rebuild-that-keeps-node_modules-is-not-from-nothing` registered.
R3 The workspace-import guard: 30 edges, 12 packages; an undeclared import reds. It refused Main CC's own new principle for an invented citation, which is the guard working on its author.
R16 `push: branches: ['**']` — every branch self-reports; the PR-only stall is gone.
F1 The reporter-format parser: node emits tap when piped on CI and spec on a TTY. The extractor could only read locally and reported its own blindness as a suite verdict. RAN / EXTRACTOR-ERROR / DID-NOT-RUN, five-case parser test, bite. Principle `a-parser-that-cannot-read-the-result-must-not-report-one`, later extended with the base-ref arm.
F2 The Flutter gate, lost in a reset and re-delivered when the battery's own note caught its absence.
F3 The migration guard read an `origin/main` the shallow checkout never fetched — and was also the original #57 one-test divergence, which closes R14 with a named cause instead of archaeology. Fixed both ways: fetch-depth 0 plus the explicit refspec, and a named `BaseRefUnavailable` carrying its own remedy.
F4 The pin step's broken pipe — `flutter --version | grep` closing the pipe under a live process. Principle `a-live-process-is-never-piped-into-a-short-circuit-reader`, with a sweep confirming it was the only live pipe.
F5 Playwright is a per-app devDependency; the step runs inside each app.
F6 The Flutter gate's first run caught a real, month-old defect: the Dart consumers stamped 0.2.2 against severity.json 0.4.0, because the contract-bumping PIDs regenerate consumers and no Flutter toolchain existed to regenerate that one. Ruled (B) with teeth — the skip list is read from `flutter-test-debt.json` at run time, every entry names cause, date and owing PID, an exempt test that PASSES reds naming itself, the summary prints creditors every run, and the gate's decision logic is tested without a Flutter host by feeding synthetic reporter json. The creditor is GEN-056.

## The record's closing sentence

CI on main was red continuously from 0d0abbe (2026-09-02 11:11) to 27eda6c (2026-09-04), across six causes found in this order: the migration base ref (also the original #57 divergence), the missing tsconfig references, the environment-dependent reporter format, playwright resolution, the Flutter contract-version debt, and the frozen-clock race. Throughout that window the pre-push hook was the only gate; its checks were real, so no close is reopened, but every "CI green" statement made in that window was a claim and is marked as one. 9abfabb sits inside the window, red on the sixth cause; 27eda6c is the first green.

What GEN-048 bought: a second gate that sees what the local one cannot, and that has already earned its cost twice over — F6's month-old debt and, through F7, the zero-administrator lockout.

## Rule 7 close authorised
archive/ + index row, status: merged, closed: 2026-09-04, this ruling as the -RULINGS- artifact. Report the closed row.
