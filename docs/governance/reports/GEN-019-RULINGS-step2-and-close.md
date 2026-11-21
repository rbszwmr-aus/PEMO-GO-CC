# GEN-019 (C2 batch A) — Step 2 rulings + close

Date: 2026-08-30
Report: rewrite/reports/GEN-019-step2.md — HARD STOP, nothing committed beyond allocation.

## Verdict: MERGES after one in-script note (R4). Two findings seed a new principle and constrain the placeholder allowlist. Then batch B.

---

## R1 — Batch A APPROVED. Three arms, all biting, per the rulings.

AM1–AM5 folded byte-identical with status + AM3's provisional marker carried, and the folded section
states why nothing here may promote them (GEN-017 reconciled only where an acceptance record existed)
— correct. One script, three arms; amendment arm form-tolerant (existing headings not normalised) and
namespace-scoped; principle arm's Rule-7 asymmetry written in with its reasoning. All eleven reds
behave, both exclusion directions, both vacuity guards loud. Close as GEN-019.

## R2 — The placeholder collision: the Rule-7 cost arriving immediately. Allowlist ACCEPTED, and constrained.

The principle arm bit first run on two **placeholders**, not citations: `[slug]` in your script's own
syntax comment (fixed at source — right) and `[other]` in GEN-018's ruling, from the
"distinguished from `[other]` by …" template, inside an **immutable** Rule-7 record (cannot be fixed
→ a closed allowlist with provenance, in the sanctioned-crossing shape). This is exactly the price the
Rule-7 no-exclusion asymmetry was ruled to carry, arriving at once — and naming it beats pretending
it is free.

Constraint on the allowlist so it cannot rot into a hole: it is **closed**; each entry carries its
**provenance**; **adding an entry requires a ruling** (treat it like a sanctioned boundary crossing,
not a dev convenience). A real dangling citation must never be relabelled a placeholder to silence it.

## R3 — The two bad probes seed a NEW principle. (Owed → PID-PRINCIPLES, folded into batch B.)

Both probes were wrong before the check was: a `sed` pattern that never matched (reported green — a
probe failure masquerading as a check failure), and a vacuity attempt that didn't narrow the scan (the
arm returned its normal 8 ADRs — an untested guard nearly recorded as tested). Your framing is exact:
**a probe that doesn't change what it claims to change is indistinguishable from a check that doesn't
fire** — the `[patch-verify-on-disk]` family, one level up.

New principle to add to `PID-PRINCIPLES.md`: **`[probe-must-bite]` — a probe/mutation used to prove a
check must itself be verified to change the thing it claims to change; confirm the probe alters the
observed input (or independently fails without the fix) before trusting the red.** Add it in **batch
B** (test-integrity themed, alongside teardown-isolation) with a stable id — one line, explicitly
scoped so it does not reopen the C+F basket beyond this single addition.

## R4 — The amendment arm has no vacuity guard: acknowledged, adequately guarded, STATE it. No new guard.

Correct that the amendment arm can pass examining nothing — but that is only a hole in a middle case,
and that case is already covered: **zero amendment references is legitimate** (nothing to check →
passing is correct, not vacuous), and **references-exist-but-silently-unscanned** is caught by the
dangling/namespace reds (`ADR-010 A6 → red` drives real discovery + resolution, so a broken scan
surfaces there). So no numeric "≥1" guard — it would red on a legitimate zero. **Add a one-line note
in the script** stating the deliberate absence and that non-vacuity rests on the dangling/namespace
reds, so no one later adds a wrong guard or deletes those reds as redundant. That note is the only
pre-close edit.

## Close instruction
Add the R4 note (in-script). Merge (standard gate, `[GEN-019]` tag, push gated on `--check` + battery
— manual known-good gate; D not landed). Rule 7 close → archive/ with row, `status: merged`,
`closed: 2026-08-30`, artifacts carried (spec, step1 report + ruling, step2 report + this ruling).

## Next: batch B (new PID)
The live `reseed()` FK-order fix (the 3× bite) + the LIGHT prophylactic teardown-prefix guard, B
alone (highest blast radius). **Plus the one-line `[probe-must-bite]` addition to PID-PRINCIPLES**
(R3). Then D+E.

## Owed ledger
- `[probe-must-bite]` → PID-PRINCIPLES, in batch B.
- ADR-003 AM1–AM5 `Proposed`/unaccepted — PO question, post-C.
- placeholder allowlist is closed + ruling-gated (R2).
- After C2: idempotency token + audit act-reason (brain), then schema-vs-WEB-15.
