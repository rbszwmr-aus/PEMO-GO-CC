# ADR-003 — Location and facility taxonomy

**Status:** `Accepted` — all five questions answered by the Product Owner on 2026-08-13.
**Date:** 2026-08-13
**Author:** PEMO Master Brain
**Follows:** `ADR-002`, which set the hierarchy above Estate. This ADR covers everything that is not a Unit.
**Gates:** `GEN-006-ST` Property Core migrations.
**Target location:** `docs/adr/ADR-003-location-and-facility-taxonomy.md`, committed by **`API-005-ST`**, which owns `docs/adr/**`. Corrected 2026-08-13; earlier revisions named `GEN-006-ST`, which the write-scope map forbids.
**Committing session:** `PEMO Contract` — carried into the repository by `API-005-ST`; this field backfilled by `API-016-ST`.

## Context

The Product Owner confirmed the hierarchy in `ADR-002` and added that the real property model also includes **common areas, public areas, public facilities such as car parks and gardens, and the clubhouse**.

The committed architecture already anticipated part of this. `GEN-001-ST` `MAJOR-003` required "Estate-wide, Phase-wide, Building/Block, Floor, Unit, common-area and facility-location types plus parent versus serving-scope rules", and handoff document `02` shows common areas hanging off Estate, Phase and Floor with a separate "Building Facility Location". So the *structure* exists in the baseline.

What did not exist is the **taxonomy** — the named classes of non-unit location and the rules distinguishing them. This ADR supplies it and must be checked against the committed twelve documents before it is accepted, since those documents are the higher authority.

## Attachment points confirmed by the Product Owner

The Product Owner supplied this reference sketch on 2026-08-13, explicitly as *"a reference to clarify what will be needed, not the final structure"*:

```text
Company
|
Estate
|
Phase
 ├── Building / Block
 │    ├── Floor
 │    │    ├── Unit / Flat / Room
 │    │    └── Common Area
 │    └── Building Facility Location
 └── Estate-wide Common Area
```

Read it as a statement of **coverage**, not as a schema. Three things it confirms, all of which this ADR must satisfy:

1. Non-unit locations attach at **more than one level** — Floor, Building, Phase and Estate all carry them. There is no single "facilities" table hanging off Estate.
2. A Floor holds both Units and Common Areas as siblings. Common area is not a property of a Unit.
3. A Building carries facility locations distinct from its Floors.

Two points where the sketch and this ADR deliberately differ, both noted rather than silently resolved:

- The sketch omits Portfolio and draws Phase inline. `ADR-002` keeps Portfolio, and both Portfolio and Phase remain **optional** per the locked decision. The Product Owner confirmed the sketch was simplified, not a correction.
- The sketch places "Estate-wide Common Area" under Phase. It should attach to **Estate**, otherwise an estate with no phases — a valid and already-locked case — has nowhere to put estate-wide areas. Handoff document `02` shows it correctly under Estate, with Phase-wide areas separately under Phase.

## The modelling problem worth getting right

**A location's physical position is not the same as the population it serves.** The architecture already states this principle; the clubhouse is the example that makes it concrete.

A clubhouse physically sits inside Phase 2, Block C. It serves the entire estate — including Phase 1 residents who never enter Block C. A car park may sit beneath Blocks A and B while serving every resident with an entitlement, across all phases. A refuse room on the 12th floor serves only the 12th floor.

Modelling these with a single parent pointer forces a wrong answer to one of two questions: either "where is it?" or "who does it belong to?" Both are needed, and they are needed by different consumers — maintenance context and wayfinding use the physical position; safety notification audience and booking eligibility use the serving scope.

## Decision

### One `Location` entity, two independent relationships

```text
Location
├── location_class      : the taxonomy below
├── physical_parent     : exactly one node — Estate | Phase | Building | Floor
└── serving_scope       : one or more nodes whose residents it serves
```

`physical_parent` answers *where is it*. `serving_scope` answers *whose is it*. Neither is derivable from the other.

For a floor corridor the two coincide, and that is fine — the general case simply degenerates. Do not optimise the common case by making `serving_scope` optional and defaulting it to the parent; an implicit default is exactly how a clubhouse ends up notifying only Block C.

