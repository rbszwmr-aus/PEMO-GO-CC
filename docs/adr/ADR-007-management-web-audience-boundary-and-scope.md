# ADR-007 — Management web: audience, data boundary and authorization scope

**Status:** `Proposed` — `v1.1`. Decisions `D1`–`D9` taken 2026-08-13 on Product Owner rulings and `DOC-014-ST`'s evidence. `v1.0` was written from that PID's summary; `v1.1` follows a full reading of the 631-line analysis and corrects two decisions, adds one, and opens two questions — see **Amendments (v1.1)** at the end. The role list, Intercom, CMMS and Simplified Chinese remain open by design.
**Date:** 2026-08-13
**Author:** PEMO Master Brain
**Decision owner:** Product Owner
**Target location:** `docs/adr/ADR-007-management-web-audience-boundary-and-scope.md`
**Committing session:** `PEMO Contract` — this ADR has no other authorised route into the repository.
**Gates:** the management web contract, and any PID adding a non-resident surface.
**Evidence:** `DOC-014-ST` — `PEMO_Management_Web_Scope_Analysis_v0.1.md`, 631 lines, 20 identifier classes quoted with screen and field.
**Related:** `ADR-002` (hierarchy), `ADR-003` (location taxonomy), `ADR-006` (classification and mapping), `ADR-009` (`Problem.type` registry).

## Why this is needed before a contract, not after

Management web is **the first PEMO surface that is not resident-facing**, and every data-boundary mechanism in this project assumes a single audience.

`forbidden-terms.json` exists to keep device and internal identifiers out of responses. `ADR-006` states PEMO may hold a device reference internally and must never render one. Both are written as though "render" means "render to a resident", because until now it did.

Management staff **must** see device references — dispatching somebody to a fault requires naming the faulty thing. So the boundary does not relax on this surface. **It inverts.** Deciding that accidentally, by whoever writes the first endpoint, is the failure `ADR-006` was written to prevent, at a larger scale.

`DOC-014-ST` supplies what makes this decidable against evidence: the export **states its own restriction** — *"raw payload and correlation trace are integration-support only"* — and **that restriction does not cover six of the identifier classes it renders to the estate manager on the same tab**. A device reference (`node C-903`) also reaches the Overview dashboard, three screens from the source tab where the rest are confined.

A design that states a boundary and then crosses it is more useful than one that states nothing. The gap between the claim and the screens is this ADR's subject.

## Decisions

### D1 — Audience

**Management web serves estate staff. It is not a resident surface and never renders to a resident.**

Anything reachable by a resident is a resident surface regardless of which application serves it. This matters because the temptation later will be to reuse a management endpoint "just for this one screen".

### D2 — Separate contract packages, shared vocabulary

**The management web gets its own contract package, sibling to `resident-mobile`, not a role-scoped variant of it.**

The decisive argument is not duplication cost, it is what happens to the strongest guarantee in the project.

The resident boundary's value is that it is **unconditional**: no resident-facing response may contain a device identifier, and a scan proves it over the whole corpus without evaluating anything. Serve both audiences from one contract and that scan becomes **role-conditional** — it must decide, per response and per field, which rule applies. A structural guarantee would be replaced by a policy that has to be evaluated correctly every time, and the four unscoped surfaces already recorded in `PID-INDEX` are the record of how reliably that goes.

**Shared vocabulary, separate responses.** Domain types — Estate, Building, Unit, Location, Severity, the seven levels — are defined once and referenced by both. Response schemas are per-surface. One definition of what a Unit is; two independent, independently-provable boundaries.

`ADR-009`'s `Problem.type` registry already anticipated this with per-entry `surfaces`. **Confirmed: one registry, per-surface applicability.**

### D3 — Three tiers, not two. Management has a boundary of its own.

The export's own claim is right and is adopted:

| Tier | May see | Must never see |
|---|---|---|
| **Resident** | resident-readable projections only | any device, zone, panel or internal identifier; any raw reading |
| **Estate staff** | device and location references, source classification, provenance | raw payloads, correlation traces, any other organization's data |
| **Integration support** | raw payloads and correlation traces | another organization's data |

