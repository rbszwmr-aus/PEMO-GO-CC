# ADR-019 — Notices: origination

**Status:** Accepted — v1.0, accepted by the Product Owner 2026-09-02, including
the dispositions of OQ1–OQ3 below.
**Date:** 2026-09-02
**Decision owner:** Product Owner
**Target location:** `docs/adr/ADR-019-notices-origination.md`
**Scope:** cut A — schema origination only. The compose/approve write surface,
acknowledgement surface and routes are later PIDs.
**Evidence:** PEMO_Function_Scope_v0.4 §3.5 (COM-01..05), §7 systems of record;
GEN-006-ST (Notices, Notification delivery and attachment upload out of scope —
nothing exists to reconcile with).
**Related:** ADR-002 (hierarchy), ADR-003 (Location, serving_scope), ADR-007
(tiers/projections), ADR-010 D2 (Approver), ADR-011 (party/interest; D8 owner
projection), ADR-013 (assertion model), ADR-014/015 (audit, idempotency),
ADR-017 (delegation floors).
**Architecture rules carried:** one module = one schema; no cross-module foreign
keys — stable identifiers only.

## D1 — PEMO is the system of record for a notice

Settled by R8 / v0.4 §7. Recorded, not re-decided. A notice is authored,
approved, published, corrected, withdrawn and expired in PEMO.

## D2 — Placement: `notices` owns the notice; Notification owns delivery

A new `notices` module/schema owns COM-01 (the notice, type, content, schedule),
COM-03 (acknowledgement) and COM-05 (governance state). Notification (COM-02) is a
separate module that consumes a published notice and produces per-recipient
per-channel deliveries, receipts, fallbacks and reminders; it is not originated
here. **Notices owns what was said, to whom, when, and whether acknowledged;
Notification owns how it reached each person.** No FK between them; the seam is
the notice's stable id and a published-notice event on the platform outbox.

## D3 — A notice is an assertion instance (ADR-013)

Stable instance identity + append-only versioned assertions; current =
MAX(version). Edit-before-publish, correction-after-publish, withdrawal and
expiry-change are new assertions. COM-05's "correction and withdrawal record" is
the assertion history itself. No UPDATE.

## D4 — Lifecycle is computed; approval is policy

draft → pending_approval → approved → published → (expired | withdrawn); a
correction is a new published assertion superseding content. States are computed
from the assertion chain, never a stored mutable flag. Which types require the
Approver (ADR-010 D2) is per-type, per-organization policy held as configuration
(COM-05 "approval workflow for *selected* notice types"), never hard-coded. The
write surface enforces it through ADR-017 floors: estate_staff composes; Approver
confirms for gated types.

## D5 — Audience: a declarative rule, and a snapshot taken at publish

Two facts, kept separately because they diverge. **The targeting rule** (intent)
on the assertion: a set of `(node_kind, node_id)` over the ADR-002 hierarchy
(portfolio / estate / building / floor / unit), and, for planned-interruption or
facility-sourced notices, a Location whose serving_scope (ADR-003) resolves to the
nodes served — a lift notice targets the floors the lift serves, not the block.
**The audience snapshot** (fact) resolved at publish: the households / residents
as-at that instant via the resident module's effective-dated occupancy, by stable
id. "Who was this addressed to" must survive later move-ins and move-outs.
Residential units only (`unit_class = residential`); parking and storage are never
a notice audience.

## D6 — Acknowledgement is a per-recipient append-only fact

`read`, `acknowledged`, `responded` (+ response), keyed to notice and recipient by
stable id, append-only, idempotent — a duplicate acknowledgement with the same key
produces one effect (the rule home_safety already enforces). Whether
acknowledgement is mandatory is a property of the notice assertion. Reminders to
non-responders are a Notification concern.

## D7 — Notice types are a declared enumeration

`general`, `planned_interruption`, `emergency`, `event_community`, as a declared
source of truth. Emergency notices are the same Notice entity; their trigger
(verified 2IoThub event context) and automatic-template policy belong to Home
Safety / integration. This ADR originates the type and an incident-link slot (a
stable safety-event id, no FK), not the ingestion.

## D8 — Attachments: a platform reference record; storage undecided

Where attachment bytes live (object store, malware scanning) is an open
infrastructure decision recorded in GEN-006-ST and not yet closed. This ADR
originates a platform-level attachment reference — owner entity by stable id,
filename, content type, size, an opaque `storage_ref`, scan status — so notices
and cases can reference attachments now without choosing the store. The reference
shape does not change when the store is decided.

## D9 — Every notice write is an audited, stance-declared act

ADR-014 reason_code per act; ADR-015 idempotency stance per operation. The schema
is assertion-shaped so the later write-surface PID adds no migration.

## Not modelled here

Delivery channels, receipts, fallback, reminder scheduling (Notification); kiosk
and SMS gateway; emergency event ingestion; the templates / controlled-wording
library (a write-surface concern); community events, surveys and polls (CMT-*);
resident-facing rendering — ADR-007 projections apply at read time.

## Open questions — dispositions (PO, 2026-09-02)

- **OQ1 — "resident group" targeting.** Named once in COM-01, defined nowhere. It
  is not `access.group`; the word is not overloaded. **Disposition: leave a slot in
  the targeting rule; do not invent a resident-cohort entity.** Defining the cohort
  is a later decision.
- **OQ2 — non-resident owners as audience.** Resolution is occupancy-based.
  **Disposition: residents only in this cut; whether and for which types an
  ADR-011 interest-holder is in the audience stays a named open question**, not a
  silent schema assumption.
- **OQ3 — bilingual content.** **Disposition: per-language fields on one
  assertion, both languages published together.**
- **OQ4 — retention / legal hold.** Out of this cut; named.