### Location classes

| Class | Chinese | What it is | Typical physical parent | Typical serving scope |
|---|---|---|---|---|
| `common_area` | 公用地方 | Shared parts held in common by owners under the Deed of Mutual Covenant — lobbies, corridors, lifts, staircases, roofs, refuse rooms, plant rooms | Floor, Building, Phase or Estate | Usually the same node, sometimes wider |
| `public_area` | 公眾地方 | Areas over which the public has a right of access, typically dedicated under a government lease condition — a through-passage, public open space, or footbridge landing | Estate or Phase | Estate-wide, but access is not limited to residents |
| `public_facility` | 公共設施 | Shared amenities — car park, garden, playground, BBQ area, EV charging bay, bicycle store | Any level | Frequently wider than the physical parent |
| `clubhouse` | 會所 | A container facility with its own opening hours, membership rules and bookable sub-facilities | Building or Phase | Usually Estate-wide |
| `building_service` | 公用設施／樓宇服務 | Shared building services whose availability residents care about — lift, escalator, and by extension water supply, power and similar | Building, Phase or Estate | A specific set of floors or blocks, often partial |

### Lifts and escalators — the hardest case, and the best test of the boundary

A lift is simultaneously three things, and PEMO may own only the first two:

1. **A location.** People are inside it. A person trapped in a lift is a safety event with a location, and it must resolve to an audience.
2. **A service with resident-visible availability.** "Lift 2 out of service until Thursday" is a planned-interruption communication — `COM-01` and function scope §4.4, "planned/unplanned service interruption, affected area and current status". Residents care intensely about which lift serves their floor.
3. **A regulated asset.** In Hong Kong, lifts and escalators fall under the Lifts and Escalators Ordinance (Cap. 618): registration, periodic examination, examination certificates, and a Registered Lift Contractor or Registered Escalator Contractor. **None of this is PEMO's.**

The third point deserves the same treatment PEMO already gives statutory fire alarms. PEMO does not claim to be the fire alarm system; it does not become the lift compliance register either. Examination dates, certificates, contractor records, maintenance schedules, breakdown history and parts belong to FM, CMMS and the statutory regime — every one of them already on PEMO's explicit out-of-scope list.

This is why `building_service` is the class most at risk. A lift is the most asset-like object in a residential building, so the pull to add "last inspection date" will be strongest here. It must be refused here most firmly.

**Serving scope for a lift is a set of floors, not a building.** A lift bank may serve floors 1–20 while a shuttle lift serves G/F plus 21–40. An escalator serves two levels of a podium. The `serving_scope` model already supports this — it is a set of nodes, not a single pointer — but lifts are the case that makes it non-optional. "Lift 3 is out of service" must reach exactly the residents whose floors that lift serves, and nobody else. Notifying a whole block about a lift they never use is how residents learn to ignore PEMO notifications, which then degrades the safety channel that shares the same inbox.

**Availability state is a PEMO projection, not a device state.** The resident-facing status of a lift may be sourced from `2IoThub` where the lift is monitored, or entered manually by management where it is not. Both paths produce the same PEMO-side projection, following the pattern already fixed for Home Safety. PEMO does not own lift telemetry, controller state or fault codes, and must never display them to residents.

### Clubhouse is a container, not a leaf

The clubhouse holds bookable sub-facilities — pool, gym, function room, games room — each with its own capacity, opening hours and eligibility rules. Model it as a `clubhouse` Location whose children are `public_facility` Locations. Booking attaches to the child, not the parent: a resident books the function room, not "the clubhouse".

Getting this wrong is a one-way door. A flat clubhouse entity forces every sub-facility to become a booking-module concept with no location identity, and they then cannot carry a safety event, a maintenance reference or an access rule.

## Boundaries this ADR must not cross

A "facility" table is one of the strongest scope-creep attractors in this product. Three specific boundaries:

**Car park — PEMO holds the location, not the operation.** Function scope §4.2 makes car-park management an existing company solution integrated through `2IoThub`, and `PRP-01` says PEMO holds a "car-park and storage-space reference where integrated". So PEMO models the car park as a Location with an external reference. PEMO does **not** own parking spaces, allocations, entitlements, tariffs, gates, licence-plate recognition or transactions. This boundary is at high risk precisely because "car park" reads like an obvious PEMO facility.

