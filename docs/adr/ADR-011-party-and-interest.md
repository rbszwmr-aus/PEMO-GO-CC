# ADR-011 — Party and interest: who stands in what relation to a unit

**Status:** **`Accepted`** — `v1.1`, accepted by the Product Owner 2026-08-19. `D1`–`D10` taken 2026-08-19. **Open questions 1 and 2 are closed** — `OQ1` (which role may write an interest) by `ADR-010-AMENDMENT` `A4`: **Estate staff composes, Approver confirms**, which lifts `D10`; `OQ2` (owner login) on 2026-08-19: **a natural person is entitled to request a login, verified by estate staff; a legal person nominates an `authorized representative`** — which makes building that relationship a required consequence rather than a side effect. **`OQ3` (`INT-03` outbound) closed 2026-08-19: the direction is recorded and the publisher is not PEMO core's to build — an integration server exposes it. Pinned 2026-08-19: the server is `2IoThub`. The third-party-facing API and its transport are out of PEMO's scope permanently — **PEMO builds no publisher, ever** — while PEMO's own side of that exchange is Integration Hub's and is deferred, not excluded. Both are true, of different layers. All three open questions are now closed.**
**Date:** 2026-08-19
**Author:** PEMO Master Brain (end-user portal track)
**Decision owner:** Product Owner
**Target location:** `docs/adr/ADR-011-party-and-interest.md`
**Committing session:** `PEMO Contract` — `GEN-018-ST`'s write scope excludes `docs/**`, so this ADR has no other authorised route into the repository.
**Gates:** the owner-facing surface; management-fee routing; the corporate-tenant demonstration seed; `INT-03`'s direction; `PEMO_Function_Scope_v0.4`.
**Evidence:** `PEMO_Function_Scope_v0.3.md` — §3.2 `PRP-02`/`PRP-03`, §3.3 `RES-04`, §6 `INT-03`/`INT-04`, §7 Systems of Record, §8 Out of Scope — **read in full rather than from its summary**, together with `FUNCTION-SCOPE-DISPOSITION-AND-TRACEABILITY.md`, `GEN-006-ST` §2.2–2.3, and `GEN-018-ST`'s scope-model, module-placement and property-core reports.
**Related:** `ADR-002` (hierarchy, tenancy root), `ADR-003` (`Q5` unit-terminal, locations), `ADR-006` (`D3` ownership boundaries), `ADR-007` (`D3` tiers, `D4` scope grants, `A3` widening cost), `ADR-010` (`D1` audit default, `D4` exclusion key, `D5` roles ≠ tiers).
**Rulings applied:** `R8` (`PEMO_System_of_Record_Ruling_R8_v1.0.md`), and the Product Owner's rulings of 2026-08-19 on interest level and the owner's safety-event projection.

---

## Why this could not have been written earlier, and why it can be written now

Every module in PEMO resolves at a unit — occupancy, household membership, safety audience, booking eligibility, notice audience. **None of them can say who the unit belongs to.** `GEN-006-ST` built Resident, Household, membership and occupancy; nothing anywhere holds *B4's owner is Mr Chan*.

It could not be written earlier because the answer depended on a question nobody had put: **is PEMO the system of record for that fact, or a consumer of one?** A consumer needs a foreign key and a sync job. A system of record needs an entity, an effective-dated history, an audit trail and a write surface — and a write surface needs the role list, which is itself open.

`R8` answered it on 2026-08-19. That, plus the Product Owner's ruling that an interest is held at a unit, is the whole of what was missing.

## The three findings that frame every decision below

**1. The model was scoped and then not built, and the traceability map cannot see the difference.**

`PRP-03 Occupancy and relationship status` reads, verbatim:

> - **Owner, resident, household member and authorized representative** roles
> - Effective and expiry dates
> - Move-in/move-out status received from an authoritative external system
> - Approval and verification status for self-registered users
> - Historical relationship record
> - **No lease, rent, deposit or tenancy administration**

