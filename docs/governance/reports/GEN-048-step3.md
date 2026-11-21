# GEN-048 step 3 — the build is fixed; the red was a false verdict and a missing gate

**Date:** 2026-09-03  **Run #96 (a94b7b0):** the build PASSES — the tsconfig-references fix took, TS2307 is
gone from main. **Battery:** 36 passed, 0 failed. **The two remaining reds were F1 and F2, both fixed.**

## F1 — a FALSE RED: the extractor died, and reported a suite verdict anyway
Run #96 showed both UI suites as "the suite produced no result line — it did not run", each with a
`# duration_ms` printed underneath. **A suite that printed a duration RAN.** Two causes, one class:

1. **The reporter format is environment-dependent.** node's `--test` emits `ℹ pass N` (spec) on a TTY
   and `# pass N` (tap) when piped, and it flips with the node version. The battery's extractor matched
   only `ℹ`, so on CI it matched nothing and called two green suites dead — and the same dead extractor
   would have called a RED suite green.
2. **`tr: invalid option -- ' '`** — the runner's coreutils read a `tr` operand beginning with a space
   as an option. Third instance of GEN-053 D4's inline-shell class.

**Fixes, per the ruling:**
- **(a)** every `tr` in the battery now carries `--` before a literal set, or is replaced by parameter
  expansion (the Flutter count no longer shells out to `tr` at all).
- **(b)** the class is extended: no battery argument that can begin with `-` or a space is passed
  unguarded; `app-suites.sh`'s parsing moved out of inline sed into one helper.
- **(c) THE REAL DEFECT — the false verdict — is fixed at the root.** `parse-suite-result.mjs` reads
  **any** reporter format and returns one of three states, **never conflating the last two**:
  `RAN <pass> <fail> <skip>`; `EXTRACTOR-ERROR` (the suite ran — a duration or tests line proves it — but
  the counts are unreadable: **our bug, named as ours**); `DID-NOT-RUN` (no sign of a run: the app's).
  Principle registered: `a-parser-that-cannot-read-the-result-must-not-report-one` (74 → 75).
  **Bite:** make the parser fall through a ran-but-unreadable result to DID-NOT-RUN → the parser test
  reds; the five-case test covers tap, spec, extractor-error, did-not-run, and a genuinely-failing count.

## F2 — the Flutter gate was reported merged but was NOT delivered
The battery's own note said it: `resident-mobile 8 Flutter test(s) — NOT gated anywhere`. The job I
authored earlier (`dd243bd`) was **discarded when I reset `codex/gen-048` onto main** for the R6 work,
and it never reached main. **Delivered now** in the workflow: job `the resident-mobile Flutter suite`,
`subosito/flutter-action@v2`, **pinned `flutter-version: '3.44.3'`** (Dart 3.12.2, satisfying
`pubspec.yaml`'s `sdk: ^3.12.0`; `releases_linux.json` read 2026-09-03), a step asserting the resolved
Flutter IS the pin, then `flutter test` over the 8 `*_test.dart` files as they stand. A red there blocks
merge. It runs on `ubuntu-latest`, so there is no hosted-runner obstacle. The battery note now points at
this CI job instead of "NOT gated anywhere".

## Which job carries which result (as noted)
- **The Flutter suite:** job `the resident-mobile Flutter suite`.
- **The browser suites (R4's browser line):** a STEP named `the app browser suites` inside the
  `register` job — its Playwright `--version` / browser line is read from **that step's** log, not the
  build step. `SKIP hook-opt-in: not asserted in CI` is a correct loud skip (CI has no clone to opt in).

## Standing
- **R12:** `codex/gen-048` at HEAD prints the environment header (Node/pnpm/TZ/LANG/Postgres) in the
  first ten lines of any run, and builds via the one shared script (R6). Pushed for the PO to run.
- **R5:** red since #57 (`0d0abbe`), the build failure masking a one-test environment divergence; **the
  #57 `not ok` line is still owed to me** to name that test (R14, not a blocker).
- **R16 (delivered):** the workflow now triggers on \`push: branches: ['**']\` — any pushed branch runs
  the full workflow, a dry run of the merge without a PR. That is the trigger chosen; \`main\` is included
  by \`'**'\`. So \`codex/gen-048\` at HEAD self-reports on push, and the reporter-format class of stall
  cannot recur.
- **R15:** the PO opens a PR \`codex/gen-048\` → \`main\` (not merged by them); its run is a rehearsal of
  the merge on the merge ref. When that run is green — build, battery, both UI suites RAN with real
  counts, the Flutter job passing, the env header printed — I merge by refspec and the PO relays the
  \`main\` run. GEN-048 closes on that URL plus the browser line. A red PR run is reported, not merged.
- **R10/R4:** the probe's red is R4's red half — its URL follows once this lands and the probe is
  re-pushed onto the fixed main.
- GEN-048 does not close until a `main` run is green **with the Flutter job present and passing**.
