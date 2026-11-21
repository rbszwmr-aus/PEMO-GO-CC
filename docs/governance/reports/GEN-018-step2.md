# GEN-018 Step 2 — batch [C+F]: the principle corpus codified

**Status:** built, proven, **NOT COMMITTED. HARD STOP.**
**Headline:** the seven principles are written with stable ids, **all 55 entries carry one** rather than only the new ones, and every legacy numeric citation resolves. **No live citation needed updating** — all five sit inside Rule-7 records — so the map is the whole of the resolution, by design rather than by omission.

---

## 1. Pin and state

| | |
|---|---|
| **Pin** | `b34eccb026b46c98abe1d80203b9f9d6c915cf36` (Step 1) |
| **`main`** | `c3ce4c0735c84b019d86c0d7b4d331b9b7dfa1f4` — the allocation only. **Nothing since.** |
| **Unmoved, as a pure-doc batch must leave them** | battery **22/22** · suite **343** · boundaries `PASS` · validator PASS · index OK · ADR check 13/13 |

## 2. The F scheme

An entry carries a stable id in backticked brackets — `` `[frozen-axis]` `` — and a report cites the id, never a paragraph, a position or a number. Three rules, each stated in the file with the defect it comes from:

- **An id is permanent** — never changed, never reused, even when the entry's wording is amended. `[destructive-target-confirmed]` gained an ordering clause in `GEN-012` and kept its id, so every earlier citation still resolves.
- **An id names the principle, not its position.** Positions moved on every addition, which is precisely why the numeric citations stopped resolving.
- **An entry acquires its id when it is written**, not when it is first cited.

**That third rule is why I gave ids to all 48 existing entries, not only the seven new ones.** A scheme applied to part of a file is the failure `docs/adr/README.md` already recorded about its own header fields — *"a rule that ships with standing exceptions … reads as a suggestion, and the next author correctly infers that skipping the field is normal."* Partial ids would also make batch A's citation check unable to distinguish "cites an id that does not exist" from "cites an entry that has no id yet". **55 entries, 55 unique ids, verified no duplicates.**

The insertion was a **prefix only** — no existing principle's text was touched — so the diff is auditable line by line.

## 3. The seven principles

| id | section | where it bit |
|---|---|---|
| `[patch-verify-on-disk]` | On proving | `GEN-014` (shipped a stale `info.summary` for a whole PID), `GEN-015`, `GEN-016` |
| `[identity-by-self-declaration]` | On proving | `GEN-017` — and the hole was introduced by the same commit that carried the acceptance records in |
| `[shadowed-layer-empty-oracle]` | On proving | `GEN-013` — thirteen tests green over the deleted filter |
| `[teardown-isolation]` | On proving | `GEN-014` (`ctc_%` destroyed the seeded contacts), `GEN-015` |
| `[assert-the-isolation-level]` | On data and the world | `GEN-016` — the advisory lock works only under `READ COMMITTED` |
| `[constraint-violation-never-500]` | On boundaries and homes | `GEN-016` — `UNIQUE` bit correctly and surfaced as a server fault |
| `[merge-gate-precondition]` | On boundaries and homes | `GEN-013` — the push gated on the commit, not the generator |

Each names the incident rather than the rule alone, per the file's own standing requirement that a principle arrives with the defect that earned it. Three of the seven — `patch-verify-on-disk`, `teardown-isolation`, `shadowed-layer-empty-oracle` — record **my own** repeated failures, and say so.

## 4. The legacy map — all five resolve, none declared unresolvable

Resolved from each citation's **context**, not guessed:

| cited as | resolves to | evidence used |
|---|---|---|
| principle 2 | `[guard-false-positive-rate]` | `GEN-008-RULINGS-step2`: *"a 100% false-positive that principle 2 names"* |
| principle 10 | `[first-red-is-diagnosed]` | `GEN-003-v1.1-RULINGS-step2`: *"the first CI run is the experiment, per principle 10"* |
| principle 11 | `[principle-is-not-a-control]` | `GEN-012-RULINGS-step2`: *"that recurrence is principle 11's signal"* |
| principle 12 | `[negative-test-disarmed]` | `GEN-008-RULINGS-step2`: *"principle 12 exactly, a negative test the environment neutralised"* |
| principle 43 | `[destructive-target-confirmed]` | `GEN-010-RULINGS-step2`: *"principle 43's ordering amendment"* |

