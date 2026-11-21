# GEN-039 — cut A closing governance — build + merge report

**Merged.** `d164cca7` → **`c02b7c51babc74132a2239701b7ef9f1a2a0012f`**
**Tree-hash `275dc01a6a5ebe37e2ad38aa8748a56f804dce74`** — local and remote EQUAL, remote re-read via
`git ls-remote` after the push. Refspec push, `main` never checked out, through the hook (31/0), no
`--no-verify`. **PID `GEN-039`** from the directory scan (next: 040). **Date** 2026-09-02.

**Carry-in:** pin matched exactly. Both principle ids this dispatch defines were correctly ABSENT
beforehand; `[mutate-to-the-plausible-wrong-rule]` and `[destructive-target-confirmed]`, which it
cites as existing, both RESOLVE. No dangling citation at dispatch.

**CONTRACT DELTA: NONE.** No migration, no schema change either. **No production database was
reachable from any step** — every act named `127.0.0.1:55478`, derived from `database/dev/.env`.

## THE CLOSE IS NOT DONE — no filed ruling

No `reports/GEN-039-*-RULINGS-*` exists. The PID stays `draft`.

---

## G2 — THE PER-TABLE SWEEP (mandatory report)

**The expected vacuity was not there. Something quieter was.**

| table | had a duplicate-version test? | distinct assertion id? | verdict | now bites? | constraint sound? |
|---|---|---|---|---|---|
| `access.scope_grant` | yes — `access-scope-model.test.ts` | **yes** (`sgra_overlap_probe` vs a seeded uuid) | not vacuous | **yes** | **yes** |
| `notices.notice` | yes — `notices-origination.test.ts` | **yes** (`nota_t_dup_1`/`_2`) | not vacuous; regex was loose | **yes** | **yes** |
| `helpdesk.ticket` | yes — corrected at `GEN-038` | yes | already fixed | **yes** | **yes** |
| `service_case.service_case` | yes — corrected at `GEN-038` | yes | already fixed | **yes** | **yes** |
| `access.group_membership` | **NONE** | — | **NO COVERAGE** | **yes** (new) | **yes** |
| `resident.occupancy` | **NONE** | — | **NO COVERAGE** | **yes** (new) | **yes** |
| `notices.notice_audience` | n/a | — | **not a supersession key** — `(notice_id, publishing_version, resident_id)` is one-row-per-recipient-per-publication. Named and excluded explicitly. | n/a | n/a |

**No stop condition. Every constraint is sound.** All six were dropped in turn and every corrected
test red; all six restored green.

**The finding is the two blanks.** `GEN-038`'s ruling anticipated vacuous tests; what the sweep found
on two AUTHORITY tables was **no test at all**. That is quieter than vacuity — a vacuous test at
least presents a passing line somebody can inspect, whereas absence presents nothing. `scope_grant`
and `notices` were already correct, so the ruling's premise held for one class and not the other.

**The sweep derives its own membership** from `pg_constraint`, because a hand-kept list is what let
two tables go uncovered. The INSERTs cannot be derived — each table has its own NOT NULL columns — so
they are declared and **cross-checked against the derived set**: a new assertion table appears in the
catalogue, has no prober, and the file reds until someone writes one.

### A near-miss worth recording

Three probers first failed **against the unmutated schema** — G2's literal stop condition. Reading
the error instead of the exit status showed a FOREIGN KEY refusing the *first* insert, so the second
was never the thing being refused. A prober defect, not a subject defect. Reporting *"the supersession
constraint is unsound on `access.scope_grant`"* would have been a serious false alarm on an authority
table, and the exit status alone could not tell the two apart.

---

## G1 — the harness, proven both ways

`with-mutation.sh` now finds the workspace package owning the mutated file, deletes its `dist/` and
`tsconfig.tsbuildinfo`, and rebuilds — **after applying the mutation** (so the check sees a real build
of the mutant) and **again after restoring** (so nothing downstream picks it up).

**Deleting the tsbuildinfo is the load-bearing part.** `cp -p` restores the ORIGINAL mtime, which is
*older* than the build output, so `tsc -b` concludes `dist` is current and rebuilds nothing. A rebuild
alone does not fix it; invalidation does.

**BITE — the GEN-037 incident reproduced with no manual rebuild anywhere:**

| | result |
|---|---|
| baseline, clean tree | 10/10 |
| bite through the fixed script | caught; run AFTER it, still no manual rebuild → **10/10** |
| **invalidation removed from the script** | run after → **9/10, `dist` missing the filter** — the exact GEN-037 signature |
| restored | 10/10 |

