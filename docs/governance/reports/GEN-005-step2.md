# GEN-005 — Step 2: built, with a correction to Step 1 first

**PID:** GEN-005 v1.0 · **Pin:** `763b6863b8512a5fabbaeb7fa533d147cbebc31d` / tree `b5e8ea632bf68ae05fd966583592d36a4a8571d4` / 734 files
**Write scope:** `docs/governance/**` and CI config for the `--check` job. Verified: **0 files outside those two roots.**
**Status:** HARD STOP before commit. Nothing staged, nothing pushed.

*(Built against the **re-issued** Step 1 ruling, which supersedes the earlier one: ten principles rather than five, and three working-style items rather than two.*

*The ruling is now **filed**: `rewrite/reports/GEN-005-RULINGS-step1.md`, 8,737 bytes, the first filed copy — both earlier versions were relays and were not artifacts. This build is reconciled against the filed text, not the relay. It carries the rule-7 withdrawal as its own §0 and adds a ninth principle.)*

---

## 0. Correction — Step 1 overstated the rule-7 divergence, and an instruction rests on it

Step 1 §F1 listed rule 7 among the amendments the repository was "missing", and singled it out as *"the amendment the whole archive leg rests on"*. **That is wrong.** The ruling then asked, reasonably, *"did anything archive under the stale rule 7, which is missing the clause the entire archive leg rests on?"* — a question whose premise came from my report.

Compared verbatim, the two copies of rule 7 are **97% identical and semantically the same**. Both carry the file-move clause:

| copy | text |
|---|---|
| repository | "**On close, the PID file moves to `archive/` along with its row**, so `pids/` holds only what is in flight." |
| drive | "**On close, the PID file moves to `archive/` with its row**, so `pids/` holds only what is in flight." |

The difference is *along with* vs *with*, and *"rather than only by a test"* vs *"rather than by a test alone"*. My Step-1 method caused the error: I diffed **bolded segments** and reported any bold phrase in the drive copy not appearing verbatim in the repo copy. Rewording a bolded phrase reads identically to deleting a clause under that method. The classifier was wrong, not the reading.

Re-done properly, by similarity plus a read of each rule:

| rule | verdict |
|---|---|
| 3, 5, 8 | identical |
| **2** | **substantive addition** — "What git already records … is not transcribed into a report" |
| **4** | **substantive addition** — "Where the hazard is live on real data, prove it there" |
| **6** | **substantive replacement** — "re-read from the remote rather than trusting the push output" |
| 1 | reworded; one addition — "and the generator fires on it" |
| **7** | **wording only. No clause was missing.** |

So: **nothing archived under a stale rule 7, because rule 7 was never stale.** The divergence was real and worth fixing; its severity was mine to state accurately and I did not.

## 1. The window, enumerated

Window: from the carry (`5b06361`, 2026-08-27T14:59:39) to now. Three commits, and every register mutation in them:

| commit | mutation |
|---|---|
| `5b06361` | the carry itself — `pids/` ×3, `archive/DOC-002.md`, both indexes |
| `a243dad` | GEN-001 closed: `pids/GEN-001.md` → `archive/GEN-001.md` (git-detected rename, R099), both indexes |
| `763b686` | GEN-005 allocated: `pids/GEN-005.md` created, active index |

Checked against the **amended** rules, not the ones in force at the time:

| amended rule | requires | in-window work | verdict |
|---|---|---|---|
| 1 + "Creating a PID" | number machine-emitted from a directory scan | GEN-005 allocated after running `--next` and checking it agreed with the ruling's number | **complies** |
| 2 | what git records is not transcribed into a report | no merge-note file was written; hashes live in the commit trail | **complies** |
| 4 | where the hazard is live, prove it there | the rule-7 move was performed as a copy first, on the real register, and both guards fired | **complies** |
| 6 | re-read from the remote, not the push output | both pushes gated by `git fetch` + `rev-parse` on `refs/remotes/origin/main` | **complies** |
| 7 | file **and** row move on close | GEN-001's file moved; `pids/` holds only in-flight | **complies** |

