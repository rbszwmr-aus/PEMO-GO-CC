# GEN-001 Step 1 — Master Brain ruling (filed)

**Author:** Master Brain · **Date:** 2026-08-27 · **Rules on:** `reports/GEN-001-step1.md`
**Verdict:** Step 1 **ACCEPTED**. Step 2 **RELEASED**. Schema and design notes ruled below; `PID-TEMPLATE.md` and `00-START-HERE.md` amended in staging as a direct result.

## Accepted without change

- **The pin and the branch.** `360fca77` / tree `627184ff` / 714 files, stated as a **measured** equality with `DOC-002` rather than carried from it — correct, and the distinction matters.
- **The ancestry check.** `merge-base --is-ancestor` confirming the drifted checkout `9f4756b` is an **ancestor** of `rewrite` rather than its base is exactly the verification the PID's closing warning asked for. Eleven commits would have gone missing silently. Recorded as the reason the warning was written.
- **The staleness evidence, computed not eyeballed.** 3 of 3 active rows stale, 9 field-instances, including `GEN-001` reading as `v1.0` — the version its own `v1.1` header corrects as *"written before D01 and wrong"* — and `UI-004` reading `draft` while its file says `running`. **The register consulted for what is in flight is wrong today.** That is the case for this PID, made by measurement.
- **The predicted Step-2 red.** The generator's output will not match the committed seed. **That disagreement is the correct result, not a defect** — the seed is hand-written and stale by construction; it is replaced by generated output. Affirmed in advance so it is not mistaken for a failure.
- **Design notes, all four.** Generator at `docs/governance/bin/pid-index.mjs` (inside write scope, so root config owned elsewhere is untouched); zero-dependency `.mjs` matching existing governance tooling; one scan feeding all three outputs; **distinct exit codes per fault** — the reasoning is right and is now a requirement: *a single exit 1 for four different faults makes "it failed" uninformative, and each done-when must be shown firing for its own reason.*

## Rulings

### Q2 — `closed:` is added to the front-matter schema.

The archive table needs a `closed` date, no key holds it, and staging is not a git repo so it cannot be derived from history. **Add `closed:` to the schema** — empty until `status` is `done` or `merged`. The rule it satisfies is the one this PID exists to enforce: **a generated table's every column must come from the source, or the table stays hand-written and the defect survives the fix.**

`PID-TEMPLATE.md` amended in staging accordingly. Re-take its carry hash.

### Q7 — The repository carries the register, not only the machinery. And rule 7 changes.

Machinery in the repo with the register still on G-drive is a half-move that leaves issue #1 unfixed. **`pids/` and `archive/` migrate.**

But the sharper form of your point deserves the actual fix. You wrote that *a guard proven only against a synthetic fixture is weaker than one proven against the register it guards.* So rather than leave `archive/` empty and test it with a temporary move, **`00-START-HERE` rule 7 is amended: on close, the PID file moves to `archive/` along with its row.** `pids/` then holds only what is in flight, `archive/` holds real data permanently, and **the archive scan leg is exercised by ordinary operation rather than by a test alone.** A guard the daily path walks through is worth more than a guard the daily path routes around.

`DOC-002.md` therefore moves to `archive/` as part of this migration — which also gives your archive done-when real data rather than a fixture.

### Q7b — the three legs have different jobs, and this is worth stating.

- **`pids/` + `archive/` — allocation authority.** Every allocated number lives in one or the other, because allocation *is* creating the file.
- **`reports/` — cross-check, not a source.** A report can only exist for an allocated PID, so a number in `reports/` with no file in the other two is an **orphan report** — a finding, exit non-zero. This is why the leg stays in the scan even though it cannot originate a number.

Rule 1 amended to say this. It also answers where non-repo sessions fit: a Cowork design session has no repo access, so its reports land on the drive and are carried in — and the orphan check is what catches a carry-in that was forgotten.

### Q3 — Derive the archive row from the directory. Confirmed.

`DOC-002`'s archive row lists three files while its `reports:` glob matches only two — proving it was hand-authored. **A hand-authored row inside a generated table is precisely the defect.** Derive it: the row's file list comes from the directory scan, not from the glob and not from a human. If the glob and the directory disagree, that disagreement is itself worth surfacing.

### Q6 — `ADR-carry` is removed from the type enum. Confirmed.

`type` must equal the id prefix; `ADR-carry` cannot be an id prefix, and ADRs carry their own sequence excluded from the scan. Carrying an ADR into the repository is a `DOC` or `GEN` task like any other. Enum is `API | GEN | UI | DOC`. `PID-TEMPLATE.md` amended.

### Q9 — The fullwidth semicolon is mine. Fixed in staging.

`U+FF1B` in `PID-TEMPLATE.md` was an IME slip in my authoring. **Fixed at source**, so the verbatim carry stays verbatim. You were right not to correct it silently — *a verbatim carry the executor improves is no longer verbatim*, and byte-identity was a done-when it would have quietly broken. Re-take the carry hash from the amended file.

### Your proposed addition — ACCEPTED, and it generalises a principle.

> The generator asserts every `pids/*.md` is git-tracked, by reading the filesystem and asking git about each file — **never asking git what exists.**

Accepted as a done-when. The reasoning is the principle one layer over: an ignored PID file is visible to `readdir` and invisible to `git status`, so its number would be **held in the register and absent from the repository**. As you put it — *the data doesn't leave the directory, it leaves git's view of it.* The direction matters: enumerate from the filesystem, then interrogate git per file. Asking git what exists would inherit git's blind spot as the scan's own.

## Released

Step 2 proceeds. Carry hashes re-taken from the amended `PID-TEMPLATE.md`; everything else as planned. **HARD STOP before commit**, as written.
