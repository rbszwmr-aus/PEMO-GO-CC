# GEN-042 CLOSE — Notices routes + first read surface

**Verdict: CLOSE.** Cut B is NOT yet complete — `GEN-043` (cut B completion) follows.
Date: 2026-09-02
Filed by: Master Brain (Product Owner). Carried into the repository by `GEN-042`.

---

Merge confirmed: b5b30bb4 -> e8a3a122, tree-hash 04ad86a3, equal via ls-remote,
hook 31/0, no --no-verify. Contract 105/105, integration 425/425, battery 31/31,
boundaries + ADR-018 type test PASS, register OK (next 043). Deltas:
management-web 1.2.0->1.3.0, resident-mobile 0.3.4->0.4.0, both MINOR; problem
types 31->45; resident-mobile Problem enum now GENERATED (good). H4 sweep 10
lines / 3 files; repo-wide zero.

THE DEFERRAL — RULED: MAJOR to 2.0.0, reshape both. listNotices/getNotice are S5
placeholders encoding a pre-ADR-019 model, pinned by three fixtures; reshaping
renames enum values + removes fixtured fields = breaking (ADR-008 amendment).
You correctly deferred only the two GETs. Accept your recommendation:
management-web 1.3.0 -> 2.0.0; reshape both to the ADR-019 model; update the
three fixtures; wire R2's two GETs (projections already built + tested). The
"new ops alongside deprecated placeholders" path keeps MINOR at the cost of two
dead ops carrying a superseded model — ADR-011's two-vocabularies failure.
Nothing ever served them; the version tells the truth. Done in GEN-043.
LESSON RECORDED: a placeholder contract with fixtures is a promise; retracting
it costs a MAJOR. FORESIGHT for cut C: MOB-02 already contracts a Ticket/Case
read summary (GEN-006-ST) — the cases read surface hits the same wall; plan a
resident-mobile MAJOR into cut C from the start.

TWO GAPS, ONE ROOT — ruled into GEN-043:
  1 revise/correct pass EMPTY content — version advances, change not applied. A
    real defect, merged. The route tests asserted a version advanced, not that
    content changed — GEN-038's vacuity class: a bite passing for the wrong reason.
  2 resident routes have no HTTP e2e (acts have 11 cases beneath). The thin
    adapter is where token->principal->resident lives — the "acting as oneself"
    boundary, security-relevant, must be exercised end to end.
  RULING: GEN-043 (a) fixes the content plumbing; (b) HTTP e2e for ALL ELEVEN new
  routes, staff + resident; (c) every route bite includes the mutation "the route
  IGNORES its request body" — a route not plumbing its body into the act must
  red. The test GEN-042 lacked, restored.
