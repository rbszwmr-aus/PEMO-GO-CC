# GEN-040 CLOSE — N2: notices write surface (compose -> approve -> publish)

**Verdict: CLOSE.**
Date: 2026-09-02
Filed by: Master Brain (Product Owner). Carried into the repository by `GEN-040`.

---

Merge confirmed: 1a1d2ed0 -> 292f9da8, tree-hash b7580198, equal via ls-remote,
hook 31/0, no --no-verify. Contract 105/105, integration 407/407, battery 31/31,
boundaries PASS, ADR-018 type test PASS, register OK (next 041). Acts only.
Contract delta NONE (registry additive, unpublished until routes). Two
migrations; 0126 merged and immutable.

D2 — RoleScope<R>, role in the brand: the right generalisation, and both rejected
alternatives recorded for the right reasons (per-role copies = the hole one
level up; role-as-field = the comparison pushed back to every caller, which
ADR-018 retired). GrantAdministratorScope is an alias; GEN-035's type test
passes UNCHANGED — evidence, not a claim.

FAIL-CLOSED TWICE — one principle applied twice (no policy row => gated; empty
audience => refused): an undecided question about broadcasting to residents
resolves toward someone having to look. Accepted.

CASE 7 — no bite, honestly reported, accepted. Nothing re-resolves a snapshot in
this cut, so the plausible wrong rule (re-resolve on READ) doesn't exist yet.
RULING: the snapshot-as-at-publish bite is OWED to the read-surface PID. The
dispatch named no mutation for 7 — my omission.

THREE DEFECTS, each caught by something refusing:
  1 fixture invented a group id; audit_event FK refused. Correct.
  2 state check compared DISPOSITION name vs computed LIFECYCLE name — silently
    never matched, every approve => wrong-state. Design smell: the two
    vocabularies overlap (`approved` in both) so the wrong comparison type-checks.
    RULING (N3 / routes hardening): make disposition (event) and lifecycle (state)
    vocabularies DISJOINT (e.g. approval_granted vs approved) so comparing against
    the wrong union is a type error ("no overlap"), not a silent false.
  3 platform outbox publisher emits UNQUALIFIED SQL; can't resolve from a
    notices-scoped txn while D5 requires the event in that txn. The per-consumer
    adapter is the WRONG SHAPE (every future module would need one —
    hand-maintenance). RULING: fix at the SOURCE — the publisher emits
    schema-qualified SQL always; the adapter is then removed. Routes PID or sooner.

CUT B: N2 done -> N3 acknowledgement surface next (read/acknowledged/responded
acts, mandatory-ack, idempotent; disjoint vocabularies applied) -> notices routes
(HTTP contract, MINOR bump; publisher qualified at source; case-7 bite re-proven
with the read surface). Then cut C.
