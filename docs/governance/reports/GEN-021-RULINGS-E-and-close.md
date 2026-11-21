# GEN-021 (C2 batch E — premise-arm-guard) — Step 2 rulings + close

Date: 2026-08-30
Report: rewrite/reports/GEN-021-step2-E.md — HARD STOP, nothing committed beyond allocation.

## Verdict: MERGES after one completion (extend to all reversible attributes, R2). D remains a separate PID.

---

## R1 — E APPROVED. The decisive red gives GEN-012's fix the oracle it lacked.

With the premise arm deleted, `grants-complete.sh` passed while `pemo_app` was a superuser — and the
guard catches it now, where deleting the arm used to still pass 22/22. That is the whole point: the
GEN-012 check had been green over a rewritable, erasable audit since GEN-010 and could not assert its
own fix stayed; it can now. The destructive-target guard runs **first**, pure config before any
network reach (proven by refusing a non-resolving hostname pre-network, not after a failed probe —
principle-43 ordering). Two pre-flights earn their place (not-already-flipped; subject-green-first),
and the post-flip confirm-the-flip-landed is `[probe-must-bite]` on the guard's own probe.
Reversible attribute only; ownership correctly excluded (GEN-012 measured it is not reversible —
restore drops grants and the MISSING arm reds for an unrelated reason). `REQUIRE_DB=1` makes an
absent database fatal, not a quiet skip. Correct throughout.

## R2 — Complete E before close: extend the guard to ALL FOUR reversible attributes.

The guard exercises only `rolsuper`, but the premise arm also asserts `createrole`, `createdb` and
`bypassrls` (all reversible) plus ownership (not). So deleting, say, the `bypassrls` assertion is
**not** caught — four-fifths of the reversible premise arm has no oracle. That is exactly the GEN-012
failure (an assertion silently losing its teeth), one attribute over, inside the very tool built to
prevent it. Guarding only `rolsuper` under-delivers E's purpose.

**Extend to `createrole`, `createdb`, `bypassrls` before close** — each with its own
flip → red → restore → green, and delete-that-arm → red. **Ownership stays out** (irreversible, per
R1). Small change, completes the job.

## R3 — The CI-experiment caveat: thin for E, confirm post-merge.

Unlike D, E is a script that runs the same locally and in CI (no hook/CI-discriminator), and you
already checked the CI env satisfies the target guard against the workflow's own database env block —
so E is essentially fully proven; the first real CI run is a confirmation, not an experiment. Merge;
confirm the first CI run green and report it; a surprise there is a finding.

## Close instruction
Extend to the three further reversible attributes (R2). Then merge (standard gate, `[GEN-021]` tag,
push gated on `--check` + battery — manual known-good gate; D not landed). Rule 7 close → archive/
with row, `status: merged`, `closed: 2026-08-30`, artifacts carried (spec, step1 report + ruling,
step2-E report + this ruling).

## Next: D (new PID) — the LAST C2 item.
First build step: confirm `core.hooksPath` + `pre-push` behaviour under a linked-worktree/`.git`-file
setup (R5 of the Step-1 ruling); if the hook does not fire there, adapt and HARD STOP. The hook
describes itself as a habit not a guarantee (R3), names the env-discriminator limitation (R4); CI is
the guarantee (already exists since GEN-011). D's first real CI run is its experiment.

## Owed ledger
- D = new PID (worktree pre-check first; CI run is its experiment).
- (unchanged) batch B's owed guards; citation-vs-mention syntax redesign (+trigger); ADR-003 AM1–AM5
  unaccepted; after C2 → idempotency token + audit act-reason, then schema-vs-WEB-15.
