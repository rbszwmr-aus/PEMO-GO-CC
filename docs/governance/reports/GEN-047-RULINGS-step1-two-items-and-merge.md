# GEN-047 — Step ruling: the two HARD STOP items, Amendment 1 status, merge

Date: 2026-09-03
Report: docs/governance/reports/GEN-047-step1.md (built, green, committed, not merged)
PART A (GEN-046 close ruling carry-in) merged at a849254 — accepted, including the `data-tree-chrome` → backticks edit recorded inside the artifact (sixth instance of the collision; context-scoped citation recognition stays owed). GEN-047 allocated 5fde336, GEN-048 allocated 355d217, dispatch order — accepted.

## Accepted as built

- D1 substance: the seven acts call `stateRefusal`; acceptance 1 compares the list against actually invoking each act (5 states × 4 callers × 7 acts). Accepted. The one surviving hand-written state comparison that only selects a refusal's wording is accepted and must be NAMED in the close report as the single exception, so no future bite mistakes it for a second verdict path.
- D3 found three contract defects nothing else could see (`NoticeTransitionRequest` forbade the content fields revise/correct accept; eleven write responses + getNoticeOutstanding echoed no correlation id; parity rename assertion assumed last-segment path parameter). All three fixes accepted as MINOR (request widening and response-field additions are additive under ADR-008). This is the argument for D3 and is recorded as such.
- Teardown defect caught by rule 4 (deleted the seeded planned_interruption policy row; fail-closed bite reddened case 1 as undeclared collateral) — accepted; remedy "restore, never delete" is an instance of guard-remedies-are-non-destructive.
- G3 deferred (narrowing → raise per ADR-008 corollary) accepted. G7 deferred as a product decision accepted; the close report states the question in one line so the PO can rule it.
- Disclosed scope note (corpus-digest.json, corpus.g.ts regenerated under apps/management-web/**) — within the GEN-046 standing ruling; accepted.

## Ruling (a) — GEN-040 publish-advisory-lock bite is unreliable

Facts as reported: reds 6/6 in isolation; ok/FAIL/FAIL across the whole file. Diagnosed cause: case 12 is a real race; after fifteen preceding tests the publishes serialise naturally, so the mutation goes undetected one run in three.

Ruled:
1. NO isolation escape. A declared "run alone" lane judges mutations under conditions the suite never runs in and weakens rule 4 exactly where it matters — Main CC's reading is correct.
2. A bite that reds only sometimes certifies nothing. Principle to add (in the fix PID, not GEN-047): `a-race-is-not-a-bite` — a timing-dependent red is a claim; force the interleaving, or express the invariant as a constraint the database enforces, so the bite is deterministic.
3. Manifest, now: the entry's status becomes `unreliable`, carrying the diagnosis and the owing PID (GEN-049). The runner reports `unreliable` entries, does not run them, and counts them neither as proven nor as failed. 24 proven stands; the register is honest. GEN-047 may merge with that entry in that state.
4. The fix is its own PID, GEN-049 (notices module), allocated after GEN-047 merges and run in parallel with GEN-048 (disjoint files). Preference order, decided by what the lock actually guards:
   (i) If ADR-019's lifecycle makes "at most one publish assertion per notice" an invariant (withdrawn is terminal; correct cannot re-publish), replace the advisory lock with a partial unique index — the N3 pattern already ruled for acknowledgement — and map the violation to the existing state-conflict Problem. The bite becomes deterministic: drop the index → a two-connection test with an open transaction on connection A inserts the second publish on B and succeeds; with the index it is refused. No timing.
   (ii) If the lock guards more than uniqueness (name the specific thing: e.g. the approval read + audience snapshot as one critical section), keep the lock and make the test deterministic the same way: connection A holds the lock key inside an open transaction; B's publish is asserted to block and time out under `lock_timeout`; under the mutation B completes. The mutation is the lock acquisition; the red is B completing.
   Either way the test forces the interleaving with two connections and an open transaction; it never waits for a race to happen.

## Ruling (b) — permittedActions / stateEnteredAt / titleZhHant are REQUIRED

An always-emitted field declared optional is a false contract: every client must code an absence that never occurs, and UI-045's four-states-each-for-its-own-reason discipline is built on deterministic shapes. ADR-008 permits adding required response fields as MINOR.

The "do not touch mob-s5-notices/detail.json further" instruction was a GEN-046 step ruling written for the G2 cycle (the ungated red suite). That cycle is closed: UI-045 merged, the suite is gated and green. The instruction is lifted. The contract-bumping PID owns regenerated fixtures (GEN-046 standing ruling), so regenerating the three mob-s5-notices fixtures for the required fields is GEN-047's to do. The gated management-web suite is the check: if a UI-045 screen reds on the regenerated fixture, report it as a finding for UI part 2 — it is not a reason to keep the fields optional.

If the required fields move resident-mobile's surface (shared notice schema), bump resident-mobile 0.4.0 → 0.5.0 MINOR and say so — this is the "unless a G-finding requires — then MINOR, stated" clause of the dispatch.

## Amendment 1 — not visible in the report

The report shows 7 acts, no `createNotice`, no `ScopeTreeNode.permitted_actions`, no target-typed `canPerform`. Amendment 1 (`GEN-047-spec-amendment-1-permitted-actions-shape.md`, sent after the dispatch) applies BEFORE merge: A1 operationId vocabulary with a generated element type; A2 `ScopeTreeNode` carries the list, `createNotice` its only 2.1.0 value; A3 one target-typed function living with `RoleScope`, importing no notices type, acts call it with the same target; A4 allowed-only; A5 getScope fixture shows populated and empty. If it was already applied and the report predates it, show A1–A5 evidence in the merge report; otherwise apply now. Still 2.1.0 MINOR.

## Merge

Apply Amendment 1 + ruling (b) → rebuild from nothing → all green, manifest 24 proven + 1 unreliable → standard merge ([GEN-047], refspec push, main never checked out, tree-hash re-read, through the hook, no --no-verify) → Rule 7 close → HARD STOP for the close ruling. Then allocate GEN-049 (two-file commit) and start GEN-048 and GEN-049 in parallel worktrees.

---

*Carried into `docs/governance/reports/` by GEN-047's merge commit. ONE edit against the drive original: the HTML attribute named in square brackets in the PART A line now carries backticks alone, as `data-tree-chrome` — the SEVENTH instance of the collision `adrs-present` reads as a principle citation, and the reason context-scoped citation recognition is owed.*
