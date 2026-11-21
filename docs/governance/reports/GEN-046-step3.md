# GEN-046 step 3 — rebase, the stricter criterion, the UI gate, and the merge

**Date:** 2026-09-03  **Rebased onto:** `2f5e733` (UI-045 merge; tree `0aadb5cc` — verified, matches the ruling)
**Battery:** 33 passed, 0 failed (was 31; +2 new gates).  **Manifest:** 22 proven, 0 failed, under the STRICTER criterion.
**Harness self-test:** 9 cases, each a bite the runner must REFUSE — all 9 refuse.

---

## 0 — what I read, and one discrepancy I am flagging

I read the **filed** ruling, `reports/GEN-046-RULINGS-step2-harness-trust-and-g2-cycle.md`,
and UI-045's `reports/UI-045-RULINGS-step1-notices-part1.md` for R1. **Items 2, 3 and 5 of the
dispatch (the four-part criterion, the resident-portal remediation, G7) are not in either filed
ruling.** I treated them as new dispatch from the PO rather than as ruling text, and executed them.
Flagging it because `[read-the-artifact]` cuts both ways: the filed artifact is the authority for
what was *ruled*, and this work is not in it.

UI-045's filed R1 asks for *"named case red with log present"* — two conditions. The dispatch asks
for four plus an instrument control. I built the four.

---

## 1 — rebase

`git fetch`, then rebase onto `2f5e733`. One commit replayed, no conflicts. **`PID-INDEX.md`
regenerated, never hand-merged** — and it came out byte-identical, so there was nothing to merge.
The generator's `--check` warns that GEN-046 is `draft` with a landed commit; that is the
warning's designed behaviour for a PID mid-flight and it does not fail.

---

## 2 — the stricter criterion, and the one bite that flipped

`run-mutations.sh` is **replaced by `run-mutations.mjs`** — the four rules need per-case logs,
and parsing those out of TAP in shell is how you get a parser nobody trusts. Certification now
requires all four, each reported by name when it is the one that failed:

| rule | what it refuses |
|---|---|
| 1 | a red that is not the target |
| 2 | a named red with **no log** — no evidence it failed for its own reason |
| 3 | a log that is **infrastructure**, not an assertion (build error, timeout, missing module, dead browser) |
| 4 | **undeclared collateral** — reds beyond `target` + `alsoRed` |

Plus **two controls**: every suite must be **green before mutating** (a red baseline makes every
later verdict meaningless — GEN-039 G2), and **the instrument** — if no red anywhere in the sweep
carried a log, that is the PARSER, and it throws rather than reporting 22 subject findings.

**Rule 4 forced a real change: the runner no longer filters the suite to the target case.** A run
that cannot see the other cases cannot know it did not break them. Every bite now runs its whole file.

### The harness self-test

`run-mutations.mjs --self-test` — 9 cases, each one a bite the runner **must not** certify.
`[probe-must-bite]` applied to the instrument: a criterion nobody has watched reject is a criterion
on paper. It found a defect in itself immediately — the "a mutation that does not apply is refused"
case used a literal sentinel string, which therefore **appeared in the file it was mutating**, matched
once, and **rewrote the runner's own source**. The sentinel is now composed at runtime, and a second
case asserts the refusal path writes nothing.

### Re-running the 22 — one flipped

**`GEN-041 snapshot-is-the-membership`: 7 undeclared reds.** My mutation replaced the resident
predicate with `$2 IS NOT NULL`, admitting **every** resident — so it reddened the target and seven
bystanders. It showed the module breaking, not that guard failing. **Re-aimed** with `COALESCE`,
which leaves a seated resident's version exactly as it was and fabricates a seat only for someone
with none, so case 2 is the only case that can move. Proven, zero collateral.

**No other bite flipped.** 21 were unaffected by the stricter rules; the criterion caught exactly the
one mutation that was broader than its target.

---

## 3 — the stale generated file, and the check that ends the class

`apps/resident-portal/src/theme/severity-tokens.g.ts` regenerated 0.3.4 → **0.4.0**. One line changed
— only the stamp. Its `severity-tokens.test.ts` was red and is now green (62/62).

