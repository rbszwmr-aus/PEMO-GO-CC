# GEN-018 (C2 batch [C+F]) — rulings + close

Date: 2026-08-30
Report: rewrite/reports/GEN-018-step2.md — HARD STOP, nothing committed beyond allocation.
22/22 battery, 343 tests, boundaries PASS, validator PASS, index OK.

## Verdict: MERGES after one small addition (the distinguishing notes, R3). Then batch A.

---

## R1 — ids for ALL 55 entries, not just the seven: correct judgement.

A scheme applied to part of a file is `docs/adr/README.md`'s own recorded failure — "a rule that
ships with standing exceptions reads as a suggestion" — and mechanically, batch A's citation check
could not otherwise distinguish "cites a non-existent id" from "cites an entry that has no id yet."
Prefix-only insertion, no existing text touched, line-auditable diff. Approved — a scheme is total or
it is not a scheme.

## R2 — Legacy resolution + the zero: both correct and correctly reported.

All five legacy numbers resolve, each from its citing context with quoted evidence, each target
verified to exist exactly once; none declared unresolvable. And "update live citations = zero
instances" (all 17 numeric citations sit in immutable `reports/`/`archive/`) reported plainly rather
than silently no-op'd — so the legacy map is the **entire** mechanism, not a fallback, and the file
says so. This is the standard.

## R3 — The seven are seven: KEEP them, and settle permanence with a distinguishing note per near-pair.

You could not disprove the two near-pairs are distinct; I settle it by naming the axis that separates
each, added as a one-line "distinguished from `[other]` by …" note in `PID-PRINCIPLES.md`. That
supplies the precision of seven ids AND removes the ambiguity that made permanence risky — so the ids
are safe to be cited by A.

- **`[shadowed-layer-empty-oracle]` vs `[teardown-isolation]`** — axis: the **assertion has no teeth**
  (an empty oracle; a mutation survives green) vs the **fixture/shared state is corrupted** (false
  breakage, or a leaked pass). Two distinct failure modes of test integrity: what the test *proves*
  vs what the test *sets up and tears down*.
- **`[patch-verify-on-disk]` vs `[merge-gate-precondition]`** — axis: trusting a tool's **self-report
  of its own effect** (fix: observe the real artifact on disk) vs gating an action on the **wrong
  exit status** (fix: wire the gate to the status of the thing that actually matters). Same root — an
  unverified status — but different fixes and different sites.

Add these two notes; then the seven ids are final and A may cite them.

## Close instruction
Add the two distinguishing notes (R3) — the only remaining edit to this pure-doc batch. Then merge
(standard gate, `[GEN-018]` tag, push gated on `--check` + battery — the manual known-good gate; D has
not landed). Rule 7 close → archive/ with row, `status: merged`, `closed: 2026-08-30`, artifacts
carried (this PID's spec, step1 report + ruling, step2 report + this ruling).

## Next: batch A (new PID)
"All governance references resolve": extend the presence check to amendment granularity (accepting
BOTH folded and separate-file shapes by self-declaration), add the principle-citation-resolves check
(citing the now-final ids + the legacy map), the Rule-7-exclusion red, and bring ADR-003 AM4 into
`docs/adr/`. Then B, then D+E.

## Owed ledger
C2: [C+F] closing; A, B, D+E to go. Then idempotency token + audit act-reason (brain), then the
schema-vs-WEB-15 fork.
