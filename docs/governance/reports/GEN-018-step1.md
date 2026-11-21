# GEN-018 — Step 1: the C2 inventory and a proposed batching

**Status:** inventory and proposal. **Nothing built.** HARD STOP.
**Three headlines.** **`AM4` is the only unresolvable amendment reference in the repository** — every other one resolves, so A's check would red on exactly one thing today, and its single reference is in a *principle*, not in code. **B has no live instance left** — the class bit three times and all three are fixed; B is prophylactic, and I would rather say so than sell it as a live bug. And **D cannot be fully enforced from the repository**, because the only thing that can block a push is a client-side hook and `.git/hooks` is not versioned; §D states the honest shape.

---

## 1. Pin and allocation

| | |
|---|---|
| **Pin** | `b34eccb026b46c98abe1d80203b9f9d6c915cf36`, re-read from the remote and equal to HEAD, tree `bd57b4bd…`, 849 files |
| **Number** | **018**; next is 019 |
| **`main` now** | `c3ce4c0735c84b019d86c0d7b4d331b9b7dfa1f4` — the allocation |

---

## A. `ADR-003` `AM4` + amendment-granularity check

**Reference status, reported first as instructed: referenced, and absent — but referenced exactly once, from a governance document.**

`docs/governance/PID-PRINCIPLES.md:61` cites *"`ADR-003` `AM4`'s Location-identity rule"*. That is the **only** reference to `AM4` anywhere, and `AM4` exists only at `Prompt/specs/ADR-003-AMENDMENT-…md`.

**And it is the only unresolvable amendment reference in the repository.** I enumerated every `ADR-NNN A/AM<n>` reference outside the Rule-7 record — 19 of them — and checked each against `docs/adr/`:

| amendment | referenced from | resolves? |
|---|---|---|
| `ADR-007` `A2`–`A6` | `modules/access/src/index.ts`, both apps' `locale.ts`, the management contract (6×), two READMEs | **yes** — folded into `ADR-007`'s base as an `# Amendments (v1.1)` section |
| `ADR-010` `A1` | `ADR-013` | **yes** — `ADR-010-AMENDMENT-…md`, carried by C1 |
| `ADR-011` `A4` | `ADR-013` (2×) | **yes** — `ADR-011`'s status line, and the amendment file |
| **`ADR-003` `AM4`** | `PID-PRINCIPLES.md` | **NO** |

**Kind:** pure-doc (carry `AM4` in) **plus** a gate change (extend `adrs-present.sh`).

**Risk:** low for the document. The check extension carries the real risk — an amendment-granularity check that is too loose passes vacuously, and one too strict reds on `ADR-007`'s folded-in amendments, which are *correctly* not separate files. It must accept **either** shape: folded into the base, or its own file. That is exactly the discrimination C1's glob-hole failed at, one level down.

**Its red:** plant a reference to `ADR-003 AM9` (nonexistent) → red naming the referencing file; remove `AM4` from wherever it lands → red; and — the mutation that matters — confirm the check stays **green** on `ADR-007`'s `A2`–`A6` while they remain folded in, then red if `ADR-007`'s Amendments section is deleted.

**Where it sits against C1:** the same class, lower severity. C1's absent ADRs were depended on by migrations, modules and contracts; `AM4` is depended on by one sentence in a principle. Real, but not a live hazard to the code.

---

## B. Test-harness isolation

**Two distinct debts, and only one of them ever fires.**

**B1 — `reseed()` does not clear the rows that pin reference data. This is the one that bit three times, and it is precisely located.** `database/seeds/40-access-staff-and-grants.sql:25` runs `DELETE FROM access.user_group WHERE group_id LIKE 'grp_%'`, and `access.audit_event.group_id` has a foreign key to `access.user_group`. `apps/api/src/testing/harness.ts` mentions `audit_event` **zero** times. So any audit row surviving a test run makes the *next* run's `reseed()` fail with a foreign-key violation — in **setup**, which is why it reads as unrelated breakage every time. It bit GEN-011, GEN-009 and GEN-012.

