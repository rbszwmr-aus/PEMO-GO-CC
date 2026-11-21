# ADR-018 — The authority check owns its precondition

**Status:** `Accepted` — `v1.0`, 2026-09-01. Approach B chosen.
**Carried in by:** `GEN-035`.
Cites: `ADR-017` (delegation floors), `G-2` (`findAuthorizingGrant`).

## Context

Every `G-2` site receives a node set expanded by the composition layer and cannot
verify it was filtered to `grant_administrator` grants. The `W3` routes filter
correctly, but a future route passing the expansion of ALL the caller's grants
would silently widen every floor to "any grant anywhere," with nothing to catch
it. A floor that holds only while every caller is careful is a suggestion, not a
floor.

## Principle

`[authority-owns-its-precondition]` — a security-critical check must not trust that
its caller filtered its input. Either the check filters from an un-narrowed input,
or its input is a value only the correct filter can construct. The wrong input
must be impossible to supply, not merely discouraged.

## Decision (approach B — make the wrong input unrepresentable)

- **D1** A typed scope (e.g. `GrantAdministratorScope`) = "the nodes at which a principal
  holds a live `grant_administrator` grant," with NO public constructor.
- **D2** One smart constructor / filter is the sole way to obtain it: it takes the
  caller's full grant expansion (carrying the role dimension) and keeps only
  live `grant_administrator` grants. The `grant_administrator` predicate lives in
  exactly this one place.
- **D3** `G-2` (`findAuthorizingGrant`) and every site feeding it accept only the typed
  scope, never a raw node set. An unfiltered set cannot reach `G-2` — it does not
  type-check and there is no other constructor.
- **D4** Behaviour-preserving: `ADR-017`'s floors are unchanged in meaning; this moves
  the trust boundary, not any floor.

## Fallback (approach A)

If the typed value is expensive against the current composition-layer shape, `G-2`
takes the caller's identity/expansion and performs the `grant_administrator` filter
itself, accepting no pre-narrowed set. Either approach closes the hole by
construction.

## Consequences

The `grant_administrator` filter is a single chokepoint; no caller can widen a
floor by passing an unfiltered set. `[authority-owns-its-precondition]` enters
`PID-PRINCIPLES.md` via the ADR-018 hardening PID (`GEN-035`).

---

## Carry-in note (`GEN-035`) — where the executed build differs from `D3`, and why

Recorded by the carrying PID so the discrepancy survives the PID that found it. It is a note on
the mapping from this decision to the code, not an amendment: the decision, the
principle and D1/D2/D4 are implemented exactly as written.

`D3` names `findAuthorizingGrant` as the site to retype. Measured at the pin, that
function's signature is `findAuthorizingGrant(scopeExpansion, organizationId,
grants: readonly ScopeGrant[], target)` — it takes **role-carrying `ScopeGrant`s**,
not a flat node set, so the role dimension is intact and it cannot be handed an
unfiltered set that looks filtered. It is also called with `estateStaffGrants` for
the occupancy, contact and update routes; narrowing it to the administrator-only
type would be wrong, not merely unnecessary.

The hole this ADR describes was six `readonly string[]` parameters inside
`@pemo/access` — `mayAdministerGroup`, `isEffectiveAdministratorAt`, `confer`,
`revoke`, `add`, `remove` — which is precisely where "a pre-expanded node set whose
filtering cannot be verified" was reaching a floor. Those six now take
`GrantAdministratorScope`. `D3` is therefore satisfied at the sites it was aimed at.
