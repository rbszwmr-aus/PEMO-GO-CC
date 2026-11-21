# GEN-027 — W2: the grant write surface

**Status:** built, all green. **NOT COMMITTED. HARD STOP.**
**Pin:** `6ee9eb9d651651eba84df51f73895b1cfc7afd98`, re-read from the remote at build start — identical
to HEAD.

| gate | result |
|---|---|
| contract | **105 / 105** |
| integration | **298 / 298** (was 274 — **+24**) |
| battery | **24 / 24**, zero skips |
| boundaries PASS · validator PASS · contract stamp PASS · index OK | on a database rebuilt from nothing (39 migrations) |

**Three findings, two of them defects my own tests caught, and one about a mutation that lied.**

---

## THE FINDING — a refused act was audited and burned its idempotency key

`idempotentAuditedWrite` committed the transaction whatever the act returned. A module command
reports a refusal as a **value** (`{ kind: 'conflict' }`), not an exception — so a refused act wrote
an `access.audit_event` recording an act **that never happened**, and consumed its idempotency key,
so the caller's corrected retry came back as a D5 conflict.

**The audit is a record of ACTS (ADR-010 D1), and a false record is worse than a missing one** — the
same argument `GEN-009` made for atomicity, arriving from the other end.

Fixed with **`AuditedWriteOptions.committed`**: when it returns false the whole transaction rolls
back — no act, no audit, no key — and the refusal is still returned to the caller unchanged. **This
is a third touch on the shared primitive and I am calling it out rather than folding it in.** It is
~20 lines, opt-in, and omitting it preserves the previous behaviour exactly.

Found because the zero-ever test's *first* call (a cross-organization refusal) poisoned the key its
*second* call needed.

## THE SECOND FINDING — I walked into the trap my own module documents

`deriveRequestFingerprint`'s comment warns: *"a field that varies innocently between retries (a
timestamp the client regenerates) would refuse honest retries."* I then fingerprinted the **resolved**
`effectiveFrom`, which defaults to the request instant — so every retry digested a fresh timestamp
and an honest retry was refused as a D5 conflict. The retry test caught it.

**The fix is a rule, not a patch: fingerprint what the CLIENT SENT, never what the server filled in.**

## THE THIRD — a mutation that did not bite, and was wrong itself

Weakening the provisioning predicate from *ever* to *live* left all 298 green. **The mutation was
wrong, not the test**: filtering raw assertions by liveness still matches the open version-1 row.
The realistic wrong implementation resolves latest-then-liveness — and with that mutation the test
**reds**. Only asking *why* the green appeared separated the two.

---

## 1. `act_id` stability

**The act's own primary key IS the derived id**: `grant_id = deriveActId('gr', operation, key)`, half
a SHA-256 over the parts joined with U+001F (so `("ab","c")` and `("a","bc")` cannot collide). D5
moves to `request_fingerprint` (`0122`, `NOT NULL`, no default).

**Purity proven across a process boundary**, because a same-process assertion cannot tell a pure
function from one salted at startup — which would pass every in-process test and fail in production
exactly when a client retries after a deploy. The test spawns `node` and compares.

**Revoke proven separately, as directed.** Its version comes from *current state*, so a naive
recomputation after a successful first attempt would append **version + 2**; its stability rests
entirely on the key check preceding the act. The test asserts the chain still holds exactly 2
assertions after a retry.

## 2. Provisioning

**Zero grants EVER**, expressible inside `access` alone (`user_group.organization_id` + a join).
Serialised on a per-**organization** advisory lock — two provisioning attempts name different grant
ids and so would not contend on a (group, role, node) key. **Derived key = the `organizationId`**, and
the contract records why: A1 names an Organization-creation event, **no such event exists and none is
invented here**.

**Tested at the module, and that is the point.** Through the route the predicate is *unreachable* a
second time — the derived key replays or conflicts first — so a mutation to it would leave every
route test green. That is `[shadowed-layer-empty-oracle]`, so the decision is tested where it is made.

The provisioning audit carries `source='provisioning'` with **null** principal, group and role, and
the biconditional refuses the fabricated alternative.

## 3. The last-administrator guard — and a scope correction

**Your framing said "at the ORGANIZATION node". I implemented "the last live administrator ANYWHERE
in the organization", and the difference matters.** Your premise — *an estate without a local admin is
still administrable from above* — holds only if an administrator exists above it, which is not
automatic. What is definitively unrecoverable is holding **no live administrator at all**: nothing can
confer again, and provisioning cannot re-enter because the zero-ever predicate is permanent.

