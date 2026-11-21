# GEN-048 step 5 — #101: the migration guard is fixed; two new reds, one mine, one a ruling

**Date:** 2026-09-04  **Run #101 (a8342f3):** F3 (migration/origin-main) and F4 (Flutter pipe crash) are GONE.
Two reds remain: **F5** (mine, fixed) and **F6** (the Flutter gate doing its job — a PO decision).

## F5 — the browser step: `playwright not found` (mine, fixed)
`register > the app browser suites` ran `pnpm exec playwright install` at the **repo root**, but
`@playwright/test` is a devDependency of `apps/management-web` and `apps/resident-portal` only — so the
`playwright` binary is not resolvable at the root (`ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL`). **Fixed:** the
install and the run both happen **inside each app** — `pnpm -C "apps/$a" exec playwright install
--with-deps chromium` then `pnpm -C "apps/$a" run test:browser`. This is the browser line R4 needs, and
it comes from **this step**.

## F6 — the Flutter gate CAUGHT a real defect, and it is out of my scope
The Flutter suite ran (F2 works — 278 cases, first time ever) and **2 contract tests failed**, both in
`test/contract/palette_matches_contract_test.dart`:
1. *contract version matches the generated tokens and the embedded corpus*
2. *embedded fixture corpus is byte-identical to the source corpus*

**Diagnosed cause, named and dated:**

| | |
|---|---|
| `severity_tokens.g.dart` / `fixture_corpus.g.dart` carry | **contractVersion 0.2.2** (last regenerated 2026-08-13, UI-007-ST) |
| `packages/api-contracts/resident-mobile/severity.json` is | **0.4.0** (bumped 2026-09-02, GEN-042; corpus moved again at GEN-052) |
| so the test `SeverityTokens.contractVersion == contract['contractVersion']` | 0.2.2 ≠ 0.4.0 → red |

**GEN-042 and GEN-052 bumped resident-mobile's contract and never regenerated its Flutter `.g.dart`
consumer** — GEN-046's "the contract-bumping PID regenerates every consumer" rule, skipped for the
Flutter app because there was no Flutter host. These 2 tests have been **latently red since 2026-09-02**;
the gate F2 delivered is the first thing to run them. **This is exactly GEN-048's own spec stop
condition:** *"Any of the 8 resident-mobile tests is red on main before this change — report which and
why; do NOT fix them in this PID."* And the `.g.dart` files are explicitly outside GEN-048's write scope
(*"NOT apps/resident-mobile/\*\* — its generated files belong to the contract-bumping PID"*), and there
is **no Flutter on this host** to regenerate them, nor may I reimplement the Dart generator in node (a
byte-difference would fail the byte-identity test, and it is not my scope).

Recorded as a debt with a creditor: `tests/fixtures/flutter-test-debt.json` (both tests, the 0.2.2→0.4.0
cause, the owing PID). **I did not touch a single generated Dart file.**

## The ruling I need (F6)
The Flutter gate now blocks merge on 2 reds GEN-048 cannot fix. Two consistent resolutions, the PO's to
choose — I will not weaken F2's "red blocks merge" on my own authority:

- **(A)** a resident-mobile regeneration PID (a Flutter host, or a node port of `generate_tokens.dart` /
  `generate_fixtures.dart`) regenerates the two `.g.dart` to 0.4.0 and lands FIRST; then GEN-048's gate is
  green and GEN-048 merges. GEN-048 is blocked on it.
- **(B, recommended — the debt-with-creditor discipline)** the Flutter job gates the suite while the two
  NAMED tests in `flutter-test-debt.json` are exempted from BLOCKING (the other 276 gate now); the
  exemption is removed the moment regeneration lands. The gate is live and honest today, the 2 reds are
  tracked not hidden, and GEN-048 closes. If (B), I wire `flutter test` to skip exactly those two by
  name from the debt file, with a test that the exemption list is honest (a debt whose test now passes
  must leave the file).

## Standing
- **F3/F4 accepted; R14 resolved** (F3 = the #57 failure). **F5 fixed** here.
- GEN-048 **cannot close** until a `main` run is green across every job; F6's ruling decides whether that
  needs option A first or option B now.
- **R13:** GEN-055 holds. **R16** self-reports this branch on push.

---

## F6 — RULED (B), delivered with teeth (2026-09-04)
The PO ruled option B: gate the suite, exempt only the two booked contract tests, and make the
exemption incapable of rotting. Delivered as `docs/governance/bin/flutter-gate.mjs`, called by the
Flutter job (which captures `flutter test --reporter json` to a file first — no live pipe — then hands
the path to the gate):

| rule | mechanism | bite |
|---|---|---|
| 1 skip list read from the file | the gate reads `flutter-test-debt.json` at run time; no name in the gate or workflow | test asserts neither file contains an exempt name |
| 2 every entry has cause + date + PID | `--validate-debt` reds on a missing field | weaken the check → a missing `owedBy` validates → reds |
| 3 the debt screams when paid | an exempt test that PASSES reds, naming it "remove from flutter-test-debt.json" | drop the scream → an exempt-and-green test passes → reds |
| 4 summary every run | prints N gated, M exempt, each name + owing PID | (in every run's output) |
| 5 exemption covers only the two | any other red blocks merge (F2) | exempt every failure → a new red passes → reds |

All decision logic is tested WITHOUT a Flutter host by feeding synthetic `--reporter json`
(`flutter-gate.test.ts`, 6 cases); three bites proven through the runner. So the run under (B) is green
when the build, the battery, both UI suites (real counts), the browser step, and the Flutter gate (276
gated green, 2 booked debts still red as booked) all pass. **Merge follows that green; GEN-048 closes on
the main run URL plus the browser line from `the app browser suites`.**

The creditor is dispatched as a NEW PID (D1 port the two Dart generators to node; D2 regenerate to 0.4.0
and empty the debt file — rule 3 reds if forgotten; D3 extend the stamp check to every consumer,
Dart included, from a declared list, principle `a-consumer-outside-the-stamp-check-is-not-a-consumer-it-is-a-copy`),
to be allocated after GEN-048 closes.
