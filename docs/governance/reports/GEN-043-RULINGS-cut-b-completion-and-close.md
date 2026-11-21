# GEN-043 CLOSE — Cut B completion

**Verdict: CLOSE. CUT B IS COMPLETE.**
Date: 2026-09-02
Filed by: Master Brain (Product Owner). Carried into the repository by `GEN-043`.

---

Merge confirmed: 04a436b5 -> e51aa70a, tree-hash 5db409c7, equal via ls-remote,
hook 31/0, no --no-verify. Contract 105/105, integration 436/436, battery 31/31,
boundaries + ADR-018 types PASS, register OK (next 044). MAJOR diff: management-
web 1.3.0 -> 2.0.0, two ops reshaped, none added, none removed — exactly scoped.
15 routes e2e; not one bare status-code assertion. Cut B delivered N2, N3, routes
+ read surface, completion: notices run schema -> HTTP for staff and resident,
every route proven by the adapter bite.

NoticeRow — correct restraint; NAMED residual: the S2 overview still carries the
pre-ADR-019 notice vocabulary on one unrelated op — bounded two-vocabularies.
When the overview is next touched it takes the ADR-019 shape (own MAJOR or
folded). Owed, not implicit.

Role brand at HTTP: approve/decline demand RoleScope<'approver'>, so the approver
had to be a distinct principal — GEN-040's type-level distinction survived to
the outermost layer. Good.

The new principle caught its own test: two R2 adapter bites couldn't fire because
the HTTP test asserted only presence — exactly the vacuity
`adapter-bite-severs-the-plumbing` names, inside the test written to prevent
it. Fixed; accepted as the principle's first self-application.

A GUARD CAUGHT ITSELF — shared patterns are correlated lists. The reshape ran a
never-run fail() path; the runtime check refused `openapi-3.1` because the
extraction pattern [a-z0-9-]* has no dot — and the declaration, the cross-check
test and adrs-present.sh ALL used that one pattern: three checks, one blind
spot, unanimous. GEN-036's "independent witness" wasn't. Fixed (73 -> 74). It
also demonstrated GEN-036's named limitation: runtime enforcement covers only
codes that FIRE; dormant codes are the static cross-check's job, which must not
share the runtime pattern. RULING: recorded as `correlated-lists-certify-nothing`
applied to SHARED PATTERNS — three checks with one regex are one check in three
hats. RECOMMENDATION (next governance moment, small): the code grammar becomes a
single declared source all three consume.

PARALLEL TRACK NOTICE: a separate UI CC session now owns apps/management-web/**
(PO ruling 2026-09-02). Your write scope is unchanged (modules/**, database/**,
apps/api/**, docs/adr/**, governance/**, contracts). Do not touch
apps/management-web/**. The UI session does its own management-web readout —
nothing is asked of you for it.
