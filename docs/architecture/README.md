# PEMO Architecture

GEN-001-ST architecture baseline. Status legend: **Locked** = approved doctrine or boundary; **Proposed** = recommendation awaiting explicit architecture approval; **Unresolved** = intentionally undecided and must not be invented.

- [Overview and system boundaries](overview-and-boundaries.md) — objectives, non-goals, claims and ownership boundaries; mixed locked doctrine and proposed baseline.
- [Logical architecture](logical-architecture.md) — deployment-neutral modular-monolith view; proposed architecture direction.
- [Module catalogue and ownership](module-catalogue.md) — canonical modules, owned data and ownership matrix; locked/proposed/unresolved items marked in the document.
- [Property and identity model](property-and-identity-model.md) — property hierarchy, locations, serving scope, occupancy and authorization semantics.
- [Integration contract rules](integration-contract-rules.md) — contract envelope, versioning, idempotency, correlation and consumer obligations.
- [2IoThub boundary](2iothub-boundary.md) — device/alarm ownership separation and unresolved external contract boundary.
- [External Work and Case lifecycle](external-work-and-case-lifecycle.md) — Ticket, Case and external-work transitions and closure authority.
- [Security, tenancy and audit baseline](security-tenancy-and-audit-baseline.md) — bounded controls and unresolved compliance/vendor choices.
- [Repository and dependency rules](repository-and-dependency-rules.md) — proposed layout, ownership and dependency direction.
- [Phased delivery plan](phased-delivery-plan.md) — proposed delivery sequence, demo boundary and validation gates.

The ADR index is [here](../adr/README.md). These documents are architecture only and do not prove implementation, certification or production readiness.