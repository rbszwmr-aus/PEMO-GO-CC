# GEN-011 (platform audited-write) Step 1 — Rulings

**From:** PEMO Master Brain → PEMO Main CC
**Status:** Filed. Proceed to Step 2. Pin `db73c447` / `bf7aadf4` / 779, re-read from the remote and equal — the stale-pin correction is noted and was the right catch. Five rulings below.

---

## 1. The shape — approved, and smaller is the whole point

A fully-qualified `access.audit_event` write on the module's own connection, inside its own transaction, is atomic because there is one connection and one transaction — no second pool, no `search_path` change, no two-phase commit. You proved both directions (0/0 on rollback, 1/1 on commit) rather than asserting them. The 0-act/1-audit state that made GEN-009's audit a liability is now unreachable by construction. Approved. That the primitive turned out smaller than the PID assumed is the finding working — the simplest thing that satisfies D1 is the right thing.

## 2. Audit-specific, not a general cross-schema facility

Ruled: **audit-specific.** A general "write any schema from any module" facility would be a hole in the isolation model exactly the size of the model — anything could cross "via the facility," and the enforcement would have nothing precise to allow. The sanctioned crossing is granted for **one purpose**: a module's act plus its audit. That is least-privilege applied to the boundary crossing itself — the crossing exists for one reason, not as a capability. If a second cross-cutting concern ever needs the shared layer, it earns its own narrow, named primitive; it does not widen this one.

## 3. The discriminator and its validation — approved, and this is the third cry-wolf caught before it bit

Match only inside a string carrying a SQL verb, and validate the discriminator against the nine known-benign `apps/api` cases plus a planted real crossing — test the decision, not the read. Approved without change. You named it as the third instance of the class that cost two rebuilds and designed against it up front, which is principle 2 (a guard's false-positive rate is a safety property) applied *before* the failure instead of after. That is the corpus changing behaviour, which is what it is for.

## 4. Where the enforcement lives — with the boundary checks, not the register battery

It is a module-isolation rule, the same family as `no-module-to-module` and `no-simulator-in-runtime`, so its home is the boundary layer, where a reader looks for "what may cross a module edge" — not the register battery, which is about allocation, index and principles. Concretely: **extend the boundary check to scan `apps/api` too**, closing the genuine gap you found (`verify-boundaries.ts:72` walks `modules/` only), and put the cross-schema rule there. Its discriminator's validation (nine benign + planted crossing, proven by firing) runs wherever that check's own tests run. If the boundary checker has no self-test harness and the battery does, the validation may live in the battery — but the *rule* stays with the boundary checks. One home for isolation; you place the file, I've fixed the home.

## 5. The nested transaction — the primitive owns the transaction; nesting throws, it never silently joins

This is the one your gap made load-bearing. `clientDb` would silently join an existing transaction rather than nest with savepoints, and *silently* is the hazard: the primitive's `COMMIT`/`ROLLBACK` would then reach into a caller's transaction it does not own. Ruled:

- **The primitive is the transaction boundary.** The module hands it the act as a callback that runs on the primitive's transaction client, plus the audit fields; the primitive runs both and commits both or neither. The module does not open its own transaction around it.
- **If the primitive is called within an existing transaction, it throws — loudly, not silently joins.** A silent join is the cry-wolf class inverted: not a false alarm, but a false *calm*, the primitive behaving as if it controlled a transaction it had actually joined. Prove it by making it fire: call the primitive inside a transaction, show it throws.
- Savepoint-aware nesting is a real future extension, but only when a real case needs act + audit + more work atomic. It is not built now — YAGNI, and fail-loud is the safe default until a genuine need designs it deliberately.

## The two visible gaps

- **The atomicity proof used a probe table, not `0116`'s real `access.audit_event`** (that migration is GEN-009's, not on `main`). Correct and honest: the mechanism is table-agnostic — a qualified write in one transaction is atomic whatever the table — so this does not block GEN-011. But when GEN-009 resumes and `0116` lands, confirm the primitive against the real `access.audit_event`, not only the probe. Carried to GEN-009.
- The pin self-correction (stale hash from a prior analysis, re-verified against the remote) is the stale-read discipline working on your own report. Noted, and right.

## Step 2

Build the audited-write primitive (owns the transaction, act-callback + qualified audit insert, throws on nesting), the boundary check extended to `apps/api` with the validated discriminator. Prove each by making it fail: both-or-neither in both directions; nesting throws; a planted cross-schema write outside the primitive is caught while the nine benign cases are not. HARD STOP before commit. Then GEN-009 resumes and uses it — and this time it finishes, because the last hidden foundation is now under it.
