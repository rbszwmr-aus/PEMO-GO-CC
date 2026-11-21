# GEN-005 — Step 1: pin, plan, and how the GEN-001 battery gets re-proven

**PID:** GEN-005 v1.0 · **Write scope:** `docs/governance/**` and CI config for the `--check` job only.
**Status:** HARD STOP. Nothing built. Two findings in §5 that the Brain should rule on before Step 2, one of which is live on `main` now.

---

## 1. The pin

Re-fetched and read; not carried from the merge I performed an hour ago.

| Field | Value |
|---|---|
| **Commit** | `763b6863b8512a5fabbaeb7fa533d147cbebc31d` |
| **Tree** | `b5e8ea632bf68ae05fd966583592d36a4a8571d4` |
| Date | 2026-08-27T15:14:48+10:00 |
| Subject | `chore(governance): allocate GEN-005 — close GEN-001's three carried items [GEN-005]` |
| **Files** | **734** · gitlinks 0 |

Register at the pin: active `GEN-003`, `GEN-005`, `UI-004`; archive `GEN-001`, `DOC-002`. `--next` emits **006**.

## 2. Scope, measured

**Item 1 — `reports:` occurrences.** 5 PID files (`pids/GEN-003.md`, `pids/GEN-005.md`, `pids/UI-004.md`, `archive/GEN-001.md`, `archive/DOC-002.md`), 1 in `PID-TEMPLATE.md`, and 4 sites in the generator: the `REQUIRED` list (line 47), the empty-value loop (103), `noteGlobDisagreements` (257–266) and its call (281). `reportsFor()` (204) is the *directory*-derived helper and **stays** — it already is the derivation item 1 wants; what goes is the declared glob and the machinery that compares against it.

**Item 1's proof target exists.** Three PIDs have a ruling among their reports — DOC-002 (1), GEN-001 (1), UI-004 (2) — so "a PID whose reports include a ruling now lists it" is provable on real data rather than a fixture.

**Item 3 — there is no CI in this repository at all.** `.github/`, `.gitlab-ci.yml`, `Jenkinsfile`, `azure-pipelines` — none present at the pin. So item 3 is not "add a job", it is "introduce CI", and the first workflow file sets a precedent for every later one. Named because it is larger than it reads.

## 3. The plan

**Ordering is load-bearing and the three edits must land in one commit.** Removing `reports:` from `REQUIRED` while adding unknown-key rejection makes every file still carrying the key fault immediately. Split across two commits, the register is red in between — which item 2's own second principle forbids. So: strip the key from all 6 files, change the generator, and regenerate, as a single change.

**Unknown-key rejection needs a mechanism the generator does not have.** The parser currently accepts any key matching `^[a-z_]+$`. Item 1's clause requires an explicit allow-list — `id, type, version, from, to, status, pin, write_scope, closed` — with anything outside it a named exit-2 fault. That is the no-safe-default discipline the clause asks for, and it is a real addition, not a deletion.

**The archive `record` column does not change.** It is already derived from the directory (`reportsFor`), which is why the glob's uniform staleness was visible in the first place. Item 1 removes the redundant declaration, not the derivation.

## 4. How the GEN-001 battery gets re-proven

The PID names the exposure precisely: *a schema change that silently weakens a guard is the failure this PID is most exposed to.* A green suite afterwards would not answer that. Every proof must fire **with its own exit code**, as before.

**The battery becomes an executable script, and this is a proposal the Brain should rule on.** GEN-001's twelve proofs were run ad hoc; they exist only in a session transcript and a report table. By rule 2, a finding that lives only in a session is lost — and "re-run the battery" is a done-when nobody but me can currently discharge. I propose `docs/governance/bin/prove.sh`: it snapshots the register, applies each mutation, asserts the **exact expected exit code**, restores from the snapshot, and fails if any mutation produces the wrong code — including **exit 0**, so a weakened guard reads as a failure rather than a pass. Inside write scope, and it makes item 3 substantially cheaper: CI runs `--check` *and* the battery.

The thirteen cases, each asserted on its own code:

| # | Case | Expected |
|---|---|---:|
| 1 | clean register | 0 |
| 2 | duplicate NNN, shape (a) — two type prefixes | 1 |
| 3 | duplicate NNN, shape (b) — one id in `pids/` **and** `archive/` | 1 |
| 4 | missing required key | 2 |
| 5 | template `#` comment copied into a value | 2 |
| 6 | **`reports:` present after the change — the new unknown-key fault** | 2 |
| 7 | unknown key generally (e.g. `owner:`) | 2 |
| 8 | hand-edited index | 3 |
| 9 | PID file ignored by git | 4 |
| 10 | run outside a git work tree — skip is loud, core still runs | 0 |
| 11 | as 10 with `--require-git` | 4 |
| 12 | orphan report | 5 |
| 13 | `max(NNN)+1` fed by `archive/` — closed high number raises it, removal lowers it | 0 + value check |