`FUNCTION-SCOPE-DISPOSITION-AND-TRACEABILITY.md` marks `PRP-03` **OK**, where the legend defines OK as *"covered"*. `GEN-006-ST` built **resident** and **household member**. **Owner** and **authorized representative** have no schema.

**The map was produced by asking "does a module own this?", and that question cannot detect a feature whose owner built part of it.** Every other **OK** in that map was earned the same way. This ADR does not re-audit the map, but the caveat belongs on it, because it is currently read as a coverage statement.

**2. Two modules already claim the same datum, in the document that assigns ownership.**

| | Assigned module | Text |
|---|---|---|
| `PRP-02` Unit profile | **Property Core** | *"**Owner**/resident/household associations"* |
| `PRP-03` Occupancy and relationship status | **Resident and Household** | *"**Owner**, resident, household member and authorized representative roles"* |

This is `ADR-006`'s failure — *the module that needed the datum first becomes its owner* — arriving **before** anybody has built it, which is the cheapest moment it will ever be caught. `D9` rules it.

**3. The word `role` is one decision away from carrying three meanings.**

`ADR-010` `D4` uses it for what a principal may **do**. `ADR-007` `D3` uses **tier** for what a surface may **show**, and `ADR-010` `D5` locks the two as orthogonal. `PRP-03` uses `role` for a third thing entirely. `D2` renames it.

---

## Decisions

### D1 — PEMO is the system of record for the relationship. It is never the system of record for the instrument.

**Product Owner, 2026-08-19.** PEMO holds who owns a unit, who rents it, who occupies it, from when, until when, and what it was before.

PEMO does **not** hold the title deed, the lease, the rent, the deposit, the break clause or the invoice. `§8` excludes *"Tenant and lease management"*, *"Rent, deposits or tenancy accounting"*, *"Management-fee calculation, invoicing or arrears accounting"* and *"Full property-management ERP replacement"* — **unqualified**, and `R8` does not touch them.

**The test, so it can be applied without re-deciding:** *if a fact would change when the money changes, it is not PEMO's. If it only says who stands in what relation to a unit, it is.*

This is the same boundary `ADR-003` drew for the car park (*"if it needs to know whether a car is parked, it is not PEMO's; if it only needs to know who holds the space, it is"*) and the same one `INT-04` draws for finance. **The project already knows how to hold this line; this decision does not invent a new kind of boundary, it applies an existing one to a new entity.**

**Two documents are now wrong and must be corrected in `PEMO_Function_Scope_v0.4`:**

- **`INT-03`'s first bullet inverts.** It reads *"**Receive** property, unit, owner, resident and occupancy master data."* Under `D1` PEMO **holds** that data and **may make it available** — **PEMO does not carry it there.** Its third bullet — *"External system owns tenancy, lease, rent, deposits and property administration"* — survives intact.

  **This wording was corrected on 2026-08-19 and the original was mine.** The draft said *"holds that data and **may publish it**"*, which `DOC-030-ST` caught while applying it: *may publish* implies PEMO carries the bytes, and sits three lines from *"PEMO builds no publisher, ever"* in *Open question 3*'s layer table. **The authority claim in `R8` `C1` is preserved exactly; only the implication of transport is removed.** An ADR that states a boundary in one section and contradicts it in another is the two-vocabularies failure arriving inside a single document.
- **`§7` loses two hedges.** *"Official owner/resident/occupancy record | External property/tenancy system **where present**"* and *"Property/unit master data | Property ERP **or PEMO, decided per deployment**"* both become **PEMO**. A hedge left standing after a decision reads as an open option to the next person. The *"Invoice, management fee and accounting entry"* row does **not** move.

**Inverting an integration's direction inside an ADR while the scope document still states the old direction is how two vocabularies start.** The `v0.4` edit is a required consequence, not a follow-up.

