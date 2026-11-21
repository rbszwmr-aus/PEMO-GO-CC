# GEN-023 (WEB-15 / grant administration) — Step 1 rulings

Date: 2026-08-31
Report: rewrite/reports/GEN-023-step1.md — HARD STOP, no build. Pin bc0d924e.

## Summary: (5) ruled · (3) NOT ruled — I found a defect in my own leading candidate and need two facts first · the operation set is expanded (WEB-15 fails its purpose without it) · and ADR-015 contradicts shipped code, which is my error.

---

## R1 — Half A: carried correctly, and the discrimination test was the right instinct.

ADR-014 v1.0; ADR-015 v1.1 with D1's body replaced, an amendment banner naming what it replaced, and
the superseded wording kept bracketed and dated. 13 → 15 ADR / 6 amendment / 60 principle. And moving
`ADR-014-audit-act-reason.md` out to confirm it reds — proving the acceptance record does **not**
answer for the ADR proper — is GEN-017's glob hole re-tested against files new since. Exactly right.

## R2 — (5) The provisioning act: RULED. Adopt the `resident.party` shape.

`audit_event.principal_id`, `group_id`, `role` are all `NOT NULL`; a provisioning act has none of the
three — and the grant is what it creates. So the first grant cannot be audited today, and every
shortcut is the fabricated principal `ADR-010` `A1` forbids by name. Adopt the shape you proposed:

- **`source` NOT NULL** — what originated the act (`provisioning` / `staff` / `integration`).
- **Authority columns nullable** (`principal_id`, `group_id`, `role`).
- **One biconditional CHECK**: authority is present **iff** the source is authority-bearing. A staff
  act without its authority is refused; a provisioning act with a fabricated one is refused.

This makes honest absence **structural** rather than merely forbidden — `A1` enforced by the database
instead of by discipline. Existing rows backfill `source = 'staff'` (they all carry authority), so the
biconditional holds from the first migration. Note plainly: this changes the audit spine, and it
**strengthens** it — fabrication becomes impossible, not just against the rules.

## R3 — (3) `scope_grant` cannot express an end: NOT RULED YET. Here is why, including a defect in my own leading candidate.

Your finding is decisive and was proven, not argued: no `UPDATE` for `pemo_app`, and the append route
fails against a real seeded grant with
`conflicting key value violates exclusion constraint "scope_grant_no_overlapping_periods"`. The
`tstzrange` expresses a **period**, not supersession. And this is genuinely worse than occupancy:
`0022` gave only `period_ordered`, so `0117` could add versioning unopposed; `scope_grant` carries a
**gist exclusion over all rows**, so an assertion model has v1 and v2 of the same grant colliding with
the instance's own history — and that constraint is **declarative and bulk-load-proof**, which a
trigger is not, on the one table where bad history is least tolerable.

**My leading candidate was a separate append-only end-record** (grant row untouched; `end` in its own
table; effective period = grant period ∩ before-end). It keeps the exclusion intact and makes ending
an `INSERT`. **It is defective, and I found the defect before proposing it to you:** the exclusion
sees **asserted** rows, not effective ones. Grant A asserted `[t0, ∞)`, ended at `t1`; a legitimate
**re-grant** B for the same key at `[t2, ∞)`, `t2 > t1`, still **overlaps A's asserted period** and is
refused. The shape blocks re-granting after a revocation — unacceptable on this table. **Do not build
it.**

Every remaining shape turns on one question I do not have the answer to, and I will not guess it on
the authority table:

> **What invariant does `scope_grant_no_overlapping_periods` actually protect?**

If rights are a **union** and **monotonic** (`ADR-012`), then two overlapping identical grants add
nothing — which would make the exclusion a **hygiene** constraint (no duplicate grants), not a
**safety** one. If it is hygiene, a relaxed append-compatible constraint is affordable and the
assertion model can proceed. If some reader or invariant genuinely depends on at-most-one-grant-per-
key-per-instant, it is safety and must be preserved, and the end shape must bend around it instead.

**Step 1b, read-only, before I rule:**
1. **`0112`'s own stated rationale** for the exclusion — what it protects, and why an exclusion rather
   than a unique constraint or a trigger. Quote it.
2. **Does any reader depend on at-most-one grant per key per instant?** `findAuthorizingGrant`,
   `resolveAsAt`, the narrowest-grant tie-break, anything that assumes a single row. Evidence.
3. Given (1) and (2), **re-propose the shapes** — including whether a relaxed constraint keeps enough,
   and what a re-grant after an end must look like under each.

## R4 — ADR-015 contradicts `platform.idempotency_record`, shipped since migration 0004. **That is my error.**

I authored a decision about a mechanism without checking whether one already existed — the same
read-the-artifact discipline I have been demanding of you, failed by me. Reporting it rather than
building over it was right.

**Step 1b also reports:** what `platform.idempotency_record` is (shape, key, what it stores), **who
uses it**, and whether it actually works today. I then rule the reconciliation — amend ADR-015 to the
shipped shape, migrate the shipped shape to the ADR, or a considered hybrid. **No write is built
against ADR-015 until that is settled.**

## R5 — The operation set MUST include `createGroup` and `addMembership`. Ruled.

You were right not to assume them in, and right that it matters: a grant is held by a **group**, so
without them WEB-15 can re-scope existing groups but **cannot onboard a new staff member — the DBA
stays**, which is the exact blocker this phase was chosen to remove. A WEB-15 that does not remove the
DBA has not delivered. So the set includes group creation and membership.

Note the consequence, to be handled with the same care as grant creation: **adding a member to a group
confers everything that group holds** — `addMembership` is itself an authority-creating act and needs
`G-2`-grade reasoning, not a lighter touch.

## R6 — Smaller items, ruled or noted.
- **`D4` done** — `role` is in the exclusion key, verified from the live catalog. The caveat (no
  production database seen) is correct and stands; retire the owed item for the development schema.
- **`G-2` needs no new mechanism** — `findAuthorizingGrant` with two substitutions. Good: the gate on
  the authority system reuses the gate the authority system already provides.
- **`grant_administrator` authorizes nothing today** — four declarations, zero readers, zero rows. W2
  gives it its first real authority; note it as inert until then.
- **Nesting unforeclosed**, confirmed against the catalog.
- **`reason_code` needs a migration** (ADR-014) — expected; it rides the schema precursor.

## The shape of the phase, as it now stands
- **Step 1b** (read-only): the exclusion's rationale + reader dependence + the `idempotency_record`
  assessment. → I rule (3) and the ADR-015 reconciliation.
- **W1** — schema precursor: the `audit_event` provisioning shape (R2), `reason_code` (ADR-014), and
  whatever (3) resolves to. Migrations + readers, no endpoints.
- **W2** — the grant write surface: create, end, with `G-2`, the provisioning act, reason codes, and
  an ADR-015 stance.
- **W3** — group + membership, so onboarding actually works without a DBA.

## Owed ledger — additions
- ADR-015 ⟷ `platform.idempotency_record` reconciliation (mine to rule, after Step 1b).
- An `ADR-013` corollary will be needed once (3) resolves — the general rule for *a fact whose table
  carries a declarative constraint that versioning would break*.
