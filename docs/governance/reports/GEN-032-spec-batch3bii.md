# W3 batch ii — bootstrap (the atomic provisioning act)

PID: W3-3b-ii · pins to origin/main 516dc637 (post GEN-031 merge)
Cites: ADR-013 (append-only assertion), ADR-014 (audit reason), ADR-015
(idempotency stance), ADR-016 (identity boundary), ADR-008 + its 2026-09-01
amendment (field-removal-is-breaking), GEN-025 (audit provisioning shape),
GEN-030 (org-scoped effective-administrator guard + advisory lock).

## Goal

One atomic act that takes an organization from zero authority to a working
`grant_administrator`, with no prior principal, grant, or membership in
existence. This resolves the turtle chain: provision =
registerPrincipal + createGroup + conferGrant + addMembership, all in ONE
transaction.

## Decisions

**D1 — Atomic four-part act, one audited write, committed.**
`provision` performs, in a single transaction (one `auditedWrite`, committed:
true): (a) registerPrincipal(real external_id), (b) create a group,
(c) confer a `grant_administrator` grant to that group at the org node,
(d) add the principal to the group as a membership. All four assertions plus
the audit_event commit together or not at all.

**D2 — Audit source = provisioning; authority NULL.**
The audit_event carries `source = 'provisioning'`. Provisioning is NOT
authority-bearing, so the GEN-025 biconditional forces principal_id / group_id
/ role NULL. There is no acting principal to name — that is the point of a
genesis act. reason_code per ADR-014 as the provision contract declares it.

**D3 — Guard: zero-grants-EVER, evaluated FIRST, under the org lock.**
Before any INSERT, acquire the org-scoped advisory xact lock (GEN-030,
coarse), then evaluate: *does ANY scope_grant assertion exist for this org?*
If yes → refuse. Note this is EVER, not live: scope_grant is append-only, so
an ended grant's row still exists and the predicate still bites — an org that
was ever provisioned can never be re-provisioned, and ending the last grant
does NOT re-open provisioning (this was my earlier error, corrected). The
existence check over an append-only table is cheap and cannot be erased.

**D4 — Idempotency stance: EXEMPT-with-reason.**
Provision is the one write with no acting principal, so the ADR-015 key
(principal, operation, key) has no principal to key on. It also already has a
stronger exactly-once guarantee than the idempotency table gives: zero-grants-
EVER over an append-only relation. Declared reason: *"genesis act — no acting
principal to key on; exactly-once is guaranteed by zero-grants-ever over
append-only scope_grant."* Consequence, which is CORRECT genesis semantics:
a retry after a committed provision sees the grant and refuses (a clear
"already provisioned" domain error, not a success-echo, not a 500 — C4);
a retry after a rolled-back provision sees zero grants and provisions. This
satisfies ADR-015 D1 (a stance is declared; an undeclared write is refused).

Principle established by THIS PID (define in the PID header and ADD to
PID-PRINCIPLES.md in this batch):
*genesis-exempt-from-idempotency* — a genesis act with no acting principal
declares idempotency exempt-with-reason; exactly-once is instead guaranteed by
an append-only existence guard evaluated first under the entity lock.

**D5 — registerPrincipal cannot emit a seed row (GEN-031 Gap A precondition).**
Verify that registerPrincipal hard-codes identity_source to the external value
and does NOT accept it as a caller parameter. The bootstrap principal is a
REAL external identity (mode B: operator records it from the source directory;
mode A: the IdP trigger supplies it) — never a seed. If registerPrincipal
already enforces this, this is a confirmation in the report; if not, it is a
one-line fix landed in this batch. The seed category stays reachable only by
direct SQL migration.

**D6 — Provision contract: BREAKING major bump.**
The provision contract's removed field is a breaking change per the ADR-008
amendment filed 2026-09-01. Bump the contract major version and cite the
amendment. The adrs-present check must resolve the citation (the amendment doc
is filed; ensure the in-repo ADR-008 reflects the amended table so the citation
resolves in-corpus, or land the amendment text where the checker reads it).

## Acceptance

- All green on a database rebuilt from nothing: contract suite, integration
  suite, prove.sh battery (add a battery case for provision), boundaries PASS,
  validator PASS.
- **Battery cases that must BITE:**
  1. Second provision of an already-provisioned org → refused by zero-grants-
     ever (domain error, not 500). Removing the guard reds this.
  2. Provision after the org's only grant was ended → still refused (proves
     EVER, not live). This case must exist and must bite; it is the exact shape
     of my earlier error and its absence would let the error back in.
  3. Partial-failure atomicity: force the fourth insert (membership) to fail →
     the principal, group, grant, and audit_event all roll back; the org is
     left at zero grants and is still provisionable. Dropping committed:true or
     splitting the transaction reds this.
  4. Concurrent double-provision of the same org → the advisory lock serializes;
     exactly one succeeds, the other refuses. (If cheap to express.)
- registerPrincipal-cannot-emit-seed: a test that a runtime call cannot produce
  identity_source = seed reds if D5 regresses.
- Report the contract version delta and confirm the adrs-present citation to the
  ADR-008 amendment resolves.

## Out of scope (do NOT pull in)

- Membership routes (addMembership / removeMembership) — that is batch iii,
  independent, pins to this same merged main.
- The standalone-registration authorization floor — ruled at iii.
- IMPORT-LEGACY-STAFF and the mode-B operator surface — deferred (held-gaps
  ruling 2026-09-01).

## Close protocol

Standard merge: refspec push from worktree; main never checked out; tree-hash
equality re-read via git ls-remote; through the pre-push hook, NO --no-verify;
[W3-3b-ii] commit tag. Rule 7 close: file → archive/ with index row,
status: merged, closed: <TODAY from `date`> (read the date, do not carry).
Report merged tree-hash and the closed row. HARD STOP for the close ruling.
