# Property and Identity Model

- **Locked:** Estate → optional Phase → Building/Block → Floor → Unit.
- **Locked:** Buildings belong to an Estate and may belong to one Phase; common areas and facility locations are separate from the population hierarchy.
- **Proposed:** opaque stable IDs with explicit parent IDs and namespaced external IDs.
- **Unresolved:** address, localization, external property master and merge/archive policy.

## Location types and scope

| Type | Parent rule | Serving-scope rule |
|---|---|---|
| Estate-wide common area/facility | Parent is Estate | May serve the whole Estate or an explicitly restricted subset of phases/buildings/units |
| Phase-wide common area/facility | Parent is one Phase | Serves one Phase and may be mapped to selected buildings/units within it |
| Building/Block common area | Parent is one Building/Block | Serves that building, unless an explicit serving scope is recorded |
| Floor common area | Parent is one Floor | Serves that floor or selected units on it |
| Unit | Parent is one Floor, whose building may be phased or unphased | Serves the unit occupants; never a shared facility type |
| Facility location | Physical location parent is Estate, Phase, Building/Block or Floor | Separately records one or more serving scopes; it does not replace the physical parent |

A Building without a Phase is valid and remains directly under its Estate. A shared facility may serve multiple buildings or phases only through an explicit many-to-many serving-scope relation; physical parent and population served are not conflated. Safety audience mapping resolves source location → facility/location ID → serving scope → eligible residents/households, with unresolved or ambiguous mappings rejected or held for staff review rather than guessed.

## Occupancy, household and authorization

Occupancy is an effective-dated relationship between a Resident/Household and a Unit or approved location scope, with `effectiveFrom`, optional `effectiveTo`, status and source. Household membership is separately effective-dated and records member role/relationship; it does not change login identity. Resident-to-Unit authorization requires an active, non-expired relationship or an explicitly granted staff/caregiver scope. Server-side checks apply the operation time and current policy for every read, command, event projection and attachment.

Cross-module relationships use stable IDs and published interfaces, not owned-table access. External address, localization and master-data choices remain unresolved.