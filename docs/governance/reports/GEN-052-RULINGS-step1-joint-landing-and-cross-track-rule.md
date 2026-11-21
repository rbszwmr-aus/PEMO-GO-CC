# GEN-052 — Step ruling: the UI gate is right; joint landing; cross-track rule

Date: 2026-09-03
State: GEN-052 built and green on every Main-owned check, committed 09ccaa2 on codex/gen-052; merge refused by the gated UI suite at apps/management-web/test/inventory/data-claims.test.ts:282 — "s5act/incomplete-translation claims no such Problem fixture, but one exists." Main CC stopped rather than resolve two colliding rulings on its own authority. Correct.

## The collision, named
Two rulings are both right: (1) Main CC touches no hand-written file under apps/management-web; (2) no merge past a red UI suite, no --no-verify. GEN-052 recorded the fixture UI-051 had declared absent; UI-051's data-claim prover is doing exactly what it was built for. This is the UI-045/GEN-046 G2 cycle class again: a corpus change that moves a UI claim can never merge under both rulings unless the adaptation lands in the same tree.

## Ruled: JOINT LANDING
When a Main PID's contract/corpus change moves a UI claim (the hook names which), the adaptation is authored by UI CC as a commit ON THE MAIN PID'S BRANCH, limited to the reds the hook names, tagged with the Main PID's id, author recorded in that PID's report. Main CC then merges the combined branch through the hook as usual. Neither track edits the other's files; the gate is never bypassed; there is no ordering cycle. Principle: `the-track-that-owns-the-file-writes-the-line`. Recorded as a shared pattern; the earlier "one-time exception" language for UI-045 is superseded by this rule.

For GEN-052 now: UI CC checks out codex/gen-052 (09ccaa2) in a worktree; retires the incomplete-translation absence claim in absence-claims.data.ts and binds the recorded fixture in its place (the part-2b D2 item for G1, and nothing else — wrong-state, reasonCode select, property-tree entry stay in UI-053); runs the management-web suite green on that tree; commits with [GEN-052]; pushes the branch (branch push, not a main refspec). Main CC rebases nothing away, re-runs the battery, merges. If UI CC's change needs more than the absence-claim retirement plus the claim binding to keep the prover green, it stops and reports the extra before writing it.

## GEN-052 findings — accepted, with two additions
- D4: the draft row is event_community, seeded ungated, so publishNotice from draft is correct under ADR-019's per-type policy. The row was wrong about submitNotice — a GEN-047 hand rule, not the registry or the act. Accepted, and it is a D1 breach that the GEN-047 matrix did not see: the matrix ran 5 states × 4 callers × 7 acts on one policy. ADDITION 1: the matrix gains the approval-policy dimension (gated type × ungated type); the derived test that pins every mob-s5 list to noticeActRegistry.permitted stays as the second line.
- The 500: notice-schedule-inverted hit the migration's CHECK at INSERT before the act's own check. Compose/revise/correct now refuse first; bite proven. Accepted. ADDITION 2 (owed harness class, not this PID): for every CHECK constraint in the notices and cases schemas, a test that the act refuses with a Problem before the row reaches the CHECK — a DDL constraint is the last line, never the first; a check fails for its own rule's reason, and a 500 is nobody's reason.
- D1 census: 32 declared Problem types, 9 fixtured, 23 missing; seven notices done; sixteen older named and owned in problem-debt.json. Accepted with a rule: every debt entry names its owning PID; no entry is added except by ruling; the parity check reds on any declared type that is neither fixtured nor in the debt file.
- 2.1.0 → 2.2.0 additive (reasonCode enum only); +7 refusal fixtures under the type each body carries; stale-version relabelled; manifest 32 proven / 0 failed / 0 unreliable. Accepted.

## Elsewhere
- GEN-049 merged (16a5991), close pending: send the GEN-049 step report (what the lock guarded, which of (i)/(ii) was taken, the two-connection bite, manifest entry proven, principle a-race-is-not-a-bite registered) — close ruling follows it.
- GEN-048 blocked on a GitHub token for D2: the PO supplies credentials directly on Main CC's machine (gh auth login, or a read-only Actions token in the environment) — never through the brain, never in chat, never in a file. Until then GEN-048 D1 (Flutter pin + gate) may merge alone with D2 reported as "not yet verified", or hold whole; Main CC's call, stated.
- GEN-050 allocated, not started; D5 hook guard added.

## After GEN-052 merges
UI-053 (part 2b) dispatched: property-tree compose entry (G6); wrong-state refusal + reasonCode select bindings (G2/G3); G7 column once ruled; live act exercise once GEN-050's dev-token exists.
