# GEN-046 step 2 — governance: harness trust, UI gate, allocation rule, principles

**Date:** 2026-09-02  **Pin:** `a936249` (the allocation commit, landed on `main` first, under G3's own rule)
**Battery:** 31 passed, 0 failed.  **Mutation manifest:** 22 proven, 0 failed, 0 skipped.
**Status: G1, G3, G4, G5, G6 complete. G2 BLOCKED — a live cross-track breakage whose remedy is outside my write scope.**

---

## G1 — the retroactive mutation sweep

### The measurement that came first, and is itself the finding

The dispatch pre-declared it: *"a bite that cannot be re-run is a claim."* Measured at the pin:

| | |
|---|---|
| scripts or tests referencing `with-mutation.sh` | **0** |
| reports mentioning a mutation in prose | 76 |

**Not one bite in this repository was an artifact.** Every guard "proven" since GEN-036 was proven in
an interactive shell and written up. So when GEN-044 found five bites that had never run, there was no
way to ask the same question of the rest — which is exactly why the ruling ordered the sweep.

The sweep therefore had to build its subject before it could run. `docs/governance/mutations/manifest.json`
records each bite as **subject, from, to, and THE CASE THAT MUST GO RED**; `docs/governance/bin/run-mutations.sh`
executes them under the fixed criterion and refuses to call anything proven on an exit status.

### The criterion, enforced in three separate judgements

A non-zero exit is not a red. The runner requires, and reports separately:

1. the mutation **applied** (`with-mutation.sh` exits 3 if its `<from>` is absent — the subject moved);
2. the suite **ran** (its log exists and is non-empty — this is the condition GEN-044's five false bites failed);
3. the **named case** is the failure (not a neighbour, not a build error).

Where the guard is the type system, the named failure is a **diagnostic code** rather than a case
(`kind: "compile"`). The rule is unchanged: name the failure, and require it.

### Result — 22 bites, re-runnable, all proven

Baselines were taken first (GEN-039's lesson: a red proves nothing if the case was already failing):
notice-acts 16/16, notice-acknowledgement 11/11, case-acts 15/15, notice-reads 7/7,
authority-precondition 2/2, validator-codes 3/3 — all green unmutated.

| PID | bites now re-runnable | prior verdict | new verdict |
|---|---|---|---|
| GEN-035 | 1 — the ADR-018 brand cannot be forged | prose | **proven** |
| GEN-036 | 1 — refusal kinds exhaustive (compile, TS2322) | prose | **proven** |
| GEN-040 | 5 — conjunction, fail-closed policy, empty audience, no retarget, publish lock | prose | **proven** |
| GEN-041 | 4 — snapshot is the membership, acting as oneself, declared options, state gate | prose | **proven** |
| GEN-042 | 4 — R1 snapshot, state filter, projection boundary, read INTERSECTS | prose | **proven** |
| GEN-044 | 6 — location serves my unit, unit is mine, anonymous fail-closed, triage floor, atomicity, one primary Case | prose (five flagged FALSE by GEN-044) | **proven** |
| GEN-046 | 1 — the validator-code grammar has one source | new | **proven** |

Two entries failed on the first pass. **Neither was a subject finding, and both were diagnosed rather
than re-run** — the ruling's own standard: *a stop condition names the DIAGNOSED CAUSE, not the symptom.*

**(a) `resident-projection-boundary` — my classification was wrong, not the subject.**
I filed it as a compile bite, assuming the resident item type rejects a governance field. It compiled
cleanly: TypeScript's excess-property check does not fire through the `rows.map(...)`. Reclassified as
a runtime bite, it reds case 8 correctly. **Worth recording: the resident projection boundary is held by
its test alone, not by the type.** The test's own comment already said so ("ASSERTED ON THE EMITTED
OBJECT, not on the query"); I had read the guarantee as stronger than it is.

**(b) `triage-floor-is-covering` — a finding about the RECORDED BITE.**
GEN-044 recorded case 4's mutation as *"any-node floor"*. A ticket addresses **exactly one node**, so
over that data `uncovered.length === 0` and `uncovered.length < addressed.length` are **the same
predicate** — the recorded mutation could never have red for this guard's reason, whatever the harness
did with it. Replaced with one that drops the floor outright; case 4 then reds. The guard is sound.

**Residual gap, disclosed:** that bite now proves the triage floor **exists**. It does **not** prove it
is *covering* rather than *intersecting*, because no test triages a ticket addressing more than one
node. GEN-040 case 2 proves the conjunction for notices; for tickets the distinction is untested.

### Coverage — what is now an artifact, and what is still prose

22 bites are re-runnable. Counting mutation-describing rows across the step-2 acceptance tables gives
**58 rows** — a heuristic over table rows, not a census (it misses GEN-036's prose-only bites and
misreads GEN-043's differently-headed table), so read it as scale. The remainder fall into classes
`with-mutation.sh` **cannot express**, and each needs its own mechanism:

| class | examples | why the file-mutation harness cannot express it |
|---|---|---|
| **DDL / grants** | GEN-037 drop `UNIQUE(notice_id, version)`, grant UPDATE to `pemo_app`; GEN-038 the supersession and visibility drops, the revoke | the subject is the **database**, not a file; needs a scratch-database harness |
| **shell guards** | GEN-036 `like-escape` A1/A2, `fixtures-idempotent`; GEN-039 G3 | the red is a guard's **exit and message**, not a node test case — needs a `kind: "guard"` |
| **HTTP adapters** | GEN-043's six route bites | subjects are route handlers reached over HTTP; expressible, not yet expressed |
| **boundary scans** | GEN-037 case 6, GEN-038 5b | the expected failure is a dependency-cruiser violation |

**I am not reporting these as proven.** They were proven once, in prose, under the old criterion.

**G1's stop condition did NOT fire:** no bite passed with its guard mutated.

---

## G2 — BLOCKED, and the block is a finding

Gating the management-web suite required measuring it first. **It is red, and I caused it.**

```
101 tests, 79 pass, 19 fail — and `pnpm build` fails outright
```

Of the 19, nine are artefact tests that need a production bundle that does not exist. The build that
would produce it dies at the UI track's **corpus source guard**:

> `mob-s5-notices/detail.json` no longer carries supervisor-approval at "pending" on an
> awaiting-approval notice. **That fixture is evidence, not decoration.**

**Traced, not inferred.** `git log` names **GEN-043 (mine)** as the last commit to touch that fixture,
and **GEN-042 (mine)** as the last to touch `severity.json`. Two distinct breakages:

1. **The S5 reshape dropped load-bearing evidence.** My MAJOR reshape to `contractVersion 2.0.0`
   replaced `notice.state` with `notice.lifecycleState` and removed `notice.approval.steps`
   altogether. The guard's own comment says that fixture is *"the most concrete argument the project
   has for deciding the role list"* — it exists to stop precisely what I did.
2. **Two generated token files are stale.** I bumped resident-mobile 0.3.4 → 0.4.0; both
   `apps/management-web/src/theme/severity-tokens.g.ts` and
   `apps/resident-portal/src/theme/severity-tokens.g.ts` still declare `"0.3.4"`.

**Why nothing caught it: the suite is not gated — which is what G2 was dispatched to fix.** G2's own
measurement found the breakage G2 exists to prevent. This is GEN-042's close ruling — *"a placeholder
contract with fixtures is a promise"* — arriving from the other direction.

**Why I stopped rather than fixed it.** The pre-push hook runs `prove.sh`, so a gate I know to be red
blocks **every** push, and `--no-verify` is forbidden. Making it green requires writing inside
`apps/management-web/**`, which the PO ruling of 2026-09-02 puts outside my write scope. **I will not
land a gate I cannot make green, weaken it on my own authority, or reach into the other track.**

I ran `pnpm build` once during measurement; it regenerated `severity-tokens.g.ts`. **I reverted it —
`git status` on `apps/management-web` and `apps/resident-portal` is clean.** No UI-track file is
modified by this PID.

**Ruling needed.** The remedy spans both tracks: the fixture is mine, the guard and the generated
files are the UI track's. Either the S5 stuck-approval evidence is restored **in the 2.0.0 shape**
(and the guard updated to read `lifecycleState` / the new approval shape), or the guard is retired
on the Brain's authority — a decision about evidence, not about code.

---

## G3 — the parallel-allocation rule

Written into `00-START-HERE.md` rule 1: fetch before `--next`; **land the allocation first as its own
two-file commit** so it is a fact on `main` rather than an intention in one worktree; on a rejected
allocation push, rebase and **regenerate** `PID-INDEX.md` rather than hand-merging a generated file
(GEN-044 vs UI-045); never renumber a PID that has landed.

Also recorded, because GEN-046's own allocation was refused for it: **a PID file may not bracket-cite
a principle that PID defines.** The gate resolves every bracketed id, and a proposed principle has
nothing to resolve against, so the refusal is correct. Backticks in the PID; the bracketed citation
becomes legitimate in the commit that adds the definition.

**GEN-046 was allocated under this rule** — allocation commit `a936249` on `main` before any work.

---

## G4 — the principles (I wrote three, not two)

68 → **71** (computed from the file, not tallied). The dispatch named two; the third is the ruling's own
sentence, and separating it from the first keeps two distinct failures distinct:

- `[a-bite-is-a-named-red]` — a bite is proven by a named red, never a non-zero exit. Carries GEN-044's
  five false bites and the `${2:+...}` filter that split on a space.
- `[a-bite-that-cannot-be-rerun-is-a-claim]` — **the deviation.** A bite in prose proves the guard bit
  *that afternoon, against that tree*. Distinguished from the first by what is missing: there the
  verdict was wrong; here there is no verdict to check. G1 measured 0 re-runnable bites across nine
  PIDs, which is a different defect from a wrong verdict and needed its own name.
- `[guard-remedies-are-non-destructive]` — a guard's prescribed remedy may never destroy the work that
  tripped it. GEN-044's pre-flight prescribed *"restore it from origin/main"*, which would have
  discarded the entire PID. `[destructive-target-confirmed]` pointed at the guards themselves.

---

## G5 — one declared source for the validator-code grammar

The class `[a-z0-9][a-z0-9.-]*` was written out in **three** places: `validator-codes.test.ts` and
`adrs-present.sh` **twice**. That is the GEN-043 blind spot — all three said `[a-z0-9-]*`, all three
lost `openapi-3.1` to the dot, and **all three agreed**, which is what made it invisible.

Now declared once as `VALIDATOR_CODE_PATTERN` in `tests/fixtures/validator-codes.mjs`. The TS consumer
builds its RegExp from it; the shell consumer reads it via `node -e` and builds its `sed` pattern.
**No fallback**: a default in the shell would be a second copy of the grammar and would let the check
pass with the declaration deleted, so it refuses instead.

**Proven by making both fail:**

| bite | fired |
|---|---|
| delete the declaration | `adrs-present` refuses **by name** and will not guess |
| narrow it to `[a-z0-9-]*` (the GEN-043 bug) | `✖ every declared code is used by a call site` |

It used to take three edits in three files to cause that defect, and none to notice. It now takes one
character to cause, and one test to catch.

---

## G6 — the ADR-020 corollary

`rewrite/adr/ADR-020-corollary-resident-authority.md` carried to `docs/adr/` (38 lines, verbatim).
ADR-020 now points at it, retaining its own text as the corollary's header directs, and names
`modules/helpdesk/src/intake/reportable-set.ts` as the implementation. `adrs-present` resolves it as an
ADR-020-owned document (its heading is "Corollary", not "AMENDMENT", so the amendment count is unchanged).

---

## Gaps — the complete list

1. **G2 is not done.** The gate is not written; the suite is red for two breakages I caused; the remedy
   is outside my write scope.
2. **36-ish recorded bites remain prose**, in the four classes tabulated above. They were proven once
   under the old criterion; I do not report them as proven now.
3. **The triage floor is proven to exist, not proven to be covering** — no multi-node ticket is tested.
4. **The resident projection boundary is a runtime guarantee, not a type-level one.**
5. **`apps/resident-portal` is also stale** at severity 0.3.4 and was never in scope for the G2 gate;
   its suite is unmeasured by this PID.
6. The bite-count denominator (58) is a heuristic over report tables, not a census.
7. `destructive-target-confirmed` Section 0 remains unsupplied (carried from GEN-035).

**HARD STOP for the close ruling** — and for G2's cross-track ruling, without which G2 cannot proceed.