Case 6 is item 1's own done-when. Case 3 is the shape the reference one-liner cannot see, and it must keep firing after the schema change — it is the one most likely to be silently weakened, because the duplicate check and the schema check share the same record set.

Mutations will again be reverted **from a snapshot, not `git checkout`** — during Step 2 the working tree holds uncommitted changes, and `checkout` would restore files to a state in which the edits do not exist.

## 5. Two findings — both about the register, one live on `main`

### F1 — The two copies of the global rules disagree on 5 of the 8 rules, and the repo holds the stale one.

`00-START-HERE.md` exists twice: `docs/governance/00-START-HERE.md` in the repository, and `rewrite/00-START-HERE.md` on the drive. Parsed and compared rule by rule:

| | |
|---|---|
| Identical | rules **3, 5, 8** |
| **Divergent** | rules **1, 2, 4, 6, 7** |

The repository copy — the one the read order now points at as the register — is **missing every amendment made since the carry**, including:

- **rule 4's new second sentence**, *"Where the hazard is live on real data, prove it there"* — added from the copy-first move I performed two hours ago;
- **rule 6's** *"re-read from the remote rather than trusting the push output"*;
- **rule 7's** *"On close, the PID file moves to `archive/` with its row"* — the amendment the whole archive-leg design rests on;
- **rule 2's** clause that what git already records is not transcribed into a report;
- **rule 1's** wording of never-reissued.

**This is the second-home defect, alive on the file that carries the rules.** The supersede banner was scoped to `rewrite/governance/` — and `00-START-HERE.md` sits at `rewrite/`, one level above it, so the banner does not cover it and by design should not. The result is that the amended rules live in the folder declared *not* the register, and the register carries the superseded text. An executor obeying the read order today reads rule 7 without the file-move clause and rule 4 without the sentence this session earned.

Not fixed here: `docs/governance/00-START-HERE.md` is inside my write scope, but *which copy is authoritative* is a Brain decision, and re-carrying is a content decision I should not take unilaterally. Proposed as a fourth item for GEN-005, or a same-day correction outside it.

### F2 — A ruling exists on the drive and not in the register, and the orphan check structurally cannot see it.

`GEN-001-RULINGS-step2.md` — the ruling that approved the merge — is in `rewrite/reports/` and **absent from `docs/governance/reports/`**. It was authored after my carry and before the merge, so it was never picked up.

My GEN-001 Step 2 report named this class as gap 7 and it has now occurred within the hour: the orphan check catches *a report whose PID file is missing*, never *a PID whose report is missing*. The asymmetry is structural — the generator scans what is present and cannot know what exists elsewhere. This also means GEN-005's item 1 done-when ("a PID whose reports include a ruling now lists it") would, on GEN-001, list **one** ruling when two exist.

Cheap partial guard, proposed for Step 2: **every PID with `status: done|merged` must have at least one `-RULINGS-` file in `reports/`**, since by rule 2 no PID closes without a filed ruling. That converts an unknowable absence into a checkable one for closed PIDs. It cannot cover in-flight PIDs, and I would rather say so than imply the hole is closed.

## 6. Gaps — this list is complete

1. **Nothing built.** No file changed at the pin; the worktree is clean.
2. **F1 is unresolved and I did not touch either copy.**
3. **F2's proposed guard covers closed PIDs only.** In-flight carry-ins remain uncatchable from inside the repo.
4. **The battery script is a proposal beyond the PID's three items** and needs the Brain's assent before Step 2 spends effort on it. If declined, the battery is re-run ad hoc as in GEN-001 and the done-when stays discharged only by the executor who ran it.
5. **Item 3 introduces CI to a repository that has none.** Runner, trigger set, and whether the battery runs alongside `--check` are unstated; §3 names the precedent risk but does not decide it.
6. **This report is on the drive**, at `rewrite/reports/GEN-005-step1.md` — the working inbox per the amended `00-START-HERE`. It is carried into `docs/governance/reports/` at Step 2's commit, which is exactly the step that was missed in F2.

## 7. What the Brain is asked to rule

1. **F1** — which copy of `00-START-HERE.md` is authoritative, and does re-carrying it become GEN-005 item 4 or a separate same-day fix?
2. **F2** — accept the closed-PID ruling-presence guard, and should `GEN-001-RULINGS-step2.md` be carried in as part of Step 2?
3. **The battery script** (§4) — build it, or re-run the battery ad hoc?
4. **Item 3's CI shape** — runner and triggers, and whether the battery runs in CI beside `--check`.

**HARD STOP.**