### D2 — The relationship is an `interest`. The word `role` is not extended to it.

An **interest** is a party's standing in respect of one unit. Two kinds: **ownership** and **tenancy**.

`role` stays with `ADR-010`: Estate staff, Approver, Integration support, Grant administrator. `tier` stays with `ADR-007` `D3`. **Three mechanisms, three words, none reading either of the others** — which extends `ADR-010` `D5`'s discipline rather than inventing one.

**This is not cosmetic.** `PRP-03` calls owner and tenant *roles*, and a schema that adopts that word puts `role` in two tables meaning two things. The first engineer to join `access.scope_grant.role` to `resident.interest.role` will be writing correct-looking SQL that answers no question.

**A household member holds no interest.** They are reached through the household, which is reached through the interest that gives the household its occupancy. This is `D7`.

### D3 — A party is one entity with two kinds. It is never an `ADR-002` Organization.

**Party:** `natural_person` or `legal_person`. Mr Chan and Novatek Ltd are two kinds of one thing, and every interest points at a party without caring which.

**`Organization` is not available for this and must not be reached for.** `ADR-002` makes Organization the **tenancy root** — the property-management company operating PEMO, and per `GEN-018-ST` the absolute security boundary: *"cross-organization isolation is absolute and is not a role."* A party is a **counterparty** living inside one Organization's world. It is never a root, never a boundary, and never a tenant of the platform.

**Stop condition, stated because the everyday word is the same in both senses:** any migration that gives a party an `organization_id` as its *identity* rather than as its *tenancy scope* is wrong and must stop. A party is scoped **by** an Organization; a party is not **an** Organization.

The Product Owner chose the term `Company` for the legal-person case on 2026-08-18 specifically to avoid this collision. `legal_person` is the schema term; `Company` is the label.

### D4 — An interest is held at a unit, and only at a unit.

**Product Owner, 2026-08-19.**

`ADR-003` `Q5` already gives the **floor**: *"The Unit level is terminal — occupancy, household membership, resident-to-unit authorization and safety audience resolution all resolve at the Unit and stop there."* No rooms, no bed spaces, no 劏房.

**`D4` gives the ceiling.** An interest points at exactly one unit. It cannot be held at a Floor, a Building, an Estate, a Phase, a Portfolio or an `ADR-003` Location.

**Unit is therefore both the floor and the ceiling of the interest model.** Two consequences, to be written into the schema comment rather than discovered:

- **A company owning five flats holds five interests. A company owning Block C entire holds 378.** This is correct — Hong Kong title is granted per unit even in single-ownership buildings — but it means **"who owns Block C" is an aggregate, not a lookup.** A reader who does not know this will report the model as broken.
- **Widening is additive; narrowing is not.** If a node-level interest is ever needed, it is two columns (`node_kind`, `node_id`) with a backfill of `'unit'`. `ADR-007` `A3` warns that scope shape is the hardest thing to widen; this shape is the exception, because the general case degenerates cleanly to the specific one and not the reverse.

**The rejected alternative, recorded so it is not rediscovered as an oversight:** an interest could have carried `(node_kind, node_id)` from the start, mirroring `access.scope_grant`. It was available, it was considered, and it was declined in favour of the narrower shape whose widening path is known.

### D5 — The interest carries no instrument, and the exclusion is enforced, not merely stated.

An interest carries: **party, unit, kind, effective range, source, audit properties.** Nothing else.

It does **not** carry — and a field named for any of these is a defect, not an enhancement: rent, deposit, premium, service charge, lease reference, break clause, renewal option, rent-review date, agent, commission, stamp duty, assignment, or any monetary amount whatsoever.

**`API-027-ST` established the mechanism for this and it should be reused rather than reinvented:** a `forbidden-terms` denylist scanned over the corpus, with allowed exceptions recorded and reasoned. The booking line's list was **derived by diffing** the two existing lists and every difference was recorded. The interest line's list should be derived the same way.

