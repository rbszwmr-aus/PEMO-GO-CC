# GEN-001 — Step 1: pin, branch, front-matter schema, generator plan

**PID:** GEN-001 v1.1 (Bootstrap the governance skeleton in the repository)
**Write scope:** `docs/governance/**` + the index generator, on branch `rewrite`. Nothing written yet — Step 1 creates the branch and plans; Step 2 builds.
**Status:** HARD STOP. Awaiting the Brain's ruling on the front-matter schema (§3) and the nine open questions (§6).

---

## 1. The pin

Re-fetched and read at execution time; no hash was taken from any document.

| Field | Value |
|---|---|
| Remote | `git@github.com:rbszwmr-aus/PEMO.git` |
| Ref | `refs/remotes/origin/main` |
| **Commit** | `360fca77c807c0e85c54d12901af40547317f12d` |
| **Tree** | `627184ffea364aa971396a11e2f3e1625b370938` |
| Commit date | 2026-08-26T21:31:28+10:00 |
| **Tracked file count** | **714** |
| Gitlinks (submodules) | **0** — nothing excluded from the count |

`origin/main` has **not moved** since `DOC-002` pinned it: same commit, same tree, same 714. Stated as a measured equality, not carried from the earlier report.

## 2. The branch — created from the pin, not from the local checkout

`GEN-001` warns that the AMD working tree was behind `origin/main` with 30+ live worktrees, and that this PID must not become that drift's next victim. It did not.

```
git worktree add -b rewrite /home/luipt/projects/PEMO-worktrees/rewrite-GEN-001 360fca77
```

| Check | Result |
|---|---|
| Worktree | `/home/luipt/projects/PEMO-worktrees/rewrite-GEN-001` — **its own**, not the shared tree |
| Branch | `rewrite` |
| HEAD commit | `360fca77c807c0e85c54d12901af40547317f12d` — **== pin** |
| HEAD tree | `627184ffea364aa971396a11e2f3e1625b370938` — **== pin tree** |
| Files on branch | 714 |
| `git status --porcelain` | 0 changes |
| Shared checkout `9f4756b` | **an ancestor of the branch, not its base** (`git merge-base --is-ancestor`) |

The last row is the one that matters: had I branched from the local checkout, `9f4756b` would be the base and 11 commits of `origin/main` would be silently missing.

**`docs/governance/` does not exist at the pin** — verified, `git ls-tree -r HEAD -- docs/governance` returns 0 entries. `docs/` currently holds only `adr/` (12) and `architecture/` (11). No `pids/`, `reports/` or `archive/` directory exists anywhere in the repo. This PID is additive.

**No target path is git-ignored** — probed with `git check-ignore` against the five paths Step 2 will write (`PID-INDEX.md`, `pids/`, `reports/`, `archive/`, `bin/`); all clear. Worth probing rather than assuming: the root `.gitignore` carries bare `build/`, `out/` and `coverage/` rules, and `DOC-002` recorded a first-build incident where a `build/`-named test directory was silently excluded and a delivered test never reached `main`.

---

## 3. The front-matter schema — proposed, for ruling

Nine required keys, exactly the set `GEN-001` and `PID-TEMPLATE.md` name. **A tenth is needed and does not exist yet** (`closed`, Q2 below).

| Key | Type | Required | Validation proposed |
|---|---|---|---|
| `id` | `^(API\|GEN\|UI\|DOC)-\d{3}$` | always | must equal the filename stem **and** the H1's id |
| `type` | enum | always | must equal `id`'s prefix |
| `version` | `^v\d+\.\d+$` | always | — |
| `from` | one-line string | always | non-empty |
| `to` | one-line string | always | non-empty |
| `status` | enum `draft \| running \| done \| merged` | always | `draft\|running` ⇒ active index; `done\|merged` ⇒ archive index (Q4) |
| `pin` | one-line string | always | free text; `none — …` permitted (UI-004 uses it) |
| `write_scope` | one-line string | always | free text; `none — READ-ONLY…` permitted |
| `reports` | one-line string (glob) | always | must be a glob rooted at `reports/` |
| `closed` | `^\d{4}-\d{2}-\d{2}$` | **only when `status` ∈ {done, merged}** | **NEW — Q2** |

