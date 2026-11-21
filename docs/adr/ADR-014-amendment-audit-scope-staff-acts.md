# ADR-014 Amendment — the scope of `access.audit_event`

**Status:** Accepted (amendment to ADR-014) — Product Owner ruling 2026-09-02
(GEN-041 close).
**Date:** 2026-09-02
**Target location:** `docs/adr/ADR-014-amendment-audit-scope-staff-acts.md`,
pointed to from ADR-014 in ADR-010's convention; ADR-014's text is retained.
**Origin:** GEN-041 D6. Measured: no resident-authored act can write an
`access.audit_event` row — `audit_event.principal_id` is a foreign key to
`access.staff_principal`, and no resident is a staff principal. The refusal is at
the FK, before GEN-025's biconditional is evaluated. home_safety's safety-event
acknowledgement, and now the notices acknowledgement, record no audit row. This
amendment makes that boundary a decision rather than a consequence.

## The amendment

> **`access.audit_event` records staff authority-bearing acts.** Its subject is a
> staff principal exercising (or being refused) authority under the grant model —
> the acts ADR-014's `reason_code` exists to explain. It is not a universal
> write-log.
>
> **A resident-authored act is evidenced by its own append-only domain fact.** The
> row the act produces — a `notice_acknowledgement`, a safety-event
> acknowledgement, a `ticket_message` authored by a resident — is the record: who,
> when, and what, immutable by the same append-only discipline (ADR-013) that
> governs audit itself. No `audit_event` row is written and none is missing.
>
> **A staff act performed on a resident's behalf is a staff act** and is audited
> normally, with the staff witness (principal + group + role) and, where the act's
> contract requires it, a `reason_code`.

## Why this is the right boundary and not a gap

The audit table answers "which staff member did what to whom, under what
authority, and why." A resident marking a notice read is not an exercise of
authority; it is a statement of fact about themselves, and the domain row states
it completely. Widening the FK to admit resident principals would either invent a
group and role for residents — a fiction ADR-016 D1 forbids in a neighbouring
place — or weaken the GEN-025 biconditional that keeps authority-bearing rows
honest. Both were correctly refused in GEN-041.

## Consequences

- A resident-facing write surface must show that its domain fact is append-only
  and carries actor + time; that is its audit.
- Any future resident act with **administrative consequence** (one that changes
  another party's state) is, by that fact, a staff-shaped act and must be
  designed as one — with a floor and an audit row — not slipped through as a
  resident write. The deferred "staff records an acknowledgement on a resident's
  behalf" (GEN-041 D2) is the first such case and is audited as staff.

## Not changed

ADR-014's `reason_code` model, its per-act vocabularies, its no-free-text rule,
and GEN-025's provisioning shape and biconditional are unchanged.
