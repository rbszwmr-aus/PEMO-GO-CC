# GEN-001 — Step 2: the governance skeleton, built and proven

**PID:** GEN-001 v1.1 · **Pin:** `360fca77c807c0e85c54d12901af40547317f12d` · tree `627184ffea364aa971396a11e2f3e1625b370938` · 714 files
**Branch:** `rewrite`, off the pin · **Worktree:** `/home/luipt/projects/PEMO-worktrees/rewrite-GEN-001`
**Write scope:** `docs/governance/**` — verified below that nothing outside it was touched.
**Status:** HARD STOP before commit. **Nothing is committed and nothing is staged.**

Built against the filed ruling `reports/GEN-001-RULINGS-step1.md`, re-read at the start of this step, not the relay. Both amended staging files were re-read and their carry hashes re-taken: `U+FF1B` is gone from `PID-TEMPLATE.md` (non-ASCII is now `—` `…` `→` only), and rules 1 and 7 in `00-START-HERE.md` carry the allocation-authority split and the file-moves-on-close amendment.

---

## 1. What is on the branch

18 files, all under `docs/governance/`.

```
docs/governance/
├── 00-START-HERE.md          verbatim carry
├── PID-PRINCIPLES.md         verbatim carry
├── PID-TEMPLATE.md           verbatim carry
├── PID-INDEX.md              GENERATED
├── bin/pid-index.mjs         the generator (309 lines, zero dependencies)
├── pids/                     GEN-001.md, GEN-003.md, UI-004.md      ← in flight
├── archive/
│   ├── DOC-002.md            ← closed: file moved here with its row (amended rule 7)
│   └── PID-INDEX-ARCHIVE.md  GENERATED
└── reports/                  8 files — DOC-002 ×3, GEN-001 ×2, UI-004 ×3
```

`docs/governance/` did not exist at the pin; this is purely additive. `git status --porcelain` shows one untracked directory and **0 entries outside `docs/governance/`**.

### The verbatim carry — verified after the whole proof battery, not before it

| File | bytes | sha256 | staging == repo |
|---|---:|---|---|
| `00-START-HERE.md` | 3758 | `08e9f83e0e6cd356…` | **identical** |
| `PID-PRINCIPLES.md` | 9022 | `fd24e5042cdff440…` | **identical** |
| `PID-TEMPLATE.md` | 2554 | `c5247d31beed16b6…` | **identical** |

`00-START-HERE.md` and `PID-TEMPLATE.md` moved from their Step-1 hashes (3204/`c339fe4a…` and 1852/`f302f470…`) because the Brain amended them; `PID-PRINCIPLES.md` is unchanged. The three in-flight PID files are byte-identical to staging too.

### The one edit made during migration, and its source

`archive/DOC-002.md` differs from staging by exactly one added line:

```
+ closed: 2026-08-27
```

The schema now requires `closed` for `status: done`, and DOC-002's staging file predates that key. **The value was not invented** — it is carried from the `closed` column of the hand-written `archive/PID-INDEX-ARCHIVE.md` row the Brain authored. Everything else in the file is untouched, proven by `diff`. This is the whole of the register content this executor authored; every other byte is either carried or generated.

---

## 2. The generator

`docs/governance/bin/pid-index.mjs` — plain ESM, **zero dependencies**, no build step, matching the existing governance tooling (`contract-hash.mjs`, `stamp-version.mjs`, `validate.mjs`). It sits inside `docs/governance/`, so the `API-005-ST`-owned repository root was never edited.

```
node docs/governance/bin/pid-index.mjs            regenerate both index files
node docs/governance/bin/pid-index.mjs --check    verify only; writes nothing
node docs/governance/bin/pid-index.mjs --next     print max(NNN)+1
                                       --require-git   make the git check mandatory
```

**One scan.** `scan()` is called exactly once per invocation; the index, `max(NNN)+1`, the duplicate check and the orphan check all derive from that single record set, so they cannot disagree about what the directory contains.

**Distinct exit code per fault**, as ruled — because each acceptance line has to be shown firing for its own reason, and a single exit 1 for five faults would make "it failed" uninformative.

| Code | Fault |
|---:|---|
| 0 | all checks pass |
| 1 | duplicate `NNN` — the two-files alarm |
| 2 | front-matter schema violation |
| 3 | index drift (`--check`) |
| 4 | a PID file is invisible to git |
| 5 | orphan report — a number in `reports/` held by no PID file |

### Two design decisions worth stating

