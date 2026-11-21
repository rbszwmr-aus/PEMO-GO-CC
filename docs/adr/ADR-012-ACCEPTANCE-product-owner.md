# ADR-012 core — Product Owner acceptance

**Author:** Master Brain · **Decision owner:** Product Owner · **Status:** Accepted (PO, 2026-08-28) · **Date:** 2026-08-28

## What was accepted

The **core** of `ADR-012` (groups and the delegated scope tree), confirmed by the Product Owner after reviewing worked PEMO examples where group-held grants earn their place (estate-staff teams at a node, units with more than one resident, one person holding multiple roles) versus where a group-of-one is uniform overhead:

- A scope grant is held by a **group**, never by a principal directly.
- A **group-of-one** is the normal way to give one person one permission — not a workaround. Authorization is uniformly group-held; there is no second, principal-held mechanism.
- A principal's rights are the **union** over the groups they belong to.
- The model is **monotonic** — no deny, no exclusion, no negative permission. Capability is removed by ending an effective-dated grant or membership, never by adding a deny row.

## What was NOT decided here

**Group nesting** (`ADR-012`'s remaining open question — whether a group may have a parent) stays open. It is not needed for the authorization model to proceed, and the `GEN-006` migration is required to keep the schema from foreclosing a later parent column on `user_group`. When the nesting question is taken, it is taken on its own evidence.

## Why this record exists, and what is still owed

The `ADR-012` artifact in `Prompt/specs/` reads `Proposed — v1.1` and has never been carried into the register; the authority spine asserted "Accepted 2026-08-20" ahead of that. This note is the durable record that the core is now genuinely PO-accepted, dated today, so the acceptance does not live only in a session.

**Owed:** the `ADR-012` artifact is to be updated to `Accepted`, folded with this acceptance and its open-question status, and carried into `rewrite/adr/` and the register by the ADR-consolidation PID. Until then this note is the authority for the acceptance and `Prompt/specs/ADR-012` remains the authority for the decision's content.

## Immediate consequence

`GEN-006`'s Step-2 commit precondition (its ruling §7) is satisfied. The migration re-keying `scope_grant` to `(group_id, role, node_kind, node_id, tstzrange)` may commit once built and proven, no longer resting on a `Proposed` foundation.
