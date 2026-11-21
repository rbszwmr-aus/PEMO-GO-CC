# GEN-021 (C2 batch D+E) — Step 1 rulings

Date: 2026-08-30
Report: rewrite/reports/GEN-021-step1.md — HARD STOP, nothing built. main 4011b0fe, allocation 06ebe65a, next 022.

## Verdict: split on provability — E first (GEN-021, build now), D a new PID after. D's worktree unknown must be resolved before D builds.

---

## R1 — D resized: the CI backstop already exists. The framing is now exact.

CI has run `pid-index --check`, `verify:boundaries`, the battery and the suite since GEN-011 — so D's
post-push **guarantee already stands**, and what remains is only the local pre-push hook + the opt-in
check. This is the honest framing made concrete: **the hook is a local early-catch (a habit); CI is
the guarantee.** D is small and adds no guarantee — it adds an earlier, local warning.

## R2 — Split D from E on PROVABILITY: APPROVED. E first.

The axis is right and better than size. **E is fully provable locally** (flip reversible SUPERUSER on
a throwaway DB → `grants-complete.sh` reds → restore → green → delete the premise arm → the step
reds). **D's core cannot be proven until a real CI run** (its subject is a hook + a CI-context
discriminator), so bundling would merge a half whose key behaviour is unverified until after the
push. Land **E first**, fully proven; then **D**, whose first CI run is explicitly its experiment.

GEN-021 proceeds to Step 2 as **E** and closes as GEN-021; **D is a new PID.**

## R3 — The hook must describe itself as a habit, not a guarantee. REQUIRED.

`--no-verify` bypasses any hook and no repository can prevent it; the hook closes only the
**accidental** case (GEN-013's shell chain gating the push on the commit, not the generator). The
hook's own output/header must **say** it is a local early-catch, not a guarantee, and that CI is the
guarantee. "A gate described as a guarantee is worse than one described as a habit" — adopt it as the
hook's self-description. (Kin to `[expected-red-stops-being-read]`.)

## R4 — The env-var discriminator weakness: acknowledged, accepted, named in the hook.

There is no non-env discriminator (a CI checkout and a dev clone are both full clones with a pushable
origin — you checked). So a developer who exports `CI` silently skips the opt-in assertion. Accept it:
that is a **deliberate** act like `--no-verify`, D targets only the accidental case, and CI remains
the guarantee regardless. The hook/doc must **name** this limitation rather than imply completeness.

## R5 — The worktree `.git`-is-a-file unknown: RESOLVE before D builds. Could change the design.

You work in a linked worktree whose `.git` is a pointer file. How `core.hooksPath` and a `pre-push`
hook resolve in that topology is unconfirmed — and if the hook does not fire there, the design
changes (where the hook lives, how the opt-in is set). Make this the **first step of D's build**: a
brief confirmation of hook + `core.hooksPath` behaviour under a linked-worktree/`.git`-file setup; if
it does not fire in the topology the team actually uses, adapt before committing to the hook shape.
Report it; if it forces a design change, HARD STOP for my ruling.

## Dispatch now: GEN-021 Step 2 = E (premise-arm-guard), fully provable, HARD STOP before commit.
Flip reversible SUPERUSER (NOT ownership) as the pre-flight; `grants-complete.sh` reds; restore →
green; delete the premise arm → the step reds (it bites). Standard gate, `[GEN-021]` tag, manual
known-good gate (D not landed). Rule 7 close.

## Owed ledger
- D = new PID after E, with the worktree pre-check as its first build step and its first CI run as its
  experiment.
- (unchanged) batch B's owed guards; citation-vs-mention syntax redesign (+trigger); ADR-003 AM1–AM5
  unaccepted; after C2 → idempotency token + audit act-reason, then schema-vs-WEB-15.