**Parsing.** Hand-written parser over a deliberately narrow subset, **not** a YAML library. The repo root declares `yaml@^2.6.1` as a devDependency, but a generator that cannot run before `pnpm install` is a governance tool gated on the build — and the existing governance tooling (`packages/api-contracts/contract-hash.mjs`, `stamp-version.mjs`, `tests/fixtures/validate.mjs`) is uniformly zero-dependency plain `.mjs` run by `node`. The generator matches that convention.

The accepted subset: an opening `---` on line 1, one `key: value` per line, value taken as everything after the **first** colon, trimmed. **Anything outside that subset is a loud failure, not a best-effort parse** — no multi-line values, no nested maps, no lists, no comments, no duplicate keys. This is "prefer unrepresentable over forbidden": a schema too small to express the ambiguous case cannot silently mis-parse it. Values legitimately contain colons, backticks, `—`, `→`, `<`, `>` and parentheses today; splitting on the first colon handles all of them.

**Title is not a front-matter key.** The index's `title` column comes from the H1 (`# <ID> — <title>`). So the generator reads front-matter **plus** the H1, and the PID's phrase "generated from `pids/*.md` front-matter" is very slightly imprecise — flagged as Q1 rather than silently resolved. All four current files have `id`, filename and H1 id in agreement, verified.

---

## 4. The generator plan

**Location:** `docs/governance/bin/pid-index.mjs`. Inside `docs/governance/**`, so it needs no root edit — deliberate, because the repository root is owned exclusively by `API-005-ST` and adding a `pnpm run` script there would be a write outside this PID's scope. Invoked as `node docs/governance/bin/pid-index.mjs`.

**One scan, three outputs.** A single `readdir` pass over `pids/` + `reports/` + `archive/` builds one in-memory record set, and every output derives from it — the index table, `max(NNN)+1`, and the duplicate check. Not three scans that could disagree.

```
node docs/governance/bin/pid-index.mjs            # regenerate PID-INDEX.md + archive index
node docs/governance/bin/pid-index.mjs --check    # verify, write nothing, exit non-zero on any fault
node docs/governance/bin/pid-index.mjs --next     # print max(NNN)+1
```

**Distinct exit codes, so each red is attributable to its own cause** — a single exit 1 for four different faults would make "it failed" uninformative, and each done-when below has to be shown firing *for its own reason*:

| Code | Meaning |
|---|---|
| 0 | all checks pass |
| 1 | **duplicate `NNN`** — the two-files alarm, printing every colliding number and the files holding it |
| 2 | **front-matter schema violation** — missing key, bad enum, id/filename/H1 disagreement; names file and key |
| 3 | **index drift** (`--check`) — regenerated output ≠ committed file; prints the diff |
| 4 | **untracked PID file** — see below |

**The allocation scan.** The reference derivation from the PID, with `archive/` in it:

```
ls governance/pids/ reports/ archive/ | grep -oE '[A-Z]+-[0-9]{3}' | grep -v '^ADR-' \
  | sort -u | sed 's/.*-//' | sort | uniq -d
```

Implemented in the generator rather than shelled out, over the same record set. `archive/` is in the scan because the rule is *a number, once allocated, is never reissued* — not *a number currently visible in `pids/` is taken*.

**One addition I propose beyond the PID's list (Q9).** A fifth check: **every `pids/*.md` is tracked by git**, asserted by reading the filesystem and asking git about each file — never by asking git what exists. An ignored PID file is visible to the generator's `readdir` and invisible to `git status`, so its number would be held in the register and absent from the repository. This is the same blind spot `DOC-002` recorded from both sides, and it is the exact shape of the principle this PID's archive scan already exists to defend against: *a check that reads a location goes quiet when the data leaves that location*. Here the data does not leave the directory — it leaves git's view of it. Costs one `git check-ignore --stdin` call.

---

## 5. Evidence that the generator is needed: the hand-written index is already stale in every row

Computed by parsing all four `pids/*.md` front-matter blocks and their H1s and diffing against the committed `governance/PID-INDEX.md`. Not read by eye.