**B2 — prefix teardowns that could match seed data. No live instance remains.** I checked all twelve `DELETE … LIKE` teardowns: ten are PID-scoped (`gnt_gen013_%`, `mem_gen014_%`) and cannot collide. The two that looked risky — `party-interest.test.ts`'s `pit_%` and `pty_pit_%` — are **safe**: zero seeded ids match either (the seeded parties are `pty_demo_*`). The three that did collide (`ctc_%`, and GEN-015's `occa_`-constructed id) are already fixed.

**Kind:** code/harness.

**Risk: the highest in this basket, and it is suite-wide.** `startHarness` is the entry point for **every** integration test; 13 test files issue `DELETE`. A wrong change to `reseed()` breaks 238 tests at once, and — worse — a change that makes teardown *too* aggressive would delete seeded rows and produce failures that look like product defects. That is the exact costume this class already wore three times.

**Its red:** leave an audit row behind deliberately, run `startHarness` twice, and the second must succeed where today it fails on the FK. Plus a guard test that the seeded world is *unchanged* after a full suite run — a row count over the seeded tables before and after, which is the assertion that would have caught the `ctc_%` deletion the day it happened.

---

## C. Principle codification + F. Stable ids

**C and F are one piece of work: F is the scheme C's entries need**, and C cannot be written twice.

**Current state:** `PID-PRINCIPLES.md` holds **48 bullets** across 5 sections, **no ids**. Rulings cite *"principle 2, 10, 11, 12, 43"* — five citations against an unnumbered file, which is why GEN-012 had to content-match and why the numbers were declared owed.

**The seven to write:** `patch-verify-on-disk` · `identity-by-self-declaration` · `constraint-violation-never-500` · `assert-the-isolation-level` · `shadowed-layer-empty-oracle` · `teardown-isolation` · `merge-gate-precondition`. Each with the PIDs where it bit — all seven have worked instances in this programme, several with two or three.

**Kind:** pure doc.

**Risk: effectively none.** No code reads this file. The only hazard is a wrong id scheme becoming load-bearing before it is thought through — which is why F must be decided in the same act, not retrofitted.

**One design question I will not settle alone:** the five historical numeric citations. A slug scheme (`[patch-verify-on-disk]`) does not resolve *"principle 43"*. Either the file gains a short "historical numeric citations" table mapping the five to their slugs, or the citations are declared unresolvable and left. I lean to the mapping table — it is five rows and it makes the existing rulings readable — but it is a governance choice.

**Its red:** the reconciliation instrument from GEN-012, re-run: every principle present exactly once, and each new id unique. Drop one → caught; duplicate one → caught.

---

## D. Merge gate as an enforced precondition

**Current state: there is no hook infrastructure of any kind.** No `.husky`, no `.githooks`, `core.hooksPath` unset, no hook tooling in `package.json`. The gate is `--check` and the battery run **by hand**, which is exactly how GEN-013 pushed a register that failed `--check`: my shell chain gated the push on the *commit* succeeding rather than on the generator.

**Kind:** CI/gate.

**The honest constraint, stated because it shapes what D can be:** a `pre-push` hook lives in `.git/hooks`, which git does not version. A repository **cannot** enforce a client-side hook by itself. The three shapes and what each actually buys:

| shape | blocks a bad push? | enforced by the repo? |
|---|---|---|
| versioned `.githooks/pre-push` + committed `core.hooksPath` convention | **yes** | only after each clone opts in once |
| a `bin/merge-gate.sh` the executor runs | only if run — the current problem | no |
| CI | no — it runs **after** the push has landed | yes, but too late |

**So D is honestly "a versioned hook plus a one-line opt-in, plus something that notices the opt-in is missing."** The last part is what stops it being another convention: a battery case asserting `core.hooksPath` is set, so an un-opted-in clone is loud rather than silently ungated.

**Risk: the highest kind, though not the widest.** D changes the mechanism that gates its own merge. A hook that is wrong can block every push including the fix, and a hook that is too permissive is indistinguishable from today. It must be tested by deliberately breaking the register and confirming the push is refused.

**Its red:** point a reference at a nonexistent ADR (or corrupt `PID-INDEX.md`), attempt a push, and it must be **refused** — then restore and confirm it succeeds. Anything less is a hook nobody has seen fire.

---

## E. Premise-arm guard

