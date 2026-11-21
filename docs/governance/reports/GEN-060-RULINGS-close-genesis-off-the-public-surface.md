# GEN-060 — Close ruling: the genesis act leaves the public surface

Date (UTC): 2026-09-04. Merged; main run at fcc1284 green on both jobs — browser 380 + 26, Flutter 281 gated / 2 exempt — read, not assumed.

## Closed. Accepted.

### What was wrong
`POST /api/management-web/v0/organizations/:id/provision` was registered unconditionally, was the only route on the surface not behind `authenticateStaff`, and was guarded solely by the zero-grants-ever predicate. The invariant was never the defect — the first administrator genuinely cannot require an administrator, and making that one act require no prior authority is the correct resolution of ADR-010 A1's chicken-and-egg. The defect was the surface it sat on: between an organization row existing and its provisioning, anyone who could reach the management surface and knew or guessed the org id became its administrator permanently, and the once-only invariant then worked FOR the seizer, since the rightful operator could never provision afterwards.

### The remedy, and why this shape
Shape (a)+(b)+(d): the public route is deleted, genesis becomes an operator CLI on the host in the `dev-token` shape, and zero-grants-ever stays as the inner guard. Chosen over the one-time-secret HTTP option because genesis is an operator action, not customer self-serve — the first administrator is created by whoever deploys the system, on the host, with the database credentials. A route that does not exist cannot be misconfigured, cannot be left reachable by a forgotten ingress rule, and cannot be "temporarily re-enabled" by a future maintainer under pressure. Removing the surface eliminates the exposure rather than papering it.
`management/genesis.ts` lifts the orchestration transport-free, and the CLI and the test seam both call it. That is what keeps the operator path the REAL act instead of a second implementation that drifts; migrating `delegation-floors` and `grant-surface` off `app.inject` in the same pass is the proof of that, not a tidy-up.

### The exposure, recorded verbatim as ruled
"This build is development-only (`loadConfig()` throws unless `PEMO_ENV=development`), so the exposure was latent — real for any shared dev or staging surface, and a going-live blocker fixed before a production posture existed. 'There was no production yet' is a fact about our timing, not a mitigation."

### Bites
The old URL 404s; the operator path takes zero authority to one effective administrator; a second attempt is still refused by zero-grants-ever — the last is the one that matters, because the invariant is what was kept.

### Cross-track
management-web's `provisionOrganization` act-vocabulary entry is contract-derived, the act still exists, and only the route is gone; the browser suites (380 + 26) stayed green through the removal, which is the cleanest possible evidence that the tracks are correctly separated. No management-web file was touched. If that entry ever reds on a future regeneration, it is a finding for UI CC's next PID: there is no genesis UI and there must not be one.

## Rule 7 close authorised
Carry this ruling in; archive/ + index row; status: merged; closed: 2026-09-04 (UTC). Report the closed row and read the close-push run.
Next: GEN-056 → the one-world PID (with the PO composing demo notices through the real UI, capture step planned first) → gate-coverage → parity + G7 → backstop.
