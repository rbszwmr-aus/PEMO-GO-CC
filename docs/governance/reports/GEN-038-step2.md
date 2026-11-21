# GEN-038 — C1 helpdesk + service_case (ADR-020 cut A) — build + merge report

**Merged.** `14bcf37f` → **`8b210ed2e83e8e8175a8c2c63173c3f72878e2ee`**
**Tree-hash `294a993eacd1dba5f407f19e14a27fa62334d67a`** — local and remote EQUAL, remote re-read via
`git ls-remote` after the push. Refspec push, `main` never checked out, through the hook
(`31 passed, 0 failed`), no `--no-verify`. **PID `GEN-038`** from the directory scan (next: 039).
**Date** 2026-09-02 (read from `date`).

**Carry-in:** pin matched exactly; ADR-011/013/014/015/019 all resolve; **ADR-020 carried in before
any source cited it** (D0). `adrs-present` now reports **20 ADR** (was 19).

**CONTRACT DELTA: NONE.** No `openapi.yaml` touched, no route, no write surface. The two new files
under `packages/api-contracts/` are the vocabulary declaration and its generator — neither is a
published contract.

## THE CLOSE IS NOT DONE — no filed ruling

No `reports/GEN-038-*-RULINGS-*` exists, so the register would refuse the close. The PID stays
`draft`. The ruling records **your** authority to close; writing it myself would certify nothing.

---

## D8 — THE FORBIDDEN-TERMS DIFF (the reported item)

Derived from `interest-forbidden-terms.json` per ADR-011 D5 / API-027-ST's method. Every decision is
recorded in `case-forbidden-terms.json`'s `diffDecisions`, and a test asserts that record is present
and that the dropped group explains itself.

| group | terms | sample |
|---|---|---|
| `money` | 18 | rent, deposit, premium, servicecharge, managementfee, arrears … |
| `secrets` | 15 | password, passwd, secret, apikey, apitoken, accesstoken … |
| `work_execution` | 19 | technician, technicianname, engineer, crew, contractorstaff, parts … |
| `monetary_type` | 3 | money, numeric, decimal |

**KEPT VERBATIM — `money` (18), `secrets` (15).** ADR-020 D1 is ADR-011 D1 one layer out: no cost,
price, invoice or charge on a Case. A credential is a defect in any schema.

**DROPPED — `instrument` (16 terms: lease, deed, mortgagee, landregistry, …).** The only whole group
removed, and the reasoning is the part worth your attention. Those are TENANCY instruments — the
`resident.interest` boundary. A hit here would not be catching an ADR-020 violation; it would be
catching an **ADR-011 one, in a schema ADR-011's own scan does not cover**. Keeping it would make this
list assert a boundary it is not the guard for, and **a check that fails for another rule's reason
teaches people to widen the allowlist.**

**ADDED — `work_execution` (19).** The group this list exists for; nothing equivalent appears in any
earlier denylist because no earlier module consumed an external work order. technician, parts,
labour, crew, workorderschedule, maintenanceschedule, dispatchtime …

**ADDED — `monetary_type` (3), and it changes the SCAN.** The dispatch asked for "any monetary type",
not only a monetary name. `adjustment numeric(12,2)` carries money past every name-based term, so
this denylist scans **column types** as well as names — the first thing it does that the interest's
scan did not.

