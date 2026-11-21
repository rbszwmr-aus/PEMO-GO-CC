# GEN-021 Step 2 — E only: the premise-arm guard

**Status:** built, proven, **NOT COMMITTED. HARD STOP.**
**Headline:** the `GEN-012` hole is closed, and the decisive red confirms it was real — with the premise arm deleted, `grants-complete.sh` **passed while `pemo_app` was a superuser**, and the guard caught it. D is not in this diff.

---

## 1. Pin and state

| | |
|---|---|
| **Pin** | `4011b0fea2d43e3224fee9248df65fcfdceb1502` (Step 1) |
| **`main`** | `06ebe65ac2a573c283edafc4ccc76c6f9067899e` — the allocation only. **Deliverable uncommitted.** |
| **Green** | battery **22/22** · suite **347** · boundaries PASS · validator PASS · index OK · the new guard exit 0 |

**Paths:** `docs/governance/bin/premise-arm-guard.sh` (new) and `.github/workflows/governance.yml` (one step). Nothing else.

## 2. What it does, and the order it does it in

1. **Destructive-target guard, before any network reach.** This `ALTER`s a **cluster-global** role, so `[destructive-target-confirmed]` and its ordering amendment apply in full: the database name, the loopback host and `PEMO_ENV` are checked as pure configuration *before* anything connects. A guard downstream of a reachability probe is bypassable — a wrong target that happens to be unreachable short-circuits into a skip and never executes. The refusal message says why a role is different from a table: **altering one reaches every database on the cluster, not just this one.**
2. **Pre-flight on the role.** `pemo_app` must be `rolsuper = false` *before* the flip. An interrupted earlier run could have left it set, and testing a guard against a tainted role proves nothing — `grants-complete.sh` would red for a state this run did not create, and that red would read as a pass.
3. **Pre-flight on the subject.** `grants-complete.sh` must be **green** to begin with, or its failure after the flip is not attributable to the flip.
4. **Flip** `SUPERUSER`, then **confirm the flip landed** before believing anything that follows — `[probe-must-bite]`. A mutation that silently failed would leave the subject green, and that green would be read as "the guard is fine" when the guard had never been exercised.
5. **Assert `grants-complete.sh` fails.** This is the guard.
6. **Restore, confirm the restore landed, and assert green again** — so the red in step 5 is attributable to the flip and nothing else.

A `trap` restores on every exit path, including the failure paths, and the reds below confirm the role was left clean after each.

**Reversible attribute only, never ownership.** `GEN-012` measured that transferring a table to `pemo_app` and back **drops the grants an owner does not need**, so the restore leaves the app unable to read its own audit and the MISSING arm reds for an unrelated reason. A guard whose restore breaks something else is not a guard.

## 3. Placement

**A CI step, and runnable locally on demand** — not wired into the battery. `GEN-012` ruled this and the reasoning holds: CI's Postgres is a throwaway container, so a flip that somehow outlived its restore dies with the job, where a developer's cluster is persistent and a leftover superuser would be a real hazard. The script carries its own target and pre-flight guards precisely so that running it locally is safe when someone chooses to.

Placed after the battery, before the suites. With `REQUIRE_DB: '1'`, so an absent database is **fatal in CI** rather than a quiet skip — the same lesson as `--require-git`, one layer down.

## 4. Proof — each red fired