Each target verified to exist **exactly once** in the file.

**R5's "update live citations" has zero instances, and I am reporting that rather than silently doing nothing.** Every `principle N` citation in the repository — 17 of them across 14 files — is inside `docs/governance/reports/` or `archive/`, which are immutable. The map is therefore not a fallback for the ones I could not reach; it is the entire mechanism, and the file says so.

## 5. Proof

A pure-doc batch cannot be proven by a red of its own — that is batch A's job, and I did not build it here. What I could verify, I did:

- **55 ids, 55 unique** — no collisions.
- **All five legacy targets** resolve to exactly one definition each.
- **All seven new ids** present exactly once.
- **GEN-012's reconciliation re-run as a regression check on my own edit**: all 21 marked principles still present exactly once, 0 anomalies. That is the assertion that would have caught a prefix insertion mangling an entry.
- **Every gate unmoved** — 22/22, 343, PASS, PASS, OK. A pure-doc batch that moved a gate would be a finding.

## 6. Weight

**One file.** `PID-PRINCIPLES.md`: 68 → 104 lines, 48 → 55 principles. No code, no schema, no contract, no test.

**Lighter than any batch so far, and the effort was in the two judgements**, not the typing: resolving the five legacy numbers from context rather than assuming, and deciding that a partial id scheme would repeat a failure this repository has already recorded.

## 7. Gaps — this list is complete

1. **Nothing enforces that a cited id resolves.** By design — batch A. Until it lands, this file is exactly what §2's own text calls it: a document that cannot notice a citation which has stopped resolving.
2. **The legacy map is content-matched, not mechanically derived.** Five judgements from citation context. I show the evidence for each; a sixth historical number, if one exists in an artifact I did not scan, would not be covered.
3. **I did not verify the seven are seven distinct principles.** Step 1 flagged this and I still have not disproved it — `[shadowed-layer-empty-oracle]` and `[teardown-isolation]` are both "a test that cannot fail", and `[patch-verify-on-disk]` and `[merge-gate-precondition]` are both "an unchecked exit status". They differ in *where* they bite, which is why I kept them separate, but a reader could reasonably merge either pair.
4. **The ids for the 48 existing entries are my derivations from their lead phrases.** Nobody has reviewed them, and once cited they are permanent by rule 1.
5. **`[hazard-window-mutation]`, `[probe-passes-on-permission]` and the other GEN-012 carries kept the ids I minted here** — they had none before, so there is no prior citation to break, but they were named in the same pass rather than by their authoring PID.

## 8. Rulings sought

1. **§7.3** — are the two near-pairs genuinely distinct, or should either be merged before ids become permanent?
2. **§7.4** — the 48 derived ids: accept, or review any?
3. **Commit** — nothing beyond the allocation is committed.

**HARD STOP.**

---

# Addendum — the near-pairs settled before merge

Ruled: the seven are seven, with a distinguishing note per near-pair naming the axis that separates them.

**Four notes, not two** — one on each side of each pair, so the distinction reads correctly whichever entry a reader arrives at first. A note on only one side would leave the other silently ambiguous, which is the same asymmetry that made permanence risky in the first place.

- **`[shadowed-layer-empty-oracle]` ↔ `[teardown-isolation]`** — the axis is what fails: the **assertion has no teeth** (a mutation survives green) versus the **fixture or shared state is corrupted** (false breakage, or a leaked pass). *This one breaks other tests; that one lets its own pass mean nothing.*
- **`[patch-verify-on-disk]` ↔ `[merge-gate-precondition]`** — the axis is the fix: trusting a tool's **self-report of its own effect** (observe the artifact on disk) versus gating on the **wrong exit status** (wire the gate to the status that matters). Same root, different sites, different remedies.

**With these, the seven ids are final and batch A may cite them.** 55 ids, still unique. Gates re-verified after the edit and unmoved.