**A denylist that forbids the product gets bypassed** — `API-027-ST` inverted `{price, cost, tariff}` for booking because rate cards are resident-facing by design. The inversion here runs the other way: those terms are forbidden on an interest **because the money is exactly what PEMO does not hold**, and that is `D1` made mechanical.

### D6 — Every interest carries provenance and `ADR-010` `D1`'s four audit properties, from the first migration.

**Provenance:** how PEMO learned this fact — human entry, bulk import at estate onboarding, or reconciled from an external system with its reference. Never blank.

The original argument for this field was that both deployment configurations would exist. `R8` weakened that argument by making PEMO authoritative either way. **The field survives on a stronger one: a system of record that cannot say how it learned a fact cannot be audited**, and `ADR-010` `D1` already made audit the default for scope grants on reasoning that applies with more force here — an ownership interest is more consequential than a scope grant and outlives every principal who touches it.

**`R7` applies unchanged: an unmarked source is a claim, not an absence.** No schema `default:`, no fallback to `'pemo'`.

**And `D1`'s four properties are required in full** — written in the same transaction as the act, attributable to a principal rather than a session or a job, effective-dated, and not deletable or amendable by the actor. `ADR-010` states the reason: if an audit record substitutes for a gate, a weak record makes the default empty. `D10` closes the writes, so this requirement lands before the first write exists rather than after.

### D7 — Interest and occupancy are separate facts. Neither implies the other.

This is the decision the seeded world will make or break, and all four combinations are real:

| Case | Interest | Occupies |
|---|---|---|
| Owner-occupier | ownership | yes |
| Landlord (your 業主) | ownership | **no** |
| Individual tenant | tenancy | yes |
| **Corporate tenant** (Novatek: five flats for staff) | tenancy, **held by the company** | **no — five households of employees occupy, holding no interest** |
| **Hostel or dormitory operator** | tenancy, held by the operator | no — N household members occupy, holding no interest |

**The last two are why the separation is structural rather than a convenience.** A model in which occupancy implies interest cannot represent Novatek's employees; a model in which interest implies occupancy cannot represent a landlord. Both are ordinary in Hong Kong and both appear in the demonstration seed `D8` requires.

**A household belongs to a unit, not to an interest.** When a tenancy interest ends and another begins, the household is not transferred — it ends and another begins, on its own effective dates. Two effective-dated facts that usually move together are still two facts, and the day they diverge is the day the model is tested.

**The hostel case, ruled because it is the first real question anyone has asked about `ADR-003` `Q5`'s exclusion.** `§3.2` lists *"hostel or dormitory arrangements"* as out of scope and gives no positive guidance. The guidance is:

- The **arrangement** may be recorded as a unit-level remark that **names no person and no bed** — *"operated as a hostel, approx. 12 bed spaces, operator: XYZ Ltd"*.
- The **people** are household members, with effective dates, on machinery that already exists.
- The **bed space** is nowhere in PEMO.

**A free-text remark naming who sleeps in which bed is a sub-unit model with no constraints, no query and no audit.** Its specific failure is silent: a safety event resolves its audience at the unit and notifies all twelve — which is *correct* for a fire — while the remark makes everyone believe the system could have notified one. Fire evacuation is satisfied by the household-member route, and satisfied better.

**Rejected alternative, recorded:** a bed space could have been a Unit with `unit_class = 'bedspace'`, following the car-park precedent where a parking space *is* a Unit. The Product Owner declined it on 2026-08-19. It was considered, not missed.

### D8 — The owner's projection of a safety event.

`§7` leaves device events with `2IoThub` and the resident-readable presentation with Home Safety, so **PEMO decides this and nobody outside can.** The owner is a **fourth projection** of one event, alongside resident, estate staff and integration support — `ADR-007` `D3`'s existing machinery, extended by one audience rather than duplicated.

