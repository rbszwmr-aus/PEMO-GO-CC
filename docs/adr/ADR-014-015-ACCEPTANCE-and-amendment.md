# ADR-014 and ADR-015 — Product Owner acceptance, and ADR-015 D1 amended

**Date:** 2026-08-31 · **Decided by:** Product Owner (this session).
**Applies to:** `ADR-014-audit-act-reason.md`, `ADR-015-idempotency-request-token.md`.
**Carried in by:** `GEN-023`.

---

## ADR-014 — ACCEPTED as written.

`adr-014-audit-act-reason.md`, all decisions D1–D5 accepted:
- reason recorded as a **controlled `reason_code`**, not free text;
- a **nullable column on `access.audit_event`** (the act record), never on the fact row;
- vocabulary **declared per act type in the contract registry**, validated at the write path;
- **one registry rule** for codes and error URIs alike — shared across surfaces iff the meaning is
  identical, else split — which **retires GEN-009's open `sharedMeaning` question** (it becomes an
  enumeration task under the rule);
- **required per the act's own contract**, not globally;
- **no free-text notes** — a separate decision if ever motivated, with a retention/redaction path.

## ADR-015 — ACCEPTED with **D1 amended** on the Product Owner's direction.

The PO declined a blanket "required on every write". D1 is replaced by:

### D1 (amended) — Every write operation must **declare its idempotency stance**.

One of three, stated in the operation's contract:
- **`client-key`** — a client-supplied idempotency key. The default for user-facing writes.
- **`derived-key`** — the key is derived from the act's own originating event (an inbound integration
  message id; the Organization-creation provisioning event). For system-originated acts where no
  client exists to supply one.
- **`exempt`** — permitted, with a **stated reason** in the contract.

**A write operation that declares nothing is refused by a check.**

**What this relaxes:** no write is forced to invent a client key where none naturally exists, and a
deliberate exemption is available.
**What it preserves — and the reason it is not simply optional:** *forgetting becomes impossible.* An
undeclared operation reds; it does not sail through unnoticed. This corpus has recorded the opt-in
failure shape repeatedly (the ADR header field that could not notice a missing file; the opt-in
teardown prefix; the advisory lock a new command could bypass), and this amendment keeps the
flexibility the PO asked for without reproducing it.

**D2–D6 stand unchanged:** written in the same transaction as act + audit by the audited-write
primitive; uniqueness `(principal, operation, key)`; a repeat re-derives the response by reading the
act (no response blob); the same key with a different act is refused; keys are retained and pruning is
an owner-level maintenance act, never a runtime delete.

---

## Carry-in obligation
Both ADRs must reach `docs/adr/` **before or in** the first PID whose artifacts cite them — otherwise
the citation dangles and the gate reds (the GEN-019 / GEN-022 lesson, twice learned). ADR-015 is
carried with D1 in its **amended** form and this acceptance recorded alongside.

## Status after this record
`ADR-014` Accepted v1.0 · `ADR-015` Accepted v1.1 (D1 amended). Both feed the next phase: **WEB-15 /
grant administration**, then schema origination (notices / cases).
