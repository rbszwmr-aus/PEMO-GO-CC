# Decision note — Flutter toolchain in CI; CI browser job verification

Date: 2026-09-02
Decided by: PO (RBS)
Recorded by: Claude (brain)
Routing: Main CC (CI workflow is `apps/api/**` / repo root territory; `apps/resident-mobile` generated files stay with the contract-bumping PID)
Status: decided — dispatched to Main CC 2026-09-02

## Context

GEN-046 close ruling (`GEN-046-RULINGS-close-governance-harness-trust.md`) left two items owed to the PO as decisions, not work:

1. `apps/resident-mobile` carries 8 `*_test.dart` files that no CI job runs. The Flutter SDK is not installed in the CI image. The GEN-046 UI-suite gate therefore covers `apps/management-web` only; resident-mobile's tests are a CLAIM under the corpus standard (a bite that cannot be rerun is a claim).
2. The CI browser job (management-web suite under a real browser) was added in GEN-046 and merged at 75d92fe. Main CC reported the job as configured; nobody has yet read the GitHub Actions outcome for that commit. Until the run is read, "the browser job gates" is also a claim.

## Decisions

D1 — Flutter toolchain goes into CI, and `apps/resident-mobile`'s tests join the gate.
PO words: "Flutter toolchain 入 CI + 加:resident mobile".
Meaning: the CI workflow installs a pinned Flutter SDK and runs `flutter test` over `apps/resident-mobile`; a red there blocks merge the same way a management-web red does. Pin the Flutter version in the workflow (no `latest`); record the pin in the PID close report. The 8 tests are gated as they stand — this decision does not ask for new resident-mobile tests.

D2 — Verify the CI browser job.
PO words: "驗CI browser job".
Meaning: Main CC reads the GitHub Actions run for 75d92fe (and the run for the PID that lands D1) and reports the outcome verbatim: workflow name, job name, conclusion, duration, and — for the browser job — evidence that the suite ran under a browser and not under a node fallback (browser name/version line from the runner log). A green that cannot show the browser line is not a verified browser job.

## Routing

Both items are governance/CI work owned by Main CC. They are dispatched as one PID (next GEN-NNN under the parallel allocation rule: two-file allocation commit first). Not folded into GEN-047 — GEN-047 is a contract PID (2.1.0) and must not carry CI changes.

## Owed register (from GEN-046 close) — updated

- Flutter CI: decided (D1) → in flight.
- CI browser verification: decided (D2) → in flight.
- Unchanged and still owed: harness classes for ~36 prose bites; exact projection type; multi-node ticket case; context-scoped citation recognition; destructive-target-confirmed Section 0; S2 overview NoticeRow + design intent; Cases field list; Home Safety freshness; object-store decision.