| Field | Owner | Basis |
|---|---|---|
| That an event occurred in a unit they hold | **yes** | asset information |
| Severity and type | **yes** | asset information |
| Unit identifier | **yes** | their unit |
| Occurrence **date** | **yes** | Product Owner, 2026-08-19 |
| Occurrence **time of day** | **no** | Product Owner, 2026-08-19 |
| Whether a resident responded | **no** | Product Owner, 2026-08-19 |
| Which resident responded | **no** | Product Owner, 2026-08-18 — *"not privacy related to the tenant's info"* |
| Resolution / all-clear and its date | **yes** | asset outcome |
| Whether the estate office attended | **yes** | service record |
| Free-text event notes | **no** | unbounded content |
| Count of events over a period | **yes** | Product Owner, 2026-08-19 — see below |

**Every row is a Product Owner decision or a direct application of one.** No row in this table was defaulted.

**The general rule this establishes, which is worth more than the table:**

> **A field the recipient can compute from data already granted is not a disclosure decision.**

The event count is permitted not because an owner ought to have it, but because an owner who sees each event individually can count them. Withholding it would be a control that controls nothing — the empty-oracle failure `UI-028-ST` named in a different place. **Applying this rule is what turned an open question into a derivation.**

**The responder flag is excluded for the same reason and it is worth stating, because the field is genuinely useful elsewhere.** Whether a resident responded is what estate staff use to decide whether to send someone up — a real operational field that must stay in the database and on the staff surface. On the owner's surface it says only *somebody was home* or *nobody was home*, and the owner already has what his asset interest requires from the resolution and attendance rows. **A field being valuable to one audience is not an argument for exposing it to another.**

**The time-of-day exclusion is the load-bearing one and it is not about privacy in the abstract.** `09:42` on a weekday is evidence that someone was home at 09:42. Accumulated over months it is an occupancy pattern — the *"in/out time"* the Product Owner excluded on 2026-08-18 — arrived at by derivation rather than by a field named for it. **Date-only is the narrowest projection that preserves the owner's asset interest.**

**Enforcement is `ADR-007` `D5`: filter in the query, never in the client.** The owner's response body does not contain a time-of-day key. A response that carries it for the client to hide has already disclosed it.

### D9 — The interest is `resident.*`. `PRP-02`'s phrase describes a projection, not a table.

Resolving finding 2.

**An interest is a fact about a party over time.** `PRP-03`'s effective dating, historical record and verification-status machinery are the machinery an interest needs, and they are already assigned to Resident and Household — which is where `GEN-006-ST` built occupancy, membership and the locked Person ≠ Principal separation. Putting the interest there costs no new module and no new mechanism.

**`PRP-02`'s *"Owner/resident/household associations"* is a Unit-profile screen requirement.** A unit profile renders who holds it; rendering is not owning. Property Core owns the unit; it does not own the party's standing in respect of it.

**The alternative was available and is recorded:** the interest could have lived in `property.*` on the reasoning that it is an attribute of a unit. It was declined because it makes Property Core hold facts about parties, which is the coupling `ADR-006` `D3` paid to remove when it kept device correspondence out of Home Safety.

**No cross-module foreign key**, per the standing rule and the `modules/access` precedent: `resident.interest` carries a `unit_id` into `property.*` as a stable identifier with no FK, and the `pg_constraint` cross-module sweep must still return **zero**, counted and reported.

### D10 — The model lands. The write surface stays closed.

`DOC-021-ST` states the standing position: *"a write needs **may this principal do this** and nobody has answered."* `API-017-ST` contracted eleven reads and zero writes for that reason; `GEN-018-ST` was buildable only because *"for reads, scope is the only gate."*

**A consumer of an external owner record needs no write. A system of record does** — and creating, ending or correcting an interest are the most consequential writes in the product. An interest written by the wrong hand mis-routes a management fee, mis-scopes `D8`'s projection, and grants a login to the wrong party.

