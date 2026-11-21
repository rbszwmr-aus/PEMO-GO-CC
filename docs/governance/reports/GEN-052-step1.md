# GEN-052 step 1 — management-web 2.1.0 → 2.2.0: Problem-type parity, reason codes, the draft row

**Date:** 2026-09-03  **Pin:** `dede0e9` (allocation) → built on `15b26fc` (UI-051 merged).
**API suites:** contract 115/115, integration 462/462. **Validator:** only the two pre-declared S2 gaps.
**Manifest:** see below. **Battery:** 34 pass; the management-web gate reports ONE moved UI-051 assertion — §D5.

## D4 — investigated: the fixture, not the precondition, and on a different act than reported

The draft row `ntc_0820_bbq` is `event_community`, which the seed declares **ungated**. For an ungated
type, `publishNotice` from draft is CORRECT by `ADR-019` (`GEN-040` case 1b); `stateRefusal` admits it
only when `gated` is false, and the act does the same. **The row was still wrong — on `submitNotice`**,
which only a gated type has. Cause: at GEN-047 ruling (b) I patched the three `mob-s5-notices`
fixtures by a hand rule, not from the registry, and my rule listed submit on every draft. **Why parity
missed it:** operation parity checks that a fixture EXISTS for an operation; nothing checked a
fixture's VALUES. Fix: `notice-fixture-permissions.test.ts` pins every mob-s5 item's list to
`noticeActRegistry.permitted(...)` under the seeded policy — the corrected rows drop `submitNotice`
(two rows moved: `ntc_0820_bbq`, `ntc_state_draft`). **Bite:** re-introduce submit on the ungated draft →
reds. The precondition and the act are untouched and agree.

## D1 — Problem-type parity, and what recording the refusals found

Census: **32 Problem types declared, 9 fixtured, 23 missing** — seven notices, sixteen older.
The parity test now derives every `problems/<type>` from the contract text and reds on any without a
fixture unless named in `problem-debt.json` (16 entries, each with an owning PID). The seven notice
refusals are **recorded from the real acts, written only if the body carries the type the file is named
for** — a refusal that came back as another type is skipped and printed, never misfiled.

**A subject defect that recording found: `notice-schedule-inverted` was a 500.** Migration 0126's
`CHECK notice_schedule_ordered` fires on every assertion, drafts included, and the act checked the
schedule only at publish — so composing an inverted draft hit the constraint at INSERT and surfaced as
`internal-error`. The contract declared the refusal; nothing had ever produced it. Fixed: compose,
revise and correct refuse `schedule-inverted` before writing. Test + bite (drop the compose check →
reds). The empty-audience refusal needed a building with **zero** residents — `blk_wfg_b`; my first
target had one and published.

## D2 — relabelled
`refusal-wrong-state.json` (which carried `notice-stale-version`) → `refusal-stale-version.json`; a real
`refusal-wrong-state.json` recorded (revise on a withdrawn notice). A test now requires every
`refusal-*` file's name to match its Problem type. **Bite:** misfile it again → reds.

## D3 — one source for reason codes
`packages/api-contracts/notice-reasons.json` is the source (4 acts, **14 distinct codes** — the
registry's 15 include `wrong_audience` twice, decline and withdraw). `generate-notice-reasons.mjs`
writes `notice-reason-codes.ts`, which `notice-reasons.ts` now imports, and under `--check` (in
`prove.sh`, battery 34 → 35) verifies the contract's `reasonCode` enum equals the union.
`NoticeTransitionRequest.reasonCode` gains that enum, per-act subsets documented. **Bite:** add a code
to the JSON without regenerating → reds.

## Contract diff 2.1.0 → 2.2.0
Additive: the `reasonCode` enum on an existing string, version stamps. Problem enum regenerated via
`gen:enums`. resident-mobile untouched.

## D5 — consumers regenerated; one UI-051 assertion moved
`corpus.g.ts` and both digests regenerated. The gated management-web suite reports one failure, which
the dispatch pre-rules a **part-2b finding, not fixed here**:

```
✔ every source file is actually TRACKED, not merely un-ignored (3.031293ms)
```

It moves because the corrected fixtures no longer list `submitNotice` on ungated drafts (D4) and/or the
refusal file was relabelled (D2). The UI PID that binds G1/G2/G3 fixtures picks it up.

## Fixtures
management-web: **+7 refusal fixtures** (approval-required, incomplete-translation, wrong-state,
retargeting-forbidden, not-found, schedule-inverted, empty-audience) + the relabel; 31 recorded per run.

## Joint landing (step ruling) — authorship recorded
The merge was refused by the gated UI suite on the pre-ruled finding, and the step ruling resolved it as a
**joint landing**: **UI CC authored `b015387`** on this branch (fetched from `origin/ui/gen-052-joint`, one
commit above `09ccaa2`, a fast-forward; git author `luipt`, the shared account), tagged `[GEN-052]`, six
files all under `apps/management-web/`: the incomplete-translation absence claim retired and the recorded
fixture bound in its place, one browser test re-pointed by type, inventory 73→74 / 365→366 / 494→495.
Nothing of mine touches those files; nothing of theirs touches mine. Standing rule from here:
**the track that owns the file writes the line.**

## Addition 1 — the matrix gains the policy dimension
GEN-047's matrix chose the type from the state, so no draft was probed under BOTH policies — which is
exactly where the submitNotice hand rule hid. Case 1 now runs **7 cells of (state × gated/ungated)
× 4 callers × 7 acts** against real invocation; the derived registry pin stays as the second line.

## Close
Closed against the filed step ruling `GEN-052-RULINGS-step1-joint-landing-and-cross-track-rule.md`.
HARD STOP for the close ruling.
