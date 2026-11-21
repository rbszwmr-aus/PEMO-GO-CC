# GEN-046 CLOSE — Governance: harness trust → UI gate → allocation rule → principles

**Verdict: CLOSE confirmed** (Rule 7 already executed against the step-2 ruling;
this document completes the filed record, including the three items dispatched
after that ruling was filed).
Date: 2026-09-03

## Standing of the work

origin/main 2f5e733 → 75d92fe, tree-hash equal on both pushes via `git ls-remote`,
through the hook, no `--no-verify`. Battery 33/33 (31 + two new gates). Manifest
**22 proven, 0 failed under the stricter four-condition criterion**; harness
self-test 9 cases, each one the runner must refuse — all 9 refuse. Rule 7:
`archive/GEN-046.md`, status merged, closed 2026-09-03.

## The PO's record gap — owned

Items 2 (adopt the stricter mutation criterion), 3 (resident-portal regeneration +
the generated-consumer stamp check + the apps/** suite inventory) and 5 (G7:
`superseded` status + explicit `-RULINGS-` cross-reference) were added to the
dispatch **after** the step-2 ruling was filed and were not re-filed. Main CC
executed them as new dispatch and said so in §0 — correct: the filed artifact is
the authority for what was ruled. **They are ruled here, retroactively and
explicitly, as part of GEN-046's scope**, so the record and the work agree.

## Findings — all accepted

- **Rule 4 bit once, correctly.** GEN-041's `snapshot-is-the-membership`
  mutation produced 7 undeclared reds — it admitted every resident, showing the
  module breaking rather than that guard failing. Re-aimed with COALESCE so case
  2 is the only case that can move. Exactly one over-broad mutation among 22,
  and collateral bounding found exactly it.
- **The self-test found a defect in itself on first run:** its "mutation does not
  apply" case used a literal sentinel that appeared in the file under mutation,
  matched once, and rewrote the runner's own source. Composed at runtime now,
  with a second case asserting the refusal path writes nothing.
- **A bite against a generated file silently no-ops:** a UI app's build runs
  `generate`, which undid the mutation before the check looked. `with-mutation.sh`
  now refuses when the rebuild undoes the mutation; the stamp-check bite is
  re-aimed at the contract, naming both consumers. Recorded as a class: *a
  mutation the build undoes is not a mutation.*
- **The last-PID-closes deadlock:** archiving GEN-046 emptied `pids/`; the battery
  aborted for lack of a victim on the premise "an in-flight PID always exists" —
  false exactly when the last PID closes, leaving `--no-verify` as the only exit.
  Fixed by synthesising an in-flight victim from the newest archived PID under the
  next number, removed on exit, tree byte-identical; the archive/ fallback was
  tried first and measured wrong. Accepted.

## Two things correctly stated rather than smoothed — PO decisions

1. **A third ungated suite: `apps/resident-mobile` (Flutter)** — 8 `*_test.dart`
   files run by nothing, invisible to a package.json-keyed gate; Flutter not on
   PATH, state not asserted. The gate now names it. **Gating requires a CI
   toolchain decision (Flutter SDK on the runner) — PO to rule.** Recommendation:
   add it; the resident mobile app is a product surface and an ungated suite is a
   suggestion.
2. **The CI browser job is written but unverified** locally. It runs on push:
   **Main CC reports the GitHub Actions outcome for 75d92fe** — that is the
   verification, no further work needed unless it fails.

## Owed register (consolidated after GEN-046)

- Harness classes for the ~36 prose bites (DDL/grants, shell guards, HTTP
  adapters, boundary scans) — next governance PID after GEN-047.
- Exact / branded resident projection type (boundary structural, not test-only).
- Multi-node ticket case (prove covering, not existence).
- Flutter toolchain in CI (PO decision above).
- Context-scoped citation recognition (bracketed tokens in free prose are
  mentions) — the `data-tree-chrome` collision at UI-045 is the fifth-plus
  instance on a namespace no derivation can enumerate.
- `destructive-target-confirmed` — Section 0 still unsupplied.
- From UI-004 (superseded): Overview design intent; Cases field list (cut C);
  Home Safety observation-timestamp / freshness field.

— PO close ruling.

---

*Carried into `docs/governance/reports/` by `GEN-047`'s PART A carry-in commit. ONE edit against the drive original: the HTML attribute in the owed-register entry was written in square brackets and now carries backticks alone, as `data-tree-chrome`, because `adrs-present` reads any bracketed token as a principle citation and refused the carry-in. That is the sixth instance of the collision the entry itself describes, and it is why context-scoped citation recognition is owed. Backticks alone do not exempt a token; `UI-045` set the precedent at `2f5e733` by removing the brackets.*
