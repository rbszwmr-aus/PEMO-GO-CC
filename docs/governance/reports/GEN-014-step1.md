# GEN-014 — Step 1: the vehicle, and a map of the 27

**Status:** assessed. **HARD STOP.** Nothing built beyond the allocation.
**Headline:** the preferred vehicle **has no table and no handler** — notices are contract-and-fixtures only, so it would originate schema. And a finding that reaches back: **`ADR-010`'s AMENDMENT (2026-08-19, accepted) lifted `ADR-011` `D10`**, the closure GEN-013's Step 1 rested on. My conclusion there survives — A4 rules interest writes need an **Approver**, so they are not scope-only — but one of my stated reasons was stale, and I did not read the amendment.

---

## 1. Pin and allocation

| | |
|---|---|
| **Pin** | `304ebeb121d73088e08c76ac10ee6d3ff079bd10`, `origin/main` re-read from the remote and equal to HEAD, tree `50fe97be…`, 813 files |
| **Number** | **014** from the generator's directory scan; next is 015 |
| **`main` now** | `8839d42fcfa6a1189fbd163d8df45a302cf2afd5` — the allocation |

The allocation's push was **gated on `pid-index --check` this time**, which is the hole GEN-013 pushed through. The owed merge-gate item stands; this is one PID honouring it by hand, not the fix.

## 2. FINDING — an accepted amendment, outside the repository, changed a decision I relied on

`ADR-010-AMENDMENT-open-questions-closed.md` — **Status: Accepted v1.0, Product Owner, 2026-08-19**, `Gates released: every write operation in PEMO` — states its own `Target location:` as `docs/adr/ADR-010-AMENDMENT-open-questions-closed.md`. **It is not there.** It lives only in `Prompt/specs/`, alongside `ADR-011` and `ADR-012`, which the Step-1 ruling for GEN-013 already made an owed item.

Its `A4` **lifts `ADR-011` `D10`** — the very closure I cited when I rejected the interest vehicle ten days after it had been lifted. I read `ADR-011` as filed and did not look for a document that amends it, because `ADR-011` does not point forward to one.

**GEN-013's conclusion survives on its merits.** A4 rules *"Estate staff composes; an Approver confirms"* — so an interest write is **not** a scope-only estate_staff act, which is exactly why it was wrong for the A phase. But I reached a right answer partly by a stale route, and that is worth naming rather than quietly benefiting from.

**The principle this sharpens:** *read the artifact, not the summary* has a second edge — **an artifact can be amended by a document it does not name.** Reading `ADR-011` in full was not enough; nothing in it points to the amendment. The only defence is to look for amendments of anything load-bearing, which is cheap, and which the repo's missing ADRs make harder than it should be. **This raises the priority of the owed ADR-consolidation item: the amendment names its own target path in the repo, so the gap is a filing failure with a known address.**

## 3. The vehicle — the preferred one is not buildable, and why

**NOTICES: no table, no handler.** `home_safety`, `property`, `resident`, `integration`, `platform`, `access` and `dev_scaffold` hold 45 tables between them and **none is a notice or a case**. `listNotices`, `getNotice` and `listCases` are contracted operations with **no route registered in `server.ts`** — contract and fixtures only. Composing a notice would originate a module's schema *and* its read surface, which the GEN-009 rule forbids and which is far more than a vehicle. The amendment confirms the *authorization* — *"S5's stuck fixture — the composer's submit is scope, the approval is Approver"* — but authorization is not the blocker; the absence of a model is.

**INTEGRATION (the natural third module): both candidates are excluded, and for the same reason.**

| candidate | why not |
|---|---|
| `integration.classification_quarantine` disposition | a **state change** — `status` `held → resolved` with `resolved_by`/`resolved_at` on the *same* row, guarded by `quarantine_resolution_is_explicit`. An UPDATE, which the floor forbids. And `ADR-010` `D2` assigns quarantine disposition to **Integration support**, a capability, not scope-only. |
| `integration.device_location_mapping` | a genuine first assertion (effective-dated, exclusion-constrained), but `ADR-010` `D2` assigns *"unmapped-node mapping"* to **Integration support** too. |

So **the integration module contains no scope-only `estate_staff` write at all.** Its writes belong to a different role.

**Two more tables that look like first assertions and are not:** `property.building_service_availability` (PK `location_id`) and `home_safety.installed_services_note` (PK `unit_id`) are **one row per key**, so recording a new state means replacing the row — a state change, behind the same wall as occupancy ending.

### What I recommend, with its weakness stated

**`property.estate_contact`** — adding an estate contact (management office, emergency, approved service).

