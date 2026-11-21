# ADR-020 — Cases: origination (Ticket, Case, and the line between them)

**Status:** Accepted — v1.0, accepted by the Product Owner 2026-09-02, including
the dispositions of OQ1–OQ4 below.
**Date:** 2026-09-02
**Decision owner:** Product Owner
**Target location:** `docs/adr/ADR-020-cases-origination.md`
**Scope:** cut A — schema origination only. Intake/triage/handling write surfaces,
routes, external handoff transport and the read surface are later cuts.
**Evidence:** PEMO_Function_Scope_v0.4 §3.4 (CAS-01..06), §7, §13 ("Help Desk owns
the resident-facing Ticket and its conversation; Service Case owns internal
investigation, coordination, actions and resolution verification. One Ticket →
zero or one primary Case; one Case → one or many Tickets"); GEN-006-ST (Ticket /
Case out of scope beyond a read summary); requirements/10 A-04 (append-only
comments, internal vs customer-visible separated).
**Related:** ADR-011 D5 (forbidden-terms denylist), ADR-013 (assertion model),
ADR-014/015 (audit, idempotency), ADR-017 (floors), ADR-019 D8 (platform
attachment reference, reused), ADR-007 (projections).
**Architecture rules carried:** one module = one schema; no cross-module FK.

## D1 — PEMO is SoR for the Ticket and the Case; a consumer of the work order

Settled by R8 / §7. PEMO owns the Ticket and the Case. It does **not** own the
external work order, technician, parts, cost or maintenance schedule (CAS-04) —
those belong to the FM / business system reached through 2IoThub. PEMO records an
external reference and a synchronised status.

## D2 — Two modules, two schemas: `helpdesk` and `service_case`

`helpdesk` owns the **Ticket**: the resident-facing report, its conversation,
intake (CAS-01) and triage (CAS-02). `service_case` owns the **Case**: the
internal issue — investigation, coordination, actions, resolution verification
(CAS-03 internal half, CAS-04, CAS-05). No FK between them; stable ids only. A
Ticket is a person's report; a Case is the underlying issue — three residents
reporting one lift fault are three Tickets and one Case.

## D3 — The Ticket owns the link to its primary Case

Cardinality lives on the Ticket (0..1): the Ticket carries `primary_case_ref`
(stable id, nullable), set as a triage assertion. Service Case obtains a Case's
Tickets through helpdesk's public interface — never a direct join, never a second
copy of the relationship. One source of truth for one relationship.

## D4 — Ticket and Case are assertion instances (ADR-013)

Stable instance + append-only versioned assertions; current = MAX(version).
"Status and timeline" is the assertion history. Reopen is a new assertion;
closure reason rides on the closing assertion. State is computed from the chain,
never a stored mutable column. No UPDATE.

Case states include **`pending_verification`**: external completion may propose
resolution or move a Case to pending verification; it must **never** automatically
close a Case (CAS-04). Closing is always a human act; the write surface enforces
it later, the state exists now.

## D5 — Resident-visibility is an immutable per-message property, on the Ticket only

- **`ticket_message`** (helpdesk): append-only; author (staff principal or
  resident, by stable id); body; attachments via `platform.attachment_ref`;
  **`visibility ∈ {resident_visible, internal}` set at write and never changed.**
  An internal note cannot be flipped visible; a visible update is a new message.
- **`case_note`** (service_case): append-only; **always internal**. Nothing on a
  Case is ever resident-visible.

The only resident-readable text in the group is a `ticket_message` whose
immutable visibility says so; the resident projection (ADR-007) filters on that
column alone. A leak requires writing a resident_visible message on purpose.

## D6 — Triage facts on the Ticket assertion (CAS-02)

Declared type and priority; estate / building / unit association by stable id;
responsible **queue** as a declared queue identifier (OQ2); `due_at` as a fact
(the service-target policy that computes it is write-surface); `primary_case_ref`
(D3); `related_ticket_ref` facts for duplicate / related linking; an `escalated`
assertion kind (the overdue rule that fires it is a later scheduler concern).

## D7 — Intake facts (CAS-01)

Declared **channel**: `resident_app | staff_manual | phone | email | kiosk |
external`. **Reporter nullable** — anonymous / general feedback is a Ticket with
no reporter, permitted per org policy (policy check is write-surface). Category,
description, location (Location or node stable id), attachments. A human-readable
**display reference** (per-org sequence) distinct from the stable id.

## D8 — Service Case facts

Assigned owner (principal stable id; reassignment is a new assertion); complaint
classification (`is_complaint`, `complaint_class`, `respond_by`); resolution and
verification (D4); reopen / closure reason; satisfaction feedback slot (CAS-03 —
an append-only per-Ticket fact after closure).

**External handoff (CAS-04)** as `case_external_link`: external system id,
external reference, deep link, last synchronised status + summary, synced_at.
**Enforced exclusion (ADR-011 D5's mechanism):** a `forbidden-terms` denylist over
the `service_case` schema and contract — no `technician`, `parts`, `labour`,
`cost`, `work_order_schedule`, `maintenance_schedule`, or any monetary amount.

## D9 — Attachments reuse ADR-019 D8

`platform.attachment_ref` with `owner_module ∈ {helpdesk, service_case}`. No new
attachment machinery.

## D10 — Every write is an audited, stance-declared act

ADR-014 reason_code; ADR-015 stance per operation; ADR-017 floors on the write
surface (estate_staff handles; supervisor and complaint escalation are
Approver-shaped, ruled when the surface is built). Schema is assertion-shaped so
later surfaces add no migration.

## Not modelled here

CAS-06 knowledge-assisted response (v0.4 §14 D2 — deferred, unowned, with two
binding constraints already recorded there); the 2IoThub handoff transport
(Integration Hub); the service-target / SLA policy engine; overdue escalation
scheduling; trend and repeated-issue reporting (RPT-*); read projections (ADR-007
at read time); teams as an entity.

## Open questions — dispositions (PO, 2026-09-02)

- **OQ1 — Restricted / confidential cases (CAS-05, PARTIAL).** The right shape is
  a read-scope narrowing (`restricted_to` an `access.group` — staff authority
  scoping, which is what `access.group` is for; not ADR-019's resident-cohort
  question). **Disposition: do NOT originate the slot in cut A.** An unenforced
  `restricted_to` column is a lie with a fallback. CAS-05 restricted cases remain
  a **named open decision, to be originated together with their read enforcement
  when the case read surface is built**; the intended shape is recorded here so it
  is not reinvented.
- **OQ2 — Queue / team.** **Disposition: a declared queue identifier on the Ticket
  in cut A; a team entity (membership, routing rules) is a later decision.**
- **OQ3 — Ticket visibility within a household.** **Disposition: cut A records
  both reporter and unit; the visibility policy (reporter-only vs household) is a
  read-surface ruling.** Named.
- **OQ4 — Ticketless Cases.** **Disposition: the model assumes ≥1 Ticket per Case
  (every intake, including staff manual entry, produces a Ticket).** If a
  staff-originated internal issue ever needs a Case with no resident report, that
  is a new intake channel (`internal`), not a schema change.

## Corollary — resident authority is residency-shaped

`ADR-020-corollary-resident-authority.md` (Accepted, Product Owner ruling
2026-09-02, `GEN-044` close) settles what a resident may report about: authority
over a Ticket's subject derives from **where they live**, not from a grant. This
ADR's text is retained unchanged; the corollary governs where the two touch.
Implemented by `modules/helpdesk/src/intake/reportable-set.ts`.