**What I did NOT guard, and it is a real residual hazard:** an administrator at estate E cannot
restore one at estate F, so a subtree can lose its administrator while the organization still has one.
Guarding that needs reachability analysis over the scope tree and would over-reach. **Named, not
fixed.**

## 4 & 5. Contracts and G-2

Three operations, contract **0.6.0** (MINOR: new operations and types), six problem types registered
with `emittedOnlyBy`, lock and stamp regenerated. Both mutating operations **require** a reason;
four-code vocabularies, no `other`; `role_change` shared because it means the same thing on both.
**A replay answers 200, not 201**, stated in the contract and asserted.

**G-2 is `findAuthorizingGrant` with two substitutions plus a role filter**, and the gate is an
**in-query filter** (`WHERE $node = ANY($allowed)`) so it is evaluated *inside* the act's transaction —
the `GEN-013` ruling. **Written into the contract:** a `grant_administrator` may confer
`grant_administrator` at or below a node they hold — *that is D3 working, not a leak* — so it cannot
later be "fixed" as an escalation.

## Proof — each by making it fail

| claim | evidence |
|---|---|
| act id pure | ✔ across a spawned process; separator collision case |
| G-2 on confer | ✔ admits in scope, **404** out of scope (never 403) |
| G-2 on revoke, **separately** | ✔ a foreign grant answers 404 |
| G-2 no over-reach | ✔ administrator at E refused at F, allowed at E |
| **remove the G-2 filter** | ✔ **278 pass, 20 fail** |
| provisioning at zero-ever | ✔ 201, `grant_administrator` at the organization node |
| refused once ever held | ✔ at the module; **mutate to "live" → red** |
| provisioning audit | ✔ `source=provisioning`, null authority, reason recorded |
| biconditional refuses fabrication | ✔ |
| revoke appends v+1, history answers | ✔ v1 untouched, both assertions retained |
| retry of revoke replays | ✔ exactly 2 assertions, no version + 2 |
| retry of confer replays | ✔ **200 not 201**, one act, one audit |
| same key, different request | ✔ 409 |
| reason required both ops; undeclared refused | ✔ |
| last administrator refused | ✔; **remove the guard → 294 pass, 4 fail** |
| no over-reach | ✔ a non-administrator revocation still succeeds |
| multiplicity preserved | ✔ two groups, same role, same node — both hold |

All mutations restored **byte-identically** (`cmp`).

## Weight — honestly

**1428 insertions / 165 deletions across 35 files, plus 5 new files (727 lines).** The 20 changed
fixture files are the contract-version stamp, regenerated by `stamp-version.mjs`, not hand edits. The
substance: the surface (3 routes, ~330 lines), the contract (3 operations + 4 schemas + 6 problem
types), the module commands, and a 551-line proof suite. **This is the largest PID of the phase, and
the test file is the biggest single piece — which is the right ratio for the surface that creates
authority.**

## Gaps — complete

1. **Provisioning cannot bootstrap a genuinely empty organization**: the group must already exist, and
   group creation is W3. **The most important gap here** — the bootstrap is not yet self-contained,
   and I did not expand into W3 to close it.
2. **`committed` is opt-in.** The four older `auditedWrite` callers do not pass it; their acts throw
   rather than refuse, so they are correct today, but nothing forces a future caller to declare it.
3. **Subtree administrator lockout is unguarded** (§3).
4. **The last-administrator check and the revocation take different locks** — the guard is keyed on
   (group, role, node), so two concurrent revocations of *different* administrator grants do not
   contend. Both could observe the other still present. Narrow, real, and named.
5. **No fixtures for the three operations** — they register via `emittedOnlyBy`, the same route the
   four existing management writes took.
6. **`resident` is an accepted `role` in confer** with no code path behind it.

## The one worked note

**I checked first, as instructed.** `[no-coincidental-collision]` is about **numeric** coincidence — *a
generated magnitude must not accidentally equal an unrelated corpus figure* — and does not state the
GEN-025 lesson despite its name. So the note went to **`[shadowed-layer-empty-oracle]`**, which does
own it: its body is already about a layer answering first. The note extends it — the shadowing layer
need not be a *designed* gate; an incidental pre-check or a primary key shadows just as completely —
and adds this PID's own instance and the mutation-that-lied. **58 principles, unchanged.**

**HARD STOP. Nothing committed.**