A package with no build script is left alone, which is correct: `.sql`, `.json` and `.mjs` mutations
have no compiled artifact to invalidate.

---

## G3 — five lists become one declaration

`modules/platform/src/module-registry.ts` declares `ALL_SCHEMAS` once. Derived from it:
`MigrationModule`, `KNOWN_SCHEMAS`, `FILE_PATTERN` (runner), `ModuleSchema` (module-db),
`MODULE_SCHEMAS` (boundary scanner). **`@pemo/platform` is the one package everything already depends
on**, so this adds no edge the boundary check would refuse, and the migration runner — which decides
which files may exist at all — already lives there.

**The schema inventory test remains the SOLE declared member**, and it is what compares the
declaration to the schemas that actually exist. A declaration can still be wrong about the world.

**BITES:** adding `probe_schema` to the one declaration → all derived consumers see it, no other file
edited. Removing a real schema from the inventory test's list → it reds.

**An escaping defect, caught by the inventory test:** `\d` inside a JS template literal is the letter
`d`. The computed `FILE_PATTERN` compiled cleanly and **matched no migration at all**; the test failed
with `does not match NNNN_<module>_<slug>` and named it. Fixed to `\\d`, and the note is in the source
beside it.

---

## G4 — reconciling grants, with a gate keyed to its value

`010-grants.sql` grants what is missing **and revokes what exceeds SELECT+INSERT**. Previously it
could only add, so `bootstrap.sh` could not undo an excess privilege — `GEN-037` found that by
granting UPDATE for a bite and watching bootstrap fail to remove it.

**DISCRIMINATED, not inferred.** The same excess was run under three values, because "production did
not revoke" is also what an unset variable produces — the right outcome for the wrong reason:

| `pemo.env` | excess before → after | outcome |
|---|---|---|
| `production` | 5 → 5 | left in place |
| *(unset)* | 5 → 5 | left in place |
| `development` | 5 → **0** | revoked |

So the gate is keyed to the VALUE, and unset behaves like production — the safe default, because **a
missing setting must never read as permission.** In production the excess is reported and
`grants-complete.sh` fails on it: a loud refusal beats silently removing a privilege production may
be relying on.

---

## G5 — two principles

`[correlated-lists-certify-nothing]` and `[a-check-fails-for-its-own-rules-reason]`, both with the
distinctions the file requires. Principle count 68 → **70**.

**The guard caught me citing a third that does not exist here.** I wrote it in citation syntax — `verify-dont-infer`, a
name from my own memory index, not this corpus. **Third occurrence in this chain** (`GEN-026`,
`GEN-037`, now), and `adrs-present` caught all three. I replaced it with `[patch-verify-on-disk]`,
which does exist and is the right neighbour, rather than defining a principle to make a citation valid.

**`destructive-target-confirmed`'s Section 0 sharpening was not supplied**, so per the dispatch it is
not added and remains adopted practice.

---

## THE GATE, from a from-nothing rebuild

| | |
|---|---|
| tables before | **0** |
| bootstrap | **49 migrations**, apply-grants (reconciling), seed |
| contract | **105 / 105** |
| integration | **391 / 391** (384 + 7 sweep cases) |
| battery | **31 / 31** |
| boundaries | **PASS** |
| validator / three generators | rc 0 |
| register | OK, next **040** |
| contract delta / migration / schema change | **NONE** |

## GAPS — this list is complete

1. **The close** — needs your filed `GEN-039-*-RULINGS-*`.
2. **`verify-dont-infer` has no corpus equivalent** (backticked, not bracketed: the guard reads
   bracket syntax as a live citation and refused this very report for naming what it caught). I used `[patch-verify-on-disk]` for the
   distinction, which is about a tool's self-report rather than about inference generally. If the
   corpus wants a measure-don't-assume principle, it does not have one; not proposed here.
3. **The reconcile gate trusts `PEMO_ENV`.** A misconfigured non-prod value pointed at production
   would revoke there. That is the `[destructive-target-confirmed]` family, and the standing
   unruled sharpening is the right place for it — flagged, not fixed.
4. **Four `|duplicate key` regex alternatives remain** elsewhere (`audited-write`, the ack and
   display-reference tests). Those assert non-supersession constraints, so they are outside G2's
   scope; each would still pass on a PK violation. Named, not swept.

Out of scope as dispatched: cut B/C; the 55433 role model; an ADR-011 scan-scope extension.

**HARD STOP for the close ruling.**