**Nothing else was closed, merged, archived or generated in the window.** DOC-002 was already closed before the carry; its archived state was carried in, not created here. That is the complete list.

**But the window did leave one class of damage, and it had three instances, not one.** Comparing every carried document against its source:

| artifact | state | action |
|---|---|---|
| `00-START-HERE.md` | repo stale (drive newer) | **carried drive → repo verbatim** |
| `PID-PRINCIPLES.md`, `PID-TEMPLATE.md`, `pids/GEN-003.md`, `pids/UI-004.md` | identical | — |
| `archive/GEN-001.md`, `archive/DOC-002.md` | **repo newer** (status/closed set in-repo) | left; the drive copies are superseded |
| `reports/GEN-001-RULINGS-step2.md` | drive-only | **carried in** |
| `reports/UI-004-RULINGS-overview.md` | drive-only — **not previously known** | **carried in** |
| `reports/GEN-005-step1.md` | drive-only (written after the last commit) | **carried in** |

`UI-004-RULINGS-overview.md` is the instance the enumeration earned. Step 1 found two symptoms and I would have repaired exactly those two. **UI-004 is in flight, so the closed-PID ruling guard would not have caught it either** — it is precisely the uncovered case, and it existed while I was describing the case as hypothetical.

## 2. What was built

**Item 1 — `reports:` removed; the list is derived; unknown keys are an error.**
Stripped from 5 PID files and `PID-TEMPLATE.md`. In the generator: out of `REQUIRED`, out of the empty-value loop, and `noteGlobDisagreements()` deleted entirely — there is no declaration left to disagree with the directory. `reportsFor()` stays; it always was the derivation.

The real work was the addition, as Step 1 said: a closed `ALLOWED` set (`id, type, version, from, to, status, pin, write_scope, closed`), with anything outside it an exit-2 fault. A leftover `reports:` gets its own message naming why the key is gone.

**Item 1's done-when, proven on real data.** GEN-001's archive record now reads:

```
reports/GEN-001-RULINGS-step1.md, reports/GEN-001-RULINGS-step2.md,
reports/GEN-001-step1.md, reports/GEN-001-step2.md
```

Four files including **both** rulings. Before this PID the glob matched two and the directory held three; the fourth existed only on the drive.

**Item 2 — twelve principles**, not two: the two GEN-005 specified plus the nine in the filed Step-1 ruling. `PID-PRINCIPLES.md` goes **24 → 36**, and gains a file-level attribution header — *entries are recorded from whichever session earned them; the report trail holds the evidence* — which closes the misattribution without annotating every line, verified by count and by checking each of the ten is present exactly once. Placement: *"this rulebook has a scope"* sits under *On boundaries and homes* (it bounds the method itself); *"an enumeration that does not name its root"* and *"absence in a set that did not arrive"* under *On reports and summaries*; the rest under *On proving*.

**Item 3 — CI**, `.github/workflows/governance.yml`, 41 lines. One workflow, two steps: `--check --require-git`, then `prove.sh`. `permissions: contents: read`, so "never writes" is enforced by the token and not only by convention. No matrix, no cache, no auto-fix, no regenerate-and-commit.

**F1 — the carry**, verbatim, no improvements. The applied diff is the five-rule divergence in §0 plus the "register is in the repository" paragraph, the "Creating a PID" paragraph, and the read-order change. Then the **supersede banner went onto `rewrite/00-START-HERE.md`**, per the invariant. The repo copy carries no banner — the register is not superseded — so repo and drive are now intentionally *not* byte-identical: repo == drive minus the banner block, verified programmatically.

**F2 — the guard.** A PID with `status: done|merged` and no `-RULINGS-` file in `reports/` is exit 6.

**F3 — `docs/governance/bin/prove.sh`**, 14 cases, each asserting an exact exit code.

**`WORKING-STYLE.md`** — new, 67 lines, holding all three items: **A** supersession is per document not per directory; **B** executor sessions do not have uniform reach, with both topology incidents and the note that only B catches the first of them; **C** rule 3 generalises beyond repositories — do not build an instruction on a state you have not established. **I chose its location:** no handoff or working-style doc existed in either the repo or `rewrite/`, so it sits in `docs/governance/` alongside `PID-PRINCIPLES.md`. If a different home was meant, it moves.

