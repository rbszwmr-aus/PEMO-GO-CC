# GEN-037 — N1 notices schema (ADR-019 cut A) — build + merge report

**Merged.** `c33ff191` → **`0d0abbee44419f3e3027154300f95e8dd70c4f8a`**
**Tree-hash `6d82d0782d0ae4faff33d5a4ad5c4a93426697f3`** — local and remote EQUAL, remote re-read
via `git ls-remote` after the push. Refspec push, `main` never checked out, through the hook
(`30 passed, 0 failed`), no `--no-verify`. **PID id `GEN-037`** from the directory scan (next: 038).
**Date** 2026-09-02 (read from `date`).

**Carry-in:** pin matched `origin/main` exactly; ADR-002/003/011/013/014/015 all resolve;
ADR-019 carried in from the drive **before** any source cited it (D0).

**CONTRACT DELTA: NONE.** No `openapi.yaml` touched, no route, no write surface. The two new files
under `packages/api-contracts/` are the notice-type declaration and its generator — neither is a
published contract.

## THE CLOSE IS NOT DONE — no filed ruling

The register refuses (exit 6): no `reports/GEN-037-*-RULINGS-*`. The PID stays `draft`, and the
register emits its honest *merged-and-awaiting-close* warning. Same as GEN-035 and GEN-036: the
ruling records **your** authority to close, so writing it myself would certify nothing.

---

## D4 — WHAT THE AUDIENCE-RESOLVER SEARCH FOUND (the reported item)

**The dispatch's premise is half right, and the half that is wrong changed the design.**

| capability | state at the pin | conclusion |
|---|---|---|
| Location → units it **serves** | **EXISTS.** `modules/property/src/audience/serving-scope.ts::resolveServedUnits`. Home Safety consumes it through a port it declares in `ports.ts`, injected at `apps/api/src/wiring.ts:142`. | **Already at the correct boundary. No private copy.** Reused as-is. |
| units → **residents**, as at an instant | **DOES NOT EXIST ANYWHERE.** | The occupancy leg has no first implementation. |

`home_safety`'s `createAudienceResolver` resolves to a set of **unit ids** and never touches
occupancy — no `resident`/`household` reference anywhere in `modules/home-safety/src/audience/`.
`ResidentQueries` exposes only `getResident`, `listPreferences`, `getPass`.

So there was no second resolver to avoid inventing on the occupancy side, and the serving-scope side
already had an owner. **`home_safety` is untouched and behaviour-preserved**; no convergence follow-up
is owed, because there is no divergence — it consumes Property Core's capability, which is what
`notices` now does too.

The new capability is `createOccupancyAudience` in **`resident`**, which owns occupancy — not in
`notices`, which merely needs it. `asAt` is **required, not defaulted**: a default of `now()` would
make the correct call and the careless call look identical.

### A boundary correction the checker forced

My first version imported types from `@pemo/resident` into `notices`. The boundary check refused it —
`no-module-to-module`: a module depends on `@pemo/platform` and nothing else, and a **type-only**
import still creates the edge. `notices` now declares the port locally, exactly as `home_safety`
declares `ServingScopeLookup`, and the composition layer wires the implementation in N2. **The
architecture caught a design error before any test did.**

---

## THE HAND-KEPT-LIST CLUSTER — a finding, and a live defect it had already caused

Adding one schema meant editing **five** hand-kept module lists:

1. `FILE_PATTERN` in the migration runner
2. `MigrationModule` in the migration runner
3. `KNOWN_SCHEMAS` in the migration runner
4. `ModuleSchema` in `module-db.ts`
5. `MODULE_SCHEMAS` in `cross-schema-scan.ts`

**Two more had already rotted, together, and the rot was live:**

- `database/roles/010-grants.sql` granted over a hand-kept schema **array**, despite the file's own
  header saying *"Nothing is listed by name, so this cannot go stale"* — true of tables, false of
  schemas.
- `docs/governance/bin/grants-complete.sh` filtered by an **identical** hand-kept list.

The consequence, measured: `notices` was created, migrated and seeded with `pemo_app` holding **no
privilege on it at all**, and the completeness check reported `ok — 44 tables, SELECT+INSERT only`.
**It was green over a schema the application could not read.** A check that validates the grants
which EXIST cannot see a schema absent from its own list.

**Both now derive the set from ownership** (every schema `pemo_owner` owns). 44 → 48 tables. Proven:
revoking on `notices` now reds the check, naming all 8 pairs. The remaining five lists are a **named
R5b follow-up**, recorded in `cross-schema-scan.ts` rather than left to be rediscovered.

**A second grants finding, disclosed:** `010-grants.sql` is **additive only** — it GRANTs and never
REVOKEs, so it cannot restore the "no UPDATE anywhere" guarantee once breached. I found this by
granting UPDATE for a bite and watching `bootstrap.sh` fail to take it away. The **excess** arm of
`grants-complete.sh` does catch it (`append-only is eroding, and silently`). Detection holds;
restoration is manual. Not fixed here — changing a security file's revoke semantics is its own PID.

