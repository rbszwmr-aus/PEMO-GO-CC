# GEN-033 — W3 batch iii — the three write-surface routes

PID id: take the register's next allocation (expected GEN-033). File as
`pids/GEN-033.md` (conforming to ID_RE); the human label is "W3 batch iii".
Pins to origin/main d11154f8 (post GEN-032 merge).
Cites: ADR-017 (delegation authorization floors, Accepted 2026-09-01), ADR-013,
ADR-014, ADR-015 (idempotency stance), ADR-016, GEN-030 (effective-administrator
witness + org lock), G-2 (findAuthorizingGrant).

## Goal

Wire the three write-surface routes that still have none, so an org can be given
a second (and further) person and administered end-to-end. This is the last
piece of W3; the DBA is gone only once this lands.

- `registerPrincipal` (standalone route)
- `addMembership`
- `removeMembership`

Each route enforces its ADR-017 floor. The 3a commands exist and are currently
unreachable; this batch makes them reachable behind the floors.

## Decisions

**D1 — addMembership floor (ADR-017 D1).**
Caller must be an effective `grant_administrator` covering **every node at which
the target group holds a live grant**; if the group holds no live grants, the
caller must be an effective `grant_administrator` at the **org node**. This is a
new "may-administer-group" check = G-2 lifted to the group's live-grant-node-set
(conjunction — ALL must pass). Build it on the GEN-030 witness path; the witness
(principal ∧ live grant ∧ live membership) is the audit authority for the act.

**D2 — removeMembership floor (ADR-017 D2).**
Same may-administer-group floor as D1, **plus** the GEN-030 no-last-effective-
administrator guard: the removal must not leave any node with no live effective
administrator. Evaluate the guard and the floor under GEN-030's org-scoped
advisory lock, guard **first**, before the membership-ending assertion.

**D3 — registerPrincipal standalone floor (ADR-017 D3).**
Caller must be an effective `grant_administrator` at the **org node** of the
principal being recorded. This route is the post-bootstrap path; it must NOT be a
genesis bypass — it requires an existing org administrator, so it cannot be used
to provision an unprovisioned org. Confirm no path lets it write a seed row
(identity_source stays hard-coded 'external' from batch i, GEN-031 D5).

**D4 — every floor failure is a domain refusal, never a 500 (ADR-017 D4 / C4).**

**D5 — audit authority.**
These are caller-authorized acts (not provisioning). Audit source is authority-
bearing → the GEN-025 biconditional requires principal_id/group_id/role present.
Use the GEN-030 witness as the recorded authority. reason_code per each act's
contract (ADR-014).

**D6 — idempotency stances (ADR-015 D1 — every write DECLARES one).**
- `registerPrincipal` (standalone): **derived-key on (org, external_id)**. There
  is a natural stable key and batch-i's per-org unique index already enforces
  exactly-once; a retry returns the original act, the unique index is the
  concurrent-insert backstop (violation → domain refusal, C4). An identity is not
  un-registered, so there is no end→re-assert cycle to collide with.
- `addMembership` / `removeMembership`: **client-key**. The assertion model
  permits a legitimate remove→re-add (re-instatement) cycle, so a derived
  (group, principal) key would wrongly dedupe a re-instatement against the prior
  membership. The caller's request token distinguishes a retry (same token →
  return original) from a new intentional change (new token → new assertion).

**D7 — corpus.** Carry ADR-017 into the repo with Status Accepted so adrs-present
resolves the citation. Add **[delegation-floor]** to PID-PRINCIPLES.md, defined
here: *you cannot cause authority you cannot yourself confer; the floor for a
change is effective grant_administrator covering every node the change could
cause the subject to hold authority at (a conjunction over the set).*

## Acceptance — all green on a from-nothing rebuild; battery cases that MUST bite

1. **D1 escalation:** grant_administrator@buildingA calls addMembership on a group
   holding grant_administrator@org → refused. Grant the caller org-admin → passes.
   Removing the covering check → this reds (bite).
2. **D1 multi-node:** group holds live grants at A and B; caller admin at A only →
   refused (must cover both). Admin at both → passes.
3. **D1 empty-group:** non-org-admin calls addMembership on a group with no live
   grants → refused. Removing the empty→org fallback → this reds (bite).
4. **D2 last-administrator:** removeMembership that would leave a node with no live
   effective administrator → refused. Removing the GEN-030 consult → reds (bite).
5. **D2 administration floor:** a caller who cannot administer the group calls
   removeMembership → refused.
6. **D3 registration floor:** non-org-admin calls standalone registerPrincipal →
   refused; org-admin → passes. registerPrincipal cannot emit a seed row.
7. **D4:** each refusal above is a domain error, not a 500 (assert type/status).
8. **D6 idempotency:** addMembership retried with the same client-key → returns
   the original, no second assertion; remove→re-add with a NEW key → a new
   membership assertion (re-instatement works). registerPrincipal derived-key
   retry → returns the original, unique index not violated.

Each floor guard must be shown to BITE by mutation (drop the guard → the matching
case reds), per probe-must-bite.

## Out of scope

- The standalone-registration operator/IdP mode surface (ADR-016 mechanism;
  mode-B confirm-at-record-time is the deferred held-gap item).
- IMPORT-LEGACY-STAFF; subtree/cross-node reachability of "covering" (G-2 current
  semantics inherited unchanged); the R5 grep-cluster PID (after W3).

## Close protocol

Standard merge: refspec push from worktree; main never checked out; tree-hash
equality re-read via git ls-remote; through the pre-push hook, NO --no-verify;
`[GEN-033]` commit tag (the register's allocated id — NOT a batch label). Rule 7
close: file → archive/ with index row, status: merged, closed: <TODAY from
`date`>. The PO ruling for this PID will be filed with `-RULINGS-` in its name
(load-bearing for the close check). Report merged tree-hash and the closed row.
HARD STOP for the close ruling.
