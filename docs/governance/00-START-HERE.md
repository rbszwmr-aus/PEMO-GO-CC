# PEMO rewrite — START HERE

Read this first, every session. It is short on purpose.

## What this is

A rewrite of PEMO that **keeps the architecture and the engineering method** and **fixes where decisions live and when they are made** — governance in the git repository, the authority spine decided first.

**The register is in the repository.** `GEN-001` merged 2026-08-27 (`main` `a243dad5`): `docs/governance/` holds `pids/`, `archive/`, the **generated** `PID-INDEX.md`, `PID-PRINCIPLES.md`, `PID-TEMPLATE.md`, and the generator at `docs/governance/bin/pid-index.mjs`. **`rewrite/governance/` on the drive is superseded** and carries a banner saying so. This folder still holds everything else: design, decisions, product, architecture, and `reports/` — the working inbox for reports and rulings, including from sessions with no repository access.

## Roles

- **Master Brain** — authors ADRs, PIDs and rulings; governs the register; makes product and boundary decisions. One brain holds the pen at a time.
- **Executor sessions (CC)** — execute exactly one PID each: pin, build, report, stop. They do **not** choose PID numbers, edit the register's contents, change contracts outside their own PID, or approve their own work — they surface and stop.
- **Product Owner** — decides product questions; relays between Brain and executors.
- **Language** — conversational prose to the Product Owner in Cantonese; PIDs, ADRs and executor notes in English.

**Creating a PID:** the Brain authors the content; a session with repository access runs the generator for the next number and creates `pids/<ID>.md` with it. The number is **machine-emitted from a directory scan**, never taken from prose — which is rule 1 satisfied more strictly, not bypassed.

## Read order

`00-START-HERE` → **repo** `docs/governance/PID-INDEX.md` (what is in flight) → the PID you own → the ADRs it cites → `product/function-scope.md` for where it sits.

## Setup — one line, once per clone

```
git config core.hooksPath .githooks
```

That installs the **pre-push gate**: `pid-index --check` and the battery run before a push
instead of being remembered. It is repository-wide config, so one command covers every linked
worktree.

**It is a habit, not a guarantee.** `git push --no-verify` bypasses it and no repository can
prevent that — a hook lives in per-clone config that git does not version. What it closes is the
*accidental* case: `GEN-013` pushed a register that failed `--check` because its shell chain gated
the push on the commit succeeding rather than on the generator. **The guarantee is CI**, which runs
the same checks after the push and cannot be bypassed.

The battery asserts the opt-in is present, so a clone that would push ungated says so rather than
being quietly unprotected.

**Every working checkout must carry `.githooks` *and* be opted in — both.** The opt-in is
repository-wide config, but the hook itself is versioned content: a checkout sitting on a commit
that predates `.githooks` has the config pointing at a directory that is not there, and **git
treats a missing hooks directory as no hook, silently**. The opt-in check cannot catch this,
because the opt-in is present and correct; it is the checkout that lacks the hook. Observed at
`GEN-022` on this repository's own main checkout. **CI is the guarantee for any checkout that
does not carry both.**

## The 8 global rules

Every PID inherits these. They are never restated in a PID header.

1. **Allocate from the directory, never from prose.** A number is taken by creating `pids/<ID>.md`. **`pids/` and `archive/` together are the allocation authority** — every allocated number lives in one or the other. `reports/` is a **cross-check**: a number appearing there with no file in the other two is an orphan report, and that is a finding, not a source. **A number, once allocated, is never reissued.** Numbers are a **single global sequence**; a type prefix does not reset it. A collision shows as two files — a visible alarm, and the generator fires on it.

   **When more than one session is allocating (`GEN-046`).** Since 2026-09-02 an API track and a UI
   track allocate from the same global sequence at the same time, so a number read from a local
   worktree is a number that may already be gone. **Re-read the authority before you take one, and
   take it in public:**

   - `git fetch origin` and run `pid-index.mjs --next` against a tree that includes `origin/main`.
     The scan is only as current as the tree it walks.
   - **Land the allocation FIRST, as its own two-file commit** — `pids/<ID>.md` at `status: draft`
     plus the regenerated `PID-INDEX.md` — before any of the PID's work exists. The allocation is
     then a fact on `main` that the other track's next `--next` will see, rather than an intention
     held in one worktree. `GEN-046` was allocated this way, under this rule.
   - **A push rejected on the allocation commit means the number was taken while you were writing.**
     Rebase, re-run `--next`, and take the number that scan gives you. **Regenerate `PID-INDEX.md`
     rather than hand-merging it** — it is generated, and a hand-merged conflict in a generated file
     is drift that `--check` will catch later and nobody will be able to explain. `GEN-044` hit this
     against `UI-045` and resolved it by regenerating.
   - **Never renumber a PID that has landed**, even unstarted: rule 1's "never reissued" covers the
     losing side of a race as much as anything else.

   **A PID file may not bracket-cite a principle that PID defines.** The pre-push gate resolves every
   bracketed id in the repository against `PID-PRINCIPLES.md`, and a PID that proposes a new
   principle does not yet have one to resolve against — so the gate correctly refuses the allocation
   commit. Write the intended id in backticks in the PID's own text; the bracketed citation becomes
   legitimate in the same commit that adds the definition. `GEN-046`'s allocation was refused exactly
   once for this, naming two ids the PID existed to define.
2. **Two steps, hard stop before commit/merge.** The executor stops and reports; the Brain rules; only then does it proceed. Every step's **finding** must exist as a file in `reports/` — a finding that lives only in a session is lost. **A ruling is an artifact too**: filed, not relayed. What git already records — hashes, trees, the commit trail — is not transcribed into a report; the repository is the register.
3. **A PID must not assert repository state — name it to verify.** Never "main is at X" or "there are 3 of Y"; write "pin current origin/main and report it", "count Y and report it".
4. **Prove by making it fail.** A test is trusted only when its red condition has been shown to fire. A green whose red is unknown proves nothing. **Where the hazard is live on real data, prove it there** — the guard that matters is the one exercised on the path people actually walk.
5. **Exclusive write scope is a boundary, not a suggestion.** Two sessions never share a write path. Contract changes go back to the owning PID as a new version; dependents re-pin.
6. **Merge by tree-hash equality.** Refspec push from the executor's own worktree, `main` never checked out; gate on tree-hash equality between `origin/main` and HEAD, **re-read from the remote rather than trusting the push output**. **Branch from the pinned `origin/main`, never from a local checkout** — a drifted checkout silently drops whatever the pin is ahead by.
7. **A merged PID is not reopened.** A follow-up is a new PID. **On close, the PID file moves to `archive/` with its row**, so `pids/` holds only what is in flight. The number stays taken forever — which is why `archive/` is in the allocation scan, and why that leg is exercised by ordinary operation rather than by a test alone.
   **THE RULING FILE'S NAME IS LOAD-BEARING.** The close check looks for `-RULINGS-` in the filename under `reports/`, and a ruling filed under any other name — `-CLOSE-`, `-DECISION-` — is **invisible to it**, so the close is refused with the PID already archived. `GEN-032` learned this at its close, and the refusal is the only place the convention was written down. Carry every ruling into `reports/` as `<PID>-RULINGS-<what>.md`, whatever it is called elsewhere; the content is not changed by the rename.
8. **Disclose all gaps or none.** A report that names one carried gap and is silent on another lends its credibility to the silence. Enumerate every known gap, or state the list is complete.

If a proposed field or rule cannot name the disaster it prevents, it does not go in.