| id | field | committed index says | front-matter / H1 says |
|---|---|---|---|
| GEN-001 | `version` | `v1.0` | **`v1.1`** |
| GEN-001 | `title` | Bootstrap the repo and governance skeleton | Bootstrap the governance skeleton in the repository |
| GEN-001 | `to` | `(executor)` | `<executor with repo access on AMD>` |
| GEN-003 | `title` | …dependency-cruiser + no-simulator-in-runtime | …dependency-cruiser + **the** no-simulator-in-runtime **invariant** |
| GEN-003 | `to` | `(AMD repo executor)` | `<executor with repo access on AMD — newly commissioned; NOT the DOC-002 session>` |
| UI-004 | `version` | `v1.0` | **`v1.1`** |
| UI-004 | `status` | `draft` | **`running`** |
| UI-004 | `title` | Claude Design authoring **—** … | Claude Design authoring**:** … |
| UI-004 | `to` | `(UI / Claude Design session)` | `<UI / Claude Design session>` |

**3 of 3 active rows stale; 9 stale field-instances.** Two are load-bearing rather than cosmetic: `GEN-001` reads as `v1.0` in the index — the very version the v1.1 header corrects as *"written before D01 and wrong"* — and `UI-004` reads as `draft` while its file says `running`. Anyone consulting the index for what is in flight gets the wrong answer today.

This is also the first `--check` fixture: at Step 2 the generator's output will not match the committed seed, and **that disagreement is the correct result**. The seed is what gets replaced, not the target to reproduce.

---

## 6. Open questions — the Brain rules these before Step 2

1. **`title` source.** H1-derived (proposed), or add a `title:` front-matter key? H1-derived keeps one home for the title; a key makes "generated from front-matter" literally true.
2. **`closed` date — a key that does not exist.** `archive/PID-INDEX-ARCHIVE.md` has a `closed` column holding `2026-08-27` for DOC-002. No front-matter key carries it and the staging drive is not a git repo, so it cannot be derived from history. Proposal: add `closed: YYYY-MM-DD`, required only when `status` ∈ {done, merged}. Without it the archive table cannot be generated and would stay hand-written — reintroducing the defect this PID removes.
3. **The archive `record` column.** DOC-002's row lists three files, but its `reports:` glob is `reports/DOC-002-step*.md`, which **does not match `DOC-002-RULINGS-step2.md`**. So the archived row was hand-authored. Proposal: the generator expands the glob `reports/<ID>-*.md` against the actual `reports/` directory — deriving the record from the directory rather than transcribing it, consistent with rule 1. This also makes the ruling files first-class register evidence.
4. **`status` enum and the archive trigger.** Which values move a row? Proposal: `{draft, running}` → active, `{done, merged}` → archive. Note DOC-002 is `done` and archived without ever being `merged`, so `done` must trigger the move; rule 7 says "closed", which maps to both.
5. **`from`/`to` rendering.** Front-matter carries `<executor with repo access on AMD>`; inside a Markdown table `<...>` is parsed as an HTML tag and can render as nothing. The committed index sidesteps this by hand-substituting parentheses. Proposal: the generator escapes `<` and `>` when emitting table cells, and the front-matter keeps the authored value. Confirm the angle-bracket convention is intended in the source.
6. **`type` enum.** `PID-TEMPLATE.md` lists `API | GEN | UI | DOC | ADR-carry`. `ADR-carry` is not a valid id prefix (an id must be `<TYPE>-NNN` and allocation excludes `ADR-NNN`), so a carried ADR would be, say, `DOC-007` with `type: ADR-carry` — breaking the "type equals id prefix" validation I proposed. Rule: drop `ADR-carry` from the enum, or exempt it from the prefix check?
7. **Does the repository carry the register, or only the machinery?** This is the most consequential question here. The scan has three legs — `pids/` + `reports/` + `archive/`. If Step 2 lands only `pids/`, then two of the three legs are empty, the archive guard has no real data to be tested against, and the numbers held by report files are represented only incidentally. Proposal: carry the full current register — 4 `pids/` files, the 3 DOC-002 reports, the ruling file, this report, and the archive index — so all three legs are populated and every done-when is provable against real data rather than a fixture. `GEN-001` says design docs (ADRs, function-scope, architecture, authority spine) are *not* in scope; it does not say whether the register itself travels. I read "the machinery they ride on" as including the register, but I will not decide it.
8. **Two homes for governance after this lands.** Once `docs/governance/` exists, `rewrite/governance/` on the G drive is a second copy — "a decision must have one home", and the README already anticipates the staging copy becoming a pointer. Converting it is a **G-drive write, outside this PID's write scope**. Named as a Brain action, not taken.
9. **The verbatim carry, and one character in it.** `PID-TEMPLATE.md` line 14 contains **U+FF1B FULLWIDTH SEMICOLON** (`write_scope: <path globs>；read-only = everything else`) — almost certainly an IME slip. "Byte-identical to the staged version" is a done-when, so Step 2 **carries it unchanged** unless ruled otherwise. Fixing it is a one-character staging edit by the Brain, after which the carry stays byte-identical. Flagging rather than silently correcting: a verbatim requirement that the executor quietly improves is no longer verbatim.

