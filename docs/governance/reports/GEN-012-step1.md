# GEN-012 — Step 1: the principle corpus and the role model

**Status:** assessed. **HARD STOP.** Nothing built, nothing committed.
**Headline:** the reconciliation found **five** missing principles, one more than the orientation list — and part 2 is not an addition to `grants-complete.sh`, it is that check's **missing premise**. Measured: with `pemo_app` made superuser, the app role **rewrote and then erased an audit row** while `grants-complete.sh` printed `ok`.

---

## 1. Pin and allocation

| | |
|---|---|
| **Pin** | `7c511063a45e8e14a83feeb04b719cf4145291bc`, `origin/main` re-read from the remote and equal to HEAD |
| **Tree / files** | `b2a1ec415a5bf11dc4e1234c77205862ec7c2806` / 800 |
| **Number** | **012**, from `node bin/pid-index.mjs --next` over `pids/` + `archive/` + `reports/`. Next is 013. |

`docs/governance/pids/GEN-012.md` is written and the index regenerated, both **uncommitted**. `GEN-011`'s allocation was its own commit before Step 1; this dispatch says HARD STOP before commit, so I have not made one. **Say whether the allocation should be committed separately or land with Step 2.**

## 2. Part 1 — the reconciliation

### Method

The reports are the authority, so the orientation list was not used as input. I scanned every `*RULINGS*.md` in `docs/governance/reports/` for principle-assertion markers — `> **`, `## Principle…`, "new principle", "principle this earns", "recorded as a principle", "Principles added", "into `PID-PRINCIPLES.md`" — extracted each asserted principle, and grepped `PID-PRINCIPLES.md` for a distinctive phrase from each.

**The method's recall limit, stated rather than glossed:** it finds principles that are *marked* as such. A principle asserted in ordinary prose with no marker would be missed. Two rulings say explicitly that a finding is **not** a new principle (`GEN-003-v1.1`, `GEN-006` §C, `GEN-008` on three findings), which is evidence the marker convention is real and used deliberately — but it is not proof of completeness, and I am not claiming completeness.

### Result — 15 present, 5 missing

Present and correctly carried: ruling-delivered-when-readable, absence-is-not-absence, mirrors-append-only, role-name-is-not-identity, authority-defect-window, enumeration-names-its-root, absence-in-a-set-that-did-not-arrive, red-on-first-run-diagnosed, a-principle-is-not-a-control, negative-test-disarmed, validate-then-mutate-half-applies, destructive-op-confirms-real-target, fix-opens-new-failure-mode, inherited-green-not-all-earned.

**Missing:**

| # | principle | asserted in |
|---|---|---|
| 1 | **Principle 43's ORDERING amendment** — the destructive-target guard must be a pure-config check running **before any network reach**; a guard downstream of a skippable probe is bypassable. The principle is present; the ordering clause is not. | `GEN-008-step2.md:117`, queued by `GEN-010-RULINGS-step2` and `-gate` |
| 2 | **Fixtures are owner work.** A test performing setup/teardown through the application credential cannot distinguish "the app is forbidden this" from "my fixture could not run." | `GEN-010-RULINGS-step2.md:28` |
| 3 | **Its corollary:** an `assert.rejects` probe on the app credential passes on **permission**, not on the constraint it means to prove — the permission wall fires first and the assertion passes for the wrong reason. | `GEN-010-RULINGS-step2-gate.md:12` |
| 4 | **A record written in a different transaction from the act it attests can survive that act's failure and assert a falsehood** — not absence but confident wrongness. Attestation and act are atomic or the attestation is a liability. | `GEN-009-RULINGS-step2-blocker…md:50` |
| 5 | **A green suite is worthless if reintroducing the defect keeps it green — and the reintroduced failure must land in the actual hazard window, not merely somewhere.** A mutation test in the wrong window is an empty oracle with extra steps. | `GEN-011-RULINGS-step2.md:36` |

### The fifth, which is not on the orientation list and needs a ruling

`GEN-001-RULINGS-step1.md:49` accepts *"enumerate from the filesystem, then interrogate git per file — never ask git what exists,"* and says **"the reasoning is the principle one layer over."** It is **not** in `PID-PRINCIPLES.md`. But the same ruling accepts it **"as a done-when"**, so whether a principle was asserted or only a done-when is genuinely ambiguous in the source. I have not carried it. **Ruling sought** — and I raise it because the dispatch said the reports are the authority and my list must not be your list.

### The standing check I propose

A reconciliation this PID performs once will drift again. `docs/governance/bin/principles-carried.sh`, joining the battery:

- extract marked principle assertions from `reports/*RULINGS*.md`
- for each, assert a distinctive phrase appears in `PID-PRINCIPLES.md` **exactly once** — count, not presence, so a duplicated carry is a fault too
- exit non-zero naming each uncarried principle and its source report

**Its red:** drop one carried principle from `PID-PRINCIPLES.md` and the check names it and its source. Proven by firing, not by passing.

**The design question I will not decide alone:** the join between an assertion and its carried form. A hand-maintained phrase list is the frozen-axis failure the corpus already names, so I propose deriving the key from the assertion's own **bolded lead sentence** and requiring that phrase in the file — which makes the report text load-bearing and means rewording a carry breaks the check. That is a real cost and it is the honest one; **confirm or redirect.**

## 3. Part 2 — the role model is `grants-complete.sh`'s missing premise

Not an extra assertion beside the grant check. **The grant check's conclusion is conditional on a fact it never verifies.** A superuser bypasses privilege checks entirely and acquires nothing that appears in `information_schema.role_table_grants`, so the EXCESS arm — the load-bearing one, the one that catches append-only eroding silently — sees nothing and reports `ok`.

Measured on a throwaway database at the pin, seeded, with a real audit row planted:

```
row planted; action = 'publish'

pemo_app NOT superuser        UPDATE -> ERROR: permission denied for table audit_event
                              action = 'publish'

pemo_app SUPERUSER            UPDATE -> (accepted)
                              action = 'tampered'      <-- the audit was REWRITTEN
                              DELETE -> (accepted)
                              rows   = 0               <-- and then ERASED
                              grants-complete.sh: ok   43 tables, SELECT+INSERT only
```

ADR-010 D1's fourth property — not deletable or amendable by the actor — was **fully defeated**, and the check that exists to guard it stayed green. That is the seed-reproduces / merged-but-draft class: an enforcement point that does not fire.

Ownership is the second half and is not redundant: a table's owner can `GRANT` itself anything and `ALTER`/`DROP` regardless of grants, so `owns zero tables` is a separate necessary fact. `database/roles/000-roles.sql` also sets `NOCREATEDB NOCREATEROLE NOBYPASSRLS`; asserting those too is a candidate widening I have **not** assumed — the dispatch named `rolsuper` and ownership, and widening a check beyond its instruction is the executor deciding. **Ruling sought.**

### Design

Add a **PREMISE** arm to `grants-complete.sh`, running **before** the grant arms and reported separately, so a breach reads as "the premise is false" rather than as a grant anomaly:

- `SELECT rolsuper FROM pg_roles WHERE rolname = $APP` must be `false`
- tables owned by `$APP` (`pg_class.relowner`, `relkind='r'`) must be `0`, naming any it owns
- the role must exist at all — currently an absent `pemo_app` yields no rows and no missing grants, which would also read green

**Its red:** flip `pemo_app` to superuser and the check fails naming the breach; grant it ownership of one table and it fails naming that table; restore and it passes. A battery case in `prove.sh` beside the existing `grants-complete` case.

## 4. Gaps — this list is complete

1. **The enumeration's recall is marker-bound** (§2). An unmarked principle in prose would be missed. I state the method rather than claim completeness.
2. **Only `*RULINGS*.md` was scanned.** Executor step reports also propose principles; the dispatch names the rulings as the authority, so a principle proposed by an executor and never ruled on is deliberately out. `GEN-008-step2.md:117` is the exception — it is the *text* of an amendment the rulings queue by reference.
3. **`PID-PRINCIPLES.md` is unnumbered**, but rulings refer to "principle 43" and "principle 11". Those numbers resolve against some earlier numbering that the file does not carry, so the reference is unverifiable from the artifact alone. I matched by content. Whether the file should carry stable numbers is a question this PID could answer and I have not assumed it.
4. **I did not verify that the 15 "present" principles are present exactly once.** Step 1 checked presence; the once-ness is the Step 2 check's job.
5. **`prove.sh`'s `grants-complete` case counts a SKIP as neither pass nor fail.** The premise arm inherits that, so with no database the role model is unchecked and loud — correct, but worth stating since this is the floor.
6. **A superuser breach is invisible to every other check too**, not just this one. I have not surveyed what else assumes the role model.

## 5. Rulings sought

1. **§2** — carry the `GEN-001` filesystem-then-git item as a principle, or leave it as the done-when it was accepted as?
2. **§2** — the standing check's join key: bolded lead sentence, or another approach?
3. **§3** — assert `NOCREATEDB`/`NOCREATEROLE`/`NOBYPASSRLS` as well, or exactly `rolsuper` + ownership?
4. **§1** — commit the allocation separately, or with Step 2?
5. **§4.3** — should `PID-PRINCIPLES.md` carry stable numbers?

**HARD STOP.**