**"Management sees everything" is not the decision.** Raw payloads and correlation traces are integration-support material, and the six identifier classes `DOC-014-ST` found crossing that line in the export are a design defect to correct, not a precedent to encode.

Each tier gets its own scan with its own term list, and each is unconditional within its surface.

### D4 — Authorization is a matrix, and its shape is decided here

Resident authorization is a list: which units do you hold. **Staff authorization is an assignment of `(principal, role, scope node)` against `ADR-002`'s hierarchy**, with permission derived from the role and from whether the target lies within the scope node's subtree.

- **Scope is a node, and it inherits downward.** A principal assigned at Portfolio covers its Estates; assigned at Estate, that Estate. This is why `ADR-002`'s optional tiers had to be settled first.
- **Assignments are effective-dated**, like `ADR-006`'s mapping tables and for the same reason. **Two different questions, two different answers:** what may this person see *now* uses the current assignment; what was this person permitted to see *then* — the question asked after an incident — uses the assignment in force at that time. A system that can only answer the first cannot be audited.
- **Cross-organization isolation is absolute and is not a role.** No role at any level reaches another Organization's data. `GEN-006-ST` already tests this for residents; the same test extends here.

**The role list itself is not decided here.** It is a product and estate-management decision, exactly as `ADR-006` left the policy table's contents open. The *shape* is settled so the contract can be written; the *contents* are named as open below.

### D5 — A screen that spans levels filters, it does not refuse

`DOC-014-ST` flagged screens operating across hierarchy levels as the hardest to authorize. **A screen declares the highest level it requires; the response is filtered to the caller's scope rather than refused.** A portfolio dashboard shown to an estate-level manager shows that manager's estate, not an error.

**Filtering happens in the query, never in the client.** A response that carries out-of-scope rows and hides them has already leaked them.

### D6 — Cameras and video, per the Product Owner rulings of 2026-08-13

- Cameras cover **public areas only**.
- **PEMO stores no footage.** All archive stays on the video server; PEMO does live streaming only, streamed from that server rather than held locally.
- **PEMO decides no camera access.** It passes the user's identity to the video server and renders what that system returns. Retention, subject access and lawful basis attach to whoever holds the footage, which PEMO does not — and PEMO cannot expose something the estate's own policy restricts, because it is not the system making the decision.
- **Video analytics is a source, not a special case.** PEMO references the source — what and when, in text. Never the source video. A video analytics engine that classifies is a source that classifies, and it travels the path `ADR-006` already defines: in through `2IoThub`, mapped to severity by approved policy, provenance recorded per `C5`, unrecognised types quarantined.

**CCTV therefore needs no camera-specific machinery in the contract. It needs a source.**

One consequence to implement: **a stored reference outlives the footage it cites.** Video retention is 30, 60 or 90 days; a PEMO event is permanent. **A reference that no longer resolves is a normal state, not an error state**, and the interface must not present a dead reference as a live link.

### D7 — Visual authority from the export, structural authority from the ADRs

The Product Owner's ruling that the export is the design authority covered **palette, typography and visual idiom**, and it stands for those.

It was never a ruling that the export's information architecture is current, and it could not be: `DOC-014-ST` established that the export **predates the Community module, the `2IoThub` naming, and `ADR-002`'s Organization tier**, none of which appear in it.

**Where the export and the ADRs disagree on structure, the ADRs are newer and win.** Where they disagree on appearance, the export wins. This is the same visual-versus-structural distinction `UI-010-ST` had to hold, arriving from the other direction.

### D8 — Scope of the first management web contract

**Out**, per the Product Owner ruling of 2026-08-13: `Mailbox`, `IEQ`, `CCTV`, `Intercom`, `Lift`. Architectural room is reserved; each integrates later through a REST interface with `2IoThub` adapting the input to what PEMO's contract requires.

`Lift` carries Lifts and Escalators Ordinance (Cap. 618) obligations that are policy rather than transport, and will need the same treatment `ADR-006` gave fire signals.