**Current state:** `grants-complete.sh` has the premise arm from GEN-012, and **nothing asserts it stays** — delete the arm and the battery still passes 22/22. The design is already ruled: a **CI step** (not `prove.sh`, because CI's postgres is ephemeral where a developer's cluster is persistent), flipping the **reversible** `SUPERUSER` and never ownership, with a pre-flight that aborts on a role left tainted by an interrupted run.

**Kind:** CI only. The workflow already bootstraps a database and runs the battery, so this is one step in an existing job.

**Risk: low and confined.** It mutates cluster-level state, but only in CI's throwaway container, and only a reversible attribute. The pre-flight is what keeps a tainted role from being mistaken for a pass.

**Its red:** delete the premise arm from `grants-complete.sh` and the new CI step must fail — that is the whole point of it, and it is the assertion GEN-012 could not make.

---

## 2. Proposed batching

**Four diffs, in this order.**

| # | batch | kind | why together / why alone |
|---|---|---|---|
| **1** | **C + F** | pure doc | F is the id scheme C's entries need; writing C first would mean rewriting all seven. Zero code risk, and the ids are cited by everything after. |
| **2** | **A** | doc + gate | Small, same class as C1, and its check extension has a clean red. Kept out of batch 1 because it changes a battery script and batch 1 changes no executable at all — mixing them would put a doc-only diff and a gate diff behind one review. |
| **3** | **B** | harness | **Isolated, non-negotiable.** Suite-wide blast radius: `startHarness` is every integration test's entry point, and this class has already produced three failures that looked like product defects. It must land where the *only* thing that changed is the harness. |
| **4** | **D + E** | CI/gate | Both change how work is gated rather than what the code does, and both are proven by making the gate refuse. **Last**, because D changes the mechanism that gates its own merge — every earlier batch should land while the gate is the known-good manual one. |

**Why this sequence and not another.** C+F first because it is free and its ids are referenced by the later batches' reports. A second because it closes the last live instance of C1's class. B third — before the gate changes, so that if the harness change misbehaves the gate is still the one we understand. D+E last for the same reason in reverse: change the gate only when nothing else is in flight behind it.

**What must not share a diff:** B with anything (blast radius), and D with anything but E (it gates its own merge).

---

## 3. Related debt found — reported, not folded in

1. **`ADR-007`'s `A2`–`A6` are folded into its base document, while `ADR-010`'s amendment is a separate file.** Both are correct under the rule C1 set (fold when it touches one ADR, separate when it touches several), but a reader has no way to know which shape to expect without opening the file. A one-line convention note in `docs/adr/README.md` would fix it. **Not in this basket.**
2. **`API-015-ST-implementation-plan-deferred-findings.md` still sits in `docs/adr/` and is not an ADR.** Third time reported.
3. **The `adrs-present.sh` exclusion of `docs/governance/reports|archive` is untested.** It is a deliberate decision, but no red proves the exclusion works — a future change to the grep could silently start scanning them and nobody would notice until a closed report turned the battery red.

---

## 4. Gaps — this list is complete

1. **I did not measure the battery's runtime**, and batches 2 and 4 both add to it.
2. **I have not read `ADR-003`'s `AM4` in full** — only established that it is referenced once and absent. Whether its content conflicts with the repo's `ADR-003` is a Step-2 question and, if it does, a finding rather than a copy.
3. **B's "seeded world unchanged" guard is proposed, not designed.** Comparing row counts over seeded tables is the obvious shape; whether it can distinguish a test's legitimate writes from a teardown's collateral damage is unresolved.
4. **D's opt-in check assumes `core.hooksPath` is the mechanism.** If the Brain prefers a different enforcement, the battery case changes shape with it.
5. **I did not verify that every one of the seven principles in C has a distinct worked instance** — several bit twice and I have not confirmed that no two of them are the same principle wearing different clothes.

## 5. Rulings sought

1. **§2** — the batching and its sequence.
2. **§C/F** — the id scheme, and whether the five historical numeric citations get a mapping table.
3. **§A** — the check must accept both amendment shapes (folded or separate); confirm.
4. **§D** — is a versioned hook plus a `core.hooksPath` opt-in plus a battery case asserting the opt-in the shape you want, given a repository cannot enforce a client-side hook alone?
5. **§3.1** — the fold-vs-separate convention note: a follow-on, or leave it?

**HARD STOP.**
