# GEN-055 landing — third CI-only finding, and the gate-coverage pattern

**Date (UTC):** 2026-09-04. Branch `codex/gen-055` @ b1e3e22. Pre-push gate GREEN; CI `register` RED.
**Status:** HARD STOP. Reporting the finding and the pattern before continuing to fix.

## The finding (CI run 33863834823, "the integration and contract suites")

Three reds, all in `tests/integration/supersession-sweep.test.ts`:
- `helpdesk.ticket — a SECOND version-1 assertion under a DISTINCT id is refused`
- `service_case.service_case — a SECOND version-1 assertion under a DISTINCT id is refused`
- `the derived set of supersession keys is fully covered by probers`

**Not a schema defect — stale test data.** The supersession sweep derives the assertion tables from
`pg_constraint` (every `UNIQUE (…, version)`), then cross-checks each against a HAND-DECLARED prober
INSERT (it cannot derive the inserts — every table has its own NOT NULL columns). GEN-055's migrations
changed exactly those columns:
- `0139`: `ALTER TABLE helpdesk.ticket ADD COLUMN status … SET NOT NULL`, and retired the old
  `disposition` vocabulary (`opened`/`triaged`/…). The sweep's declared INSERT (supersession-sweep.test.ts:128)
  still supplies `disposition='opened'` and no `status` → the INSERT fails on the changed CHECK and the
  NOT NULL before the supersession assertion is reached.
- `0140`: `ALTER TABLE service_case.service_case ALTER COLUMN disposition SET NOT NULL`. The declared
  INSERT (line 135) supplies `state` but no `disposition` → NOT NULL violation.

The supersession GUARD (`UNIQUE (ticket_id, version)` / `(case_id, version)`) is intact; only the
sweep's hand-declared prober INSERTs are stale. The fix is test-maintenance in GEN-055's `tests/`
scope: update the two declared INSERTs to the new column shape and valid vocabulary values.

## The PATTERN — three CI-only findings on one merge

GEN-055's landing has now hit THREE failures that the local pre-push gate (`prove.sh`) passed and CI
caught:
1. **seed-reproduces stale drop list** (fixed, folded in) — `prove.sh` DOES run seed-reproduces, so
   this one the local gate caught after the DB was seeded; but it was latent for every prior merge.
2. **(this) supersession-sweep stale probers** — `prove.sh` does NOT run the integration/contract
   suites; CI does. Local green, CI red.
3. The register job's integration/contract suite is CI-only.

This is the gate-coverage finding, ruled into its own PID, demonstrated live: *a gate that runs less
than CI is not the gate it claims to be.* The local gate cannot see the class of failure that has
blocked GEN-055 twice.

## Recommendation

Rather than push → CI-fail → fix → push again (each CI cycle ~7 min, and the local gate cannot
pre-empt it), I propose to **run CI's full `register` check set locally** (`verify:boundaries`, the
integration + contract suites, the browser suites) once, fix EVERY remaining failure in GEN-055's
scope together, and push once. This is the gate-coverage lesson applied by hand until the
gate-coverage PID wires it in.

Holding for the Brain to confirm: (a) fold the supersession-prober test fix into GEN-055 (its scope,
its schema change caused it); and (b) whether to run the full CI-equivalent suite locally now to
land GEN-055 in one more push, or to bring the gate-coverage PID forward so the local gate catches
this class before GEN-055's next attempt.

---

## RESOLUTION — the full local register run (this command sequence IS the gate-coverage PID's D3 spec)

Ran, in order, exactly what CI's `register` job runs, against a canonically reset database:

```
# 1. reset the database to a known seeded state (owner-drops EVERY schema, then seeds)
for s in $(psql -U pemo_owner -tAc "SELECT nspname FROM pg_namespace
             WHERE nspname !~ '^pg_' AND nspname NOT IN ('information_schema','public')"); do
  psql -U pemo_owner -c "DROP SCHEMA IF EXISTS \"$s\" CASCADE"; done
database/bootstrap.sh --with-seed

# 2. build the workspace
pnpm -r build

# 3. the three register checks CI runs (governance.yml):
pnpm --filter @pemo/api verify:boundaries          # module boundaries + cross-schema scan
pnpm --filter @pemo/api test                       # the integration AND contract suites
for a in management-web resident-portal; do        # the app browser suites
  pnpm -C "apps/$a" exec playwright install chromium
  pnpm -C "apps/$a" run test:browser
done
```

**What it found and what was fixed (all in GEN-055's `tests/` scope):**
- `verify:boundaries` — PASS.
- `pnpm --filter @pemo/api test` — three reds, all in `supersession-sweep.test.ts`, two distinct causes:
  1. **Stale prober INSERTs** (`helpdesk.ticket`, `service_case.service_case`). GEN-055's 0139/0140
     added `status`/`disposition` NOT NULL and retired the old vocabulary. Updated the two declared
     INSERTs to valid current values (`disposition='report_opened'`, `status='open'`;
     `disposition='case_opened'`). **The prober INSERT cannot be derived** — it needs a semantically
     valid CHECK-enum member and live FK targets, not merely type-valid values — so it is recorded as
     a NAMED hand-kept list with that reason, not left looking derived.
  2. **A new near-miss in the derived set.** `helpdesk.ticket_satisfaction`'s
     `UNIQUE (ticket_id, closure_version)` matches the sweep's deliberately-broad `%version%`
     derivation (the substring `closure_version`). It is one-satisfaction-per-closure, NOT an ADR-013
     supersession key, so it joins `notice_audience` in `NOT_A_SUPERSESSION_KEY` — the sanctioned,
     explicit, reasoned exclusion the derivation exists to force. The derivation stays broad on
     purpose: catching every near-miss and requiring it be named is the property.
  After both: `pnpm --filter @pemo/api test` PASS.
- browser suites — GEN-055 touches no frontend; run for completeness.

**On the class (fourth instance).** The sweep is half-derived (tables from `pg_constraint`), half-declared
(the prober INSERTs). That is subtler than fully hand-kept because the derived half grows past the
written half silently on a schema change — which is exactly what GEN-055 did. The remedy is NOT to
pretend the written half is derived (it cannot be — semantic validity), but to keep it HONEST: named,
reasoned, and cross-checked against the derived set for PRESENCE. What that cross-check cannot catch —
a prober whose INSERT went stale — is caught by the suite failing loudly when it runs; the only gap was
that the LOCAL gate does not run the suite, which is the gate-coverage finding, not this file's.
