# GEN-034 — R5: governance conventions, from memory to enforcement

**Status:** built, all green. **NOT COMMITTED. HARD STOP.**
**Pin:** `0991a539203cd6104757d9c11ec267423601c2a3`, re-read at build start — identical to HEAD.

| gate | result |
|---|---|
| contract | **105 / 105** |
| integration | **352 / 352** (was 351 — **+1**, I6) |
| battery | **27 / 27** (the enum-projection case is the 27th) |
| boundaries PASS · validator PASS · stamp PASS · index OK | on a from-nothing rebuild |

**Contract delta (I6): `1.1.0` → `1.2.0`, MINOR** — additive: `removeMembership`'s response now
carries the pair it acted on. Nothing removed, nothing narrowed.

---

## I1 — a non-conforming `pids/` stem now FAULTS

```
[exit 2] pids/not-an-id.md: stem 'not-an-id' is not <TYPE>-NNN, so the allocator CANNOT SEE IT
         — it is outside pids/+archive/ as an allocation authority (global rule 1), invisible to
         max(NNN)+1 and to the duplicate check. Rename it to the id the register allocates; a
         batch label belongs in the title, never in the filename.
```

**`archive/` keeps the silent skip, deliberately** — it holds `PID-INDEX-ARCHIVE.md` and other
generated companions that are not PIDs and never were. `pids/` holds nothing but PIDs, so anything
else there is a mistake. **Bite proven both ways:** the probe faults naming the file; removing it
returns `OK`.

## I2 — the `-RULINGS-` convention is discoverable

The message now names **the literal pattern** and says what goes wrong: *a ruling filed under another
name (e.g. "-CLOSE-") is invisible to this check*. And rule 7 in `00-START-HERE.md` now carries it,
with the observation that **the refusal was previously the only place the convention was written
down** — which is how `GEN-032` met it, mid-close, with the PID already archived.

## I3 — the enum is generated, and the battery checks it

`packages/api-contracts/generate-enums.mjs`, wired as `pnpm gen:enums` / `check:enums`, plus a
battery case. **The projection is a pure function of the registry**, so it is idempotent — asserted,
not assumed.

**Proven by adding a registry entry:** `check:enums` reds (`FAIL — 1 surface enum(s) drifted`), the
fixture validator reds on the same drift, `gen:enums` fixes it, both pass. Reverted, still green.

**The point is the remedy, not the check.** The validator already caught this; what it told you to do
was *hand-edit a generated block from memory*. `GEN-027` did it and `GEN-033` forgot — **a generation
step performed from memory is a step that will be skipped.**

## I4 — `[mutate-to-the-plausible-wrong-rule]`, and `[delegation-floor]` confirmed present

The entry records all three ways a deletion is the weaker probe, each of which this corpus has met:
it may **not compile** (`GEN-033`'s registration floor — the witness requirement and the org-node
coverage are one statement); it may red **for an unrelated reason**; and it may **not be a defect
anyone would ship** (`GEN-027`'s zero-grants-EVER weakening left 298 tests green because the mutation
itself was wrong). **Distinguished from `[probe-must-bite]`** by which half is in doubt: there whether
the probe changed the input at all, here whether what it changed it to is the defect the guard exists
to stop. **A probe can bite perfectly and still prove nothing.**

## I5 — DISAMBIGUATED, and the sigil was not available

**The sigil is impossible, and the number is the argument: 176 of the corpus's 275 citations live in
`reports/` and `archive/`, which are Rule-7 records and are never edited.** A migration that cannot
touch two thirds of its subject leaves both forms in circulation and resolves nothing. Reported
rather than attempted.

**So resolution is against the OTHER NAMESPACES, derived from their own sources at scan time:**
Problem.type slugs from `problem-types.json` (31), validator failure codes from `validate.mjs` (73).
A bracketed token that IS one of those is a **mention**. Nothing is hand-listed, so a new code or slug
is covered the moment it exists.

**The allowlist was the wrong cure and the mutation shows why.** Hand-listing the one id that bit
`GEN-033` — the plausible wrong rule — passes that case and **still reds on `[bilingual]`**, a
different validator code. The derived namespace passes both.

**Both directions in the battery:** a bracketed non-principle in prose passes; a genuinely undefined
principle in citation form still fails.

**A vacuity refusal guards the derivation itself:** if neither source resolves, the check fails rather
than silently excluding nothing.

**And it caught its own documentation.** My first draft of the explanation wrote the citation form out
in prose, and the checker flagged `adrs-present.sh` as citing an undefined principle — **the fourth
instance of the class the file's own header already records** (the npx ban matching its own text; the
`GEN-011` exemption reason; the merged-but-draft warning on its own allocation). Fixed at the source,
as that header prescribes: the shape is described, not written.

## I6 — the response carries the pair

`removeMembership` returned empty strings for the group and the person it had just separated. The
command resolves the instance anyway, so carrying them costs nothing. **The replay path re-derives
them by READING THE ACT** (`ADR-015` `D4`) rather than echoing the request — asserted, because
echoing would have been the easy wrong answer.

## Weight

**New:** `generate-enums.mjs` (95). **Changed:** `pid-index.mjs` (+I1/I2), `adrs-present.sh` (+I5),
`prove.sh` (+1 case), `00-START-HERE.md`, `PID-PRINCIPLES.md` (+1 entry), `membership-commands.ts`,
`server.ts`, the contract (`1.2.0`, restamped), `package.json`, one test.

## Gaps — complete

1. **A typo of a foreign id passes as a mention.** The cost of namespace resolution, and it is the
   right way round: those namespaces have their own checks, and a false alarm here blocks a close
   while a missed typo in prose does not. Stated in the script.
2. **The foreign-namespace derivation reads `validate.mjs` by grepping `fail('…')`.** If that call
   shape changes, the derivation silently narrows — the vacuity refusal catches a total failure, not a
   partial one.
3. **`gen:enums` is not run automatically** — the battery notices drift, it does not fix it.
4. **R5b is untouched**, as scoped: the LIKE-escape sweep, fixtures `ON CONFLICT`,
   derive-refusing-commands-from-types, `with-mutation.sh`.

**HARD STOP. Nothing committed.**
