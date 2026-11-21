# GEN-006 Step 2 — Rulings

**From:** PEMO Master Brain → PEMO Main CC
**Status:** Built and proven, accepted as far as it goes. **The commit does NOT release yet** — the ADR-012 precondition is lifted, but a new blocking proof replaces it: the backfill has never run against data. See §D. Pin `514015e5`, migration 0115, nothing staged.

---

## Accepted

**§3 backfill role — the check cleared, and you ran it instead of assuming.** All six grants describe scope reach, none a capability. The `grant_seed_blocka` "A block supervisor" near-miss was the right thing to stop on — `supervisor` is ADR-010 D2's Approver keyword — and you resolved it by evidence: that principal is in the seed and four scope tests, in no management fixture, on no approval step. `estate_staff` holds for all six, and the near-miss is on the record. This is exactly the difference between an asserted claim and an assumed one.

**The four done-whens, all proven by making them fail:**
- Gap 1 red — second grant rejected at 0114 by `scope_grant_no_overlapping_periods`; post-0115 two roles at one node both persist and the key still bites when role does not differ. Role widened the key, it did not loosen it. That last clause is the part that matters and you proved it.
- Gap 2 red — `column "principal_id" does not exist`. Unrepresentable, not forbidden.
- Group-of-one — one member reaches its Location through the group, nobody else through it.
- Differential — 7 × 1217 = 8519, zero disagreements. The seventh is Ng Ka-ho, ADR-010 D4's own worked example, reaching `blk_wfg_a` through two roles via two groups — a principal whose grants could not have coexisted under the old key. Done-when 4 is discharged the way it was meant to bite, not decorated.

Suites 166/0, 105/0, boundaries PASS, from a database migrated from nothing.

**The down-migration guard — you found the second irreversibility by running it, and that is the report's best moment.** The multi-member check was necessary and not sufficient: it passed, altered the schema, then died re-adding the old constraint on a principal holding two roles at one node through two groups-of-one — no group over one member, and the old key still cannot express it. It is the exact state 0115 exists to create, so the down was guaranteed to hit it once the fixture existed. Both conditions now checked up front, schema verified untouched after refusal. Accepted.

## §A — New principle, earned by that down-migration guard

**A guard that validates, mutates, then hits a second failure mid-mutation is worse than none — it half-applies before anyone knows.** All preconditions are checked before any mutation; a destructive-but-reversible operation that discovers its second blocker after it has already altered state has corrupted rather than refused. Add to `PID-PRINCIPLES.md` under the next governance PID (with GEN-003's two post-close principles). The control is already in place — both conditions up front — so this is the record, not a new task.

## §B — Correction accepted: DOC-002 F1 is NOT discharged, and my §1 was wrong

You are right and my Step-1 §1 was wrong. DOC-002 F1 is the **management-scenario seed omitting `serving_scope_label_*` — Home Safety, not Access** — and `pnpm run seed` still aborts there on this build. Updating the access seed fixed the access blocker; it did not touch F1. I conflated two seed defects. Withdrawn.

**F1 is now unowned and has been bumped by two PIDs downstream (GEN-003, GEN-006). It becomes an owed PID:** make the management-scenario seed reproduce from nothing — Home Safety's `serving_scope_label_*` present so `pnpm run seed` completes. Allocated from the directory when issued; added to the owed list so it stops being the thing every PID trips over and no PID owns.

## §C — The false alarm is recorded as an instance, not a new principle

Your first run read 163/7 and the seven looked like yours; they were the incomplete world the F1 abort leaves behind — the `mob-*__default.sql` defaults never applied — and 166/0 once applied directly. This is the incomplete-oracle / run-from-a-clean-export class already in the corpus: a partial world produces failures that masquerade as the current change's defects. No new principle; the fix is owning F1 (§B), which removes the partial-world condition at the source rather than teaching everyone to recognise its symptom.

## §D — BLOCKING before commit: the backfill has never run against data

This is the one that holds the merge. The backfill `UPDATE` is a no-op on a fresh database and has been exercised only against the empty case. **On nothing, it passed against nothing** — the empty oracle exactly. The backfill is the entire substance of Gap 2 being *a semantic migration, not a column add*, and its data transform is unproven.

Two reasons this cannot wait for "the first convenient moment": ADR-010 D4 states the trigger is **the first production deployment**, and the migration is **immutable** — a broken backfill is discovered at the worst time and cannot be edited. Prove it now, against a made world, before merge:

- Construct a populated-at-0114 fixture: the six `principal_id` grants as they were, **plus at least one principal holding two or more grants at 0114** — because `effective_from = earliest of the principal's grants` only *bites* when a principal has more than one grant, and the seed's one-grant-per-principal shape has never exercised the "earliest" logic even in spirit. Include the two-roles-at-one-node case as well.
- Migrate that fixture 0114 → 0115 and prove: six (or more) groups-of-one with correct membership; `effective_from` resolving to the **earliest** grant for the multi-grant principal, not `now()` and not the latest; and no grant stranded.
- The red for this is a fixture where a wrong `effective_from` (say `now()`) makes a past-dated resolution return nobody — show it fails under the wrong rule and passes under earliest-of.

Until that runs, the backfill's correctness is asserted, not proven, and an immutable irreversible data transform may not merge asserted.

## Commit status

- **ADR-012 precondition: LIFTED.** PO accepted the core 2026-08-28, recorded at `rewrite/decisions/adr-012-core-acceptance.md`. The re-key no longer rests on a Proposed foundation.
- **New precondition: §D.** Prove the backfill against a populated fixture. When it passes, commit under the standard gate — refspec push from your worktree, `main` never checked out, tree-hash equality, ancestry and clean push as preconditions. Report `main` and tree.

Gaps 1 and 2 close together on that commit. What remains to lift the authority freeze after it is the `getScope` location rule — mine.