## 3. Proofs

```
14 passed, 0 failed
```

| case | exit | | case | exit |
|---|---:|---|---|---:|
| clean register | 0 | | hand-edited index | 3 |
| duplicate NNN (a) two prefixes | 1 | | PID file ignored by git | 4 |
| duplicate NNN (b) two locations | 1 | | orphan report | 5 |
| missing required key | 2 | | closed PID, no filed ruling | 6 |
| template `#` comment | 2 | | outside a git tree: core runs, skip loud | 0 |
| **leftover `reports:`** | 2 | | `--require-git` makes it fatal | 4 |
| unknown key | 2 | | `archive/` **feeds** `max(NNN)+1` | 006→010→006 |

**CI proven by injection, not by configuration.** Its exact run-commands were executed with faults injected:
- injected `owner: injected-fault` → step exits **2** and prints `::error::pid-index --check failed with exit 2`, with the fault named and the allowed key set listed;
- deliberately weakened the unknown-key guard in the generator → **the battery caught it**: 2 FAILs, exit 1, printing *"the mutation was NOT caught — a guard has been weakened"*. That is the exposure GEN-005 named, demonstrated.

**Not proven:** the GitHub Actions runner itself. I executed the workflow's command sequence, not the workflow. Runner setup, `actions/checkout`, and Node 22 availability are unverified until it runs once on GitHub.

## 4. Two findings from building it

**F3 — the tracked-file guard's red condition changed when the register was committed, and GEN-001's proof no longer reproduces.** `git check-ignore` does not report a **tracked** file as ignored — ignore rules apply only to untracked paths. GEN-001 proved this guard against `UI-004.md` while it was still uncommitted; now committed, the same mutation returns exit 0. The battery caught it on first run.

The guard is still correct — the dangerous window is exactly *before* a PID file is first committed, and a committed file cannot be hidden this way — but the case now creates a **new, untracked** PID file, which is the real hazard. Worth recording as an instance of the principle this PID files: the world changed under a guard, and the guard's red condition changed with it while its green stayed green.

**F4 — index drift was masking its own cause; fixed.** Exit selection was `Math.min` over all fault codes, so exit 3 (drift) won over 4, 5 and 6. Nearly every fault also drifts the index — add a file, remove a ruling, rename an id — so three guards were reporting "the index is stale" instead of what was actually wrong. Drift is a **symptom**; it is now the exit code only when it is the sole fault. Both failing cases in the battery's first run were this, and the sole-fault case (hand-edited index → 3) still holds.

## 4b. Post-ruling additions

**`prove.sh`'s restore was NOT trapped. It is now.** Asked rather than assumed: `cleanup()` was trapped on `EXIT`, but it only deleted the snapshot — `restore()` was called sequentially inside `check()`. An early death between mutation and restore left the mutation in the tree.

Proven by running both versions with an injected early exit mid-battery:

| cleanup | script exit | left behind | register |
|---|---:|---|---|
| pre-fix (delete snapshot only) | 7 | **`pids/API-003.md`** | `[exit 1] duplicate NNN 003 held by 2 files` |
| post-fix (restore, then delete) | 7 | nothing | exit 0 |

The leftover is a duplicate PID; a different case would leave a *deliberately weakened generator*. The battery that exists to prove the guards work would have been the thing that broke one.

`trap cleanup EXIT INT TERM HUP`, restore before snapshot deletion. **What it does not cover: `SIGKILL`.** Nothing can — an unkillable trap does not exist — so a hard kill still leaves the tree mutated. Stated rather than implied.

One earlier attempt at this proof was invalid and is recorded because it nearly passed: interrupting with `SIGINT` during a `sleep` showed no damage, because bash defers a trapped signal until the running command completes, so the script finished its restore normally. A test that cannot fail proves nothing; the early-exit form is what actually exercises the path.

