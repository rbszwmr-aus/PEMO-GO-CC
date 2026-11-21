# ADR-013 core — Product Owner acceptance

**Accepted:** 2026-08-29 by the Product Owner (this session).
**Applies to:** `adr-013-append-only-state-the-assertion-model.md`.

## What is accepted
The **core** of ADR-013 — the append-only assertion model:
- **D1** mutable facts as a stable instance + append-only versioned assertions;
- **D2** computed currency (`MAX(version)`), `UNIQUE(instance_id, version)` as the whole of
  supersession + first-assertion safety, no stored `active` flag;
- **D3** valid-time carried as data, system-time as the version, the table its own history;
- **D4** one shared reader-resolver, not per-module;
- **D6** binds to idempotency (unique/serialization violation → the winning act's client response).

**D5** (cross-instance cardinality) is accepted as a **framework**: the mechanism is ruled
**per invariant, at each state-change table's write PID** — not fixed globally here. (GEN-015 Step 1
already produced the occupancy ruling: the invariant is `(resident, unit)`, not per-unit, and its
mechanism is deferred to slice B — see `GEN-015-RULINGS-step1.md`.)

## Note on the ADR body's status line (a real, disclosed limitation)
The ADR body still reads `Proposed — Awaiting Product Owner acceptance`. The Drive update tool
patches metadata only, not content, so the body line could not be flipped in place. **This
acceptance doc is authoritative** — the same pattern as `adr-012-core-acceptance.md`. The body line
is reconciled when ADR-013 is carried into the repo (`docs/adr/`) under the **elevated
ADR-consolidation** item. Until then: reading the ADR body alone understates its status; read this
sibling. GEN-015 Step 1 flagged exactly this (the third instance of "an artifact stale relative to a
document it does not name") — it is the standing argument for consolidation.