The same applies to EV charging, which the module catalogue already places under Resident Services as Native, Integrated or Linked.

**Clubhouse booking belongs to Amenities and Booking, not Property Core.** Property Core owns the location's identity, position and serving scope. `BKG-01` to `BKG-03` own the catalogue entry, availability, eligibility rules, quotas, reservations and cancellations. One datum, one owner — a Location must not grow booking fields.

**No asset or maintenance attributes. None.** The moment a facility entity exists, there is pressure to add condition, inspection date, warranty, asset tag, service history and replacement cost. Every one of those is FM, CMMS, EAM or asset-management data that PEMO's founding doctrine explicitly excludes. A Location carries identity, class, position, serving scope, an optional external reference, a resident-facing availability state where relevant, and descriptive information — nothing else.

For lifts and escalators this rule is strictest, because they carry a statutory compliance regime of their own (Cap. 618) that PEMO must stay out of, exactly as it stays out of statutory fire alarms.

## Consequence that reaches beyond Property Core

**Safety audience resolution now depends on serving scope, and this affects work already specified.**

`FEAT-001 v3` §3.7 distinguishes building events — BMS, fire panel, common-area alarms — from in-unit events. A common-area event must resolve to an audience, and the only correct source for that audience is the location's `serving_scope`. A fire-panel alarm in a Phase 1 lobby notifies Phase 1 residents; the same alarm in the clubhouse notifies the whole estate.

The five screens currently in scope for `UI-007-ST` cover in-unit events only. `MOB-09` in the design export is explicitly "critical, **in-unit**". So the contract in `API-005-ST` has no common-area-sourced event in its fixture corpus.

Recommended, and cheap: add **one** common-area-sourced safety event fixture to `API-005-ST`, so the serving-scope path is exercised by the contract from the start rather than discovered later. If that is declined, record explicitly in `API-005-ST` that common-area safety events are out of scope for contract v0.1 — so the gap is a decision rather than an oversight.

## Questions for the Product Owner

**Q1 — Does `public_area` need to be a distinct class, or an attribute of `common_area`?**

**ANSWERED 2026-08-13 — keep them distinct.** Two classes.

The reason that carries the most weight operationally is safety notification: **PEMO cannot notify the public.** A safety event in a common area resolves to an identifiable resident audience through serving scope. A safety event in a public area affects people PEMO has no channel to and no relationship with. Collapsing the two invites a future change that quietly treats a public passage as if it had a resident audience, and the failure is silent — nobody is notified and nothing errors.

The legal difference is also real: common areas are held by owners under the Deed of Mutual Covenant, while public areas carry a public right of access, usually under a government lease condition, with different responsibility and liability.

**Q2 — Should storage spaces and car-park spaces be Locations, or Unit-like entities?**

**ANSWERED 2026-08-13 — both.** The container is a Location; the individual space is a Unit-like assignable property object. This applies to car parks and storage equally.

This is the right answer for Hong Kong, where a parking space commonly carries its own title, is bought and sold separately from the flat, and is legally an undivided share in the same way a flat is. Modelling it only as part of a facility would lose a real property relationship.

It is also **the single most dangerous answer in this ADR**, because it is one short step from PEMO becoming a car-park management system — which the founding doctrine excludes. The boundary is drawn explicitly below.

### Parking and storage — the model

Add a `unit_class` to the Unit entity: `residential`, `parking`, `storage`. All three sit at the same level and reuse the same assignment machinery, so occupancy, effective dates, household membership and resident-to-unit authorization all work unchanged. The car park or store as a whole remains a `public_facility` Location with an external reference.

Rules that keep the two apart:

- Only `residential` units constitute a resident's home. `MOB-02` unit context, the unit switcher and safety audience resolution consider `residential` units only. A resident with a parking space must never see it presented as a second home.
- A safety event in a car park attaches to the **car-park Location** and resolves its audience through that location's serving scope — not through the set of individuals holding spaces. A fire in the car park concerns everyone there, not only space-holders.
- Assignment of a `parking` or `storage` unit exists to support `PRP-02` unit profile and the "resident vehicle and entitlement view" in function scope §4.2. It is a property record, nothing more.

