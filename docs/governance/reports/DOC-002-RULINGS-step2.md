# DOC-002 Step 2 — Master Brain ruling (filed)

**Author:** Master Brain · **Date:** 2026-08-27 · **Rules on:** `reports/DOC-002-step2.md`
**Verdict:** Step 2 ACCEPTED. **DOC-002 CLOSED.** Reuse map (7 KEEP-AS-IS / 1 provisional / 15 REFACTOR / 1 DROP) is the input to the migration PIDs.
**This file exists because a ruling that lives only in a session is lost (global rule 2). The relay is not the record; this is.**

## Headline

The deepest finding is not any single verdict: **the inherited green is not all earned.** Four independent mechanisms let the first build's suite pass without proving what it claims — presence-not-execution (F1/F2), silent skip (F7), git-dependency masking (F3), contract-green over a live leak (F5). The rewrite **carries the code and re-earns the green**: every carried test is suspect until its red condition is shown to fire. Recorded as a principle in `governance/PID-PRINCIPLES.md`.

## The two-count reframe — ACCEPTED

Keep-the-repo (D01) holds: **99.6% worth-keeping**. But "mostly drop-in" is false: **38.1% unchanged, 61.5% needs work**, and the unchanged bucket is fragile — 134/272 are untested `resident-mobile`, falling to 19.3% if that suite does not hold on a Flutter host. Migration PIDs plan against 61.5%. D01 amended to carry both figures.

## Dispositions

- **F4 — ACCEPTED; amends D01.** The scaffold is DROP-in-intent, load-bearing-in-fact: 33-file blast radius (MOB-02 `home-projection.ts`, MOB-03 `services-projection.ts`, `degraded.ts`, `wiring.ts`, 15 seeds), proven by `DROP SCHEMA dev_scaffold CASCADE` → 33 fail. Removal is a **scoped migration PID** (replace those data sources with real data), **not a delete**; the scaffold **stays** until it lands. The resident vertical slice is **partly scaffold-backed** — recorded. `decisions/D01` Consequences updated accordingly.
- **F1 + F2 — ACCEPTED, confirmed defect; downgrades the seed KEEP.** Resident seed reproduces from nothing (812 proven); **management scenario seeds do not** (missing the label columns `0032:60-62` requires), and `scenario-inventory.test.ts:50` checks the file is **present, not that it applies**. Both REFACTOR: fix the seed columns; change the inventory test to call `applyScenario` on management scenarios.
- **F5 — ACCEPTED, boundary leak, REFACTOR.** The global 404 emits `event-not-found` (`surfaces:["resident"]`) on `/management/*`. Use the already-registered `record-not-found` / `scope-not-found`, and add the missing test: the management surface never emits a `surfaces:["resident"]` type **at runtime** (today's check is on the projection, not on what the server emits).
- **F3 — ACCEPTED, REFACTOR.** Tests that shell out to `git` assert the governance process, not the software, and are un-runnable from an export/container. Move them to a governance-lint that runs where `.git` exists; the software suite must run green from a clean export.
- **F6 / F7 / F9 — REFACTOR, accepted.** Derive "3 blocks · 812 units" (declared in the contract, computed by the tree, transcribed in three places); make skips loud, not silent; the test script must build first (`pnpm test` fails on a clean management-web checkout).
- **F8 (17/16/6 module-count mismatch) — carried; Master Brain reconciles it in the architecture doc.**

## Verified-not-asserted, noted with approval

The 812 basis reproduces from a fresh DB (280/154/378); the floors-came-back-one-higher discrepancy was **chased, not smoothed** — the extra `G/F` per block holds only parking/storage. This is the method working, and it confirms the seed rather than contradicting it.

## Follow-up — filed, not left in the relay

`dependency-cruiser` was not run, so `no-simulator-in-runtime` is **unverified** — and F4 shows the scaffold feeds three product projections, so the invariant **may already be violated**. The executor correctly declined to run new work under a closed PID with no filed home. It is now **`GEN-003`** (not GEN-002 — number 002 belongs to DOC-002; corrected on allocation). The closed `DOC-002-step2.md` is **not** to be amended for this — §5 gap 4 already records it as unverified, which is sufficient; `GEN-003` carries the verification forward.
