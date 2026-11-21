# ADR-020 Corollary — resident authority is residency-shaped, not grant-shaped

**Status:** Accepted (corollary / amendment to ADR-020) — Product Owner ruling
2026-09-02 (GEN-044 close).
**Date:** 2026-09-02
**Target location:** `docs/adr/ADR-020-corollary-resident-authority.md`, pointed
to from ADR-020 in ADR-010's convention; ADR-020's text is retained.
**Origin:** GEN-044 D2 — the "reportable set."

## The corollary

> **A resident's authority over a Ticket's subject derives from where they live
> and what serves it — occupancy plus ADR-003 `serving_scope` — not from the
> grant model.** A resident may report about their own unit, or about a Location
> whose serving_scope includes their unit (the lift they ride, the lobby they
> use), and about nothing else. This is a distinct authority shape from staff
> authority (ADR-017's covering conjunction over grants) and from
> acknowledgement authority (ADR-019 D6 / GEN-041's audience-snapshot
> membership). It is resolved through the property and resident module ports,
> never by a client-side rule and never by a grant.

## Why it is recorded

Three authority shapes now coexist and must not be confused: **staff** (holds a
live grant covering the node — ADR-017, RoleScope), **addressee** (is in the
audience snapshot of a published notice — ADR-019 D5/D6), and **resident-of**
(occupies the unit, or is served by the Location — this corollary). Each answers
"may this principal act on this subject?" from a different fact. A future
surface that reaches for a grant to authorise a resident, or for occupancy to
authorise staff, is wrong; naming the three keeps the next engineer from
collapsing them.

## Not changed

ADR-020's decisions, ADR-017's floors, ADR-019's audience model. The reportable
set is resolved as-at the act time (a mover-out cannot report about a former
unit); its rule is containment for the unit and serving_scope for Locations,
never physical parent.
