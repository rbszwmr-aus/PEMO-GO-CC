# ADR-002 — Organization and Portfolio tier above Estate

**Status:** `Accepted` — Option B, decided by the Product Owner on 2026-08-13.
**Date:** 2026-08-13
**Author:** PEMO Master Brain
**Decision owner:** Product Owner (user)
**Supersedes:** the implicit assumption that Estate is the root of the property hierarchy.
**Related:** `ADR-003` — location and facility taxonomy, which completes the property model this ADR opens.
**Target location:** `docs/adr/ADR-002-organization-and-portfolio-tier.md`, committed by **`API-005-ST`**.
**Committing session:** `PEMO Contract` — carried into the repository by `API-005-ST`; this field backfilled by `API-016-ST`.

> Corrected 2026-08-13. Earlier revisions named `GEN-006-ST` as the committer, which the write-scope map forbids — `docs/adr/**` belongs exclusively to `API-005-ST`. Two Accepted ADRs were left with no authorised route into the repository. Found by the `API-005-ST` Step 1 review.

## Accepted hierarchy

```text
Organization  (required — tenancy root)
└── Portfolio  (optional)
    └── Estate
        └── Phase  (optional)
            └── Building / Block
                └── Floor
                    └── Unit
```

Two optional tiers — `Portfolio` and `Phase` — following the same pattern. Common areas, public areas, public facilities and the clubhouse attach at several of these levels and are modelled separately in `ADR-003`.

## Context

The committed architecture models the property hierarchy as:

```text
Estate → [optional Phase] → Building/Block → Floor → Unit
```

Estate is the root. There is nothing above it.

The retired product scope (`PEMO_Function_Scope_v0.2.md`, `PLT-01`) describes something wider:

- Property-management company and customer organizations
- Multiple portfolios, estates and buildings
- Estate-specific settings, branding and contacts
- Configurable terminology by customer
- Business calendar, public holidays and service hours

Three independent artefacts assume this tier exists:

1. `PLT-01` itself, in the MVP-priority "PEMO Foundation" group.
2. `RPT-04 Portfolio view` — cross-estate comparison, configurable corporate KPIs, drill-down to estate. Currently unbuildable.
3. `RETIRED-DOC-002` §4, which lists **Corporate portfolio administrator** as a management-web role, and §6 `WEB-01`, which specifies an "Estate/portfolio scope selector" on the sign-in screen.

None of this survived into the architecture, and the omission is not recorded as a decision anywhere. The independent architecture review returned `APPROVE_AS_IS` with zero findings, which indicates it was checking internal consistency rather than coverage against the product scope — a reasonable scope for that review, but it means this gap was never assessed.

## Why this cannot be deferred quietly

Multi-tenancy is not a feature that bolts on. If Organization scoping is added after Property, Resident, Case, Notice and Safety-event data exist, it requires:

- a data migration touching the root of every scoped table;
- a rewrite of every authorization check, because scope resolution changes shape;
- revisiting every query that currently assumes Estate is the top;
- re-testing every tenancy isolation case, which is the security-critical surface.

Doing it now, in a walking skeleton with no data, costs one table, one scope column and one extra level in the authorization check.

That asymmetry is the entire argument. It does not prove PEMO needs multi-tenancy — it means the decision should be taken deliberately rather than inherited by default.

## Options

### Option A — Single-tenant. Estate stays the root.

PEMO serves one property-management company. No Organization, no Portfolio.

- **For:** simplest model; no unused abstraction; fastest walking skeleton; honest about what is actually known today.
- **Against:** contradicts `PLT-01`, which is MVP-priority in the product scope; `RPT-04` stays unbuildable; per-customer branding and terminology have nowhere to live; the "Corporate portfolio administrator" role in the design register has nothing to administer; expensive to reverse.
- **Requires:** removing or re-scoping `PLT-01` and `RPT-04` in the function scope, and removing the portfolio scope selector from `WEB-01`. This option is only coherent if the product scope changes with it.

### Option B — Organization required, Portfolio optional. *(recommended)*

