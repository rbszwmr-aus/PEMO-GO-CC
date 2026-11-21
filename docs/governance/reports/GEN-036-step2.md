# GEN-036 — R5b code-hygiene sweep — build + merge report

**Merged.** `c91cd9e8` → **`dd693c8a1f3f34316f1820cfb411e12857aa357d`**
**Tree-hash `a8a2b06cf726a08572357eab79c161cf00e18eed`** — local and remote EQUAL, remote re-read
via `git ls-remote` after the push. Refspec push from the worktree, `main` never checked out,
through the hook (`29 passed, 0 failed` / `gate passed`), no `--no-verify`.
**PID id** `GEN-036`, allocated from the directory scan (`--next` → 036; now 037).
**Date** 2026-09-01 (read from `date`).

**Carry-in check (GEN-026 practice):** the one bracketed id this dispatch cites,
`[destructive-target-confirmed]`, resolves in `PID-PRINCIPLES.md`. No dangling citation.

## THE CLOSE IS NOT DONE — same reason as GEN-035

The generator refuses with **exit 6**: no `reports/GEN-036-*-RULINGS-*` exists. I enumerated the
repo's `reports/` and the drive's: `GEN-036-spec-r5b-code-hygiene.md` is there, no `-RULINGS-` file
is. I reverted the close and left the PID at `status: draft`, where the register emits the honest
`merged-and-awaiting-close` warning. **The ruling is yours to file; writing it myself to satisfy a
gate on my own work would certify nothing.**

## CONTRACT DELTA: NONE — stated explicitly, as asked

`packages/api-contracts/` and every `openapi.yaml` are untouched (`git status` empty for both).
No migration. This PID is tooling and internals only.

---

## H1 — LIKE escaping

**A deviation from the dispatch, measured before building.** H1 as worded forbids a LIKE built by
raw interpolation. At the pin the tree contained **0** of those — so that rule alone **could not have
failed on this repository**, and a guard that cannot fire is what H5's own text calls the vacuity
problem. What it *did* contain was **45 unescaped `_` patterns** across 18 files: the class that bit
at `GEN-014` (a teardown deleted rows a test did not own) and again at `GEN-029` (`grp_w3_%` matched
`grp_w3g_admins`). Both times the remedy was a hand sweep — the suggestion `R5b` exists to retire.

I built **both** rules rather than asking, because the asymmetry is one-sided: the broad reading does
strictly more correct work if you wanted narrow, whereas the narrow reading ships a guard that cannot
bite. `A1` is prevention, `A2` is the live hazard.

- `modules/platform/src/db/like-pattern.ts` — `likePattern`, `likePrefix`, `likeContains`,
  `likeEscapeClause`. The backslash is escaped FIRST; escaping `_` first would turn `\_` into `\\_`,
  a bug no test of ordinary identifiers would notice. Asserted directly.
- `docs/governance/bin/like-escape.sh` — enumerates every LIKE and requires each to account for
  itself: `ESCAPE`, or a `-- like-wildcard: <reason>` marker **scoped to the statement** (bounded
  8-line lookback, stopping at a blank line or `;`, so a marker cannot leak into the next statement).
- **42 call sites fixed**, each judged individually rather than rewritten mechanically.

**Two things the check caught in its own authors' work**, both fixed at the source rather than
allowlisted: it flagged **its own documentation** and two test files that describe the bug they
prevent — so the scope now excludes comment lines, via an ANCHORED discriminator (`^\s*(\*|//|#)`),
classifying the line's ROLE rather than whether the characters appear on it. And it flagged the one
query in `like-pattern.test.ts` that is deliberately unescaped because the wildcard IS its subject —
which is precisely what the marker exists for, so the marker is what that line now carries.

**BITES** (via `with-mutation.sh`): raw interpolation → `A1` reds. Dropping `ESCAPE` → `A2` reds.
Runtime: a built prefix reaches only `grp_h1_target`; unescaped, the same pattern also reaches
`grp_h1x_neighbour` — the `GEN-029` failure, written out rather than described.

## H2 — fixture idempotency

**A second measured deviation.** The dispatch asks that EVERY fixture insert carry `ON CONFLICT`.
Measured: 259 inserts, **224 without it** — and a check demanding it would have been wrong on nearly
all of them. `ON CONFLICT` is a MECHANISM; idempotency is the PROPERTY, and this repository already
achieves it three ways:

| mechanism | count | why it is legitimate |
|---|---|---|
| `ON CONFLICT` | 35 | the ordinary layering fixture |
| `DELETE`-first | 222 | the scenarios, whose header says they "REPLACE rather than layer" — **more** idempotent than `DO NOTHING`, since it also removes rows an older version left behind |
| temp table | 2 | `block_basis` et al are `ON COMMIT DROP` scratch; a conflict clause would assert nothing |

`fixtures-idempotent.sh` derives the property and names the mechanism. Ground truth: a second
`pnpm seed` exits 0.

**A defect the bite found in my own check.** The first mutation commented out an `ON CONFLICT` and
the check still passed — it was reading commented-out SQL as live SQL, so it reported the mechanism a
file *used to* have. Comments are now stripped before anything is judged. **BITES:** removing
`ON CONFLICT` reds it; removing the DELETE-first mechanism reds 6 inserts in that file.

