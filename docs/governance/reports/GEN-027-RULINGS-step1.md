# GEN-027 (W2 — grant write surface) — Step 1 rulings

Date: 2026-08-31
Report: rewrite/reports/GEN-027-step1.md — read-only, HARD STOP. origin/main 0310b978 (GEN-025); W1d built but unmerged.

## My predicate was wrong, and the way it was wrong is a break-glass. Corrected below.

---

## R0 — Sequencing: GEN-026's close ruling exists; execute it first.

It was issued last turn (`GEN-026-RULINGS-W1d-and-close.md`) and evidently did not reach you. You are
right that Step 2 must not build on an unmerged base — that is what the GEN-023 two-commit split
existed to prevent. **GEN-026 closes first; W2 Step 2 pins to the resulting `main`.**

My process correction: **when the next PID's pin depends on a close, I will not send the close box and
the next box in one message.** The bundling created the ambiguity.

## R1 — (a) act-id stability: APPROVED, and your extension is better than my expectation.

Making **the act's own primary key the derived id** (`grant_id` = `gr_` + digest of `(operation, key)`)
buys a second line of defence for free: even with the idempotency record missing, a retry **collides on
the act's own primary key**. D5 moving to a `request_fingerprint` column is correct — once the id is
derived, the id can no longer distinguish two different requests under one key. Honest retry →
replayed; same key, different request → refused. Approved.

Two additions, both from trades you named or that follow:
1. **The digest must be pure** — no salt, no clock, no environment. Prove it: compute the id **in a
   fresh process** and get the same value. Otherwise "stable across retries" fails exactly when a
   retry crosses a restart, which is when it is most needed.
2. **`revoke`'s stability is a different path, and must be proven separately.** `revoke` appends
   `version + 1` to an **existing** `grant_id`, so its act identity is `(grant_id, version)` and the
   version is **derived from current state** — a naive recomputation after a successful first attempt
   would produce `version + 2`. Its stability therefore rests **entirely on the key check preceding
   the act**. Prove it: a retry of `revoke` after a **successful** first attempt **replays** and does
   **not** append a second version.

## R2 — (b) The predicate: I was WRONG IN TENSE. It is **zero grants EVER**.

You measured rather than reasoned — `org_wingfu_holdings | grants EVER: 7 | LIVE now: 6` — and the two
candidates already disagree on the shipped seed. Under my "currently holds zero grants" reading, **an
organization that revokes its last grant becomes provisionable again by anyone**: the standing
break-glass `A1` forbids, reached through an ordinary revocation. That is a security hole and it was
mine. **Corrected: the provisioning grant is admissible iff the organization has held ZERO grants
EVER.** Expressible inside `access` alone — good.

### The blocker: there is no Organization-creation act. Your recommendation is accepted.

`A1` says the first grant is created "as part of that act" and `ADR-015` `D1` names "the
Organization-creation provisioning event" — **neither exists**; organizations arrive only through a
seed. Refusing to invent one was right.

**Accepted: the derived key is the `organizationId` itself.** The organization's *existence* is the
originating fact, and combined with the zero-ever predicate the operation is **doubly once-only**.
Record this as a reading of `ADR-015` `D1` in the contract: *the originating fact is the
organization's existence; if an actual creation act is built later it may supply a richer key without
changing this operation's stance.*

### Provisioning is mandatory in W2, and the test creates a fresh organization.

`grant_administrator` grants in the database = **0**, so `confer` is unreachable until provisioning
runs — **provisioning is not an optional extra; it is what makes the rest reachable.** Seeded orgs
already hold grants and can never be provisioned, so the test **creates a fresh organization**. And
**do not seed an administrator**: seeding one bypasses the very path being built. Your lean is right.

### The permanent lockout: ADD A LAST-ADMINISTRATOR GUARD. Ruled.

You were right to flag it and right not to fold it in. An organization that revokes its last
`grant_administrator` is unadministrable **forever** — a sharp edge that one mistaken revoke reaches.

**Refusing to revoke the last way in is not a break-glass**; it creates no path to grant oneself
authority, it only prevents removing the last existing one. So it does not weaken `A1` at all, and it
removes a foot-gun that would otherwise be permanent.

- Mechanism: a **computed-current cardinality** invariant — the one we already have
  (`ADR-013` `D5`/C3: per-key advisory lock, the check **inside the act callback**).
- Scope: the lockout that is unrecoverable is at the **organization** node — an estate with no local
  administrator can still be administered from above (G-2 permits conferring within a node you hold,
  and an org-level holder holds the estate below it). **Confirm the hierarchy detail** (whether
  anything sits above the organization) and state the scope you implement.
- Prove: revoking the **last live** organization-level `grant_administrator` → refused; revoking a
  **non-last** one → allowed; and prove it **does not over-reach** — a revocation elsewhere in the
  tree is unaffected.

## R3 — (c) Contracts: approved, and the `200`-not-`201` detail is exactly right.

Four-code vocabularies with no `other`, both mutating operations requiring a reason as ruled, and
`role_change` shared across both because it means the same thing — the registry rule's *shared iff
identical*, correctly applied at its first real use.

**A replay answers `200`, not `201`.** That is the honest expression of `D4`: a replay is not a
creation, and the status code must say which one happened. State it in the contract.

## R4 — (d) `G-2`: confirmed, and write the non-leak down.

Two substitutions plus a role filter, and — importantly — **evaluated inside the act's transaction**,
so a concurrent revocation of the actor's own authority cannot race the check. That is the
check-inside-the-callback discipline applied to authorization itself.

**Write this into the contract rather than leaving it to be discovered:** *a `grant_administrator`
may confer `grant_administrator` at or below a node they hold — that is `D3` working, not a leak.*
Stated, it cannot later be "fixed" by someone who reads it as an escalation.

## Step 2 authorised (after GEN-026 closes)
Build the three operations with everything above; the two `PID-PRINCIPLES` worked notes ride along.
**This surface creates authority — anything needing an assumption is a stop-and-ask.**

## Owed ledger — additions
- `ADR-015` `D1` reading (organization existence as the originating fact) — fold at the next
  ADR-touching change.
- If an Organization-creation act is ever built, revisit the provisioning key (it may supply a richer
  one) — the zero-ever predicate stands regardless.
