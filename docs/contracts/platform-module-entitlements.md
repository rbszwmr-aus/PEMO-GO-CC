# Platform module entitlements — SSO and dual-module RBAC

**Status:** LOCKED doctrine (PT 2026-09-21, broadened same day). ParkCore claim names **frozen by ParkCore master 2026-09-21**. Other modules’ field names remain **PROPOSAL** until that module’s Backend freeze.
**Lane:** Platform contract for **all current and future modules** (PEMO, ParkCore, later HMS, …). ParkCore is the **first worked example**, not the scope of the pattern. No product code in this note.
**Related:** `ADR-003` (PEMO holds the car-park place, not the operation), `ADR-012` (effective rights = union of groups), `ADR-016` (PEMO authorizes; credentials stay outside). ParkCore JWKS / `aud` freeze: [platform-sso-jwks-parkcore.md](https://github.com/rbszwmr-aus/car-park/blob/main/docs/contracts/platform-sso-jwks-parkcore.md) on [rbszwmr-aus/car-park](https://github.com/rbszwmr-aus/car-park) `main` (PR [#73](https://github.com/rbszwmr-aus/car-park/pull/73) merge [`c4cd278`](https://github.com/rbszwmr-aus/car-park/commit/c4cd278)).

This is the pattern every module must follow. A new module does not get a private SSO/RBAC story.

## 1. Problem / non-goals

**Problem.** One operator may use several licensed modules. They must share a sign-in without sharing databases, user tables, or admin shells. When a sale includes PEMO, **PEMO Administration (staff / groups) is the one identity home.** Every other module learns only what that operator may do *in that module*, via token claims or a thin entitlements API.

**Non-goals (FORBIDDEN) — every pair of modules, not only PEMO↔ParkCore:**

- Bidirectional full user-table sync.
- Embedding Module-A Admin UI inside Module-B (including iframe SSO).
- Shared Postgres across modules. Each module has its own DB. Modules **do not** read each other’s Postgres.

**Hard isolation** (do not collapse). Future modules get their own repo, ports, and DB — never a share of these:

| Module | Vite | API | DB |
|---|---|---|---|
| PEMO | `:5175` | `:3200` | `pemo_grok` |
| ParkCore | `:5177` | `:3300` | `parkcore` |
| Later (e.g. HMS) | own ports | own API | own DB |

PEMO already opens ParkCore in a **new tab** from BUILDING SYSTEMS → Car Park (`apps/management-web/src/data/parkcore-link.ts`). That link is not SSO. Same rule for every sibling: **link out, never embed**.

## 2. Actors and license cases

| Actor | Role |
|---|---|
| Staff principal | One person. Recorded in PEMO when the sale includes PEMO. |
| PEMO Administration | Staff, groups, default roles, Groups Rights UI — **identity home when sold with PEMO**. |
| Token issuer | Shared OIDC-style issuer (PEMO **or** a shared auth service). Publishes JWKS. |
| Each module | Trusts issuer/JWKS. Consumes `modules[]` + its own claims **or** a thin entitlements API. Never another module’s Postgres. |

| License | Auth | RBAC home |
|---|---|---|
| PEMO-only | Shared issuer | PEMO groups + PEMO claims only. No sibling-module tabs or callbacks. |
| Module-only (ParkCore-only, later HMS-only, …) | That module’s local login | **That module’s local RBAC.** No PEMO staff table. |
| PEMO + one or more modules | Shared SSO | PEMO Groups is staff home. Token `modules[]` lists every licensed product. Groups Rights **may** show function tabs per licensed sibling. |

**v1 dual-buy (ParkCore freeze):** SSO claims drive the ParkCore principal. Standalone sale = local RBAC only. Hybrid `local ∪ claims` is **out of v1** (open for later).

Effective permission = **union across the principal’s groups**, then **split by module**. A grant in module A never implies an act in module B.

## 3. Token claim sketch

Shared issuer; **each module** verifies JWKS/`iss`/`aud`/`exp`. Platform default for a module: `<module>_actions` (closed action set) + optional `<module>_role`.

```json
{
  "iss": "https://auth.example/platform",
  "aud": ["pemo", "parkcore"],
  "sub": "stf_wfg_manager",
  "modules": ["pemo", "parkcore"],
  "pemo_features": ["view_overview", "manage_access"],
  "parkcore_actions": ["lane.operate", "payment.refund", "user.admin"],
  "parkcore_role": "MANAGER"
}
```

- `modules`: licensed products for this principal (`pemo`, `parkcore`, later `hms`, …). Include `"parkcore"` only when licensed.
- **ParkCore (frozen):** `parkcore_actions` — `string[]`, closed `authz.Action` set (same strings as local Groups / `whoami.allowed`). Optional `parkcore_role`: `ADMINISTRATOR` \| `MANAGER` \| `OPERATOR` \| `READ_ONLY`. **Do not use `parkcore_features`.** Do not put UI domain names (`Counter`, `Lists`, `Lanes`, `Shifts`) in the token; those are screens, mapped from action prefixes.
- **PEMO (PROPOSAL until PEMO Backend freeze):** `pemo_features` matches today’s fixture vocabulary (`apps/management-web/src/data/types.ts`). PEMO may later align to `pemo_actions`.
- Later modules: `<module>_actions` + optional `<module>_role`. That module owns the closed action set.
- Optional later: estate / place scope. Out of this sketch until a Backend asks.

A module authorizes from its own claims (or a thin entitlements GET that returns the same split). No second password when arriving from a sibling that already holds an SSO session.

## 4. Worked example — ParkCore (first module)

### Roles and action domains (ParkCore-owned)

Closed roles: `ADMINISTRATOR` \| `MANAGER` \| `OPERATOR` \| `READ_ONLY`.

Action domains (UI groups screens via **action prefixes**, not claim strings): lanes, payments, alarms, occupancy, plate lists, supervisor holds, units/quotas, visitor, receipts/export, admin/audit.

Examples (not the full closed set): `lane.operate`, `payment.refund`, `user.admin`. ParkCore’s Groups / `whoami.allowed` is the source of truth for the set.

### Draft map — PEMO group default roles → ParkCore role

**Draft only** for Groups Rights when both are licensed. ParkCore owns the action set; PEMO does not invent ParkCore screens as claims.

| PEMO group default role | Example `parkcore_role` | Intent |
|---|---|---|
| `administrator` | `ADMINISTRATOR` | Full console, including `user.admin` |
| `estate_manager` | `MANAGER` | Day-to-day ops (lanes, payments, holds, lists) |
| `help_desk` | `OPERATOR` | Desk / visitor / occupancy, not admin |
| `security` | `READ_ONLY` | Gate / occupancy watch; extra `parkcore_actions` may add specific acts |

When ParkCore is licensed, Groups Rights **may** add tabs keyed to ParkCore **action domains** (lanes, payments, …). Counter / Lists / Lanes / Shifts remain UI chrome. Grant marks still come from the group’s default roles through a role → action matrix; effective = union, then split by module. Later modules get the same tab-when-licensed treatment — not a second staff admin.

**ParkCore effective set (frozen with the JWKS note).** ParkCore authorizes from the optional role plus the closed action list — never from UI domain names:

```
EffectiveAllowed = RoleAllows(parkcore_role) ∪ filter(parkcore_actions, closed authz.Action set)
```

- `RoleAllows(role)` is ParkCore’s role → action table. Empty or invalid `parkcore_role` → **no table grants** (`RoleAllows = ∅`).
- `parkcore_actions` is filtered to the closed set; unknown strings are dropped.
- The union is the ParkCore principal’s allowed set (same strings as local Groups / `whoami.allowed`). PEMO Groups Rights, when licensed, shows that union as read-only grant marks.

### Handoff (generic; Car Park CTA is first)

No password prompt in the destination tab.

1. Operator is already signed into a module that holds the SSO session (today: PEMO on `:5175`).
2. CTA requests a **one-time code** from the issuer (bound to `sub`, licensed `modules`, short TTL, single use).
3. Browser opens the sibling (ParkCore `:5177` today) at a **callback** URL carrying the code — new tab, `rel=noopener`; not an iframe, not a password form.
4. Destination redeems the code, receives the JWT, verifies JWKS/`iss`/`aud`/`exp`, starts its own session from claims (or the thin entitlements API).
5. Failed / expired / unlicensed module → destination error page. Do not prompt for the source module’s password.

ParkCore CTAs today (Console / Counter / Lists) stay as deep-link **UI** paths; the callback wraps them once SSO exists.

### JWKS on ParkCore API `:3300`

Placeholder env (ParkCore), aligned with the car-park design note on `main`:

| Env | Fixture / placeholder |
|---|---|
| `PARKCORE_OIDC_ISSUER` | Shared issuer URL |
| `PARKCORE_OIDC_JWKS_URL` | JWKS document for that issuer |
| `PARKCORE_OIDC_AUDIENCE` | `parkcore` |

Validate `iss` / `aud` / `exp` (and signature against JWKS). `aud` must include `parkcore`. ParkCore never reads `pemo_grok`.

## 5. Delivery sequence

1. **This platform contract** (this PR).
2. **PEMO fixture:** Groups Rights shows ParkCore domain tabs when the demo license includes ParkCore; still fixture-only. Later modules repeat this fixture step; they do not reopen SSO doctrine.
3. **ParkCore (first consumer):** verify a minted JWT on `:3300` against JWKS/`iss`/`aud`/`exp`; ignore PEMO DB.
4. **Live auth later:** issuer + one-time-code callback + (optional) thin entitlements API. Each later module joins at step 3 against the same issuer.

A module sold standalone keeps **local RBAC** until (or unless) that site is licensed with PEMO.

## 6. Review asks for ParkCore master

Please confirm or correct:

1. **Capability map** — roles `ADMINISTRATOR` / `MANAGER` / `OPERATOR` / `READ_ONLY` and action domains listed in §4. Draft PEMO-role → `parkcore_role` table is PEMO’s stub; ParkCore owns the closed `authz.Action` set.
2. **JWKS verify on `:3300`** — `PARKCORE_OIDC_ISSUER` / `PARKCORE_OIDC_JWKS_URL` / `PARKCORE_OIDC_AUDIENCE=parkcore`; reject on bad `iss`/`aud`/`exp`.
3. **Claims** — PT asked `parkcore_features` vs `parkcore_roles`. ParkCore freeze: **neither as the closed set.** Use `parkcore_actions` (`string[]`, same as local Groups / `whoami.allowed`) + optional `parkcore_role`. Do not use `parkcore_features`. UI domains (Counter / Lists / Lanes) are not claim strings.

v1 dual-buy: SSO claims drive the ParkCore principal; standalone = local RBAC only.

## 7. Open questions (module masters / Backends)

1. Production issuer: PEMO API vs shared auth service? (`ADR-016` prefers credentials outside PEMO.)
2. PEMO claim family: keep `pemo_features` or align to `pemo_actions`?
3. Is a thin entitlements API required besides JWT claims (scope, revocation, tab catalog)?
4. One-time code: TTL, replay window, and binding to callback origin / deep-link path.
5. Module-only operators who later buy PEMO: how they attach to a PEMO `staff_principal` **without** dual-table sync. (Hybrid `local ∪ claims` on ParkCore is separately out of v1.)
