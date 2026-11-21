# GEN-006 Step 1 — Rulings

**From:** PEMO Master Brain → PEMO Main CC
**Status:** Filed. Proceed to Step 2 with the scope extension, identifiers and assertions below. **One precondition to the Step-2 commit, not to the build:** ADR-012's core must be confirmed Accepted (PO) — see §7. Build and prove first; the commit waits on that confirmation.
**Pin:** `514015e5` / `96fb3040` / 748 files. Migration 0115.

---

## The key — confirmed exactly as you read it

`ADR-010` D4's record keys `(principal, role, node_kind, node_id)` — role added, principal retained. `ADR-012` **substitutes** principal → group. The composition is `(group_id, role, node_kind, node_id, tstzrange)`, both gaps on one constraint. Substitution, not widening. Correct, and it is why the two gaps are one migration and not two.

## §1 — Write scope extended (both blocking conflicts)

Both blockers are my scope drawn too tight. Extended:

- **`database/seeds/40-access-staff-and-grants.sql`** — it inserts `principal_id` into `scope_grant` (line 33); after the re-key that column is gone and no world builds, so done-when 4 is unreachable without it. Updating it is in scope now. This also discharges **DOC-002 F1** (a seed that does not reproduce from nothing) as a side effect — note that in the report.
- **`tests/integration/`** — `modules/access/` contains no tests; the four suites live here, and two insert `scope_grant` with `principal_id` directly. "Its tests" was my error; the tests are here. In scope now.

Read-only still holds for everything else. Report the exact files you touch under both.

## §2 — Role identifiers (my ruling)

`ADR-010` D2 names the four roles in prose only. The identifiers, snake_case to match the schema convention:

| Role (ADR-010 prose) | Identifier |
|---|---|
| Estate staff | `estate_staff` |
| Approver | `approver` |
| Integration support | `integration_support` |
| Grant administrator | `grant_administrator` |

And a **fifth**, from the resident-route decision filed today: `resident`. It is not one of ADR-010's four — those are the management roles; `resident` is the resident-portal principal, a distinct population under `ADR-007`'s unconditional audience boundary, and roles are orthogonal to that boundary (`ADR-010` D5). It shares the role column because the column is the authorization mechanism, not the audience gate.

**The role set is these five.** Whether role is an enum, a lookup table, or text-with-check is yours to propose — but seed all five valid values now. We know `resident` is coming (resident-route is decided), and `ADR-010` D4's own logic applies: naming a value costs nothing, and adding it later is a separate immutable migration. A resident grant must later need only a row, not a schema change.

## §3 — Backfill role (my assertion, per ADR-010 D4)

D4 is explicit that the backfill is *a claim about the past, not a default*, so I assert rather than let you infer: **the 6 existing grants backfill as `estate_staff`.**

Basis, stated so it is a claim and not an assumption: they come from `40-access-staff-and-grants.sql`, they are the scope-holding staff grants that enabled the 27 scope-only actions, and `estate_staff` is D2's residual scope-holding role. The old one-grant-per-principal-per-node model could not have distinguished a capability role (Approver, Grant administrator, Integration support) on the same row — those are separate grants under the new key (D4: two roles at one node = two grants), which the old data cannot have carried.

**One check that keeps this an assertion and not a blanket:** if your reading of the seed shows any of the 6 explicitly represents a distinguished capability rather than plain scope-holding, stop and report it — that one is not `estate_staff`, and I assert the role for it specifically. Do not blanket-apply over a seed you have not confirmed is homogeneous.

## §4 — Backfill mechanics (approved as proposed)

- **`effective_from` = the earliest of that principal's grants, not `now()`.** Approved, and it is the load-bearing part: a membership starting today makes every past grant resolve to nobody, which is exactly the D6 failure. Seed the membership from the declared historical basis.
- **Groups are Organization-scoped (D7).** Each of the 6 groups-of-one carries the principal's Organization. Approved.
- **6 grants / 6 principals → 6 groups / 6 memberships.** Recorded.

## §5 — Down migration refuses on multi-member groups (approved)

The down can reconstruct one `principal_id` per grant only while every group is a group of one. Your proposal — **refuse on any multi-member group rather than silently pick one** — is the right decision, not an implementation detail. A down that silently picks one member lies about the state it restores. It is cleanly reversible only in the backfill state; once a real multi-member group exists, reversal is not clean and must fail loudly rather than corrupt. Approved.

## §6 — Done-when 4, corrected to your stronger version (accepted)

You are right that my wording did not match the differential test's nature. The differential compares Property Core's recursive SQL against Access's ancestry predicate; neither reads role or group, so a role-collision case is not naturally its property — it is constraint shape, not filtering. Adding the case to `access-scope-model` and re-running the differential unchanged would be the decorative path and would not discharge the wording.

**Accepted as you propose:** the differential's fixture must include **a principal reaching one node through two roles via two groups**, so the role-collision case genuinely fails under the old key and passes under the new one — the fail-then-pass the wording requires, made to bite rather than asserted. That is the real discharge of done-when 4; the extra fixture work is the point, not overhead.

## §7 — ADR-012 status: proceed on the core; the artifact and the nesting question are owed

You enumerated thoroughly and you are right to put it in the record: the ADR-012 artifact reads `Proposed — v1.1` with one open question (group nesting), has never been carried into the register, and its only copy is in `Prompt/specs/`. My spine says "Accepted 2026-08-20." Both can be true — the decision direction is firm and the artifact header lags — but I do not get to assert the gap away.

Rulings:
- **The core proceeds.** Grant held by a group, group-of-one normal, rights the union, monotonic — that is the settled direction the whole authority spine and the PO's model rest on, and this migration builds on it.
- **Group nesting stays open, and the schema must not foreclose it.** You confirmed nothing in your proposal forecloses a later parent column on `user_group`; keep it that way and say so in the Step-2 report.
- **ADR-012's formal acceptance and its carry into the register are owed.** I am raising the acceptance to the PO this turn — the artifact is Proposed, and a schema that re-keys live authorization to groups should not commit on a Proposed foundation. So: **build and prove Step 2, then HARD STOP; the commit waits on the PO's confirmation of ADR-012's core.** This does not delay the build, only the merge, and it keeps the migration from being the thing that silently promotes a Proposed ADR to fact.

## Summary of what Step 2 builds

Migration 0115 re-keying `scope_grant` to `(group_id, role, node_kind, node_id, tstzrange)`; the five-value role set with `estate_staff` backfilled onto the 6 grants (subject to §3's check); 6 Organization-scoped groups-of-one with `effective_from` = earliest grant; the seed and the two integration suites updated to the new key; the down migration refusing on multi-member groups; and done-when 4's differential fixture carrying a principal that reaches one node through two roles via two groups. Four reds/positives proven by making them fail. HARD STOP before commit; the commit additionally waits on §7.
