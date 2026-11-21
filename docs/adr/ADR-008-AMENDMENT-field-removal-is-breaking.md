# ADR-008 AMENDMENT — field removal is a breaking change

**Status:** `Accepted` — amendment to `ADR-008`.
**Carried in by:** `GEN-032`.
Date: 2026-09-01
Origin: GEN-031 R3 — the provision contract removed a field; ADR-008's
version-bump table was silent on removal, so the breaking bump had no citation.
Silence is a gap, not permission.

## The gap

ADR-008's contract-versioning table enumerates what forces a **breaking** major
bump: adding a required field, changing a field's type, tightening a field's
constraints such that a previously-valid payload is now rejected. The table did
not name **removal**. A reader could infer removal is "just a minor cleanup"
because it isn't listed. That inference is wrong.

## The ruling

Add to ADR-008's breaking-change table:

> **Removing a field, or narrowing its presence or nullability such that a
> consumer that previously read it can no longer rely on it, is a BREAKING
> change and forces a major version bump.**

Rationale: a contract is a promise to its consumers. A consumer that reads a
field is broken the moment the field disappears or can now be absent where it
was guaranteed — exactly as surely as by a type change. The direction of the
change (adding vs. removing) does not determine breakage; whether an existing
consumer can still be satisfied does. Removal cannot satisfy a consumer that
read the field. Therefore: major bump.

## Corollary

"Not listed in the table" is never a licence. When the table is silent on a
change shape, the default is the conservative reading — treat it as breaking and
raise it — not the permissive one. The table enumerates known-breaking shapes;
it does not certify everything absent from it as safe.

## Scope

This amendment governs the provision contract's version bump in W3 batch ii and
every contract change hereafter. No existing shipped contract is re-versioned by
this amendment; it applies going forward.