**New guard: `docs/governance/bin/contract-stamps-current.mjs`.** Every `*.g.ts` under `apps/*/src`
that carries a `*_CONTRACT_VERSION` stamp must match the contract it names. Subjects are **derived**
by walking the apps, and each file **names its own source** in its generated header — a hand-kept list
would have been kept by whoever forgot to regenerate, which is `[correlated-lists-certify-nothing]`
exactly. Files generated from a fixture directory rather than a contract are named in the output, so
the number covered is never mistaken for the number that exist. It **refuses when it covers zero**.

### A harness defect found while proving it — and fixed

The first bite (put the stale stamp back, expect red) **did not bite**, and the check was fine.
`with-mutation.sh` calls `rebuild_owner`, which runs the package's `build` — and a UI app's build is
`pnpm run generate && vite build`. **`generate` regenerated the file, undoing the mutation before the
check ran.** Any bite against a generated file silently no-ops and reports as though it had run.

Same family as the dist hazard, one level up: there a stale artifact outlived the restore; here the
**source is regenerated out from under the mutation**. `with-mutation.sh` now compares the file's
checksum after the rebuild and **refuses (exit 3)** if the mutation is gone, naming why.

The bite was then **re-aimed at the correct subject — the contract**. Moving `severity.json` to 0.5.0
reds the check naming **both** consumers, which is precisely the GEN-042 failure it exists to prevent.

---

## 4 — G2: the app suites, gated

`docs/governance/bin/app-suites.sh`, wired into `prove.sh` (and so into the pre-push hook and CI).

| app | suite | result |
|---|---|---|
| management-web | `test:node` | **113 passed, 3 skipped, 0 failed** |
| resident-portal | `test:node` | **62 passed, 0 skipped, 0 failed** |

Apps are **derived** from `apps/*/package.json` declaring `test:node`, so a new app is gated the day
it acquires a suite. Each app is **built first** — the artefact tests assert on the production bundle,
and running them without a build reports failures that are nothing but a missing `dist/`. The gate
**refuses a run that produced no result line** (silence is not a pass) and **refuses when it covers
zero apps** (it covered zero for the whole time both suites were red).

**Bite:** a deliberately failing UI test (`peer.size >= 99999`) → `FAIL resident-portal 1 failing`,
naming the case; removed → green. Both arms shown.

### THE apps/** SUITE INVENTORY — and a third ungated suite

| app | suite | gated by |
|---|---|---|
| api | `test:contract`, `test:integration` | CI, via the `test` aggregate (`pnpm --filter @pemo/api test`) — **not** the hook |
| management-web | `test:node` | **prove.sh + hook + CI** (new) |
| management-web | `test:browser` | **CI** (new job, below) |
| resident-portal | `test:node` | **prove.sh + hook + CI** (new) |
| resident-portal | `test:browser` | **CI** (new job, below) |
| **resident-mobile** | **8 `*_test.dart`** | **NOTHING — not the hook, not CI** |

**`apps/resident-mobile` is the third ungated suite.** It is Flutter, has no `package.json`, and was
therefore invisible to a gate keyed on one — invisible being the exact state that let the other two
rot. **I cannot tell you whether it is green: Flutter is not on this machine's PATH, so I did not run
it and I am not asserting its state.** The gate now **names it** rather than skipping it, so it is
listed-as-not-run instead of silent. Gating it needs a Flutter toolchain in CI — **a ruling, not a
guess.**

I also added a CI job **"the app browser suites"** (Playwright, derived from the apps declaring
`test:browser`), because `app-suites.sh` prints "CI job: the app browser suites" and that note is only
honest if somebody runs them. **I cannot execute CI from here, so that job is written but unverified**
— stated plainly rather than reported as passing.

---

## 5 — G7: the register can now say what happened

- `STATUSES` → `draft | running | done | merged | **superseded**`; `CLOSED_STATUSES` gains it too.
- New optional key **`ruling:`** — names a PID's filed `-RULINGS-` report **explicitly**. Every other
  report is derived from the `<ID>-` prefix, which is right except for one case: a PID whose ruling was
  filed under **another PID's number**. It is a cross-reference, not a return of the deleted `reports:`
  glob — that key listed what could be derived and drifted; this names the one thing that cannot be,
  and is **verified against the directory** (the file must exist and carry `-RULINGS-`).
- **UI-004 → `superseded`**, with `ruling: UI-045-RULINGS-step1-notices-part1.md`. Its report list now
  includes that file; a prefix scan could never have seen it.

