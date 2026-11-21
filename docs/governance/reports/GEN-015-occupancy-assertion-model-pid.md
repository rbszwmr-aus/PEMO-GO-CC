# PID — apply ADR-013 to occupancy: the first assertion-model table, the shared resolver, the end write

**Author:** Master Brain → Main CC. **Dispatch: after GEN-014 close** (done; main c4d6a016).
**Why occupancy first:** ADR-013 (assertion model) is PO-accepted. Occupancy is the first table
because GEN-013 deferred its **end path** against exactly this wall, and because it is the FIRST
state-change table it must build the **shared reader-resolver** (ADR-013 D4) that every later
state-change table reuses. This PID retires the GEN-013 deferral and lays the shared read shape.

---

type: GEN (allocate the number from the directory at dispatch; do not carry one in prose)
from → to: Master Brain → Main CC
pin: current origin/main (c4d6a016…), read and report at Step 1
write-scope: occupancy's table (a NEW migration — never edit 0022), its reader(s) incl.
`isActiveAt`, the shared reader-resolver's home, the occupancy end write surface + handler + its
contract (OpenAPI + fixtures + lock/stamp), the relevant tests. Read-only elsewhere. Report exact
paths at Step 1.

## What this builds (ADR-013 D1–D4, D6; D5 per my Step-1 ruling)

1. **Occupancy becomes assertion-shaped.** A NEW migration adds `version`, `recorded_at`, and the
   valid-time columns (`valid_from`/`valid_to`) where absent, plus **`UNIQUE(instance_id, version)`**.
   The existing seed row is reinterpreted as `version = 1`. **0022 is not touched.**
2. **The shared reader-resolver (D4), built once.** The single "resolve `MAX(version)` per instance
   as-of the query, then evaluate that assertion" shape — its home, its signature, reused (not
   re-derived) by every later state-change table. `isActiveAt` is rewritten to consume it.
3. **The occupancy END write** — the GEN-013 deferral, now expressible: append `version + 1` with
   `valid_to` set. Authorization UNCHANGED (scope-only `estate_staff`; ADR-011 D7 keeps occupancy
   out of the interest surface).

## Step 1 — assess, propose, AND rule-seek. HARD STOP.

- **Read 0022 in full**: exact columns, the occupancy **instance identity** (report whether it is
  an `occupancy_id` instance or a `(unit, party)` key), current constraints, how `isActiveAt` reads
  today, and the seed rows.
- **Propose the migration** (the D2/D3 columns + `UNIQUE(instance_id, version)`, seed → version 1).
- **Propose the shared resolver** (D4): the one shape, where it lives, how `isActiveAt` is rewritten
  onto it.
- **Rule-seek on occupancy's cross-instance cardinality (D5).** Does the model require
  **one active occupancy per unit** (from 0022 / ADR-011)? If yes, propose the D5 mechanism —
  `SERIALIZABLE` guard on the check-and-append, or a range **exclusion constraint over live
  assertions** — with the trade-off. **I rule which before you build.** If the model does NOT
  require it, say so with the evidence, and D5 is a no-op here.
- **Report a build-plan and weight estimate** for Step 2 so I can decide whether to split the
  migration+resolver+reader-rewrite from the end write.

## Step 2 — build, each proven by making it fail. HARD STOP before commit.

- **The migration + seed reinterpretation.** Applied on a fresh DB; the seed reads as version 1.
- **The resolver + reader rewrite.** Prove against **seeded multi-version data**: insert version 1
  (active) and version 2 (`ended`) directly; the reader answers **ended**. This is the exact
  GEN-013 red — an appended `ended` assertion beside an active one — now green **for the right
  reason** (supersession, not row-independent evaluation). Prove a superseded assertion is **never**
  read as current (mutate the resolver's ordering → the suite reds).
- **The END write.** Gate as GEN-013/014 (name the deciding layer in the contract); audited-write
  primitive (act + audit atomic); narrowest authorizing grant recorded; the act is `version + 1`
  with `valid_to`. Prove the gate (grant end-dated → refused, absent).
- **Supersession safety (D2).** Two concurrent ends target the same next version → `UNIQUE(instance,
  version)` → one wins, the other is mapped to the winning act's client response (D6), never a raw
  conflict. Prove the unique **bites** (mutation): remove it → the concurrent test reds.
- **D5 cardinality** (per my Step-1 ruling, if occupancy carries the invariant): prove it holds
  under concurrency — the guard bites, out-of-invariant is refused.
- **Idempotency binding (D6).** A repeated end resolves to the **same response**, not a second row
  and not a raw unique-violation surfaced to the client.
- **Generalisation.** State what is now **shared** for the next state-change table (the resolver,
  the assertion-column pattern, the concurrency mapping) and what was occupancy's own. Any shared
  code widened is a scope-touch — call it out.

## Reuse, unchanged
The platform audited-write primitive (GEN-011); the gate shape (grant lookup / in-query filter,
deciding layer named per contract); narrowest-grant record; Property 4 inherited (append-only).

## Not in scope (owed, do not touch)
The idempotency **request-identity** decision (D6 is the state-identity half only; the retry-token
half is a separate PO decision — do not build it); the OTHER state-change tables
(`building_service_availability`, `installed_services_note`, quarantine) — they reuse this PID's
resolver later; ADR-consolidation into `docs/adr/`; GEN-009 cross-surface error-URI `sharedMeaning`.

Report the weight honestly. Two steps, HARD STOP at each.
