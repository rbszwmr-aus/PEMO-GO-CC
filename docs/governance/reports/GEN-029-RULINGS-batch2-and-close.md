# GEN-029 (W3 batch 2 — group_membership assertion-shaped) — rulings + close

Date: 2026-09-01
Report: rewrite/reports/GEN-029-step2.md — HARD STOP, nothing committed. Pin 81453a13.
Contract 105/105 · integration 314/314 (+10) · battery 25/25 · boundaries PASS · validator PASS, on a database rebuilt from nothing (40 migrations).

## Verdict: batch 2 MERGES and closes as GEN-029. Two findings generalise, one near-miss is a principle. Batch 3 is next (a new PID, Step 1 first — it is the authority-creating surface).

## R1 — Batch 2 APPROVED.
The dedup is restored in-diff with a **live oracle** — `scope.grants IS A SET` asserts distinct-count
== row-count and **removing the DISTINCT reds it (313/1)** — not a comment, and the comment states
**why now** so it cannot be deleted a second time on the vanished premise. `0123` records that `0115`'s
rationale was accurate where `0112`'s was stale (so the next reader inherits the right lesson) and
names the table-specific property (membership is a join multiplier). All three mutations bite; the race
uses distinct membership ids so the act cannot serialise on its own PK. This is the standard. Close.

## R2 — The fourth site: the seed-rekey expectation was under-scoped, mine included.
You re-keyed the seed up front — and `ON CONFLICT (membership_id)` **also lived in a test fixture**,
which the battery cannot catch because it is not the seed; the suite caught it as 30 failures. Your
generalisation is right and corrects my own framing: I have said "the Nth table's seed" three times,
but the real rule is **when a table becomes assertion-shaped, EVERY `ON CONFLICT (<instance_id>)`
re-keys — seeds AND fixtures AND anywhere else — grep both.** The three remaining state-change tables
(`building_service_availability`, `installed_services_note`, quarantine) will each meet this; the PID
that does them must carry the wider grep, not the narrower "seed" wording. **Owed:** consider whether
the battery can be taught to flag a bare-instance-id `ON CONFLICT` in fixtures too — a check beats a
memory; note it beside the derive-from-types item.

## R3 — The near-miss is a real principle, routed to batch 3's pass.
The scratchpad wipe made a mutation backup silently fail, and **`git checkout` would have reset the
file to HEAD and destroyed the batch's uncommitted work.** Reversing the mutation textually, verifying
`markers left: 0`, and moving to **verify-the-backup-exists-before-mutating** (not after) is the right
recovery and the right lesson. Two edges, both worth codifying:
- **Never reverse a probe/mutation with `git checkout` (or any HEAD reset) while uncommitted work is
  present** — it discards the work, not just the mutation.
- **A backup verified only after the mutation is a backup that may already have failed** — verify it
  exists *before* mutating.
Add in batch 3's principles pass (check-before-adding: read `[all-preconditions-before-mutation]` and
`[diff-against-clean-baseline]` first; if neither owns it, add it and report the id).

## R4 — `[premise-maintained-elsewhere]`: APPROVED. 60 principles.
Good name and the distinction is exact: `[redundant-check-is-a-witness]` asks what a check silently
guards; here the check is removed **for a good reason** and the subject is the **dependant**. The
actionable half — *grep the reasoning, not just the references* — is the part that would have caught
the GEN-024 coupling earlier. Accepted.

## R5 — Out-of-scope `index.ts`/`wiring.ts`: accepted (module unreachable, proofs cannot run without
them; disclosed, as GEN-025's server.ts touches were). `add` authorized by nothing, stated in the file
header — good; that is exactly what batch 3 changes.

## Close instruction (this box ALONE — I will not bundle the next box)
Merge through the hook, no `--no-verify`; tag `[GEN-029]`. Rule 7 close → archive/ with row,
`status: merged`, `closed: <today, from `date`>`, artifacts carried (spec, step1-c6 report + ruling,
step2 report + this ruling). Report the final main hash + closed count, then STOP.

## Batch 3 — Step 1 (to dispatch after GEN-029's close, against the new pin)
The authority-creating surface: bootstrap + `addMembership` + `removeMembership` + the unified guard.
Step 1 (propose, HARD STOP) confirms against the now-landed membership assertion model:
1. **Bootstrap as ONE atomic act** (group + grant + first membership), admissible IFF the organization
   has held **zero grants ever**; the only place a group is created without a `G-2` gate, safe only
   because once-only — stated in code and contract.
2. **`addMembership`**: for EVERY live grant the group holds, the actor satisfies `G-2`; refusal on ANY
   unreachable grant, never a subset; PLUS the floor (actor holds `grant_administrator` somewhere in
   the org). Evaluated inside the act's transaction.
3. **The unified guard REPLACES the shipped one**: ONE predicate over **effective** administrators
   (grant ∧ membership), covering BOTH routes — `revoke` and `removeMembership` — so there is nothing
   to keep in step. The shipped guard counts administrators that do not exist; this is a replacement,
   not an extension.
4. **`removeMembership`** never ships before the guard (the door-and-window ruling).
5. Confirm the **split**: if too large, bootstrap out first — never membership without the guard.
6. Optional: `confer`/`addMembership` response states the group's member count.
Plus the batch-3 principles pass: R3's near-miss principle, and any carried worked notes.

## Owed ledger — additions
- The wider `ON CONFLICT (<instance_id>)` grep (seeds AND fixtures) for the remaining state-change
  tables (R2); consider a battery check for it.
- R3's mutation-recovery principle (added in batch 3).