**So:**

- The interest tables may be **created, migrated, seeded and read** with the role list open. Reads need scope only, exactly as `GEN-018-ST` proved.
- **No write operation on an interest may be contracted or built** until *Open question 1* is answered.
- The closure is written into the contract as a **deferred surface with its reason**, in `API-027-ST`'s `x-deferred` form — *present as a reason, not silently absent.*

This follows the project's own precedent rather than inventing a rule, and it means `R8` unblocks the model **without** unblocking the role list. The two stay independent, as `ADR-010` `D5` requires of role machinery generally.

---

## What this ADR deliberately does not model

**Listing these is part of the decision.** A reader who cannot see what was left out cannot tell whether the boundaries that exist were chosen or defaulted into.

- **The lease and everything in it** (`D5`). Term, rent, deposit, agent, commission, stamp duty, assignment, break, renewal.
- **The title instrument.** PEMO records that a party holds an ownership interest; the deed, the charge, the mortgagee and the land-registry memorial are outside.
- **Bed spaces, rooms and any sub-unit** (`D7`, `ADR-003` `Q5`).
- **Management-fee calculation, invoicing and arrears** (`§8`, `INT-04`). PEMO routes an externally-produced statement to the party holding the interest it is addressed to. That routing is the whole of PEMO's stake in billing, and it is why the interest exists on the billing side at all: **a charge attaches to an interest, not to a unit.**
- **Owners' corporation and DMC governance.** `CMT-02` already carries a binding constraint that a poll is never an owners' resolution; an ownership interest in PEMO is not a share in a 業主立案法團 and confers no vote.
- **Any write operation** (`D10`).

## Open questions

Each is named rather than absorbed.

### 1 — Which `ADR-010` role may write an interest, and does it require the Approver?

**Blocks:** the entire write surface, per `D10`. Nothing else.

Creating an ownership interest changes who receives a management-fee statement, who sees `D8`'s projection, and who may be issued a login. `ADR-010` `D2` created the **Approver** for *"approving what another composed"*, on evidence from notices, credential revocation and critical-event updates.

**Options.** (a) Estate staff, scope-only, under `ADR-010` `D1`'s audit default. (b) Estate staff to compose, **Approver** to confirm. (c) A capability of its own.

**[my view] (b), and `ADR-010` `D4` is why it is cheap.** Because one principal may hold two roles at one node, requiring an Approver costs nothing operationally where the estate is small — the same person can hold both — while preserving the ability to separate the duty where it matters. `ADR-010` `D1`'s default was accepted for **ordinary operations**, and rewriting who owns a flat is not one. The same argument the Master Brain made against folding all-clear into the default applies here with a stronger warrant, because the consequence is financial as well as operational.

### 2 — CLOSED 2026-08-19. A natural person is entitled to request; a legal person nominates a representative.

**Was blocking:** the owner-facing surface. Released.

**Decided:** a **natural person** holding an interest may **request** a login, verified by estate staff under `PRP-03`'s existing *"approval and verification status for self-registered users"* — option (a). A **legal person** cannot log in, so it **nominates an `authorized representative`** — option (c), `PRP-03`'s own fourth term.

**The consequence is deliberate and is not a side effect.** `authorized representative` has **no schema anywhere** — `DOC-030-ST` confirmed no occurrence of `representative` in `database/migrations/**` at `f89a36d7`, and it is the second half of the `PRP-03` gap finding 1 identified. **This decision makes building it required.** It is its own work, and it carries at least these questions, none of which this ADR answers:

- **Scope.** Does a representative act for **all** of the party's interests, or is the nomination per unit? Novatek holds five; one answer gives its representative all five, the other requires five nominations.
- **Cardinality.** May a legal person nominate more than one representative at a time?
- **Revocation and effective dating.** `RES-03` already carries *"time-limited or revocable authorizations"* for household permissions — **the same shape, and it should not be invented twice.**
- **Identity.** A representative is a **Person** linked to a **Party**, who may hold a **Principal**. `GEN-006-ST`'s Person ≠ Principal separation is locked and applies unchanged — **the representative is not a login, they are a person who may have one.**