```text
Organization → [optional Portfolio] → Estate → [optional Phase] → Building → Floor → Unit
```

Organization is the tenancy root and always present. Portfolio is an optional grouping, exactly mirroring the optional-Phase pattern the architecture already uses and has already tested.

- **For:** satisfies `PLT-01` and unblocks `RPT-04`; gives branding, terminology and service calendar a home; reuses an established pattern rather than inventing one; cheap now; the authorization scope is defined once, correctly, at the point where it is easiest to test.
- **Against:** adds a tier that a single-customer deployment will not use; slightly more setup in seeds and fixtures; a small amount of work that may never pay off if PEMO stays single-tenant forever.
- **Cost in `GEN-006-ST`:** one `platform.organization` table, one optional `property.portfolio` table, an organization scope on the authorization context, and the corresponding negative tenancy tests. Small.

### Option C — Organization now, Portfolio deferred.

Add the tenancy root only; leave grouping for later.

- **For:** captures the expensive-to-retrofit part; avoids a tier with no proven demand.
- **Against:** `RPT-04` stays blocked, and Portfolio is the cheaper half to add later precisely because it is optional and non-root. This option defers the easy part and keeps the hard part — an odd trade.

## Recommendation

**Option B.**

The evidence for a portfolio tier is not speculative. It is named in the product scope at MVP priority, it has a dedicated reporting feature, it has a named user role, and it has a screen element specified in the design register. Four independent artefacts, written before this session, assume it exists. Against that, "we might only ever have one customer" is an assumption with no artefact behind it.

The optional-Portfolio shape also means a single-customer deployment carries almost no burden: one organization row, no portfolios, and the hierarchy reads exactly as it does today.

The honest counter-argument, stated plainly: if PEMO is definitely and permanently a single-company internal tool, Option A is correct and Option B is speculative generality. **Only the Product Owner knows which of those is true.** That is precisely why this is an ADR and not an engineering detail I should settle.

## Consequences if Option B is accepted

- `GEN-006-ST` §2.2 Property Core gains Organization and optional Portfolio, and its tenancy negative tests must include cross-organization isolation — a resident of Organization A must not reach Organization B under any path.
- `API-005-ST` is unaffected. The resident mobile contract exposes no organization concept; residents see their unit, not the tenancy tree. Confirm this holds rather than assuming it.
- `UI-007-ST` is unaffected for the same reason.
- Management web, when specified, gains the `WEB-01` portfolio scope selector already in the design register.
- Function scope v0.3 records `PLT-01` as covered and `RPT-04` as unblocked.

## Consequences if Option A is accepted

- `GEN-006-ST` proceeds unchanged.
- Function scope v0.3 must re-scope or remove `PLT-01` and `RPT-04`, and `WEB-01` loses its portfolio selector. Leaving them in place while the architecture cannot support them is the outcome to avoid — that is how a product scope quietly becomes fiction.
- This ADR is recorded as accepted with Option A, so that the next person to ask "why is there no organization tier?" finds a decision rather than an absence.

## Decision

**Option B accepted.** Organization is the required tenancy root; Portfolio is an optional grouping tier above Estate.

```text
Decision:  Option B — Organization (required) → Portfolio (optional) → Estate
Date:      2026-08-13
Decided by: Product Owner
```

**Rationale, in the Product Owner's own terms:** this hierarchy is not a hedge against a hypothetical second customer — it is a description of how the business actually operates today. The recommendation was framed as insurance against future multi-tenancy; the decision was made on stronger ground than that, namely that the model is simply correct.

That distinction matters for how it gets built. Organization and Portfolio are **not** speculative scaffolding to be implemented thinly and fleshed out later. They are load-bearing from the first migration, and the cross-organization tenancy tests are security tests, not future-proofing.

The Product Owner also confirmed that the property model must cover common areas, public areas, public facilities such as car parks and gardens, and the clubhouse. That is a materially larger surface than "Estate → Building → Floor → Unit" and is specified in `ADR-003`.
