# GEN-041 CLOSE — N3: notices acknowledgement surface

**Verdict: CLOSE.**
Date: 2026-09-02
Filed by: Master Brain (Product Owner). Carried into the repository by `GEN-041`.

---

Merge confirmed: 7110815d -> 16148286, tree-hash 873aae6b, equal via ls-remote,
hook 31/0, no --no-verify. Contract 105/105, integration 418/418, battery 31/31,
boundaries PASS, register OK (next 042). Acts only; contract delta NONE.

D6 — your measurement corrected my premise; the STANCE is now ruled. No resident
act can write audit_event: principal_id FKs to access.staff_principal. The
refusal is at the FK, before GEN-025's biconditional — the identity boundary,
not the audit shape. Stop condition correctly not reached. RULING (chosen, not
defaulted): access.audit_event records STAFF authority-bearing acts; a
resident-authored act is evidenced by its OWN append-only domain fact — the
notice_acknowledgement row IS the record, as home_safety's ack already is. A
staff act on a resident's behalf is a staff act, audited normally. OWED: a small
ADR-014 scope amendment stating this, carried with the routes PID.

THE ADVISORY LOCK — RULED: DELETE IT. Your discrimination was right: lock
dropped + index intact -> one row; index dropped + lock intact -> two rows. The
PARTIAL UNIQUE INDEX is the mechanism, ON CONFLICT DO NOTHING is atomic — ADR-013
C3's row-presence case exactly. The lock exists for computed-cardinality
check-then-insert; acknowledge is insert-if-absent, nothing to protect. The
withdraw/ack non-contention window is BENIGN (an ack recorded microseconds
before a withdrawal is still true); closing it would serialize every ack of a
hot notice against one lock — wrong trade. A guard nothing can fire is deleted,
not documented as unproven. Case 7's bite becomes: drop the partial unique
index -> two rows -> reds (already shown). Deletion lands in the routes PID.

CASE 2 = GEN-040 case-7's bite, discharged at the ACT (snapshot gates; re-resolving
current occupancy reds). The READ-path variant stays owed to the read surface.

STRING-ESCAPING CLASS, incidents 5 + 6 — both in prose ABOUT escaping. RULING:
your general fix becomes a principle, defined in the routes PID (prose name
`sql-literals-hold-only-sql`): a SQL template literal contains only SQL;
explanation and comments live in the host language outside the literal.

DOWN MIGRATION dropped a view-dependent column; caught at 417/418 because the
suite exercises migrate down. Noted.

CUT B: N2 done, N3 done -> NOTICES ROUTES next (last cut-B PID), carrying: HTTP
contract + problem types (MINOR bump); outbox publisher schema-qualified at
source (adapter removed); disjoint disposition/lifecycle vocabularies; the
ack advisory-lock deletion; case-7 read-path bite; ADR-014 scope amendment;
`sql-literals-hold-only-sql`. Then cut C.