**The original text of this question is retained below for the record.**

**Blocked:** the owner-facing surface. Not the model.

An owner who does not live in the estate still needs to see notices and `D8`'s projection. The Product Owner ruled on 2026-08-18 that a household head may create logins within their household. **An owner is not in a household**, so that route does not reach them.

**Options.** (a) An interest entitles its party to request a login, verified by estate staff as `PRP-03`'s *"approval and verification status for self-registered users"* already contemplates. (b) Estate staff issue it outright. (c) A corporate party nominates an **authorized representative** — `PRP-03`'s own fourth term, still unbuilt, which exists for exactly this.

**[my view] (a) for a natural person and (c) for a legal person**, because a company cannot log in and something has to name the human who does. But (c) requires building `authorized representative`, which is the other half of the `PRP-03` gap finding 1 identified, and that should be a decision rather than a side effect of this one.

### 3 — CLOSED 2026-08-19. The direction is recorded; the publisher is not PEMO core's to build.

**Was blocking:** `PEMO_Function_Scope_v0.4`'s wording. Released.

**Decided:** record that PEMO is authoritative and **do not build an outbound publisher**. When a deployment needs one, **an integration server exposes the API to third parties** — the outbound path is an integration concern, not a Property Core or Resident-and-Household concern.

**The Product Owner's reason is stronger than the one this ADR originally offered.** The draft argued *defer* on the grounds that building a publisher for a consumer nobody has named ages badly. That still holds, but it is the weaker half. **The real reason is a boundary: being the system of record is a statement about authority, and delivery is somebody else's layer.** Two things that were being treated as one.

**And the project drew that boundary on day one.** `PEMO_Function_Scope_v0.3` §1.3, unchanged since: the existing **`2IoThub` integration server** remains responsible for *"miniBMS, edge gateways, telemetry, alarm processing, OT/IT integration, **third-party CMMS/ERP connectivity** and edge store-and-forward."* **Third-party ERP connectivity is already assigned, and it is not assigned to PEMO.**

#### Pinned 2026-08-19: the server is `2IoThub`, and the two answers are both true of different layers

**Product Owner:** *"yes `2IoThub` is the integration server"* and *"any third parties integration is `2IoThub`'s scope"* — while also confirming that a PEMO-side integration concern belongs to **Integration Hub**, not Property Core.

**Those are not in tension once the layers are separated, and the project already separates them exactly this way.** `INT-01` is *"`2IoThub` integration"* with owning module **Integration Hub** — the existence of `2IoThub` does not make `INT-01` out of PEMO's scope; it makes the **device layer** out of scope while PEMO owns **its own side of the boundary**. `INT-03` takes the same shape:

| Layer | Owner | Status |
|---|---|---|
| The third-party-facing API and its transport | **`2IoThub`** | **Out of PEMO's scope**, per `§1.3` unchanged since `GEN-001-ST` |
| What PEMO makes available to `2IoThub`, and the field mapping | **Integration Hub** (`INT-01`–`INT-06`) | **Deferred, not excluded** — a future PID exists if a deployment names a consumer |
| Being authoritative for the fact itself | **`resident.*`** (`D9`) | **Built** |

**So PEMO never builds a publisher, and `INT-03` is not struck from the catalogue.** The line to write in `INT-03` is *PEMO holds this data and makes it available through `2IoThub`; PEMO builds no third-party-facing API* — **not** *deferred*, and **not** *out of scope*, because each of those is true of a different layer and neither is true of the feature as a whole.

**Recording the distinction is the point.** *Out of scope* and *deferred* produce different backlogs, and a feature that is one at the transport layer and the other at the contract layer will be read as whichever the reader needs it to be.

