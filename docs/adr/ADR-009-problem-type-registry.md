# ADR-009 — The `Problem.type` registry

**Status:** `Accepted` — engineering decision taken under `API-015-ST`, 2026-08-13. **Nothing here is applied.** Implementation is a later PID, after `GEN-013-ST` merges.
**Date:** 2026-08-13
**Author:** CC `PEMO Contract` session, under `API-015-ST`
**Decision owner:** PEMO Master Brain
**Target location:** `docs/adr/ADR-009-problem-type-registry.md`
**Committing session:** `PEMO Contract` — authored and committed under `API-015-ST`; `Target location` and this field backfilled by `API-016-ST`.
**Raised by:** `GEN-013-ST` — a new type URI for `B5` conforms **by absence, not by declaration**.
**Related:** `ADR-008` (this is a surface change under its test); `ADR-007` (management-web audience, reserved).

## Context

At the pin, `Problem.type` is declared as:

```yaml
type:
  type: string
  format: uri-reference
```

No enum, no registry. Nine type URIs exist, and they exist **only in fixtures**:

```text
session-expired  not-authorized  internal-error  integration-unavailable      (5 uses each)
unmapped-unit  event-retracted  event-not-found  duplicate-acknowledgement
caregiver-scope-expired                                                       (1 use each)
```

The consequence is the whole reason this is a decision rather than a patch:

> **A typo in a type URI is undetectable by every check this project runs.** `session-expried` validates against `string`/`uri-reference`, passes the fixture validator, passes the contract suite, and silently breaks every client branching on the field — which is the field's entire purpose.

**A discriminator that is not validated is not a discriminator. It is a string.**

---

## Decision 1 — A registry file is normative; the schema enum is derived from it

**Rejected: pattern.** A pattern constrains shape, and the failure that actually occurred is spelling. `https://pemo.local/problems/session-expried` satisfies any pattern that `session-expired` satisfies. A check that cannot fail on the observed defect is not a mitigation for it.

**Rejected as the source of truth: a bare schema enum.** It is the strongest check — an unknown URI fails schema validation everywhere, including in generated clients — but it carries nothing except the string. It cannot express *reserved*, *deprecated*, *which surface*, or *since when*, and every one of those is needed below. It also makes the registry's contents visible only as a list inside a schema, where the reverse check in Decision 3 has nowhere to read intent from.

**Decided: a registry file is the source of truth, and `openapi.yaml`'s `Problem.type` enum is generated from it**, with the validator asserting the two agree.

> **Amended by `API-016-ST`, 2026-08-14 — the path.** This ADR originally named `packages/api-contracts/resident-mobile/problem-types.json`. `ADR-007` `v1.1` is later and its `D2` decides **separate contract packages with shared vocabulary**, confirming *"one registry, per-surface applicability"* in terms. A registry inside `resident-mobile/` would force the management package either to reach into a sibling's directory or to keep its own copy — and a second copy is the two-spellings-of-one-concept outcome this ADR exists to prevent. **The registry is therefore `packages/api-contracts/problem-types.json`**, one level up and shared. Nothing else changes: it remains normative, the enum remains generated from it, both directions are still asserted, and `surfaces` is unchanged — which is what let the correction be a relocation rather than a re-decision.

```json
{
  "types": {
    "session-expired": {
      "uri": "https://pemo.local/problems/session-expired",
      "status": "active",
      "httpStatus": [401],
      "surfaces": ["resident"],
      "since": "0.1.0",
      "summary": "The resident's session has expired and must be re-established.",
      "clientGuidance": "Re-authenticate. Distinct from invalid-credential, which is not recoverable by refresh."
    }
  }
}
```

This is the same shape the project already uses twice and has proven twice: `severity.json` is normative and the OpenAPI `Severity` enum is asserted equal to it by `severity-enum-agreement`, mutation-proven; and `GEN-006-ST` derives `CONTRACT_VERSION` from `openapi.yaml` rather than restating it. **Derive rather than restate** is the established idiom here, and this is the third instance rather than a new mechanism.

The enum still exists in the schema, so generated clients keep compile-time safety. It is simply no longer *authored* there.

---

## Decision 2 — How a type is added, and by whom

`packages/api-contracts/**` belongs to the contract track. But `GEN-013-ST` is emitting a second `401` type **now** and cannot edit that file, so a process that requires a contract edit before an emission would forbid the case that actually exists.

**Steady state.** The emitting session proposes the URI, its `httpStatus`, `surfaces` and client guidance. The contract track adds it with `since` set to the version being released. **Minor bump under `ADR-008`** — a new type is a new value a client must accept.

**Interim lane, for a session emitting before the registry can be edited.** The emitting session carries a **local assertion that its emitted type URIs equal an explicit expected set**, and the contract track folds it into the registry at the next contract change. This is exactly what `GEN-013-ST` is already doing, and it is the same pattern the register prescribes for `G2`'s locally-carried denylist terms.

