# GEN-016 (occupancy END write) — Step 2 rulings + close

Date: 2026-08-29
Report: rewrite/reports/GEN-016-step2.md — HARD STOP, nothing committed beyond allocation, main 8cbdf878.
343 tests green, boundaries PASS, battery 21/21, validator PASS, index OK.

## Verdict: MERGES. Occupancy is the first table walked fully through ADR-013 (migration → resolver → end → cardinality). The mutation work sharpened the model; close it.

---

## R1 — GEN-016 APPROVED. No widening, proven by measurement.

The end write + advisory-lock guard, with the crossing count **unmoved at two** = the proof no
shared code widened. The real fix was moving the check inside the act (GEN-013 checked in the route
and appended in the transaction, so nothing was ever serialised). Everything raced on **real
connections** (two pools, `Promise.all`); removing the lock reds both guard tests and returns
`[INSERTED, INSERTED]`; removing the isolation assertion reds its test. Close per Rule 7.

## R2 — `reason`: the stop condition fired correctly → an owed audit-spine decision.

`access.audit_event` has no free-form field (GEN-009 built exactly D1's four properties). So `reason`
has no home except a forbidden occupancy column or a change to the shared audit spine — a decision,
not this PID's implementation. Correct to build nothing, add no column, and state the omission in
the schema. **Owed decision (product/platform): does the audit spine carry act-reason?** — a
structured/free-form detail on `audit_event`, weighed against keeping it minimal. This recurs for
every write that records *why* (end reason, correction reason, disposition reason); rule it once,
before those multiply.

## R3 — The two-invariants/two-mechanisms finding: ACCEPTED, a keeper, folds into ADR-013.

The mutation work revealed **`UNIQUE(occupancy_id, version)` is load-bearing independently of the
lock**: it holds **within-instance supersession** (two ends of the same occupancy), while the
advisory lock holds **cross-instance `(resident, unit)` cardinality** (two creates for one pair).
Two invariants, two mechanisms — do not credit the lock with both. Correct correction.

And the fix to the unmapped `23505`: a correctly-refused act was surfacing as a **500 server
fault**; the route now maps that constraint violation to the winner's truthful outcome (instance
ended → not live → **409**, nothing appended). Two rulings, folded to ADR-013 as corollaries:

> **ADR-013 corollary:** D2's `UNIQUE(instance, version)` and D5's cardinality mechanism are
> **orthogonal** guards for orthogonal invariants; each carries its own oracle.

> **PID-PRINCIPLE:** a raw DB constraint violation (`23505` etc.) must never reach the client as a
> 500 — it maps to the act's truthful outcome.

## R4 — `guardLiveOccupancy` stays private: CORRECT restraint.

Not promoted to platform on one instance — promotion is a shared-primitive touch, and the next
table inherits the **pattern, not the code**; the second consumer reveals the right shape. Same
discipline as "don't widen shared code on speculation." Consistent with the split we already hold:
the resolver was genuinely shared (D4); the guard is not-yet-shared.

## R5 — Retry-idempotency absent AND asserted-absent: correct.

Asserting the absence makes building the request-token later a **deliberate** change, not a silent
one. Good.

## R6 — The three flagged gaps → owed, with dispositions.

- **The lock is a convention a new command could bypass.** This is the accepted cost of
  computed-current cardinality (a DB constraint is impossible here). It is also the one place the
  invariant can **silently** regress. Mitigation owed (C): a standing guard that every
  occupancy-creating/ending path goes through `guardLiveOccupancy` — a boundary/battery check or, at
  minimum, a documented invariant + a test that a new unguarded path fails.
- **Timing-shaped racing tests (150ms windows, slow/flaky in CI).** Owed (C): replace sleep-windows
  with deterministic synchronisation (advisory-lock barriers / explicit gates) so concurrency tests
  are fast and non-flaky.
- **GEN-014's one-office race fixable by this pattern.** Confirmed — but note the mechanism: one-
  office is **row-presence** cardinality (a contact simply exists), NOT computed-current, so its
  right tool is the **partial unique index** (D5 option 1), not the advisory lock (D5 option 2, for
  computed-current). When the one-office fix is scheduled, use the partial unique index.

## Close instruction
Merge (standard gate; `[GEN-016]` tag; push gated on `--check` + battery). Rule 7 close: GEN-016 →
archive/ with row, `status: merged`, `closed: 2026-08-29`, artifacts carried (spec, step1 report +
ruling, step2 report + this ruling).

## Milestone
**Occupancy is the first table walked fully through ADR-013.** The next three state-change tables
(`building_service_availability`, `installed_services_note`, quarantine disposition) now inherit the
proven pattern — mechanical relative to the foundation. A's proving purpose is complete **twice
over** (scope-only path; assertion-model path). The program is at the phase boundary flagged at
GEN-014: breadth is now repetition; the value is in **C (debt) and the owed decisions**, then the
**schema-origination vs WEB-15** product fork.

## Owed ledger — additions this PID
- audit-spine **act-reason** decision (product/platform).
- ADR-013 corollaries: orthogonal-guards; (from GEN-016 R2 prior) advisory-lock preferred for
  computed-current; lapse-vs-end.
- PID-PRINCIPLE: constraint-violation-never-a-500.
- lock-is-a-convention guard (C); deterministic concurrency tests (C).
- one-office race → partial unique index (row-presence), scheduled with GEN-014's table.
(Everything else as STATE-2026-08-29b + GEN-015 additions.)
