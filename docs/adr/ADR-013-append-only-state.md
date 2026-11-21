# ADR-013 — Append-only state: the assertion model

**Status:** `Accepted` — `v1.1`. Core accepted by the Product Owner 2026-08-29
(see `ADR-013-ACCEPTANCE-product-owner.md`). Corollaries below added during application (GEN-015, GEN-016).
**Date:** 2026-08-29
**Author:** PEMO Master Brain
**Decision owner:** Product Owner
**Target location:** `docs/adr/ADR-013-append-only-state.md` — **carried in by `GEN-017`.**
**Related:** `ADR-010` (`D1` audit-not-gate; the 27 scope-only writes) · `ADR-011` (`D7`
occupancy/interest separation; `D10`/A4 interest-write authorization) · `least-privilege-db-roles`
(`pemo_app` is `SELECT`+`INSERT`, owns nothing) · `GEN-009`/`GEN-013`/`GEN-014` (the audited
scope-only write path) · the pending **idempotency** decision (binds here — see D6).
**Unblocks:** the 4 state-change scope-only writes (occupancy end, `building_service_availability`,
`installed_services_note`, quarantine disposition) and every future write whose act *changes* a
fact rather than asserting a new one.

---

## The problem, stated once

The runtime role cannot mutate. `least-privilege-db-roles` made `pemo_app` `SELECT`+`INSERT`
only — no `UPDATE`, no `DELETE` — and the whole runtime is append-only *by measurement*. That was
adopted as a floor. It is also a **modelling constraint that has now come due**: a fact that
changes over time cannot be changed in place, because changing in place is an `UPDATE`.

GEN-013 hit the wall exactly here. Ending an occupancy by appending an `ended` row beside the
active one left the reader answering `authorized`, because `isActiveAt` evaluates **each row
independently** and the schema carries **no way for a later row to supersede an earlier one**. An
append that cannot supersede is not a state change — it is a contradiction the reader cannot
resolve. So the end path was deferred, and four scope-only writes with it.

This is not an occupancy problem. **Every fact that has a lifecycle** — starts, ends, is corrected
— meets it. ADR-010 A1's rule governs the answer: *do not solve one shape twice, differently.* This
ADR rules the one shape.

---

## Decisions

### D1 — Mutable facts are represented as an append-only series of immutable **assertions**.

A fact with a lifecycle is not a row that changes. It is a **stable instance identity** plus a
sequence of **assertions** about that instance, each an immutable row. Creating the fact is the
first assertion; **ending, correcting, or re-opening it are further assertions**. No assertion is
ever modified or deleted. The **current truth about the instance is its latest assertion**; earlier
assertions are its history, retained in place.

