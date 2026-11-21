# GEN-022 (C2 — D, the merge-gate hook) — Step 2 rulings + close. Closes C2.

Date: 2026-08-31
Report: rewrite/reports/GEN-022-step2.md — HARD STOP before commit, main 70d8ae60 (allocation only), 6 files uncommitted.

## Verdict: MERGES. This is the last C2 batch — C2 is complete on merge. Two open items handed to the PO.

---

## R1 — GEN-022 APPROVED. The worktree pre-check cleared it; the GIT_DIR blocker was caught fail-safe.

Pre-check clean (`.git` pointer; hook fires; cwd = worktree toplevel so relative `.githooks`
resolves to the worktree's own copy; `core.hooksPath` in shared config → one opt-in covers all linked
worktrees). The unanticipated blocker — git injecting `GIT_DIR` et al into every hook, so two "the
generator has no repository" cases found one anyway (21/2 in-hook vs 23/0 standalone) — fixed with
`env -u` (not `unset`, so the hook's own git still works). Proven by firing: broken register →
refused, intact → allowed, `--no-verify` bypasses (demonstrated), all three opt-in branches taken;
fast. Close per Rule 7.

## R2 — The GIT_DIR find → a new principle (owed to PID-PRINCIPLES).

`[context-inherited-env]` (working title): **a check that runs in more than one context (git hook,
CI, standalone) must be proven in the context that gates — an inherited environment (`GIT_DIR`, `CI`,
…) can make it find what it must not or miss what it must catch.** The mis-report here was fail-safe
(toward failure, recoverable); a spurious pass would have shipped a gate gating less than it claimed.
Add to `PID-PRINCIPLES.md` at the next principle-touching change (with the `[probe-must-bite]` /
`[assert-the-isolation-level]` family). Owed, not this PID.

## R3 — The ungated stale main checkout (`9f4756b`, no `.githooks`): recorded, no code fix.

Correct not to "fix" it. The hook is per-checkout and per-opt-in by nature; a checkout with no
`.githooks` has no hook to run, and nothing inside it can detect that. This is precisely the
habit-not-guarantee framing landing: **CI is the guarantee and gates regardless of which checkout
pushed**, so the stale checkout loses only the local early-catch, not the guarantee. Actions:
- **Document in setup**: every working checkout must sit on a commit carrying `.githooks` and must
  opt in (`core.hooksPath`); any checkout that hasn't is covered only by CI.
- **Owed (optional, not blocking):** a doctor/setup script that warns when the current checkout lacks
  `.githooks` or the opt-in — external detection, since in-checkout detection is impossible.

## R4 — The reflexive `--no-verify` on the allocation push: acknowledged.

Harmless (the gate was green anyway) and self-flagged — good discipline. The **deliverable push must
NOT use `--no-verify`**; going through the hook unflagged is the only demonstration that counts.

## R5 — CI unconfirmed (GEN-022's first run + GEN-021's after-merge): PO to check. Not a blocker.

`gh` is absent from the session, so neither run can be seen from here, and reporting an unseen green
was correctly refused. **Open item handed to the PO:** check that GEN-021's premise-arm-guard step and
GEN-022's hook opt-in SKIP behave green in a real CI run; a red is a finding. The local proof stands
and CI runs regardless, so D closes on the local evidence.

## Close instruction
Merge (standard gate, `[GEN-022]` tag, push gated on `--check` + battery — **through the hook,
no `--no-verify`**). Rule 7 close → archive/ with row, `status: merged`, **`closed: <today's actual
date — check `date`>`** (do not carry a value from this instruction; the recurring one-day drift is
mine — stamp the real date). Artifacts carried (spec, step2 report + this ruling). Confirm the E
date-fix (GEN-021 → 2026-08-31) rode a commit; if it did not, carry it here.

## C2 IS COMPLETE on this merge.
Batches: [C+F] GEN-018 · [A] GEN-019 · [B] GEN-020 · [E] GEN-021 · [D] GEN-022. Governance hardening
done.

## Open items to the PO (post-C2)
1. Check the two CI runs (R5).
2. The ungated stale main checkout (R3) — an operational note, not a defect.

## Owed ledger (now the active frontier)
- `[context-inherited-env]` principle → PID-PRINCIPLES (next principle-touching change).
- citation-vs-mention syntax redesign (+trigger); batch-B owed guards (clearSeedBlockers
  re-population; teardown-prefix standing check); ADR-003 AM1–AM5 unaccepted; doctor-script for the
  stale-checkout case.
- **Owed DECISIONS (brain, next): idempotency request-token; audit-spine act-reason.**
- **The PO fork: schema-origination (notices/cases) vs WEB-15 grant administration** — I lay it out
  once D is closed.
