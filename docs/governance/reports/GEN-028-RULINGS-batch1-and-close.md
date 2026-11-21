# GEN-028 (W3 batch 1 — `committed` required) — rulings + close

Date: 2026-08-31
Report: rewrite/reports/GEN-028-step2-batch1.md — HARD STOP, nothing committed. Pin 1a8af560.
Contract 105/105 · integration 304/304 (+5) · battery 24/24 · boundaries PASS · validator PASS.

## Verdict: batch 1 MERGES and closes as GEN-028. Batches 2 and 3 are new PIDs. One owed item, sharp.

## R0 — Scope: confirmed. Batch 1 is GEN-028's Step 2; batches 2/3 take new numbers.
Your reading matches the batching ruling (each batch its own PID). GEN-028 = batch 1.

## R1 — Batch 1 APPROVED.
The delta was exactly the measured two sites; the two remaining acts return `PublishedUpdate`/`void`
and cannot refuse by value — luck named as structure. The trade is written **in the code**
(required kills forgetting, not being-wrong; `() => true` is an assertion the compiler cannot check),
and the heuristic default is recorded as considered-and-rejected so it is not re-proposed. The
standing oracle — one per refusing act, driven **through the route** because the defect lives in the
call-site's declaration — is the right shape, and `provisionOrganization`'s stated exception (its
route's idempotency layer answers first) is the right kind of exception: named, with its reason.
Aimed at the **older** callers and proven by mutation (303/1), restored byte-identically. Close.

## R2 — The new principle: APPROVED. `[regression-tests-the-older-callers]`.
Good name, and the distinguishing axes are the sharp part: vs `[specific-assertion-catches-decay]`
it is **subject chosen, not content chosen** (a perfectly specific assertion aimed only at new
callers still misses); vs `[prove-by-making-it-fail]` it is **watching the code that will break, not
merely able to fail at all**. Accepted; 59 principles. The other three items (fingerprint →
`[identity-by-self-declaration]`, mutation-realism → `[probe-must-bite]`, the
`[no-coincidental-collision]` clarifier) ride batch 1 correctly — its diff touches no surface.

## R3 — The manual-enumeration gap: OWED, and it is the recurring family, not a footnote.
Nothing derives "commands that can refuse by value" from the types, so the standing oracle set is a
**hand-maintained list a new refusing command can silently miss** — the same shape as the ADR header
field, the teardown opt-in, the boundary-scan blind spot: *a rule with a manually-kept membership
list is a suggestion at the boundary.* The durable fix is to **derive the set from the types** (a
command whose return type includes the refusal shape) and assert **enumerated-set == type-derived
set**, so a new refusing command with no oracle reds. Type machinery, possibly non-trivial; **owed,
not batch 1.** File it beside the boundary-scan blind spot — same class, and worth solving once for
both if the type approach generalises.

## R4 — The batch-2 question, answered: `NONE — no organization has ever been provisioned`.
Blunter than "none affected", and the reading is right: the guard defect is **unreachable today only
because the feature is unused**, and the first real provisioning makes it reachable. It stays a
**batch-3** fix. Consequence to hold: **all three batches must land before anything provisions for
real** — trivially true today (nothing provisions), but it is the reason the sequence is not
negotiable. Batch 2 need not re-run this check.

## Close instruction
Merge through the hook, no `--no-verify`; tag `[GEN-028]`. Rule 7 close → archive/ with row,
`status: merged`, `closed: <today, from `date`>`, artifacts carried (spec, step2-batch1 report + this
ruling). The archive note records that GEN-028 delivered **batch 1 only**, and names batches 2 and 3
as the remaining W3 sequence with the ordering reason (membership assertion-shaped before the guard;
never `removeMembership` before the guard).

## Next: batch 2 — `group_membership` assertion-shaped (new PID).
Before reapplying A′, establish what **this** constraint protects by measurement and its **own** stated
rationale (`ADR-013` C6) — `0112`'s staleness is a fact about `0112`, not a licence. `0118` is the
template. Then batch 3 (bootstrap + `addMembership` + the unified effective-administrator guard).

## Owed ledger — additions
- Derive-the-refusing-command-set-from-types (R3) — filed with the boundary-scan blind spot; same
  manually-kept-membership-list family.