---

## ACCEPTANCE — all ten, each bitten

Bites through `with-mutation.sh` unless the subject is a database constraint, where the constraint
was dropped and restored instead.

| # | criterion | bite | fired |
|---|---|---|---|
| 1 | supersession | drop `UNIQUE(notice_id, version)` | case 1 reds |
| 2 | computed state, no UPDATE | grant UPDATE to `pemo_app` | case 2b reds |
| 3 | rule vs snapshot divergence | resolver uses `now()` not `$2` | case 3 reds |
| 4 | residential-only | `WHERE unit_class='residential'` → `WHERE true` | case 4 reds |
| 5 | serving scope | resolve via the physical parent instead | case 5 reds |
| 6 | module boundary | join straight into `resident.occupancy` | boundaries FAIL |
| 7 | idempotent ack | drop `notice_ack_unique` | case 7 reds |
| 8 | attachment ref | asserted: 0 FKs, declared `scan_status`, three unrelated `storage_ref` shapes accepted | — |
| 9 | type enum | rename a type in the declaration | both consumers named, DDL immutability stated |
| 10 | `adrs-present` resolves ADR-019 | remove the ADR file | FAIL, naming the 4 citing sources |

On **8**: the opaque `storage_ref` is asserted by accepting `s3://…`, `/var/lib/…` and `urn:…`
together — the ABSENCE of a constraint, without enshrining any one format, which a positive test
would have done.

On **10**: `adrs-present` counts *referenced* ADRs (18 → **19** once sources cite it), not files (25).
I verified that semantic rather than assuming it — an early bite renaming the ADR's **heading** did
not red, because resolution is by **filename**.

### THREE BITES WERE FALSE FIRST, AND EACH FOUND A HARNESS DEFECT

Recorded because the harness failing silently is worse than the subject failing loudly.

1. **A wrapper piped through `tail`**, so the exit status was `tail`'s. Bite 6 reported "not caught"
   on a tree the checker had correctly failed — `[merge-gate-precondition]`, gating on the wrong
   exit status.
2. **A shell function invoked via `bash -c`** did not exist in the subshell. Bites 3 and 4 "passed"
   because *command not found* is non-zero — a guard firing for a reason unrelated to its subject.
3. **THE ONE WORTH KEEPING: `with-mutation.sh` restores SOURCE, and a compiled artifact outlives the
   restore.** `dist/` kept the mutated build, and `tsc -b` decided incrementally that it was current
   — so a *rebuild* did not fix it either. My baseline silently ran against bite 4's mutation and
   reported 9/10. The runner now forces `tsc -b --force`. **Any future PID mutating compiled source
   must force a rebuild, or it measures the mutation instead of the tree.** `with-mutation.sh` itself
   is unchanged: it restores what it snapshots, and it does not know what a caller compiles.

---

## THE GATE, from a from-nothing rebuild

| | |
|---|---|
| tables before | **0** |
| bootstrap | **45 migrations applied**, apply-grants, seed |
| contract | **105 / 105** |
| integration | **371 / 371** (361 + 10 new) |
| battery | **30 / 30** (29 + the notice-type check) |
| boundaries | **PASS** — all four layers |
| validator / enums / notice-types | rc 0 / 0 / 0 |
| register | OK, next **038** |
| contract delta | **NONE** |

## Defects I introduced and fixed during the build, disclosed

- `node_kind`/`node_id` were `NOT NULL`, making a **Location-only target unrepresentable** and my own
  CHECK vacuous — the partial-floor-lift case could not have been expressed. Fixed; the migration had
  never left this machine, so the remedy was the established one: edit, then rebuild from nothing.
- The type CHECK was **missing entirely** from 0126 on first write; same remedy.
- Test 5 **passed vacuously** against the seeded population, where every seeded resident happened to
  sit on a served floor, so lift and block returned the same set. It now builds its own contrast —
  one resident on a served floor, one on an unserved floor of the same block.
- Test fixtures used `role = 'resident'` (not in the declared vocabulary) and omitted the
  `resident.resident` rows the within-module FK requires.

## GAPS — this list is complete

1. **The close** — needs your filed `GEN-037-*-RULINGS-*`.
2. **Five hand-kept module lists remain** (above). Named R5b follow-up.
3. **`010-grants.sql` cannot revoke.** Detection holds; restoration is manual.
4. **`notice_audience` is written by nothing yet** — that is N2, as scoped. The table and the
   resolver exist; nothing joins them.
5. **The OQ1 slot is unused and unresolved by design**, asserted as such.
6. **`with-mutation.sh` + compiled artifacts** — the caller must force a rebuild. Not a code change.

Out of scope as dispatched and untouched: N2, N3, routes, Notification delivery, emergency ingestion,
templates, resident cohorts, owner audience, object-store choice.

**HARD STOP for the close ruling.**
