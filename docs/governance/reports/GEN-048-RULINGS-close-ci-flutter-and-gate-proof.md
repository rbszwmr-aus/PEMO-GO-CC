# GEN-048 — Close ruling: CI made green and proven to gate; Flutter in CI

Date: 2026-09-03. Merged a94b7b0 (+ report 0e0cab7). Battery 36 (new R3 guard); manifest 56, all proven. Step reports GEN-048-step1/step2.

## Accepted
A1 The cause, from the files, narrower than my hypothesis: apps/api DID declare both modules (the install in #93 succeeded); its tsconfig references did not name them, so a clean `tsc -b` never built their dist/ first. Every local build had looped over every module beforehand, hiding it. Accepted — the hypothesis named the right neighbourhood and the wrong house; the executor read the files.
A2 R5: red on every push to main since 292f9da (GEN-040, 2026-09-02). The hook was the gate; no close reopened; every "CI green" statement in that range is a claim. Recorded.
A3 R2: the first from-nothing kept dist/ and its own bite stayed green — the GEN-039 dist hazard at workspace scale. From nothing now keeps nothing; the bite reds with TS2307. Accepted; principle a-rebuild-that-keeps-node_modules-is-not-from-nothing registered (and now covers dist/).
A4 R3 guard: 30 edges, 12 packages; undeclared workspace import → red. It refused Main CC's own new principle for an invented citation — sixth of that class, and the guard was right. Accepted.
A5 D1 Flutter pin + `flutter test` gate over apps/resident-mobile — accepted as merged (pin stated in the step report).

## R4 — the gate proof, and the mechanics
The workflow fires on push to main and on pull requests. The deliberate-red probe (`codex/gen-048-red-probe`: notices reference removed) was opened as draft PR #1 by the PO. The PR shows conflicts in four files (apps/api/tsconfig.json, PID-PRINCIPLES.md, manifest.json, GEN-048-step2.md) because the probe was cut before GEN-048 merged. GitHub does not run `pull_request` workflows when it cannot build the merge ref — a conflicting PR produces NO run. Ruled: Main CC rebases the probe onto current main (a94b7b0 or later), re-applies the single deliberate removal, force-pushes the branch; the PR updates and CI fires. The PO relays: (1) the a94b7b0 (or later main) run URL, its conclusion, and the browser job's runner line naming the browser + version; (2) the probe PR run URL, its conclusion, and the red step's name + tail. Main CC records both in GEN-048-step2 (or a step3), then closes the PR and deletes the probe branch.

## Close
CLOSE IS AUTHORISED once both R4 URLs and the browser line are in the report. Rule 7 close on this ruling; do not close before the evidence is recorded — a gate proof that is not in the record is a claim.
