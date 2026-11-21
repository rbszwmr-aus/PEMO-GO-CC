# GEN-035 CLOSE — ADR-018 hardening (authority owns its precondition)

**Verdict: CLOSE.**
Date: 2026-09-01
Filed by: Master Brain (Product Owner). Carried into the repository by `GEN-035`.

Merge confirmed: `c1f69b67` -> `dcaec05d`, tree-hash `5392740f`, equal via
`ls-remote`, hook 27/0, no `--no-verify`.

---

GEN-035 CLOSE — ADR-018 hardening. VERDICT: CLOSE.

Bites: type-level (unfiltered set cannot reach the hardened admin check ->
compile error; mutation re-exposing a raw path reds the type-test) and
filter-correctness (a non-grant_administrator grant is excluded; a mutation
keeping non-admin grants reds it) both proven. W3 floor battery (ADR-017
D1/D2/D3) passed UNCHANGED and UNTOUCHED — independent witness that D4
behaviour-preservation holds.

D3 / findAuthorizingGrant: RULED keep the in-ADR clarifying note. My D3 named
findAuthorizingGrant as the admin G-2 chokepoint; it is imprecise —
findAuthorizingGrant takes role-carrying ScopeGrants and is also called with
estateStaffGrants (general, not admin-only). The typed-scope hardening wraps
the grant_administrator composition path, not findAuthorizingGrant wholesale.
The note corrects a pointer, changes no decision, landed in the ADR's first
commit (not a post-hoc edit of an accepted record), and prevents a future
reader mis-hardening findAuthorizingGrant and breaking estate_staff auth. No
amendment; not struck. ADR-018 is now merged/immutable — any further change is
an amendment.

Invented-citation catch: GEN-034 I5 caught `preserve-how-an-error-was-found`
(a name from an executor memory index, not a corpus principle) one PID after
I5 landed — the governance apparatus working as designed. Removing the
citation rather than inventing a definition was correct.

The last known authority hole in the grant system is closed by construction.
