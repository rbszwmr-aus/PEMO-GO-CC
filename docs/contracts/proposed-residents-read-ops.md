# Proposed contract amend — Residents reads (WEB-05)

**Status:** ACCEPTED (2026-09-06) — pending implement
**Lane:** PEMO-grok management-web Surfaces ↔ Backend
**Accepted with:** PEMO-grok master + Backend notes below
**Do NOT wire live** until an implementation brief; keep fixture-only UI.

## Why

The management-web rail item prop-residents (WEB-05) needs list → detail.
Management OpenAPI today only contracts writes under Residents
(recordOccupancy, endOccupancy). There is no listResidents / getResident
read. Live remains frozen at Surfaces↔Backend v0 (scope + tree only) until
this amend is implemented and the freeze note / OpenAPI are updated.

UI ships fixture-first under apps/management-web/src/data/residents-fixtures/.
source=live on Residents must not invent empty lists.

## Accepted operations (implement later)

1. GET /api/management-web/v0/residents — listResidents → ResidentListResponse
2. GET /api/management-web/v0/residents/{residentId} — getResident → ResidentDetailResponse

Paths use the management-web v0 prefix (same family as scope / properties/tree),
not bare /residents.

## Backend acceptance notes (locked)

1. Paths: /api/management-web/v0/residents and /api/management-web/v0/residents/{residentId} — match scope/tree + future Vite proxy allowlist.
2. Auth: Authorization Bearer staff; missing/invalid → 401 application/problem+json; list/detail filtered by authorizing grants; no cross-estate leak.
3. List: optional scope filter + directoryState; confirm at implement whether live returns fixture-style counts {all, verified, invited, pendingVerification, expiredScope}; pagination TBD.
4. IDs: opaque own IDs (res_ / unit_ / hh_ / occ_); staff directory is not resident-mobile getResident.
5. Detail: occupancies keep unitClass; parking/storage must never present as a second home.
6. When implemented: add only these two GETs to the Vite PEMO_LIVE_BASE_URL proxy allowlist.
7. Docs: OpenAPI + docs/contracts/management-web-v0-freeze.md (or successor freeze) update only after implement lock — not before.

## Shape intent (from UI fixtures)

PEMO property path Organization → Estate → Building → Floor → Unit; roles
owner_occupier | tenant | household_member | caregiver; directory / invitation /
verification states as exercised by fixtures.

## Live freeze (until implement brief)

Do not widen live beyond scope + tree for Residents until implement ships and
freeze/OpenAPI are updated. Fixture-only until then.