The interim lane needs the property that made it acceptable in `G2`'s case stated explicitly, because otherwise it becomes permanent: **a local carry is a debt with a named creditor.** Each one is recorded in the register against the contract track, and the *next* contract change folds them in. Two carries already exist (`GEN-012-ST`'s ten terms, and the car-park terms before them) and the register already calls that "the beginning of drift".

---

## Decision 3 — What the validator asserts, in both directions

**Forward — every type used is declared.** Every `type` value in every fixture, and every type URI emitted by the running server in `GEN-006-ST`'s contract suite, must appear in the registry. *This is the assertion that catches the typo.*

**Reverse — every type declared is used, or explicitly reserved.** Every registry entry with `status: "active"` must appear in at least one fixture, or be listed in `emittedOnlyBy` naming the operation that produces it with the backend suite asserting it. An entry meeting neither fails.

The reverse half is the one that would be dropped as pedantry, and it should not be. **A declared type nobody emits is a client branch that can never be taken** — dead code in every consumer, written on the strength of the registry saying the case exists. `status: "reserved"` with a reason is the escape hatch for a type that is deliberately declared ahead of its emitter; the point is that it must be *deliberate* rather than residual.

**Surface containment.** A fixture on a resident path may only carry a type whose `surfaces` includes `resident`. This is what makes Decision 4 enforceable rather than a naming convention.

Each assertion ships with its red condition demonstrated: typo a URI in a fixture and see the forward check fail; add an unused active entry and see the reverse check fail. A check whose failure has never been observed is not evidence.

---

## Decision 4 — One registry, with per-entry surface scoping. Not two type spaces.

Management web is starting, and the register is explicit that its boundary **inverts** rather than relaxes: staff must see device references that residents never may.

**That inversion is about payload content, not about error causes.** `session-expired` means the same thing to a manager as to a resident. Two registries would produce two spellings of one concept, which is precisely the drift this ADR exists to stop — and the failure would be silent in the familiar way: both spellings validate, in their own space.

So: **one registry**, and each entry declares its `surfaces`. Shared causes are declared once and listed on both. Surface-specific causes — `caregiver-scope-expired` is resident-only; a management `insufficient-role` will be management-only — are scoped by the field and enforced by the containment assertion in Decision 3.

This is deliberately robust to `ADR-007`, which owns the surface split and has not been written. **If management ships as a second OpenAPI document, the registry is still one file and each document generates its enum from its own `surfaces` filter. If it ships as role-scoped responses in one document, nothing changes at all.** The `surfaces` field is orthogonal to document structure, which is why deciding it now does not pre-empt `ADR-007`.

The alternative — deciding nothing and letting management web pick its own URIs — is the accidental split, and the register already names that as the default outcome when nobody chooses.

---

## The interim mitigation, recorded as what it is

`GEN-013-ST` carries a local assertion that its emitted type URIs equal an explicit expected set. **That is a session-local stand-in for a contract-level guarantee.** It is correct, it was the right call, and it has two limits that are properties of where it lives rather than of how it was written:

- It constrains **one session's** emissions. A second session emitting `session-expried` is unaffected by it.
- It is **not the contract**, so nothing obliges a future session to keep it, and nothing tells a client author the set exists.

**What replaces it:** the registry plus the forward assertion in Decision 3.

> **Amended by `API-016-ST`, 2026-08-14 — "delete it" was wrong; it must be REPOINTED.**
>
> This ADR said the local assertion should be *deleted* once the registry landed. Implementing the registry showed why that would open a hole. **The forward assertion scans fixtures, and the fixture validator has no server.** Two of the eleven types — `bad-request` and `invalid-credential` — are emitted but never fixtured, so nothing on the contract side can see them being emitted at all. Removing the emitted-only entry from the registry was caught by *enum agreement*, not by the forward check, which is the proof of the limit rather than an argument about it.
>
> So the emitted set is verified only by the backend suite. **Deleting its assertion would leave the two emitted-only types unchecked against the registry by anything.** The correct handoff is to **repoint that assertion at `problem-types.json`** — same check, registry-sourced instead of locally-listed — which removes the second source of truth without removing the coverage. Deleting and repointing look equivalent from the ADR and are not equivalent in the tree.

---

## Consequences

- `problem-types.json` is created with the nine existing URIs plus `GEN-013-ST`'s second `401` type, each with `since` recording the version it first shipped in — `0.1.0` for the nine, the release version for the new one.
- `openapi.yaml`'s `Problem.type` gains a generated enum; `Problem` otherwise unchanged.
- Three validator assertions: forward, reverse, surface containment.
- **Minor bump under `ADR-008`** — a constrained `type` field is a constraint on what may be emitted.
- `GEN-013-ST`'s local assertion is removed by the applying PID, not before.

## Open question, deliberately not closed

**Whether the URI authority `https://pemo.local/` is the permanent form.** RFC 9457 says the type URI need not dereference, and nothing here depends on it doing so. But `pemo.local` is a placeholder that has already reached nine committed artifacts, and changing it later rewrites every fixture and every client branch. It is worth a deliberate decision before the registry hardens it — and it is a product and deployment question, not an engineering one, so it is named here rather than answered.