**`Intercom` is not in the same class as the others.** It is a **two-way channel** — somebody acts through PEMO rather than reading from it — and every PEMO surface built so far is read-only apart from a single idempotent acknowledgement. That is a capability change, not an integration, and it needs its own ADR before any contract admits it.

## Consequences

- A second contract package, a second fixture corpus, a second boundary scan. The cost is real and is accepted because it buys two unconditional guarantees instead of one conditional one.
- The staff authorization model is new work with no resident-side analogue. It is the largest engineering item this ADR creates.
- `GEN-006-ST`'s cross-organization isolation test extends to the new surface unchanged, which is evidence the module boundary was drawn in the right place.
- The export's six over-rendered identifier classes are a design correction, tracked against the management web design work rather than the contract.

## Open, deliberately

- **The role list**, and which permissions attach to each. Product and estate management, not engineering — the same reservation `ADR-006` made for the policy table.
- **Intercom's two-way capability.** Its own ADR, before any contract admits it.
- **Whether residents may view any camera.** A resident watching a lobby is watching other residents, which inverts the resident boundary a third way. Not needed for the first management web contract, and it must not be settled by whoever builds a resident camera screen first.
- **The `7.4` wording.** Every event reads *"classified by IoT2Hub"* while `ADR-006` `D1` says PEMO classifies. `DOC-014-ST` was right that the **structure is compatible** — source classification sits in its own row beside a separate PEMO severity chip, which is what `C2` and `C5` require. Only the wording assigns the decision to the source. The fix is to make both attributions explicit — what the source said, and what PEMO shows under which policy version. That is `C5` rendered, not `D1` contradicted.

## Decision record

```text
Audience:                estate staff, never resident            — decided 2026-08-13
Contract shape:          separate package, shared vocabulary     — decided 2026-08-13
Boundary tiers:          three, each unconditional in its surface — decided 2026-08-13
Authorization shape:     (principal, role, scope node), effective-dated — decided 2026-08-13
Level-spanning screens:  filter in the query, never refuse       — decided 2026-08-13
Cameras:                 no storage, no access decision, events not frames — Product Owner, 2026-08-13
Third-party integration: REST in, 2IoThub adapts                 — Product Owner, 2026-08-13
First contract scope:    five areas out, Intercom needs its own ADR — decided 2026-08-13
Role list:               open — product and estate management
Intercom:                open — capability change, own ADR
Resident camera access:  open — inverts the boundary a third way
```

---

# Amendments (v1.1) — 2026-08-13

`v1.0` was written from `DOC-014-ST`'s summary. `v1.1` follows a full reading of `PEMO_Management_Web_Scope_Analysis_v0.1.md` itself. **Five things changed, and one of them is a decision `v1.0` did not know it needed to take.**

That `v1.0` was written from a summary rather than the artifact is the same error this project has corrected three times — recorded here rather than quietly fixed.

## A1 — `D5` is the norm, not the exception, and it is now load-bearing

`v1.0` treated level-spanning screens as a hard case needing a rule. The measurement: **nine of eleven surfaces span hierarchy levels.**

`S1` alone mixes in-unit events (`Blk B · 18/F · B4`), building events (`Blk C · plant room`), an estate-wide advisory targeting `Block A, all floors — 268 households`, and a quarantined event belonging to **no level at all**.

So `D5` is not an edge-case rule. **It is the default request shape**, and the contract must be designed around it rather than accommodating it. Every list endpoint returns rows at mixed levels, scope-filtered in the query.

The quarantined event is worth naming: the export states *"Not assigned to any household."* That is `ADR-006` `C4` rendered — visible, unassigned, never defaulted, never dropped — **arriving independently in a design made before that ADR existed.** A constraint reached twice from different directions is one worth keeping.

## A2 — Scope is over `ADR-002` **and** `ADR-003`, not the hierarchy alone

`v1.0` defined a scope node against `ADR-002`'s hierarchy. The analysis found two addressable things that are **not hierarchy nodes**: `Counter` on `S6`, and clubhouse facility locations (`Clubhouse 2/F`, `Podium`) on `S10`.

