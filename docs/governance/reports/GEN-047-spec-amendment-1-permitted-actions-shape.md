# GEN-047 — Amendment 1: shape of `permitted_actions`

Date: 2026-09-03
Applies to: GEN-047 (notices 2.1.0) D1, D3, D6, acceptance 1/3
Trigger: UI CC readout `READOUT-grant-admin-ui-2026-09-03.md` §3 — a notice-shaped `canPerform` ("fields on the resource you read") does not cover creation acts. Four of the six grant-admin acts (conferGrant, addMembership, provisionOrganization, registerPrincipal) and notices' own `createNotice` are authorized against a CONTAINER that has no object yet. If GEN-047 freezes the object-only shape, grants get a second mechanism — the re-invention D1 forbids.
Authority: brain ruling under the standing division of labour; PO informed 2026-09-03.
Status: amends the dispatched spec before merge. If D1 is already implemented as verbs-on-object, refactor before merge; the delta is small and MINOR is preserved.

## A1 — Vocabulary: operationIds, not verbs

`permitted_actions` values are the contract's own operationIds (`reviseNotice`, `submitNotice`, `approveNotice`, `declineNotice`, `publishNotice`, `correctNotice`, `withdrawNotice`, `createNotice`), never bare verbs. One vocabulary for every module. The field's element type is generated from the contract: the set of operationIds whose operation is an act. A string that is not an act operationId is a type error, not a runtime surprise.

## A2 — Containers carry it too

`permitted_actions` is carried on the container an act is authorized against, not only on the object an act targets. In 2.1.0 that means `ScopeTreeNode` (getScope) gains `permitted_actions` (additive, MINOR). Semantics: the act operationIds the caller may perform NOW whose target is created under this node. In GEN-047 the only value that can appear there is `createNotice`; the grant-admin PID adds its creation acts through the same function with no contract-shape change. The organization root node carries org-level creations the same way when they arrive.

## A3 — One function, target-typed

`canPerform(operationId, target, caller)` where `target` is a discriminated union — in GEN-047: `{ kind: 'notice', notice }` | `{ kind: 'node', nodeRef }` — declared extensible. The function lives with `RoleScope` (ADR-018's owner); each module registers its acts' floor + state precondition with it; GEN-047 registers notices'. The shared function imports no notice type. Every act calls `canPerform` with the same target it would be evaluated against before executing — the act's own refusal and the list's omission are the same verdict from the same call. Bite: hand-built container list → diverges from the act's verdict for some (caller, node) → reds. Bite: the shared function importing a notices type → boundary red.

## A4 — Allowed only; no `allowed:false`, no reason codes

The UI readout's proposed `{ operationId, allowed, reason }` array is declined on the second and third fields. `permitted_actions` lists only what the caller may do now. Rationale: a refusal reason is the content of a refusal (the Problem) at act time; predicting it in every read duplicates the act's refusal path and doubles the bite surface for no rendering the design system needs — a control is rendered iff its operationId is listed, and the Problem is shown when an act is refused. Content refusals (bilingual, empty audience) remain shown-not-predicted (UI-045 F6). This can be reopened by a UI PID that shows a concrete screen needing a disabled-with-reason control.

## A5 — Fixture parity extends to the container

The getScope fixture shows `permitted_actions` populated for at least one node and empty for another, both under the seeded world; the parity check reds if either state is missing.

## Acceptance deltas

1 (single-sourced): the caller×target matrix now includes node targets; hand-list mutation on either object or container list → reds.
3 (fixture parity): A5.
5 (contract diff): `ScopeTreeNode.permitted_actions` and the generated act-operationId element type are the additive changes; still 2.0.0 → 2.1.0 MINOR.
D6 (disjoint vocabularies) unchanged; the operationId type is a third vocabulary, disjoint from lifecycle and disposition by construction.

## Recorded for the grant-admin backend PID (not GEN-047)

From the readout: `revokeGrant` and `removeMembership` take ids that no GET returns; `getScope.grants` is a bare ScopeRef; effective-administrators is organization-scoped while the slice asks per node. The reads-only grant-admin slice needs a Main CC PID adding list-grants-by-node, group-membership view, effective-administrators-for-node — all reusing `canPerform` per A3. Queued behind GEN-047 and the CI PID.
