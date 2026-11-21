# GEN-014 (A) — Step 2 rulings + close

Date: 2026-08-29
Report: rewrite/reports/GEN-014-step2.md — HARD STOP, nothing committed beyond allocation, main 8839d42f.
327 tests green, boundaries PASS, battery 21/21, validator PASS, index OK.

## Verdict: the write MERGES. The concurrency race is CONFIRMED, its principle affirmed, its fix bound to the idempotency decision — not bolted on here. Close A's proving phase.

---

## R1 — R3 closed; write APPROVED to merge.

The in-query filter is proven as the PRIMARY gate: because `property.estate` is the writing
module's own table, `findEstateInScope` resolves-and-filters in one query and that query is the
decision — deleting it reds the suite at the route, which GEN-013 structurally could not do. No
second filter on the INSERT (correct: harmless, unprovable, and the same shadowing inverted). The
contract now names which layer decides per write — exactly the discipline; reading one operation's
arrangement into the other would be reasoning about the wrong control.

**Cleanest generalisation yet, and it is the real result:** no new mechanism AND no shared code
widened — `findAuthorizingGrant` consumed unchanged. The first time a new write cost the shared
layer nothing. That is the proof the audited scope-only path is DONE, not merely reused. Close per
Rule 7.

## R2 — The two non-biting mutations: honesty accepted, no defect.

Empty-scope early return removal changed nothing (`= ANY('{}')` already false for every row — it
is intent documentation, not a control). Narrowest-vs-broadest is untestable at estate-or-above
depth here; confirmed still biting in the ✖1/✖2 depth suites. Reporting these plainly rather than
dressing them up is the standard. No action.

## R3 — Finding 1 (stale `info.summary` from an aborted patch script): a TOOLING class → C principle.

A patch script reported success for edits it discarded when it asserted mid-way and aborted before
its single write; GEN-013 shipped a stale summary ("the first scope-only write") and nothing caught
it. Two lessons:
1. Multi-edit patch operations must be **atomic and verified by re-read**, never trusted from the
   script's own success report. Main CC already moved to one guarded pass — adopt as standard.
2. Our verification proves **consistency (the hash covers the file), not correctness** — a
   stale-but-consistent prose statement passes every gate invisibly. Cannot be fully closed, but
   name it: **prefer derived/generated values over hand-written prose wherever a value exists**;
   hand-written prose assertions in contracts are a known silent-staleness blind spot.
→ PID-PRINCIPLES (C).

## R4 — Finding 2 (teardown `ctc_%` deleted seeded rows): THIRD teardown-as-breakage → ELEVATE.

A teardown prefix matched seed data, surfacing as a domain test failing to find a conflict that
should have existed — a fixture fault in the costume of a code fault, for the **third** time.
Ruling: teardown must be scoped to the test's own inserts, never a prefix that can match seed data.
The harness-isolation item (reseed() clears pinning rows + teardown-scoping) is **elevated to the
first tranche of the C sweep** — three recurrences is the signal that it costs more unbudgeted than
it would cost to fix.

## R5 — The concurrency race (one-management-office, count-then-insert): CONFIRMED. Principle affirmed. Fix BOUND to idempotency, not bolted on.

The finding is real: the one-office rule lives in the route as count-then-insert, so two concurrent
requests can both pass the count and both insert. **Application count-then-insert is the uniqueness
analogue of the fetch-then-reject anti-pattern we already forbid** — the invariant belongs at the
layer that can hold it (a DB partial unique index), not in the route. It is not acceptable long-term.

But the fix is NOT taken in GEN-014, for two reasons:
1. It is a **migration** — GEN-014 is a scope-only write that must not originate schema. A one-off
   index bolted on mid-write is scope creep.
2. It is the **same class as the queued idempotency decision** (one logical act → one row). ADR-010
   A1's rule stands: **do not solve one shape twice, differently.** A one-off index here risks
   conflicting with the general mechanism.

Therefore: GEN-014 **merges with the race DISCLOSED in the contract** (as occupancy's end-path was
disclosed), the fix **specified** (partial unique index + map the unique-violation to the same
"already exists" response) and **bound to the idempotency decision**, which must close before these
writes are relied on. The principle is recorded now; the implementation is solved once, generally.
**Before close, confirm the disclosure is in the contract, not only in the report.**

Consequence for sequencing: **idempotency rises** — it is no longer only about retries, it is what
makes every landed scope-only write concurrency-correct. It now sits alongside the supersession
decision as the two decisions gating the writes already on the ground.

## Close instruction
Merge (standard gate: refspec push from worktree, main never checked out, tree-hash equality re-read
from remote via `git ls-remote`; `[GEN-014]` tag; push gated on `pid-index --check` + battery).
Then Rule 7 close: file → archive/ with row, `status: merged`, `closed: 2026-08-29`, all artifacts
carried (spec, both step reports, both rulings). Confirm the concurrency disclosure is in the
contract before pushing.

## Owed ledger (updated)
ADR-consolidation into docs/adr/ **[first C]** · supersession-key decision **[next, brain-authored]**
· **idempotency [risen — gates concurrency-correctness of landed writes; the one-office race binds
here]** · teardown-isolation / reseed() **[elevated → first tranche of C]** · atomic-verified-patch
+ derived-over-prose principle · GEN-009 cross-surface error-URI sharedMeaning · shadowed-layer
empty-oracle principle → PID-PRINCIPLES + battery case · merge-gate `--check`+battery (codify) ·
premise-arm-guard · stable principle ids · read DOC-021-ST.

## After close
A's proving phase is complete (GEN-009 built the path, GEN-013 generalised it across a module,
GEN-014 proved the in-query filter as primary gate at zero shared-layer cost). Next: I author the
supersession-key decision. Then the PO's fork — schema origination (notices/cases) vs WEB-15 grant
administration vs a C-debt sweep — which I will lay out as a real product-scope choice.
