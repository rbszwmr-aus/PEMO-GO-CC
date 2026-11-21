# ADR-006 — Device mapping and severity classification ownership

**Status:** `Accepted` — decisions and constraints confirmed by the Product Owner 2026-08-13. Two items remain deliberately open and are named at the end.
**Date:** 2026-08-13
**Author:** PEMO Master Brain
**Decision owner:** Product Owner
**Supersedes:** `ADR-006-DRAFT-mapping-and-classification-ownership.md`, which is retained unedited.
**Raised by:** `GEN-006-ST` — *"the mapping-and-classification question remains open and is encoded nowhere."*
**Target location:** `docs/adr/ADR-006-mapping-and-classification-ownership.md`
**Committing session:** `PEMO Contract` — carried into the repository by `API-016-ST`. This ADR had no authorised route in until then, while `GEN-012-ST` had already built its schema.
**Gates:** any `2IoThub` integration PID, and any migration touching `home_safety.safety_event`.
**Related:** `ADR-002` (estate hierarchy), `ADR-003` (location and facility taxonomy).

## Why this could not stay open

`home_safety.safety_event.severity` stores a value that arrived already classified, with **no column recording who classified it or against what vocabulary**. That is a schema shaped by an unmade decision.

Either answer is cheap now and expensive after ingestion exists — the same asymmetry that made `ADR-002` worth taking deliberately. And an open question that lives only in prose gets answered by whoever builds the integration first, whose answer then becomes the architecture by default.

## Decisions

**D1 — PEMO classifies severity.** `2IoThub` delivers the source signal and its own event type; PEMO maps that to the seven-level resident vocabulary.

**D2 — PEMO holds the device-and-zone to location mapping.** `2IoThub` delivers its own device or zone reference; PEMO resolves it to an Estate, Building, Floor, Unit or Location.

**D3 — Vocabulary translation and severity policy are two separate artifacts, with different owners.** This is the change from the DRAFT, and it is the one with the most operational consequence.

| | Layer 1 — vocabulary | Layer 2 — severity policy |
|---|---|---|
| Maps | source system event code → normalised PEMO event type | normalised event type + location class → PEMO severity + resident copy |
| Is a property of | the installed system: panel model, protocol, firmware | the estate's approved response policy |
| Owned by | engineering / Integration Hub | estate management with the fire consultant |
| Changes when | a panel is replaced, or firmware changes | policy changes |

The DRAFT treated these as one table. Combining them means **every firmware change requires estate-management approval, and every policy change requires an engineering review** — two artifacts whose change rates differ by an order of magnitude, chained to each other's slowest approver. They are separated here.

`ADR-003`'s location classes are the second key of Layer 2: smoke in a resident's own unit, in a common area, and in a building-service room are not the same resident-facing severity. **Whether a resident sees the event at all is a different question**, governed by `serving_scope`, and must not be conflated with how severe it is.

## The constraints that make this safe. They are not optional.

The retired `FEAT-001 v3` §3.7 states: *"PEMO must not independently reinterpret raw fire/BMS signals as a certified life-safety decision. The source-system classification and approved estate policy are required inputs."*

That guidance survives. Taken naively, "PEMO classifies" contradicts it. The reconciliation is precise:

**PEMO applies an approved policy. PEMO does not exercise judgement.**

**C1 — Classification is a versioned, approved policy artifact.** A table, with an approval record and an effective date. Not logic distributed through code, and not a developer's opinion about how serious smoke is.

**C2 — The source classification is a required input, never ignored.** PEMO maps from it. PEMO does not replace it. A channel that delivers no source classification cannot be classified under this ADR and must quarantine until the policy covers it explicitly.

**C3 — Severity may not be lowered below the source, and may not be raised except by the policy table.**

The DRAFT said only *"PEMO never downgrades."* That constrains direction and leaves authorship open, which implies that raising severity is free. It is not.

- **Never lower.** Mapping may make wording calmer; it may not make severity lower than the source asserts. A resident is never shown something less urgent than the fire panel said.
- **Raise only by policy.** Unbounded upward mapping produces false alarms, and alarm fatigue is itself a life-safety failure. A resident who learns that PEMO says `critical` when the panel said `advisory` stops believing PEMO — including the time it matters. Every upward step is a policy-table entry with an approval behind it, never a runtime judgement.