| red | result |
|---|---|
| **the premise arm deleted** | ✖ `grants-complete.sh PASSED while pemo_app is a SUPERUSER` — and the sanity line confirms the subject still passed *without* the flip, so the arm's absence is what the guard found. Role left clean afterwards. |
| **the role pre-tainted** (an interrupted run's leftover) | ✖ pre-flight refuses, naming the one-line remedy rather than testing against it |
| **target: `pemo_production`** | ✖ refused on the connection target, before any reach |
| **target: a non-loopback host** | ✖ refused, and the host does not resolve — so the refusal is provably *before* the network |
| **`REQUIRE_DB=1`, no database** | ✖ fatal; without it, a loud `SKIP` and exit 0 |
| baseline, and after every red | ✔ `flip red, restore green` |

**The first row is the point of the whole PID.** `GEN-012` closed a guard that had been green over a rewritable, erasable audit since `GEN-010` — and then could not assert that its own fix stayed. Deleting the arm still passed 22/22. It does not now.

**CI-shape rehearsal**, the exact step order with `REQUIRE_DB=1` from a clean database: `--check` OK, boundaries PASS, battery 22/22, **guard exit 0**, suite 347, validator PASS. The step's env satisfies the target guard in CI (`pemo_dev`, `127.0.0.1`, `development`), checked against the workflow's own `database env` block rather than assumed.

## 5. Weight

**Two files** — one new script, one CI step. No code, no schema, no contract, no test file: the script *is* the test, and its subject is another script.

Light, and the reason is that Step 1 had already resolved the two decisions that mattered — reversible attribute rather than ownership, and CI rather than the battery — both inherited from `GEN-012`'s ruling rather than re-derived.

## 6. Gaps — this list is complete

1. **The guard has never run in real CI.** Rehearsed locally in CI shape, which is not the same thing — GitHub's runner, its Postgres service and its permissions are not reproduced here. Its first CI run is its experiment, and `[first-red-is-diagnosed]` applies if it reds there.
2. **It asserts only `rolsuper`.** `grants-complete.sh`'s premise arm also checks `createrole`, `createdb`, `bypassrls` and ownership; this guard exercises **one** of them. Deleting only the ownership assertion, say, would not be caught. The reversible-attribute constraint is why — ownership is not reversible, and flipping `CREATEROLE` is possible but was not asked for.
3. **The trap restores only `NOSUPERUSER`.** If a future version flips more, the trap must grow with it, and nothing enforces that.
4. **It runs `grants-complete.sh` three times** (pre-flight, flipped, restored). Cheap, but the guard's cost is three times its subject's.
5. **Locally runnable is claimed, not exercised in anger.** I ran it here against throwaway containers; I have not run it against the shared `pemo-dev-db`, and I would not without the operator's say-so, because the target guard would permit it — the database is named `pemo_dev` on loopback.
6. **D is not in this diff**, as scoped, so the merge gate is still manual.

## 7. Rulings sought

1. **§6.2** — extend the guard to flip `CREATEROLE`/`CREATEDB`/`BYPASSRLS` too, so every reversible attribute of the premise arm is exercised? Ownership stays out either way.
2. **Commit** — nothing beyond the allocation is committed.

**HARD STOP.**

---

# Addendum — extended to every reversible attribute

Ruled before merge: the guard exercised only `rolsuper`, leaving four-fifths of the premise arm without an oracle — the GEN-012 failure one attribute over.

**The attribute set is now derived from `000-roles.sql`'s own `ALTER ROLE` line**, exactly as `grants-complete.sh` derives what it asserts. The guard therefore cannot fall behind the arm it guards: declare a new `NO<ATTR>` there and it is exercised here the same day, where a hand-written list would leave the new attribute unguarded — which is the shape that left four unguarded in the first place. If the declaration is missing or names no reversible attribute, the guard **refuses** rather than flipping nothing and passing.

**Each attribute gets its own flip → confirm-it-landed → red → restore → green.** The pre-flight now checks every attribute, and the `trap` restores every one it can flip, so a failure part-way through the loop cannot leave an earlier flip standing.

**Ownership stays out**, and the reason is unchanged: it is not a role attribute and it is not reversible. That assertion of the arm has no oracle and §6.2 records it.

**The proof — each assertion dropped individually from the premise arm:**

| dropped from the arm | result |
|---|---|
| `SUPERUSER` | ✖ `grants-complete.sh PASSED while pemo_app holds SUPERUSER` |
| `CREATEDB` | ✖ … `holds CREATEDB` |
| `CREATEROLE` | ✖ … `holds CREATEROLE` |
| `BYPASSRLS` | ✖ … `holds BYPASSRLS` |

Four separate deletions, four separate catches, each naming the attribute. Plus the pre-flight red per attribute, and the derivation's vacuity refusal. The role is verifiably clean afterwards on all four columns.

Baseline now reads `premise arm bites on every reversible attribute — BYPASSRLS,CREATEDB,CREATEROLE,SUPERUSER`. Gates unmoved: battery 22/22, suite 347, boundaries PASS, validator PASS, index OK.
