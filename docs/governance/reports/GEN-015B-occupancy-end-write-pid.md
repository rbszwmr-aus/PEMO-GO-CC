# PID (Slice B) — the occupancy END write + the (resident,unit) cardinality mechanism + D6

**Author:** Master Brain → Main CC. **Dispatch: after GEN-015 (Slice A) closes.**
**Why now:** Slice A made occupancy assertion-shaped and its reads correct (the shared resolver,
liveness computed). Slice B is the additive half — the END write GEN-013 deferred, plus the
concurrency machinery Slice A deliberately excluded. This is a NEW PID (allocate at dispatch); it is
not GEN-015 (which closed on Slice A's scope).

---

type: GEN (allocate the number from the directory at dispatch; do not carry one in prose)
from → to: Master Brain → Main CC
pin: origin/main after Slice A's merge — read and report at Step 1
write-scope: the occupancy END write surface + handler + its contract (OpenAPI + fixtures +
lock/stamp), the `auditedWrite`/`ModuleDb` widening required by the chosen mechanism, the relevant
tests. Read-only elsewhere. Report exact paths at Step 1.

## What this builds
1. **The occupancy END write** — append `version + 1` with `effective_to` set (an explicit END, per
   the ADR-013 lapse-vs-end corollary: this is the *ended-by-act* path, distinct from lapse).
   Authorization UNCHANGED: scope-only `estate_staff` (ADR-011 D7 keeps occupancy out of interest).
   Gate as GEN-013/014 (name the deciding layer in the contract); reuse Slice A's resolver; the
   audited-write primitive (act + audit atomic); narrowest authorizing grant recorded.
2. **The `(resident, unit)` live-cardinality mechanism** (ADR-013 D5, occupancy ruling GEN-015 R1):
   one live occupancy per `(resident, unit)`. Partial-index and exclusion are impossible (ruled);
   the mechanism is a **serialization** of the check-and-append.
3. **D6 idempotency binding** (state-identity half only): a unique/serialization violation maps to
   the **winning act's client response**, never a raw conflict.

## Step 1 — propose the mechanism against the REAL code. HARD STOP.
- Propose the serialization mechanism, weighing at least:
  - **`SERIALIZABLE` + 40001-retry** — correct, but every write in that transaction becomes
    serializable (blast radius beyond this invariant);
  - **per-key advisory xact lock** (`pg_advisory_xact_lock(hash(resident, unit))`) — surgical,
    contends only on the same key, no isolation change, auto-released at commit;
  - whether any part reduces to the idempotency request-token (a double-SUBMIT is a retry; two
    genuinely distinct conflicting creates are not).
  **Guiding rule: the smallest blast radius that holds the invariant at the DB.**
- Propose the **`auditedWrite`/`ModuleDb` widening** the chosen mechanism needs (the primitive owns
  the transaction; `ModuleDb.transaction()` issues a bare BEGIN). State exactly what widens and why
  it is the minimum. This is the second shared-primitive touch — call it out in full.
- State whether this mechanism, once built, **retro-fixes GEN-013's create-path `(resident,unit)`
  race** (it should) and how that is proven.
- **I rule the mechanism and the widening before you build.**

## Step 2 — build, each proven by making it fail. HARD STOP before commit.
- **The END write.** Gate proven (grant end-dated → refused, absent). The act appends `version + 1`
  with `effective_to`; the reader (Slice A's resolver) answers **ended**. Reuse, do not re-derive.
- **Supersession safety (D2).** Two concurrent ends target the same next version → `UNIQUE(instance,
  version)` → one wins, the other mapped to the winning response (D6). Prove the unique bites.
- **The `(resident,unit)` mechanism.** Two concurrent CREATES of a live occupancy for the same
  `(resident,unit)` → one wins, the other refused/mapped. Prove the guard bites (remove it → the
  concurrent test reds). Include the **GEN-013 create-path** in the proof, since this is its real fix.
- **D6.** A repeated end resolves to the **same response**, not a second row and not a raw violation.
- **Generalisation.** State what is now shared for the next state-change table (the resolver reused
  unchanged from A; the mechanism, if reusable). Any shared code widened is a scope-touch — call it
  out (the `auditedWrite` widening especially).

## Reuse, unchanged
Slice A's resolver; the audited-write primitive; the gate shape (deciding layer named per contract);
narrowest-grant record; Property 4 inherited.

## Not in scope (owed, do not touch)
The idempotency **request-token** decision (D6 here is state-identity only); the other 3 state-change
tables (they reuse this resolver + mechanism later); ADR-consolidation; GEN-009 `sharedMeaning`.

Report the weight honestly. Two steps, HARD STOP at each.
