# GEN-030 (W3 batch 3a — membership + unified guard) — Step 2 rulings

Date: 2026-09-01
Report: rewrite/reports/GEN-030-step2-batch3a.md — HARD STOP, nothing committed. Pin 797167d3.
Contract 105/105 · integration 323/323 (+9) · battery 25/25 · boundaries PASS · validator PASS.

## Verdict: approved in substance, but 3a does NOT close yet. The cross-route race (which you proposed the fix for at Step 1 and I failed to rule) must land first — a guard a concurrent pair can defeat is not a guard.

---

## R1 — The org-scoped lock must land in 3a. This is my miss, not a new requirement.

Your Step 1 named it and I did not rule it. The gap is real and it is exactly the guard's own subject:
`revoke` locks `(group, role, node)`, `removeMembership` locks `(group, principal)`, so two concurrent
acts each removing **a different one of the last two witnesses take different locks, never serialise,
and each evaluates the guard against a state without the other's effect** — both pass, both commit,
zero effective administrators. The witness-returning guard is correct **per request**; this is the
same class as GEN-016's occupancy race one door over, and we have never merged an authority guard that
a concurrent pair defeats.

**Ruling: both routes take a shared ORG-scoped advisory lock around the last-administrator check**
(`pg_advisory_xact_lock(hash(org_id))`), in addition to their existing per-key locks (which still
serve supersession/cardinality). The org lock is what makes "no live effective administrator in the
organization" an invariant rather than a per-request opinion. **Prove the cross-route race:** two
concurrent removals of the last two distinct witnesses — **one via `revoke`, one via
`removeMembership`** — end with **one refused**; remove the org lock → both commit → the test reds
(the probe must actually overlap, per `[probe-must-bite]` — hold the transaction open). Then close.

Everything else in 3a is right and stays: the witness carries grant **and** membership so both routes
ask one question of one query; `liveAdministrators` is **gone, not deprecated**; the old predicate is
an inline permanent test (`grants-only 1`, `effective 0`); all three mutations bite; and backups were
verified **before** mutating with `cmp` after — R5's discipline, applied.

## R2 — The `_`-is-a-LIKE-wildcard finding: `[anchor-the-discriminator]` in SQL. Blessed; the sweep is owed.

`LIKE 'grp_w3_%'` matched `grp_w3g_admins` because `_` matched the `g` — batch 2's teardown silently
reached into 3a's world, the FK caught it, and every prefix teardown in that file is now `… ESCAPE`.
This is the anchor-the-discriminator lesson in a new instrument: **a pattern that matches more than it
appears to.** Not sweeping the other suites and saying so is correct — *it deserves a check, not a
memory.* **Owed:** sweep every suite for an unescaped `_`/`%` in a `LIKE` prefix, and add it to the
battery so a new one reds — file it with the other manually-kept-list items (derive-from-types, the
fixtures `ON CONFLICT` grep, `with-mutation.sh`); they are one cluster now — *a rule whose membership
is grepped by hand is a suggestion.*

## R3 — The three-not-two witness expectation: your error, not the code's, and the right shape.
The witness is per **(principal × grant)**, so the count is not the number of people — the test now
asserts more than one *person*, which is the property the guard actually needs. Correcting your own
expectation rather than the code is the standard.

## R4 — The routes gap: acknowledged, and W3's honesty depends on saying it.
`addMembership`/`removeMembership` are module commands with **no routes** — the authority logic is
proven but **not reachable by a client**, so W3 has still not removed the DBA in practice. Routes are
wiring, not the hard part, and they do **not** depend on the identity ruling — but they must land.
**Ruling:** routes ride the same PID as the membership surface's completion (with 3b, or a small 3c if
3b stalls on identity); do not fold them into 3a, which stays the proven guard+commands. The W3
close-out note must state plainly: **the DBA is gone only once routes and bootstrap both land.**

## R5 — The principles pass: correctly closed at Step 1 (no new principle; build `with-mutation.sh`).
Nothing to add. `with-mutation.sh` stays owed, in the manually-kept-list cluster above.

## §1 identity — still OPEN; 3b is blocked on it.
The PO has not yet chosen where the first `staff_principal` enters (external-authenticated / operator
seed / PEMO-owned). It blocks **3b only**; 3a proceeds. I re-raise it when 3a closes, or the PO may
answer any time — no rush, and the answer wants its own ADR.

## Dispatch: add the org lock to 3a, prove the cross-route race, then close. 3b and routes wait on §1 / the split.