These are `ADR-003` Locations. **A scope model over the hierarchy alone cannot express them**, and a staff member who works the counter is scoped to a place that has no floor and no unit.

**Corrected:** a scope node is a node in the `ADR-002` hierarchy **or** an `ADR-003` Location, and permission is derived from whether the target lies within that node's subtree or that Location. `ADR-003` already separated `physical_parent` from `serving_scope` for exactly this reason, so the machinery exists.

## A3 — New decision `D9`: the design is Estate-only, and the contract must not be

**A search of the export's data model returns zero occurrences of `organization`, `organisation` or `portfolio`. The topmost concept in the export is the Estate**, and the scope selector shows one — `Wing Fu Garden 榮富花園 · 3 blocks · 812 units ▾`, with the switcher's open state never designed.

`ADR-002` makes Organization **required**. So the management web must carry a concept its own design never shows, and a staff member covering several estates has no designed way to move between them.

**Decision: the contract supports Organization and Portfolio scope from the first version. The design gap is recorded against the management web design work, not worked around in the contract.**

The reasoning is `D7` applied concretely: the export predates `ADR-002`'s Organization tier, so on structure the ADR is newer and wins. Shipping a contract shaped to a design that predates the hierarchy would encode the omission permanently — and a scope model is the single hardest thing to widen later, because every endpoint and every stored assignment assumes it.

## A4 — Role differentiation is entirely undesigned, and that is a constraint on the contract

The export shows **one role**: `Chan Mei-ling · Estate manager`. **No screen renders differently for a different role.** `S1`'s role-gated panel shows only the **denied** view; the granted view does not exist.

This is consistent with `v1.0` leaving the role list open, but it adds a constraint that `v1.0` did not state: **there is no design evidence for what any role may do.** The contract must therefore express authorization **structurally** — scope filtering and a permission check per operation — without hard-coding a role vocabulary that only one observed role could justify.

**A single designed role is not evidence that one role is enough. It is the absence of evidence either way**, and a contract that assumes one role is a contract that has decided the question by omission.

## A5 — `CMMS` is a second external system, and it is not the `2IoThub` pattern

Two integration health chips are visible on every screen: `IoT2Hub` and **`CMMS`**. `S4` states its boundary explicitly — *"Enquiries and complaints raised by residents. Maintenance execution stays in the external CMMS."*

The Product Owner's 2026-08-13 ruling covers **IoT and third-party systems integrating inbound through REST, with `2IoThub` adapting the input**. `CMMS` does not fit that shape:

- It is a **business system, not an IT/OT protocol source**, and `2IoThub` is a protocol gateway.
- The relationship is **bidirectional** — PEMO raises a case, the CMMS executes and reports back — whereas everything PEMO does today is inbound telemetry plus one idempotent resident acknowledgement.
- **It is an outward write path**, which PEMO has never had.

**Recorded as open**, in the same class as Intercom: a capability change rather than an integration, needing its own decision before any contract admits it. `S4` can be contracted as a read surface plus case creation **within PEMO**, with CMMS execution explicitly out, exactly as the design already says.

## A6 — Two smaller items carried into the contract work

- **`S8` Smart IoT states its own boundary: *"Enrolment, not engineering."*** That is a scope assertion written into the design, and it aligns with `D3`'s three tiers — enrolment is estate-staff material, engineering is integration-support.
- **Three languages in the shell (`ENG` / `繁` / `简`), two required in the notice composer.** `DOC-014-ST` reported this unresolved as instructed. It is a product decision, recorded as open: whether Simplified Chinese is a supported content language or an interface language only.

## Amended decision record

```text
Scope node:              ADR-002 hierarchy node OR ADR-003 Location  — corrected 2026-08-13
Level spanning:          the default request shape, 9 of 11 surfaces — corrected 2026-08-13
Organization/Portfolio:  contract supports from v1; design gap recorded — decided 2026-08-13
Role vocabulary:         expressed structurally, not enumerated      — decided 2026-08-13
CMMS:                    open — outward write path, own decision, like Intercom
Simplified Chinese:      open — content language or interface only
```
