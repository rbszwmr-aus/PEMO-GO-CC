# PID (A) — the second scope-only write: prove GEN-009's path generalises

**Author:** Master Brain → Main CC. **Dispatch: now** (B closed). First of the A phase — the 27 scope-only writes.
**Why this one, and what it must prove:** GEN-009 established the audited scope-only write path on `home_safety.management_update`. A's job is not a new mechanism — it is to show the path is the **27's shared path**, not `home_safety`-specific, by landing a second write in a **different module** with only the vehicle, its contract, and its domain preconditions changing. If it needs anything more than that, that is the finding.

---

type:        GEN (allocate the number from the directory at dispatch; do not carry one in prose)
from → to:   Master Brain → Main CC
pin:         current origin/main, read and report at Step 1
write-scope: the chosen module's write surface and handler, its contract (OpenAPI + fixtures + lock/stamp), the relevant tests. Read-only elsewhere. Report exact paths at Step 1.

## The vehicle

A scope-only staff write in a module **other than `home_safety`**, on a table that **already exists** — do not originate a module's schema (the GEN-009 rule). Preferred domain: **household / resident administration** — a staff act managing a party's relationship to a unit (ADR-011 party/interest), which also exercises a different part of the spine than a safety event. If that domain has no existing staff-writable node-scoped table without originating schema, fall back to a **notice action up to submission**, or report and I choose. Confirm the vehicle at Step 1; do not build on an assumed table.

## What to reuse, unchanged

- The platform **audited-write primitive** (GEN-011) — act + audit in one atomic transaction.
- The **`(group, role, node)` gate** — the caller's `estate_staff` grants expanded and put in the query; out-of-scope is **absent**, not refused; `403` absent-and-recorded-as-a-decision.
- The audit record — staff principal (FK) + the **narrowest** authorizing grant + the effective instant, actor and authority separate.
- Property 4 **inherited** (append-only, `INSERT`+`SELECT` arrive automatically); property 1 by the primitive; 2/3 the record shape.

## Done when — reuse proven, and generalisation the real claim

1. **The gate on this surface** — one principal, one act, the authorizing grant end-dated as the only change: the act refused. The GEN-009 shape, on the new vehicle.
2. **The audit records this act correctly** — principal + narrowest grant + effective instant; D1.3 bites here too (move the membership's `effective_from`, re-derivation empties, the retained record still answers).
3. **Generalisation** — the write required **no new mechanism**, only a vehicle, a contract, and this surface's own domain preconditions. State plainly what was shared and what was this surface's. **If a new mechanism was needed, that is a finding, not a footnote** — it means the path was less general than GEN-009 claimed, and I need to know.
4. This surface's **domain preconditions** (does the target exist, is it in a state that accepts this act) — this write's own logic, distinct from the shared path, and its reds fired.
5. The contract validates; the version bump reads from the lock; the audit-pins-`user_group` teardown is handled (the property, not a surprise, now that it has bitten three times).

Each red by making it fail. Two steps, HARD STOP before commit.

## Note

This is meant to be **lighter than GEN-009** — the architecture is done. If it is not lighter, that is itself information about how reusable the path really is. Report the weight honestly either way.