**This edits a Rule-7 record, which is normally immutable.** Done on the PO's explicit instruction.
The UI track's paragraph explaining why it wrote `done` is **kept, not rewritten** — it is the account
of how the gap was found.

**Bites:** a declared ruling that does not exist → fault 6; a declared file that is not a `-RULINGS-`
→ fault 6; a status outside the enum → fault 2. All three fire.

**A defect the third bite found:** the close-date message still read *"only done|merged may carry a
close date"* while the check itself accepted `superseded` — a hardcoded string drifting from the enum
beside it. Now derived from `CLOSED_STATUSES`.

---

## Gaps — the complete list

1. **`apps/resident-mobile`'s 8 Flutter tests are gated by nothing, and their state is UNKNOWN to me**
   (no Flutter on PATH). Named by the gate; gating needs a CI toolchain decision.
2. **The CI browser job is unverified** — written, never executed, because I cannot run CI here.
3. **~36 recorded bites remain prose** in four classes (DDL/grants, shell guards, HTTP adapters,
   boundary scans) — already owed to the next governance PID after GEN-047.
4. The triage floor is proven to exist, **not** proven to be covering (no multi-node ticket) — owed.
5. The resident projection boundary is held by its **test**, not its type — owed.
6. `apps/api`'s suites are gated by CI but **not** by the pre-push hook (they need a database).
7. `destructive-target-confirmed` Section 0 still unsupplied.
8. Items 2, 3 and 5 of the dispatch are not in any filed ruling (see §0).

---

## 6 — merge

Standard: refspec push from the worktree, `main` **never checked out** (branch stayed `rewrite`),
through the hook, **no `--no-verify`**, `[GEN-046]` tagged.

| | |
|---|---|
| `origin/main` before | `2f5e733` |
| `origin/main` after (**re-read via `git ls-remote`**, not the push output) | `fe1c1f0` |
| tree hash, remote | `c261eeae5f8a3be48ed827984b39ba6485734539` |
| tree hash, local | `c261eeae5f8a3be48ed827984b39ba6485734539` |
| verdict | **EQUAL — the merge is what I built** |

**Rule 7 close:** `pids/GEN-046.md` → `archive/GEN-046.md`, `status: merged`,
`closed: 2026-09-03` (from `date`), `ruling: GEN-046-RULINGS-step2-harness-trust-and-g2-cycle.md`
carried into `reports/`. The closed row:

```
| GEN-046 | GEN | v1.0 | merged | 2026-09-03 | governance: harness trust, the UI gate, the allocation rule | reports/GEN-046-RULINGS-step2-harness-trust-and-g2-cycle.md, reports/GEN-046-step2.md, reports/GEN-046-step3.md |
```

### The first push was REFUSED, and the refusal was a real defect

Archiving GEN-046 emptied `pids/` — it was the last in-flight PID — and the battery **aborted**:

> `ABORT: pids/ holds no PID file to mutate; the battery cannot run.`

Its own comment stated the premise: *"An in-flight PID always exists; if one does not, say so and
stop."* **That premise is false exactly when the last PID closes, and the way it fails is a
DEADLOCK** — no victim, so the battery aborts; the battery aborts, so the gate refuses; the gate
refuses, so the close can never be pushed. The only exit is the `--no-verify` the protocol forbids.
It would have fired for whichever PID happened to close last, and GEN-046 closing itself is simply
when the corpus first reached that state.

**Fixed by synthesis, not by exemption.** When `pids/` is empty, an in-flight victim is derived from
the newest archived PID (status flipped to `draft`, close keys dropped) under the number the
generator would allocate next; it lives in the snapshot as well as the tree, because `restore()`
wipes `pids/` after every case; the index is regenerated around it so *clean register* tests the
register and not the scaffolding; and file and index entry are both removed on the way out. The
tree is left byte-identical. Nothing is named, so the derivation survives.

**An archive/ fallback was tried first and measured wrong** rather than assumed wrong:
`m_dup_location` copies the victim INTO `archive/`, a no-op when it is already there, and
`m_ignored_pid` needs a status that belongs in `pids/`. Both reported a different fault than the one
they exist to prove — `[a-check-fails-for-its-own-rules-reason]`, in the battery's own cases.

The synthesis path is **exercised by ordinary operation**: `pids/` is empty right now, so the run
that gated this very push used it (`synthesised UI-047 from UI-045`).
