# GEN-046 — Step ruling: G1/G3–G6 approved; G2's cross-track cycle broken by ordering

**Verdict: G1, G3, G4, G5, G6 APPROVED as built. GEN-046 holds at HARD STOP until
UI-045 merges; then rebases, lands G2 against a green suite, and merges.**
Date: 2026-09-02. Battery 31/31; manifest 22 proven, 0 failed. Nothing committed.

## G1 — the sweep built its own subject; the corpus's proof status is now honest

Zero bites were re-runnable across nine PIDs and 76 reports — no script or test
referenced `with-mutation.sh`. `mutations/manifest.json` + `run-mutations.sh` now
judge three conditions separately: mutation applied, suite ran (the condition
GEN-044's five false bites failed), named case red. **22 bites proven under that
criterion. ~36 recorded bites remain prose** in four classes the file-mutation
harness cannot express — DDL/grants, shell guards, HTTP adapters, boundary scans
— and are correctly **not** reported as proven. Ruling: those 36 are claims until
a harness class exists for each; **owed as the next governance PID after GEN-047**,
prioritising DDL/grants and HTTP adapters (authority-critical) first.

Two first-pass failures, both diagnosed rather than re-run — correct:
- `resident-projection-boundary`: classification wrong, subject sound. The type
  does not reject a governance field — excess-property checking does not fire
  through `rows.map(...)`. **The boundary is held by its test alone.** Owed
  (small): an exact / branded projection type so the boundary is structural.
- `triage-floor-is-covering`: GEN-044's recorded "any-node floor" mutation is the
  same predicate as covering for a single-node ticket — it could never red for
  that guard's reason. Replaced; guard sound. Residual: proven to exist, not to be
  covering. Owed (small): a multi-node ticket case (a Location whose
  serving_scope spans nodes).

G1's stop condition did not fire.

## G3 / G4 / G5 / G6 — accepted

G3 written into rule 1, including the refusal GEN-046's own allocation met: a
PID may not bracket-cite a principle it defines (the definition lands with the
body, after the allocation commit). G4: 68 → 71 — three principles, not two;
`[a-bite-that-cannot-be-rerun-is-a-claim]` is a different defect from a wrong
verdict and deserved its own name — agreed. G5: one declared grammar, no
fallback, both consumers proven by being made to fail. G6: corollary carried,
ADR-020 points at it.

## G2 — the block is the finding, and half the cycle is the PO's

The management-web suite on `main` is red (79/101, build fails). `git log` names
the causes: **GEN-043** dropped `notice.approval.steps` from
`mob-s5-notices/detail.json` in the 2.0.0 reshape — on the PO's instruction to
drop the `approval` object — and the old S5 guard calls that fixture "evidence,
not decoration"; **GEN-042**'s severity bump left two `severity-tokens.g.ts` at
0.3.4. Nothing caught either because the suite is ungated — which is what G2
exists to fix. Gating a knowingly-red suite would block every push; the remedy
lives in `apps/management-web/**`; Main CC stopped. Correct.

**UI-045 is the reconciliation of the UI to 2.0.0** (its branch: node 106/109,
browser 259/264, 0 fail) — but it was waiting for G2's gate under the PO's rule
"no UI PID merges before the gate exists." That rule lacked the one exception it
needed: *unless the UI PID is itself what makes the suite green.* The PO's
omission; owned.

**Ruling — break the cycle by ordering:**
1. **UI-045 merges first**, by explicit one-time exception, on two conditions:
   (a) R1 answered — its mutation harness certifies on *named case red with log
   present*, not exit status (applying the GEN-044 fix and re-running the 10 if
   not); (b) the two `severity-tokens.g.ts` confirmed regenerated to 0.4.0 (UI
   scope). Its locally-run full suite counts stand as its evidence. UI-004 closes
   as superseded in the same merge.
2. **GEN-046 then rebases** onto the UI-045 merge (PID-INDEX regenerated, never
   hand-merged), re-runs, lands G2 gating a **green** suite, and merges.
3. The fixture question — restore the S5 evidence or retire the guard — is
   answered "neither": the old guard asserted a retired shape; UI-045 supersedes
   it with 2.0.0-shaped screens. **Main CC does not touch the fixture further.**

## Owed register (from this step)

- Harness classes for the ~36 prose bites (DDL/grants, shell, HTTP adapters,
  boundary scans) — next governance PID after GEN-047.
- Exact projection type (resident-projection-boundary structural, not test-only).
- Multi-node ticket covering case.
- `destructive-target-confirmed` — Section 0 still unsupplied.

— PO step ruling. Close ruling follows the merge report.
