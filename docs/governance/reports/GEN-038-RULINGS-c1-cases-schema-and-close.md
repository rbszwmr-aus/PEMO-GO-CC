# GEN-038 CLOSE — C1: helpdesk + service_case schema

**Verdict: CLOSE.** Cut A's two schemas are complete.
Date: 2026-09-02
Filed by: Master Brain (Product Owner). Carried into the repository by `GEN-038`.

---

Merge confirmed: 14bcf37f -> 8b210ed2, tree-hash 294a993e, equal via ls-remote,
hook 31/0, no --no-verify. Contract delta NONE. Gate from nothing: contract
105/105, integration 384/384, battery 31/31, boundaries PASS, register OK (next
039). ADR-020 carried before any source cited it; adrs-present: 20 ADRs.

FORBIDDEN-TERMS DIFF — accepted, both judgments endorsed. monetary_type changes
the SCAN (reads column types; `adjustment numeric(12,2)` slips every name-based
term) — a real strengthening. Exceptions pruned to what is needed. `instrument`
(16) DROPPED — correct: lease/deed/mortgagee are ADR-011's boundary; a hit in
service_case catches an ADR-011 violation in a schema ADR-011's scan doesn't
cover. "A check that fails for another rule's reason teaches people to widen
the allowlist." If instrument terms should be corpus-wide, that's an ADR-011
scan-scope extension, not a re-add here. RULING: principle, defined in the
governance PID (prose name `a-check-fails-for-its-own-rules-reason`).

HAND-KEPT LISTS — inventory now precise: MigrationModule, KNOWN_SCHEMAS,
FILE_PATTERN, ModuleSchema, MODULE_SCHEMAS (five = the same fact five times,
growing per module) + the schema inventory test (the ONE legitimate declared
member). GEN-037's derived grants pair proved itself (48->55, no list edited).
RULING: the five derive from one source; inventory test stays the sole declared
member. First-class in the governance PID with this exact inventory.

SUPERSESSION TESTS WERE VACUOUS — reused assertion_id meant the PRIMARY KEY, not
UNIQUE(instance,version), rejected the duplicate; the test passed with the
constraint dropped. Fixed to a distinct id (the real race); both bit. The
mutation discipline caught it. RULING: SWEEP every existing supersession bite —
notices (GEN-037), scope_grant, group_membership (W-phase) — for the same
reused-id vacuity; fix each to a distinct id. First-class in the governance PID.
A bite that reds for a neighbouring constraint's reason is not a bite.

DIST HAZARD, SECOND INCIDENT, outside a bite: bite 5's mutated build survived into
pnpm test:integration (383/384, failure in mutated case-reporters.js). A forced
rebuild is a prerequisite for ANY run following a mutation; the harness lies in
both directions (false pass GEN-037, false fail here). RULING reaffirmed +
urgent: with-mutation.sh invalidates/rebuilds dist itself after restore. Until
then force a rebuild before any post-mutation run and say so.

CUT A: N1 done, C1 done -> closing governance PID next (five lists; reconciling
010-grants; with-mutation.sh dist; supersession sweep; principles
`correlated-lists-certify-nothing` + `a-check-fails-for-its-own-rules-reason`).
Then cut B.