An occupancy is an *instance* (a party's tenure in a unit, keyed by its own id); "created",
"ended", "corrected" are assertions about that instance. Two successive occupancies of one unit are
two instances, two identities — not two versions of one.

### D2 — Currency is **computed from a version**, never stored as a flag. Supersession safety is a **database constraint**.

There is **no `active` boolean to flip** — flipping it is an `UPDATE`, which the runtime cannot
issue and which this ADR forbids anyone to reintroduce. Instead each assertion carries a
**monotonic `version` per instance**, and:

> **the current assertion is `MAX(version)` for that instance, and `UNIQUE(instance_id, version)`
> is the whole of supersession safety.**

This single constraint does two jobs append-only, with no stored liveness:

- **Safe supersession.** An act that changes the fact reads the version it believes current and
  appends `version + 1`. Two concurrent changes both targeting the same next version collide on the
  unique index; one wins, the other gets a unique violation and re-reads (optimistic concurrency).
  There is no interval to close, no prior row to touch.
- **Safe first assertion.** The first assertion is `version = 1`; two concurrent creates of the
  same instance identity collide the same way.

`supersedes`-pointer chains were considered and rejected: resolving current state walks the chain
(`O(n)`), where `MAX(version)` over an index is `O(1)` and needs no pointer bookkeeping.

### D3 — Valid-time is **data**; system-time is the **version**. The table is its own history.

Each assertion states the **full current belief** about the instance, including its **valid
interval in the world** (`valid_from`, `valid_to`) — the dates a tenancy actually runs, which are
not the moment staff recorded them. Ending a tenancy is an assertion whose `valid_to` is set; no
earlier row is edited. A `recorded_at` (system time) accompanies the version for as-of queries and
audit ordering.

Consequence, and a benefit: **there is no separate history table.** The assertion sequence *is* the
fact's history, and it is append-only by the same floor that made the runtime append-only — so
Property 4 (immutability) is inherited here exactly as it is inherited by audit. The audited-write
primitive (GEN-011) writes each assertion + its `access.audit_event` atomically, unchanged.

### D4 — The reader resolves **latest-then-evaluate**, uniformly, in one shared shape.

`isActiveAt` and every reader like it are rewritten from *"evaluate each row"* to *"resolve the
`MAX(version)` assertion for the instance as-of the query time, then evaluate that assertion's
validity."* This resolution is **one shared shape** (`DISTINCT ON (instance_id) … ORDER BY
instance_id, version DESC`, or the project's chosen equivalent), **not re-derived per module** —
the read-side instance of *do not solve one shape twice*. Reading a superseded assertion as current
is the failure this decision exists to prevent; the shared resolver is where that is guaranteed
once.

### D5 — Cross-instance **cardinality over current state** is a distinct problem, ruled per invariant.

D1–D4 make a single instance's lifecycle safe. They do **not** by themselves enforce invariants
that quantify over the *current* state across instances — "at most one active occupancy per unit",
"at most one management-office contact per estate" (the GEN-014 race). These are cardinality
constraints over computed-current state, and they do **not** all reduce to `UNIQUE(instance,
version)`. They are ruled **per invariant, when the table's write PID is authored**, from this
ordered menu:

1. **Row-presence cardinality → a partial unique index.** Where "current" is representable by a
   row simply *existing* (a non-versioned membership, e.g. the one-office contact), a partial unique
   index (`UNIQUE (estate_id) WHERE contact_kind = 'management_office'`) enforces it directly,
   append-only. This is the GEN-014 fix.
2. **Computed-current cardinality → `SERIALIZABLE` isolation for the guarding read+insert**, or a
   range **exclusion constraint over live assertions** where the invariant is expressible as
   non-overlap (`EXCLUDE USING gist (unit_id WITH =, valid_range WITH &&)` restricted to the
   current assertions). Where currency is computed (one-active-occupancy-per-unit), a partial unique
   index cannot see "the max-version row's status", so the guard is the DB's serialization of the
   check-and-append, at the cost of retrying serialization failures.

The rule is the standing one: **the invariant lives at the layer that can hold it, never in the
route as count-then-insert** — that is the uniqueness analogue of the fetch-then-reject anti-pattern
already forbidden. Which of (1)/(2) applies is a ruling, not a default; the write PID states it.

### D6 — This **binds to idempotency**, and a violation is **invisible to the client**.

The one-office race (GEN-014), a retried request that would double-write act+audit, and two
concurrent supersessions are **the same shape**: one logical act, at most one row. D6 rules the
shared consequence: **a unique or serialization violation is mapped to the same client-visible
response as the winning act** (GEN-014 already contracted `management-office-contact-exists` for
exactly this). Moving enforcement from the route to the database therefore **never changes the
answer a client sees** — it only makes the answer true under concurrency. The idempotency decision
supplies the request-identity half (a client token that makes a *retry* resolve to the original
act's response rather than a conflict); this ADR supplies the state-identity half. Neither invents
a second mechanism.

---

## Consequences

**Migrations are per-table, new, and never edit an existing one.** Each state-change table
(occupancy/`0022`, `building_service_availability`, `installed_services_note`, and the quarantine
disposition table) gets a **new** migration adding `version`, `recorded_at`, the valid-time columns
where absent, and `UNIQUE(instance_id, version)`; the existing seed row is reinterpreted as
`version = 1`. `0022` is not touched. Each is its own PID.

**Authorization is unchanged by this ADR.** *How* a change is expressed (a superseding assertion) is
orthogonal to *who* may express it. Ending an occupancy stays a scope-only `estate_staff` act
(ADR-011 D7 keeps occupancy out of the interest surface); creating, ending or correcting an
*interest* still requires an Approver (ADR-011 A4). This ADR gives the interest-write surface its
mechanism without touching its gate.

**The 4 blocked writes are unblocked** the moment their table carries the D2 columns. Occupancy end
becomes `version + 1` with `valid_to` set — the GEN-013 deferral is retired by a migration, not a
workaround.

## What this releases, and what it does not

**Released.** Every state-change scope-only write; the occupancy end path; the interest-write
surface's mechanism (its gate still ADR-011 A4); a uniform, provable answer to *"is this fact
current?"*.

**Not released.** The **idempotency request-identity decision** still stands open and still gates
reliance on any of these writes under retry (D6 is the binding, not the whole). The **per-invariant
D5 rulings** are owed at each table's write PID, not here. The **shared reader-resolution helper**
(D4) must be built once before the second state-change table reuses it, or it will be re-derived —
the same debt the audited-write path paid down for writes.

## Corollaries (added during application — GEN-015, GEN-016)

**C1 — Lapse vs end.** A fact leaves its live state two ways: it **lapses** when its effective
interval elapses, or it is **ended** by a superseding assertion. Liveness is computed from both;
neither is a stored flag. (An expired tenure lapses; a staff end is a superseding assertion.)

**C2 — Orthogonal guards.** D2's `UNIQUE(instance_id, version)` and D5's cardinality mechanism guard
**orthogonal** invariants: `UNIQUE` holds within-instance supersession (two acts on the same
instance), the D5 mechanism holds cross-instance cardinality (two instances competing for one live
slot). Each carries its own oracle; neither substitutes for the other.

**C3 — D5 mechanism refinement.** The preferred mechanism for a **computed-current** cardinality
invariant is a **per-key advisory transaction lock with the conflict check inside the act callback**
— no shared-primitive widening, blast radius confined to the key. `SERIALIZABLE` is the fallback only
where the invariant spans keys a single advisory key cannot cover. A **row-presence** cardinality
(a row simply existing) instead takes a **partial unique index** (D5 option 1). The mechanism
depends on READ COMMITTED and must assert that isolation level rather than trust the default.

**C4 — A constraint violation is never a 500.** A raw database constraint violation (`23505` etc.)
maps to the act's **truthful outcome** (e.g. the instance is already ended → not live → `409`,
nothing appended), never a server fault. The winning act's client response is what a losing racer
also sees (D6).

**C5 — Reason is act-metadata, not fact-data.** *Why* a fact changed is a property of the act and
belongs in the audit record, not on the fact's assertion row. Recording it depends on the audit
spine carrying a reason field — an **owed decision** (`access.audit_event` currently carries only
D1's four properties, no free-form field). Until ruled, no reason column is added to a fact table.

## Decision record

```text
Assertion model:     a mutable fact is a stable instance + an append-only
                     series of immutable versioned assertions; current =
                     MAX(version); end/correct/reopen are new assertions      — proposed 2026-08-29
Supersession safety: computed currency, never a stored flag; UNIQUE(instance,
                     version) is the whole guarantee; optimistic concurrency   — proposed 2026-08-29
Valid vs system time: valid interval carried as data per assertion; version is
                     system ordering; the table is its own history            — proposed 2026-08-29
Reader:              latest-then-evaluate, one shared resolver, not per-module — proposed 2026-08-29
Cross-instance
cardinality:         distinct problem; per-invariant — partial unique index
                     (row-presence) or SERIALIZABLE / range-exclusion
                     (computed-current); never count-then-insert in the route  — proposed 2026-08-29
Idempotency binding: unique/serialization violation maps to the winning act's
                     client response; enforcement moving to the DB never
                     changes the answer; request-identity half owed to the
                     idempotency decision                                      — proposed 2026-08-29
```
