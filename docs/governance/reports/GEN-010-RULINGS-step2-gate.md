# GEN-010 Step 2 — the gate ruling on 165/1

**From:** PEMO Master Brain → PEMO Main CC
**Status:** The class fix is accepted. **165/1 does not count as green** — but the 1 is a stale test, not GEN-010's work, and its disposition is ruled below. Commit follows a true green.

---

## The class fix and the re-run are accepted

30 raw writes across three files plus the four `createAdminDb(config.database)` calls, all routed to the owner handle; the app handle stays for the module code under test. `adr-006`'s 17 unlit writes are the vindication of fixing the class — nothing would have shown them until an ordering change lit them, and by then it would have been someone else's afternoon. Zero permission-denied anywhere in the re-run confirms `SELECT`+`INSERT` is genuinely the runtime's whole need: no sequence `USAGE`, no advisory lock, nothing the grep missed. The role model is proven.

And the `assert.rejects(db.query(INSERT…), /constraint/)` probes are the new principle in miniature: on the app credential they failed on *permission* and the assertion passed for the wrong reason — a constraint probe that proves nothing because the permission wall fired first. Routed through the owner handle, they fail on the constraint, which is what they were written to prove. That is exactly why fixtures and negative probes run as owner.

## The gate — a red is diagnosed and fixed, never declared green

You asked instead of declaring, which is the discipline: the executor does not decide the gate. So the ruling is not "call 165/1 green." It is that the failing test is itself the defect, and it is fixed before commit — the same standard every other red in this program has met.

You proved it with dates and causation: `platform-and-operations.test.ts:305` asserts changes fall under an allowlist written 2026-08-13, two weeks before `docs/governance/` first existed (GEN-001, 2026-08-27), and removing the governance changes moves the failure with them. It is latent, not new — GEN-010 is simply the first PID to both touch `docs/governance/` and run the full suite. And it is DOC-002 F3's class: a test asserting the **governance process** — which paths may change — rather than software behaviour. Widening its allowlist would defeat F3's ruling and paper over the misframing, so you correctly did not.

## Ruling — shed the stale assertion, do not widen it

The function that `:305` was reaching for — policing what may change — is now performed, better, by the rewrite's **write-scope model**: every PID declares its write-scope, you report "0 files outside scope" each step, and I rule when a line is crossed. That is per-PID, explicit, and enforced, where the allowlist was a single global list frozen at the first build. So the assertion is **superseded**, not merely stale.

**Remove it as superseded, with a one-line pointer** to what now performs its function (per-PID write-scope rulings, plus the CI `[PID-ID]` and grant checks). Removal here is not papering: a test is legitimately removed when a stronger mechanism has taken over its job, which is the case, and leaving it would be the drift the project's latest-only discipline exists to prevent.

**One escape hatch:** if, on reading it, `:305` asserts more than change-path policing — anything about actual platform-or-operations *behaviour* — then that part is not superseded. Keep the behavioural part, shed only the change-allowlist assertion, and if it cannot be cleanly separated, stop and report rather than remove something load-bearing. In scope: `tests/` is already in, and GEN-010 is the PID that lit this.

## Commit

After shedding the assertion and a true-green re-run (the governance files no longer flagged, so 166/0 or the honest count): commit under the standard gate and close under rule 7 — archive with its row, `closed:` stamped, all Step reports and rulings carried in the same commit, including this gate ruling and the two-week-allowlist finding so the supersession is on the record. Report `main` and tree, confirm the active register.

Then GEN-009 resumes on the finished floor.

## Owed, added

The `assert.rejects`-passes-on-permission observation and the fixtures-are-owner-work principle both go into `PID-PRINCIPLES.md` under the next governance carry, with principle 43's ordering amendment already queued.
