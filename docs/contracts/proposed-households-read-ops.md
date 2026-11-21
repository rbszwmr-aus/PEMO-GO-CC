# Proposed contract amend — Households reads (WEB-04)

**Status:** PROPOSAL (not in OpenAPI; not live)
**Lane:** PEMO-grok management-web Surfaces
**Date:** 2026-09-06 (PT)

## Why

The management-web rail item `prop-households` (WEB-04) needs a fixture-first
list → detail vertical slice. Design notes composition, effective dates,
caregiver authorisation and contact preferences, reached in relation to a unit
(Org → Estate → Building → Floor → Unit). The management OpenAPI today exposes
household members only nested under `getUnitDetail` (`GET /properties/units/{unitId}`).
There is **no** `listHouseholds` / `getHousehold` read. Live remains frozen at v0
(scope + tree only).

This slice therefore ships **UI-owned fixtures** under
`apps/management-web/src/data/households-fixtures/` and does **not** call live.

## Proposed operations (for a later API PID)

1. `GET /households` — `listHouseholds` → `HouseholdListResponse`
2. `GET /households/{householdId}` — `getHousehold` → `HouseholdDetailResponse`

Shapes already exercised by the UI fixtures (PEMO property path; membership roles
`owner_occupier | tenant | household_member | caregiver`; safety viewing split from
countdowns; caregiver authorisation with effective dates; nullable `contactEmail`
for invoice To — see `proposed-household-contact-email.md` / `resident.household.contact_email`).
A vacant unit has no household — list counts households, not units.

## Live freeze

Do **not** widen `docs/contracts/management-web-v0-freeze.md` for these reads
until the amend is accepted and an API surface is proved. Until then:
fixture-only; `?source=live` on Households must not invent empty lists.