- **A third module**, distinct from Home Safety and Resident.
- **A first assertion:** `contact_id` PK, many rows per estate, no uniqueness forcing replacement, no status column, no effective dating. A new contact is a plain INSERT of a row valid on creation. Nothing to supersede.
- **Node-scoped at the estate**, with an FK to `property.estate` — so the gate is at the same depth GEN-009 used, and the target's existence is *this* module's own fact, which means the in-query filter can be the real thing rather than defence in depth. That is a **better test of §2's oracle requirement** than occupancy was.
- **Read-only today** — no write path touches it.

**Its weakness, stated rather than buried: I cannot show it is one of the 27.** `ADR-010` `D1`'s ungated list names *"the whole help-desk surface"* and *"the counter"*, and an estate's management-office contact is help-desk furniture — but that is my inference, not the ADR's words. **If you want a vehicle whose membership is explicit, none of the remaining tables gives you one**, which is §4's finding.

## 4. The map of the 27 — the honest answer is that it is NOT cleanly enumerable

**No enumeration of the 27 exists in the repository or in the specs.** `ADR-010` gives a *count* — *"27 of 53 actions are scope-only"* — derived from `DOC-021-ST`'s evidence pass, and a *description by category*, never a list. `DOC-030-ST` audits coverage without enumerating actions. So I will not manufacture a list. What follows is the fragment I can support, each row traceable to a decision or a table.

**Done:**

| act | module | kind | node |
|---|---|---|---|
| publish a management update | home_safety | first assertion | estate (GEN-009) |
| record an occupancy | resident | first assertion | unit (GEN-013) |

**Identifiable and remaining — first assertion (buildable now):**

| act | module | status |
|---|---|---|
| add an estate contact | property | table exists, read-only; **membership in the 27 inferred** |
| create a Location | property | `createLocationCommands` **already built and unrouted**; ADR-003; "the counter … the cleanest scope case in the product" |

**Identifiable and remaining — state change (BLOCKED on the owed supersession key):**

| act | module | why blocked |
|---|---|---|
| end / correct an occupancy | resident | `0022` has no supersession key (GEN-013) |
| record building-service availability | property | one row per `location_id` |
| set an installed-services note | home_safety | one row per `unit_id` |
| end a household membership | resident | `effective_to` UPDATE |

**Named by ADR-010/the amendment but with NO MODEL — schema must be originated first:**
notice compose/submit (S5), every case operation except escalation, the help-desk surface, visitor and credential requests, audience selection. **These are the bulk of the 27, and none is buildable as a vehicle without originating a module's schema.**

**Not scope-only at all** — excluded from the 27 by role, and worth having on the map so nobody reaches for them: quarantine disposition and device mapping (**Integration support**); interest writes (**Approver**, amendment A4); all-clear (its own capability, A2); severity policy contents (attestation-gated, A3); grant administration / WEB-15 (**Grant administrator**).

**What the map actually tells you.** Of the acts I can identify, **two are done, two are first-assertion and buildable, four are blocked on the supersession key, and the largest group has no model at all.** So: the A phase has roughly **two more writes** before it runs out of first-assertion vehicles with existing tables. **The supersession decision is not distant — it is the next thing that unblocks work**, and after it the constraint becomes schema origination, which is a different kind of PID.

## 5. Gaps — this list is complete

1. **The 27 is not enumerable** from repo or specs (§4). The fragment is traceable; the total is not reconstructible, and I did not try to make it add to 27.
2. **`property.estate_contact`'s membership in the 27 is inferred**, not stated (§3).
3. **I have not confirmed the seeded world supports the negative case** for estate contacts — a principal in scope of one estate and not another. GEN-013's world did at unit depth; I have not re-derived it here.
4. **`estate_contact` has no organization column** — tenancy is reached through `estate_id`. Cross-organization isolation would therefore be enforced via the estate lookup, not on the row, and I have not checked that path.
5. **I have not read `DOC-021-ST`**, which produced the 27 count and is the one document that might enumerate the actions. It is in `Prompt/specs/`; I stopped at ADR-010 and the amendment. Named because I did not read it, not because I judged it irrelevant.
6. **`property` already holds an unrouted write path** (`createLocationCommands`). Whether GEN-014 should route that instead of adding a second is a real alternative I have not costed.
7. **The amendment's other releases are unexamined** — A1's "attributable when there is legitimately no actor" may bear on the audit record's `principal_id` FK, and I have not checked whether it does.

## 6. Rulings sought

1. **§3** — `property.estate_contact` as the vehicle, or do you choose otherwise given its inferred membership? §5.6's alternative (route the existing Location command) is the other candidate.
2. **§2** — the amendment is accepted and names its own repo path. Does the ADR-consolidation owed item get promoted, and does anything in GEN-013 need re-recording?
3. **§4** — does the map change A's sequencing, and does it move the supersession decision forward?
4. **§5.5** — should I read `DOC-021-ST` before you rule on the map?
5. **§5.7** — does amendment A1 bear on the audit record's shape?

**HARD STOP.**
