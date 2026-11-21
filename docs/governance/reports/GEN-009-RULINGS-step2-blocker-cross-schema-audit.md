# GEN-009 Step 2 blocker — the cross-schema atomic audit, ruled

**From:** PEMO Master Brain → PEMO Main CC
**Status:** Structural blocker confirmed. **GEN-009 holds again; a precursor is required** — the platform audited-write primitive. The decision and the precursor PID are below. Pin `af7f6a86`.

---

## Property 4 inherited, and GEN-010 paid for itself on the first table

`0116` creates `access.audit_event` with no trigger, no rule, no mechanism, and `pemo_app` gets `INSERT,SELECT` automatically from GEN-010's `ALTER DEFAULT PRIVILEGES` — not a line of grant SQL. Property 4 holds by construction. The record keeps actor (`principal_id` FK) and authority (`group_id` + `role` + node) separate, with `occurred_at` as the instant the grant is read at, exactly as ruled. Accepted.

## Property 1 is blocked, and the failure mode is the worst of the three

You proved it rather than predicting it: two schemas, two pools, two search_paths, two transactions — the act rolled back, the audit survived. D1 warns of a *missing* audit; this produces a *false* one — a record asserting an authorised act that never happened. For a record whose only purpose is reconstructing authority after an incident, a confident falsehood is worse than silence. This is the blocker, and it is real.

## The decision — the audited write is a platform primitive, because the audit is cross-cutting

Two non-options first. **Fragmenting the audit into each module's schema** (so the act and its audit share one single-schema transaction) is rejected: it destroys the audit's purpose. The audit exists to answer "what did this principal do, under what authority," and an answer scattered across seven schemas is seven queries and no coherent record. **A module reaching directly into `access`** is rejected too: it is exactly the boundary violation the module-isolation model — which this project spent two PIDs proving — exists to forbid.

What remains is the principled answer: **the audit is a cross-cutting concern that every module's scope-only writes must record to, so it belongs to the shared layer all modules already depend on — `modules/platform` — not to any module and not fragmented across all.** Platform provides an **audited-write primitive**: one transaction spanning the calling module's schema and `access.audit_event`, atomic. The module hands platform the act and the audit fields; platform runs the single cross-schema transaction. Modules never reach across — platform, the sanctioned owner of the cross-cutting concern, does, once.

This preserves the isolation model rather than breaching it: a module writing across schemas stays forbidden; only platform's audited-write may cross, and only to pair an act with its audit.

## This is a precursor, like GEN-010, and for the same reason

It is a change to the shared platform boundary, it is the first cross-schema write path in the codebase, and all 27 scope-only writes depend on it — system-wide infrastructure, not GEN-009's skeleton. So GEN-009 holds and resumes on it, exactly as it held for the role model.

### Precursor PID — the platform audited-write

type GEN, allocate from the directory. Master Brain → Main CC. Pin current origin/main at Step 1.
write-scope: `modules/platform` (the audited-write primitive and connection handling), the boundary-enforcement check under `docs/governance/` or `verify-boundaries`, and its tests. `access.audit_event`'s home and the audit record shape stay with GEN-009. Read-only elsewhere.

**What to build:**
- A platform primitive that runs one transaction over the calling module's schema **and** `access.audit_event`, atomically — the single sanctioned cross-schema write path. Its shape (one connection whose transaction addresses both schemas by qualified name, or the equivalent) is yours to propose at Step 1.
- **The enforcement that it is the *only* cross-schema write path.** You flagged that `verify-boundaries` scans `modules/` only, so `apps/api` "may already" cross — and *may is not should*. Close it: no cross-schema write may exist except platform's audited-write. An obligation without its guard is the rot GEN-010 taught; a sanctioned crossing without a check that it is the only one erodes the boundary the same way.

**Done when, each by making it fail:**
1. **Atomicity — the false audit is impossible.** Reproduce your exact test: inject a failure after both writes; **both** the act and the audit roll back. The 0-act/1-audit state you produced must not be reachable.
2. The act commits with its audit, or neither commits — shown both directions.
3. **The boundary holds** — a cross-schema write attempted outside the primitive is caught by the enforcement; the primitive itself is recognised as sanctioned.

Two steps, HARD STOP before commit, as always.

## GEN-009 resumes after, and one flag carried to its completion

When GEN-009 resumes it uses the primitive; property 1 becomes "the act and its audit are atomic via platform's audited-write," property 4 is already inherited, and 2/3 are the record shape already built. **And `0116`'s down-migration refusal is written but not yet proven by firing** — unlike `0115`'s, which was. Before GEN-009 commits, that refusal must be made to fire: a written-not-fired guard is the empty oracle, and a down-migration that refuses on a non-empty audit table is exactly the kind of guard that must be seen to work.

## Principle this earns

> **A record written in a different transaction from the act it attests can survive that act's failure and assert a falsehood.** Its failure mode is not absence but confident wrongness, which is worse. An attestation and the thing it attests are atomic or the attestation is a liability. Into `PID-PRINCIPLES.md` under the next governance carry, with the others owed.
