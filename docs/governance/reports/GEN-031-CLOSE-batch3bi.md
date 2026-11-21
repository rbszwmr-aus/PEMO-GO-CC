# GEN-031 CLOSE — W3 batch 3b-i (schema + registerPrincipal)

**Verdict: CLOSE. Merge authorized.**
Date: 2026-09-01

## What is proven

Built and green on a database **rebuilt from nothing**: contract 105/105,
integration 334/334 (+10), battery 25/25, boundaries PASS, validator PASS.
Weight: 492 new lines / 40 insertions / 17 deletions. No contract, route, or
surface touched. This is a schema + one act (`registerPrincipal`) landing —
exactly the scope R4 carved for batch i.

## Schema decisions — each affirmed as argued, not assumed

1. **Stop-condition correctly did NOT fire.** `organization_id` is NOT NULL on
   `staff_principal`, so per-org uniqueness is directly expressible with no
   synthetic scope column. This is the R1 shape landing cleanly; no fiction
   introduced.

2. **nullable `external_id` + discriminator (`identity_source`) + biconditional**
   — NOT `num_nonnulls`. Correct: only one column is gated, so a single
   biconditional is the precise guard; `num_nonnulls` would be a heavier,
   vaguer instrument for a one-column condition.

3. **NULLS DISTINCT (opposite of migration 0120).** Right, and rightly argued
   from meaning, not copied: a NULL `external_id` means *no external identity*,
   and `NULLS NOT DISTINCT` would cap the table at one seeded principal per org.
   This is the C6 discipline in force — the constraint's null-semantics chosen
   for what it protects here, not inherited from 0120's different job.

4. **`identity_source` takes NO default** — "a lie with a fallback." Affirmed.
   A default would let a writer silently record a real person under the fixture
   discriminator, and the biconditional would then NULL that real person's
   `external_id`. Refusing the default carries ADR-016 D1's anti-fiction stance
   down into the DDL, where it belongs.

5. **No-credential claim asserted on the FULL column list**, not a spot-check.
   Affirmed — ADR-016 D3. The absence of a credential column is a property of
   the whole table, so it is verified against the whole table.

6. **Both mutations bite.** Dropping the biconditional reds both directions;
   the global (non-per-org) index reds the two-org case. The probe-must-bite
   discipline is satisfied — the guards are load-bearing, not decorative.

## Standalone-registration authorization — correctly flagged, not assumed

Main CC did NOT invent an authorization floor for `registerPrincipal` when
called standalone. That is the right call: bootstrap cannot be G-2-gated (no
prior principal exists), and the standalone route is not wired in this batch.

**Ruling: parked to batch iii**, where the membership routes are wired and there
is an actual caller and node in scope to decide the floor against. Main CC's
working hypothesis — that standalone registration carries the same floor
`addMembership` carries — is the correct default to test, but I rule it against
the real route shape at iii, not in the abstract now.

## Self-caught findings

The three self-caught findings are accepted. In particular, "the third PID where
an under-matching pattern of mine has cost a cycle" is exactly why R5 elevated
the grep-cluster sweep to its own governance PID, scheduled immediately after
W3. That item is confirmed in, not a nicety — a rule whose membership is grepped
by hand is a suggestion.

## The four gaps

Treated as **forward-carried, none a blocker** to this close. They map onto the
already-ruled sequence:

- batch ii (bootstrap) — the atomic register+group+grant+membership act,
  zero-grants-ever, `source='provisioning'`, carrying the provision contract
  **breaking** version bump (R3).
- batch iii (membership routes) — independent; carries the standalone-auth
  ruling above.
- ADR-008 amendment — field-removal-is-breaking; owed (R3).
- grep-cluster governance PID — after W3 (R5).

If any of the four listed gaps is NOT one of these four tracked items, hold it
out and flag it before batch ii pins — batch ii builds on this merged base.

## Merge (standard)

Refspec push from the worktree; main never checked out; tree-hash equality
re-read via `git ls-remote`; through the pre-push hook with **NO** `--no-verify`;
`[<batch PID id from the PID H1>]` commit tag. Rule 7 close: move the PID file to
`archive/` with its index row, `status: merged`, `closed: <TODAY from \`date\`>`
(read the date, do not carry a value).

— PO ruling, filed as durable record.