Baseline hashes recorded now, so the Step 2 carry is verifiable rather than asserted:

| File | bytes | sha256 (first 16) |
|---|---:|---|
| `00-START-HERE.md` | 3204 | `c339fe4afad805c7` |
| `governance/PID-PRINCIPLES.md` | 9022 | `fd24e5042cdff440` |
| `governance/PID-TEMPLATE.md` | 1852 | `f302f4705aed6c9c` |

All three: UTF-8, no BOM, LF only, trailing newline present. Non-ASCII inventoried (`—` `→` `×` `…` `；`) so a mangled carry shows up as a hash mismatch rather than as a character that merely looks right.

**Also to rule (part of Q9):** which file carries "the global rules" into the repo? They live inside `00-START-HERE.md`, which also carries roles and a read order pointing at `product/function-scope.md` — a file that does not exist in the repo and is out of scope here. Carry the whole file verbatim (proposed, since byte-identity is the done-when), accepting a dangling reference?

---

## 7. Gaps — this list is complete

1. **Nothing has been built.** Step 1 created the branch and wrote this report. `git status --porcelain` on the `rewrite` worktree is clean; no file under `docs/governance/` exists.
2. **Q7 is unresolved and blocks a done-when.** "A number held only in `archive/` is still refused" cannot be proven against real data if the archive leg is not carried. It can be proven against a synthetic fixture, but a guard tested only against a fixture is weaker than one tested against the register it actually guards.
3. **The `--check` byte-for-byte done-when will not hold against the *current* seed index**, by design — §5 shows 9 field-level disagreements. It holds against the index the generator emits at Step 2. Naming this so a later reader does not mistake the first red for a defect.
4. **This report is on the staging drive**, at `rewrite/reports/GEN-001-step1.md`, matching `reports: reports/GEN-001-step*.md` and DOC-002's precedent. Whether reports ultimately live in the repo is Q7.
5. **No generator code has been prototyped in the repository.** The front-matter parsing approach in §3 was validated only by a throwaway script in the session scratchpad, against all four real `pids/` files; that script is not a deliverable and is not in the repo.
6. **`GEN-001` v1.1's own `pin` field is prose** (`current origin/main — read it, pin it…`), not a hash. That is correct under global rule 3, and it means the front-matter `pin` key cannot be validated as a hash for in-flight PIDs — reflected in the schema as "free text".

---

## 8. What the Brain is asked to rule

1. **The front-matter schema** in §3 — the nine keys, their validation, and the proposed tenth (`closed`).
2. **Q1–Q9** in §6. Q2 and Q7 both block a done-when; Q9 needs a yes/no on the fullwidth semicolon before the carry.
3. **The generator's shape** — location inside `docs/governance/bin/`, zero-dependency `.mjs`, one scan → three outputs, distinct exit codes per fault, and the proposed fifth check (every PID file tracked by git).

**HARD STOP. No file is written under `docs/governance/` until these are ruled.**
