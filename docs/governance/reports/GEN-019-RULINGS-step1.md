# GEN-019 (C2 batch A) — Step 1 rulings

Date: 2026-08-30
Report: rewrite/reports/GEN-019-step1.md — HARD STOP, nothing built. main ba7de991, allocation 5f8475d2, next 020.

## Verdict: fold all five amendments; the Rule-7 asymmetry is approved and sharp; the resolver is namespace-scoped and form-tolerant; eleven reds approved. Proceed to Step 2.

---

## R1 — Fold ALL FIVE ADR-003 amendments (AM1–AM5) verbatim. APPROVED.

Folding only AM4 would re-author a decision (the source's own instruction forbids it) and strand four
amendments outside the repo — recreating the exact hazard we are closing. Carry all five **verbatim**,
including the `Proposed` status and AM3's provisional marker; unlike GEN-017 there is no acceptance
record to reconcile against, so reconciling would be invention. Respect the source's self-carry
instruction (fold as the next letter; you verified the repo ADR-003 carries no letters, so the source
numbering is next and carries unchanged). Preserve the `AM<n>` ids so the `AM4` citation resolves;
place them under an ADR-003 "Amendments" section following ADR-007's folded precedent.

**Owed (PO-facing, not blocking):** ADR-003 now carries five `Proposed` amendments that have never
been accepted. Carrying them in is *consolidation, not acceptance*. Whether AM1–AM5 need a PO ruling
is a separate question — surfaced to the ledger, not this PID's to settle.

## R2 — The Rule-7 asymmetry (ADR arm excludes Rule-7; principle arm does NOT): APPROVED, and it is principled.

The reasoning is exactly right and the asymmetry is earned, not arbitrary:
- **ADR arm excludes Rule-7** because an ADR can be legitimately *withdrawn*, so an immutable old
  report naming a since-withdrawn ADR would red forever — a false alarm on legitimate history.
- **Principle arm does NOT exclude Rule-7** because a principle id is *permanent and never reused*
  (GEN-018's scheme), so a dangling principle citation means permanence was **broken** — precisely
  what to catch. And inheriting the exclusion would make the principle arm examine **nothing** and
  pass: an empty oracle inside the very check built to close the citation gap
  (`[shadowed-layer-empty-oracle]` catching itself).
**State the asymmetry in the check** (a comment/line explaining why the arms differ) so a future
reader does not "fix" it into a bug. The stated cost (remove a principle → every citing report reds)
is the **right** cost — it enforces permanence; if a principle must ever be retired, it uses the
**legacy-id map** mechanism (mark retired, keep resolvable), so the cost is bounded, not a wall.

## R3 — The two discrimination risks: both are the check's real correctness.

- **Three declaration forms** (`## A1`, `### A1`, `**AM1**`): make the resolver **tolerant of all
  three** (normalize `A<n>`/`AM<n>`, any heading level or bold). Do NOT normalize the existing ADRs'
  headings — that edits accepted content for cosmetics, out of scope; the check accepts the forms as
  they are. Prove a heading-form and a bold-form amendment both resolve green.
- **Per-ADR namespace** (`ADR-007 A4` ≠ `ADR-010 A4` ≠ `ADR-011 A4`): the resolver MUST scope the
  letter to its owning ADR — never let any `A<n>` satisfy a reference to a different ADR's `A<n>`.
  This is critical; the proposed `ADR-010 A6` red (exists only as ADR-007's) is the proof. Essential.

## R4 — Eleven reds: APPROVED, including the three you added.

The three additions are exactly right: delete ADR-007's `## A5` (prove its green is not accidental —
run-the-red-to-disprove-empty-oracle); reference `ADR-010 A6` (prove namespace scoping); point an arm
at an **empty set** (prove it fails LOUDLY, not vacuously — the check proving it is not the empty
oracle it was almost built as). Fire all eleven.

## Step 2 authorised
Fold AM1–AM5 into `docs/adr/ADR-003` (verbatim, `AM<n>` preserved, Amendments section per ADR-007
precedent); extend the checker (amendment arm: form-tolerant + namespace-scoped; principle arm: does
NOT exclude Rule-7, asymmetry stated); fire the eleven reds. Reuse and EXTEND the C1 checker
(`[identity-by-self-declaration]`, H1-keyed), do not fork. No product behaviour change. HARD STOP
before commit.

## Owed ledger
- ADR-003 AM1–AM5 are `Proposed`/unaccepted — PO question, post-C.
- Minor: amendment-declaration-format heterogeneity (3 forms) — a uniformity convention is a possible
  future tidy, not now.
- C2 remaining after A: B, then D+E. Then idempotency token + audit act-reason, then schema-vs-WEB-15.
