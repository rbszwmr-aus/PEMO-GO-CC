# Proposed field — household `contactEmail`

**Status:** PROPOSAL (not in OpenAPI; not live)
**Lane:** PEMO-grok management-web finance / administration
**Date:** 2026-09-20 (PT)

## Why

Invoice send needs a To address per household. Administration Email config
holds From / SMTP (fixture session today; server env in live). The household
row holds the recipient.

## Field

| Layer | Name |
|-------|------|
| DB | `resident.household.contact_email` (nullable text; migration 0142) |
| Fixture / later read | `contactEmail` |

Seeds for Wing Fu Garden demo households match finance fixture contacts
(`ho.meiyi@wingfu.example`, …).

Do **not** widen `docs/contracts/management-web-v0-freeze.md` until a
households read amend is accepted. SMTP username/password belong in server
env in live — not in this column and not in browser storage.