**The git check does not make the tool git-dependent.** DOC-002 F3 recorded tests that shell out to `git` and are un-runnable from an export or a container; it would be a poor joke to reintroduce that defect in the tool that enforces the method. Checks 1, 2, 3 and 5 run anywhere with no git at all — verified by copying `docs/governance/` outside any work tree and running it there (exit 0). Check 4 needs git, and when it cannot run it **says so out loud** rather than skipping silently, because DOC-002 F7 recorded exactly that failure mode. `--require-git` turns the skip into exit 4 so CI can demand it.

**The template-comment trap has a named cause.** `PID-TEMPLATE.md` carries explanatory `# …` comments in its example front-matter. Someone copying it literally leaves them in a real PID. The parser does not strip them — silent truncation of a value is worse than a failure — but the error message names the likely cause instead of leaving a confusing enum error.

---

## 3. Proof battery — every acceptance line shown firing for its own reason

Mutations were applied to a snapshot-backed working copy and reverted from the snapshot after each, **not** with `git checkout`: nothing is committed, so `git checkout` would have restored the files to a state in which they do not exist.

| # | What is claimed | Mutation applied | Observed |
|---|---|---|---|
| P0 | the committed index matches the directory | none | `--check` **exit 0** |
| P1 | duplicate `NNN` fails loud — **shape (a)**, one number under two type prefixes | added `pids/API-003.md` beside `GEN-003` | **exit 1**: `duplicate NNN 003 held by 2 files: pids/API-003.md, pids/GEN-003.md` |
| P1b | duplicate `NNN` fails loud — **shape (b)**, one id in two locations | copied `pids/GEN-003.md` → `archive/GEN-003.md` | **exit 1**, naming both paths, **plus exit 2** for the rule-7 location violation |
| P2 | a missing front-matter key stops it loudly | deleted `write_scope:` | **exit 2 alone**: `missing required key 'write_scope'` |
| P2b | the template-comment trap is self-explaining | copied the template's `type:` line literally | **exit 2**: *"…contains ' # ' — if this was copied from PID-TEMPLATE.md, delete the explanatory comment"* |
| P3 | index drift is caught | appended an HTML comment to `PID-INDEX.md` | **exit 3 alone** |
| P4 | a PID file invisible to git is caught | `pids/.gitignore` containing `UI-004.md` | `git status` saw **0 entries** for it; the generator still saw it and returned **exit 4** |
| P4b | the git skip is loud, and the core still runs | ran from a copy outside any git work tree | loud `NOTE: … SKIPPED`, **exit 0**; with `--require-git`, **exit 4** |
| P5 | an orphan report is a finding | added `reports/API-009-step1.md` | **exit 5 alone**: no PID file exists for `API-009` |
| P6a | `archive/` genuinely feeds `max(NNN)+1` | added a closed `archive/DOC-009.md` | next went **005 → 010**, and back to **005** on removal |
| P6b | a number held **only** in `archive/` is still refused | re-created `002` in `pids/` (DOC-002 exists only in `archive/`) | **exit 1**: `duplicate NNN 002 held by 2 files: pids/DOC-002.md, archive/DOC-002.md` |
| P7 | the three carried files are byte-identical | — | three sha256 matches, re-taken after all mutations and restores |

Post-battery sanity: `--check` **exit 0**, next allocation **005**, no stray files.

**`005` is what the generator emitted, not what the PID's prose said.** GEN-001 states the next number should be 005 and adds *"verify this by running the generator, do not take it from this sentence."* Run: `005`.

---

## 4. A finding about my own reference derivation

The two-line derivation I gave in DOC-002, which the PID adopted as the reference, is **incomplete** — and the gap was opened wider by the rule-7 amendment.

```
ls pids/ reports/ archive/ | grep -oE '[A-Z]+-[0-9]{3}' | grep -v '^ADR-' \
  | sort -u | sed 's/.*-//' | sort | uniq -d
```

Measured against both duplicate shapes:

| Shape | Example | Reference one-liner | Generator |
|---|---|---|---|
| (a) one number, two type prefixes | `DOC-002` + `GEN-002` | **CAUGHT** — prints `002` | caught |
| (b) one id, two locations | `pids/GEN-003.md` + `archive/GEN-003.md` | **MISSED** | caught, both paths named |

The cause is the `sort -u`, which is load-bearing for shape (a) — it stops DOC-002's three report files from reading as three holders of `002` — but it collapses the two `GEN-003` files to one token before the number is extracted, so `uniq -d` never sees a pair.

