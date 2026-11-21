# ADR-016 — The identity boundary: PEMO authorizes, it does not authenticate

**Status:** `Accepted` — `v1.0`. Accepted by the Product Owner 2026-09-01.
**Carried in by:** `GEN-031`.
**Date:** 2026-09-01
**Author:** PEMO Master Brain
**Decision owner:** Product Owner
**Target location:** `docs/adr/ADR-016-identity-boundary.md`
**Related:** `ADR-010` `D1` (attributable to a principal) · `ADR-010` `A1` (the provisioning act) ·
GEN-027 (the provisioning gap) · GEN-030 (the `staff_principal` gap that surfaced this).
**Unblocks:** W3 batch 3b (bootstrap), and every future onboarding of a staff member.

---

## The problem

An authorization system decides what a **known** person may do; it takes *"who you are"* as an input.
It cannot create its own first principal, because that identity must enter from outside authorization.
GEN-030 hit the floor of the bootstrap chain: `group_membership.principal_id` FKs `staff_principal`,
and **nothing in the system creates a `staff_principal` but the seed** — so a genuinely empty
organization has no person to seat, and, more generally, PEMO has no defined way for **any** staff
member to become known to it.

## Decisions

### D1 — PEMO **authorizes, it does not authenticate**. A `staff_principal` is a **recorded** external identity.

A `staff_principal` is never **minted** by PEMO (that invents a person) and is never **authenticated**
by PEMO (verifying a credential is an external concern, always). It is an external identity that PEMO
**records** so it can be authorized. This is the boundary, stated once: identity enters from outside;
PEMO holds only enough of it to attribute and authorize.

### D2 — A `registerPrincipal` act records an external identity. Its trigger is **pluggable**.

One act — record a `staff_principal` from `(external_id, display_name)` — with **no credential, no
password, nothing secret**. Its trigger is pluggable, and this is what makes options A and B one
mechanism rather than a choice:
- **now (B):** an operator / onboarding step supplies the `external_id` (no IdP exists yet);
- **later (A):** a real IdP / SSO feeds the same act on first sign-in.
Same recording path; only the caller changes. The boundary (D1) is fixed from day one, so adopting an
IdP later adds a caller, not a rewrite.

### D3 — What is recorded is minimal: `external_id` + `display_name`. Nothing secret, ever.

`external_id` is the stable identifier of the person in the external authenticator (the IdP subject,
later). `display_name` is for humans reading an audit or a member list. **No credentials are stored in
PEMO** — authentication happens elsewhere, always. An IdP subject slots into `external_id` unchanged.

### D4 — The bootstrap calls `registerPrincipal` inside the one atomic provisioning act.

`ADR-010` `A1`'s "the first grant is created as part of that act" extends: the provisioning act
records the first principal, creates the group, confers the first grant, and seats the first
membership — **one transaction**, `source = 'provisioning'`, admissible iff the organization has held
zero grants ever (the once-only predicate already built). `registerPrincipal` is also callable outside
bootstrap, for the second and later staff members.

### D5 — NOT adopted: PEMO as a staff system-of-record.

PEMO does **not** own a staff/identity CRUD surface, a credential store, or authentication. It is not
where employee accounts live; it is where external identities are recorded for authorization. If the
Product Owner ever wants PEMO to be the staff system-of-record, that is a separate, larger decision —
explicitly out of scope here.

## Consequences

- The `staff_principal` question is answered for **all** staff, not just the first: `addMembership`
  and `confer` operate on principals already recorded by `registerPrincipal`; the bootstrap is only
  where it bit first.
- A new `registerPrincipal` act + likely a `staff_principal` shape carrying `external_id` uniqueness.
  No credential columns, now or later, under this ADR.
- W3 3b builds the atomic bootstrap on this; routes follow so the flow is reachable.

## Decision record

```text
Boundary:        PEMO authorizes, never authenticates; staff_principal is a
                 RECORDED external identity, never minted, never authenticated here  — accepted 2026-09-01
Mechanism:       one registerPrincipal act (external_id + display_name), pluggable
                 trigger — operator now (B), IdP later (A); same recording path      — accepted 2026-09-01
Recorded data:   external_id + display_name only; NO credential, ever                — accepted 2026-09-01
Bootstrap:       registerPrincipal + group + grant + membership, one atomic act,
                 source='provisioning', zero-grants-ever                             — accepted 2026-09-01
Not adopted:     PEMO as staff system-of-record / CRUD / credential store (D5)       — accepted 2026-09-01
```
