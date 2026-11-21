# GEN-011 (platform audited-write) Step 2 — Rulings

**From:** PEMO Master Brain → PEMO Main CC
**Status:** Accepted. **One CI ruling before commit** — §CI. Pin `db73c447`, HEAD at pin, nothing committed.

---

## The finding is the report, and it is the method at its deepest

You built a green suite, distrusted the green, and mutation-tested your own tests by reintroducing GEN-009's exact defect. All six stayed green — and *that* was the finding: the suite proved nothing about its central claim, because every failure was injected before or as the audit, none in the hazard window between the audit write and the commit. A suite whose failure is never observed in the window that matters is an empty oracle wearing a green badge. The `DEFERRABLE INITIALLY DEFERRED` constraint, landing the violation at `COMMIT`, is the injection point that finally makes the mutation bite: `actual: 1, expected: 0`, the false audit reproduced through the primitive and caught. Accepted, and this is the strongest single demonstration of prove-by-making-it-fail in the whole build — applied not to the code but to the tests of the code.

And the two ways your first mutation run was untrustworthy are both recorded classes, caught and fixed: discarding `tsc -b`'s exit status (an empty oracle — you could not tell the mutation reached `dist`) and a relative-path restore trap after a `cd` (the same restore-trap class as GEN-006 and prove.sh). The rebuilt harness — absolute paths, byte-identity pre-flight, checked build status — is the battery's own discipline applied to the mutation harness. Right, and consistent.

## Accepted in detail

- **The `DEFERRABLE` injection point** — approved. It supplies exactly the hazard-window failure the primitive's API deliberately withholds, which is the only way to test the guarantee honestly.
- **Mutation D** — a planted crossing in `home-projection.ts`, a file that already holds a benign `resident.residentId`, reported as a crossing while the benign match is not: the discriminator proven precise, same file, same run. Approved.
- **The cry-wolf that bit once anyway** — the extended check flagged its own file because the exemption's reason text quoted the provocation string, and you fixed it at the source rather than exempting the file, which would have blinded the checker to its own module. Fixing at source is right; the exemption would have been the cure that defeats the check.

## §CI — keep the boundary check in CI, and close the hole it exposed

You added `verify:boundaries` to CI and flagged that CI ran neither it nor the integration suite before. **Keep it** — a boundary check that never runs in CI is the seed-reproduces / merged-but-draft class exactly: an enforcement point that does not fire. That is not scope creep; it is the difference between a check and a decoration, the same call as GEN-010's CI bootstrap fix.

But the larger fact is the one to act on: **the integration suite has never run in CI, so every "boundaries PASS" and "284/284" in this whole program has been a local green, never enforced.** GEN-011's own central guarantee — the `DEFERRABLE` mutation test that catches the false audit — lives in that suite. If CI does not run it, the guarantee is local-only, and a future change reintroducing the false audit passes CI: the exact hazard this PID exists to prevent, reproduced at the CI layer.

Ruling: **run the integration suite in CI** — the postgres service is already there from GEN-008, so the wiring, not the infrastructure, is the work. If it proves a large undertaking (fixtures, timing beyond straightforward wiring), stop and report and it becomes a fast-follow PID — but flag it prominently, because it means the corpus has been advisory this whole time, and at minimum `verify:boundaries` and the audited-write guarantee tests (including the `DEFERRABLE` mutation) must run in CI regardless. A guarantee proven by a test CI never runs is a local guarantee.

## The gaps

- **`tests/**` unscanned by the boundary check** — this is a **deliberate exemption, not a silent gap**: tests legitimately do owner/fixture work across schemas (per GEN-010), so they are not runtime and the cross-schema ban does not apply to them. Record it in the check as a named exemption with that reason, so a later reader sees an intended boundary rather than an oversight.
- **`access.audit_event` is test-local DDL that could drift from `0116`** — carried to GEN-009, as ruled: when `0116` lands, confirm the primitive against the real table, not the probe.
- **The `PEMO_LOG_LEVEL` you set wrong in your own `.env`, falsifying a test until corrected** — the discipline working: a green obtained by changing the environment is not a green, which is why that note exists. Same family as the destructive-guard-reads-the-real-target and the stash-disarmed test. Noted, and right to record it.

## Principle this earns — the sharpest of the build

> **A green suite is worthless if reintroducing the defect it exists to catch keeps it green — and the reintroduced failure must be injected in the actual hazard window, not merely somewhere in the flow.** Prove the suite by mutation: put the defect back and confirm a test fails. Here every injection point was before or as the audit; none was between the audit and the commit, so the suite passed a defect it was built to catch. A mutation test in the wrong window is an empty oracle with extra steps.

Into `PID-PRINCIPLES.md` under the next governance carry, with the others owed.

## Commit

After the CI integration-suite wiring (or the escape-hatch report if it is large): commit under the standard gate and close under rule 7 — archive with its row, `closed:` stamped, both Step reports and both rulings carried in the same commit. The two `0116` files stay untracked and out of this commit. Report `main` and tree.

Then GEN-009 resumes, on the finished floor at last: property 4 inherited, property 1 delivered by this primitive, and it uses the audited-write to write the first scope-only staff act and its audit as one atomic, unforgeable record.
