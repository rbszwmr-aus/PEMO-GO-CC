# GEN-020 (C2 batch B) — Step 2 rulings + close

Date: 2026-08-30
Report: rewrite/reports/GEN-020-step2.md — HARD STOP, nothing committed beyond allocation, main a205e767.
Suite 343 → 347, no failures; reseed() is every integration test's entry point.

## Verdict: MERGES. The fix correctly widened to the class; the derivation maintains itself. Close batch B. Then D+E (last).

---

## R1 — Batch B APPROVED. Fixing the CLASS, not the instance I named.

I named `audit_event`; the catalogue named three — `scope_grant` and `group_membership` also FK
`user_group`, and the seed clears them only by prefix, so an aborted run's leftover grant pins reseed
exactly as an audit row does. Fixing only what I named would have left two latent 3×-class bites.
Correct to widen, and correctly disclosed (not silent). **Both blocker sets are derived** — blocked
tables parsed from the seeds' own `DELETE FROM`, blocking tables from `pg_constraint` — so the list
maintains itself against schema drift, and the **vacuity guard that throws on an empty parse** is
`[probe-must-bite]`/`[shadowed-layer-empty-oracle]` applied to the derivation itself. All three
mutations bite; each probe verified to bite first. Close per Rule 7.

## R2 — Reinforcement: building against a finished diagnosis is cheap.

Two files, lighter than expected, because GEN-018 Step 1 had diagnosed this to the seed file, line
number and exact FK. The diagnosis is where the cost and value sit; the build is a fraction. This is
the inventory-first discipline paying out — keep it.

## R3 — The two flagged gaps → owed, dispositions.

- **`clearSeedBlockers` deletes whole tables (blunt).** Safe today (all four dependents are
  seed-restored), but a future dependent holding data the seeds do not restore would be silently
  emptied. Disposition: acceptable now; **owed guard** — an assertion that every table
  `clearSeedBlockers` empties is re-populated by the seeds after reseed (post-reseed, the cleared
  tables carry their seeded rows again). That catches a future non-restored dependent. Not forced
  into B (which lands alone/minimal); noted.
- **The prefix guard is opt-in** (the 13th teardown is protected only if its author remembers) — the
  same "a field cannot notice what is missing" shape as the ADR header. Accept the opt-in now
  (prophylactic, no live instance); **owed** — a standing check that parses teardown SQL out of test
  files and asserts no teardown prefix matches a seed id. Larger and less certain, correctly deferred
  from a batch landing alone. This is the recurring convention-not-a-control family; it lands when we
  next do a checks-hardening pass.

## Close instruction
Merge (standard gate, `[GEN-020]` tag, push gated on `--check` + battery — the manual known-good gate;
D not landed). Rule 7 close → archive/ with row, `status: merged`, `closed: 2026-08-30`, artifacts
carried (spec, step2 report + this ruling).

## Next: batch D+E (the LAST C2 batch)
The merge-gate hook (D) + premise-arm-guard (E). **D+E has real design subtlety** — a versioned hook
cannot be forced, and the opt-in assertion cannot run in CI (a fresh clone has no opt-in) — so D+E
gets a **Step 1 design** before build. It lands last precisely because D changes the gate that merges
it, so everything else has already landed under the manual known-good gate.

## Owed ledger — additions
- clearSeedBlockers re-population assertion (guard against a future non-restored dependent).
- Teardown-prefix standing check (parse teardown SQL) — the convention-not-a-control item.
- (unchanged) citation-vs-mention syntax redesign (with trigger); ADR-003 AM1–AM5 unaccepted; after
  C2: idempotency token + audit act-reason; then schema-vs-WEB-15.
