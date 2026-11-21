# GEN-057 — Close ruling: suite determinism, and the zero-administrator lockout it exposed

Date: 2026-09-04. Merged by refspec push 56462a9..27eda6c → main; main never checked out; pre-push gate 36/0; no --no-verify; origin/main == HEAD re-read. Main CI run 33843757096 green on both jobs, self-observed. Determinism proof 15/15 identical, pass=487 fail=0, sorted + 14 shuffled seeds.

## Closed. Accepted in full.

This PID is the one to point at when someone asks why the harness discipline is worth its cost. A PID scoped to "make the test suite deterministic" found a production-reachable, unrecoverable zero-administrator lockout — the exact state GEN-030 and ADR-017's floors exist to prevent — and proved it with an instrumented cause rather than a plausible story: the loser transaction blocked ~213 ms on the organization advisory lock, acquired it correctly, and then evaluated liveness with `now()` = `transaction_timestamp()`, frozen at snap=55.840, before the wait. The winner's revoke stamped `effective_to ≈ 55.84x`. The loser therefore counted a revoked grant as live, read n=2, and both routes committed. The lock was never broken; the clock was.

Accepted, item by item:
1. Scope expanded by ruling and restated in the report — proof and remedy inseparable.
2. Seven post-lock liveness predicates swept across `access` and `resident`; read-only and JS-clock sites left with stated reasons. The sweep, not the single site, is what makes this a fix rather than a patch.
3. Isolation MEASURED (psql plus a runtime assert), READ COMMITTED on every path — which is what makes `clock_timestamp()` sufficient rather than cosmetic. Measuring instead of assuming is the load-bearing step; under REPEATABLE READ the same edit would have been theatre.
4. Database backstop assessed feasible (deferred constraint trigger, naturally clock-correct) and given its own id after GEN-056 rather than folded into a resident-mobile codegen PID — correct: an `access` migration does not belong there. Recorded intent: trigger is the primary defence, the guard becomes the friendly refusal.
5. Bites: two deterministic, certified, with mutual control (2 proven / 0 failed). The three conflict reads and two disclosures fixed under the uniform rule and reported as NOT independently bittable without a production delay seam — stated, not claimed. The teardown's red is an FK, which run-mutations rightly rejects as infrastructure rather than a named assertion. This honesty is the reason the manifest can be trusted at all.
6. Three principles registered: the file-order one from F7, and the two clock ones as worded — `a-lock-that-serialises-visibility-is-defeated-by-a-clock-frozen-before-the-wait`, `a-guard-that-reads-after-waiting-must-read-at-the-time-it-waited-until`.
7. Lineage: no ADR changes. ADR-017 and GEN-030 were always right; their enforcement had a hole. Cited as the authorities served.
8. Harness and teardown fix merged in; 1 of 32 DB-touching files was leaky, reported as 1 of 32.

## Recorded for the record
CI on main was red continuously from 0d0abbe (2026-09-02 11:11 HKT) to this merge, across six distinct causes found in order: the migration base ref (the shallow checkout omitting origin/main — also the original #57 one-test divergence), the missing tsconfig references, the environment-dependent reporter format, playwright resolution, the Flutter contract-version debt, and finally the frozen-clock race. Throughout that window the pre-push hook was the only gate. No close is reopened: the hook's checks were real. But every "CI green" statement made in that window was a claim, and the record now says so.

Main CC now holds `gh` (rbszwmr-aus, active) and self-observes its runs. Standing rule from here: no PID closes on an unread run; after every merge Main CC reads that main run itself and reports its conclusion, the browser line from `the app browser suites`, and the Flutter gate's summary line.

## Rule 7 close authorised
archive/ + index row, status: merged, closed: 2026-09-04, this ruling as the -RULINGS- artifact. Report the closed row.
