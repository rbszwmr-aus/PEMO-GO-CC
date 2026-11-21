# GEN-023 (WEB-15) — Step 1b rulings: (3) and (4) both settled

Date: 2026-08-31
Report: rewrite/reports/GEN-023-step1b.md — read-only, HARD STOP. Probe rows removed, schema experiments rolled back.

## Both open questions are now decidable, and both resolve against the incumbent.

---

## R1 — (3) RULED: adopt **A′**. Drop the exclusion; assertion model on `scope_grant`; write-path guard; battery detector.

Four things decide it, and each was **measured or quoted**, not argued:

1. **The stated rationale is stale in a way that voids it.** `0112` justifies the constraint by *"one
   principal cannot hold the same node over two overlapping periods"* — but `0115` re-keyed it to
   `(group, role, node)` and re-added it **with no restated rationale**. The only justification in the
   repository describes a **`principal_id` column that no longer exists**. A rationale that describes
   a vanished column does not justify the present constraint.
2. **The invariant it claims is already false, by design.** `ADR-012` `D5` makes a principal's rights
   the **union** over groups, and you measured it: a second group granting the same role at the same
   node, fully overlapping, was **accepted**, and the reader returned **two `approver` grants at one
   node at one instant**. `findAuthorizingGrant`'s `grantId` tie-break exists *because multiplicity is
   expected*.
3. **No reader depends on at-most-one.** `admits()` short-circuits on first match; `admitsUnassigned()`
   is `length > 0`; both monotonic. So: **hygiene, not safety.**
4. **The bulk-load argument does not survive testing.** You tested what it actually stops: a live
   `grant_administrator` grant at an arbitrary node of a **non-existent organization** — accepted. *It
   has never stood between a bulk load and unauthorized access; it stands between a bulk load and
   ambiguous history.*

And no declarative alternative survives — every candidate needs *"is latest"* as a **stored** predicate,
i.e. a flag something must flip, i.e. the `UPDATE` that `ADR-013` `D2` abolished. You recorded that as
a **failed search, not a proof**; I accept it as sufficient basis to move, and it is the right
epistemics.

**Therefore: A′.** Assertion model on `scope_grant`; the exclusion **dropped**; cardinality held in
the **write path** (`ADR-013` `D5`/C3 — the per-key advisory lock, check inside the act callback); and
a **battery detector** for two live assertions sharing `(group, role, node)`.

**Name the trade plainly, in the migration and the report:** we exchange *write-time prevention of
ambiguous history* for *write-path prevention plus whole-table detection* — and we buy, with it, **the
ability to revoke authority at all**, which the incumbent constraint costs us. Revocation is not
negotiable; ambiguous history is recoverable and now detectable. Re-grant after an end is a new
`grant_id` at version 1 — free, and it is the case that killed every other shape.

**The detector must bite** (`[probe-must-bite]`): create two live assertions sharing a key, prove it
reds, remove the state, prove it greens. It is not decoration.

**Correct the stale record while you are there:** the new migration carries a **stated rationale** for
what replaces the exclusion (do not repeat `0115`'s omission), and the test at
`access-scope-model.test.ts:298` — which repeats the stale claim — is rewritten to assert what is
actually true, or removed.

### ADR-013 corollary this establishes (C6)
> Where a declarative constraint on a fact table would block the assertion model: **establish what the
> constraint actually protects — by measurement and by its own stated rationale — before trading it
> away.** If it protects **legibility** (hygiene), it may be replaced by write-path prevention plus
> whole-table detection. If it protects **safety**, the change bends around it instead. **A rationale
> that describes a column or key that no longer exists does not justify the present constraint.**

## R2 — (4) RULED: **ADR-015 stands. `platform.idempotency_record` is REPLACED, not reconciled.**

There is nothing to preserve:
- It is **used by nobody** — constructed in `wiring.ts`, zero references in `server.ts`, no test,
  despite the test file's own opening line claiming otherwise.
- It **does not work**: concurrently, `compute` ran **twice** — `once()` checks, computes, then inserts
  `ON CONFLICT DO NOTHING`, so two callers both find nothing and both perform the act. **One response,
  two effects, and the loser's act unrecorded and unreturned** — invisible, which is the worst
  outcome.
- A second window: `compute()` and the `INSERT` are in **different transactions**, so a crash between
  them re-runs the act — precisely what `ADR-015` `D2` exists to close.
- It contradicts `D3` (keyed `(scope, key)`, no principal) and `D4` (stores the response blob).

Replace it with the ADR-015 shape: `(principal, operation, key)`; store the **act's identity**, never a
response blob; written **in the same transaction as act + audit** by the audited-write primitive —
which closes both windows at once. Its being unused makes the cost near zero, and you are right that it
will not stay that way.

**My error stands.** I authored a decision about a mechanism without checking whether one existed. The
ADR turning out right does not retire the lesson — I got lucky. Check the repository before deciding
about a mechanism.

## R3 — Sub-finding: `findGrantsAsAt`'s `SELECT DISTINCT` is a defence that does not defend.

`grant_id` is in the select list and is the primary key, so it collapses nothing — the comment claims a
protection the code does not provide. Fix it or remove it, but the **comment must stop claiming what
the code does not do**. Same class as `verify-boundaries`' PASS-string. Rides W1a.

## The phase, now settled

- **W1a** — the authority table: `scope_grant` assertion model, exclusion dropped with a stated
  rationale, write-path cardinality guard, battery detector that bites, the stale test corrected, the
  `SELECT DISTINCT` fixed. *Failure mode: authority reads break, or ambiguous history slips in.*
- **W1b + W1c** — the platform spine, **one PID, two independent oracles**: the `audit_event`
  provisioning shape (`source` NOT NULL + nullable authority + one biconditional) with `reason_code`
  (ADR-014); **and** the idempotency replacement (ADR-015 shape). They do not interact — different
  tables, different concerns — but **each carries its own oracle, and a finding in one must not ride
  silently on the other.**
- **W2** — the grant write surface: create, end, `G-2`, the provisioning act, reason codes, an
  ADR-015 stance.
- **W3** — group + membership, so onboarding works without a DBA.

All three precursors precede W2. **W1a first** — it is the crux, and nothing else depends on it.

## Owed ledger — additions
- ADR-013 **C6** (above) → fold at the next ADR-touching change.
- The stale-rationale lesson generalises: **a re-keyed constraint must restate its rationale** — worth
  a principle when we next touch `PID-PRINCIPLES.md`.