### The line PEMO must not cross

PEMO owns the space as a property object and its assignment to a household with effective dates.

PEMO does **not** own: access control or gate operation, licence-plate recognition, tariffs or pricing, payment and transactions, real-time occupancy or availability, visitor parking allocation, or enforcement. Every one of those belongs to the existing car-park system reached through `2IoThub`, which function scope §4.2 already names as authoritative for "gates, recognition, tariffs and parking transactions".

**A usable test for any proposed feature:** if it needs to know whether a car is currently parked, or whether a barrier should lift, it is not PEMO's. If it only needs to know who holds the space, it is.

**Q3 — Does the clubhouse need membership as a concept in the first build?**

**ANSWERED 2026-08-13 — not in the first build.** Clubhouse eligibility derives from residency only. Membership is deferred to Amenities and Booking when that module is properly specified.

Build eligibility as a resolved decision rather than a hardcoded "is a resident" check, so membership can later become an additional input without rewriting the caller.

**Q4 — Does a resident-facing availability state belong in the first build?**
Lift and escalator out-of-service status is one of the highest-frequency, highest-value resident communications in a residential estate, and it needs a home. It could be an attribute on `building_service` Locations, or it could be handled purely as a Notice with an affected-area reference and no structured state.

The difference is real: a structured availability state can drive `MOB-02` Home ("Lift 2 out of service") and be queried; a Notice cannot. But a structured state also needs a lifecycle, a source of truth, and rules about staleness — the same discipline Home Safety needs, and the same failure mode if it goes stale and shows "in service" for a lift that is not.

**ANSWERED 2026-08-13 — model the structured state, with the staleness rule enforced from day one.**

The rule is not optional and is not a nicety: an availability state with no recent update renders as **unknown**, never as in-service. This is the same rule already fixed for Home Safety, and it exists because a lift shown as working when it is not is the same class of failure as a green "all safe" over stale sensor data — the interface asserts something it does not know.

Concretely, this means every `building_service` availability record carries the time of its last update and the identity of its source, whether that is `2IoThub` or a manual management entry. Rendering logic reads the age, not just the value. A state with no freshness data is unknown by definition, not in-service by default.

**Q5 — What is "Room" in `Unit / Flat / Room`?**
Three readings, with materially different consequences:

- **Naming variants of one level.** Different estates call the same thing a unit, a flat or a room. This is `PLT-01`'s "configurable terminology by customer" and needs no structural change — just a per-organization label.
- **A level below Unit.** A flat containing separately occupied rooms — subdivided units, co-living, staff quarters or a hostel. This is structural: occupancy, household membership and safety audience all resolve to the room rather than the flat, and every resident-to-unit authorization rule gains a level.
- **A non-residential space type** — a function room, meeting room or store room. That is a facility Location, not a Unit, and is already covered by this ADR.

**ANSWERED 2026-08-13 — naming variants.** Unit, Flat and Room are alternative labels for the same level. The label is configurable per customer, which is `PLT-01`'s "configurable terminology by customer", so it belongs to the Organization tier from `ADR-002` and not to Property Core's structure.

**Subdivided units (劏房), co-living and hostel or dormitory arrangements are explicitly out of scope.** Recorded as a scope fence, not an omission.

Two consequences worth stating plainly, because they simplify work downstream:

- **The unit level is terminal.** Occupancy, household membership, resident-to-unit authorization and safety audience resolution all resolve at the Unit and stop there. No sub-unit level exists, so no authorization rule needs an extra hop.
- **Reversing this later is structural, not configuration.** If subdivided occupancy is ever added, it changes who receives a safety alert — a lower-level occupant is not necessarily reachable through the flat's household. That makes it a safety-relevant change requiring a new ADR, not a settings toggle. Do not build "flexible" sub-unit scaffolding in anticipation; build the terminal model and change it deliberately if the product ever moves.

## Decision