**MODIFIED — `allowedExceptions`.** `reference` kept; `summary`, `status`, `rating` added (all are
things PEMO legitimately holds *about* foreign work or a resident's judgement, not the work itself).
`source`, `unit`, `company` dropped as unused: **an exception nothing needs is an unexplained hole.**

**Bite:** `ALTER TABLE case_external_link ADD COLUMN cost numeric(12,2)` reds **both arms** — the name
and the type — which proves the type scan is independently load-bearing rather than decorative.

---

## HAND-KEPT LISTS TOUCHED — the inventory for the governance PID

**Seven edits across four files**, all to say the same two words twice:

| file | list |
|---|---|
| `modules/platform/src/migration/runner.ts` | `MigrationModule` union |
| `modules/platform/src/migration/runner.ts` | `KNOWN_SCHEMAS` array |
| `modules/platform/src/migration/runner.ts` | `FILE_PATTERN` regex |
| `modules/platform/src/db/module-db.ts` | `ModuleSchema` union |
| `apps/api/src/cli/cross-schema-scan.ts` | `MODULE_SCHEMAS` |
| `tests/integration/module-isolation.test.ts` | the schema inventory (×2 entries) |

The inventory test is the **one legitimate** member: it exists so that adding a schema is a decision
somebody writes down. The other four are the same fact five times, and **the count of places grows
with every module** — GEN-037 edited four of them for one schema; GEN-038 edited five for two.

**And the derived pair proved itself.** `010-grants.sql` and `grants-complete.sh`, converged at
GEN-037, picked up **both** new schemas with **no list edited**: 48 → 55 tables, `SELECT+INSERT` only.
A test asserts both schemas are present in the grant set, so the privilege assertion cannot pass
vacuously over a schema that was never granted — which is exactly how the GEN-037 defect hid.

---

## ACCEPTANCE — all ten, each bitten (dist rebuild FORCED after every restore)

| # | criterion | mutation | fired |
|---|---|---|---|
| 1 | supersession, both instances | drop each `UNIQUE(instance, version)` | cases 1 and 1b red |
| 2 | computed state, no UPDATE | — | Ticket → `reopened`, Case → `closed` only via a closing assertion |
| 2c | **external status never closes** | `case_current` derives state from `last_status` | case 2c reds |
| 3 | visibility filter | drop `AND visibility = 'resident_visible'` | case 3 reds — the internal note appears |
| 3b | visibility immutable | — | only `INSERT`/`SELECT` on both schemas, asserted non-vacuously |
| 4 | case_note unreachable | — | no `visibility`, no `author_kind`, no helpdesk reader |
| 5 | single-sourced link | `service_case` queries `helpdesk.ticket_current` directly | case 5 reds |
| 5b | **type-only cross import** | `import type … from '@pemo/helpdesk'` | boundaries FAIL |
| 6 | forbidden terms | `ADD COLUMN cost numeric(12,2)` | both name and type arms red |
| 7 | grants | revoke on `service_case` alone | check reds, 8 pairs named |
| 8 | vocabularies | rename `pending_verification` | both consumers named + immutability stated |
| 9 | display reference | — | per-org unique, ≠ stable id, free across orgs |
| 10 | `adrs-present` resolves ADR-020 | remove the file | FAIL, naming 4 citing sources |

### TWO BITES WERE FALSE FIRST, AND BOTH FOUND REAL DEFECTS

1. **The supersession tests were never testing supersession.** Both inserts reused one
   `assertion_id`, so the **PRIMARY KEY** rejected the duplicate — and the test **passed with the
   supersession constraint dropped**. It asserted the right message for the wrong reason. Fixed by
   giving the competing assertion a distinct id, which is the real race; the bite then fired on both
   instances.

2. **The GEN-037 dist hazard recurred — outside a bite, in the FULL SUITE.** Bite 5's mutated build
   survived into `pnpm test:integration`, which runs plain `tsc -b`, and the suite reported 383/384
   with a failure inside `case-reporters.js`. Source was clean; `dist` was not. **This is not only a
   per-bite discipline — it is a prerequisite for any run that follows one.** I force-rebuilt every
   module and the suite went 384/384. Further evidence for the ruling that `with-mutation.sh` must
   invalidate `dist` itself.

---

## THE GATE, from a from-nothing rebuild

| | |
|---|---|
| tables before | **0** |
| bootstrap | **49 migrations applied**, apply-grants, seed |
| contract | **105 / 105** |
| integration | **384 / 384** (371 + 13 new) |
| battery | **31 / 31** (30 + the case-vocabulary check) |
| boundaries | **PASS** — all four layers |
| validator / enums / notice-types / case-vocabularies | rc 0 / 0 / 0 / 0 |
| register | OK, next **039** |
| contract delta | **NONE** |

## Notes on judgement calls, disclosed

- **`reporter_ref` is nullable** (dispatch D3): anonymity is a schema fact, the policy is the write
  surface's. Forcing a reporter would make the model unable to hold a legitimate intake.
- **`due_at` is a fact, not a rule.** The SLA engine is out of scope; storing the promise without the
  engine is honest rather than incomplete.
- **`case_satisfaction` is per-TICKET, not per-Case.** Three neighbours on one Case each have their
  own view; a per-Case rating would have to average them or pick one. The surface is out of scope but
  the **grain** is not, because it is expensive to change later.
- **A query bug of mine, recorded:** I read an empty result as "the messages were not seeded" when a
  `GROUP BY` over a concatenated expression had errored into a suppressed stderr. The rows were
  there. Absence in a view is not absence.

## GAPS — this list is complete

1. **The close** — needs your filed `GEN-038-*-RULINGS-*`.
2. **Five hand-kept module lists** (above), already a first-class item of the closing governance PID.
3. **`with-mutation.sh` and `dist`** — already ruled; this PID is the second incident and the first
   outside a bite.
4. **`case_satisfaction`, `ticket_reference` and `case_external_link` are written by nothing** except
   the seed — surfaces are cut C, as scoped.
5. **OQ1 (restricted cases), OQ3 (household visibility), OQ4 (ticketless Cases)** are untouched, per
   the ADR's dispositions and the out-of-scope list.

Out of scope as dispatched and untouched: all write surfaces and routes, CAS-04 transport, CAS-05
restricted slot, CAS-06, the SLA engine, the overdue scheduler, a team entity, read projections, and
N2/N3.

**HARD STOP for the close ruling.**
