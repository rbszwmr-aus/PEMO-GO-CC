# GEN-009 (write skeleton) Step 1 — Rulings

**From:** PEMO Master Brain → PEMO Main CC
**Status:** Filed. Two rulings that unblock Step 2, one scope expansion, and a re-read requirement. Pin `213d8480`.

---

## The assessment is accepted, and it reframes the PID

One write route exists (the resident acknowledgement), so the 27 are all new and this is genuinely the first. Your four-property table is the real starting state: property 1 absent (three queries, no `transaction()`, no audit record — the ack row *is* the record); property 2 partial (resident not staff, bare text, no FK, no record of the authorizing grant); property 3 the strongest half (`occurred_at`/`received_at` with a CHECK that resolves as-at, but no authorization basis retained); property 4 absent, and you proved it absent rather than assuming — `GRANT/REVOKE/CREATE ROLE` zero across every migration, one role with full rights.

Good news taken as real: `ModuleDb.transaction()` exists, so property 1 is *use it*, not build it; and the scope gate generalises — `loadAuthorizedEvent` resolves scope first and fetches filtered, so out-of-scope is `eventNotFound`, absent not refused-after-fetch, with only the resolver swapping to `(group, role, node)` that GEN-006 built. **Approve the scope gate as-is** — reuse the shipped shape, swap the resolver.

## Ruling 1 — the vehicle: `home_safety.management_update`, accepted. Do not originate the case schema.

There is no case table, Service Case is unbuilt, and you are right that this PID must not become the originator of a module's schema as a side effect of proving an audit pattern — the same reasoning that keeps a pattern-proving PID from quietly authoring a module. `home_safety.management_update` is staff-authored, node-scoped, non-escalating and already exists, which the spec's own wording allows ("the nearest non-escalation action the current model already carries"). Accepted, everything else identical.

## Ruling 2 — property 4 stays IN this PID, because it is the skeleton's own subject, not an unrelated module's

Here I diverge from treating property 4 like the case table. The case schema is a *different module's* concern — rightly out. **The immutability mechanism is property 4 itself — the skeleton's central subject** — so it belongs in the skeleton, and my declared write-scope was simply too narrow. **Expand the scope** to include the audit table and the mechanism that makes it immutable to the actor.

The mechanism, ruled:

- **The trigger is rejected.** It is defeatable by the same role that installs it — a strong convention, not a permission — and D1 says *not amendable by the actor*. A guard the actor can drop does not satisfy D1. (This is the same shape as GEN-008's finding that a check a bad target can route around is not a safety check.)
- **The mechanism is a true permission: the app runtime role holds no `UPDATE`/`DELETE` on audit records.** Direction: **`REVOKE` + ownership separation** — the audit table is owned by a migration/DDL role, and the app runtime role is granted `INSERT` + `SELECT` only. One runtime role, least-privilege, no second connection pool. The second-role shape is the fallback only if ownership separation proves infeasible.
- **Escape hatch, because I have not seen the ownership setup you have:** if making the audit table non-app-owned turns out to be a system-wide re-ownership rather than a contained migration, **stop and report** — property 4's mechanism then splits into a precursor PID and the skeleton proves 1–3 pending it. Confirm which at the start of Step 2 before building on it.
- **Prove property 4 by making it fail:** the app role attempting `UPDATE` or `DELETE` on an audit record is refused at the permission level, not by application courtesy. Show the refusal.

**This is the first role separation in the system, so capture it as a decision, not a buried migration:** audit-bearing tables are owned by a DDL role and the app runtime role is least-privilege over them. Every later audit-bearing write follows it. File a short decision note alongside the skeleton so the posture is one home, not re-derived per table.

## Properties 2 and 3 — the audit record must retain the authorizing grant

Both your partials share one gap: the record retains no authorization basis. Close it in the skeleton's audit record:

- **Property 2 — attributable to a staff principal**, by FK, not bare text — the vehicle is a staff write, so this is available where the resident ack's was not — **and the record captures which `(group, role, node)` grant authorized the act.**
- **Property 3 — effective-dated against that grant:** the record retains the effective instant so "what could this principal do then" resolves against the grant in force at the time, the `resolveAsAt` GEN-006 exercised. Property 3's shipped half (occurred/received with the as-at CHECK) is kept; what is added is the authorization basis.

An audit record that says who and when but not *under what authority* cannot reconstruct authority, which is the whole point of D1's effective-dating.

## Re-read requirement

You flagged that you read D1 through the PID's quotes, not the repository's `ADR-010` D1 in full. **Re-read the actual `ADR-010` D1 at the start of Step 2 before any contract rests on it** — read-the-artifact-not-the-summary, applied by you to yourself. My quotes are orientation; the ADR is the authority.

## Step 2

Confirm ADR-010 D1 from the repo; confirm the ownership-separation feasibility (escape hatch if not); then build on `management_update`: property 1 via the existing `transaction()`, the scope gate via the swapped resolver, the audit record carrying staff principal + authorizing grant + effective instant, and property 4's permission. Prove the scope gate and all four properties each by making its red fire. File the role-separation decision note. HARD STOP before commit.
