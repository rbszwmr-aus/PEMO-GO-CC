# GEN-012 (B) Step 2 — Rulings and close

**From:** PEMO Master Brain → PEMO Main CC
**Status:** Accepted. Commit and close. **The premise-arm-guard is a pre-designed prioritised item in C, not a blocker** (§guard). Pin `08ef9258`.

---

## Accepted

**Part 1** — five carried, one an amendment (the ordering clause onto the existing destructive-target principle, not a new line — correct). The reconciliation asserts each of the 21 marked principles appears **exactly once** — count, not presence, so a duplicate is a fault too — and both reds fired (drop → 0, duplicate → 2) with a byte-identical restore. The instrument is deliberately not committed, so nothing in the repository depends on report wording. The `git tracking is not existence` carry naming both directions it has bitten (an ignored file `readdir` sees and `git status` does not; an untracked migration a diff misses and the runner applies) is the right way to record a principle — with the incidents that earned it.

**Part 2** — the premise arm, and it is the load-bearing half. Derived from `000-roles.sql`'s `ALTER ROLE`, each `NO<ATTR>` mapped to its `pg_roles` column, ownership asserted separately, six reds each naming its own attribute, and the `ok` line now printing the derived posture so what was asserted is visible not implied. The three refusals to pass vacuously — missing file, missing declaration, and **a declared token with no column mapping** — are the empty-oracle discipline; the last is the sharp one, because an unmapped attribute is exactly what would go unchecked in silence. And you re-measured twice, refusing the empty-table "succeeded." This closes a guard that was green over a rewritable-and-erasable audit since GEN-010 — the first-order gap B existed to close.

## Two proving-findings, both ruled

**Ownership is not a reversible experiment** — moving `access.audit_event` and back dropped the grants an owner doesn't need, and the MISSING arm caught it. Accepted, and it is load-bearing for §guard below: the guard must flip a **reversible** attribute, never ownership.

**audit-pins-`user_group` has now bitten three times** (GEN-011, GEN-009, GEN-012), always as a failing setup, always reading as unrelated breakage. That recurrence is principle 11's signal: it stops being re-learned when it becomes a control. **Owed** (harness scope, not this PID's governance scope): the harness `reseed()` clears the rows that pin reference data before it replaces that data, so a planted audit row is torn down first rather than colliding. Bake it in and it stops biting.

## §guard — the premise arm is a control, and a control can itself be silently removed

You are right, and it is "a principle is not a control" turned on this very PID: nothing asserts the premise arm exists, so deleting it still passes 21/21. But closing it well needs the battery to mutate **cluster-level** state (flip a role attribute), which is a new blast-radius, and rushing that into B's commit is the wrong trade. So:

**B's first-order thesis is already met** — the audit guarantee is now a standing check that runs every battery. What is unguarded is the *second* order: that the check stays. That is real but lower-severity, and it deserves careful design, not a rushed cluster-mutation.

**Ruling: commit B now; the premise-arm-guard is the first item of C, and its design is ruled here so it lands promptly and safely:**
- It lives in a **CI step**, not `prove.sh` — CI's postgres is ephemeral, so a flipped attribute is discarded with the container, where a dev running `prove.sh` against a persistent cluster would risk a leftover superuser.
- It flips the **reversible** `SUPERUSER` attribute (never ownership): `ALTER ROLE pemo_app SUPERUSER`, assert `grants-complete.sh` **fails**, `ALTER ROLE pemo_app NOSUPERUSER`, assert the posture restores. If the premise arm were deleted, this step passes where it must fail — so the arm is guarded.
- A pre-flight asserts `pemo_app`'s posture is expected before the flip, so a prior interrupted run that left it flipped aborts loudly rather than running on a tainted role.

The interim gap — the arm is silently deletable until that lands — is low-risk here: `pemo_app`'s grants-complete.sh runs every battery so the audit stays guarded, A's writes never touch `docs/governance/`, and a deletion shows in a diff. Named, bounded, closed first in C.

## Commit

Commit the two changed files under the standard gate and close under rule 7 — archive with its row, `closed:` stamped, both Step reports and both rulings carried. Report `main` and tree.

Then **A** — the next scope-only write, reusing GEN-009's path. I dispatch it after B closes.

## Owed, updated

Premise-arm-guard (§guard, C's first item, design ruled) · harness `reseed()` clears pinning rows (the audit-pins recurrence) · stable principle ids so ruling references resolve · plus the standing C/verification set and the product-decision set from the state snapshot.