All five answered by the Product Owner on **2026-08-13**. This ADR is `Accepted`.

| | Question | Decision |
|---|---|---|
| Q1 | `public_area` distinct from `common_area`? | **Two distinct classes.** PEMO cannot notify the public; collapsing them would fail silently. |
| Q2 | Car-park and storage spaces | **Both.** Container is a Location; individual space is a Unit with `unit_class` of `parking` or `storage`. Hard boundary against car-park operations. |
| Q3 | Clubhouse membership in the first build | **No.** Eligibility from residency only; membership deferred. |
| Q4 | Lift and escalator availability | **Structured state, with the staleness rule enforced from day one.** No freshness data means unknown, never in-service. |
| Q5 | `Room` | **Naming variant**, configurable per customer. Subdivided units, co-living and hostels out of scope. Unit is terminal. |

### One consequential change made under this ADR

`API-005-ST` gains **one common-area-sourced safety event fixture**. Every screen currently in scope carries in-unit events only, so the serving-scope path — now the mechanism resolving audience for common areas, public facilities, the clubhouse and every lift — would never be exercised by the contract.

This is a fixture addition, not a product decision, and it is reversible. It is called out here rather than made quietly because it changes the scope of an already-issued PID. If it is unwanted, remove the fixture and record in `API-005-ST` that common-area safety events are explicitly out of scope for contract v0.1 — so the gap remains a decision rather than an oversight.

### Still open, deliberately

- Whether public areas ever generate resident-facing safety communication at all, given PEMO has no channel to the public. Likely a management-facing concern only. Revisit when Home Safety is specified properly.
- Whether `building_service` should extend beyond lifts and escalators to water supply and power. The class is designed to accommodate them; nothing in scope requires them yet.

---

# Amendments — `public_facility` nesting, the podium node, and Location-identity permanence

**Folded in by `GEN-019` from `ADR-003-AMENDMENT-public-facility-nesting-and-location-identity.md`, verbatim.** The source carried its own carry-in instruction — *append to the repository copy as its next amendment letter; verify the letter in the repo copy, do not assert it here* — and the letter verifies clean: this ADR carried no amendment section and no `AM` letters, so the source's own `AM1`–`AM5` are genuinely next and are preserved unchanged.

**Status and provisionality are carried as authored, NOT reconciled.** There is no acceptance record for this amendment, so nothing here may promote it: `GEN-017` reconciled statuses only where an acceptance record existed to reconcile against. `AM3` remains explicitly provisional.

**Status:** Proposed by PEMO Master Brain. Decision owner: Product Owner. `AM1`, `AM2`, `AM4` are architecture clarifications; `AM3` (the podium instance) is provisional and gives the booking track a stable parent id to verify against now, pending PO confirmation.
**Date:** 2026-08-18
**Amends:** `ADR-003` — the "Clubhouse is a container, not a leaf" section, and the boundaries section. The two-relationship model (`location_class`, `physical_parent`, `serving_scope`) is unchanged. No schema change: `parent_location_id` already exists (it is how `loc_wfg_function_room` sits under `loc_wfg_clubhouse`).
**Raised by:** the booking track's response to `Integration_Risk_Register` §7 (`PEMO_Booking_PropertyCore_Interface_Rulings_v1.1.md`), which correctly escalated the podium from a seed row to an `ADR-003` decision — an area `ADR-003` itself calls a one-way door.

## Amendment decisions

**AM1 — Container nesting is available to `public_facility`, not only to `clubhouse`.** A `public_facility` Location may be the `parent_location_id` target of other `public_facility` Locations. The mechanism is the one already in the model and already exercised by the clubhouse; this decision removes the *implicit* reading that only a `clubhouse` may nest. Nesting remains **`parent_location_id`** (Location→Location); it does not touch `physical_parent` (Location→hierarchy node) or `serving_scope`.

**AM2 — `clubhouse` stays a named special case; `public_facility` nesting is permitted-when-justified, not definitional.** A `clubhouse` is a container *by definition* — it has opening hours, membership rules and bookable sub-facilities, and that is what the class *means*. A `public_facility` is a leaf by default and becomes a container only when a justification holds. The justification test is `ADR-003`'s own clubhouse reasoning, reused:

- **(a) the container itself can carry a location-bound fact** — a safety event, a maintenance reference, an access rule — and therefore needs its own Location identity, not just a string; and
- **(b) a grouping over its children should derive from the hierarchy, not from a display string.** A UI that groups facilities under "Podium" must read the parent Location, or the grouping is a string that drifts from the model — the defect the whole `serving_scope` design exists to prevent.

Absent both, a would-be container is just a set of siblings sharing a `physical_parent`, and no container node is created. This keeps AM1 from becoming a licence to nest everything.

**AM3 — The podium instance (provisional, pending PO confirmation).** A single Location:

- id `loc_wfg_podium` (name to confirm), `location_class = public_facility`;
- **`physical_parent = Estate`**, *not* a block. A podium that spans and serves the whole estate must not take an arbitrary block as its physical parent — that re-creates the physical-parent-vs-serving-scope conflation `ADR-003` exists to prevent, and the block-G/F option is rejected for exactly this reason;
- `serving_scope = Estate`;
- children via `parent_location_id = loc_wfg_podium`: the BBQ pits, basketball court, garden/lawn (each `public_facility`).

It passes AM2's test on both limbs: a podium can carry a safety event (limb a), and Explore's `Clubhouse / Podium / Car park` grouping should derive from the hierarchy rather than a string (limb b). **The booking track needs only this stable parent id to verify against; the id can stand provisionally while the PO confirms the amendment.**

**AM4 — A Location's identity is permanent. A product ambiguity resolves by a new id, never by mutating or splitting an existing Location.** `loc_wfg_function_room` keeps its identity permanently: it is never split, never renamed to "Function Room 1", never repurposed as half of a pair. If the estate turns out to have a second function room, that is a **new** `public_facility` Location with a **new** id. This holds whichever way the PO answers "one function room or two", so no existing fixture that cites `loc_wfg_function_room` can break, and the Backend seed PID is **not** blocked on that product question. (This is the booking track's ruling, adopted verbatim into `ADR-003` because it is a statement about Location identity, not about booking. It is the frozen-identity discipline the project already applies to unit identifiers.)

**AM5 — Guards, unchanged and reaffirmed.** Being a container adds **no** fields: a container `public_facility` is still just a Location carrying identity, class, `physical_parent`, `serving_scope`, an optional external reference, a resident-facing availability state where relevant, and description — nothing else. In particular, no booking fields (those are the booking module's, per the original boundary) and no asset/maintenance fields. Nesting does **not** create a second tree: the facility catalogue remains **booking-module data keyed by Location id**, and `getPropertyTree` is unchanged — a nested `public_facility` is a Location relationship, not a new hierarchy.

---

## Interaction with the open `getScope` location rule — noted, not decided here

A podium container is, by construction, a **container Location**. So under the *container-locations* candidate for the still-open `getScope` location rule, the podium (and the clubhouse) would appear in the scope navigator; under *clubhouse-class only* it would not; under *estate-serving facilities* it would, along with ~13 other facilities and the car park. This amendment does **not** decide that rule — it lives in the bundled contract PID — but it records that the podium's container status is one of the inputs the rule now has to be correct against. The booking track's observation stands: the overlay is the case that finally separates the three candidates, where the single seeded positive example could not.

---

## Decision record (append to `ADR-003`'s)

```text
public_facility may nest:   yes — parent_location_id, not clubhouse-only (AM1)   — proposed 2026-08-16
clubhouse container:        by definition; public_facility nesting is
                            permitted-when-justified (safety-identity +
                            hierarchy-grouping test) (AM2)                        — proposed 2026-08-16
podium instance:            loc_wfg_podium, public_facility, physical_parent
                            Estate, serving_scope Estate, children the pits/
                            court/garden — PROVISIONAL, PO to confirm (AM3)       — proposed 2026-08-16
Location identity:          permanent; ambiguity resolves by a new id, never
                            by split/rename/repurpose (AM4)                       — proposed 2026-08-16
Guards:                     container adds no fields; no second tree;
                            getPropertyTree unchanged (AM5)                       — reaffirmed 2026-08-16
```
