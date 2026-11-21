# ADR-017 — Delegation authorization floors (who may register, add, remove)

**Status:** `Accepted` — `v1.0`. Accepted in full by the Product Owner 2026-09-01,
including the empty-group -> org-node fallback in `D1` (see
`ADR-017-ACCEPTANCE-product-owner.md`).
**Carried in by:** `GEN-033`.
Date: 2026-09-01
Context: W3 batch iii wires the three write-surface routes that still have none —
`registerPrincipal` (standalone), `addMembership`, `removeMembership`. Each route
must enforce an authorization floor. The floor is the privilege-escalation
boundary of the grant system; getting it too permissive lets a caller grant
themselves authority they do not hold. This ADR sets the floors and the one
principle they all descend from, so batch iii's routes cite an accepted decision
rather than inventing a floor.

## The principle

**[delegation-floor] — you cannot cause authority you cannot yourself confer.**
A write that changes who holds authority is authorized only if the caller is an
effective `grant_administrator` covering every node at which the change could
cause the subject to hold authority. This is G-2 (findAuthorizingGrant, the
grant_administrator-covering check W2 already uses for conferGrant) lifted from a
single grant to the *set* of authority a change confers — a conjunction: ALL must
pass, or the write is refused (a domain refusal, never a 500 — C4).

The model already treats `grant_administrator` as the meta-authority: W2's
conferGrant lets a grant_administrator@node confer ANY role at that node,
including grant_administrator itself. These floors are that same rule applied to
the two other ways authority moves — by membership, and by directory write.

## D1 — addMembership floor

Adding a principal to a group gives that principal the union of the group's
**live** grants. Therefore:

> The caller must be an effective `grant_administrator` covering **every node at
> which the target group holds a live grant**. If the group holds **no** live
> grants, the caller must be an effective `grant_administrator` at the **org
> node**.

Rationale: membership is conferral-by-proxy. If group G holds grant_administrator
@org, only an org-level grant_administrator may add a member to G — this is what
stops a building administrator adding themselves to the org-admin group. The
empty-group fallback closes a latent escalation: without it, an unauthorized
caller could pre-stage themselves into an empty group and silently inherit
authority the moment a legitimate admin later confers a grant to that group
(the conferrer's own G-2 passes and does not enumerate membership, so the
pre-load would go uncaught). Requiring org-level grant_administrator to touch a
grantless group's membership removes that path.

## D2 — removeMembership floor

Removing a member reduces rights (monotonic-safe against escalation), but
unrestricted removal is an administrative-lockout / denial attack (strip a node's
administrators). Therefore:

> Same administration floor as D1 — effective `grant_administrator` covering every
> node the group holds a live grant at (empty → org node) — **plus** the GEN-030
> no-last-effective-administrator guard: the removal must not leave any node with
> no live effective administrator (an effective administrator = principal ∧ live
> grant ∧ live membership, the GEN-030 witness). Evaluated under GEN-030's
> org-scoped advisory lock.

## D3 — registerPrincipal (standalone route) floor

The standalone `registerPrincipal` route records an external identity
(external_id, display_name) into an org's directory. It confers **no** grant and
**no** membership by itself, so [delegation-floor]'s conferral test is vacuous —
but it is still an org-directory write. Therefore:

> The caller must be an effective `grant_administrator` at the **org node** of the
> principal being recorded.

This is distinct from the bootstrap path: provision (batch ii) also calls
registerPrincipal, but inside the atomic genesis act on the provisioning path
(source='provisioning', zero-grants-ever, no caller floor). The standalone route
is the post-bootstrap path — the org already has administrators — so an org-level
floor neither blocks genesis nor is blocked by it.

## D4 — refusals are domain errors

Every floor failure surfaces as a domain refusal, not a 500 (C4). The floors are
guards, and a guard that 500s is a guard that leaks.

## What this ADR does NOT decide

- The standalone-registration UX/mode (operator vs IdP trigger) — ADR-016 covers
  the recording mechanism; this ADR only sets who may invoke the standalone route.
- IMPORT-LEGACY-STAFF (bulk directory import) — deferred (held-gaps ruling).
- Subtree/cross-node reachability of "covering" — the existing G-2 covering
  semantics are inherited unchanged; if they need extension that is its own owed
  item, not this ADR.

## If accepted

Batch iii (register's next allocation, e.g. GEN-033 — NOT "W3-3b-iii") wires the
three routes enforcing D1–D4, cites this ADR, and adds [delegation-floor] to
PID-PRINCIPLES.md. Battery cases must bite each floor: a building-admin refused
on an org-scoped group (D1), a last-administrator removal refused (D2, GEN-030),
a non-admin refused on standalone registration (D3), each failure a domain error
not a 500 (D4).
