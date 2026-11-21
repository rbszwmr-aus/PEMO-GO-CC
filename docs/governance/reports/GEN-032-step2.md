# GEN-032 — W3 batch 3b-ii: the atomic bootstrap (the genesis act)

**Status:** built, all green. **NOT COMMITTED. HARD STOP.**
**Pin:** `516dc6371f931b3c13a9bfcbb9267e3509513cec`, re-read at build start — identical to HEAD.

| gate | result |
|---|---|
| contract | **105 / 105** |
| integration | **342 / 342** (was 334 — **+8**), run **twice** |
| battery | **26 / 26** (the provisioning case is the 26th) |
| boundaries PASS · validator PASS · contract stamp PASS · index OK | on a from-nothing rebuild (41 migrations) |

**Contract version delta: `0.6.0` → `1.0.0`. MAJOR, breaking.**

---

## The PID id — dispatched as `W3-3b-ii`, allocated as `GEN-032`

**`W3-3b-ii` is not usable, and the reason is stronger than a format rule.** I created a probe file
`pids/W3-3b-ii.md` and ran the checker: it did **not** fault — it reported `OK … Next allocation: 032`.
**The register does not see the file at all.** `ID_RE` is `^(TYPE)-\d{3}$`, so a non-conforming name
sits *outside* the allocation authority Rule 1 defines (`pids/` + `archive/`), invisible to
`max(NNN)+1` and to the duplicate check.

So the PID is **`GEN-032`** and the commit tag is **`[GEN-032]`**, matching every prior close and the
archive row. `W3 batch 3b-ii` is the batch label, in the H1 and the archive note. **Deviation from the
box's `[W3-3b-ii]` tag, flagged rather than taken silently.**

## D5 — confirmed already enforced, no fix needed

`RegisterPrincipalInput` has **no** `identitySource` field, and the INSERT hard-codes `'external'`.
The genesis act does the same. **`recorded_seed` is unreachable from any runtime path**, which CASE 5
asserts against the shipped rows rather than against a type.

## D6 — the amendment carried, and it does not shadow its ADR

`docs/adr/ADR-008-AMENDMENT-field-removal-is-breaking.md`, `Accepted`, `Carried in by: GEN-032`. Its
H1 is `# ADR-008 AMENDMENT — …`, so the presence checker's ADR arm (`^# ADR-008\s+—`) does **not**
match it: **moving `ADR-008` itself out still reds**, proven, so the amendment cannot answer for the
decision it amends — the `GEN-017` hole stays closed.

**ADR-008 itself now points at it** in an `**Amended:**` line, following `ADR-010`'s convention: the
table is retained **verbatim** as the record of what it said, and the reader is told to read it *with*
the amendment. The amendment's general rule is carried into that line too — **"not listed in the table
is never a licence."**

## D1–D4 — the act

**Four assertions, one transaction, `committed`.** Principal → group → grant → membership, then the
audit. **The guard runs FIRST, before any INSERT, under the organization lock** — ordering that only
became load-bearing when the act grew to four writes: evaluate it later and a refused second attempt
leaves the orphans of its own writes.

**`source='provisioning'`, authority NULL**, which W1b's biconditional *enforces* rather than trusts.

**Idempotency: `exempt`, with the reason stated in code and contract.** The machinery is still used —
the primitive is where act and audit are made atomic — and every derived id is a pure function of the
`organizationId`, so a retry is byte-identical. **Exactly-once does not rest on it:** it rests on
zero-grants-**EVER** over an append-only relation.

## Proof — the five required cases, each biting

| case | evidence |
|---|---|
| **1** second provision → refused | ✔ 409 |
| **2** provision after the only grant was **ENDED** → still refused | ✔ and **weakening the guard EVER→LIVE reds it** |
| **3** 4th insert fails → all four + audit roll back | ✔ `{p:0,g:0,sg:0,a:0}` — **and the org is still provisionable**, which is the half a rollback test usually forgets |
| **4** concurrent double provision | ✔ exactly one wins, one grant landed |
| **5** no runtime path yields `recorded_seed` | ✔ asserted on shipped rows |
| genesis creates a **real** administrator | ✔ `effectiveAdministrators` = 1, and it is the recorded principal |
| the audit | ✔ `provisioning`, null authority, reason recorded |

## THE FINDING — the route's `committed` had no oracle, and a mutation proved it

I mutated `committed: () => true` onto the provisioning route and **all 341 tests stayed green.**

CASE 1 asserts only the status code, and GEN-028's standing zero-audit-rows oracle tests provisioning
**at the module**, which never reaches the primitive. **So nothing watched that route's declaration** —
the exact gap `[regression-tests-the-older-callers]` and the standing oracle exist to close, reappearing
at a site the oracle had deliberately routed around.

Reaching the refusal *through the route* needs care, and the care is the point: a repeat with the same
body **replays** on the derived key, and a repeat with a different body is a **fingerprint conflict** —
in both the act never runs. So the new case provisions at the **module** first (which writes no
idempotency record), then calls the route: no key is found, the act runs, and **the guard** refuses
inside it, which is where `committed` decides. It asserts zero audit rows **and** that the key is not
burned. **Re-run with the mutation: it reds.**

## Weight

**New:** the battery case (105), the principle entry, +8 tests.
**Changed:** `grant-commands.ts` (the four-part act), `server.ts` (route + derived ids), the contract
(`1.0.0`, 22 derived declarations restamped, lock rehashed), `ADR-008` (pointer), `grant-surface.test.ts`.
**No new migration** — `0124` already carried the schema.

## Gaps — complete

1. **`registerPrincipal` still has no route** — batch iii, with the standalone-authority ruling.
2. **The genesis act's group and principal ids are derived, not supplied** — deliberate (a retry must
   be byte-identical), but it means a caller cannot choose them, and a second organization cannot
   reuse a display name meaningfully. Not a defect; a consequence worth knowing.
3. **No fixture for the changed `ProvisionRequest`** — it registers via `emittedOnlyBy`, as the other
   management writes do.
4. **`1.0.0` is a major bump on a contract no client consumes yet.** Correct by the amendment, and
   worth saying plainly: nothing broke in practice.

**HARD STOP. Nothing committed.**
