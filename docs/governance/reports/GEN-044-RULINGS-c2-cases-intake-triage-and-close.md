# GEN-044 CLOSE — C2: cases intake + triage + open-case

**Verdict: CLOSE.**
Date: 2026-09-02
Filed by: Master Brain (Product Owner). Carried into the repository by `GEN-044`.

---

Merge confirmed: dfdcf8c7 -> 6020a540, tree-hash 6fc8bbaf, equal via ls-remote,
hook 31/0, no --no-verify. Contract 105/105, integration 451/451, battery 31/31,
boundaries + ADR-018 types PASS, register OK (next 045). Contract delta NONE.

THE HARNESS REPORTED FIVE FALSE BITES AS "CAUGHT" — the chain's most serious
finding. `false && <cond>` broke narrowing -> build failed -> suite never ran ->
with-mutation counted the non-zero exit as red. The harness's own success
criterion was vacuous: A NON-ZERO EXIT IS NOT A RED. Your fix is correct and
accepted: log must be present AND the named case must be the one that failed.
RULING — RETROACTIVE SWEEP, first item of GEN-045 (harness trust before
anything, as G1 preceded G2): re-run EVERY recorded mutation in the corpus
under the fixed criterion; rewrite + re-prove any that was a compile failure;
report the count. Any bite not recorded as a re-runnable artifact is itself a
finding to fix — A BITE THAT CANNOT BE RE-RUN IS A CLAIM. Until the sweep
reports, proof claims since GEN-036 are treated as unverified, not false.
PRINCIPLE (define in GEN-045; prose name `a-bite-is-a-named-red`): a mutation
harness certifies a guard only when the named test fails for the guard's own
reason, with its log present; a non-zero exit, a build failure, or a missing
log is not a red.

THE PRE-FLIGHT — refused correctly, diagnosed wrongly, PRESCRIBED DESTRUCTION
("restore from origin/main" = discard this PID's work). Fix accepted (anchor on
the injected import; proven both ways). PRINCIPLE (define in GEN-045; prose
name `guard-remedies-are-non-destructive`): a guard's failure message names
the diagnosed cause and a non-destructive next step; never prescribes
discarding/resetting/restoring work as the default remedy. Same family as
`destructive-target-confirmed` (Section 0 still unsupplied; both land together).

FEATURES accepted. The reportable set is a new authority shape (residency +
serving_scope, not a grant) — RECORD as an ADR-020 corollary (one paragraph,
carried with GEN-045). Case 5b's PK-seizure atomicity proof: correct design.

GAP RULED INTO C3: ticket disposition/lifecycle vocabularies fully overlap (the
GEN-042 defect, latent in helpdesk). C3's FIRST step makes them DISJOINT for
BOTH helpdesk and service_case, with the type-level no-overlap bite, before any
transition act.

SEQUENCING (revised): GEN-045 governance (harness sweep -> gate management-web
in prove.sh + CI -> parallel-allocation rule into docs/governance -> the two
principles -> ADR-020 corollary) -> GEN-046 permitted actions on notice reads,
derived from the act floors (management-web 2.0.0 -> 2.1.0) -> THEN C3. UI part
1 merges after 045's gate; UI part 2 binds to 046.
