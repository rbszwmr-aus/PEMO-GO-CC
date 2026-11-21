# GEN-019 — Step 1: batch A, assessment

**Status:** assessed. **Nothing built.** HARD STOP.
**The finding that shapes the design:** **every principle citation in the repository is either inside `PID-PRINCIPLES.md` itself or inside a Rule-7 record.** If the principle check inherits `GEN-017`'s Rule-7 exclusion it has **zero** citations to examine and passes vacuously — an empty oracle in the check built to close the citation gap. §4 proposes a deliberate asymmetry, with the reason it is safe here and was not for ADRs.

---

## 1. Pin and allocation

| | |
|---|---|
| **Pin** | `ba7de991353311a396842cdc759ad0dbc6522354`, re-read from the remote and equal to HEAD, tree `56980438…`, 854 files |
| **Number** | **019**; next is 020 |
| **`main` now** | `5f8475d2a2cf522754e8f792a3d62a7613d5b150` — the allocation |

## 2. `AM4`'s canonical source — found, and it comes with an instruction

**Not in the repository.** It lives at `Prompt/specs/ADR-003-AMENDMENT-public-facility-nesting-and-location-identity.md` on the Drive — 8,147 bytes, `Status: Proposed by PEMO Master Brain. Decision owner: Product Owner`, dated 2026-08-18. **I have it and will copy, not re-author.**

**Three things it tells us that change the shape of the work:**

1. **It carries its own carry-in instruction**, and it is the fold form:
   > *"append to the repository copy `docs/adr/ADR-003-location-and-facility-taxonomy.md` as its next amendment letter — **verify the letter in the repo copy; do not assert it here.** Repository copy is authoritative."*

   So `AM4` is **folded into `ADR-003`**, matching the `ADR-008`/`ADR-007` precedent, not given its own file. That is consistent with C1's rule — it amends one ADR.

2. **The letter is verified, and it verifies clean.** The repo's `ADR-003` carries **no amendment section and no `AM` letters at all**, so the source's own numbering is genuinely next and carries unchanged. That is the check the note asked for, done.

3. **It is not one amendment, it is five.** The document defines **`AM1`–`AM5`**, not `AM4` alone. `PID-PRINCIPLES` cites only `AM4`, but folding the document brings all five, and folding *only* `AM4` would mean re-authoring a decision — which the instruction forbids and which would leave four decisions stranded outside the repository. **I propose folding all five verbatim**; if you want `AM4` alone, that is a ruling, and it would need its own justification.

**One status wrinkle to flag:** the source is `Proposed`, and `AM3` is explicitly *"provisional, pending PO confirmation."* Carrying it in means the repository holds a `Proposed` amendment. I would carry the status verbatim rather than reconcile it — reconciling a status is what `GEN-017` did where an acceptance record existed, and here there is none.

## 3. The checker's structure, and where the three extensions attach

`docs/governance/bin/adrs-present.sh` is four steps:

| step | line | how each extension attaches |
|---|---|---|
| **derive** the referenced set by grep | 43–47 | a second pattern for `ADR-NNN AM<n>`/`A<n>`; a third for `` `[slug]` `` |
| **guard** against a vacuous scan | 50 | one per reference kind, or the empty case passes silently |
| **resolve** each id by self-declaration | 68 | `^# ${id}[[:space:]]+—` becomes one resolver per kind |
| **report** the offenders and their referrers | 70–84 | unchanged shape, three groups |

**It is extended, not forked** — one script, one exclusion list, one report format. A second script would be a second exclusion policy to keep in step, which is the two-homes defect.

## 4. Discrimination risks — three, and the third is the one that matters

**(a) Amendment letters are declared in three different forms today.**

| where | form |
|---|---|
| `ADR-007`, folded | `## A1 — …` |
| `ADR-010-AMENDMENT`, separate file | `### A1 — …` |
| `AM4`'s source | `**AM1 — …**` (bold, not a heading) |

A resolver keyed on one form reds on the others. I propose accepting **heading or bold-lead, at any depth**, and — on fold — normalising `AM1`–`AM5` to `## AM1 — …` so `ADR-003` matches `ADR-007`'s shape. **This is C1's folded-vs-separate risk one level down, and it is why the resolver must be written against all three real examples before it is trusted.**

