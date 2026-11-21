# GEN-009 — Step 1: what the shipped write already carries, and what it does not

**PID:** GEN-009 v1.0 · **Status:** **HARD STOP.** Nothing built.
**Headline:** the scope gate generalises. **Property 4 does not exist anywhere in this repository**, and closing it is a change to how the application connects to the database — materially larger than a case-note endpoint, and outside the declared write scope. §5 is the ruling that matters.

---

## 1. Pin

| | |
|---|---|
| **Pin (analysis)** | `4f1ee7fcf26cbc52351c4264fd5d3eb1ec014570` / tree `0fa06f6bb2e7a0af18a737c91624444f41309475` / 766 files |
| **`main` now** | `213d848071e485886b2a8247830ee1f8802f03a7` — the GEN-009 allocation |
| **Number** | **009** from `--next`; next is 010 |

**The repository has exactly one write route today** — counted, not assumed:

```
app.put('/api/resident-mobile/v0/safety/events/:eventId/acknowledgement')
```

So "the one write this project has already shipped" is literally true, and the 27 are all new.

## 2. The shipped path, read

| piece | file |
|---|---|
| table | `database/migrations/0033_home_safety_acknowledgement.up.sql` |
| command | `modules/home-safety/src/acknowledgement/acknowledgement-commands.ts` |
| route + gate | `apps/api/src/server.ts:520-598`, gate at `:643-657` |
| authorization | `modules/resident/src/authorization/unit-authorization.ts` |

## 3. The four properties against what is shipped

| # | property | shipped? | evidence |
|---|---|---|---|
| 1 | audit in the **same transaction** as the act | **NO** | `acknowledge()` issues three separate queries — `findAcknowledgementByKey`, `findAcknowledgement`, `insertAcknowledgement` — with no `db.transaction()`. And there is **no audit record at all**: the acknowledgement row *is* the record, so there is no second write to be atomic with. |
| 2 | attributable to a **principal** | **PARTIAL** | `resident_id` and `correlation_id` are recorded. But it is a **resident**, not a staff principal, and the column is bare text — `0033` says *"stable id, NO FK"*. Nothing records *which grant* authorized the act. |
| 3 | **effective-dated** | **PARTIAL, and the strongest half** | `occurred_at` (the resident's own action time, client-supplied) and `received_at` (PEMO's receipt) are kept **separately**, with `CHECK (received_at >= occurred_at)`. The *check* is effective-dated too: `listAuthorizedUnits(residentId, now)` resolves as-at. But the **record retains no authorization basis**, so "what could this principal do at T" is answerable only by re-resolving later — and GEN-006 D6 showed re-resolution silently returns nobody when the underlying dating is wrong. |
| 4 | **not deletable or amendable by the actor** | **NO — and nothing in the repository supports it** | `grep -cE '^\s*(GRANT\|REVOKE\|CREATE ROLE)'` over every `*.up.sql` returns **zero**. There is no role separation anywhere; the application connects as one role with full rights on its schemas. Nothing prevents an `UPDATE` or `DELETE` on any row it can read. |

**The good news is real, though.** `ModuleDb.transaction()` **already exists** (`modules/platform/src/db/module-db.ts:39,92-103`) with proper `BEGIN`/`COMMIT`/`ROLLBACK` and a nested-call guard. Property 1 needs *using* it, not building it.

## 4. The scope gate generalises — this is the reuse

`server.ts:643-657`:

```ts
const relationships = await modules.authorization.listAuthorizedUnits(residentId, now);
const units        = await modules.units.getResidentialUnits({organizationId}, relationships.map(r => r.unitId));
return modules.events.getForAudience(eventId, units.map(u => u.unitId), residentId);
```

The caller's scope is resolved first, and the target is fetched **filtered by it**. An event outside the resident's units does not resolve, and the route answers `eventNotFound` — **absent, not refused-after-fetch**, exactly the shape `D1` asks for. It is also already effective-dated at the point of the check.

**What must change for staff:** the resident path filters by *unit relationships*; the staff path filters by `(group, role, node)` — `findGrantsAsAt` → scope expansion → the case's node. GEN-006 built that resolution and the differential test walks it at 8,519 comparisons. So the **shape** is reused and the **resolver** is swapped. That is a genuine reuse, not a rewrite.

## 5. Property 4 is the whole difficulty, and it is bigger than this PID's scope

`D1` is explicit that immutability must be *"at the level that makes it a guarantee and not a convention — DB permission, not application courtesy."* Today there is no DB permission model at all.