## H3 — the refusing-command set, derived from the types

`modules/access/src/authority/refusing-commands.ts`. `RefusalKind = GrantRefusal |
MembershipRefusal | RegisterRefusal` — a kind added to any command's own refusal type widens it with
no edit here. `ALL_REFUSAL_KINDS` is held to the union by `Exclude<…>` in the `SCOPE_ROLES` idiom
this corpus already uses, so the bite is a **compile error**, not an assertion: a list a test checks
can be wrong between runs; a list the compiler checks cannot be wrong at all.

**It worked before its test existed:** I wrote `'no-administrator-grant'` from memory and the
compiler named the real kind, `'not-an-administrator'`.

**BITE:** adding a refusal kind to `MembershipRefusal` and forgetting the array →
`TS2322: Type 'true' is not assignable to type 'a-new-refusal-kind'`. **The first attempt at this
bite fired for the WRONG reason** — a literal `\n` in the mutation made it a syntax error
(`TS1127: Invalid character`), not the exhaustiveness guard. Re-run with a real newline; the error
above is the guard firing for its own reason.

## H4 — `with-mutation.sh`

`with-mutation.sh <file> <from> <to> [--expect-red|--expect N] -- <command...>`

The mutation lands on the live file (the check must see a real tree); the restore comes from a
**byte snapshot taken seconds earlier**, never from HEAD. Trapped on `EXIT INT TERM HUP`, and the
restore is **verified by checksum** — a restore that silently fails is worse than none, because it
leaves the mutation in place while reporting success. A mutation whose `<from>` is absent, or which
leaves the file unchanged, is **refused with its own exit code** before the command runs: a check
passing over an unchanged file is the most dangerous green there is.

**ACCEPTANCE, proven rather than asserted.** I reproduced the `GEN-029` scenario on a real tracked
file: added uncommitted work, ran a mutation through the script, and confirmed afterwards that the
uncommitted marker was **still present** and the mutation **gone**. `git checkout` would have left
the marker count at 0. Then I killed the run mid-flight (`kill -TERM` between mutation and restore)
and the file came back **byte-identical**, tree clean. Every bite in this PID ran through it.

## H5 — validator codes, declared

`GEN-034` gap 2. The derivation grepped `fail('<code>'` out of `validate.mjs`: **120 calls, 73 codes
resolved.** The missing ones then read as dangling principle ids in `adrs-present.sh`, and the
vacuity refusal could not see it — the derivation had not resolved NOTHING, it had resolved MOST.

`tests/fixtures/validator-codes.mjs` declares the 73; `adrs-present.sh` reads the declaration;
`validate.mjs` throws on an undeclared code.

**The first completeness check I wrote was circular** — it looped over the declaration comparing each
entry to a set built from that same file, so a mutation renaming a code passed it. Measured, then
removed rather than patched. What remains in the shell check is the one thing it can honestly assert
about a file it also consumes: a truncation refusal and a duplicate refusal. The real cross-check
moved to `validator-codes.test.ts`, which compares the declaration against the call sites **in both
directions** — used-but-undeclared (the original defect) and declared-but-unused (a stale allowlist,
which reads as a source of truth while describing something gone).

**A limit I hit and am naming:** runtime enforcement inside `fail()` only covers codes that actually
fire, and in a green run most never do. That is why the static both-directions test is the real
guard and the throw is defence-in-depth. **BITE:** renaming a declared code reds both directions.

---

## THE GATE, from a from-nothing rebuild

Through `database/bootstrap.sh --with-seed`, which derives its target from `database/dev/.env`.

| | |
|---|---|
| tables before | **0** |
| bootstrap | **41 migrations applied**, apply-grants, seed — ok |
| contract | **105 tests, 105 pass, 0 fail** |
| integration | **361 tests, 361 pass, 0 fail** (354 + 7 new) |
| battery `prove.sh` | **29 passed, 0 failed** (27 + H1 + H2) |
| register | OK, next allocation **037** |
| `check:enums` / fixtures / boundaries | rc 0 / 0 / 0 |
| contract delta | **NONE** |

One integration case failed on its first run and is worth recording: my expected row ORDER was wrong
(`_` at 0x5F sorts before `x` at 0x78). The substance held — both rows matched, proving the
over-reach — so the fix was to compare as a SET, since collation is not that test's subject.

## GAPS — this list is complete

1. **The close** — needs your filed `GEN-036-*-RULINGS-*` ruling.
2. **`[destructive-target-confirmed]` sharpening** — not supplied, so per the dispatch's NOTE it
   rides as a **one-line follow-up** and is NOT in `PID-PRINCIPLES.md`. Adopted as practice already.
3. **`like-escape.sh` does not read `.sql` migrations** — deliberate and stated in its header: their
   patterns carry no caller input and are immutable once applied, so a finding could not be acted on.
   The scenario seeds' own `DELETE … LIKE 'evt_hs_%'` is therefore unescaped and unflagged.
4. **`fixtures-idempotent.sh` is the static half.** It reads text and can be fooled by SQL it does
   not parse; a string literal containing `--` would be misread. The ground truth is the seed running
   twice.

Out of scope as dispatched and untouched: notices/cases; converging 55433 to two-role.

**HARD STOP for the close ruling.**