**(b) The `A<n>` namespace is per-ADR, not global.** `ADR-007 A4` and `ADR-010 A4` and `ADR-011 A4` are three different amendments. The resolver must scope the letter to its owning ADR — `ADR-007 A4` resolves in `ADR-007`'s file *or* an `ADR-007-AMENDMENT-*` file, never in `ADR-010`'s.

**(c) The principle check would be vacuous under the inherited exclusion — the one that shapes the design.**

Measured: backticked `` `[slug]` `` citations exist in exactly four files — `PID-PRINCIPLES.md` and three `GEN-018` reports. **Outside `PID-PRINCIPLES` and outside `reports/`+`archive/`: none.** So with `GEN-017`'s exclusion applied, the check examines nothing.

**I propose the principle check does NOT exclude Rule-7 records, and that this asymmetry with the ADR check is deliberate and stated.** The reason the ADR check excludes them does not hold here:

- an **ADR** can legitimately be withdrawn, so a closed report naming it would red forever — hence the exclusion;
- a **principle id is permanent and never reused** by the `F` scheme `GEN-018` just wrote. A dangling principle citation therefore does not mean "the record is old", it means **someone broke the permanence rule** — which is exactly the defect worth catching.

The cost, stated: if a principle is ever genuinely removed, every report citing it reds until the removal is reconciled. I regard that as the check working, not failing — but it is a real consequence and it is your call.

**Citation syntax:** backticked `` `[slug]` ``, never bare `[slug]`. Bare brackets collide with markdown links; the backticked form is what `PID-PRINCIPLES` already uses and cannot be confused with one. (Measured: zero bare-bracket link collisions today, but the syntax should be closed by construction rather than by luck.)

## 5. The reds I will fire

**AM4**
1. `AM4` present in `ADR-003`, and `PID-PRINCIPLES`'s reference to it resolves.

**Amendment granularity — the three cases you named, plus the namespace one**
2. reference to `ADR-003 AM9` (nonexistent) → **red**, naming `PID-PRINCIPLES.md`.
3. `ADR-007` `A2`–`A6`, folded → **green** — the case a too-strict resolver breaks.
4. `ADR-010` `A1`–`A4`, separate file → **green** — the case a too-loose filename resolver would also pass for the wrong reason.
5. delete `ADR-007`'s `## A5` heading → **red**, proving 3 is not green by accident.
6. reference `ADR-010 A6` (exists as `ADR-007 A6`, not as `ADR-010`'s) → **red**, proving the namespace is scoped per ADR.

**Principle citations**
7. cite `` `[no-such-principle]` `` from a live file → **red**.
8. cite `` `[frozen-axis]` `` → **green**.
9. delete a principle that a report cites → **red**, which is the permanence rule enforcing itself.

**Rule-7 exclusion, proven not assumed**
10. plant a reference to `ADR-099` **inside `docs/governance/reports/`** → the ADR arm stays **green**, and the same reference outside reports reds. That is the exclusion demonstrated in both directions rather than trusted.

**Vacuity**
11. each arm fails loudly if its scan matches nothing, and I will prove that by pointing an arm at an empty set.

## 6. Gaps

1. **I have not read `AM1`–`AM5` in full** — only their lead sentences. A conflict with the repo's `ADR-003` body would be a finding at Step 2, not a copy.
2. **`AM3` is provisional**, and carrying it in puts a provisional decision in the repository. Flagged, not resolved.
3. **The `A<n>` grep may over-match prose** — "A4 paper", "Section A1". I will anchor on the `ADR-NNN`-adjacent form only, and report the match count before trusting it.
4. **Nothing checks that a `Target location` header matches where the file actually sits.** Adjacent, not in scope, not folded in.

## 7. Rulings sought

1. **§2** — fold all five (`AM1`–`AM5`) verbatim, or `AM4` alone?
2. **§2** — carry the `Proposed`/provisional status verbatim?
3. **§4c** — the principle check does **not** exclude Rule-7 records; confirm the asymmetry and its cost.
4. **§4a** — normalise the folded letters to `## AM<n> —` to match `ADR-007`'s shape?

**HARD STOP.**
