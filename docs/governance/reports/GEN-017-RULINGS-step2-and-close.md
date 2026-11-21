# GEN-017 (C1 — ADR consolidation) — Step 2 rulings + close

Date: 2026-08-30
Report: rewrite/reports/GEN-017-step2.md — HARD STOP, nothing committed beyond allocation.
Battery 22/22, suite 343, boundaries PASS, validator PASS, index OK.

## Verdict: MERGES and closes C1. Two residuals routed to C2 (not reopened here). One new principle.

---

## R1 — GEN-017 APPROVED. The consolidation holds and the check bites.

All 13 referenced ADRs resolve in `docs/adr/`. ADR-013 assembled base-verbatim + delta (verified
byte-identical before the delta — no drift). ADR-010 reconciled correctly: status → Accepted v1.1,
the "three questions remain open" line replaced with a pointer to the amendment, the Open questions
section retained verbatim, D1:33 wording fixed **with a note that only the wording trailed** (the
note preserves the trail — good). `0112`/`0116`/Rule-7 untouched. GEN-016 `closed:` corrected to
2026-08-30 and folded in. Close per Rule 7.

## R2 — The glob-hole is the highlight, and it seeds a principle.

The check's first version resolved ADR identity by **filename glob**, so an auxiliary file
(`ADR-012-ACCEPTANCE-…`) masked the deleted decision doc — a hole introduced *in this very PID* by
carrying the acceptance records in. It surfaced ONLY because Main CC ran the proposed red and it
**stayed green** — the empty-oracle vigilance (a red that fails to fire is itself the finding) doing
exactly its job on a self-inflicted hole. Fixed by matching the document's own **H1**
(`# ADR-012 —` vs `# ADR-012 core —` vs `# ADR-010 AMENDMENT —`); three reds now fire, each naming
its file.

New **PID-PRINCIPLE** (→ C2): **an identity/presence check must resolve identity by the artifact's
own self-declaration (its H1, its declared id), never by a filename or path pattern a neighbouring
file can satisfy.** This is the identity-layer cousin of "liveness is computed, not a stored flag"
and "the deciding layer must carry its own oracle."

## R3 — Stop condition correctly did not fire.

Checked, not assumed: ADR-012 D4 key matches `0115`; ADR-011 D7 and D10/A4 consistent with what is
and isn't built; ADR-013 D1–D6 + C1–C5 describe exactly what GEN-015/016 built. All relocation,
reconciliation, or status — no decision changed. Correct.

## R4 — The two flagged residual gaps: acknowledged, routed to C2, GEN-017 NOT reopened.

GEN-017 built what was scoped (ADR-id-granularity presence + the check); these were in the Step-1
plan but outside the Step-2 DO list, and reporting the difference is the right call.

- **ADR-003 AM4 is invisible to the check** (ADR-id granular; ADR-003 itself is present, so a missing
  *amendment* to a present ADR is not caught). → C2: (a) **carry ADR-003 AM4 into `docs/adr/`** — it
  is the same "a missing artifact the code rests on" hazard at amendment granularity; (b) **extend
  the check to amendment granularity.** If AM4 is *referenced-and-absent* in code, it is the identical
  live hazard we just spent a PID on — treat it as the FIRST item of C2, not a trailing one.
- **The check verifies presence, not status-truth** (it cannot catch a false status line). This is
  acceptable and I am NOT ordering a status-truth check: **single-sourcing is the control** — now
  that `docs/adr/` is canonical, an ADR's own status line IS the record, so there is no second source
  to drift. A mechanical "is this status true?" check has no ground truth to test against and is not
  worth building.

## R5 — Close precondition (confirm before pushing).

Confirm **ADR-011 and ADR-012 status lines are set correct** in their canonical `docs/adr/` copies
(Accepted; ADR-012 2026-08-28). My Step-1 R4 scoped all four (010/011/012/013); the report explicitly
confirmed 010 and 013 — confirm 011/012 are done too (if not, set them; it is in scope). This is the
current-instance fix; single-sourcing prevents recurrence.

## Close instruction
Merge (standard gate; `[<this PID id>]` tag; push gated on `--check` + battery). Rule 7 close →
archive/ with row, `status: merged`, `closed: 2026-08-30`, artifacts carried (spec, step1 report +
ruling, step2 report + this ruling). Confirm R5 before pushing.

## Owed ledger — C2 now carries
- **[C2 first item]** ADR-003 AM4 → `docs/adr/` + extend the check to amendment granularity (check
  its reference-status; if referenced-and-absent, it is a live hazard).
- **New principle:** identity-by-self-declaration-not-filename → PID-PRINCIPLES.
- Standing C2 basket: patch-verify-on-disk (3×), teardown-isolation/reseed() (3×), assert-isolation-
  level, constraint-violation-never-500, shadowed-layer empty-oracle, merge-gate `--check` codify,
  premise-arm-guard, stable principle ids.
- Owed decisions (brain): idempotency request-token; audit-spine act-reason.
- Then the PO fork: schema-origination (notices/cases) vs WEB-15.