**Consequence for the Function Scope.** `v0.4` shipped `INT-03`'s publisher **explicitly left undecided**, on this ADR's own instruction. That line is now stale and is the exact failure this ADR complained about in `§7`: **a hedge left standing after a decision reads as an open option.** It is one line, and it should be corrected the next time the Function Scope is touched rather than left to be re-litigated.

**The original text of this question is retained below for the record.**

**Blocked:** nothing today. It blocked `PEMO_Function_Scope_v0.4`'s wording.

`D1` inverts `INT-03`. Whether PEMO **actually publishes** owner and occupancy master data to an external ERP in the first release, or merely stops receiving it, is a separate question from who is authoritative.

**[my view] record the inversion, defer the publisher.** Being the system of record is a statement about authority, not a commitment to an outbound feed. Building a publisher for a consumer nobody has named is the kind of integration that ages badly, and `INT-03`'s *"Send agreed case or communication events"* bullet already establishes that outbound is negotiated per deployment.

## Consequences

**Released.** The party/interest model becomes buildable and seedable. `PRP-03`'s owner and authorized-representative gap acquires a home. Management-fee routing acquires the fact it needs. The owner-facing surface acquires a defined projection. `INT-03` acquires a direction.

**Required.**

- **`PEMO_Function_Scope_v0.4`** — `INT-03`'s first bullet rewritten, `§7`'s two hedges removed, and a caveat on the traceability map's **OK** legend per finding 1. This is a `DOC` PID.
- **`D6`'s provenance and audit properties** in the first migration, not a later one.
- **`D5`'s denylist**, derived by diff and scanned over the corpus, before any interest reaches a contract.
- **The demonstration seed**, per the Product Owner's instruction of 2026-08-18: a **corporate tenant** (five units, one tenancy interest per unit held by one legal person, five households of occupants holding no interest), a **corporate owner**, and a **landlord who never occupies**. This belongs to the Backend seed PID under `GEN-018-ST`'s seed-basis discipline — declared basis, computed totals, and no figure colliding with an unrelated corpus figure. **It must not perturb the seeded magnitudes**: 812 residential + 236 parking + 41 storage units, 765 households, 47 vacant. Interests are additive rows against existing units.
- **The `pg_constraint` cross-module sweep** re-run and reported at zero after the migration.

**Still not buildable.** Every interest write, until *Open question 1*. The owner-facing surface, until *Open question 2*. `authorized representative`, which is out of scope here and named as its own decision.

**Not decided here.** The role list's three open questions. The severity policy table. Payments. Simplified Chinese. `GEN-005-SG`'s disposition.

## Decision record

```text
System of record:     PEMO for the relationship; never for the instrument  — decided 2026-08-19 (R8)
Vocabulary:           interest, not role — three mechanisms, three words   — decided 2026-08-19
Party:                natural_person | legal_person; never an Organization — decided 2026-08-19
Level:                one interest, one unit — unit is floor AND ceiling   — decided 2026-08-19
Content:              no instrument, enforced by a derived denylist        — decided 2026-08-19
Provenance:           source + four audit properties, first migration      — decided 2026-08-19
Separation:           interest and occupancy independent; household        — decided 2026-08-19
                      belongs to a unit, not to an interest
Hostel:               arrangement at unit level, people as household
                      members, bed space nowhere                           — decided 2026-08-19
Owner projection:     date not time; no responder; no notes; count OK
                      because derivable                                    — decided 2026-08-19
Module:               resident.* — PRP-02's phrase is a projection         — decided 2026-08-19
Writes:               closed until the role question is answered           — decided 2026-08-19
Interest write role:  open — scope-only vs Approver vs own capability
Owner login:          open — entitled-and-verified vs issued vs
                      authorized representative
INT-03 outbound:      open — publish in MVP vs record and defer
```
