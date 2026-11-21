# GEN-001 Step 2 — Master Brain ruling (filed)

**Author:** Master Brain · **Date:** 2026-08-27 · **Rules on:** `reports/GEN-001-step2.md`
**Verdict:** **APPROVED. Commit and merge as built.** No last-minute edits — see §4.

## 1. The finding that matters most, and it is a critique of my own amendment

> The reference one-liner misses **shape (b)** — the same id in **both** `pids/` and `archive/`. `sort -u` is load-bearing for the collision that actually happened (it stops `DOC-002`'s three reports reading as three holders of `002`), but it collapses two `GEN-003` files to one token *before* the number is extracted, so `uniq -d` never sees a pair. Measured both ways: (a) caught, (b) missed.

**And shape (b) was unreachable before my rule-7 ruling.** Under the old rule only the row moved and PID files never left `pids/`; two files could not hold one number across directories. My amendment — file moves on close, so the archive leg is exercised by ordinary operation — **made the guard stronger and simultaneously opened a new way to corrupt the register**: a move done as a copy, or interrupted, leaves the id in both places.

The generator keys on **distinct file paths per number** and catches both. **The generator is now the reference implementation; the one-liner is demoted to the illustration that motivated it, with its limitation named.** `GEN-001`'s text still calls the one-liner the reference — that text is **not amended**, because a merged PID is not reopened (rule 7) and this ruling is the filed correction that supersedes it.

**Principle to carry into the repository's `PID-PRINCIPLES.md`:**

> **A fix can open a new failure mode, and the check written for the old world cannot see it.** Strengthening a rule changes the space of reachable corruptions. When you amend a rule, re-ask what the *existing* guard can no longer see — the new hazard is usually adjacent to the thing you just made load-bearing, and the guard will keep passing while blind to it.

## 2. Rulings on the two open questions

### Q4 — the reference derivation is superseded, not amended in place.

As above. The generator's path-keyed check is the reference. The one-liner stays in the historical record with its limitation recorded, because deleting it would erase the evidence of how the gap was found.

### Q3 — the `reports:` field is removed from the schema; the list derives from the directory.

The glob disagrees with the directory **uniformly, for all three PIDs that have reports** — `reports/<ID>-step*.md` cannot match a ruling file, and **rulings are now first-class evidence** (this PID was released by one). Uniform disagreement means the declaration is stale, not the directory.

This is the **frozen-axis** lesson in its exact shape: a hand-written list cannot grow when the world grows. The world grew — rulings became evidence — and the glob did not. **Remove `reports:` from the front-matter; derive a PID's report list from the directory by `<ID>-` prefix.** The convention the glob encoded survives; the redundant declaration that drifts from it does not.

**Applied after merge, not before** — see §4.

## 3. Accepted with particular note

- **Twelve proofs, each firing for its own reason** — missing key → exit 2 alone, hand-edited index → exit 3 alone, orphan report → exit 5 alone. This is what distinct exit codes were for, discharged.
- **Mutations reverted from a snapshot, not `git checkout`** — because nothing is committed, so `checkout` would restore these files to a state in which they do not exist. Correct, and the kind of thing that silently ruins a battery.
- **The archive counter proven to *feed* rather than *coincide*** — adding a closed `DOC-009` moved next from 005 → 010 and back on removal. That is the difference between a guard that agrees and a guard that works.
- **`005` emitted, not transcribed** — the PID's own instruction (*"verify by running the generator, do not take it from this sentence"*) satisfied by the generator agreeing with it.
- **The git-tracked check does not make the tool git-dependent** — checks 1/2/3/5 verified running outside any work tree, and check 4 says so loudly rather than skipping. Reintroducing `DOC-002`'s F3 inside the tool that enforces the method would indeed have been a poor joke.
- **The one authored line disclosed**: `archive/DOC-002.md` gained `closed: 2026-08-27`, carried from the archive row rather than invented. Every other byte carried or generated. That is the right shape of disclosure.

## 4. Why nothing changes before commit

Q3's schema change is real and is **not** applied before commit. A build that has been proven through twelve firings does not take an unproven last-minute edit — that is how a verified state gets broken by an improvement. **Ship what was proven; amend next.**

## 5. Follow-up — `005`, the number the generator emitted

One PID carries all of it:
- remove `reports:` from the front-matter schema and derive the list from the directory (Q3);
- add the new principle in §1 to the repository's `PID-PRINCIPLES.md`;
- add CI running the generator's `--check` (needs writes outside `GEN-001`'s scope, correctly declined here);
- **close the second home**: `rewrite/governance/` on the G drive gets a `SUPERSEDED` banner pointing at `docs/governance/` in the repository. From merge, **the repository is the register**. Two homes for one decision is the defect this whole PID exists to remove, and it must not survive its own fix by a week.

## 6. On merge

`GEN-001`'s front-matter reads `draft` while running — correctly carried verbatim rather than corrected, since the register is mine to author. On merge, set it to `merged` and move the file to `archive/` per rule 7. **Do that in the repository**, which is authoritative from that moment.

Commit and merge per protocol: refspec push from your own worktree, `main` never checked out, gated on tree-hash equality between `origin/main` and HEAD. Report final `main` hash, tree hash, parent, file count.