**Shape (b) was unreachable before this ruling and is reachable now.** Under the old rule 7 only the *row* moved and PID files never left `pids/`. Now the *file* moves, and a move done as a copy — or interrupted — leaves the same id in both directories. The amendment that made the archive leg exercised by ordinary operation also created a new way to corrupt the register, and the reference check cannot see it.

The generator therefore keys the duplicate check on **distinct file paths per number**, not on distinct tokens, and catches both. The one-liner remains correct as a quick human check for the collision that actually happened; it should not be the implementation, and `GEN-001`'s text still presents it as the reference. Named rather than quietly diverged from.

---

## 5. Surfaced, per ruling Q3: `reports:` globs disagree with the directory for **all three** PIDs that have reports

The record column is derived from the directory, so nothing is wrong with the generated output. But the disagreement is real and the ruling asked for it to be surfaced. The generator prints it as a `NOTE` on every run:

| PID | `reports:` glob matches | directory holds | missed by the glob |
|---|---:|---:|---|
| DOC-002 | 2 | 3 | `DOC-002-RULINGS-step2.md` |
| GEN-001 | 1 | 2 | `GEN-001-RULINGS-step1.md` |
| UI-004 | 1 | 3 | `UI-004-RULINGS-step1.md`, `UI-004-RULINGS-step2-properties-pilot.md` |

The pattern is uniform: `reports/<ID>-step*.md` cannot match a **ruling** file, and rulings are now first-class register evidence — this whole PID was released by one. The glob is the stale artefact, not the directory. Options for the Brain: widen the template's `reports:` to `reports/<ID>-*.md`, or drop the key as decorative now that the record is derived. **Not changed here** — it is a `PID-TEMPLATE.md` and per-PID front-matter decision, and those files are carried verbatim.

---

## 6. Gaps — this list is complete

1. **Nothing is committed or staged.** HARD STOP honoured. `git status --porcelain` shows a single untracked `docs/governance/`.
2. **`GEN-001`'s own front-matter says `status: draft`** while it is being executed; the schema would accept `running`. Carried verbatim rather than corrected, because the register is the Brain's to author and an executor editing status is the anti-pattern this PID exists to remove. It means the generated index currently describes this PID as `draft`.
3. **This report is not yet in the repo's `reports/`.** It is written to staging first; it is copied in and `--check` re-run below, but any *later* report or ruling for an in-flight PID will need a re-copy. The repo register is a snapshot as of the carry, not a live mirror of the drive.
4. **Two homes for governance now exist** — `rewrite/governance/` on the drive and `docs/governance/` in the repo. Step 1 Q8 raised this; the ruling did not address it. Converting the staging copy to a pointer is a **G-drive write, outside this PID's write scope** and still open.
5. **The `closed` key is enforced only for `done|merged`.** `PID-TEMPLATE.md` shows it always present-and-empty; I made it optional for `draft|running` so the migration needed one edit rather than four. If the Brain prefers the template's stricter reading, `GEN-001.md`, `GEN-003.md` and `UI-004.md` each need an empty `closed:` line and the schema needs a one-word change.
6. **No CI wiring.** Nothing runs `--check` automatically. A wrapper script would be a root `package.json` edit, outside this write scope; a CI workflow file would be outside `docs/governance/**` too. Named for a follow-up PID, not attempted.
7. **The orphan check cannot see reports that never left the drive.** It catches a number in the repo's `reports/` with no PID file; it cannot know about a report that exists only on G-drive and was never carried in. Q7b names carry-in from non-repo sessions as the case this guard serves — it serves the *forgotten-PID-file* half, not the *forgotten-report* half.
8. **`docs/governance/00-START-HERE.md` carries a dangling reference.** Its read order points at `product/function-scope.md`, which does not exist in the repo and is out of scope here. Carried verbatim as planned; the reference resolves once the design-doc migration PIDs land.

---

## 7. What the Brain is asked to rule

1. **Accept the build**, and release the commit — this is the HARD STOP.
2. **Gap 5** — is `closed:` required-present-but-empty on every PID (template's reading, 3 more edits), or optional until close (as built)?
3. **§5** — widen `reports:` to `reports/<ID>-*.md`, or drop the key now that the record column is derived?
4. **§4** — `GEN-001`'s text still names the two-line derivation as the reference implementation. Amend it to describe file-keyed counting, so a future re-implementation does not reinstate the shape-(b) blind spot?
5. **Gap 2** — flip `GEN-001` to `status: running` at source, and re-run the generator.
6. **Gaps 4 and 6** — the staging-copy pointer and CI wiring, both outside this write scope.

**HARD STOP. Nothing is committed.**
