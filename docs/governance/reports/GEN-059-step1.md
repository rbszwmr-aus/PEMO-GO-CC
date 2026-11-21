# GEN-059 — the cross-schema SQL scanner matches text, not SQL (step 1)

**PID:** GEN-059 (branch `codex/gen-058`, worktree off `79275b1`)
**Date:** 2026-09-04
**Status:** author-complete, proven, HARD STOP before commit — awaiting the landing ruling.

## The defect

Main red at `9063278` (UI-054's merge), on my track's `no-cross-schema-sql` boundary check:

```
FAIL  no-cross-schema-sql(apps/management-web/tool/live-exercise.ts) — notices.length
```

`apps/management-web/tool/live-exercise.ts:184` runs no SQL (it makes HTTP calls):

```js
say(`${who}: ${l.data.notices.length} notices visible, ${mine.length} from this run`);
```

The scanner extracts string literals carrying a SQL verb, then matches `\b<schema>\.<ident>`.
This literal (a) carries the English word **"from"** — a SQL verb by the word test — and (b)
interpolates `${l.data.notices.length}`, whose text `notices.length` matches the `notices`
schema. A log line was read as a cross-schema statement, and it reddened the UI track's merge on
a Main-track guard the UI author had no reason to know about.

## D1 — the rule chosen, and why it is not a bigger denylist

**A schema-qualified name, and the SQL verb that makes it a statement, are read from the STATIC
text of a string literal only — never from a `${...}` interpolation.** A template's interpolation
is a JavaScript expression evaluated to a value at runtime, not SQL text the scanner can read. The
rule narrows WHERE a token is allowed to count (the authored SQL skeleton) rather than enumerating
more forbidden tokens — so it removes false positives without weakening detection: a real crossing
is written as literal SQL text (`FROM access.audit_event`), which is exactly what static text
preserves.

## D2 — interpolations excluded ENTIRELY (stated, with the reason)

Not "only when no verb is present." Excluded unconditionally, because:
1. a real cross-schema crossing is literal SQL text, never spliced in via interpolation; and
2. a schema name that DID arrive by interpolation is a variable the regex cannot resolve anyway,
   so excluding it loses no real detection.
The verb is read from the same static text, so a verb appearing only inside an interpolation
(`${sql.SELECT}`) cannot promote a bare property access into a "statement".

Implementation: a `staticText(literal)` helper strips `${...}` (brace-aware, each replaced by a
space so adjacent static chunks cannot fuse), applied in `sqlStrings` before the verb test; the
qualified-name match then runs over static text. `apps/api/src/cli/cross-schema-scan.ts`.

## D3 — bites BOTH ways (certified: `run-mutations.mjs GEN-059` = 2 proven, 0 failed)

- `interpolation-text-is-not-scanned-as-sql` — reverts `sqlStrings` to scan the raw literal
  (interpolation included). Target test `[probe-must-bite] UI-054 exact line …` reds (the printed
  `x.notices.length` is reported again); declared collateral: the verb-in-interpolation test.
- `made-precise-by-disabling-is-caught` — makes `staticText` over-strip (`return ''`), the
  "precise by disabling it" failure the ruling names. Target test `[probe-must-bite] the same
  qualified name as LITERAL SQL text still reds` reds; declared collateral: the four other
  detection tests. **The precision tests stay GREEN while detection dies — exactly how a disabled
  guard hides, which is why this is the bite that matters.**

Regression fixture: UI-054's exact line is now a test asserting `findCrossSchemaSql` returns `[]`,
paired with a control that the same qualified name written as literal SQL text still reds.

## D4 — the sweep

Ran old (interpolation-included) vs new (static-text) scanner over all **203** scanned `.ts`
files (`apps/**`, `modules/**`, excluding `dist`/`node_modules`/tests, exemptions applied both
sides). **True false positives of this class carried by the old scanner: 1** — exactly
`apps/management-web/tool/live-exercise.ts: notices.length`, the one that fired. **Other latent
false positives nobody had hit: 0.** The interpolation class had a single victim in the repo, and
the fix clears it with nothing else hiding behind it.

## Principle registered

`[a-guard-that-matches-text-without-its-context-reds-for-someone-elses-reason]` — `PID-PRINCIPLES.md`,
in the guard cluster. Distinguished from `[anchor-the-discriminator]`: there the pattern was
unanchored; here it was anchored correctly but pointed at the wrong text (a runtime value).

## Scope / interaction

- Write scope: `apps/api/src/cli/**` (the scanner), `tests/integration/**` (its bites),
  `docs/governance/**`. No management-web, no schema, no contract.
- UI-054's labelled one-line WORKAROUND (a hotfix PID) turned main green; this real fix lets that
  workaround be reverted — the UI track owns that revert, in its next PID.
- Sequenced by me as the active incident, ahead of the GEN-055 re-run resumption.

## The separate R6/local-gate finding (not this PID)

Recorded for the governance PID the Brain flagged: this class was invisible to UI CC locally
because the UI track's `prove.sh` runs dependency-cruiser but NOT `apps/api`'s `verify:boundaries`
(GEN-048's R6 unified the build path for the Main track only). I am NOT acting on it here; awaiting
the two check-lists before the pre-push/CI unification PID.

## Landing-ruling actions (step 1 addendum)

**A) Renumbered GEN-058 → GEN-059.** The register's counter is global across GEN and UI, so
GEN-058 and UI-058 were the same number, and UI-058 (the `live-exercise.ts` hotfix) is merged and
closed on main. The merged, closed PID keeps the number; this PID renumbered to the next free id,
**GEN-059**, by a fresh two-file allocation. The old number is not reused.

- **Why the parallel-allocation rule did not prevent it:** I ran `pid-index --next` against a
  STALE base — the worktree was off `79275b1`, which predated UI-058's out-of-band allocation
  (`28c3dfa`), so the scan saw 058 as free. (The out-of-band authorisation of UI-058's hotfix was
  the Brain's, not the executor's; recorded per the ruling.)
- **Can the allocator detect it itself?** YES, and it does: rebased onto `714c2b8` (which has
  `archive/UI-058.md`), `pid-index --check` reds
  `duplicate NNN 058 held by 2 files: pids/GEN-058.md, archive/UI-058.md`. The pre-push hook runs
  this check, so the collision would have been refused at push. The residual gap is not detection
  but TIMING: `--next` scans the worktree's base rather than latest `origin/main`, so a number can
  look free at allocation and be taken by the time of push. That is an allocation-hygiene item for
  the **gate-coverage PID** (allocate against fetched `origin/main`, or have `--next` refuse when
  the base is behind), not a fix here.

**What catching this before the push bought.** The red-base branch was caught before it merged,
not after — cost: one rebase. That is exactly what `[a-push-is-a-finished-tree]` buys: the branch
was still a working position, cheap to move; a push would have made it a published tree and the
correction a revert on main. One rebase is the price of the principle, paid up front.

**B) Rebased onto `714c2b8` (green main).** The original worktree was off `79275b1` — one of the
three red commits, before UI-058's fix. Rebased the uncommitted work onto `714c2b8` (no overlap;
UI-058 touched `live-exercise.ts` and the generated index, none of my files). Re-ran after the
rebase — see below.

**Removed UI-058's workaround comment.** With D1/D2 landed, the binding is no longer needed for the
guard; per the ruling the binding stays (it reads fine) and the COMMENT goes. I am the workaround's
creditor, and a debt whose creditor has paid should not keep advertising itself. `const visible =
l.data.notices;` remains; the WORKAROUND block above it is gone.

**Re-run on the rebased tree:** discriminator suite green (11/11); `run-mutations.mjs GEN-059` =
2 proven, 0 failed; `verify:boundaries` PASS (including `live-exercise.ts` with the comment
removed).

## HARD STOP

Author-complete and proven. Awaiting the close ruling after merge.
