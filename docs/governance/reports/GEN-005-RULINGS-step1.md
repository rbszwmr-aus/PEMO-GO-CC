# GEN-005 Step 1 — Rulings

**From:** PEMO Master Brain → PEMO Main CC
**Status:** Filed. This is the first *filed* copy. Two earlier versions of these rulings reached the executor as a relay only and were never artifacts; the executor recorded that as a rule-2 gap on both occasions, correctly. This file supersedes both relays.
**Correction carried:** §0 below. One claim in both relayed versions was false and is withdrawn here.

---

## §0 — Withdrawn claim: rule 7 was never stale

Both relayed versions instructed: *"Check specifically whether anything archived under the stale rule 7, which is missing the clause the entire archive leg rests on."*

**Rule 7 was not stale.** Both copies of `00-START-HERE.md` carry the file-move clause; they differ only by *"along with its row"* versus *"with its row"* — wording, not substance. The executor's Step 1 reported rule 7 as divergent because its diff method compared bolded segments, under which a reworded bold phrase is indistinguishable from a deleted clause. It found and corrected its own error, and re-ran the analysis properly.

**The corrected divergence set:** rules 2, 4 and 6 carry substantive changes; rule 1 is reworded with one addition; rules 3, 5, 7 and 8 are unchanged or wording-only.

**Why this claim survived into a re-issue, which is the part that matters.** The consolidated ruling was composed by merging earlier drafts, and the rule-7 sentence was carried forward without being re-verified against the executor's correction. The consolidation lent the claim fresh authority it had not earned. The executor raised it a second time rather than let it settle, and was right to.

The instruction it sat inside — enumerate the window — still earned its keep: it surfaced a third drive-only report (`UI-004-RULINGS-overview.md`) that neither known instance nor the proposed guard would have caught, because UI-004 is in flight.

---

## The window

F1 and F2 are one finding, not two: both are symptoms of the period between the carry and now, during which the register served rules already amended on the drive. Inside that window GEN-001 was merged and closed and one of its rulings never entered the register.

**Enumerate the window.** List every PID closed, merged, archived or generated in it and check each against the amended rules rather than those nominally in force. Report what is found, including "nothing else". An authority defect live for a period makes the work done in that period suspect until checked; repairing only the known instances leaves the class open while reporting it closed.

*Result, per the executor: the window's five register actions all comply. Three drive-only reports found, not two.*

## F1 — the authoritative copy of `00-START-HERE.md`

The repository is the authoritative **location**. The drive copy holds the authoritative **content**. Carry the drive content into the repo verbatim and report the diff applied; improve nothing while carrying — a verbatim carry the executor silently improves is no longer a verbatim carry.

The mechanism was correctly diagnosed by the executor. The supersede banner was scoped to `rewrite/governance/`, and `00-START-HERE.md` sits at `rewrite/`, one level above. It had been carried into the register without being declared superseded at its staging location. The scoping was careful, and the carefulness opened the hole.

Put the supersede banner on `rewrite/00-START-HERE.md` as part of this work.

## F2 — the orphan ruling and the guard

Carry `GEN-001-RULINGS-step2.md` into the register. Yes.

The guard is accepted. Its sentence about not covering in-flight PIDs stands **unsoftened** in the final report. A guard described as partial is worth more than one described as complete.

The generalisation: the register and the reports directory are two lists that should agree, and every existing check walks one direction only. The orphan check walks reports → pids; the new guard walks pids → reports for closed PIDs. State which cases neither direction covers and leave them uncovered rather than papering them. An in-flight PID with no report yet is legitimately indistinguishable from one whose report was lost, and a check that cannot tell those apart must not claim to.

## F3 — the `prove.sh` battery: approved

`docs/governance/bin/prove.sh`. Assert each mutation's exact exit code, and make a mutation returning 0 a **failure** of the battery rather than a pass.

The executor's reasoning is rule 2 turned on itself: twelve proofs living in a session transcript is a finding that lives only in a session, and "re-run the battery" is a done-when only its author can discharge. That is a memory, not an acceptance criterion.

The battery grows; it does not get curated.

## F4 — CI shape

**CI runs checks. CI never writes to the repository.**

One workflow. It runs `prove.sh` and the index `--check`. Nothing else: no matrix, no caching cleverness, no auto-formatting, no auto-fix, and above all no regenerate-and-commit of the index.

The reason is specific rather than stylistic. If CI regenerates and commits the index, the index becomes robot-maintained, and a collision stops appearing as two files in a diff a human reads — it gets silently resolved by a machine at 3am. The entire allocation design rests on a collision being **visible**. A CI that fixes things is a CI that hides them.

If a check fails, CI fails and a human reads it. That is the whole contract. Keep the workflow short enough to read on one screen, because everyone will copy it.

---

## Principles added to `PID-PRINCIPLES.md`

1. A ruling is delivered when the recipient can read the artifact, not when the artifact is written. Filing and notifying are two acts; both are required, and the notification must carry a path the recipient can actually reach.
2. Absence in your view is not absence. Report "I enumerated X and it is not there, and I cannot see Y" — never "it does not exist" — unless you have enumerated every place it could be. A check that cannot reach a location returns silence, and silence is not a negative result.
3. Where a session cannot reach the authority store it holds a mirror, and mirrors are append-only. A delivered artifact is never edited in place; a change is a new artifact with a new name. This is ADR-003 AM4's Location-identity rule applied to documents.
4. A role name is not an identity. Two sessions can answer to the same role, and an instruction addressed to the role reaches whichever one the relay happens to hit. Address a session by what it has enumerated holding, never by what it is called.
5. An authority defect that was live for a period makes every closure, merge and generation in that period suspect until checked.
6. An enumeration that does not name its root is not evidence. State the root walked and the depth.
7. Absence in a set that did not arrive says nothing about absence in the set as authored. When a transfer fails, the resulting hole is a fact about the transfer, never a finding about the source.
8. This rulebook has a scope. Before requiring a protocol of a session, name the disaster it prevents **for that session**; if you cannot, it does not apply.
9. **A consolidated re-issue inherits the authority of the consolidation while carrying claims from the drafts it replaces.** Re-verify every load-bearing claim at the moment of consolidation, or mark it as carried-unverified. This ruling propagated a false claim about rule 7 through exactly that mechanism, and it took a second objection from the executor to withdraw it.

Principles 1, 2, 4, 6 and 7 were earned on the design line; 8 cites a day spent by two design sessions; 9 was earned by the Brain. None is about design — they are reporting discipline and they bind every session.

## Working-style items

**A. Supersession is per document, never per directory.** Carried implies superseded.
**B. Executor sessions do not have uniform reach.** Establish reach by asking a session to enumerate, never by assuming. Principle 4 catches the shared-role-name failure; only B catches the assumed-reach failure.
**C. Rule 3 generalises beyond repositories.** Do not build an instruction on a state you have not established.

Home: `docs/governance/WORKING-STYLE.md`, alongside `PID-PRINCIPLES.md`. Confirmed.

## Attribution

Entries recording incidents the writing session did not witness are recorded on the Brain's authority, not on evidence that session holds. That distinction survives into the register: `PID-PRINCIPLES.md` carries a header line stating that entries are recorded from whichever session earned them and that the report trail holds the evidence. The executor's disclosure in the Step 2 report stands as written.