**C4 — Unrecognised input quarantines, and quarantine has a named owner and a response time.** An unrecognised source event type or classification becomes visible, unassigned and escalated to management. It never defaults to a severity and it never silently drops.

The DRAFT stopped there. **A quarantine queue nobody reads is a silent drop with extra steps.** The constraint is therefore: quarantine is not implemented until it has a named responsible role and a defined response time. Without both, the rule is decorative.

**C5 — Every classified event records provenance.** The source classification as received, the policy version applied, and the resulting PEMO severity. Without these three, nobody can later answer why a resident saw what they saw — which is the question that gets asked after an incident.

This keeps PEMO's safety positioning intact. PEMO is not deciding whether a building is on fire. It is deciding how to say, to a resident, what a certified system already determined.

## Where each datum lives

**The device-and-zone mapping belongs to Integration Hub, not Home Safety.** The module catalogue already gives Integration Hub "connections, mappings, translation". Home Safety owns resident presentation and response; it must not also own device correspondence, or the module boundary that has held all project starts carrying exceptions.

**Storing a device reference does not breach the resident boundary.** `forbidden-terms.json` governs what crosses into a resident-facing response, not what PEMO persists internally. PEMO may hold a device or zone identifier in `integration.*` and must never render one. Keep the scan pointed at responses, and add an explicit test that the mapping table's identifiers cannot reach a resident payload.

## Schema consequences

`home_safety.safety_event` gains, at minimum: the source classification as received, the policy version applied, and the classification timestamp.

> **Amended by `API-017-ST`, 2026-08-14 — "at minimum" is a FLOOR, not an enumeration.**
>
> `API-017-ST` initially excluded the **source event id** from the management surface on the ground that `C5` lists three provenance items and this is not one of them. That reading was too narrow, and the clause already says so: **at minimum**.
>
> The test is what question a field answers. *"Which record in the source system is this?"* is the reconciliation question asked during an incident investigation — by management and the fire consultant, not by integration engineers — and without it PEMO's provenance record cannot be tied to the panel's own log, which is half of what provenance is for.
>
> **The source event id is provenance and is visible to the estate-staff tier.** The decisive point is asymmetry rather than category: that tier already sees device and node references, and a source event id is not more identifying than those, so it is not what the boundary protects. Excluding it costs an incident investigation; including it costs nothing the tier does not already hold.
>
> Provenance is therefore open-ended by design, and a field is judged against the question it answers rather than against the three examples. `severity` remains, but becomes a derived value with a recorded derivation rather than an opaque inherited one.

Two new tables in `integration.*`, not one, per **D3**:

- the device-and-zone to location mapping, with effective dates — a device is replaced, a zone is re-wired, and an event received last month must still resolve the way it did then;
- the Layer 1 vocabulary table, keyed by source system type and version.

The Layer 2 severity policy table is keyed by normalised event type and `ADR-003` location class, carries a version and an approval record, and is the artifact the fire consultant signs.

**Effective-dating applies to all three.** Re-resolving a historical event must reproduce the answer given at the time, not the answer the current configuration would give.

## Open, deliberately

- **The policy table's contents.** Which source event types map to which of the seven levels is a safety decision requiring the fire consultant and estate management, not an engineering one. The structure is settled here; the values are not.
- **All-clear authority.** Who is permitted to end a resident-facing safety state, and on what evidence. This is a responsibility question rather than a schema one, and it is now the largest remaining hole in the safety model.

Whether `2IoThub` can supply a source classification on every channel is no longer open as a question — **C2** answers it: channels that cannot are quarantined until the policy covers them explicitly.

## Decision record

```text
Classification owner:   PEMO, by approved policy table          — decided 2026-08-13
Mapping owner:          PEMO, in Integration Hub                — decided 2026-08-13
Vocabulary vs policy:   two artifacts, separate owners (D3)     — decided 2026-08-13
Constraints C1–C5:      confirmed                               — decided 2026-08-13
Policy table contents:  open — fire consultant + estate management
All-clear authority:    open — responsibility question
```
