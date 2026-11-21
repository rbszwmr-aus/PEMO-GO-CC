# GEN-009 — Step 2 (resumed): a structural blocker on property 1

**PID:** GEN-009 v1.0, resumed at its allocation commit — **not** re-allocated.
**Re-pin:** `af7f6a86f3e7fd68d5cede673181c05833cffff1` / tree `fa1693cb83bbc59d93896b6a3c44ce364d7324bc` / **778 files** (post-GEN-010).
**Status:** **HARD STOP.** Two migration files written and unstaged; nothing else built. **Property 1 cannot be met with the current module-database design**, and the proof is in §3.

---

## 1. `ADR-010` D1, re-read from the artifact before anything rests on it

Read from `docs/adr/ADR-010-role-list.md`, not from a summary. The four properties are as carried, and the framing is the load-bearing part:

> If an audit record substitutes for a gate, then it carries the weight the gate would have carried, and a weak audit record makes `D1` empty. … **written in the same transaction as the act** — *an audit written afterwards is an audit that can fail separately*. … Without all four, *"record rather than restrict"* records nothing. **This is a requirement on the write path, not a logging preference.**

No divergence. A re-read that finds nothing is still a result.

## 2. Property 4 is inherited, and the floor delivered it with zero work

`0116_access_audit_event.up.sql` creates `access.audit_event`. It contains **no trigger, no rule, no immutability mechanism** — and after `database/bootstrap.sh`:

```
audit_event grants for pemo_app: INSERT,SELECT
```

Granted **automatically**, by `ALTER DEFAULT PRIVILEGES` from GEN-010, without a line of grant SQL in the migration. The table is append-only to the application by construction, exactly like the other 42. GEN-010's design paid for itself on the first table created after it.

The record keeps **actor and authority separate**, as ruled: `principal_id` → `staff_principal` (the person, by FK, never a session or service), and `group_id` + `role` + `node_kind`/`node_id` (the grant that authorised it), plus `occurred_at` as the instant the grant must be read at.

## 3. Property 1 is blocked — proven, not predicted

**The audit is in `access`; the act is in `home_safety`. Each `createModuleDb` builds its own `Pool`** with `options: -c search_path=<schema>,pg_catalog` (`module-db.ts:69-83`), and `transaction()` takes a client **from that pool**. Two module handles are therefore two connections, and two connections cannot share a transaction.

Run against a real database — act and audit written inside `home_safety`'s transaction, then a deliberate failure:

```
transaction threw: deliberate failure AFTER both writes
after ROLLBACK — management_update rows: 0   audit_event rows: 1
```

**The act rolled back. The audit survived.**

That is worse than D1's stated hazard. D1 warns that *"an audit written afterwards is an audit that can fail separately"* — a **missing** record. What this produces is a **false** one: an audit asserting that a principal did something, under a named authority, that never happened. For a record whose entire purpose is reconstructing authority after an incident, a confident falsehood is the worst of the three outcomes.

**There is no precedent to follow.** Every existing `transaction()` call — `runner.ts:186,220`, `property-repository.ts:133` — is single-schema. Nothing in the codebase writes atomically across two schemas; this would be the first.

## 4. Why I am not choosing the fix

Three shapes, and they differ in what they cost the architecture, not in taste:

| option | what it means | cost |
|---|---|---|
| **A — a cross-schema transaction in `modules/platform`**, used only by the composition layer | one connection, both schemas reachable, fully-qualified writes | changes the shared platform boundary, and creates the first sanctioned cross-schema write path. `verify-boundaries` scans `modules/` only, so `apps/api` may already do this — but *may* is not *should* |
| **B — the audit table lives in each acting module's schema** | `home_safety.audit_event`, `property.audit_event`, … | property 1 falls out for free, and `access` stops owning "who may do what". The audit fragments across seven schemas and cross-module queries become impossible — the thing an incident review most needs |
| **C — outbox / deferred write** | audit enqueued, applied later | **rejected by D1 itself**: an audit that can fail separately |

**A is the only one that satisfies D1 without fragmenting the audit**, and it is a boundary decision — the module-isolation model is one of the four layers this project has spent two PIDs proving. I am not taking it on my own authority, and `modules/platform` is outside GEN-009's write scope in any case.

## 5. Gaps — this list is complete

1. **Nothing is staged.** Two untracked files: `0116_access_audit_event.{up,down}.sql`.
2. **Property 1 blocked** (§3); properties 2 and 3 are designed into the table but **not yet exercised** — no command, no scope gate, no endpoint, no tests.
3. **`0116` has been applied and reversed only in a throwaway database.** Its down migration refuses when the table is non-empty; that refusal is written but **not proven by making it fire**.
4. **The audit probe row committed and was deleted by hand** — the direct consequence of §3. `audit_event` is back to 0 rows; the database was a throwaway and is gone.
5. **`management_update` carries no author column.** The act records *what* was published, never *who* — so the audit record is the only attribution. Correct for this design, and worth stating: deleting the audit would leave an unattributable act.
6. **The HTTP surface and contract are untouched** — no endpoint, no OpenAPI change, no fixtures, no `ADR-008` lock/stamp bump. All are in write scope and all wait on §4.

## 6. What the Brain is asked to rule

1. **§4 — how property 1 is satisfied.** A (a composition-layer cross-schema transaction in `modules/platform`), B (audit per module schema), or another shape. This is the boundary decision, and it needs `modules/platform` in scope whichever way it goes.
2. **§5.3** — should `0116`'s down-refusal be proven by making it fire before it merges, as `0115`'s was?
3. Whether `access.audit_event` as written (§2) is the shape to keep once §1 is settled — the table is independent of how the transaction is arranged.

**HARD STOP.**
