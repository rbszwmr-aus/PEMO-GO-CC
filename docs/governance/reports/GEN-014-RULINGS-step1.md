# GEN-014 (A) — Step 1 rulings

Date: 2026-08-29
Report: rewrite/reports/GEN-014-step1.md — HARD STOP. main 8839d42f (allocation only, push gated on `pid-index --check` — the GEN-013 hole, now closed in practice).
Pin: 304ebeb…, tree 50fe97be…, 813 files.

## The headline: this Step 1's real product is the MAP, and the map changes the plan.

The vehicle question is settled below, but the finding that matters is that **A (scope-only
writes on existing tables) is nearly exhausted, and the "27" was never a buildable backlog.**
Rule accordingly.

---

## R1 — Vehicle `property.estate_contact`: APPROVED, and it earns its round.

A genuine first assertion — many rows per estate, no status, no effective-dating — so it is
clear of the supersession wall that stopped occupancy's end path. Third module, real FK,
estate-scoped. Proceed to Step 2.

It is **not busywork**, and here is why it justifies a round when the path is already proven:
occupancy left the in-query filter as mere **defence in depth**, shadowed by the grant lookup
(GEN-013 R3). `estate_contact`'s target existence is *that module's own fact*, so the in-query
`WHERE … = ANY(allowed)` can finally be the **deciding layer** — out-of-scope is ABSENT because
the filter is in the query and IS the gate. That is the original intended gate shape
(WRITE-SKELETON), demonstrated as primary for the first time. GEN-014's oracle closes the R3
question rather than re-running GEN-013.

Accepted weakness, stated honestly by Main CC: it cannot be shown to be one of the "27." That
does not block it — authorization is scope-only on its own merits, and the "27" was a *count
from evidence, never an enumeration* (see R3). We build it because it is a scope-only
first-assertion staff write, not because it is on a list that does not exist in enumerated form.

## R2 — The backward-reaching amendment finding: ACCEPTED, and it ELEVATES ADR-consolidation.

`ADR-010-AMENDMENT-open-questions-closed.md` is PO-accepted (2026-08-19, "Gates released: every
write operation in PEMO"), names its own repo home (`docs/adr/`), and is not there. Its A4
lifted `ADR-011` D10 ten days before GEN-013 Step 1 reasoned from D10's closure. The conclusion
survived (A4: Estate staff composes, Approver confirms → interest writes are not scope-only),
but the route was stale.

The rule Main CC drew is exactly right and exactly the danger: **an artifact can be amended by a
document it does not name.** A doc read in isolation cannot be trusted to know it is current.
This has now caused stale-route reasoning **twice** (ADR-011/012 missing at GEN-013 Step 1; the
amendment missing here).

Ruling: **ADR-consolidation moves up.** Carrying `ADR-010-AMENDMENT` + `ADR-011` + `ADR-012`
into `docs/adr/` (reconciling D1's stale `(principal, scope node)` language against ADR-012's
group) is no longer a cosmetic owed item — it is actively corrupting reasoning routes and is now
the **first C item to schedule**, cheap and protective. NOT part of GEN-014.

## R3 — The map is the result, and A's premise is spent.

Main CC did not manufacture a list, correctly: ADR-010 gives a count from DOC-021-ST's evidence
pass and a category description, never an enumeration. The traceable fragment:

- **2 done** (GEN-009, GEN-013)
- **~2 first-assertion + buildable on existing tables** (estate_contact is one)
- **4 blocked on the supersession key** (occupancy end, `building_service_availability`,
  `installed_services_note`, quarantine disposition — all one-row-per-key state changes)
- **largest group has NO model at all** (notices, cases, help-desk, visitor/credential
  requests, audience selection — contract + fixtures only, no table, no route)

Consequence: **after GEN-014, scope-only writes on existing tables are essentially done.** The
proving purpose of A — establish a reusable audited scope-only path — is SATISFIED (GEN-009 built
it, GEN-013 generalised it, GEN-014 closes the gate-shape question). Grinding further scope-only
writes past this point is repetition, not information.

The binding constraint now shifts, in this order:
1. **The supersession-key decision** — makes "ending/correcting a fact = a superseding append,"
   unblocking the 4 state-change writes AND setting the model-wide property that state changes
   are appends (pemo_app stays INSERT-only). Brain work; I author it next. Highest unblock/effort.
2. Then a genuine **fork the PO must weigh**: **schema origination** for the model-less modules
   (notices/cases/help-desk — a *different kind of PID*: schema + read + write + UI, and product
   scope) vs **WEB-15 / grant administration** (ADR-010's recommended #2; until it exists every
   grant is manual) vs a **C-debt sweep** (the elevated ADR-consolidation + floor-hardening).

DOC-021-ST (the doc that produced the 27 count, unread) may enumerate the actions — a cheap read
worth doing to confirm/refute "no enumeration" and to catch any listed action that maps to an
existing table we missed. Fold into the post-GEN-014 sequencing, not into this build.

## Plan note (drives the next turns, not a question to stall on)
- Now: GEN-014 → Step 2 on estate_contact, prove the in-query filter as the PRIMARY gate.
- Next: author the supersession-key decision (unblocks the 4; sets the append-supersession property).
- Slot in soon (cheap, protective): ADR-consolidation into docs/adr/.
- Then bring the PO the schema-origination vs WEB-15 fork — that one is a real product-scope call.

## Owed ledger (updated)
ADR-consolidation into docs/adr/ **[elevated → first C]** · supersession-key migration/decision
**[now next, brain-authored]** · GEN-009 cross-surface error-URI sharedMeaning · shadowed-layer
empty-oracle principle → PID-PRINCIPLES + battery case · merge-gate `--check`+battery (honoured
in practice at 014; codify) · premise-arm-guard · harness reseed() clears pinning rows · stable
principle ids · idempotency as a shared mechanism · read DOC-021-ST.
