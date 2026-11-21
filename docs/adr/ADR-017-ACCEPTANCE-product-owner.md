# ADR-017 core — Product Owner acceptance

**Status:** `Accepted` — `v1.0`.
**Applies to:** `ADR-017-delegation-authorization-floors.md`.
**Carried in by:** `GEN-033`.
Date: 2026-09-01
Ruling: PO accepted ADR-017 (delegation authorization floors) in full, including
the empty-group → org-node fallback in D1 that was flagged as the one judgment
call beyond the direct G-2 lift.

Accepted as written:
- [delegation-floor] — you cannot cause authority you cannot yourself confer;
  G-2 lifted to the set of authority a change confers (conjunction).
- D1 addMembership — grant_administrator covering every live-grant node of the
  group; empty grant-set → org node (closes the pre-stage escalation path).
- D2 removeMembership — same administration floor + GEN-030 no-last-effective-
  administrator guard, under GEN-030's org lock.
- D3 registerPrincipal standalone — grant_administrator @ the principal's org;
  distinct from the provisioning genesis path.
- D4 — every floor failure is a domain refusal, never a 500 (C4).

Batch iii (register's next allocation) implements D1–D4 and adds
[delegation-floor] to PID-PRINCIPLES.md. When Main CC carries ADR-017 into the
repo, its in-repo Status is Accepted so adrs-present resolves batch iii's citation.