**During that work I broke the register and had to repair it.** Cleaning up the invalid experiment I ran `git checkout -- docs/governance/pids/GEN-003.md`, which restored the file to **HEAD** — still carrying the `reports:` key this PID removes — leaving `--check` at exit 2 and the battery at 6/14. Repaired by re-applying the Step-2 state. This is the exact failure mode recorded for GEN-001 (*restore to the target, not to HEAD; snapshot instead*), committed by the session that recorded it, twenty minutes after writing a trap to prevent the same class.

**Principle 10 added** — a new check that goes red on its first real run is diagnosed, never loosened, separating infrastructural from substantive failure first.

**The first CI run is the experiment, and its two possible reds are not alike:**

| red | meaning | response |
|---|---|---|
| **infrastructural** | `actions/checkout`, `setup-node`, or Node 22 unavailable — the check never ran | fix the runner. The register is unjudged, not clean |
| **substantive** | `--check` or `prove.sh` ran and returned a fault code | read the code; the register or a guard is actually wrong |

They look identical in the Actions UI. The exit code distinguishes them: a substantive failure carries one of 1–6 and names itself; an infrastructural one dies before any of that. **Neither is a reason to remove `--require-git`, drop a battery case, or loosen a pin.**

**The filed ruling's bytes are clean.** Read from the local mount at `/home/luipt/gdrive/PEMO/rewrite/reports/GEN-005-RULINGS-step1.md`: 8,737 bytes — matching exactly — with **zero** backslash escapes of `#`, `*`, `_`, `-`, `` ` ``, `[` or `|`. Ten unescaped `#` headings, 36 unescaped `**` pairs, and correct UTF-8 for `—`, `→` and `§`. The escaping is an artifact of the Drive API read path, not the stored file. **No correction was made and none is needed** — and correcting a mangled verbatim carry at the receiving end is the failure mode flagged on the fullwidth semicolon.

## 5. Gaps — this list is complete

1. **Nothing committed or staged.** HARD STOP.
2. **Two lists, one direction each, and cases neither covers.** The orphan check walks `reports/ → pids/`; the new guard walks `pids/ → reports/` for closed PIDs only. **Neither can see a report that exists only outside the repository** — no check inside the repo can. And **an in-flight PID with no report yet is legitimately indistinguishable from an in-flight PID whose report was lost**; the guard does not claim to tell those apart, and must not. `UI-004-RULINGS-overview.md` was exactly that case and was found by enumeration, not by any check.
3. **The GitHub Actions runner is unproven** (§3).
4. **`WORKING-STYLE.md`'s location was my choice** (§2).
5. **Closed.** The Step 1 ruling is now filed at `rewrite/reports/GEN-005-RULINGS-step1.md` and this build is reconciled against the filed copy.
6. **This report is drive-only until Step 2's commit** — the same mechanism that produced the three missing carries. It is carried in as part of the commit, not before it.
7. **`rewrite/governance/` still holds superseded copies** of `PID-PRINCIPLES.md`, `PID-TEMPLATE.md` and the PID files, now materially behind the repo (principles 24 vs 31). The directory banner covers them; nothing reads them; no action taken.
8. **The `closed` key remains optional for `draft|running`.** GEN-001 gap 5, never ruled, unchanged here.
9. **Five of the twelve principles record incidents I did not witness.** Principles 1, 2, 4, 6 and 7 were earned on the design line; 8 cites a day spent by two design sessions. I transcribed them verbatim from the ruling and **verified none of them** — I have no visibility into those sessions. They are recorded on the Brain's authority, not on evidence I hold, and that distinction should survive into the register rather than being smoothed by the fact that they now sit in a file I wrote.

## 6. What the Brain is asked to rule

1. **Accept the build and release the commit.**
2. **§0's correction** — rule 7 was never stale. Confirm the window question is answered: nothing archived under a stale rule, and nothing else in the window is suspect.
3. **`WORKING-STYLE.md`'s home** — `docs/governance/`, or elsewhere.
4. **Gap 2** — accept that the two directions leave a real hole, described rather than papered.

**HARD STOP. Nothing is committed.**
