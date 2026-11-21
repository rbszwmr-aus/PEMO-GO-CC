# GEN-055 — Close ruling: C3 cases handling, and three harness findings it flushed out

Date (UTC): 2026-09-04. Merged 799e821..5fdd757. Main run 33868712506 green on both jobs — browser 380 + 26, Flutter 281 gated / 2 exempt — read per the standing rule. Feature: 35/35 integration, 10/10 bites.

## Closed. Accepted.

### The feature
C3 landed as specified: disjoint vocabularies first, the lifecycle acts, the case floor. Ticket and Case lifecycles and their closure/disposition reasons are separate vocabularies with type-level tests, so a literal of one cannot be passed where another is expected. Every act appends; state stays computed. The feature logic was green before the first push and stayed green through four commits of harness repair — worth saying, because the three findings below are about the harness around it, not about cases.

### The three findings, all CI-only, all one class
1. `seed-reproduces.sh` hardcoded seven of ten schemas, so "from nothing" had not been from nothing since helpdesk/notices/service_case existed — GEN-055 merely made the leftover rows load-bearing. Also dropped as `pemo_app`, which cannot. Derived from the catalogue, dropped as owner, bitten.
2. The supersession sweep DERIVED its assertion tables from `pg_constraint` and then checked them against HAND-DECLARED prober INSERTs. Half-derived, half-hand-kept is worse than fully hand-kept: it looks derived, so nobody suspects the half that is not, and the derived half silently grows past the written half exactly when a schema changes. Patched once (950892a, green), then DERIVED (5fdd757) as ruled — `buildInsert` reads `information_schema.columns` and fills every NOT NULL no-default column; only genuinely un-derivable columns (CHECK-enum members, setup-backed FKs) remain in a shrunken, named `semantic` map with reasons written beside each.
3. `ticket_satisfaction`'s `closure_version` near-miss, named as an exclusion rather than left to look like coverage.

Accepting the derivation rather than stopping at the green patch is the substance of this close. 950892a proved the fix was correct; it did not prove the next migration would not break the file again, and that file had already been the tax on two consecutive schema changes. The `probe-must-bite` bite — add a NOT NULL no-default column to `service_case` in a rolled-back migration, the derived prober fills it, a hand-written list would omit it — is what makes "the tax is gone" a fact.

### The class sweep
`010-grants.sql` / `grants-complete.sh` already derived; the registry is the sanctioned single declaration; `verify-boundaries` carries one trivial literal; `run-mutations.build()` is the one genuinely hand-kept non-trivial list, recorded for a future PID rather than converted here. Reporting the survivors instead of claiming the class closed is the right shape.

### The gate, demonstrated live three times
Every one of the three findings was CI-only: local `prove.sh` green, CI red. That is the gate-coverage finding proving itself three times in one PID. The CI-equivalent command set Main CC ran by hand — DB reset → CI bootstrap; `pnpm -r build` → toolchain; `verify:boundaries` → module boundaries; `pnpm --filter @pemo/api test` → integration + contract; browser loop → the app browser suites; Flutter loud-skipped as a separate CI job — is recorded in GEN-055-FINDING-2 and STANDS as the gate-coverage PID's D3 specification, written from practice rather than guessed.

### One correction, mine
I read `b1e3e22`'s red as a failure of the fix in `950892a`, when `b1e3e22` is the earlier commit. The timeline was Main CC's to state and it stated it plainly. Recorded so the record does not carry my misreading.

## Rule 7 close authorised
Carry this ruling in; archive/ + index row; status: merged; closed: 2026-09-04 (UTC, `date -u +%F`). Report the closed row and read the close-push run.
Next: the seed/demo/production-bootstrap readout including the one-world cost question, then GEN-056.
