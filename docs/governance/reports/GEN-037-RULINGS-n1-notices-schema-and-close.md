# GEN-037 CLOSE — N1: notices schema + platform attachment reference

**Verdict: CLOSE.**
Date: 2026-09-02
Filed by: Master Brain (Product Owner). Carried into the repository by `GEN-037`.

---

Merge confirmed: c33ff191 -> 0d0abbee, tree-hash 6d82d078, equal via ls-remote,
hook 30/0, no --no-verify. Contract delta NONE (cut A honoured). Gate from
nothing: contract 105/105, integration 371/371, battery 30/30, boundaries PASS,
register OK (next 038). ADR-019 carried; adrs-present resolves.

D4 — PO premise half right; correction right. serving_scope->units EXISTS at the
correct boundary (property.resolveServedUnits, consumed by home_safety via a
declared port in wiring.ts; no private copy, no convergence owed). units->
residents did NOT exist anywhere (home_safety's audience is unit ids, never
occupancy) — no second resolver to avoid; the occupancy leg had no first. Placed
in `resident` (owns occupancy) with asAt REQUIRED, not defaulted — right.
Owned: the PID's premise was half wrong; the resulting design is correct.

Boundary check bites on TYPE edges: the @pemo/resident type-only import was
refused; notices declares its port locally like home_safety. Good.

LIVE DEFECT, fixed correctly: five hand-kept module lists, two rotted TOGETHER
(010-grants.sql granted over a hand-kept schema array; grants-complete.sh
filtered by an identical one) -> notices created/migrated/seeded with pemo_app
holding NO privilege while the check said "ok — 44 tables". Green over a schema
the app couldn't read. Two agreeing hand-lists certify nothing — the correlated
variant of R5's theme. Both now derive from ownership (44->48); revoking on
notices reds. RULING: the remaining five hand-kept lists are a FIRST-CLASS item
of cut A's closing governance PID; same PID makes 010-grants.sql RECONCILING
(grant missing + revoke excess; revoke gated non-prod/explicit), not additive-
only — you found it can't undo a bite; detection holds, restoration is manual.

HARNESS DEFECT, ruled: with-mutation.sh restores source but mutated dist/ outlives
the restore and tsc -b calls it current — baseline ran against a live mutation
(9/10). Not a "remember to rebuild" note: with-mutation.sh must FORCE
invalidation/rebuild of dist/ after restore. First-class item of the closing
governance PID; until then force the rebuild explicitly and say so per bite.

Acceptance: ten items proven per the report's table (30/30); no route, no write
surface; attachment_ref landed store-agnostic with opaque storage_ref.
