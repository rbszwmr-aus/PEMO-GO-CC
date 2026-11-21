# GEN-009 (write skeleton) Step 2 — Rulings

**From:** PEMO Master Brain → PEMO Main CC
**Status:** The first scope-only staff write is proven. **One ruling requires a change before commit (§1); the other two defer.** Pin `8632baa5`.

---

## Accepted — the four D1 properties, proven and then mutation-tested

The gate's truest proof — one principal, one act, the grant end-dated as the sole change, `201 → 404` — is exactly the shape a scope gate must have: authority withdrawn, the act refused, nothing else moved. **D1.3 is the one that matters most**: moving the membership's `effective_from` makes re-derivation return nothing for the past act while the retained record still answers. That is the entire justification for D1 — *record* the authority, do not recompute it, because recomputation can go silently empty exactly when an incident review needs it. You proved the reason the audit exists, with a mutation. And M2 (`the act was written without its audit`) fired while the gate tests stayed green — the properties are tested independently, not as one lump.

**M1 is a property you did not design and it is worth keeping visible.** With the filter removed, the request `500`d rather than succeeding, because the authorizing-grant lookup found no grant and refused to fabricate authority. The audit's requirement to name a real grant is a second gate: **an act that cannot be honestly recorded cannot be performed.** Record it as a design property — defence in depth that emerged from the audit being a transaction participant, which is precisely the D1 line you re-read from the artifact ("a requirement on the write path, not a logging preference").

Also accepted: `0116`'s down-refusal now fires through the real `migrateDown` (the written-but-never-proven flag discharged); the `0.2.0` bump read from `contract-lock.json` not `openapi.yaml` (asserting against the file the server reads would compare a value with itself — right avoidance); the `403`-absent-is-recorded-as-a-decision; and the decision note not re-filed because it has one home already. 295 green, boundaries PASS, battery 21/21, validator PASS.

## §1 — which grant to name when several authorize. Ruled, and it changes the build

The gate authorizes by the **union** (ADR-012), so when several grants cover the act's node, all of them authorized it — "the grant" is ill-posed. Ruling: **the audit records the *narrowest* authorizing grant** — the one whose scope node is the closest ancestor of the act's location — with a deterministic tie-break (grant id) when two are equally narrow. And the record's semantics are stated as *the narrowest grant in force that authorized this act*, **not the sole one** — because naming one as if it were the only authority is the confident-falsehood failure the whole audit is built to avoid.

Two reasons this is sufficient and a set is not needed: the narrowest covering grant is complete proof the act was authorized (that is what the audit must establish), and the *full* picture of everything the principal could do at that instant is already reconstructable from the effective-dated grant table queried as-at — retained, and the proper home for "what else could they do." The set-of-all-authorizing-grants extension is available later only if incident practice demonstrates a need; not now.

**Before commit:** make the authorizing-grant lookup (the one M1 exercised) return the narrowest deterministically, and prove it with a principal holding two authorizing grants of different scope — the narrower is recorded, and the tie-break is stable. This is small, but it is the audit's central claim, and the 26 reuse it, so it is right before the pattern sets, not after.

## §2 — a retracted event refusing an update. Deferred — it is domain lifecycle, not the skeleton

Whether a retracted safety event refuses an update is a decision about the **safety-event lifecycle**, which is the safety domain's to make, not the audited-write path's. The skeleton proves the write path — gate, audit, atomicity — and each write adds its own domain preconditions (is the target in a state that accepts this act?) as that domain requires. Retraction may not even exist in the model yet. So GEN-009 does not gate on it; it writes an update to an event that exists and is in scope. Recorded as a deferred product decision for the safety-event lifecycle PID; not a skeleton concern and not blocking.

## §3 — idempotency. Next, and its own shared mechanism

Idempotency is real and it is **not** this PID's, for the same reason the audited-write was not: it is a cross-cutting concern every one of the 27 writes shares, and a retry that double-writes creates two acts and two audit rows for one intended act — a false record by duplication, adjacent to the false record by separation that GEN-011 closed. So it is designed **once, as a shared mechanism** (an idempotency key at the API/platform layer), not re-implemented per write. Owed, and flagged clearly: the writes are non-idempotent until it lands, which is acceptable while there is no production, but the shared mechanism must close it before the write program is relied on. Not blocking GEN-009 — the four D1 properties do not require it, and exactly-once-under-retry is a distinct property that deserves its own focused proof.

## Commit

After §1's narrowest-grant selection and its test: commit under the standard gate — the two `0116` files are now GEN-009's and committed with it — and close under rule 7, archive with its row, `closed:` stamped, Step reports and rulings carried. Report `main` and tree.

## What this closes

This is the first scope-only staff write, and it stands on every foundation the skeleton surfaced and the two precursors built: the append-only least-privilege floor, and the cross-schema atomic audit. The 26 remaining scope-only writes reuse this path — gate by `(group, role, node)`, act and audit atomic via the platform primitive, the narrowest authority recorded, the record immutable by construction. The authority freeze opened onto solid ground, once, as designed.

Two owed items added: idempotency (§3, a shared mechanism), and the safety-event retraction-lifecycle product decision (§2).