**Three shapes could satisfy it, and they differ in cost, not just taste:**

| option | what it means | cost |
|---|---|---|
| **A — a second DB role** | the app writes audit rows as a role with `INSERT` but no `UPDATE`/`DELETE` on the audit table | a second connection/pool in `modules/platform`, a role created outside migrations (or by them), and every deployment story gains a second credential |
| **B — rules/triggers** | `CREATE RULE`/trigger on the audit table rejecting `UPDATE` and `DELETE` | one migration, no new credential — **but it is defeatable by the same role that installs it**, so it is a strong convention, not a permission |
| **C — `REVOKE` on the app role** | revoke `UPDATE`/`DELETE` on the audit table from the application role | one migration, no new credential, and it *is* a permission — but the app role must not be the table's owner, and today it is |

**Only A and C are permissions; B is courtesy with a trigger on it.** A is the honest reading of D1 and the most invasive. C is the cheapest true permission and turns on a fact I have not established: whether the deployment can give PEMO a non-owner application role.

**All three reach outside this PID's write scope**, which is *the case-write surface, the audit mechanism, the endpoint contract and its tests*. A touches `modules/platform`'s connection handling and the dev compose; C touches ownership of every schema. I am not choosing this myself.

## 6. Proposed contract — for ruling, not built

**Endpoint.** `POST /api/management-web/v0/cases/{caseId}/notes` on the **management** surface (staff), with `ADR-008`'s lock/stamp bump on `packages/api-contracts/management-web/`.

**A blocker I must name rather than design around: there is no case table.** `grep 'CREATE TABLE'` across every migration returns no case, ticket or note table — Service Case is in the module catalogue and unbuilt. So "adding a case note" has **no case to attach to**, and this PID would be creating the Service Case schema as a side effect of proving an audit pattern. Three ways out, and the choice is the Brain's:

1. **Create a minimal `case` + `case_note` schema here** — honest but it makes the "deliberately thin" PID the originator of a module's schema, which the catalogue assigns to Service Case.
2. **Use an existing writable target instead** — the nearest non-escalation staff act on a table that already exists. The candidate is `home_safety.management_update` (referenced by the safety-event projection), which is staff-authored, node-scoped and non-escalating. This keeps the PID thin and proves the identical path.
3. **Wait for Service Case** — rejected, since the point is to prove the pattern before the 26 depend on it.

**I propose (2)** and flag that it changes the PID's vehicle from "case note" to "management update", with everything else identical. The spec itself allows this — *"or the nearest non-escalation case action the current model already carries"* — and this is that reading applied to what the schema actually contains.

**The audit record** (`access.audit_event`, new — `access` owns *who may do what*): `audit_id`, `principal_id` → `staff_principal`, `group_id` + `role` **as resolved at the act** (so the authorization basis is retained, not re-derived — property 3's real fix), `node_kind`/`node_id`, `action`, `target_id`, `occurred_at`, `recorded_at`, `correlation_id`. Written inside `db.transaction()` with the act.

## 7. Gaps — this list is complete

1. **Nothing built.**
2. **§5 is unresolved and blocks property 4.** Whichever option is chosen reaches outside the declared write scope.
3. **§6's missing case table is unresolved** and blocks the vehicle choice.
4. **I did not read `ADR-010` D1 itself** — the PID quotes it and I read the quotes, but the repository's `ADR-010` is the artifact and I have not re-read its D1 section in full this step. Named because a Step-2 contract should rest on the artifact, not the PID's summary of it.
5. **I have not established whether the deployment can provide a non-owner application role** (§5 option C). That is an infrastructure fact, not a code one.
6. **Property 3's "answerable at T" has no assertion shape yet.** Retaining `group_id`/`role` at the act makes it answerable; what the *test* asserts — re-resolution agrees with the retained basis, or the retained basis alone — is undecided.

## 8. What the Brain is asked to rule

1. **§5 — property 4's mechanism.** A (second role), B (trigger, and accept it is convention), or C (`REVOKE`, if a non-owner app role is possible)? Each needs a scope extension.
2. **§6 — the vehicle.** Management update on the existing schema, or create a minimal case schema here?
3. **§6 — the audit record's shape**, in particular retaining `group_id`/`role` at the act.
4. **Gap 4** — should Step 2 re-read `ADR-010` D1 in the repository and reconcile against it before implementing?

**HARD STOP.**
