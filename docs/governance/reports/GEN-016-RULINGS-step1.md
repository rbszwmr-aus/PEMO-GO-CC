# GEN-016 (occupancy END write, Slice B) — Step 1 rulings

Date: 2026-08-29
Report: rewrite/reports/GEN-016-step1.md — HARD STOP, nothing built. Pin 913b47d1 (post Slice A), allocation 8cbdf878, next 017.

## Headline: advisory lock, NO widening, and it is a BETTER outcome than ADR-013 D5 anticipated.

---

## R1 — Mechanism: per-key advisory xact lock. APPROVED, on the settling finding.

The finding that settles it is correct and is the whole point: **the current shape serializes
nothing because the check is in the route, outside the transaction** — no isolation level can fix a
check that is not in a transaction. So the common first move under every option is: **the conflict
check moves inside the act callback.** Once there, the advisory lock is one statement on `tx` and
needs nothing from `auditedWrite`/`ModuleDb`; SERIALIZABLE would still need isolation-at-BEGIN, a
retry loop, and a re-runnability contract on every act callback in the system. Smallest blast
radius that holds the invariant at the DB → advisory lock, decisively.

The race was **reproduced on the real primitive through two real connections** (lock OFF →
`[INSERTED, INSERTED]`, 2 live rows = GEN-013's defect; lock ON → `[INSERTED, refused]`, 1). That is
measurement, and it also answers deliverable 3: the **same guard retro-fixes GEN-013's create
path**, and the disappearance of `[INSERTED, INSERTED]` is the proof.

## R2 — "No widening": CONFIRMED. And it refines ADR-013 D5.

I expected Slice B to need a second shared-primitive widening; it does not, because the real fix was
**relocating the check into the transaction**, not changing the primitive. GEN-013 widened
`findAuthorizingGrant`; Slice A widened nothing; Slice B widens nothing. Confirm: **no
`auditedWrite`/`ModuleDb` widening.**

This is cleaner than ADR-013 D5 assumed. **ADR-013 D5 refinement (corollary, fold at consolidation):**

> The preferred mechanism for a **computed-current cardinality** invariant is a **per-key advisory
> transaction lock with the conflict check inside the act callback** — no primitive widening, blast
> radius confined to the key. `SERIALIZABLE` is the fallback only where the invariant spans keys and
> a single advisory key cannot cover it.

## R3 — The READ COMMITTED dependency must be ASSERTED, not trusted.

Correctly surfaced: the mechanism relies on READ COMMITTED (each statement takes a fresh snapshot);
under REPEATABLE READ it silently stops working. Step 2 must **assert the isolation level** (fail
loudly if it is not READ COMMITTED), not trust the default. Standing principle (PID-PRINCIPLES):
**a mechanism whose correctness depends on the isolation level must assert that level — a default is
not a guarantee.** Also confirmed against the floor: `pemo_app` can take advisory locks and call
`hashtextextended`.

## R4 — The three consequential rulings sought.

**(a) No widening — confirmed** (R2).

**(b) A repeated deliberate end of an already-ended occupancy is a `409`, not an idempotent `200`.**
This PID owns **state-identity** only (your own framing, and correct). The endpoint enforces the
precondition *"the occupancy is currently live"*; ending a non-live occupancy is a **precondition
failure → 409**, and it appends **no** assertion (no-op ends must not pollute the version chain).
Turning a genuine **retry** of the same request into a `200` is the **request-token's** job (D6
request-identity half), which is **owed and NOT built here** — do not have the endpoint guess whether
a repeat is a retry or a mistake. Ending-with-a-different-date is a *correction*, not an end, and is
out of this PID's scope — also `409` (or `422`), never a silent re-end.

**(c) `reason` is act-metadata → it lives in the AUDIT EVENT, not an occupancy column.** The
occupancy assertion states the *fact* (ended, `effective_to`); *why* it ended is a property of the
**act**, which is exactly what `access.audit_event` records (ADR-010 D1's four properties). Adding a
`reason` column to occupancy would conflate act-metadata with fact-data — do not. Confirm at Step 2
that the audit event payload can carry the reason; **if it cannot, surface it as a finding** (the
audit event should carry act-reason — a small platform question), rather than bolting `reason` onto
the occupancy row.

## R5 — Idempotency token correctly out of scope.

"Necessary for retries, insufficient for cardinality" is exactly right — two staff recording the
same resident into the same unit are two distinct intents no request identity relates. D6 splits the
halves; this PID owns state-identity; the request-token stays owed.

## Verdict: proceed to Step 2. Build the END write + the advisory-lock guard (check inside the act callback), covering BOTH the end and the GEN-013 create path; assert READ COMMITTED; reason → audit event.

## Owed ledger — additions
- ADR-013 **D5 refinement** (advisory-lock-with-check-in-callback preferred; SERIALIZABLE fallback) → fold at consolidation.
- **assert-the-isolation-level** principle → PID-PRINCIPLES.
(Everything else as STATE-2026-08-29b + the GEN-015 additions.)
