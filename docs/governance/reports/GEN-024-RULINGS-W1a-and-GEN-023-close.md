# GEN-024 (W1a) — rulings + close, and GEN-023's close ruled

Date: 2026-08-31
Report: rewrite/reports/GEN-024-step2.md — HARD STOP, nothing committed.
Contract 105/105 · integration 252/252 (+10) · battery 24/24 zero skips · boundaries PASS · validator PASS.

## Verdict: both close, in TWO commits — GEN-023 first (its carry-in), GEN-024 on top.

---

## R1 — The concurrency-probe finding is the highlight, and it exposes a knowledge-transfer gap.

The test passed with the advisory lock **deleted**, because `Promise.all` over two pools is not a
race: each `confer` is milliseconds, the first transaction commits before the second reads, and the
second then refuses correctly **with or without a lock**. The test was asserting that *sequential
execution produces one row* — **true of anything**. That is an empty oracle at the probe level.

GEN-016 had already solved this (hold the transaction open with a `setTimeout` inside the callback)
and it was not carried forward — **a technique that made a prior probe real was re-derived instead of
reused.** The load-bearing comment you added is the right guard: the next person tidying a
`setTimeout` out of a test will not silently disarm it.

**Ruling — fold a WORKED NOTE onto `[probe-must-bite]` in `PID-PRINCIPLES.md`** (riding W1b+W1c, one
item, explicitly scoped): *a concurrency probe must be shown to actually overlap — "issued together"
is not "racing"; hold the transaction open inside the callback, and mark that line load-bearing.*
Recording the **technique** with the principle is what stops the next re-derivation.

## R2 — The revocation proof: a discriminating oracle, not an assertion.

You did not assert the grant is no longer live; you proved **the resolution is what does it** — the
pre-`0118` raw-table read still returns the revoked grant **as live**, and the resolver does not.
*The two disagreeing is the point.* And version 1's open period is untouched, so the historical
question still answers — which is exactly what a revocation must not destroy. This is the standard.

## R3 — The migration names its own weakness. That is the standard too.

It states what `0112` claimed, what GEN-023 measured against it, why no declarative form survives
(including that adding `version` fails because a re-grant's first assertion is also version 1), and
the trade in plain words — **including that the advisory guard is bulk-load-bypassable in exactly the
way `0112` warned about, and that the detector is what is not.** A control that names where it does
not reach is worth more than one that implies completeness.

## R4 — The down migration refusing when a revocation is present: correct, and well-reasoned.

Clean reversal restores the exclusion; with a revocation present it **refuses**, because reversing
would **silently restore withdrawn authority**. A down migration that would quietly re-grant revoked
authority must refuse — approved, and worth remembering as the shape for any reversal that could
resurrect a withdrawn right.

## R5 — The detector bites and does not over-reach.
Duplicate → red, naming the key; two different groups at one node → green (`ADR-012` `D5`
multiplicity preserved). Correct on both sides.

## R6 — The two out-of-scope touches: accepted, and one confirms a general consequence.

Both are consequences of the ruled change and were disclosed rather than folded:
- The seed's `ON CONFLICT (grant_id)` retargeted to `(grant_id, version)` — and note the battery
  caught it as *"seed did not complete"* rather than passing silently. This is the **second** table to
  need this, after occupancy: it confirms the general consequence flagged at GEN-015 R4 — **every
  state-change table's seed `ON CONFLICT` needs re-keying when it becomes assertion-shaped.** The next
  one should anticipate it rather than discover it.
- A **second stale test at `:429`**, same defect and same cause as the `:298` I named. Correct to fix
  it; I named one because I knew of one — you found the other.

## R7 — GEN-023's close: SPLIT INTO TWO COMMITS. GEN-023 first.

Your preference is right and I rule it. GEN-023's deliverable is the **ADR-014/015 carry-in** plus its
two assessments — that is its own PID's work, not GEN-024's, and one-PID-one-closure has served us.
Splitting also means GEN-024's own citations resolve against ADRs **already on `main`**, rather than
against files riding in the same diff.

- **Commit 1 — GEN-023**: the ADR-014/015 carry-in. Rule 7 close, artifacts: spec, step1 report +
  ruling, step1b report + ruling. (A carry-in-only PID is a legitimate close — C1/GEN-017 was the same
  shape.)
- **Commit 2 — GEN-024**: W1a. Rule 7 close, artifacts: spec, step2 report + this ruling.

Both through the hook, no `--no-verify`; `closed:` stamped from `date`.

## R8 — `confer` is authorized by nothing and says so in its own header.
Good — W2 cannot discover that by accident. Keep the header.

## Next: W1b + W1c — one PID, two independent oracles.
- **W1b**: `audit_event`'s provisioning shape (`source` NOT NULL + nullable authority + one
  biconditional; existing rows backfill `source='staff'`) and `reason_code` (ADR-014).
- **W1c**: replace `platform.idempotency_record` with the ADR-015 shape — `(principal, operation, key)`,
  the act's identity not a response blob, written in the **same transaction** as act + audit (which
  closes both of the shipped mechanism's windows).
- **Plus the one-item R1 note** onto `[probe-must-bite]`.
Each carries its **own** oracle; a finding in one must not ride silently on the other.

Then **W2** (grant write surface) and **W3** (group + membership).
