# ADR-014 — The audit records WHY: act-reason as a controlled code

**Status:** `Accepted` — `v1.0`. Accepted as written by the Product Owner 2026-08-31
(see `ADR-014-015-ACCEPTANCE-and-amendment.md`).
**Amended:** `ADR-014-amendment-audit-scope-staff-acts.md` (2026-09-02) — **`access.audit_event`
records STAFF authority-bearing acts.** A resident-authored act is evidenced by its own append-only
domain fact instead; `GEN-041` measured that a resident-authored audit row is structurally impossible,
because `audit_event.principal_id` references `access.staff_principal` and a resident is not one
(`ADR-016`, Person != Principal). A staff act on a resident's behalf remains a staff act, audited
normally. The text below is retained **verbatim** as the record of what it said; **read it with the
amendment, not instead of it.** (Same convention as `ADR-008` and `ADR-010`, whose amendments sit
beside the original rather than editing it.)
**Carried in by:** `GEN-023`.
**Date:** 2026-08-31
**Author:** PEMO Master Brain
**Decision owner:** Product Owner
**Target location:** `docs/adr/ADR-014-audit-act-reason.md`
**Related:** `ADR-010` `D1` (the four audit properties) · `ADR-011` `D6` (provenance) · `ADR-013`
(assertions; C5 reason-is-act-metadata) · `ADR-006` `D3` (vocabulary and policy change at different
rates and must be separately holdable) · GEN-009 (the error-type registry and its `sharedMeaning`
rule) · GEN-016 (stopped dead on this).
**Unblocks:** the occupancy end reason; and every later act that must record *why* — a correction, a
quarantine disposition, a notice withdrawal, a grant revocation.

---

## The problem

`access.audit_event` carries `ADR-010` `D1`'s four properties and **nothing free-form**. GEN-016 built
the occupancy end write and stopped at the stop condition: the act had nowhere to record *why* it
happened. The only places a reason could go were a column on the fact table (forbidden — `ADR-013` C5:
the assertion states the fact, not the act) or the shared audit spine (a decision, not an
implementation). So the end shipped without a reason, stated as deferred.

This recurs for every act that changes or ends something. Rule it once, before those multiply.

---

## Decisions

### D1 — The audit records **why** as a **controlled `reason_code`**, not free text.

A reason is worth recording: an occupancy that ended because the tenancy expired, because the tenant
left, or because the record was wrong are three materially different facts, and a manager will need
to tell them apart.

**But it is a code, not prose.** The audit is immutable and not deletable by the actor — so a
free-text field in it is **permanently un-redactable**, and free text entered by staff is exactly
where personal detail arrives. A code is queryable, validatable, and sufficient for every case that
has actually motivated this decision.

### D2 — `reason_code` lives **on `audit_event`**, nullable.

The reason is an attribute of the **act**, and `audit_event` *is* the act record — putting it in a
side table would split one fact across two rows, and putting it on the fact table is what `ADR-013`
C5 forbids. Nullable, because most acts have no reason: **a null is legible** (`ADR-010` `A1` — a
fiction is worse than a null), so absence stays honest rather than forcing a `reason: other`.

A new migration adds one nullable column; existing rows are `NULL`. Row immutability is a role-model
property (`pemo_app` is `SELECT`+`INSERT`) and is unaffected by a DDL act performed by `pemo_owner`.

### D3 — Reason codes are **declared per act type in the contract registry**, validated at the write path — under one registry rule shared with error types.

The vocabulary is not hardcoded per module (`ADR-006` `D3`: vocabulary must be separately holdable).
A code is declared in the contract, validated where the act is written, and governed by the
registry's rule, which this ADR now states once for **both** error URIs and reason codes:

> **A declared code or URI may be shared across surfaces if and only if it denotes identical
> semantics on every surface it appears on. Where the meaning differs by surface, it is split.**

This retires the question left open at GEN-009 (the management surface reusing resident-registered
error URIs): the enumeration and case-by-case confirmation of every cross-surface-shared identifier
becomes a **task under this rule**, not a further open decision.

### D4 — Whether a reason is **required** is declared by the act's own contract, not globally.

Ending or correcting a fact requires a reason; a routine first assertion does not. A global
requirement would produce noise — forced codes on acts that have no interesting why — and noise is how
a field stops being read. The contract states it per operation, and the write path enforces what the
contract states.

### D5 — Free-text notes are **NOT added now**.

An immutable, actor-undeletable free-text column in the audit spine is a permanent personal-data
hazard, and **no motivating case yet needs more than a code**. If one appears, it is a separate
decision carrying a stated retention and redaction path — not a speculative column added in advance.
This follows the restraint already exercised at GEN-016 (`guardLiveOccupancy` stayed private rather
than being promoted on speculation).

---

## Consequences

- GEN-016's deferred occupancy end reason is unblocked: it gets a `reason_code` with a small declared
  vocabulary (e.g. tenancy expired / occupant left / record corrected), required by that operation's
  contract per D4.
- One new migration (a nullable column). `0022` and every existing migration untouched.
- The audited-write primitive carries the code with the act — no new write path, no second row.
- The GEN-009 `sharedMeaning` question becomes an enumeration task under D3's rule.

## What this does not do
It does not add free text (D5), does not change `D1`'s four properties, and does not decide any
individual act's vocabulary — each is declared in that act's own contract when its write is built.

## Decision record

```text
Reason is recorded:   yes, as a controlled reason_code — not free text        — proposed 2026-08-31
Location:             a nullable column on access.audit_event (the act
                      record); never on the fact row (ADR-013 C5)             — proposed 2026-08-31
Vocabulary:           declared per act type in the contract registry,
                      validated at the write path                             — proposed 2026-08-31
Registry rule:        a code/URI is shared across surfaces iff its meaning
                      is identical; else split (covers error URIs too,
                      retiring GEN-009's open question)                       — proposed 2026-08-31
Required?             per the act's own contract, not globally                — proposed 2026-08-31
Free-text notes:      not added; a separate decision if ever motivated,
                      with a retention/redaction path                         — proposed 2026-08-31
```
